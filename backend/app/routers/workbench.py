import io
import re
import zipfile
from math import gcd
from pathlib import Path
from typing import List
from urllib.parse import quote, unquote, urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func as sa_func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.database import async_session, get_db
from app.dependencies import get_current_user
from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.gen_task import GenTask
from app.models.model_config import ModelConfig
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import User
from app.models.video_clip import VideoClip
from app.services.asset_recycle import apply_asset_visibility, mark_asset_deleted
from app.services.image_derivatives import (
    build_derivative_metadata,
    generate_asset_card_thumbnail,
)
from app.services.background_runtime import build_gen_task_job_key, dispatch_background_job
from app.services.image_gen import image_gen_service
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.media_fetch import read_media_bytes
from app.services.media_view_models import build_image_media_fields
from app.services.model_selection import get_default_available_model_id
from app.services.model_capabilities import resolve_user_model, validate_image_request
from app.services.media_storage import (
    delete_managed_upload,
    is_managed_upload_url,
    persist_remote_file,
    persist_uploaded_file,
    resolve_upload_path,
)
from app.services.user_api_key import get_user_model_provider_runtime
from app.services.visual_styles import append_visual_styles
from app.utils.url_security import validate_outbound_url

router = APIRouter()

ALLOWED_MEDIA_TYPES = {"image", "audio", "video"}
ALLOWED_IMAGE_CATEGORIES = {"character", "scene", "prop", "storyboard", "reference"}
WORKBENCH_IMAGE_SOURCES = {"workbench_image", "workbench_upload"}
IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_WORKBENCH_IMAGE_SIZE = 20 * 1024 * 1024
TASK_TERMINAL_STATUSES = {"completed", "partial", "failed", "cancelled"}
WORKBENCH_LIST_DEFAULT_PAGE_SIZE = 9


def _derive_asset_thumbnail(source_url: str | None, *, asset_type: str) -> tuple[str | None, dict]:
    if not source_url or asset_type not in {"image", "video"}:
        return source_url, {}
    try:
        derived = generate_asset_card_thumbnail(source_url, asset_type=asset_type)
    except (FileNotFoundError, ValueError, RuntimeError):
        return source_url, {}
    return derived.url, build_derivative_metadata(derived)
async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


async def _get_default_image_model(user_id: UUID, db: AsyncSession) -> str:
    return await get_default_available_model_id(
        user_id,
        db,
        category="image",
        fallback_model_id="dall-e-3",
    )


async def _create_notification(
    db: AsyncSession,
    user_id: UUID,
    notif_type: str,
    title: str,
    content: str | None = None,
    link: str | None = None,
):
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        content=content,
        link=link,
    )
    db.add(notif)
    await db.commit()


class WorkbenchTaskResponse(BaseModel):
    id: str
    user_id: str
    project_id: str
    task_type: str
    status: str
    total_count: int
    success_count: int
    fail_count: int
    model: str | None
    size: str | None
    params: dict | None
    results: list | None
    created_at: str
    updated_at: str


def _task_to_response(task: GenTask) -> WorkbenchTaskResponse:
    return WorkbenchTaskResponse(
        id=str(task.id),
        user_id=str(task.user_id),
        project_id=str(task.project_id),
        task_type=task.task_type,
        status=task.status,
        total_count=task.total_count,
        success_count=task.success_count,
        fail_count=task.fail_count,
        model=task.model,
        size=task.size,
        params=task.params,
        results=task.results,
        created_at=task.created_at.isoformat(),
        updated_at=task.updated_at.isoformat(),
    )


def _sanitize_zip_segment(value: str | None) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", (value or "").strip())
    return cleaned or "project"


def _extract_ratio_from_size(size: str | None) -> str | None:
    if not size or "x" not in size.lower():
        return None

    left, right = size.lower().split("x", 1)
    if not left.isdigit() or not right.isdigit():
        return None

    width = int(left)
    height = int(right)
    if width <= 0 or height <= 0:
        return None

    divisor = gcd(width, height)
    return f"{width // divisor}:{height // divisor}"


def _normalize_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        cleaned = value.strip()
        return [cleaned] if cleaned else []
    if not isinstance(value, list):
        return []

    normalized: list[str] = []
    for item in value:
        if item is None:
            continue
        cleaned = str(item).strip()
        if cleaned:
            normalized.append(cleaned)
    return normalized


def _resolve_workbench_reference_images(payload: dict | None) -> list[str]:
    data = payload or {}
    return _normalize_string_list(
        data.get("reference_images") or data.get("referenceImages")
    )


def _resolve_workbench_aspect_ratio(payload: dict | None, size: str | None) -> str | None:
    data = payload or {}
    return (
        _normalize_workbench_aspect_ratio(data.get("aspect_ratio"))
        or _normalize_workbench_aspect_ratio(data.get("aspectRatio"))
        or _normalize_workbench_aspect_ratio(data.get("ratio"))
        or _extract_ratio_from_size(size)
    )


def _resolve_workbench_resolution(payload: dict | None, size: str | None) -> str | None:
    data = payload or {}
    return (
        _normalize_workbench_resolution(data.get("resolution"))
        or _infer_workbench_resolution_from_size(size)
        or size
    )


def _normalize_workbench_aspect_ratio(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().replace(" ", "")
    return normalized or None


def _normalize_workbench_resolution(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    return normalized or None


def _infer_workbench_resolution_from_size(size: str | None) -> str | None:
    normalized = (size or "").strip().lower()
    size_map = {
        "1024x1024": "1K",
        "1536x1024": "2K",
        "1024x1536": "2K",
        "1792x1024": "2K",
        "1024x1792": "2K",
        "1k": "1K",
        "2k": "2K",
        "4k": "4K",
    }
    return size_map.get(normalized)


def _is_workbench_managed_image(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    source = metadata.get("source")
    if source in WORKBENCH_IMAGE_SOURCES:
        return True
    return source == "upload" and metadata.get("uploaded_via") == "workbench"


def _is_workbench_managed_image_clause() -> object:
    return or_(
        Asset.metadata_json["source"].as_string().in_(tuple(WORKBENCH_IMAGE_SOURCES)),
        and_(
            Asset.metadata_json["source"].as_string() == "upload",
            Asset.metadata_json["uploaded_via"].as_string() == "workbench",
        ),
    )


def _normalize_requested_image_sources(sources: str | None) -> set[str] | None:
    if not sources:
        return None

    raw_sources = {item.strip().lower() for item in sources.split(",") if item.strip()}
    normalized: set[str] = set()
    for item in raw_sources:
        if item in {"generated", "workbench_image"}:
            normalized.add("workbench_image")
        elif item in {"uploaded", "workbench_upload", "upload"}:
            normalized.add("workbench_upload")
        else:
            raise HTTPException(status_code=422, detail=f"不支持的图片来源: {item}")
    return normalized


async def _read_media_bytes(url: str, timeout: float) -> bytes:
    return await read_media_bytes(
        url,
        label="工作台资源地址",
        timeout=timeout,
        follow_redirects=True,
    )


def _build_download_filename(asset: Asset, fallback_index: int) -> str:
    parsed = urlparse(asset.file_url)
    suffix = Path(unquote(parsed.path or asset.file_url)).suffix.lower() or ".png"
    safe_name = _sanitize_zip_segment(asset.name or f"image_{fallback_index}")
    return f"{safe_name}_{fallback_index}{suffix}"


class WorkbenchImageCard(BaseModel):
    id: str
    asset_id: str | None = None
    name: str
    category: str
    thumbnail_url: str
    thumbnailUrl: str
    original_url: str
    originalUrl: str
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    model: str | None = None
    prompt: str | None = None
    reference_images: list[str] = []
    referenceImages: list[str] = []
    created_at: str
    createdAt: str
    is_liked: bool
    isLiked: bool
    is_owner: bool = True
    isOwner: bool = True
    source: str | None = None
    metadata_json: dict | None = None


def _build_workbench_card_metadata(
    metadata: dict | None,
    *,
    compact: bool = False,
) -> dict | None:
    payload = dict(metadata or {})
    if not payload:
        return None
    if not compact:
        return payload

    compact_keys = (
        "source",
        "uploaded_via",
        "aspect_ratio",
        "aspectRatio",
        "ratio",
        "resolution",
        "reference_images",
        "referenceImages",
    )
    compact_payload = {
        key: payload.get(key)
        for key in compact_keys
        if payload.get(key) is not None
    }
    return compact_payload or None


def _asset_to_image_card(
    asset: Asset,
    *,
    compact_metadata: bool = False,
) -> WorkbenchImageCard:
    metadata = asset.metadata_json or {}
    reference_images = _resolve_workbench_reference_images(metadata)
    ratio = _resolve_workbench_aspect_ratio(metadata, asset.size)
    resolution = _resolve_workbench_resolution(metadata, asset.size)
    created_at = asset.created_at.isoformat()
    thumbnail_url = asset.thumbnail_url or asset.file_url

    return WorkbenchImageCard(
        id=str(asset.id),
        asset_id=str(asset.id),
        name=asset.name,
        category=asset.category,
        thumbnail_url=thumbnail_url,
        thumbnailUrl=thumbnail_url,
        original_url=asset.file_url,
        originalUrl=asset.file_url,
        aspect_ratio=ratio,
        aspectRatio=ratio,
        resolution=resolution,
        model=asset.model,
        prompt=asset.prompt,
        reference_images=reference_images,
        referenceImages=reference_images,
        created_at=created_at,
        createdAt=created_at,
        is_liked=asset.is_starred,
        isLiked=asset.is_starred,
        is_owner=True,
        isOwner=True,
        source=metadata.get("source"),
        metadata_json=_build_workbench_card_metadata(metadata, compact=compact_metadata),
    )


def _task_result_to_image_card(task: GenTask, result: dict) -> WorkbenchImageCard:
    params = task.params or {}
    fallback_url = str(result.get("url") or "")
    reference_images = _resolve_workbench_reference_images(params)
    ratio = _resolve_workbench_aspect_ratio(params, task.size)
    resolution = _resolve_workbench_resolution(params, task.size)
    created_at = task.updated_at.isoformat()
    fallback_id = str(result.get("asset_id") or f"{task.id}:{result.get('index', 0)}")
    name = params.get("asset_name") or "工作台图片"

    return WorkbenchImageCard(
        id=fallback_id,
        asset_id=str(result.get("asset_id")) if result.get("asset_id") else None,
        name=name,
        category=str(params.get("category") or "reference"),
        thumbnail_url=fallback_url,
        thumbnailUrl=fallback_url,
        original_url=fallback_url,
        originalUrl=fallback_url,
        aspect_ratio=ratio,
        aspectRatio=ratio,
        resolution=resolution,
        model=task.model,
        prompt=str(params.get("prompt") or ""),
        reference_images=reference_images,
        referenceImages=reference_images,
        created_at=created_at,
        createdAt=created_at,
        is_liked=False,
        isLiked=False,
        is_owner=True,
        isOwner=True,
        source="workbench_image",
        metadata_json={
            "task_id": str(task.id),
            "source": "workbench_image",
            "aspect_ratio": ratio,
            "ratio": ratio,
            "resolution": resolution,
            "reference_images": reference_images,
            "referenceImages": reference_images,
        },
    )


async def _build_task_image_cards(task: GenTask, db: AsyncSession) -> list[WorkbenchImageCard]:
    result_items = task.results or []
    asset_ids = [
        UUID(item["asset_id"])
        for item in result_items
        if item.get("success") and item.get("asset_id")
    ]
    asset_map: dict[str, Asset] = {}
    if asset_ids:
        asset_result = await db.execute(select(Asset).where(Asset.id.in_(asset_ids)))
        asset_map = {str(asset.id): asset for asset in asset_result.scalars().all()}

    image_cards: list[WorkbenchImageCard] = []
    for item in result_items:
        if not item.get("success"):
            continue
        asset_id = str(item.get("asset_id")) if item.get("asset_id") else None
        if asset_id and asset_id in asset_map:
            image_cards.append(_asset_to_image_card(asset_map[asset_id]))
        elif item.get("url"):
            image_cards.append(_task_result_to_image_card(task, item))

    return image_cards


async def _get_workbench_image_asset(
    project_id: str,
    asset_id: str,
    user: User,
    db: AsyncSession,
) -> Asset:
    await _get_project(project_id, user, db)
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id == UUID(asset_id),
                Asset.user_id == user.id,
                Asset.project_id == UUID(project_id),
                Asset.asset_type == "image",
            )
        )
    )
    asset = result.scalar_one_or_none()
    if not asset or not _is_workbench_managed_image(asset):
        raise HTTPException(status_code=404, detail="图片不存在")
    return asset


async def _delete_asset_files_if_orphan(asset: Asset, db: AsyncSession) -> None:
    urls_to_check = {
        url
        for url in [asset.file_url, asset.thumbnail_url]
        if is_managed_upload_url(url)
    }
    if not urls_to_check:
        return

    for url in urls_to_check:
        result = await db.execute(
            select(sa_func.count(Asset.id)).where(
                Asset.id != asset.id,
                (Asset.file_url == url) | (Asset.thumbnail_url == url),
            )
        )
        reference_count = int(result.scalar_one() or 0)
        if reference_count == 0:
            delete_managed_upload(url)


class WorkbenchImageGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    model: str | None = None
    size: str | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str | None] | None = None
    referenceImages: list[str | None] | None = None
    count: int | None = Field(default=None, ge=1, le=4)
    image_count: int | None = Field(default=None, ge=1, le=4)
    imageCount: int | None = Field(default=None, ge=1, le=4)
    asset_name: str | None = Field(default=None, max_length=200)
    category: str = Field(default="reference")
    save_to_assets: bool = True
    inherit_project_style: bool = True

    def resolved_aspect_ratio(self) -> str:
        return (
            _normalize_workbench_aspect_ratio(self.aspect_ratio)
            or _normalize_workbench_aspect_ratio(self.aspectRatio)
            or _extract_ratio_from_size(self.size)
            or "1:1"
        )

    def resolved_resolution(self) -> str:
        return (
            _normalize_workbench_resolution(self.resolution)
            or _infer_workbench_resolution_from_size(self.size)
            or "1K"
        )

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1

    def resolved_size(self) -> str | None:
        normalized_size = (self.size or "").strip()
        return normalized_size or None


async def _run_workbench_image_task(
    *,
    task_id: UUID,
    user_id: UUID,
    project_id: UUID,
    prompt: str,
    model: str,
    size: str,
    aspect_ratio: str | None,
    resolution: str | None,
    reference_images: list[str],
    count: int,
    asset_name: str | None,
    category: str,
    save_to_assets: bool,
    inherit_project_style: bool,
):
    async with async_session() as db:
        result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return

        task.status = "running"
        await db.commit()

        provider_runtime = await get_user_model_provider_runtime(
            user_id,
            db,
            category="image",
            requested_model=model,
        )
        if not provider_runtime:
            task.status = "failed"
            task.fail_count = count
            task.results = [{"success": False, "error": "未配置图片模型对应服务商"}]
            await db.commit()
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "工作台图片生成失败",
                "未配置图片模型对应服务商，请先在设置中配置",
                "/config",
            )
            return

        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()

        api_key, base_url, _, model, _, _ = provider_runtime
        final_prompt = prompt
        if inherit_project_style and project and project.visual_style:
            final_prompt = await append_visual_styles(prompt, [project.visual_style], user_id, db)

        results: list[dict] = []
        try:
            urls = await image_gen_service.generate(
                prompt=final_prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                size=size,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                reference_images=reference_images,
                n=count,
            )

            for index, url in enumerate(urls, start=1):
                persisted_url = await persist_remote_file(
                    url,
                    f"workbench/{project_id}/images",
                    fallback_extension=".png",
                )
                derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
                    persisted_url,
                    asset_type="image",
                )

                asset_id = None
                if save_to_assets:
                    base_name = asset_name or "工作台图片"
                    if count > 1:
                        base_name = f"{base_name} {index}"
                    asset = Asset(
                        user_id=user_id,
                        project_id=project_id,
                        name=base_name,
                        asset_type="image",
                        category=category,
                        file_url=persisted_url,
                        thumbnail_url=derived_thumbnail_url,
                        prompt=final_prompt,
                        model=model,
                        size=size,
                        metadata_json={
                            "source": "workbench_image",
                            "task_id": str(task_id),
                            "sequence": index,
                            "original_prompt": prompt,
                            "inherit_project_style": inherit_project_style,
                            "aspect_ratio": aspect_ratio,
                            "ratio": aspect_ratio,
                            "resolution": resolution,
                            "reference_images": reference_images,
                            "referenceImages": reference_images,
                            **derivative_metadata,
                        },
                    )
                    db.add(asset)
                    await db.flush()
                    asset_id = str(asset.id)

                results.append(
                    {
                        "success": True,
                        "index": index,
                        "url": persisted_url,
                        "asset_id": asset_id,
                    }
                )
                task.success_count += 1
                task.results = results
                await db.commit()

            if len(urls) < count:
                for index in range(len(urls) + 1, count + 1):
                    results.append(
                        {
                            "success": False,
                            "index": index,
                            "error": "图片服务未返回足够结果",
                        }
                    )
                    task.fail_count += 1
                task.results = results
                await db.commit()

        except Exception as exc:
            results.append({"success": False, "error": str(exc)})
            task.fail_count = max(task.fail_count, count - task.success_count)
            task.results = results
            await db.commit()

        if task.fail_count == 0 and task.success_count > 0:
            task.status = "completed"
        elif task.success_count == 0:
            task.status = "failed"
        else:
            task.status = "partial"
        await db.commit()

        if task.status == "completed":
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "工作台图片生成完成",
                f"成功生成 {task.success_count} 张图片",
                "/tasks",
            )
        elif task.status == "partial":
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "工作台图片生成部分完成",
                f"成功 {task.success_count} 张，失败 {task.fail_count} 张",
                "/tasks",
            )
        else:
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "工作台图片生成失败",
                "任务执行失败，请检查模型配置、提示词和网络状态",
                "/tasks",
            )


@router.post(
    "/images/generate",
    response_model=WorkbenchTaskResponse,
    status_code=201,
    summary="创建工作台图片生成任务",
    description="在项目工作台中创建图片生成任务。任务提交后会后台执行，前端需继续轮询 `/tasks/{task_id}` 获取最终结果。",
    response_description="新建的工作台图片生成任务。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "prompt": "赛博朋克城市雨夜街景",
                        "model": "gpt-image-2",
                        "size": "1792x1024",
                        "aspect_ratio": "16:9",
                        "resolution": "2K",
                        "reference_images": ["/uploads/images/ref1.png"],
                        "count": 4,
                        "asset_name": "城市概念图",
                        "category": "scene",
                        "save_to_assets": True,
                        "inherit_project_style": True,
                    }
                }
            }
        }
    },
)
async def generate_workbench_images(
    project_id: str,
    req: WorkbenchImageGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)

    if req.category not in ALLOWED_IMAGE_CATEGORIES:
        raise HTTPException(status_code=422, detail="category 仅支持 character、scene、prop、storyboard、reference")

    requested_model = req.model or await _get_default_image_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="image",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    reference_images = _resolve_workbench_reference_images(req.model_dump())
    aspect_ratio = req.resolved_aspect_ratio()
    resolution = req.resolved_resolution()
    count = req.resolved_count()
    validated = validate_image_request(
        model=model,
        size=req.size,
        aspect_ratio=aspect_ratio,
        resolution=resolution,
        count=count,
        reference_images=reference_images,
    )
    aspect_ratio = validated["aspect_ratio"]
    resolution = validated["resolution"]
    count = validated["count"]
    reference_images = validated["reference_images"]
    resolved_size = validated["size"]
    task = GenTask(
        user_id=user.id,
        project_id=UUID(project_id),
        task_type="workbench_image",
        status="pending",
        total_count=count,
        model=model,
        size=resolved_size,
        params={
            "prompt": req.prompt,
            "asset_name": req.asset_name,
            "category": req.category,
            "save_to_assets": req.save_to_assets,
            "inherit_project_style": req.inherit_project_style,
            "aspect_ratio": aspect_ratio,
            "aspectRatio": aspect_ratio,
            "ratio": aspect_ratio,
            "resolution": resolution,
            "image_count": count,
            "imageCount": count,
            "count": count,
            "reference_images": reference_images,
            "referenceImages": reference_images,
        },
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.workbench:_run_workbench_image_task",
        kwargs={
            "task_id": task.id,
            "user_id": user.id,
            "project_id": UUID(project_id),
            "prompt": req.prompt,
            "model": model,
            "size": resolved_size,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "reference_images": reference_images,
            "count": count,
            "asset_name": req.asset_name,
            "category": req.category,
            "save_to_assets": req.save_to_assets,
            "inherit_project_style": req.inherit_project_style,
        },
        name=f"gen-task:{task.id}:workbench-image",
    )
    return _task_to_response(task)


class WorkbenchImageListResponse(BaseModel):
    list: List[WorkbenchImageCard]
    total: int
    has_more: bool
    hasMore: bool
    page: int
    page_size: int
    pageSize: int


class WorkbenchImageUploadResponse(BaseModel):
    asset_id: str
    file_id: str
    fileId: str
    uploaded_url: str
    uploadedUrl: str
    image: WorkbenchImageCard


class WorkbenchImageDeleteResponse(BaseModel):
    success: bool
    deleted_count: int
    deletedCount: int
    message: str


class WorkbenchBatchImageRequest(BaseModel):
    asset_ids: list[str] | None = None
    ids: list[str] | None = None


class WorkbenchBatchFavoriteRequest(BaseModel):
    liked: bool


class WorkbenchFavoriteResponse(BaseModel):
    success: bool
    asset_id: str
    is_liked: bool
    isLiked: bool


class WorkbenchImageTaskStatusResponse(BaseModel):
    task_id: str
    taskId: str
    status: str
    raw_status: str
    rawStatus: str
    progress: int
    total_count: int
    totalCount: int
    success_count: int
    successCount: int
    fail_count: int
    failCount: int
    params: dict | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str] = []
    referenceImages: list[str] = []
    images: list[WorkbenchImageCard] = []
    error_msg: str | None = None
    errorMsg: str | None = None
    partial: bool = False


def _resolve_batch_asset_ids(req: WorkbenchBatchImageRequest) -> list[str]:
    return [asset_id for asset_id in (req.asset_ids or req.ids or []) if asset_id]


@router.get(
    "/images",
    response_model=WorkbenchImageListResponse,
    summary="获取工作台图片列表",
    description="分页查询当前项目工作台下的图片结果，可按分类、关键词、收藏状态和来源过滤。",
    response_description="工作台图片列表。",
)
async def list_workbench_images(
    project_id: str,
    category: str | None = Query(None),
    search: str | None = Query(None),
    keyword: str | None = Query(None),
    is_liked: bool | None = Query(None),
    sources: str | None = Query(None),
    include_all: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(WORKBENCH_LIST_DEFAULT_PAGE_SIZE, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    requested_sources = _normalize_requested_image_sources(sources)
    project_uuid = UUID(project_id)
    query = apply_asset_visibility(
        select(Asset)
        .options(
            load_only(
                Asset.id,
                Asset.name,
                Asset.category,
                Asset.file_url,
                Asset.thumbnail_url,
                Asset.prompt,
                Asset.model,
                Asset.size,
                Asset.is_starred,
                Asset.metadata_json,
                Asset.created_at,
            )
        )
        .where(
            Asset.user_id == user.id,
            Asset.project_id == project_uuid,
            Asset.asset_type == "image",
        )
    )
    if not include_all:
        query = query.where(_is_workbench_managed_image_clause())
    if requested_sources:
        source_conditions: list[object] = []
        if "workbench_image" in requested_sources:
            source_conditions.append(
                Asset.metadata_json["source"].as_string() == "workbench_image"
            )
        if "workbench_upload" in requested_sources:
            source_conditions.append(
                or_(
                    Asset.metadata_json["source"].as_string() == "workbench_upload",
                    and_(
                        Asset.metadata_json["source"].as_string() == "upload",
                        Asset.metadata_json["uploaded_via"].as_string() == "workbench",
                    ),
                )
            )
        if source_conditions:
            query = query.where(or_(*source_conditions))
    if category:
        query = query.where(Asset.category == category)
    if is_liked is not None:
        query = query.where(Asset.is_starred == is_liked)

    normalized_search = (search or keyword or "").strip()
    if normalized_search:
        query = query.where(
            or_(
                Asset.name.ilike(f"%{normalized_search}%"),
                Asset.prompt.ilike(f"%{normalized_search}%"),
            )
        )

    total_result = await db.execute(
        select(sa_func.count()).select_from(query.order_by(None).subquery())
    )
    total = int(total_result.scalar_one() or 0)
    offset = (page - 1) * page_size
    asset_result = await db.execute(
        query.order_by(Asset.created_at.desc(), Asset.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    page_assets = asset_result.scalars().all()
    has_more = offset + len(page_assets) < total

    return WorkbenchImageListResponse(
        list=[
            _asset_to_image_card(asset, compact_metadata=True)
            for asset in page_assets
        ],
        total=total,
        has_more=has_more,
        hasMore=has_more,
        page=page,
        page_size=page_size,
        pageSize=page_size,
    )


@router.post(
    "/images/upload",
    response_model=WorkbenchImageUploadResponse,
    status_code=201,
    summary="上传工作台图片",
    description="向当前项目工作台上传一张图片，常用于工作台参考图或用户手动添加的素材。上传成功后会创建对应资产记录。",
    response_description="上传后的工作台图片信息。",
)
async def upload_workbench_image(
    project_id: str,
    file: UploadFile = File(...),
    category: str = Query("reference"),
    asset_name: str | None = Query(None, max_length=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)

    if category not in ALLOWED_IMAGE_CATEGORIES:
        raise HTTPException(status_code=422, detail="category 仅支持 character、scene、prop、storyboard、reference")

    try:
        file_url = await persist_uploaded_file(
            file,
            f"workbench/{project_id}/uploads",
            allowed_extensions=IMAGE_ALLOWED_EXTENSIONS,
            allowed_content_types=IMAGE_ALLOWED_CONTENT_TYPES,
            max_size=MAX_WORKBENCH_IMAGE_SIZE,
            fallback_extension=".png",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or "上传图片"
    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        file_url,
        asset_type="image",
    )
    asset = Asset(
        user_id=user.id,
        project_id=UUID(project_id),
        name=asset_name or Path(original_filename).stem or f"{project.name} 参考图",
        asset_type="image",
        category=category,
        file_url=file_url,
        thumbnail_url=derived_thumbnail_url,
        metadata_json={
            "source": "workbench_upload",
            "uploaded_via": "workbench",
            "original_filename": original_filename,
            **derivative_metadata,
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    image = _asset_to_image_card(asset)
    return WorkbenchImageUploadResponse(
        asset_id=str(asset.id),
        file_id=str(asset.id),
        fileId=str(asset.id),
        uploaded_url=file_url,
        uploadedUrl=file_url,
        image=image,
    )


@router.get(
    "/tasks/{task_id}",
    response_model=WorkbenchImageTaskStatusResponse,
    summary="轮询工作台图片生成任务",
    description="查询工作台图片生成任务的当前状态、进度、结果图片和错误信息。当前会把后台 `running` 状态归一成前端更易消费的 `generating`。",
    response_description="工作台图片任务状态。",
)
async def poll_workbench_image_task(
    project_id: str,
    task_id: str,
    include_images: bool = Query(
        False,
        description="是否返回完整图片结果卡片；默认关闭以减少高频轮询响应体。",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(GenTask).where(
            GenTask.id == UUID(task_id),
            GenTask.user_id == user.id,
            GenTask.project_id == UUID(project_id),
            GenTask.task_type == "workbench_image",
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    raw_status = task.status
    status = raw_status
    progress = 0
    partial = raw_status == "partial"
    if raw_status == "pending":
        status = "pending"
        progress = 0
    elif raw_status == "running":
        status = "generating"
        completed_count = task.success_count + task.fail_count
        progress = min(99, max(5, int((completed_count / max(task.total_count, 1)) * 100)))
    elif raw_status in {"completed", "partial"}:
        status = "completed"
        progress = 100
    elif raw_status == "cancelled":
        status = "failed"
        progress = 0
    else:
        status = "failed"
        progress = 0

    error_messages = [
        str(item.get("error"))
        for item in (task.results or [])
        if item.get("error")
    ]
    error_msg = "；".join(error_messages) if error_messages else None
    if raw_status == "cancelled":
        error_msg = "任务已取消"
    elif partial and not error_msg:
        error_msg = f"部分完成，成功 {task.success_count} 张，失败 {task.fail_count} 张"

    params = task.params or {}
    aspect_ratio = _resolve_workbench_aspect_ratio(params, task.size)
    resolution = _resolve_workbench_resolution(params, task.size)
    reference_images = _resolve_workbench_reference_images(params)
    images: list[WorkbenchImageCard] = []
    if include_images and raw_status in TASK_TERMINAL_STATUSES:
        images = await _build_task_image_cards(task, db)

    return WorkbenchImageTaskStatusResponse(
        task_id=str(task.id),
        taskId=str(task.id),
        status=status,
        raw_status=raw_status,
        rawStatus=raw_status,
        progress=progress,
        total_count=task.total_count,
        totalCount=task.total_count,
        success_count=task.success_count,
        successCount=task.success_count,
        fail_count=task.fail_count,
        failCount=task.fail_count,
        params=params,
        aspect_ratio=aspect_ratio,
        aspectRatio=aspect_ratio,
        resolution=resolution,
        reference_images=reference_images,
        referenceImages=reference_images,
        images=images,
        error_msg=error_msg,
        errorMsg=error_msg,
        partial=partial,
    )


@router.post(
    "/images/batch-delete",
    response_model=WorkbenchImageDeleteResponse,
    summary="批量删除工作台图片",
    description="批量删除当前项目工作台中的图片。当前为软删除语义，删除后图片进入回收逻辑而非立即物理清除。",
    response_description="批量删除结果。",
)
async def batch_delete_workbench_images(
    project_id: str,
    req: WorkbenchBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    asset_ids = _resolve_batch_asset_ids(req)
    if not asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一张图片")

    deleted_count = 0
    for asset_id in asset_ids:
        result = await db.execute(
            apply_asset_visibility(
                select(Asset).where(
                    Asset.id == UUID(asset_id),
                    Asset.user_id == user.id,
                    Asset.project_id == UUID(project_id),
                    Asset.asset_type == "image",
                )
            )
        )
        asset = result.scalar_one_or_none()
        if asset and _is_workbench_managed_image(asset):
            if mark_asset_deleted(asset):
                deleted_count += 1

    await db.commit()
    return WorkbenchImageDeleteResponse(
        success=True,
        deleted_count=deleted_count,
        deletedCount=deleted_count,
        message=f"已删除 {deleted_count} 张图片",
    )


@router.post(
    "/images/batch-download",
    summary="批量下载工作台图片",
    description="将当前项目工作台中选中的图片打包为 ZIP 下载。后端会跳过无法成功读取的单张图片，并在全部失败时返回错误。",
    response_description="工作台图片 ZIP 文件流。",
)
async def batch_download_workbench_images(
    project_id: str,
    req: WorkbenchBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    asset_ids = _resolve_batch_asset_ids(req)
    if not asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一张图片")

    result = await db.execute(
        select(Asset).where(
            Asset.id.in_([UUID(asset_id) for asset_id in asset_ids]),
            Asset.user_id == user.id,
            Asset.project_id == UUID(project_id),
            Asset.asset_type == "image",
        )
    )
    assets = [asset for asset in result.scalars().all() if _is_workbench_managed_image(asset)]
    if not assets:
        raise HTTPException(status_code=404, detail="没有可下载的图片")

    zip_buffer = io.BytesIO()
    added_count = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, asset in enumerate(assets, start=1):
            try:
                media = build_image_media_fields(
                    file_url=asset.file_url,
                    thumbnail_url=asset.thumbnail_url,
                    metadata=asset.metadata_json or {},
                    user_id=str(asset.user_id),
                    project_id=str(asset.project_id) if asset.project_id else None,
                    resource_id=str(asset.id),
                )
                download_target = resolve_verified_download_target_from_url(
                    str(media["download_url"] or asset.file_url),
                    expected_user_id=str(user.id),
                )
                content = await _read_media_bytes(download_target, timeout=60.0)
            except MediaDownloadAccessError as exc:
                raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
            except Exception:
                continue
            filename = _build_download_filename(asset, index)
            zip_file.writestr(f"{_sanitize_zip_segment(project.name)}/{filename}", content)
            added_count += 1

    if added_count == 0:
        raise HTTPException(status_code=502, detail="没有可成功下载的图片")

    zip_buffer.seek(0)
    download_name = f"{_sanitize_zip_segment(project.name)}_工作台图片.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


@router.post(
    "/images/{image_id}/favorite",
    response_model=WorkbenchFavoriteResponse,
    summary="收藏或取消收藏工作台图片",
    description="更新当前工作台图片的收藏状态。该接口与 `/like` 作用相同，仅为兼容不同前端命名。",
    response_description="更新后的收藏状态。",
)
@router.post(
    "/images/{image_id}/like",
    response_model=WorkbenchFavoriteResponse,
    summary="收藏或取消收藏工作台图片",
    description="更新当前工作台图片的收藏状态。该接口与 `/favorite` 作用相同，仅为兼容不同前端命名。",
    response_description="更新后的收藏状态。",
)
async def toggle_workbench_image_favorite(
    project_id: str,
    image_id: str,
    req: WorkbenchBatchFavoriteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_workbench_image_asset(project_id, image_id, user, db)
    asset.is_starred = req.liked
    await db.commit()
    await db.refresh(asset)
    return WorkbenchFavoriteResponse(
        success=True,
        asset_id=str(asset.id),
        is_liked=asset.is_starred,
        isLiked=asset.is_starred,
    )


@router.get(
    "/images/{image_id}",
    response_model=WorkbenchImageCard,
    summary="获取工作台图片详情",
    description="读取指定工作台图片的详情信息，包括原图地址、缩略图地址、提示词、模型和收藏状态等字段。",
    response_description="工作台图片详情。",
)
async def get_workbench_image_detail(
    project_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_workbench_image_asset(project_id, image_id, user, db)
    return _asset_to_image_card(asset)


@router.get(
    "/images/{image_id}/download",
    summary="下载工作台图片",
    description="下载指定工作台图片的原始文件内容。后端会自动读取本地托管文件或远程源地址并以附件流返回。",
    response_description="工作台图片文件流。",
)
async def download_workbench_image(
    project_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_workbench_image_asset(project_id, image_id, user, db)
    try:
        media = build_image_media_fields(
            file_url=asset.file_url,
            thumbnail_url=asset.thumbnail_url,
            metadata=asset.metadata_json or {},
            user_id=str(asset.user_id),
            project_id=str(asset.project_id) if asset.project_id else project_id,
            resource_id=str(asset.id),
        )
        download_target = resolve_verified_download_target_from_url(
            str(media["download_url"] or asset.file_url),
            expected_user_id=str(user.id),
        )
        content = await _read_media_bytes(download_target, timeout=60.0)
    except MediaDownloadAccessError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"下载图片失败: {str(exc)}") from exc

    filename = _build_download_filename(asset, 1)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.delete(
    "/images/{image_id}",
    response_model=WorkbenchImageDeleteResponse,
    summary="删除单张工作台图片",
    description="删除指定工作台图片。当前为软删除语义，成功后返回统一删除结果结构。",
    response_description="删除结果。",
)
async def delete_workbench_image(
    project_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_workbench_image_asset(project_id, image_id, user, db)
    mark_asset_deleted(asset)
    await db.commit()
    return WorkbenchImageDeleteResponse(
        success=True,
        deleted_count=1,
        deletedCount=1,
        message="已删除",
    )


class WorkbenchMediaResult(BaseModel):
    asset_id: str
    media_type: str
    source_type: str
    source_id: str | None = None
    name: str
    category: str
    file_url: str
    thumbnail_url: str | None = None
    prompt: str | None = None
    model: str | None = None
    size: str | None = None
    storyboard_id: str | None = None
    duration: float | None = None
    voice_id: str | None = None
    speed: float | None = None
    emotion: str | None = None
    created_at: str
    metadata_json: dict | None = None


class WorkbenchMediaQueryResponse(BaseModel):
    total: int
    counts: dict[str, int]
    items: list[WorkbenchMediaResult]


def _normalize_requested_media_types(types: str) -> set[str]:
    normalized = {item.strip().lower() for item in types.split(",") if item.strip()}
    if not normalized:
        return set(ALLOWED_MEDIA_TYPES)
    invalid = normalized - ALLOWED_MEDIA_TYPES
    if invalid:
        raise HTTPException(status_code=422, detail=f"不支持的媒体类型: {', '.join(sorted(invalid))}")
    return normalized


@router.get(
    "/results",
    response_model=WorkbenchMediaQueryResponse,
    summary="获取工作台聚合结果",
    description="聚合返回当前项目下的图片、音频、视频结果，便于工作台总览页按媒体类型统一展示。",
    response_description="工作台聚合媒体结果。",
)
async def list_workbench_results(
    project_id: str,
    media_types: str = Query("image,audio,video"),
    category: str | None = Query(None),
    storyboard_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    requested_types = _normalize_requested_media_types(media_types)
    project_uuid = UUID(project_id)

    asset_query = select(Asset).where(
        Asset.user_id == user.id,
        Asset.project_id == project_uuid,
        Asset.asset_type.in_(list(requested_types)),
        Asset.is_deleted == False,
    )
    if category:
        asset_query = asset_query.where(Asset.category == category)
    asset_query = asset_query.order_by(Asset.created_at.desc(), Asset.id.desc()).limit(limit)
    asset_result = await db.execute(asset_query)
    assets = asset_result.scalars().all()

    audio_clip_by_url: dict[str, AudioClip] = {}
    if "audio" in requested_types:
        audio_urls = [asset.file_url for asset in assets if asset.asset_type == "audio" and asset.file_url]
        if audio_urls:
            audio_result = await db.execute(
                select(AudioClip).where(
                    AudioClip.user_id == user.id,
                    AudioClip.project_id == project_uuid,
                    AudioClip.audio_url.in_(audio_urls),
                )
            )
            audio_clip_by_url = {
                clip.audio_url: clip for clip in audio_result.scalars().all() if clip.audio_url
            }

    video_clip_by_url: dict[str, VideoClip] = {}
    if "video" in requested_types:
        video_urls = [asset.file_url for asset in assets if asset.asset_type == "video" and asset.file_url]
        if video_urls:
            video_result = await db.execute(
                select(VideoClip).where(
                    VideoClip.user_id == user.id,
                    VideoClip.project_id == project_uuid,
                    VideoClip.video_url.in_(video_urls),
                )
            )
            video_clip_by_url = {
                clip.video_url: clip for clip in video_result.scalars().all() if clip.video_url
            }

    items: list[WorkbenchMediaResult] = []
    counts = {"image": 0, "audio": 0, "video": 0}

    for asset in assets:
        metadata = asset.metadata_json or {}
        audio_clip = audio_clip_by_url.get(asset.file_url) if asset.asset_type == "audio" else None
        video_clip = video_clip_by_url.get(asset.file_url) if asset.asset_type == "video" else None

        resolved_storyboard_id = metadata.get("storyboard_id")
        if not resolved_storyboard_id and audio_clip and audio_clip.storyboard_id:
            resolved_storyboard_id = str(audio_clip.storyboard_id)
        if not resolved_storyboard_id and video_clip and video_clip.storyboard_id:
            resolved_storyboard_id = str(video_clip.storyboard_id)

        if storyboard_id and resolved_storyboard_id != storyboard_id:
            continue

        source_type = str(metadata.get("source") or "asset")
        source_id = None
        duration = metadata.get("duration")
        voice_id = metadata.get("voice_id")
        speed = metadata.get("speed")
        emotion = metadata.get("emotion")

        if audio_clip:
            source_type = "audio_clip"
            source_id = str(audio_clip.id)
            duration = audio_clip.duration
            voice_id = audio_clip.voice_id
            speed = audio_clip.speed
            emotion = audio_clip.emotion
        elif video_clip:
            source_type = "video_clip"
            source_id = str(video_clip.id)
            duration = video_clip.duration

        items.append(
            WorkbenchMediaResult(
                asset_id=str(asset.id),
                media_type=asset.asset_type,
                source_type=source_type,
                source_id=source_id,
                name=asset.name,
                category=asset.category,
                file_url=asset.file_url,
                thumbnail_url=asset.thumbnail_url,
                prompt=asset.prompt,
                model=asset.model,
                size=asset.size,
                storyboard_id=resolved_storyboard_id,
                duration=duration,
                voice_id=voice_id,
                speed=speed,
                emotion=emotion,
                created_at=asset.created_at.isoformat(),
                metadata_json=metadata,
            )
        )
        counts[asset.asset_type] += 1

    return WorkbenchMediaQueryResponse(
        total=len(items),
        counts={key: value for key, value in counts.items() if key in requested_types},
        items=items,
    )
