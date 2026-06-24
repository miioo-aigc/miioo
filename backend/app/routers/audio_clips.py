from uuid import UUID
import json
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audio_clip import AudioClip
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.models.user import User
from app.schemas.tts import TTSAdvancedOptionsMixin
from app.services.project_audio import (
    build_storyboard_narration_jobs,
    generate_project_audio_clip,
    generate_storyboard_narration_audio,
    serialize_project_audio_clip,
)

router = APIRouter()


class AudioClipResponse(BaseModel):
    id: str
    project_id: str | None
    storyboard_id: str | None
    text: str
    voice_id: str
    audio_url: str
    duration: float
    speed: float
    emotion: str | None
    source: str | None = None
    created_at: str


class GenerateAudioRequest(TTSAdvancedOptionsMixin):
    text: str
    voice_id: str = "zh-CN-XiaoxiaoNeural"
    storyboard_id: str | None = None
    speed: float = 1.0
    emotion: str | None = None
    model: str | None = None


class GenerateStoryboardNarrationRequest(TTSAdvancedOptionsMixin):
    storyboard_id: str
    model: str | None = None


@router.get(
    "",
    response_model=list[AudioClipResponse],
    summary="获取项目配音片段列表",
    description="读取当前项目下的配音片段列表，可按分镜过滤，供项目内配音管理与回显使用。",
    response_description="配音片段列表。",
)
async def list_audio_clips(
    project_id: str,
    storyboard_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(AudioClip).where(AudioClip.project_id == UUID(project_id), AudioClip.user_id == user.id)
    if storyboard_id:
        query = query.where(AudioClip.storyboard_id == UUID(storyboard_id))
    query = query.order_by(AudioClip.created_at.desc(), AudioClip.id.desc())
    result = await db.execute(query)
    return [serialize_project_audio_clip(item) for item in result.scalars().all()]


@router.post(
    "",
    response_model=AudioClipResponse,
    status_code=201,
    summary="生成项目配音片段",
    description="基于文本、音色、模型和可选高级参数生成项目内配音片段，并自动写入资产库。",
    response_description="新生成的配音片段。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "text": "这是旁白内容",
                        "voice_id": "zh-CN-XiaoxiaoNeural",
                        "storyboard_id": "3f9fd8c2-aef6-4f11-a91e-b7fc5f9c4a63",
                        "speed": 1.0,
                        "emotion": "calm",
                        "model": "MiniMax-Speech-2.8-hd",
                    }
                }
            }
        }
    },
)
async def generate_audio(
    project_id: str,
    req: GenerateAudioRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    return await generate_project_audio_clip(
        db=db,
        user=user,
        project_id=UUID(project_id),
        storyboard_id=UUID(req.storyboard_id) if req.storyboard_id else None,
        text=req.text,
        requested_voice_id=req.voice_id,
        speed=req.speed,
        emotion=req.emotion,
        model=req.model,
        request_options=req,
        source="audio_clip",
    )


@router.post(
    "/generate-storyboard-narration",
    response_model=list[AudioClipResponse],
    status_code=201,
    summary="按分镜生成旁白配音",
    description="复用创作模块的音色解析与配音能力，按分镜中的结构化旁白文本批量生成项目内音频片段。",
    response_description="本次生成的旁白配音片段列表。",
)
async def generate_storyboard_narration(
    project_id: str,
    req: GenerateStoryboardNarrationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # #region debug-point E:route-enter
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "audio_clips.py:generate_storyboard_narration:enter",
                        "msg": "[DEBUG] backend generate_storyboard_narration entered",
                        "data": {
                            "project_id": project_id,
                            "storyboard_id": req.storyboard_id,
                            "user_id": str(user.id),
                            "model": req.model,
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    storyboard_result = await db.execute(
        select(Storyboard).where(
            Storyboard.id == UUID(req.storyboard_id),
            Storyboard.project_id == UUID(project_id),
        )
    )
    storyboard = storyboard_result.scalar_one_or_none()
    if not storyboard:
        raise HTTPException(status_code=404, detail="分镜不存在")

    related_subject_ids = {
        str(subject_id)
        for subject_id in (storyboard.character_ids or [])
        if subject_id
    }
    subjects: list[Subject] = []
    if related_subject_ids:
        subjects_result = await db.execute(
            select(Subject).where(
                Subject.project_id == UUID(project_id),
                Subject.id.in_([UUID(subject_id) for subject_id in related_subject_ids]),
            )
        )
        subjects = subjects_result.scalars().all()

    subject_map = {str(subject.id): subject for subject in subjects}
    preview_jobs = build_storyboard_narration_jobs(
        storyboard,
        subject_map=subject_map,
    )
    # #region debug-point E:route-job-preview
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "audio_clips.py:generate_storyboard_narration:job_preview",
                        "msg": "[DEBUG] backend generate_storyboard_narration job preview",
                        "data": {
                            "project_id": project_id,
                            "storyboard_id": req.storyboard_id,
                            "segments": (
                                storyboard.gen_params.get("narration_segments", [])
                                if isinstance(storyboard.gen_params, dict)
                                else []
                            ),
                            "character_ids": [str(item) for item in (storyboard.character_ids or []) if item],
                            "subjects": [
                                {
                                    "id": subject_id,
                                    "name": subject.name,
                                    "role": subject.role,
                                    "voice_id": subject.voice_id,
                                }
                                for subject_id, subject in subject_map.items()
                            ],
                            "preview_jobs": preview_jobs,
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion
    try:
        created = await generate_storyboard_narration_audio(
            db=db,
            user=user,
            project_id=UUID(project_id),
            storyboard=storyboard,
            subject_map=subject_map,
            model=req.model,
            request_options=req,
            source="storyboard_narration",
        )
    except HTTPException as exc:
        # #region debug-point E:route-http-error
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    "http://127.0.0.1:7777/event",
                    data=json.dumps(
                        {
                            "sessionId": "narration-audio-button",
                            "runId": "pre-fix",
                            "hypothesisId": "E",
                            "location": "audio_clips.py:generate_storyboard_narration:http_error",
                            "msg": "[DEBUG] backend generate_storyboard_narration http error",
                            "data": {
                                "project_id": project_id,
                                "storyboard_id": req.storyboard_id,
                                "status_code": exc.status_code,
                                "detail": exc.detail,
                                "subject_count": len(subject_map),
                            },
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                )
            ).read()
        except Exception:
            pass
        # #endregion
        raise

    # #region debug-point E:route-success
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "audio_clips.py:generate_storyboard_narration:success",
                        "msg": "[DEBUG] backend generate_storyboard_narration success",
                        "data": {
                            "project_id": project_id,
                            "storyboard_id": req.storyboard_id,
                            "created_count": len(created),
                            "created_ids": [item.get("id") for item in created if isinstance(item, dict)],
                            "subject_count": len(subject_map),
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion
    return created


@router.delete(
    "/{clip_id}",
    summary="删除项目配音片段",
    description="删除指定项目配音片段记录。当前仅删除配音片段实体，不额外承诺清理关联资产文件。",
    response_description="删除结果。",
)
async def delete_audio_clip(
    project_id: str,
    clip_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AudioClip).where(AudioClip.id == UUID(clip_id), AudioClip.user_id == user.id)
    )
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="配音不存在")
    await db.delete(clip)
    await db.commit()
    return {"message": "已删除"}
