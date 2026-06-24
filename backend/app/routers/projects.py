import io
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote, unquote, urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.subject import Subject
from app.models.storyboard import Storyboard
from app.models.asset import Asset
from app.models.episode import Episode
from app.models.composition import Composition
from app.schemas.project import CreateProjectRequest, UpdateProjectRequest, ProjectResponse
from app.schemas.project_overview import (
    ProjectOverviewResponse,
    AssetCounts,
    StoryboardThumbnail,
    EpisodeProgress,
    StoryboardOperationRecord,
)
from app.services.asset_recycle import apply_asset_visibility
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.media_fetch import read_media_bytes
from app.services.media_storage import (
    get_media_fallback_extension,
    persist_if_external,
    resolve_upload_path,
)
from app.services.image_derivatives import generate_project_cover_thumbnail
from app.services.media_view_models import (
    build_audio_media_fields,
    build_image_media_fields,
    build_video_media_fields,
)
from app.services.visual_styles import resolve_visual_style_label
from app.utils.url_security import validate_outbound_url

router = APIRouter()


def _sanitize_zip_segment(value: str | None) -> str:
    raw = (value or "").strip()
    cleaned = "".join(ch if ch not in '<>:"/\\|?*' else "_" for ch in raw)
    collapsed = " ".join(cleaned.split())
    return collapsed[:80] or "untitled"


async def _persist_project_cover_url(cover_url: str | None, *, user_id: UUID) -> str | None:
    return await persist_if_external(
        cover_url,
        f"projects/{user_id}/covers",
        fallback_extension=get_media_fallback_extension("image"),
        url_label="项目封面地址",
    )


def _generate_project_cover_thumbnail_url(cover_url: str | None, *, user_id: UUID) -> str | None:
    if not cover_url:
        return None
    try:
        derived = generate_project_cover_thumbnail(cover_url, user_id=str(user_id))
        return derived.url
    except (FileNotFoundError, ValueError, RuntimeError):
        return None


async def _read_media_bytes(url: str, timeout: float = 60.0) -> bytes:
    return await read_media_bytes(
        url,
        label="项目资产地址",
        timeout=timeout,
        follow_redirects=True,
    )


def _guess_asset_extension(asset: Asset) -> str:
    parsed = urlparse(asset.file_url)
    suffix = Path(unquote(parsed.path or asset.file_url)).suffix.lower()
    if suffix:
        return suffix
    if asset.asset_type == "image":
        return ".png"
    if asset.asset_type == "audio":
        return ".mp3"
    if asset.asset_type == "video":
        return ".mp4"
    return ".bin"


def _build_project_asset_download_filename(asset: Asset, fallback_index: int) -> str:
    safe_name = _sanitize_zip_segment(asset.name or f"asset_{fallback_index}")
    return f"{safe_name}_{fallback_index}{_guess_asset_extension(asset)}"


def _resolve_project_asset_media_fields(asset: Asset) -> dict[str, str | bool | None]:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    common_kwargs = {
        "user_id": str(asset.user_id),
        "project_id": str(asset.project_id) if asset.project_id else None,
        "resource_id": str(asset.id),
    }
    if asset.asset_type == "video":
        return build_video_media_fields(
            file_url=asset.file_url,
            thumbnail_url=asset.thumbnail_url,
            metadata=metadata,
            **common_kwargs,
        )
    if asset.asset_type == "audio":
        return build_audio_media_fields(
            file_url=asset.file_url,
            metadata=metadata,
            **common_kwargs,
        )
    return build_image_media_fields(
        file_url=asset.file_url,
        thumbnail_url=asset.thumbnail_url,
        metadata=metadata,
        **common_kwargs,
    )


async def _to_response(p: Project, user_id: UUID | None, db: AsyncSession) -> ProjectResponse:
    return ProjectResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        cover_url=p.cover_url,
        cover_thumbnail_url=p.cover_thumbnail_url,
        aspect_ratio=p.aspect_ratio,
        visual_style=p.visual_style,
        visual_style_label=await resolve_visual_style_label(p.visual_style, user_id, db),
        project_type=p.project_type,
        language=p.language,
        notes=p.notes,
        status=p.status,
        created_at=p.created_at.isoformat(),
        updated_at=p.updated_at.isoformat(),
    )


@router.get(
    "",
    response_model=list[ProjectResponse],
    summary="获取项目列表",
    description="返回当前登录用户的项目列表，支持按项目名称和描述模糊搜索。",
    response_description="项目列表。",
)
async def list_projects(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Project)
        .where(Project.user_id == user.id)
        .order_by(Project.updated_at.desc(), Project.id.desc())
    )
    if search:
        query = query.where(
            or_(Project.name.ilike(f"%{search}%"), Project.description.ilike(f"%{search}%"))
        )
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return [await _to_response(p, user.id, db) for p in result.scalars().all()]


@router.post(
    "",
    response_model=ProjectResponse,
    summary="创建项目",
    description="创建新项目。若传入外部封面地址，后端会尝试落盘并生成缩略图。",
    response_description="创建成功后的项目。",
    responses={
        200: {
            "description": "创建成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "0df3240d-14a3-4a74-8a10-a8b70d1d20d4",
                        "name": "古风短剧项目",
                        "description": "用于生成三集古风情感短剧",
                        "cover_url": "/uploads/project_covers/demo-cover.png",
                        "cover_thumbnail_url": "/uploads/project_covers/thumbnails/demo-cover-thumb.png",
                        "aspect_ratio": "16:9",
                        "visual_style": "guofeng",
                        "visual_style_label": "国风写意",
                        "project_type": "video",
                        "language": "zh-CN",
                        "notes": None,
                        "status": "draft",
                        "created_at": "2026-06-04T12:10:00",
                        "updated_at": "2026-06-04T12:10:00",
                    }
                }
            },
        }
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "name": "古风短剧项目",
                        "description": "用于生成三集古风情感短剧",
                        "aspect_ratio": "16:9",
                        "visual_style": "guofeng",
                        "project_type": "video",
                        "cover_url": "https://example.com/demo-cover.png",
                    }
                }
            }
        }
    },
)
async def create_project(req: CreateProjectRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cover_url = await _persist_project_cover_url(req.cover_url, user_id=user.id)
    cover_thumbnail_url = _generate_project_cover_thumbnail_url(cover_url, user_id=user.id)
    project = Project(
        user_id=user.id,
        name=req.name,
        description=req.description,
        aspect_ratio=req.aspect_ratio,
        visual_style=req.visual_style,
        project_type=req.project_type,
        cover_url=cover_url,
        cover_thumbnail_url=cover_thumbnail_url,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return await _to_response(project, user.id, db)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="获取项目详情",
    description="读取单个项目的基础信息。",
    response_description="项目详情。",
)
async def get_project(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return await _to_response(project, user.id, db)


@router.post(
    "/{project_id}/assets/download",
    summary="打包下载项目资产",
    description="将项目下当前可见的资产按分类打包为 zip 下载。适合项目页统一导出资产。",
    response_description="项目资产压缩包流。",
)
async def download_project_assets(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_result = await db.execute(
        select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    assets_result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.project_id == project.id, Asset.user_id == user.id)
        )
        .order_by(Asset.created_at.desc(), Asset.id.desc())
    )
    assets = assets_result.scalars().all()
    if not assets:
        raise HTTPException(status_code=404, detail="该项目暂无可下载的项目资产")

    zip_buffer = io.BytesIO()
    added_count = 0
    project_segment = _sanitize_zip_segment(project.name)

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, asset in enumerate(assets, start=1):
            try:
                media = _resolve_project_asset_media_fields(asset)
                download_target = resolve_verified_download_target_from_url(
                    str(media["download_url"] or asset.file_url),
                    expected_user_id=str(user.id),
                )
                content = await _read_media_bytes(download_target)
            except MediaDownloadAccessError as exc:
                raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
            except Exception:
                continue

            category_segment = _sanitize_zip_segment(asset.category or asset.asset_type or "assets")
            filename = _build_project_asset_download_filename(asset, index)
            zip_file.writestr(f"{project_segment}/{category_segment}/{filename}", content)
            added_count += 1

    if added_count == 0:
        raise HTTPException(status_code=502, detail="该项目资产暂时无法打包下载")

    zip_buffer.seek(0)
    download_name = f"{project_segment}_项目资产.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="更新项目",
    description="更新项目基础信息，包括名称、描述、封面、风格、画幅、语言、备注和状态。",
    response_description="更新后的项目。",
)
async def update_project(project_id: str, req: UpdateProjectRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(status_code=400, detail="项目名称不能为空")
        project.name = req.name.strip()
    if req.description is not None:
        project.description = req.description
    if req.cover_url is not None:
        project.cover_url = await _persist_project_cover_url(req.cover_url, user_id=user.id)
        project.cover_thumbnail_url = _generate_project_cover_thumbnail_url(project.cover_url, user_id=user.id)
    if req.aspect_ratio is not None:
        project.aspect_ratio = req.aspect_ratio
    if req.visual_style is not None:
        project.visual_style = req.visual_style
    if req.project_type is not None:
        project.project_type = req.project_type
    if req.language is not None:
        project.language = req.language
    if req.notes is not None:
        project.notes = req.notes
    if req.status is not None:
        project.status = req.status

    await db.commit()
    await db.refresh(project)
    return await _to_response(project, user.id, db)


@router.delete(
    "/{project_id}",
    summary="删除项目",
    description="删除当前用户拥有的项目。",
    response_description="删除结果。",
)
async def delete_project(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    await db.delete(project)
    await db.commit()
    return {"message": "已删除"}


@router.get(
    "/{project_id}/overview",
    response_model=ProjectOverviewResponse,
    summary="获取项目概览",
    description="返回项目首页/全局设定页需要的聚合概览，包括主体数量、分镜缩略图、分集进度和最近操作记录。",
    response_description="项目聚合概览。",
)
async def get_project_overview(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pid = UUID(project_id)

    # Verify project ownership
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # --- Asset counts ---
    # Subject counts by type
    subject_counts_result = await db.execute(
        select(Subject.type, func.count(Subject.id))
        .where(Subject.project_id == pid)
        .group_by(Subject.type)
    )
    subject_counts = {row[0]: row[1] for row in subject_counts_result.all()}

    # Storyboard count
    storyboard_count_result = await db.execute(
        select(func.count(Storyboard.id)).where(Storyboard.project_id == pid)
    )
    storyboard_count = storyboard_count_result.scalar() or 0

    # Asset counts by type (image, video)
    asset_counts_result = await db.execute(
        apply_asset_visibility(
            select(Asset.asset_type, func.count(Asset.id))
            .where(Asset.project_id == pid)
            .where(Asset.asset_type.in_(["image", "video"]))
        )
        .group_by(Asset.asset_type)
    )
    asset_type_counts = {row[0]: row[1] for row in asset_counts_result.all()}

    asset_counts = AssetCounts(
        character=subject_counts.get("character", 0),
        prop=subject_counts.get("prop", 0),
        scene=subject_counts.get("scene", 0),
        storyboard=storyboard_count,
        image=asset_type_counts.get("image", 0),
        video=asset_type_counts.get("video", 0),
    )

    # --- Storyboard thumbnails (up to 8 with image_url) ---
    thumbnails_result = await db.execute(
        select(Storyboard.id, Storyboard.image_url, Storyboard.shot_number)
        .where(Storyboard.project_id == pid, Storyboard.image_url.isnot(None))
        .order_by(Storyboard.shot_number, Storyboard.id)
        .limit(8)
    )
    storyboard_thumbnails = [
        StoryboardThumbnail(
            id=str(row.id),
            image_url=row.image_url,
            shot_number=row.shot_number,
        )
        for row in thumbnails_result.all()
    ]

    # --- Episode progress ---
    episodes_result = await db.execute(
        select(Episode)
        .where(Episode.project_id == pid)
        .order_by(Episode.episode_number, Episode.id)
    )
    episodes = episodes_result.scalars().all()

    project_storyboards_result = await db.execute(
        select(Storyboard)
        .where(Storyboard.project_id == pid)
        .order_by(
            Storyboard.episode_id,
            Storyboard.sort_order,
            Storyboard.shot_number,
            Storyboard.created_at,
            Storyboard.id,
        )
    )
    project_storyboards = project_storyboards_result.scalars().all()
    completed_compositions_result = await db.execute(
        select(Composition).where(
            Composition.project_id == pid,
            Composition.user_id == user.id,
            Composition.status == "completed",
        )
    )
    completed_compositions = completed_compositions_result.scalars().all()

    storyboards_by_episode: dict[UUID, list[Storyboard]] = defaultdict(list)
    storyboard_lookup: dict[str, Storyboard] = {}
    for storyboard in project_storyboards:
        storyboard_lookup[str(storyboard.id)] = storyboard
        if storyboard.episode_id is not None:
            storyboards_by_episode[storyboard.episode_id].append(storyboard)

    completed_storyboard_ids: set[str] = set()
    for composition in completed_compositions:
        timeline_items = composition.timeline if isinstance(composition.timeline, list) else []
        for item in timeline_items:
            if not isinstance(item, dict):
                continue
            if item.get("track") != "visual" and item.get("type") not in {"image", "video"}:
                continue
            source_id = item.get("source_id")
            clip_id = item.get("clip_id")
            storyboard = None
            if source_id:
                storyboard = storyboard_lookup.get(str(source_id))
            if storyboard is None and clip_id:
                storyboard = storyboard_lookup.get(str(clip_id))
            if storyboard is None:
                continue
            completed_storyboard_ids.add(str(storyboard.id))

    storyboard_assets_result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.project_id == pid,
                Asset.category == "storyboard",
                Asset.asset_type.in_(["image", "video"]),
            )
        )
        .order_by(Asset.created_at.desc(), Asset.id.desc())
    )
    storyboard_assets = storyboard_assets_result.scalars().all()

    asset_times_by_storyboard: dict[str, list] = defaultdict(list)
    episode_history_events: dict[UUID, list[tuple[object, StoryboardOperationRecord]]] = defaultdict(list)

    def append_history_event(
        storyboard: Storyboard,
        action: str,
        action_label: str,
        occurred_at,
        description: str,
    ) -> None:
        if storyboard.episode_id is None or occurred_at is None:
            return
        episode_history_events[storyboard.episode_id].append(
            (
                occurred_at,
                StoryboardOperationRecord(
                    storyboard_id=str(storyboard.id),
                    shot_number=storyboard.shot_number,
                    action=action,
                    action_label=action_label,
                    occurred_at=occurred_at.isoformat(),
                    description=description,
                ),
            )
        )

    for asset in storyboard_assets:
        metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
        storyboard_id = metadata.get("storyboard_id")
        if not storyboard_id:
            continue
        storyboard = storyboard_lookup.get(str(storyboard_id))
        if storyboard is None or storyboard.episode_id is None:
            continue

        asset_times_by_storyboard[str(storyboard.id)].append(asset.created_at)
        if asset.asset_type == "image":
            append_history_event(
                storyboard,
                "generate_image",
                "生成图片",
                asset.created_at,
                f"分镜 {storyboard.shot_number} 已生成图片",
            )
        elif asset.asset_type == "video":
            append_history_event(
                storyboard,
                "generate_video",
                "生成视频",
                asset.created_at,
                f"分镜 {storyboard.shot_number} 已生成视频",
            )

    for storyboard in project_storyboards:
        append_history_event(
            storyboard,
            "create",
            "新建分镜",
            storyboard.created_at,
            f"新增了分镜 {storyboard.shot_number}",
        )

        updated_at = storyboard.updated_at
        created_at = storyboard.created_at
        if updated_at is None or created_at is None or updated_at <= created_at:
            continue

        nearby_asset_update = any(
            abs((asset_time - updated_at).total_seconds()) <= 5
            for asset_time in asset_times_by_storyboard.get(str(storyboard.id), [])
        )
        if nearby_asset_update:
            continue

        append_history_event(
            storyboard,
            "edit",
            "编辑分镜",
            updated_at,
            f"更新了分镜 {storyboard.shot_number}",
        )

    episode_progress: list[EpisodeProgress] = []
    for ep in episodes:
        episode_storyboards = storyboards_by_episode.get(ep.id, [])
        sb_count = len(episode_storyboards)
        img_count = sum(1 for storyboard in episode_storyboards if storyboard.image_url)
        vid_count = sum(1 for storyboard in episode_storyboards if storyboard.video_url)

        # Determine status
        if sb_count == 0:
            status = "no_storyboard"
        elif img_count == 0:
            status = "no_image"
        elif vid_count == sb_count and all(
            str(storyboard.id) in completed_storyboard_ids
            for storyboard in episode_storyboards
        ):
            status = "edited"
        elif vid_count == sb_count:
            status = "videos_ready"
        elif img_count == sb_count:
            status = "images_ready"
        else:
            status = "in_progress"

        thumbnail_storyboard = next(
            (storyboard for storyboard in episode_storyboards if storyboard.image_url),
            None,
        )
        thumbnail_url = thumbnail_storyboard.image_url if thumbnail_storyboard else None

        operation_history = [
            record
            for _, record in sorted(
                episode_history_events.get(ep.id, []),
                key=lambda item: item[0],
                reverse=True,
            )[:4]
        ]

        episode_progress.append(
            EpisodeProgress(
                episode_id=str(ep.id),
                title=ep.title,
                episode_number=ep.episode_number,
                storyboard_count=sb_count,
                image_generated_count=img_count,
                video_generated_count=vid_count,
                thumbnail_url=thumbnail_url,
                status=status,
                operation_history=operation_history,
            )
        )

    return ProjectOverviewResponse(
        asset_counts=asset_counts,
        storyboard_thumbnails=storyboard_thumbnails,
        episode_progress=episode_progress,
    )
