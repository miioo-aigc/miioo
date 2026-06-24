from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.video_clip import VideoClip
from app.models.asset import Asset
from app.models.model_config import ModelConfig
from app.services.media_storage import (
    get_media_fallback_extension,
    persist_if_external,
    persist_many_if_external,
)
from app.services.model_capabilities import (
    infer_video_reference_mode,
    resolve_optional_model_toggle,
    resolve_user_model,
    validate_video_request,
)
from app.services.model_selection import get_default_available_model_id
from app.services.video_gen import video_gen_service
from app.services.user_api_key import get_user_model_provider_runtime
from app.services.visual_styles import resolve_visual_style_text

router = APIRouter()


async def _get_default_video_model(user_id: UUID, db: AsyncSession) -> str:
    return await get_default_available_model_id(
        user_id,
        db,
        category="video",
        fallback_model_id="doubao-seedance-2.0",
    )


class VideoClipResponse(BaseModel):
    id: str
    project_id: str | None
    storyboard_id: str | None
    video_url: str
    duration: float
    model: str | None
    prompt: str | None
    created_at: str


class GenerateVideoRequest(BaseModel):
    storyboard_id: str
    model: str | None = None
    duration: float = 5.0
    reference_mode: str | None = None
    first_frame_url: str | None = None
    last_frame_url: str | None = None
    reference_video_url: str | None = None
    reference_audio_url: str | None = None
    ratio: str | None = None
    generate_audio: bool | None = None
    watermark: bool | None = None


@router.get(
    "",
    response_model=list[VideoClipResponse],
    summary="获取项目视频片段列表",
    description="读取当前项目下的视频片段列表，供项目内视频结果管理与回显使用。",
    response_description="视频片段列表。",
)
async def list_video_clips(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(VideoClip).where(VideoClip.project_id == UUID(project_id), VideoClip.user_id == user.id)
    query = query.order_by(VideoClip.created_at.desc(), VideoClip.id.desc())
    result = await db.execute(query)
    return [
        VideoClipResponse(
            id=str(v.id), project_id=str(v.project_id) if v.project_id else None,
            storyboard_id=str(v.storyboard_id) if v.storyboard_id else None,
            video_url=v.video_url, duration=v.duration,
            model=v.model, prompt=v.prompt, created_at=v.created_at.isoformat(),
        )
        for v in result.scalars().all()
    ]


@router.post(
    "",
    response_model=VideoClipResponse,
    status_code=201,
    summary="生成项目视频片段",
    description="基于指定分镜生成项目内视频片段，并将结果写入视频片段记录与资产库。",
    response_description="新生成的视频片段。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "storyboard_id": "3f9fd8c2-aef6-4f11-a91e-b7fc5f9c4a63",
                        "model": "doubao-seedance-2.0",
                        "duration": 5,
                        "reference_mode": "first_frame",
                        "first_frame_url": "/uploads/storyboards/demo-first.png",
                        "ratio": "16:9",
                        "generate_audio": True,
                        "watermark": False,
                    }
                }
            }
        }
    },
)
async def generate_video(
    project_id: str,
    req: GenerateVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    # 获取分镜信息
    sb_result = await db.execute(select(Storyboard).where(Storyboard.id == UUID(req.storyboard_id)))
    sb = sb_result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    prompt = sb.image_prompt or sb.content or ""
    if not prompt:
        raise HTTPException(status_code=400, detail="分镜无画面描述")

    requested_model = req.model or await _get_default_video_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="video",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    provider_runtime = await get_user_model_provider_runtime(
        user.id,
        db,
        category="video",
        requested_model=model,
    )
    if not provider_runtime:
        raise HTTPException(status_code=400, detail="未配置视频模型对应服务商，请先在设置中配置")
    api_key, base_url, _, model, _, default_video_watermark = provider_runtime

    visual_style = ""
    project_obj = (await db.execute(select(Project).where(Project.id == UUID(project_id)))).scalar_one_or_none()
    if project_obj:
        visual_style = project_obj.visual_style or ""
    resolved_visual_style = await resolve_visual_style_text(visual_style, user.id, db)

    style_parts = []
    if resolved_visual_style:
        style_parts.append(resolved_visual_style)
    style_parts.append("consistent character appearance")
    style_parts.append("consistent scene environment and atmosphere")

    if style_parts:
        prompt = f"{prompt}, {', '.join(style_parts)}"

    stored_gen_params = sb.gen_params or {}
    explicit_first_frame_url = req.first_frame_url
    first_frame_url = explicit_first_frame_url or sb.image_url
    reference_video_url = req.reference_video_url or stored_gen_params.get("reference_video_url")
    reference_audio_url = req.reference_audio_url or stored_gen_params.get("reference_audio_url")
    ratio = req.ratio or stored_gen_params.get("ratio") or "16:9"
    generate_audio = (
        resolve_optional_model_toggle(
            model_id=model,
            category="video",
            capability_key="supports_generate_audio_toggle",
            requested_value=req.generate_audio,
            stored_value=stored_gen_params.get("generate_audio"),
        )
    )
    watermark = (
        resolve_optional_model_toggle(
            model_id=model,
            category="video",
            capability_key="supports_watermark_toggle",
            requested_value=req.watermark,
            default_value=default_video_watermark,
            stored_value=stored_gen_params.get("watermark"),
        )
    )
    reference_mode = (
        (req.reference_mode or "").strip()
        or infer_video_reference_mode(
            model,
            first_frame_url=first_frame_url,
            last_frame_url=req.last_frame_url,
            reference_video_url=reference_video_url,
            fallback_to_full_on_unsupported_first_frame=True,
        )
    )
    validated = validate_video_request(
        model=model,
        prompt=prompt,
        ratio=ratio,
        resolution=None,
        duration=req.duration,
        generation_mode=stored_gen_params.get("generate_mode"),
        reference_mode=reference_mode,
        first_frame_url=first_frame_url,
        last_frame_url=req.last_frame_url,
        reference_video_url=reference_video_url,
        reference_audio_url=reference_audio_url,
        generate_audio=generate_audio,
        watermark=watermark,
    )
    effective_first_frame = None
    if validated["reference_mode"] in {"first_frame", "video_ref"}:
        effective_first_frame = first_frame_url
    elif validated["reference_mode"] == "full":
        effective_first_frame = explicit_first_frame_url
    effective_last_frame = (
        req.last_frame_url
        if validated["reference_mode"] in {"full", "last_frame", "video_ref"}
        else None
    )
    ratio = validated["ratio"] or ratio

    try:
        video_result = await video_gen_service.generate(
            prompt=prompt,
            api_key=api_key,
            base_url=base_url,
            image_url=sb.image_url,
            model=model,
            duration=req.duration,
            reference_mode=validated["reference_mode"],
            first_frame_url=effective_first_frame,
            last_frame_url=effective_last_frame,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            ratio=ratio,
            generate_audio=generate_audio,
            watermark=watermark,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"视频生成失败: {str(e)}")

    if not video_result.get("url"):
        raise HTTPException(status_code=502, detail="视频生成失败: 未返回视频地址")

    try:
        video_url = await persist_if_external(
            video_result["url"],
            f"video-clips/{project_id}",
            fallback_extension=get_media_fallback_extension("video"),
            url_label="视频片段地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频文件落盘失败: {str(exc)}") from exc
    if not video_url:
        raise HTTPException(status_code=502, detail="视频生成失败: 未返回可保存的视频地址")

    try:
        thumbnail_url = await persist_if_external(
            video_result.get("thumbnail_url") or sb.image_url,
            f"video-clips/{project_id}/thumbnails",
            fallback_extension=get_media_fallback_extension("image"),
            url_label="视频片段缩略图地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频缩略图落盘失败: {str(exc)}") from exc

    try:
        reference_image_urls = await persist_many_if_external(
            [url for url in [effective_first_frame, effective_last_frame] if url],
            f"video-clips/{project_id}/reference-images",
            fallback_extension=get_media_fallback_extension("image"),
            url_label="视频片段参考图地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频参考图落盘失败: {str(exc)}") from exc

    sb.video_url = video_url
    sb.reference_image_urls = reference_image_urls or None
    sb.gen_params = {
        **stored_gen_params,
        "reference_video_url": reference_video_url,
        "reference_audio_url": reference_audio_url,
        "ratio": ratio,
        "generate_audio": generate_audio,
        "watermark": watermark,
        "video_model": model,
        "video_duration": video_result["duration"],
        "video_thumbnail_url": thumbnail_url,
    }

    clip = VideoClip(
        user_id=user.id,
        project_id=UUID(project_id),
        storyboard_id=sb.id,
        video_url=video_url,
        duration=video_result["duration"],
        model=model,
        prompt=prompt,
    )
    db.add(clip)
    await db.flush()

    asset = Asset(
        user_id=user.id,
        project_id=UUID(project_id),
        name=f"视频 - 分镜#{sb.shot_number}",
        asset_type="video",
        category="storyboard",
        file_url=video_url,
        thumbnail_url=thumbnail_url,
        prompt=prompt,
        model=model,
        metadata_json={
            "source": "video_clip",
            "clip_id": str(clip.id),
            "storyboard_id": str(sb.id),
            "shot_number": sb.shot_number,
            "duration": video_result["duration"],
            "ratio": ratio,
            "watermark": watermark,
            "thumbnail_url": thumbnail_url,
        },
    )
    db.add(asset)

    await db.commit()
    await db.refresh(clip)

    return VideoClipResponse(
        id=str(clip.id), project_id=str(clip.project_id) if clip.project_id else None,
        storyboard_id=str(clip.storyboard_id) if clip.storyboard_id else None,
        video_url=clip.video_url, duration=clip.duration,
        model=clip.model, prompt=clip.prompt, created_at=clip.created_at.isoformat(),
    )


@router.delete(
    "/{clip_id}",
    summary="删除项目视频片段",
    description="删除指定项目视频片段记录。当前仅删除视频片段实体，不额外承诺清理关联资产文件。",
    response_description="删除结果。",
)
async def delete_video_clip(
    project_id: str,
    clip_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VideoClip).where(VideoClip.id == UUID(clip_id), VideoClip.user_id == user.id)
    )
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="视频不存在")
    await db.delete(clip)
    await db.commit()
    return {"message": "已删除"}
