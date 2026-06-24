from __future__ import annotations

import io
import json
import logging
import re
import hashlib
import urllib.request
import zipfile
from math import gcd
from pathlib import Path
from typing import Any, List, Literal
from urllib.parse import quote, unquote, urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func as sa_func, or_, select, update
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.dependencies import get_current_user
from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.creation_session import CreationSession
from app.models.creation_shot import CreationShot
from app.models.gen_task import GenTask
from app.models.model_config import ModelConfig
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import User
from app.models.video_clip import VideoClip
from app.models.voice import Voice
from app.schemas.tts import TTSAdvancedOptionsMixin, build_tts_provider_options
from app.services.asset_recycle import apply_asset_visibility, mark_asset_deleted
from app.services.background_runtime import build_gen_task_job_key, dispatch_background_job
from app.services.image_gen import image_gen_service
from app.services.media_fetch import read_media_bytes
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.media_derivative_pipeline import (
    build_image_derivative_bundle,
    build_video_playback_metadata,
    build_video_poster_bundle,
    merge_media_derivative_metadata,
)
from app.services.model_selection import get_default_available_model_id
from app.services.model_capabilities import (
    infer_video_reference_mode,
    resolve_optional_model_toggle,
    resolve_user_model,
    validate_image_request,
    validate_video_request,
)
from app.services.audio_voice_context import resolve_audio_voice_context
from app.services.media_references import delete_managed_upload_if_unreferenced
from app.services.reference_audio_proxy import MissingBinaryError, probe_reference_audio_duration
from app.services.media_view_models import (
    build_audio_media_fields,
    build_image_media_fields,
    build_video_media_fields,
)
from app.services.media_storage import (
    build_upload_url,
    build_managed_storage_metadata,
    get_media_fallback_extension,
    is_external_media_url,
    is_managed_upload_url,
    persist_if_external,
    persist_many_if_external,
    persist_remote_file,
    persist_uploaded_file,
    resolve_upload_dir,
    resolve_upload_path,
)
from app.services.object_storage import sync_managed_image_bundle_to_object_storage
from app.services.minimax_voice_runtime import (
    MiniMaxProviderRuntime,
    create_minimax_async_tts_task,
    download_minimax_file_content,
    extract_minimax_async_audio_result,
    normalize_minimax_async_status,
    query_minimax_async_tts_task,
)
from app.services.tts import tts_service
from app.services.user_api_key import (
    get_user_model_provider_credentials,
    get_user_model_provider_runtime,
)
from app.services.video_gen import video_gen_service
from app.services.visual_styles import append_visual_styles
from app.utils.url_security import validate_outbound_url

router = APIRouter()
logger = logging.getLogger("app.routers.creation")

CREATION_LIST_DEFAULT_PAGE_SIZE = 9

ALLOWED_ASPECT_RATIOS = {"16:9", "9:16", "1:1", "4:3"}
ALLOWED_MEDIA_TYPES = {"image", "audio", "video"}
ALLOWED_IMAGE_CATEGORIES = {"character", "scene", "prop", "storyboard", "reference"}
CREATION_IMAGE_SOURCES = {
    "creation_image",
    "creation_shot_image",
    "creation_shot_import",
    "creation_video_frame_extract",
}
IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_CREATION_IMAGE_SIZE = 20 * 1024 * 1024
VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov"}
VIDEO_ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime"}
MAX_CREATION_VIDEO_SIZE = 50 * 1024 * 1024
AUDIO_ALLOWED_EXTENSIONS = {".mp3", ".wav"}
AUDIO_ALLOWED_CONTENT_TYPES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"}
MAX_CREATION_AUDIO_SIZE = 15 * 1024 * 1024
CREATION_TASK_TYPES = {"creation_image", "creation_shot_image", "creation_video", "creation_audio"}
CREATION_SHOT_IMPORT_CONFIG = {
    "image_url": {
        "asset_type": "image",
        "category": "storyboard",
        "kind": "images",
        "label": "图片",
    },
    "audio_url": {
        "asset_type": "audio",
        "category": "audio",
        "kind": "audios",
        "label": "音频",
    },
    "video_url": {
        "asset_type": "video",
        "category": "storyboard",
        "kind": "videos",
        "label": "视频",
    },
}


async def _get_model_default_watermark(
    user_id: UUID,
    category: Literal["image", "video"],
    requested_model: str,
    db: AsyncSession,
) -> bool:
    provider_runtime = await get_user_model_provider_runtime(
        user_id,
        db,
        category=category,
        requested_model=requested_model,
    )
    if not provider_runtime:
        return False
    _, _, _, _, default_image_watermark, default_video_watermark = provider_runtime
    if category == "image":
        return default_image_watermark
    return default_video_watermark


async def _get_owned_project(
    project_id: str | None,
    user: User,
    db: AsyncSession,
) -> Project | None:
    if not project_id:
        return None

    result = await db.execute(
        select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


async def _get_session(session_id: str, user: User, db: AsyncSession) -> CreationSession:
    try:
        session_uuid = UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="session_id 不是合法 UUID") from exc

    result = await db.execute(
        select(CreationSession).where(
            CreationSession.id == session_uuid,
            CreationSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="创作会话不存在")
    return session


async def _get_shot(shot_id: str, user: User, db: AsyncSession) -> CreationShot:
    try:
        shot_uuid = UUID(shot_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="shot_id 不是合法 UUID") from exc

    result = await db.execute(
        select(CreationShot)
        .join(CreationSession, CreationSession.id == CreationShot.session_id)
        .where(CreationShot.id == shot_uuid, CreationSession.user_id == user.id)
    )
    shot = result.scalar_one_or_none()
    if not shot:
        raise HTTPException(status_code=404, detail="创作镜头不存在")
    return shot


async def _get_default_image_model(user_id: UUID, db: AsyncSession) -> str:
    return await get_default_available_model_id(
        user_id,
        db,
        category="image",
        fallback_model_id="dall-e-3",
    )


async def _get_default_video_model(user_id: UUID, db: AsyncSession) -> str:
    return await get_default_available_model_id(
        user_id,
        db,
        category="video",
        fallback_model_id="doubao-seedance-2.0",
    )


async def _count_shots_by_session(
    session_ids: list[UUID],
    db: AsyncSession,
) -> dict[str, int]:
    if not session_ids:
        return {}

    result = await db.execute(
        select(CreationShot.session_id, sa_func.count(CreationShot.id))
        .where(CreationShot.session_id.in_(session_ids))
        .group_by(CreationShot.session_id)
    )
    return {str(session_id): count for session_id, count in result.all()}


async def _resolve_next_shot_number(session_id: UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(sa_func.max(CreationShot.shot_number)).where(CreationShot.session_id == session_id)
    )
    current = result.scalar_one_or_none()
    return int(current or 0) + 1


async def _resolve_next_sort_order(session_id: UUID, db: AsyncSession) -> int:
    result = await db.execute(
        select(sa_func.max(CreationShot.sort_order)).where(CreationShot.session_id == session_id)
    )
    current = result.scalar_one_or_none()
    return int(current or 0) + 1


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


def _normalize_uuid_param(value: str | None, field: str) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    if cleaned == "" or cleaned.lower() in {"null", "undefined"}:
        return None
    try:
        UUID(cleaned)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field} 不是合法 UUID") from exc
    return cleaned


async def _resolve_creation_scope(
    *,
    user: User,
    db: AsyncSession,
    session_id: str | None = None,
    shot_id: str | None = None,
    project_id: str | None = None,
) -> tuple[CreationSession | None, CreationShot | None, Project | None]:
    normalized_session_id = _normalize_uuid_param(session_id, "session_id")
    normalized_shot_id = _normalize_uuid_param(shot_id, "shot_id")
    normalized_project_id = _normalize_uuid_param(project_id, "project_id")

    session = await _get_session(normalized_session_id, user, db) if normalized_session_id else None
    shot = await _get_shot(normalized_shot_id, user, db) if normalized_shot_id else None

    if shot and not session:
        session = await _get_session(str(shot.session_id), user, db)
    if shot and session and shot.session_id != session.id:
        raise HTTPException(status_code=400, detail="镜头不属于当前创作会话")

    resolved_project_id = normalized_project_id
    if shot and shot.project_id:
        if resolved_project_id and UUID(resolved_project_id) != shot.project_id:
            raise HTTPException(status_code=400, detail="project_id 与镜头归属不一致")
        resolved_project_id = str(shot.project_id)
    elif session and session.project_id:
        if resolved_project_id and UUID(resolved_project_id) != session.project_id:
            raise HTTPException(status_code=400, detail="project_id 与会话归属不一致")
        resolved_project_id = str(session.project_id)

    project = await _get_owned_project(resolved_project_id, user, db) if resolved_project_id else None
    return session, shot, project


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


def _normalize_aspect_ratio(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().replace(" ", "")
    return normalized or None


def _normalize_resolution(value: object) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    return normalized or None


def _infer_resolution_from_size(size: str | None) -> str | None:
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


def _resolve_reference_images(payload: dict | None) -> list[str]:
    data = payload or {}
    return _normalize_string_list(
        data.get("reference_images") or data.get("referenceImages")
    )


def _resolve_prompt_mentions(payload: dict | None) -> list[dict[str, Any]]:
    data = payload or {}
    resolved: list[dict[str, Any]] = []
    for item in (data.get("mentions") or []):
        try:
            mention = (
                item
                if isinstance(item, CreationPromptMention)
                else CreationPromptMention.model_validate(item)
            )
        except Exception:
            continue
        mention_data = mention.model_dump(exclude_none=True)
        if mention_data.get("display_text"):
            resolved.append(mention_data)
    return resolved


def _resolve_asset_bindings(payload: dict | None) -> list[dict[str, Any]]:
    data = payload or {}
    resolved: list[dict[str, Any]] = []
    for item in (data.get("attachments") or []):
        try:
            binding = (
                item
                if isinstance(item, CreationAssetBinding)
                else CreationAssetBinding.model_validate(item)
            )
        except Exception:
            continue
        binding_data = binding.model_dump(exclude_none=True)
        if any(binding_data.get(key) for key in ("asset_id", "asset_name", "url")):
            resolved.append(binding_data)
    return resolved


def _validated_asset_bindings_to_attachments(
    validated_asset_bindings: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    bindings = validated_asset_bindings or {}
    resolved: list[dict[str, Any]] = []
    for asset_type, key in (
        ("image", "image_refs"),
        ("video", "video_refs"),
        ("audio", "audio_refs"),
    ):
        for item in (bindings.get(key) or []):
            if not isinstance(item, dict):
                continue
            binding = {
                "asset_id": item.get("asset_id"),
                "asset_type": asset_type,
                "asset_name": item.get("asset_name"),
                "url": item.get("url"),
                "role": item.get("role"),
                "source": item.get("source"),
            }
            if any(binding.get(field) for field in ("asset_id", "asset_name", "url")):
                resolved.append(binding)
    return resolved


async def _enrich_creation_asset_bindings(
    bindings: list[dict[str, Any]] | list[CreationAssetBinding] | None,
    *,
    db: AsyncSession,
    fallback_user_id: str | None = None,
    fallback_project_id: str | None = None,
) -> list[CreationAssetBinding]:
    normalized_bindings: list[dict[str, Any]] = []
    asset_uuids: list[UUID] = []

    for item in bindings or []:
        try:
            binding = (
                item
                if isinstance(item, CreationAssetBinding)
                else CreationAssetBinding.model_validate(item)
            )
        except Exception:
            continue
        binding_data = binding.model_dump(exclude_none=True)
        normalized_bindings.append(binding_data)
        raw_asset_id = str(binding_data.get("asset_id") or "").strip()
        if not raw_asset_id:
            continue
        try:
            asset_uuids.append(UUID(raw_asset_id))
        except (TypeError, ValueError):
            continue

    assets_by_id: dict[str, Asset] = {}
    if asset_uuids:
        result = await db.execute(
            apply_asset_visibility(select(Asset).where(Asset.id.in_(asset_uuids)))
        )
        assets_by_id = {str(asset.id): asset for asset in result.scalars().all()}

    enriched_bindings: list[CreationAssetBinding] = []
    for binding_data in normalized_bindings:
        raw_asset_id = str(binding_data.get("asset_id") or "").strip()
        asset = assets_by_id.get(raw_asset_id)
        asset_type = str(
            binding_data.get("asset_type")
            or (asset.asset_type if asset else "")
            or ""
        ).strip().lower()

        if asset:
            metadata = asset.metadata_json or {}
            user_id = str(asset.user_id) if asset.user_id else fallback_user_id
            project_id = str(asset.project_id) if asset.project_id else fallback_project_id
            media_fields: dict[str, Any]
            if asset_type == "video":
                media_fields = build_video_media_fields(
                    file_url=asset.file_url,
                    thumbnail_url=asset.thumbnail_url,
                    metadata=metadata,
                    user_id=user_id,
                    project_id=project_id,
                    resource_id=str(asset.id),
                )
                binding_data.update(
                    {
                        "url": media_fields.get("preview_video_url") or asset.file_url or binding_data.get("url"),
                        "preview_video_url": media_fields.get("preview_video_url"),
                        "previewVideoUrl": media_fields.get("previewVideoUrl"),
                        "thumbnail_url": media_fields.get("thumbnail_url"),
                        "thumbnailUrl": media_fields.get("thumbnailUrl"),
                        "poster_url": media_fields.get("poster_url"),
                        "posterUrl": media_fields.get("posterUrl"),
                        "download_url": media_fields.get("download_url"),
                        "downloadUrl": media_fields.get("downloadUrl"),
                    }
                )
            elif asset_type == "audio":
                media_fields = build_audio_media_fields(
                    file_url=asset.file_url,
                    metadata=metadata,
                    user_id=user_id,
                    project_id=project_id,
                    resource_id=str(asset.id),
                )
                binding_data.update(
                    {
                        "url": media_fields.get("preview_url") or asset.file_url or binding_data.get("url"),
                        "preview_url": media_fields.get("preview_url"),
                        "previewUrl": media_fields.get("previewUrl"),
                        "download_url": media_fields.get("download_url"),
                        "downloadUrl": media_fields.get("downloadUrl"),
                    }
                )
            else:
                media_fields = build_image_media_fields(
                    file_url=asset.file_url,
                    thumbnail_url=asset.thumbnail_url,
                    metadata=metadata,
                    user_id=user_id,
                    project_id=project_id,
                    resource_id=str(asset.id),
                )
                binding_data.update(
                    {
                        "url": media_fields.get("preview_url") or asset.file_url or binding_data.get("url"),
                        "preview_url": media_fields.get("preview_url"),
                        "previewUrl": media_fields.get("previewUrl"),
                        "thumbnail_url": media_fields.get("thumbnail_url"),
                        "thumbnailUrl": media_fields.get("thumbnailUrl"),
                        "download_url": media_fields.get("download_url"),
                        "downloadUrl": media_fields.get("downloadUrl"),
                    }
                )
            binding_data["asset_id"] = str(asset.id)
            if asset.name and not binding_data.get("asset_name"):
                binding_data["asset_name"] = asset.name

        if asset_type:
            binding_data["asset_type"] = asset_type

        if any(
            binding_data.get(field)
            for field in (
                "asset_id",
                "asset_name",
                "url",
                "preview_url",
                "preview_video_url",
                "download_url",
            )
        ):
            enriched_bindings.append(CreationAssetBinding.model_validate(binding_data))

    return enriched_bindings


def _dedupe_urls(urls: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(url)
    return deduped


def _build_prompt_resolved(prompt: str, mentions: list[dict[str, Any]]) -> str:
    base = (prompt or "").strip()
    if not mentions:
        return base

    lines = []
    for index, mention in enumerate(mentions, start=1):
        asset_name = mention.get("asset_name") or mention.get("display_text") or "未命名资产"
        asset_type = mention.get("asset_type") or "file"
        role = "主体、动作、构图或风格特征" if asset_type == "image" else "内容与语义特征"
        lines.append(f"{index}. {asset_name}（{asset_type}），请优先参考其{role}")
    return "\n".join(part for part in [base, "重点参考资产：", *lines] if part)


def _resolve_image_binding_context(
    *,
    prompt: str,
    prompt_raw: str | None,
    prompt_resolved: str | None,
    reference_images: list[str],
    mentions: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
) -> tuple[str, str, list[str], list[dict[str, Any]], list[dict[str, Any]]]:
    prompt_raw_value = (prompt_raw or prompt or "").strip()
    image_bindings = [item for item in attachments if item.get("asset_type") == "image" and item.get("url")]

    mention_priority_urls: list[str] = []
    for mention in mentions:
        matched = None
        for binding in image_bindings:
            same_asset_id = mention.get("asset_id") and mention.get("asset_id") == binding.get("asset_id")
            same_asset_name = mention.get("asset_name") and mention.get("asset_name") == binding.get("asset_name")
            if same_asset_id or same_asset_name:
                matched = binding
                break
        if matched and matched.get("url"):
            mention_priority_urls.append(matched["url"])

    merged_reference_images = _dedupe_urls(
        mention_priority_urls
        + reference_images
        + [item["url"] for item in image_bindings if item.get("url")]
    )
    prompt_resolved_value = (
        (prompt_resolved or "").strip()
        or _build_prompt_resolved(prompt_raw_value or prompt, mentions)
    )
    return (
        prompt_raw_value,
        prompt_resolved_value,
        merged_reference_images,
        mentions,
        attachments,
    )


def _resolve_audio_binding_context(
    *,
    spoken_text: str,
    prompt_raw: str | None,
    prompt_resolved: str | None,
    reference_audio_url: str | None,
    mentions: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
) -> tuple[str, str, str | None, list[dict[str, Any]], list[dict[str, Any]]]:
    prompt_raw_value = (prompt_raw or spoken_text or "").strip()
    prompt_resolved_value = (
        (prompt_resolved or "").strip()
        or _build_prompt_resolved(prompt_raw_value or spoken_text, mentions)
    )
    explicit_reference_audio_url = str(reference_audio_url or "").strip() or None
    audio_bindings = [
        item for item in attachments
        if item.get("asset_type") == "audio" and item.get("url")
    ]

    mention_priority_audio_url = None
    for mention in mentions:
        matched = None
        for binding in audio_bindings:
            same_asset_id = mention.get("asset_id") and mention.get("asset_id") == binding.get("asset_id")
            same_asset_name = mention.get("asset_name") and mention.get("asset_name") == binding.get("asset_name")
            if same_asset_id or same_asset_name:
                matched = binding
                break
        if matched and matched.get("url"):
            mention_priority_audio_url = str(matched["url"]).strip() or None
            if mention_priority_audio_url:
                break

    fallback_audio_url = None
    for binding in audio_bindings:
        candidate = str(binding.get("url") or "").strip()
        if candidate:
            fallback_audio_url = candidate
            break

    resolved_reference_audio_url = (
        explicit_reference_audio_url
        or mention_priority_audio_url
        or fallback_audio_url
    )
    return (
        prompt_raw_value,
        prompt_resolved_value,
        resolved_reference_audio_url,
        mentions,
        attachments,
    )


def _resolve_aspect_ratio(payload: dict | None, size: str | None) -> str | None:
    data = payload or {}
    return (
        _normalize_aspect_ratio(data.get("aspect_ratio"))
        or _normalize_aspect_ratio(data.get("aspectRatio"))
        or _normalize_aspect_ratio(data.get("ratio"))
        or _extract_ratio_from_size(size)
    )


def _resolve_resolution(payload: dict | None, size: str | None) -> str | None:
    data = payload or {}
    return (
        _normalize_resolution(data.get("resolution"))
        or _infer_resolution_from_size(size)
        or size
    )


def _sanitize_zip_segment(value: str | None) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", (value or "").strip())
    return cleaned or "creation"


async def _read_media_bytes(url: str, timeout: float) -> bytes:
    return await read_media_bytes(
        url,
        label="创作资源地址",
        timeout=timeout,
        follow_redirects=True,
    )


def _build_download_filename(asset: Asset, fallback_index: int) -> str:
    parsed = urlparse(asset.file_url)
    suffix = Path(unquote(parsed.path or asset.file_url)).suffix.lower() or ".png"
    safe_name = _sanitize_zip_segment(asset.name or f"image_{fallback_index}")
    return f"{safe_name}_{fallback_index}{suffix}"


async def _load_creation_audio_asset_map(
    db: AsyncSession,
    user_id: UUID,
    clips: list[AudioClip],
    *,
    include_deleted: bool = False,
) -> dict[str, Asset]:
    if not clips:
        return {}

    clip_ids = [str(clip.id) for clip in clips]
    file_urls = [clip.audio_url for clip in clips if clip.audio_url]
    conditions = []
    if clip_ids:
        conditions.append(Asset.metadata_json["clip_id"].as_string().in_(clip_ids))
    if file_urls:
        conditions.append(Asset.file_url.in_(file_urls))
    if not conditions:
        return {}

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.user_id == user_id,
                Asset.asset_type == "audio",
                Asset.metadata_json["source"].as_string() == "creation_audio",
                or_(*conditions),
            ),
            include_deleted=include_deleted,
        )
    )
    assets = result.scalars().all()

    asset_by_clip_id: dict[str, Asset] = {}
    asset_by_file_url: dict[str, Asset] = {}
    for asset in assets:
        metadata = asset.metadata_json or {}
        clip_id = metadata.get("clip_id")
        if clip_id:
            asset_by_clip_id[str(clip_id)] = asset
        if asset.file_url:
            asset_by_file_url[asset.file_url] = asset

    resolved: dict[str, Asset] = {}
    for clip in clips:
        asset = asset_by_clip_id.get(str(clip.id)) or asset_by_file_url.get(clip.audio_url)
        if asset:
            resolved[str(clip.id)] = asset
    return resolved


def _resolve_creation_audio_asset(
    clip: AudioClip,
    active_asset_map: dict[str, Asset],
    all_asset_map: dict[str, Asset],
) -> Asset | None:
    asset = active_asset_map.get(str(clip.id))
    if asset:
        return asset
    deleted_asset = all_asset_map.get(str(clip.id))
    if deleted_asset and deleted_asset.is_deleted:
        return None
    return None


def _build_creation_audio_filename(
    clip: AudioClip,
    fallback_index: int,
    voice_name: str | None = None,
    asset: Asset | None = None,
) -> str:
    raw_name = asset.name if asset and asset.name else f"配音-{voice_name or clip.voice_id}"
    parsed = urlparse(asset.file_url if asset and asset.file_url else clip.audio_url)
    suffix = Path(unquote(parsed.path or clip.audio_url)).suffix.lower() or ".mp3"
    return f"{_sanitize_zip_segment(raw_name)}_{fallback_index}{suffix}"


def _is_creation_managed_video(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    source = metadata.get("source")
    return source in {"creation_video", "creation_shot_video", "creation_upload"}


def _build_creation_video_filename(asset: Asset, fallback_index: int) -> str:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    source_url = (
        metadata.get("download_url")
        or metadata.get("origin_url")
        or asset.file_url
    )
    parsed = urlparse(source_url)
    suffix = Path(unquote(parsed.path or source_url)).suffix.lower() or ".mp4"
    safe_name = _sanitize_zip_segment(asset.name or f"video_{fallback_index}")
    return f"{safe_name}_{fallback_index}{suffix}"


def _iter_creation_video_download_candidates(asset: Asset) -> list[str]:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    candidates = [
        metadata.get("download_url"),
        metadata.get("origin_url"),
        asset.file_url,
    ]
    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        cleaned = str(candidate or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


def _iter_creation_video_download_attempts(asset: Asset) -> list[str]:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    media = _resolve_creation_video_media(
        video_url=asset.file_url,
        thumbnail_url=asset.thumbnail_url,
        metadata=metadata,
        user_id=str(asset.user_id),
        project_id=str(asset.project_id) if asset.project_id else None,
        resource_id=str(asset.id),
    )
    candidates = [media.get("download_url"), *_iter_creation_video_download_candidates(asset)]
    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        cleaned = str(candidate or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


def _iter_creation_audio_download_attempts(
    clip: AudioClip,
    *,
    asset: Asset | None,
) -> list[str]:
    metadata = asset.metadata_json if asset and isinstance(asset.metadata_json, dict) else {}
    media = _resolve_creation_audio_media(
        audio_url=(asset.file_url if asset and asset.file_url else clip.audio_url),
        metadata=metadata,
        user_id=str(clip.user_id),
        project_id=str(asset.project_id) if asset and asset.project_id else None,
        resource_id=str(asset.id) if asset else str(clip.id),
    )
    candidates = [
        media.get("download_url"),
        clip.audio_url,
        asset.file_url if asset else None,
    ]
    result: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        cleaned = str(candidate or "").strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


def _coerce_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _is_creation_managed_image(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    source = metadata.get("source")
    if source in CREATION_IMAGE_SOURCES:
        return True
    return source == "upload" and metadata.get("uploaded_via") == "creation"


def _normalize_requested_image_sources(sources: str | None) -> set[str] | None:
    if not sources:
        return None

    raw_sources = {item.strip().lower() for item in sources.split(",") if item.strip()}
    normalized: set[str] = set()
    for item in raw_sources:
        if item in {"generated", "creation_image"}:
            normalized.add("creation_image")
        elif item in {"shot", "creation_shot_image"}:
            normalized.add("creation_shot_image")
        elif item in {"uploaded", "creation_upload", "upload"}:
            normalized.add("creation_upload")
        else:
            raise HTTPException(status_code=422, detail=f"不支持的图片来源: {item}")
    return normalized


def _creation_uploaded_image_condition():
    source_expr = Asset.metadata_json["source"].as_string()
    uploaded_via_expr = Asset.metadata_json["uploaded_via"].as_string()
    return or_(
        source_expr == "creation_upload",
        and_(source_expr == "upload", uploaded_via_expr == "creation"),
    )


def _build_creation_image_source_condition(
    *,
    requested_sources: set[str] | None,
    include_all: bool,
):
    if include_all:
        return None

    source_expr = Asset.metadata_json["source"].as_string()
    uploaded_condition = _creation_uploaded_image_condition()

    if requested_sources:
        source_conditions = []
        if "creation_image" in requested_sources:
            source_conditions.append(source_expr == "creation_image")
        if "creation_shot_image" in requested_sources:
            source_conditions.append(source_expr == "creation_shot_image")
        if "creation_upload" in requested_sources:
            source_conditions.append(uploaded_condition)
        return or_(*source_conditions) if source_conditions else None

    return or_(
        source_expr.in_(tuple(CREATION_IMAGE_SOURCES)),
        and_(
            source_expr == "upload",
            Asset.metadata_json["uploaded_via"].as_string() == "creation",
        ),
    )


def _merge_shot_metadata(shot: CreationShot, updates: dict) -> dict:
    metadata = dict(shot.metadata_json or {})
    metadata.update(updates)
    shot.metadata_json = metadata
    return metadata


async def _apply_visual_style(
    prompt: str,
    session: CreationSession | None,
    project: Project | None,
    user_id: UUID,
    db: AsyncSession,
) -> str:
    return await append_visual_styles(
        prompt,
        [session.visual_style if session else None, project.visual_style if project else None],
        user_id,
        db,
    )


def _resolve_creation_subdir(
    *,
    session_id: UUID | None = None,
    shot_id: UUID | None = None,
    kind: str,
) -> str:
    if session_id and shot_id:
        return f"creation/sessions/{session_id}/shots/{shot_id}/{kind}"
    if session_id:
        return f"creation/sessions/{session_id}/{kind}"
    return f"creation/global/{kind}"


def _merge_metadata_dict(existing: dict | None, updates: dict | None = None) -> dict | None:
    return merge_media_derivative_metadata(existing, updates)


def _derive_asset_thumbnail(
    source_url: str | None,
    *,
    asset_type: str,
) -> tuple[str | None, dict]:
    bundle = build_image_derivative_bundle(
        source_url,
        preview_subdir="derived/assets/preview",
        asset_type=asset_type,
    )
    return bundle["thumbnail_url"], dict(bundle["metadata_updates"])


def _derive_asset_preview(source_url: str | None) -> tuple[str | None, dict]:
    bundle = build_image_derivative_bundle(
        source_url,
        preview_subdir="derived/assets/preview",
        asset_type="image",
    )
    return bundle["preview_url"], dict(bundle["metadata_updates"])


async def _derive_video_thumbnail_from_first_frame(video_url: str | None) -> tuple[str | None, dict]:
    bundle = await build_video_poster_bundle(video_url=video_url)
    return bundle["thumbnail_url"], dict(bundle["metadata_updates"])


def _build_creation_shot_import_asset_name(shot: CreationShot, field_name: str) -> str:
    config = CREATION_SHOT_IMPORT_CONFIG[field_name]
    return f"镜头#{shot.shot_number}{config['label']}"


def _build_creation_shot_import_subdir(shot: CreationShot, field_name: str) -> str:
    config = CREATION_SHOT_IMPORT_CONFIG[field_name]
    return _resolve_creation_subdir(
        session_id=shot.session_id,
        shot_id=shot.id,
        kind=f"imports/{config['kind']}",
    )


def _build_creation_shot_reference_subdir(shot: CreationShot) -> str:
    return _resolve_creation_subdir(
        session_id=shot.session_id,
        shot_id=shot.id,
        kind="imports/references",
    )


def _update_creation_shot_origin_metadata(
    shot: CreationShot,
    key: str,
    value: str | list[str] | None,
) -> None:
    metadata = dict(shot.metadata_json or {})
    imported_origins = dict(metadata.get("imported_origins") or {})
    if value in (None, [], ""):
        imported_origins.pop(key, None)
    else:
        imported_origins[key] = value
    if imported_origins:
        metadata["imported_origins"] = imported_origins
    else:
        metadata.pop("imported_origins", None)
    shot.metadata_json = metadata or None


async def _find_creation_shot_import_asset(
    db: AsyncSession,
    *,
    user_id: UUID,
    shot: CreationShot,
    field_name: str,
) -> Asset | None:
    config = CREATION_SHOT_IMPORT_CONFIG[field_name]
    result = await db.execute(
        select(Asset).where(
            Asset.user_id == user_id,
            Asset.asset_type == config["asset_type"],
            Asset.metadata_json["source"].as_string() == "creation_shot_import",
            Asset.metadata_json["shot_id"].as_string() == str(shot.id),
            Asset.metadata_json["imported_field"].as_string() == field_name,
        )
    )
    return result.scalar_one_or_none()


async def _sync_creation_shot_import_asset(
    db: AsyncSession,
    *,
    user_id: UUID,
    shot: CreationShot,
    field_name: str,
    persisted_url: str,
    origin_url: str | None,
) -> None:
    config = CREATION_SHOT_IMPORT_CONFIG[field_name]
    asset = await _find_creation_shot_import_asset(db, user_id=user_id, shot=shot, field_name=field_name)
    metadata_updates = build_managed_storage_metadata(
        origin_url=origin_url,
        import_source="creation_shot_import",
        extra={
            "source": "creation_shot_import",
            "session_id": str(shot.session_id),
            "shot_id": str(shot.id),
            "imported_field": field_name,
        },
    )
    derived_thumbnail_url = None
    derived_preview_url = None
    if config["asset_type"] == "image":
        derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
            persisted_url,
            asset_type="image",
        )
        derived_preview_url, preview_metadata = _derive_asset_preview(persisted_url)
        metadata_updates.update(derivative_metadata)
        metadata_updates.update(preview_metadata)
        if derived_preview_url:
            metadata_updates["preview_url"] = derived_preview_url

    old_url = None
    if asset:
        old_url = asset.file_url
        asset.name = _build_creation_shot_import_asset_name(shot, field_name)
        asset.project_id = shot.project_id
        asset.category = config["category"]
        asset.file_url = persisted_url
        if derived_thumbnail_url:
            asset.thumbnail_url = derived_thumbnail_url
        asset.metadata_json = _merge_metadata_dict(asset.metadata_json, metadata_updates)
    else:
        asset = Asset(
            user_id=user_id,
            project_id=shot.project_id,
            name=_build_creation_shot_import_asset_name(shot, field_name),
            asset_type=config["asset_type"],
            category=config["category"],
            file_url=persisted_url,
            thumbnail_url=derived_thumbnail_url,
            metadata_json=metadata_updates,
        )
        db.add(asset)
        await db.flush()

    if old_url and old_url != persisted_url:
        await delete_managed_upload_if_unreferenced(
            db,
            old_url,
            excluding_asset_id=asset.id,
            excluding_creation_shot_id=shot.id,
        )


async def _delete_creation_shot_import_asset(
    db: AsyncSession,
    *,
    user_id: UUID,
    shot: CreationShot,
    field_name: str,
) -> None:
    asset = await _find_creation_shot_import_asset(db, user_id=user_id, shot=shot, field_name=field_name)
    if not asset:
        return

    urls_to_cleanup = {
        url
        for url in [asset.file_url, asset.thumbnail_url, *(asset.reference_image_urls or [])]
        if is_managed_upload_url(url)
    }
    await db.delete(asset)
    await db.flush()
    for url in urls_to_cleanup:
        await delete_managed_upload_if_unreferenced(
            db,
            url,
            excluding_asset_id=asset.id,
            excluding_creation_shot_id=shot.id,
        )


async def _sync_creation_shot_media_field(
    db: AsyncSession,
    *,
    user_id: UUID,
    shot: CreationShot,
    field_name: str,
    raw_url: str | None,
) -> None:
    previous_url = getattr(shot, field_name)
    cleaned = raw_url.strip() if raw_url else None
    origin_url = cleaned if cleaned and is_external_media_url(cleaned) else None
    if cleaned:
        persisted_url = await persist_if_external(
            cleaned,
            _build_creation_shot_import_subdir(shot, field_name),
            fallback_extension=get_media_fallback_extension(
                CREATION_SHOT_IMPORT_CONFIG[field_name]["asset_type"]
            ),
            url_label=f"镜头{CREATION_SHOT_IMPORT_CONFIG[field_name]['label']}地址",
        )
    else:
        persisted_url = None

    setattr(shot, field_name, persisted_url)
    _update_creation_shot_origin_metadata(shot, field_name, origin_url)

    if persisted_url:
        await _sync_creation_shot_import_asset(
            db,
            user_id=user_id,
            shot=shot,
            field_name=field_name,
            persisted_url=persisted_url,
            origin_url=origin_url,
        )
    else:
        await _delete_creation_shot_import_asset(
            db,
            user_id=user_id,
            shot=shot,
            field_name=field_name,
        )

    if previous_url and previous_url != persisted_url:
        await delete_managed_upload_if_unreferenced(
            db,
            previous_url,
            excluding_creation_shot_id=shot.id,
        )


async def _sync_creation_shot_reference_images(
    db: AsyncSession,
    *,
    shot: CreationShot,
    raw_urls: list[str] | None,
) -> None:
    previous_urls = set(shot.reference_image_urls or [])
    cleaned_urls = [url.strip() for url in (raw_urls or []) if isinstance(url, str) and url.strip()]
    origin_urls = [url for url in cleaned_urls if is_external_media_url(url)]
    persisted_urls = await persist_many_if_external(
        cleaned_urls,
        _build_creation_shot_reference_subdir(shot),
        fallback_extension=get_media_fallback_extension("image"),
        url_label="镜头参考图地址",
    )

    shot.reference_image_urls = persisted_urls or None
    _update_creation_shot_origin_metadata(shot, "reference_image_urls", origin_urls or None)

    for removed_url in previous_urls - set(shot.reference_image_urls or []):
        await delete_managed_upload_if_unreferenced(
            db,
            removed_url,
            excluding_creation_shot_id=shot.id,
        )


class CreationSessionResponse(BaseModel):
    id: str
    user_id: str
    project_id: str | None
    title: str
    description: str | None
    aspect_ratio: str
    visual_style: str | None
    status: str
    metadata_json: dict | None
    shot_count: int = 0
    created_at: str
    updated_at: str


class CreateSessionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    project_id: str | None = None
    aspect_ratio: str = Field(default="16:9")
    visual_style: str | None = Field(default=None, max_length=100)
    status: str = Field(default="draft", max_length=20)
    metadata_json: dict | None = None


class UpdateSessionRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    project_id: str | None = None
    aspect_ratio: str | None = None
    visual_style: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=20)
    metadata_json: dict | None = None


class CreationShotResponse(BaseModel):
    id: str
    session_id: str
    project_id: str | None
    shot_number: int
    title: str | None
    content: str | None
    shot_type: str | None
    camera: str | None
    camera_angle: str | None
    composition: str | None
    duration: float | None
    prompt: str | None
    image_url: str | None
    audio_url: str | None
    video_url: str | None
    reference_image_urls: list | None
    metadata_json: dict | None
    sort_order: int
    created_at: str
    updated_at: str


class CreateShotRequest(BaseModel):
    project_id: str | None = None
    shot_number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    shot_type: str | None = Field(default=None, max_length=20)
    camera: str | None = Field(default=None, max_length=20)
    camera_angle: str | None = Field(default=None, max_length=20)
    composition: str | None = Field(default=None, max_length=20)
    duration: float | None = Field(default=None, ge=0)
    prompt: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    video_url: str | None = None
    reference_image_urls: list | None = None
    metadata_json: dict | None = None
    sort_order: int | None = None


class UpdateShotRequest(BaseModel):
    project_id: str | None = None
    shot_number: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    shot_type: str | None = Field(default=None, max_length=20)
    camera: str | None = Field(default=None, max_length=20)
    camera_angle: str | None = Field(default=None, max_length=20)
    composition: str | None = Field(default=None, max_length=20)
    duration: float | None = Field(default=None, ge=0)
    prompt: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    video_url: str | None = None
    reference_image_urls: list | None = None
    metadata_json: dict | None = None
    sort_order: int | None = None


class ReorderShotsRequest(BaseModel):
    shot_ids: list[str] = Field(min_length=1)


class CreationImageCard(BaseModel):
    id: str
    asset_id: str | None = None
    name: str
    category: str
    thumbnail_url: str
    thumbnailUrl: str
    preview_url: str | None = None
    previewUrl: str | None = None
    large_url: str | None = None
    largeUrl: str | None = None
    original_url: str
    originalUrl: str
    download_url: str | None = None
    downloadUrl: str | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    model: str | None = None
    prompt: str | None = None
    reference_images: list[str] = []
    referenceImages: list[str] = []
    session_id: str | None = None
    sessionId: str | None = None
    shot_id: str | None = None
    shotId: str | None = None
    created_at: str
    createdAt: str
    is_liked: bool
    isLiked: bool
    is_owner: bool = True
    isOwner: bool = True
    source: str | None = None
    metadata_json: dict | None = None
    preview_ready: bool | None = None
    previewReady: bool | None = None


class CreationImageListResponse(BaseModel):
    list: List[CreationImageCard]
    total: int
    has_more: bool
    hasMore: bool
    page: int
    page_size: int
    pageSize: int


class CreationImageUploadResponse(BaseModel):
    asset_id: str
    file_id: str
    fileId: str
    uploaded_url: str
    uploadedUrl: str
    image: CreationImageCard


class CreationImageDeleteResponse(BaseModel):
    success: bool
    deleted_count: int
    deletedCount: int
    message: str


class CreationBatchImageRequest(BaseModel):
    asset_ids: list[str] | None = None
    ids: list[str] | None = None


class CreationBatchFavoriteRequest(BaseModel):
    liked: bool


class CreationBatchImageFavoriteRequest(BaseModel):
    asset_ids: list[str] | None = None
    ids: list[str] | None = None
    liked: bool


class CreationFavoriteResponse(BaseModel):
    success: bool
    asset_id: str
    is_liked: bool
    isLiked: bool


class CreationTaskResponse(BaseModel):
    id: str
    task_id: str
    taskId: str
    user_id: str
    project_id: str | None
    task_type: str
    status: str
    total_count: int
    success_count: int
    fail_count: int
    model: str | None
    size: str | None
    params: dict | None
    results: list | None
    current_stage: str | None = None
    currentStage: str | None = None
    partial_ready: bool | None = None
    partialReady: bool | None = None
    session_id: str | None = None
    shot_id: str | None = None
    created_at: str
    updated_at: str


class CreationImageTaskStatusResponse(BaseModel):
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
    session_id: str | None = None
    sessionId: str | None = None
    shot_id: str | None = None
    shotId: str | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str] = []
    referenceImages: list[str] = []
    images: list[CreationImageCard] = []
    error_msg: str | None = None
    errorMsg: str | None = None
    partial: bool = False


class CreationImageGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    prompt_raw: str | None = None
    prompt_resolved: str | None = None
    model: str | None = None
    size: str | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str | None] | None = None
    referenceImages: list[str | None] | None = None
    count: int | None = Field(default=None, ge=1, le=15)
    image_count: int | None = Field(default=None, ge=1, le=15)
    imageCount: int | None = Field(default=None, ge=1, le=15)
    asset_name: str | None = Field(default=None, max_length=200)
    category: str = Field(default="reference")
    save_to_assets: bool = True
    inherit_project_style: bool = True
    session_id: str | None = None
    shot_id: str | None = None
    project_id: str | None = None
    watermark: bool | None = None
    # Seedream 5.0 官方可选参数（OneLinkAI 透传到 /volc/api/v3/images/generations）。
    output_format: str | None = None
    response_format: str | None = None
    web_search: bool | None = None
    optimize_prompt: str | None = None
    sequential_image_generation: str | None = None
    stream: bool | None = None
    attachments: list["CreationAssetBinding"] | None = None
    mentions: list["CreationPromptMention"] | None = None

    def resolved_aspect_ratio(self) -> str:
        return (
            _normalize_aspect_ratio(self.aspect_ratio)
            or _normalize_aspect_ratio(self.aspectRatio)
            or _extract_ratio_from_size(self.size)
            or "1:1"
        )

    def resolved_resolution(self) -> str:
        return (
            _normalize_resolution(self.resolution)
            or _infer_resolution_from_size(self.size)
            or "1K"
        )

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1

    def resolved_size(self) -> str | None:
        normalized_size = (self.size or "").strip()
        return normalized_size or None


class CreationShotImageGenerateRequest(BaseModel):
    prompt: str | None = Field(default=None, max_length=4000)
    model: str | None = None
    size: str | None = None
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str | None] | None = None
    referenceImages: list[str | None] | None = None
    count: int | None = Field(default=None, ge=1, le=15)
    image_count: int | None = Field(default=None, ge=1, le=15)
    imageCount: int | None = Field(default=None, ge=1, le=15)
    asset_name: str | None = Field(default=None, max_length=200)
    category: str = Field(default="storyboard")
    save_to_assets: bool = True
    inherit_project_style: bool = True
    watermark: bool | None = None

    def resolved_aspect_ratio(self, shot: CreationShot, session: CreationSession) -> str:
        return (
            _normalize_aspect_ratio(self.aspect_ratio)
            or _normalize_aspect_ratio(self.aspectRatio)
            or _extract_ratio_from_size(self.size)
            or session.aspect_ratio
            or "16:9"
        )

    def resolved_resolution(self) -> str:
        return (
            _normalize_resolution(self.resolution)
            or _infer_resolution_from_size(self.size)
            or "2K"
        )

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1

    def resolved_size(self, shot: CreationShot, session: CreationSession) -> str | None:
        normalized_size = (self.size or "").strip()
        return normalized_size or None


class CreationShotAudioGenerateRequest(TTSAdvancedOptionsMixin):
    text: str | None = None
    voice_id: str = "zh-CN-XiaoxiaoNeural"
    speed: float = 1.0
    emotion: str | None = None
    model: str | None = None


class CreationShotAudioResponse(BaseModel):
    clip_id: str
    asset_id: str
    project_id: str | None
    shot_id: str
    text: str
    voice_id: str
    audio_url: str
    duration: float
    speed: float
    emotion: str | None
    created_at: str


class CreationVideoGenerateRequest(BaseModel):
    prompt: str
    model: str = "doubao-seedance-2.0"
    generation_mode: str | None = None
    reference_mode: str = "full"
    ratio: str = "16:9"
    resolution: str = "720P"
    duration: float | int = 5
    with_audio: bool = True
    audio_type: str | None = None
    audio_setting: str | None = None
    off_peak: bool | None = None
    watermark: bool | None = None
    attachments: list["CreationAssetBinding"] | None = None
    mentions: list["CreationPromptMention"] | None = None
    subjects: list["CreationVideoSubject"] | None = None
    multiframe_segments: list["CreationVideoMultiframeSegment"] | None = None
    first_frame_url: str | None = None
    last_frame_url: str | None = None
    reference_video_url: str | None = None
    reference_audio_url: str | None = None
    first_frame_asset_id: str | None = None
    last_frame_asset_id: str | None = None
    reference_video_asset_id: str | None = None
    reference_audio_asset_id: str | None = None
    reference_image_asset_ids: list[str] | None = None
    session_id: str | None = None
    shot_id: str | None = None
    project_id: str | None = None


class CreationPromptMention(BaseModel):
    mention_id: str | None = None
    asset_id: str | None = None
    asset_type: Literal["image", "video", "audio"] | None = None
    asset_name: str | None = None
    display_text: str
    start: int | None = None
    end: int | None = None
    intended_role: str | None = None


class CreationAssetBinding(BaseModel):
    asset_id: str | None = None
    asset_type: Literal["image", "video", "audio"] | None = None
    asset_name: str | None = None
    url: str | None = None
    duration: float | None = Field(default=None, ge=0)
    preview_url: str | None = None
    previewUrl: str | None = None
    preview_video_url: str | None = None
    previewVideoUrl: str | None = None
    thumbnail_url: str | None = None
    thumbnailUrl: str | None = None
    poster_url: str | None = None
    posterUrl: str | None = None
    download_url: str | None = None
    downloadUrl: str | None = None
    role: str | None = None
    source: str | None = None


class CreationVideoSubject(BaseModel):
    name: str
    images: list[str] = Field(default_factory=list)


class CreationVideoMultiframeSegment(BaseModel):
    prompt: str | None = None
    key_image: str
    duration: int | None = Field(default=None, ge=2, le=7)


class CreationVideoCard(BaseModel):
    id: str
    asset_id: str
    assetId: str | None = None
    name: str | None = None
    video_url: str
    videoUrl: str | None = None
    thumbnail_url: str | None = None
    thumbnailUrl: str | None = None
    poster_url: str | None = None
    posterUrl: str | None = None
    preview_video_url: str | None = None
    previewVideoUrl: str | None = None
    hls_url: str | None = None
    hlsUrl: str | None = None
    available_qualities: list[dict[str, Any]] | None = None
    availableQualities: list[dict[str, Any]] | None = None
    download_url: str | None = None
    downloadUrl: str | None = None
    duration: float | None = None
    ratio: str | None = None
    resolution: str | None = None
    model: str | None = None
    prompt: str | None = None
    generation_mode: str | None = None
    generationMode: str | None = None
    reference_mode: str | None = None
    referenceMode: str | None = None
    first_frame_url: str | None = None
    firstFrameUrl: str | None = None
    last_frame_url: str | None = None
    lastFrameUrl: str | None = None
    prompt_raw: str | None = None
    promptRaw: str | None = None
    prompt_resolved: str | None = None
    promptResolved: str | None = None
    asset_bindings: list[CreationAssetBinding] = Field(default_factory=list)
    assetBindings: list[CreationAssetBinding] = Field(default_factory=list)
    is_liked: bool = False
    isLiked: bool = False
    created_at: str
    createdAt: str | None = None
    preview_ready: bool | None = None
    previewReady: bool | None = None


class CreationVideoListResponse(BaseModel):
    list: List[CreationVideoCard]
    total: int
    has_more: bool
    hasMore: bool
    page: int
    page_size: int
    pageSize: int


class CreationVideoTaskStatusResponse(BaseModel):
    task_id: str
    taskId: str
    status: str
    progress: int
    current_stage: str | None = None
    currentStage: str | None = None
    partial_ready: bool | None = None
    partialReady: bool | None = None
    result: CreationVideoCard | None = None
    error_msg: str | None = None
    errorMsg: str | None = None


class CreationVideoUploadResponse(BaseModel):
    asset_id: str
    file_id: str
    fileId: str
    uploaded_url: str
    uploadedUrl: str
    video: CreationVideoCard


class CreationAudioCard(BaseModel):
    id: str
    asset_id: str
    name: str | None = None
    audio_url: str
    preview_url: str | None = None
    previewUrl: str | None = None
    download_url: str | None = None
    downloadUrl: str | None = None
    duration: float | None = None
    is_favorite: bool = False
    created_at: str
    metadata_json: dict | None = None
    preview_ready: bool | None = None
    previewReady: bool | None = None


class CreationAudioUploadResponse(BaseModel):
    asset_id: str
    file_id: str
    fileId: str
    uploaded_url: str
    uploadedUrl: str
    audio: CreationAudioCard


class CreationAudioTaskStatusResponse(BaseModel):
    task_id: str
    taskId: str
    status: str
    progress: int
    result: CreationAudioCard | None = None
    error_msg: str | None = None
    errorMsg: str | None = None


class CreationShotVideoGenerateRequest(BaseModel):
    prompt: str | None = None
    model: str | None = None
    reference_mode: str | None = None
    duration: float | str = 5.0
    first_frame_url: str | None = None
    last_frame_url: str | None = None
    resolution: str | None = None
    sound_effect: bool = False
    reference_video_url: str | None = None
    reference_audio_url: str | None = None
    ratio: str | None = None
    generate_mode: str | None = None
    generate_audio: bool | None = None
    audio_setting: str | None = None
    watermark: bool | None = None


class CreationShotVideoResponse(BaseModel):
    clip_id: str
    asset_id: str
    project_id: str | None
    shot_id: str
    video_url: str
    thumbnail_url: str | None = None
    duration: float
    model: str | None
    prompt: str | None
    created_at: str


def _session_to_response(session: CreationSession, shot_count: int = 0) -> CreationSessionResponse:
    return CreationSessionResponse(
        id=str(session.id),
        user_id=str(session.user_id),
        project_id=str(session.project_id) if session.project_id else None,
        title=session.title,
        description=session.description,
        aspect_ratio=session.aspect_ratio,
        visual_style=session.visual_style,
        status=session.status,
        metadata_json=session.metadata_json,
        shot_count=shot_count,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


def _shot_to_response(shot: CreationShot) -> CreationShotResponse:
    return CreationShotResponse(
        id=str(shot.id),
        session_id=str(shot.session_id),
        project_id=str(shot.project_id) if shot.project_id else None,
        shot_number=shot.shot_number,
        title=shot.title,
        content=shot.content,
        shot_type=shot.shot_type,
        camera=shot.camera,
        camera_angle=shot.camera_angle,
        composition=shot.composition,
        duration=shot.duration,
        prompt=shot.prompt,
        image_url=shot.image_url,
        audio_url=shot.audio_url,
        video_url=shot.video_url,
        reference_image_urls=shot.reference_image_urls,
        metadata_json=shot.metadata_json,
        sort_order=shot.sort_order,
        created_at=shot.created_at.isoformat(),
        updated_at=shot.updated_at.isoformat(),
    )


def _task_to_response(task: GenTask) -> CreationTaskResponse:
    params = task.params or {}
    return CreationTaskResponse(
        id=str(task.id),
        task_id=str(task.id),
        taskId=str(task.id),
        user_id=str(task.user_id),
        project_id=str(task.project_id) if task.project_id else None,
        task_type=task.task_type,
        status=task.status,
        total_count=task.total_count,
        success_count=task.success_count,
        fail_count=task.fail_count,
        model=task.model,
        size=task.size,
        params=params,
        results=task.results,
        current_stage=params.get("current_stage"),
        currentStage=params.get("current_stage"),
        partial_ready=params.get("partial_ready"),
        partialReady=params.get("partial_ready"),
        session_id=str(params.get("session_id")) if params.get("session_id") else None,
        shot_id=str(params.get("shot_id")) if params.get("shot_id") else None,
        created_at=task.created_at.isoformat(),
        updated_at=task.updated_at.isoformat(),
    )


def _update_creation_video_task_runtime_state(
    task: GenTask,
    *,
    current_stage: str,
    partial_ready: bool = False,
    metadata_commit_status: str | None = None,
    extra_params: dict[str, Any] | None = None,
) -> None:
    params = dict(task.params or {})
    params["current_stage"] = current_stage
    params["partial_ready"] = partial_ready
    if metadata_commit_status is not None:
        params["metadata_commit_status"] = metadata_commit_status
    if extra_params:
        params.update(extra_params)
    task.params = params


def _resolve_creation_image_media(
    *,
    thumbnail_url: str | None,
    original_url: str | None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, str | bool | None]:
    return build_image_media_fields(
        file_url=original_url,
        thumbnail_url=thumbnail_url,
        metadata=metadata,
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )


def _resolve_creation_video_media(
    *,
    video_url: str | None,
    thumbnail_url: str | None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, Any]:
    media = build_video_media_fields(
        file_url=video_url,
        thumbnail_url=thumbnail_url,
        metadata=metadata,
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )
    return {
        "poster_url": media["poster_url"],
        "preview_video_url": media["preview_video_url"],
        "hls_url": media["hls_url"],
        "available_qualities": media["available_qualities"],
        "download_url": media["download_url"],
        "preview_ready": media["preview_ready"],
    }


def _resolve_creation_audio_media(
    *,
    audio_url: str | None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, str | bool | None]:
    media = build_audio_media_fields(
        file_url=audio_url,
        metadata=metadata,
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )
    return {
        "preview_url": media["preview_url"],
        "download_url": media["download_url"],
        "preview_ready": media["preview_ready"],
    }


def _asset_to_image_card(asset: Asset) -> CreationImageCard:
    metadata = asset.metadata_json or {}
    reference_images = _resolve_reference_images(metadata)
    ratio = _resolve_aspect_ratio(metadata, asset.size)
    resolution = _resolve_resolution(metadata, asset.size)
    created_at = asset.created_at.isoformat()
    media = _resolve_creation_image_media(
        thumbnail_url=asset.thumbnail_url,
        original_url=asset.file_url,
        metadata=metadata,
        user_id=str(asset.user_id),
        project_id=str(asset.project_id) if asset.project_id else None,
        resource_id=str(asset.id),
    )
    session_id = str(metadata.get("session_id")) if metadata.get("session_id") else None
    shot_id = str(metadata.get("shot_id")) if metadata.get("shot_id") else None

    return CreationImageCard(
        id=str(asset.id),
        asset_id=str(asset.id),
        name=asset.name,
        category=asset.category,
        thumbnail_url=media["thumbnail_url"],
        thumbnailUrl=media["thumbnail_url"],
        preview_url=media["preview_url"],
        previewUrl=media["preview_url"],
        large_url=media["large_url"],
        largeUrl=media["largeUrl"],
        original_url=asset.file_url,
        originalUrl=asset.file_url,
        download_url=media["download_url"],
        downloadUrl=media["download_url"],
        aspect_ratio=ratio,
        aspectRatio=ratio,
        resolution=resolution,
        model=asset.model,
        prompt=asset.prompt,
        reference_images=reference_images,
        referenceImages=reference_images,
        session_id=session_id,
        sessionId=session_id,
        shot_id=shot_id,
        shotId=shot_id,
        created_at=created_at,
        createdAt=created_at,
        is_liked=asset.is_starred,
        isLiked=asset.is_starred,
        is_owner=True,
        isOwner=True,
        source=metadata.get("source"),
        metadata_json=metadata,
        preview_ready=media["preview_ready"],
        previewReady=media["preview_ready"],
    )


def _task_result_to_image_card(task: GenTask, result: dict) -> CreationImageCard:
    params = task.params or {}
    fallback_url = str(result.get("url") or "")
    fallback_id = str(result.get("asset_id") or f"{task.id}:{result.get('index', 0)}")
    media = _resolve_creation_image_media(
        thumbnail_url=result.get("thumbnail_url") or result.get("thumbnailUrl"),
        original_url=fallback_url,
        metadata=params,
        user_id=str(task.user_id),
        project_id=str(params.get("project_id")) if params.get("project_id") else None,
        resource_id=str(result.get("asset_id") or fallback_id),
    )
    reference_images = _resolve_reference_images(params)
    ratio = _resolve_aspect_ratio(params, task.size)
    resolution = _resolve_resolution(params, task.size)
    created_at = task.updated_at.isoformat()
    session_id = str(params.get("session_id")) if params.get("session_id") else None
    shot_id = str(params.get("shot_id")) if params.get("shot_id") else None

    return CreationImageCard(
        id=fallback_id,
        asset_id=str(result.get("asset_id")) if result.get("asset_id") else None,
        name=str(params.get("asset_name") or "创作图片"),
        category=str(params.get("category") or "reference"),
        thumbnail_url=media["thumbnail_url"],
        thumbnailUrl=media["thumbnail_url"],
        preview_url=media["preview_url"],
        previewUrl=media["preview_url"],
        large_url=media["large_url"],
        largeUrl=media["largeUrl"],
        original_url=fallback_url,
        originalUrl=fallback_url,
        download_url=media["download_url"],
        downloadUrl=media["download_url"],
        aspect_ratio=ratio,
        aspectRatio=ratio,
        resolution=resolution,
        model=task.model,
        prompt=str(params.get("prompt") or ""),
        reference_images=reference_images,
        referenceImages=reference_images,
        session_id=session_id,
        sessionId=session_id,
        shot_id=shot_id,
        shotId=shot_id,
        created_at=created_at,
        createdAt=created_at,
        is_liked=False,
        isLiked=False,
        is_owner=True,
        isOwner=True,
        source=str(params.get("source") or "creation_image"),
        metadata_json={
            "task_id": str(task.id),
            "source": params.get("source") or "creation_image",
            "session_id": session_id,
            "shot_id": shot_id,
            "aspect_ratio": ratio,
            "ratio": ratio,
            "resolution": resolution,
            "reference_images": reference_images,
            "referenceImages": reference_images,
        },
        preview_ready=media["preview_ready"],
        previewReady=media["preview_ready"],
    )


def _asset_to_audio_card(asset: Asset) -> CreationAudioCard:
    metadata = asset.metadata_json or {}
    media = _resolve_creation_audio_media(
        audio_url=asset.file_url,
        metadata=metadata,
        user_id=str(asset.user_id),
        project_id=str(asset.project_id) if asset.project_id else None,
        resource_id=str(asset.id),
    )
    return CreationAudioCard(
        id=str(asset.id),
        asset_id=str(asset.id),
        name=asset.name,
        audio_url=asset.file_url,
        preview_url=media["preview_url"],
        previewUrl=media["preview_url"],
        download_url=media["download_url"],
        downloadUrl=media["download_url"],
        duration=_coerce_float(metadata.get("duration")),
        is_favorite=asset.is_starred or False,
        created_at=asset.created_at.isoformat(),
        metadata_json=metadata,
        preview_ready=media["preview_ready"],
        previewReady=media["preview_ready"],
    )


async def _resolve_creation_audio_voice_context(
    *,
    db: AsyncSession,
    user: User,
    requested_voice_id: str,
) -> dict[str, Any]:
    return await resolve_audio_voice_context(
        db=db,
        user=user,
        requested_voice_id=requested_voice_id,
    )


async def _resolve_creation_audio_reference_voice_binding(
    *,
    db: AsyncSession,
    user: User,
    reference_audio_url: str | None,
) -> dict[str, Any] | None:
    safe_reference_audio_url = str(reference_audio_url or "").strip()
    if not safe_reference_audio_url:
        return None

    clip_result = await db.execute(
        select(AudioClip).where(
            AudioClip.user_id == user.id,
            AudioClip.source == "creation",
            AudioClip.audio_url == safe_reference_audio_url,
        )
        .order_by(AudioClip.created_at.desc(), AudioClip.id.desc())
        .limit(1)
    )
    clip = clip_result.scalars().first()
    asset: Asset | None = None

    if clip:
        asset_map = await _load_creation_audio_asset_map(db, user.id, [clip], include_deleted=True)
        asset = asset_map.get(str(clip.id))
    else:
        asset_result = await db.execute(
            apply_asset_visibility(
                select(Asset).where(
                    Asset.user_id == user.id,
                    Asset.asset_type == "audio",
                    Asset.metadata_json["source"].as_string() == "creation_audio",
                    Asset.file_url == safe_reference_audio_url,
                ),
                include_deleted=True,
            )
            .order_by(Asset.created_at.desc(), Asset.id.desc())
            .limit(1)
        )
        asset = asset_result.scalars().first()
        clip_id = str((asset.metadata_json or {}).get("clip_id") or "").strip() if asset else ""
        if clip_id:
            try:
                clip_lookup = await db.execute(
                    select(AudioClip).where(
                        AudioClip.id == UUID(clip_id),
                        AudioClip.user_id == user.id,
                        AudioClip.source == "creation",
                    )
                )
                clip = clip_lookup.scalars().first()
            except Exception:
                clip = None

    metadata = dict(asset.metadata_json or {}) if asset else {}
    resolved_voice_id = (
        str(metadata.get("voice_id") or "").strip()
        or str(metadata.get("provider_voice_id") or "").strip()
        or (str(clip.voice_id).strip() if clip and clip.voice_id else "")
    )
    resolved_voice_name = (
        str(metadata.get("voice_name") or "").strip()
        or (str(clip.voice_id).strip() if clip and clip.voice_id else "")
    )

    return {
        "reference_audio_url": safe_reference_audio_url,
        "voice_id": resolved_voice_id or None,
        "voice_name": resolved_voice_name or None,
        "clip_id": str(clip.id) if clip else str(metadata.get("clip_id") or "") or None,
        "asset_id": str(asset.id) if asset else None,
    }


def _build_creation_audio_response(
    *,
    clip: AudioClip,
    asset: Asset,
    project_id: UUID | None,
    voice_name: str,
) -> dict[str, Any]:
    media = _resolve_creation_audio_media(
        audio_url=clip.audio_url,
        metadata=asset.metadata_json or {},
        user_id=str(asset.user_id),
        project_id=str(asset.project_id) if asset.project_id else None,
        resource_id=str(asset.id),
    )
    return {
        "id": str(clip.id),
        "asset_id": str(asset.id),
        "project_id": str(project_id) if project_id else None,
        "name": asset.name,
        "text": clip.text,
        "prompt": asset.prompt,
        "voice_id": clip.voice_id,
        "voice_name": voice_name,
        "audio_url": clip.audio_url,
        "preview_url": media["preview_url"],
        "download_url": media["download_url"],
        "preview_ready": media["preview_ready"],
        "duration": clip.duration,
        "speed": clip.speed,
        "emotion": clip.emotion,
        "is_favorite": clip.is_favorite,
        "model": asset.model,
        "metadata_json": asset.metadata_json,
        "created_at": clip.created_at.isoformat(),
    }


async def _create_creation_audio_records(
    *,
    db: AsyncSession,
    user: User,
    project_id: UUID | None,
    session_id: str | None,
    shot_id: str | None,
    text: str,
    requested_voice_id: str,
    voice_name: str,
    speed: float,
    emotion: str | None,
    audio_url: str,
    duration: float,
    model_id: str | None,
    provider_type: str,
    provider_options: dict[str, Any] | None,
    tts_metadata: dict[str, Any] | None,
    voice_context: dict[str, Any],
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clip = AudioClip(
        user_id=user.id,
        project_id=project_id,
        text=text,
        voice_id=requested_voice_id,
        audio_url=audio_url,
        duration=duration,
        speed=speed,
        emotion=emotion,
        source="creation",
        is_favorite=False,
    )
    db.add(clip)
    await db.flush()

    metadata_json = {
        "source": "creation_audio",
        "clip_id": str(clip.id),
        "session_id": session_id,
        "shot_id": shot_id,
        "project_id": str(project_id) if project_id else None,
        "model": model_id,
        "provider_type": provider_type,
        "voice_id": requested_voice_id,
        "voice_name": voice_name,
        "speed": speed,
        "emotion": emotion,
        "text": text,
        "text_preview": text[:100],
        "duration": duration,
        "tts_metadata": tts_metadata,
        "tts_request_options": provider_options,
        "voice_origin": voice_context["voice_origin"],
        "voice_db_id": str(voice_context["voice"].id) if voice_context.get("voice") else None,
        "provider_voice_id": voice_context.get("upstream_voice_id"),
        "clone_status_snapshot": voice_context.get("clone_status"),
    }
    if extra_metadata:
        metadata_json.update(extra_metadata)

    asset = Asset(
        user_id=user.id,
        project_id=project_id,
        name=f"配音-{voice_name}",
        asset_type="audio",
        category="audio",
        file_url=audio_url,
        prompt=text,
        thumbnail_url=None,
        model=model_id,
        metadata_json=metadata_json,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(clip)
    await db.refresh(asset)
    return _build_creation_audio_response(
        clip=clip,
        asset=asset,
        project_id=project_id,
        voice_name=voice_name,
    )


def _guess_creation_audio_extension(content_type: str | None) -> str:
    normalized = str(content_type or "").split(";", 1)[0].strip().lower()
    return {
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/wave": ".wav",
        "audio/mp4": ".m4a",
        "audio/x-m4a": ".m4a",
        "audio/aac": ".aac",
    }.get(normalized, ".mp3")


def _persist_creation_audio_bytes(content: bytes, content_type: str | None) -> str:
    upload_dir = resolve_upload_dir("creation/audio")
    extension = _guess_creation_audio_extension(content_type)
    filename = f"{uuid4().hex}{extension}"
    file_path = upload_dir / filename
    file_path.write_bytes(content)
    return build_upload_url("creation/audio", filename)


def _build_creation_audio_task_error(task: GenTask) -> str | None:
    if task.status != "failed":
        return None
    if task.results:
        first_item = task.results[0] or {}
        if first_item.get("error"):
            return str(first_item.get("error"))
    params = task.params or {}
    if params.get("provider_status") == "expired":
        return "异步音频结果已过期，请重新生成"
    return params.get("error_msg")


async def _build_creation_audio_task_status(task: GenTask, db: AsyncSession) -> CreationAudioTaskStatusResponse:
    progress = 0
    if task.status in {"running", "processing"}:
        progress = 50
    elif task.status in {"completed", "partial", "failed"}:
        progress = 100

    audio_card = None
    if task.status == "completed" and task.results:
        asset_id = task.results[0].get("asset_id") if task.results else None
        if asset_id:
            asset_result = await db.execute(
                apply_asset_visibility(select(Asset).where(Asset.id == UUID(asset_id)))
            )
            asset = asset_result.scalar_one_or_none()
            if asset:
                audio_card = _asset_to_audio_card(asset)

    error_msg = _build_creation_audio_task_error(task)
    return CreationAudioTaskStatusResponse(
        task_id=str(task.id),
        taskId=str(task.id),
        status=task.status,
        progress=progress,
        result=audio_card,
        error_msg=error_msg,
        errorMsg=error_msg,
    )


async def _build_task_image_cards(task: GenTask, db: AsyncSession) -> list[CreationImageCard]:
    result_items = task.results or []
    asset_ids = [
        UUID(item["asset_id"])
        for item in result_items
        if item.get("success") and item.get("asset_id")
    ]
    asset_map: dict[str, Asset] = {}
    if asset_ids:
        asset_result = await db.execute(
            apply_asset_visibility(select(Asset).where(Asset.id.in_(asset_ids)))
        )
        asset_map = {str(asset.id): asset for asset in asset_result.scalars().all()}

    image_cards: list[CreationImageCard] = []
    for item in result_items:
        if not item.get("success"):
            continue
        asset_id = str(item.get("asset_id")) if item.get("asset_id") else None
        if asset_id and asset_id in asset_map:
            image_cards.append(_asset_to_image_card(asset_map[asset_id]))
        elif item.get("url"):
            image_cards.append(_task_result_to_image_card(task, item))

    return image_cards


async def _get_creation_image_asset(
    asset_id: str,
    user: User,
    db: AsyncSession,
) -> Asset:
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id == UUID(asset_id),
                Asset.user_id == user.id,
                Asset.asset_type == "image",
            )
        )
    )
    asset = result.scalar_one_or_none()
    if not asset or not _is_creation_managed_image(asset):
        raise HTTPException(status_code=404, detail="图片不存在")
    return asset


async def _get_creation_video_asset(
    asset_id: str,
    user: User,
    db: AsyncSession,
) -> Asset:
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id == UUID(asset_id),
                Asset.user_id == user.id,
                Asset.asset_type == "video",
            )
        )
    )
    asset = result.scalar_one_or_none()
    if not asset or not _is_creation_managed_video(asset):
        raise HTTPException(status_code=404, detail="视频不存在")
    return asset


async def _cleanup_image_binding(asset: Asset, user: User, db: AsyncSession) -> None:
    metadata = asset.metadata_json or {}
    shot_id = metadata.get("shot_id")
    if not shot_id:
        return

    shot = await _get_shot(str(shot_id), user, db)
    changed = False
    if shot.image_url == asset.file_url:
        shot.image_url = None
        changed = True

    references = [url for url in (shot.reference_image_urls or []) if url != asset.file_url]
    if references != (shot.reference_image_urls or []):
        shot.reference_image_urls = references or None
        changed = True

    if changed:
        _merge_shot_metadata(
            shot,
            {
                "last_removed_image_asset_id": str(asset.id),
            },
        )


async def _delete_asset_files_if_orphan(asset: Asset, db: AsyncSession) -> None:
    urls_to_check = {
        url
        for url in [asset.file_url, asset.thumbnail_url, *(asset.reference_image_urls or [])]
        if is_managed_upload_url(url)
    }
    if not urls_to_check:
        return

    for url in urls_to_check:
        await delete_managed_upload_if_unreferenced(
            db,
            url,
            excluding_asset_id=asset.id,
        )


async def _resolve_and_create_image_task(
    *,
    req: CreationImageGenerateRequest,
    user: User,
    db: AsyncSession,
    session: CreationSession | None = None,
    shot: CreationShot | None = None,
    project: Project | None = None,
    prompt: str | None = None,
    category: str | None = None,
    asset_name: str | None = None,
    source: str | None = None,
) -> dict[str, Any]:
    """解析模型/参数并创建 GenTask（pending）。返回 task 与全部解析后的字段，
    供后台异步任务与流式 SSE 路由共用。不负责派发后台任务。"""
    if (category or req.category) not in ALLOWED_IMAGE_CATEGORIES:
        raise HTTPException(status_code=422, detail="category 仅支持 character、scene、prop、storyboard、reference")

    requested_model = req.model or await _get_default_image_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="image",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    default_image_watermark = await _get_model_default_watermark(user.id, "image", model, db)
    watermark = resolve_optional_model_toggle(
        model_id=model,
        category="image",
        capability_key="supports_watermark_toggle",
        requested_value=req.watermark,
        default_value=default_image_watermark,
    )
    reference_images = _resolve_reference_images(req.model_dump())
    mentions = _resolve_prompt_mentions(req.model_dump())
    attachments = _resolve_asset_bindings(req.model_dump())
    prompt_raw, prompt_resolved, reference_images, mentions, attachments = _resolve_image_binding_context(
        prompt=prompt or req.prompt,
        prompt_raw=req.prompt_raw,
        prompt_resolved=req.prompt_resolved,
        reference_images=reference_images,
        mentions=mentions,
        attachments=attachments,
    )
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
        watermark=watermark,
    )
    aspect_ratio = validated["aspect_ratio"]
    resolution = validated["resolution"]
    count = validated["count"]
    reference_images = validated["reference_images"]
    resolved_size = validated["size"]

    task_source = source or ("creation_shot_image" if shot else "creation_image")
    task = GenTask(
        user_id=user.id,
        project_id=project.id if project else None,
        task_type=task_source,
        status="pending",
        total_count=count,
        model=model,
        size=resolved_size,
        params={
            "prompt": prompt or req.prompt,
            "prompt_raw": prompt_raw,
            "prompt_resolved": prompt_resolved,
            "asset_name": asset_name or req.asset_name,
            "category": category or req.category,
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
            "mentions": mentions,
            "attachments": attachments,
            "watermark": watermark,
            "session_id": str(session.id) if session else None,
            "shot_id": str(shot.id) if shot else None,
            "project_id": str(project.id) if project else None,
            "source": task_source,
            "output_format": req.output_format,
            "response_format": req.response_format,
            "web_search": req.web_search,
            "optimize_prompt": req.optimize_prompt,
            "sequential_image_generation": req.sequential_image_generation,
        },
        results=[],
    )
    db.add(task)
    try:
        await db.commit()
    except (IntegrityError, DataError) as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="创建生成任务失败：请确认数据库已执行最新迁移（gen_tasks.project_id 需允许为空，model 字段长度需>=200）",
        ) from exc
    await db.refresh(task)

    return {
        "task": task,
        "model": model,
        "watermark": watermark,
        "reference_images": reference_images,
        "mentions": mentions,
        "attachments": attachments,
        "prompt_raw": prompt_raw,
        "prompt_resolved": prompt_resolved,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "count": count,
        "resolved_size": resolved_size,
        "task_source": task_source,
        "category": category or req.category,
        "asset_name": asset_name or req.asset_name,
    }


async def _create_creation_image_task(
    *,
    req: CreationImageGenerateRequest,
    user: User,
    db: AsyncSession,
    session: CreationSession | None = None,
    shot: CreationShot | None = None,
    project: Project | None = None,
    prompt: str | None = None,
    category: str | None = None,
    asset_name: str | None = None,
    source: str | None = None,
) -> CreationTaskResponse:
    ctx = await _resolve_and_create_image_task(
        req=req,
        user=user,
        db=db,
        session=session,
        shot=shot,
        project=project,
        prompt=prompt,
        category=category,
        asset_name=asset_name,
        source=source,
    )
    task = ctx["task"]
    model = ctx["model"]
    watermark = ctx["watermark"]
    reference_images = ctx["reference_images"]
    mentions = ctx["mentions"]
    attachments = ctx["attachments"]
    prompt_raw = ctx["prompt_raw"]
    prompt_resolved = ctx["prompt_resolved"]
    aspect_ratio = ctx["aspect_ratio"]
    resolution = ctx["resolution"]
    count = ctx["count"]
    resolved_size = ctx["resolved_size"]
    task_source = ctx["task_source"]

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.creation:_run_creation_image_task",
        kwargs={
            "task_id": task.id,
            "user_id": user.id,
            "project_id": project.id if project else None,
            "session_id": session.id if session else None,
            "shot_id": shot.id if shot else None,
            "prompt": prompt or req.prompt,
            "prompt_raw": prompt_raw,
            "prompt_resolved": prompt_resolved,
            "model": model,
            "size": resolved_size,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "reference_images": reference_images,
            "mentions": mentions,
            "attachments": attachments,
            "watermark": watermark,
            "count": count,
            "asset_name": ctx["asset_name"],
            "category": ctx["category"],
            "save_to_assets": req.save_to_assets,
            "inherit_project_style": req.inherit_project_style,
            "source": task_source,
            "output_format": req.output_format,
            "response_format": req.response_format,
            "web_search": req.web_search,
            "optimize_prompt": req.optimize_prompt,
            "sequential_image_generation": req.sequential_image_generation,
        },
        name=f"gen-task:{task.id}:creation-image",
    )
    return _task_to_response(task)


async def _persist_one_creation_image(
    *,
    db: AsyncSession,
    url: str,
    index: int,
    user_id: UUID,
    project_id: UUID | None,
    session_id: UUID | None,
    shot_id: UUID | None,
    shot: CreationShot | None,
    final_prompt: str,
    prompt: str,
    prompt_raw: str,
    model: str,
    size: str,
    aspect_ratio: str | None,
    resolution: str | None,
    reference_images: list[str],
    mentions: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
    watermark: bool | None,
    inherit_project_style: bool,
    save_to_assets: bool,
    asset_name: str | None,
    category: str,
    source: str,
    task_id: UUID,
    count: int,
) -> dict:
    """落地单张创作图片：转存远端文件 → 派生缩略图/预览 → 可选建 Asset/更新镜头。

    返回 results 列表用的成功记录 dict。供非流式后台任务与流式 SSE 路由共用。
    """
    persisted_url = await persist_remote_file(
        url,
        _resolve_creation_subdir(session_id=session_id, shot_id=shot_id, kind="images"),
        fallback_extension=".png",
    )
    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        persisted_url,
        asset_type="image",
    )
    derived_preview_url, preview_metadata = _derive_asset_preview(persisted_url)
    object_storage_metadata: dict[str, Any] = {}
    try:
        object_storage_metadata = sync_managed_image_bundle_to_object_storage(
            source_url=persisted_url,
            preview_url=derived_preview_url,
            thumbnail_url=derived_thumbnail_url,
        )
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        logger.warning(
            "creation image object storage sync skipped task_id=%s index=%s url=%s detail=%s",
            task_id,
            index,
            persisted_url,
            exc,
        )

    asset_id = None
    if save_to_assets:
        base_name = asset_name or "创作图片"
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
                "source": source,
                "task_id": str(task_id),
                "sequence": index,
                "original_prompt": prompt,
                "prompt_raw": prompt_raw,
                "prompt_resolved": final_prompt,
                "inherit_project_style": inherit_project_style,
                "aspect_ratio": aspect_ratio,
                "ratio": aspect_ratio,
                "resolution": resolution,
                "reference_images": reference_images,
                "referenceImages": reference_images,
                "mentions": mentions,
                "asset_bindings": attachments,
                "watermark": watermark,
                "session_id": str(session_id) if session_id else None,
                "shot_id": str(shot_id) if shot_id else None,
                **derivative_metadata,
                **preview_metadata,
                **object_storage_metadata,
                "preview_url": derived_preview_url or persisted_url,
            },
        )
        db.add(asset)
        await db.flush()
        asset_id = str(asset.id)

        if shot and index == 1:
            shot.image_url = persisted_url
            shot.prompt = prompt
            if reference_images:
                shot.reference_image_urls = reference_images
            _merge_shot_metadata(
                shot,
                {
                    "last_image_asset_id": asset_id,
                    "last_image_task_id": str(task_id),
                    "last_image_model": model,
                },
            )

    return {
        "success": True,
        "index": index,
        "url": persisted_url,
        "asset_id": asset_id,
    }


async def _run_creation_image_task(
    *,
    task_id: UUID,
    user_id: UUID,
    project_id: UUID | None,
    session_id: UUID | None,
    shot_id: UUID | None,
    prompt: str,
    prompt_raw: str,
    prompt_resolved: str,
    model: str,
    size: str,
    aspect_ratio: str | None,
    resolution: str | None,
    reference_images: list[str],
    mentions: list[dict[str, Any]],
    attachments: list[dict[str, Any]],
    watermark: bool | None,
    count: int,
    asset_name: str | None,
    category: str,
    save_to_assets: bool,
    inherit_project_style: bool,
    source: str,
    output_format: str | None = None,
    response_format: str | None = None,
    web_search: bool | None = None,
    optimize_prompt: str | None = None,
    sequential_image_generation: str | None = None,
):
    async with async_session() as db:
        result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return

        task.status = "running"
        _update_creation_video_task_runtime_state(
            task,
            current_stage="queued",
            partial_ready=False,
            metadata_commit_status="pending",
        )
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
                "全局创作图片生成失败",
                "未配置图片模型对应服务商，请先在设置中配置",
                "/config",
            )
            return

        api_key, base_url, _, model, _, _ = provider_runtime
        project = None
        session = None
        shot = None
        if project_id:
            project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
        if session_id:
            session = (await db.execute(select(CreationSession).where(CreationSession.id == session_id))).scalar_one_or_none()
        if shot_id:
            shot = (await db.execute(select(CreationShot).where(CreationShot.id == shot_id))).scalar_one_or_none()

        final_prompt = prompt_resolved or prompt
        if inherit_project_style:
            final_prompt = await _apply_visual_style(final_prompt, session, project, user_id, db)

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
                watermark=watermark,
                output_format=output_format,
                response_format=response_format,
                web_search=bool(web_search),
                optimize_prompt_mode=optimize_prompt,
                sequential_image_generation=sequential_image_generation,
            )

            for index, url in enumerate(urls, start=1):
                result_record = await _persist_one_creation_image(
                    db=db,
                    url=url,
                    index=index,
                    user_id=user_id,
                    project_id=project_id,
                    session_id=session_id,
                    shot_id=shot_id,
                    shot=shot,
                    final_prompt=final_prompt,
                    prompt=prompt,
                    prompt_raw=prompt_raw,
                    model=model,
                    size=size,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    reference_images=reference_images,
                    mentions=mentions,
                    attachments=attachments,
                    watermark=watermark,
                    inherit_project_style=inherit_project_style,
                    save_to_assets=save_to_assets,
                    asset_name=asset_name,
                    category=category,
                    source=source,
                    task_id=task_id,
                    count=count,
                )
                results.append(result_record)
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
                "全局创作图片生成完成",
                f"成功生成 {task.success_count} 张图片",
                "/tasks",
            )
        elif task.status == "partial":
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "全局创作图片生成部分完成",
                f"成功 {task.success_count} 张，失败 {task.fail_count} 张",
                "/tasks",
            )
        else:
            await _create_notification(
                db,
                user_id,
                "creation_log",
                "全局创作图片生成失败",
                "任务执行失败，请检查模型配置、提示词和网络状态",
                "/tasks",
            )


def _validate_aspect_ratio(value: str | None) -> None:
    if value and value not in ALLOWED_ASPECT_RATIOS:
        raise HTTPException(status_code=422, detail="aspect_ratio 仅支持 16:9、9:16、1:1、4:3")


def _resolve_batch_asset_ids(req: CreationBatchImageRequest) -> list[str]:
    return [asset_id for asset_id in (req.asset_ids or req.ids or []) if asset_id]


@router.get(
    "/sessions",
    response_model=list[CreationSessionResponse],
    summary="获取创作会话列表",
    description="返回当前用户的创作会话列表，可按项目和状态过滤。",
    response_description="创作会话列表。",
)
async def list_creation_sessions(
    project_id: str | None = Query(None),
    status: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if project_id:
        await _get_owned_project(project_id, user, db)

    query = select(CreationSession).where(CreationSession.user_id == user.id)
    if project_id:
        query = query.where(CreationSession.project_id == UUID(project_id))
    if status:
        query = query.where(CreationSession.status == status)
    query = query.order_by(
        CreationSession.updated_at.desc(),
        CreationSession.created_at.desc(),
        CreationSession.id.desc(),
    )

    result = await db.execute(query)
    sessions = result.scalars().all()
    shot_counts = await _count_shots_by_session([session.id for session in sessions], db)
    return [_session_to_response(session, shot_counts.get(str(session.id), 0)) for session in sessions]


@router.post(
    "/sessions",
    response_model=CreationSessionResponse,
    status_code=201,
    summary="创建创作会话",
    description="创建一个新的创作会话，用于承载创作页的镜头和生成记录。",
    response_description="创建成功后的创作会话。",
)
async def create_creation_session(
    req: CreateSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_aspect_ratio(req.aspect_ratio)
    await _get_owned_project(req.project_id, user, db)

    session = CreationSession(
        user_id=user.id,
        project_id=UUID(req.project_id) if req.project_id else None,
        title=req.title,
        description=req.description,
        aspect_ratio=req.aspect_ratio,
        visual_style=req.visual_style,
        status=req.status,
        metadata_json=req.metadata_json,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _session_to_response(session)


@router.get(
    "/sessions/{session_id}",
    response_model=CreationSessionResponse,
    summary="获取创作会话详情",
    description="读取单个创作会话及其镜头数量。",
    response_description="创作会话详情。",
)
async def get_creation_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)
    shot_counts = await _count_shots_by_session([session.id], db)
    return _session_to_response(session, shot_counts.get(str(session.id), 0))


@router.patch(
    "/sessions/{session_id}",
    response_model=CreationSessionResponse,
    summary="更新创作会话",
    description="更新创作会话标题、描述、画幅比例、视觉风格、状态和归属项目。",
    response_description="更新后的创作会话。",
)
async def update_creation_session(
    session_id: str,
    req: UpdateSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)
    _validate_aspect_ratio(req.aspect_ratio)

    old_project_id = session.project_id
    if "title" in req.model_fields_set:
        session.title = req.title or session.title
    if "description" in req.model_fields_set:
        session.description = req.description
    if "aspect_ratio" in req.model_fields_set and req.aspect_ratio:
        session.aspect_ratio = req.aspect_ratio
    if "visual_style" in req.model_fields_set:
        session.visual_style = req.visual_style
    if "status" in req.model_fields_set and req.status:
        session.status = req.status
    if "metadata_json" in req.model_fields_set:
        session.metadata_json = req.metadata_json
    if "project_id" in req.model_fields_set:
        await _get_owned_project(req.project_id, user, db)
        session.project_id = UUID(req.project_id) if req.project_id else None

    await db.flush()
    if "project_id" in req.model_fields_set and session.project_id != old_project_id:
        await db.execute(
            update(CreationShot)
            .where(CreationShot.session_id == session.id)
            .values(project_id=session.project_id)
        )

    await db.commit()
    await db.refresh(session)
    shot_counts = await _count_shots_by_session([session.id], db)
    return _session_to_response(session, shot_counts.get(str(session.id), 0))


@router.delete(
    "/sessions/{session_id}",
    summary="删除创作会话",
    description="删除指定创作会话。",
    response_description="删除结果。",
)
async def delete_creation_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)
    await db.delete(session)
    await db.commit()
    return {"message": "已删除创作会话"}


@router.get(
    "/sessions/{session_id}/shots",
    response_model=list[CreationShotResponse],
    summary="获取创作镜头列表",
    description="返回指定创作会话下的镜头列表，按排序值和镜头号升序返回。",
    response_description="创作镜头列表。",
)
async def list_creation_shots(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)
    result = await db.execute(
        select(CreationShot)
        .where(CreationShot.session_id == session.id)
        .order_by(
            CreationShot.sort_order.asc(),
            CreationShot.shot_number.asc(),
            CreationShot.created_at.asc(),
            CreationShot.id.asc(),
        )
    )
    return [_shot_to_response(shot) for shot in result.scalars().all()]


@router.post(
    "/sessions/{session_id}/shots",
    response_model=CreationShotResponse,
    status_code=201,
    summary="创建创作镜头",
    description="在指定创作会话下新建镜头，可同时写入初始媒体地址和参考图。",
    response_description="创建成功后的创作镜头。",
)
async def create_creation_shot(
    session_id: str,
    req: CreateShotRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)

    resolved_project_id = req.project_id
    if resolved_project_id and session.project_id and UUID(resolved_project_id) != session.project_id:
        raise HTTPException(status_code=400, detail="镜头 project_id 需与所属会话保持一致")
    if not resolved_project_id and session.project_id:
        resolved_project_id = str(session.project_id)

    await _get_owned_project(resolved_project_id, user, db)

    initial_metadata = dict(req.metadata_json or {})
    shot = CreationShot(
        session_id=session.id,
        project_id=UUID(resolved_project_id) if resolved_project_id else None,
        shot_number=req.shot_number or await _resolve_next_shot_number(session.id, db),
        title=req.title,
        content=req.content,
        shot_type=req.shot_type,
        camera=req.camera,
        camera_angle=req.camera_angle,
        composition=req.composition,
        duration=req.duration,
        prompt=req.prompt,
        image_url=None,
        audio_url=None,
        video_url=None,
        reference_image_urls=None,
        metadata_json=initial_metadata or None,
        sort_order=req.sort_order if req.sort_order is not None else await _resolve_next_sort_order(session.id, db),
    )
    db.add(shot)
    await db.flush()

    await _sync_creation_shot_media_field(db, user_id=user.id, shot=shot, field_name="image_url", raw_url=req.image_url)
    await _sync_creation_shot_media_field(db, user_id=user.id, shot=shot, field_name="audio_url", raw_url=req.audio_url)
    await _sync_creation_shot_media_field(db, user_id=user.id, shot=shot, field_name="video_url", raw_url=req.video_url)
    await _sync_creation_shot_reference_images(db, shot=shot, raw_urls=req.reference_image_urls)

    await db.commit()
    await db.refresh(shot)
    return _shot_to_response(shot)


@router.get(
    "/shots/{shot_id}",
    response_model=CreationShotResponse,
    summary="获取创作镜头详情",
    description="读取单个创作镜头详情。",
    response_description="创作镜头详情。",
)
async def get_creation_shot(
    shot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    return _shot_to_response(shot)


@router.patch(
    "/shots/{shot_id}",
    response_model=CreationShotResponse,
    summary="更新创作镜头",
    description="更新创作镜头的文本、镜头语言、媒体字段、参考图或排序信息。",
    response_description="更新后的创作镜头。",
)
async def update_creation_shot(
    shot_id: str,
    req: UpdateShotRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    session = await _get_session(str(shot.session_id), user, db)

    if "project_id" in req.model_fields_set:
        resolved_project_id = req.project_id
        if resolved_project_id and session.project_id and UUID(resolved_project_id) != session.project_id:
            raise HTTPException(status_code=400, detail="镜头 project_id 需与所属会话保持一致")
        await _get_owned_project(resolved_project_id, user, db)
        shot.project_id = UUID(resolved_project_id) if resolved_project_id else None

    if "shot_number" in req.model_fields_set and req.shot_number is not None:
        shot.shot_number = req.shot_number
    if "title" in req.model_fields_set:
        shot.title = req.title
    if "content" in req.model_fields_set:
        shot.content = req.content
    if "shot_type" in req.model_fields_set:
        shot.shot_type = req.shot_type
    if "camera" in req.model_fields_set:
        shot.camera = req.camera
    if "camera_angle" in req.model_fields_set:
        shot.camera_angle = req.camera_angle
    if "composition" in req.model_fields_set:
        shot.composition = req.composition
    if "duration" in req.model_fields_set:
        shot.duration = req.duration
    if "prompt" in req.model_fields_set:
        shot.prompt = req.prompt
    if "image_url" in req.model_fields_set:
        await _sync_creation_shot_media_field(
            db,
            user_id=user.id,
            shot=shot,
            field_name="image_url",
            raw_url=req.image_url,
        )
    if "audio_url" in req.model_fields_set:
        await _sync_creation_shot_media_field(
            db,
            user_id=user.id,
            shot=shot,
            field_name="audio_url",
            raw_url=req.audio_url,
        )
    if "video_url" in req.model_fields_set:
        await _sync_creation_shot_media_field(
            db,
            user_id=user.id,
            shot=shot,
            field_name="video_url",
            raw_url=req.video_url,
        )
    if "reference_image_urls" in req.model_fields_set:
        await _sync_creation_shot_reference_images(
            db,
            shot=shot,
            raw_urls=req.reference_image_urls,
        )
    if "metadata_json" in req.model_fields_set:
        shot.metadata_json = req.metadata_json
    if "sort_order" in req.model_fields_set and req.sort_order is not None:
        shot.sort_order = req.sort_order

    await db.commit()
    await db.refresh(shot)
    return _shot_to_response(shot)


@router.post(
    "/sessions/{session_id}/shots/reorder",
    response_model=list[CreationShotResponse],
    summary="重排创作镜头",
    description="按前端提交的镜头 ID 顺序重排指定创作会话内的镜头。",
    response_description="重排后的创作镜头列表。",
)
async def reorder_creation_shots(
    session_id: str,
    req: ReorderShotsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session(session_id, user, db)
    result = await db.execute(
        select(CreationShot)
        .where(CreationShot.session_id == session.id)
        .order_by(
            CreationShot.sort_order.asc(),
            CreationShot.shot_number.asc(),
            CreationShot.created_at.asc(),
            CreationShot.id.asc(),
        )
    )
    shots = result.scalars().all()
    shot_map = {str(shot.id): shot for shot in shots}

    ordered_ids = []
    seen_ids: set[str] = set()
    for shot_id in req.shot_ids:
        if shot_id not in shot_map:
            raise HTTPException(status_code=404, detail=f"镜头不存在: {shot_id}")
        if shot_id not in seen_ids:
            seen_ids.add(shot_id)
            ordered_ids.append(shot_id)
    for shot in shots:
        shot_id = str(shot.id)
        if shot_id not in seen_ids:
            ordered_ids.append(shot_id)

    for index, shot_id in enumerate(ordered_ids, start=1):
        shot_map[shot_id].sort_order = index

    await db.commit()
    refreshed = await db.execute(
        select(CreationShot)
        .where(CreationShot.session_id == session.id)
        .order_by(
            CreationShot.sort_order.asc(),
            CreationShot.shot_number.asc(),
            CreationShot.created_at.asc(),
            CreationShot.id.asc(),
        )
    )
    return [_shot_to_response(shot) for shot in refreshed.scalars().all()]


@router.delete(
    "/shots/{shot_id}",
    summary="删除创作镜头",
    description="删除指定创作镜头，并清理它独占引用的上传素材。",
    response_description="删除结果。",
)
async def delete_creation_shot(
    shot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    for field_name in CREATION_SHOT_IMPORT_CONFIG:
        await _delete_creation_shot_import_asset(
            db,
            user_id=user.id,
            shot=shot,
            field_name=field_name,
        )
    for url in shot.reference_image_urls or []:
        await delete_managed_upload_if_unreferenced(
            db,
            url,
            excluding_creation_shot_id=shot.id,
        )
    await db.delete(shot)
    await db.commit()
    return {"message": "已删除创作镜头"}


@router.get(
    "/images",
    response_model=CreationImageListResponse,
    summary="获取创作图片列表",
    description="按分类、搜索词、收藏状态、来源、会话或镜头范围查询创作图片资产。",
    response_description="创作图片列表。",
)
async def list_creation_images(
    category: str | None = Query(None),
    search: str | None = Query(None),
    is_liked: bool | None = Query(None),
    sources: str | None = Query(None),
    include_all: bool = Query(False),
    session_id: str | None = Query(None),
    shot_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(CREATION_LIST_DEFAULT_PAGE_SIZE, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if session_id or shot_id:
        await _resolve_creation_scope(user=user, db=db, session_id=session_id, shot_id=shot_id)

    requested_sources = _normalize_requested_image_sources(sources)
    image_query = apply_asset_visibility(
        select(Asset).where(Asset.user_id == user.id, Asset.asset_type == "image")
    )
    count_query = apply_asset_visibility(
        select(sa_func.count()).select_from(Asset).where(
            Asset.user_id == user.id,
            Asset.asset_type == "image",
        )
    )

    source_condition = _build_creation_image_source_condition(
        requested_sources=requested_sources,
        include_all=include_all,
    )
    if source_condition is not None:
        image_query = image_query.where(source_condition)
        count_query = count_query.where(source_condition)

    if session_id:
        session_condition = Asset.metadata_json["session_id"].as_string() == session_id
        image_query = image_query.where(session_condition)
        count_query = count_query.where(session_condition)
    if shot_id:
        shot_condition = Asset.metadata_json["shot_id"].as_string() == shot_id
        image_query = image_query.where(shot_condition)
        count_query = count_query.where(shot_condition)
    if category:
        image_query = image_query.where(Asset.category == category)
        count_query = count_query.where(Asset.category == category)
    if is_liked is not None:
        image_query = image_query.where(Asset.is_starred == is_liked)
        count_query = count_query.where(Asset.is_starred == is_liked)
    if search:
        normalized_search = search.strip()
        if normalized_search:
            search_condition = or_(
                Asset.name.ilike(f"%{normalized_search}%"),
                Asset.prompt.ilike(f"%{normalized_search}%"),
            )
            image_query = image_query.where(search_condition)
            count_query = count_query.where(search_condition)

    offset = (page - 1) * page_size
    image_query = image_query.order_by(Asset.created_at.desc(), Asset.id.desc()).limit(page_size).offset(offset)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(image_query)
    page_assets = result.scalars().all()
    has_more = offset + len(page_assets) < total

    return CreationImageListResponse(
        list=[_asset_to_image_card(asset) for asset in page_assets],
        total=total,
        has_more=has_more,
        hasMore=has_more,
        page=page,
        page_size=page_size,
        pageSize=page_size,
    )


@router.post(
    "/images/upload",
    response_model=CreationImageUploadResponse,
    status_code=201,
    summary="上传创作图片",
    description="上传一张创作图片到参考资产库，可选绑定到创作会话或创作镜头。",
    response_description="上传后的图片信息。",
)
async def upload_creation_image(
    file: UploadFile = File(..., description="创作图片文件。"),
    category: str = Query("reference"),
    asset_name: str | None = Query(None, max_length=200),
    session_id: str | None = Query(None),
    shot_id: str | None = Query(None),
    project_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if category not in ALLOWED_IMAGE_CATEGORIES:
        raise HTTPException(status_code=422, detail="category 仅支持 character、scene、prop、storyboard、reference")

    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=session_id,
        shot_id=shot_id,
        project_id=project_id,
    )

    try:
        file_url = await persist_uploaded_file(
            file,
            _resolve_creation_subdir(
                session_id=session.id if session else None,
                shot_id=shot.id if shot else None,
                kind="uploads",
            ),
            allowed_extensions=IMAGE_ALLOWED_EXTENSIONS,
            allowed_content_types=IMAGE_ALLOWED_CONTENT_TYPES,
            max_size=MAX_CREATION_IMAGE_SIZE,
            fallback_extension=".png",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or "上传图片"
    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        file_url,
        asset_type="image",
    )
    derived_preview_url, preview_metadata = _derive_asset_preview(file_url)
    asset = Asset(
        user_id=user.id,
        project_id=project.id if project else None,
        name=asset_name or Path(original_filename).stem or "创作参考图",
        asset_type="image",
        category=category,
        file_url=file_url,
        thumbnail_url=derived_thumbnail_url,
        metadata_json=build_managed_storage_metadata(
            import_source="user_upload",
            extra={
                "source": "creation_upload",
                "uploaded_via": "creation",
                "original_filename": original_filename,
                "session_id": str(session.id) if session else None,
                "shot_id": str(shot.id) if shot else None,
                **derivative_metadata,
                **preview_metadata,
                "preview_url": derived_preview_url or file_url,
            },
        ),
    )
    db.add(asset)
    await db.flush()

    if shot:
        shot.image_url = file_url
        _merge_shot_metadata(
            shot,
            {
                "last_uploaded_image_asset_id": str(asset.id),
            },
        )

    await db.commit()
    await db.refresh(asset)

    return CreationImageUploadResponse(
        asset_id=str(asset.id),
        file_id=str(asset.id),
        fileId=str(asset.id),
        uploaded_url=file_url,
        uploadedUrl=file_url,
        image=_asset_to_image_card(asset),
    )


@router.post(
    "/videos/upload",
    response_model=CreationVideoUploadResponse,
    status_code=201,
    summary="上传创作参考视频",
    description="上传一段参考视频到创作资产库，可选绑定到创作会话或创作镜头。",
    response_description="上传后的参考视频信息。",
)
async def upload_creation_video(
    file: UploadFile = File(..., description="参考视频文件。"),
    category: str = Query("reference"),
    asset_name: str | None = Query(None, max_length=200),
    session_id: str | None = Query(None),
    shot_id: str | None = Query(None),
    project_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if category != "reference":
        raise HTTPException(status_code=422, detail="参考视频上传 category 仅支持 reference")

    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=session_id,
        shot_id=shot_id,
        project_id=project_id,
    )

    try:
        file_url = await persist_uploaded_file(
            file,
            _resolve_creation_subdir(
                session_id=session.id if session else None,
                shot_id=shot.id if shot else None,
                kind="uploads",
            ),
            allowed_extensions=VIDEO_ALLOWED_EXTENSIONS,
            allowed_content_types=VIDEO_ALLOWED_CONTENT_TYPES,
            max_size=MAX_CREATION_VIDEO_SIZE,
            fallback_extension=".mp4",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or "上传视频"
    thumbnail_url = None
    derivative_metadata = {}
    try:
        thumbnail_url, derivative_metadata = await _derive_video_thumbnail_from_first_frame(file_url)
    except (FileNotFoundError, ValueError, RuntimeError):
        thumbnail_url = None
        derivative_metadata = {}
    asset = Asset(
        user_id=user.id,
        project_id=project.id if project else None,
        name=asset_name or Path(original_filename).stem or "创作参考视频",
        asset_type="video",
        category=category,
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        metadata_json=build_managed_storage_metadata(
            import_source="user_upload",
            extra={
                "source": "creation_upload",
                "uploaded_via": "creation",
                "original_filename": original_filename,
                "session_id": str(session.id) if session else None,
                "shot_id": str(shot.id) if shot else None,
                "reference_mode": "upload",
                **derivative_metadata,
            },
        ),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return CreationVideoUploadResponse(
        asset_id=str(asset.id),
        file_id=str(asset.id),
        fileId=str(asset.id),
        uploaded_url=file_url,
        uploadedUrl=file_url,
        video=await _asset_to_video_card(asset, db),
    )


@router.post(
    "/audios/upload",
    response_model=CreationAudioUploadResponse,
    status_code=201,
    summary="上传创作参考音频",
    description="上传一段参考音频到创作资产库，可选绑定到创作会话或创作镜头。",
    response_description="上传后的参考音频信息。",
)
async def upload_creation_audio(
    file: UploadFile = File(..., description="参考音频文件。"),
    category: str = Query("reference"),
    asset_name: str | None = Query(None, max_length=200),
    session_id: str | None = Query(None),
    shot_id: str | None = Query(None),
    project_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if category != "reference":
        raise HTTPException(status_code=422, detail="参考音频上传 category 仅支持 reference")

    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=session_id,
        shot_id=shot_id,
        project_id=project_id,
    )

    try:
        file_url = await persist_uploaded_file(
            file,
            _resolve_creation_subdir(
                session_id=session.id if session else None,
                shot_id=shot.id if shot else None,
                kind="uploads",
            ),
            allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
            allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
            max_size=MAX_CREATION_AUDIO_SIZE,
            fallback_extension=".mp3",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or "上传音频"
    audio_duration: float | None = None
    try:
        audio_duration = await probe_reference_audio_duration(file_url)
    except MissingBinaryError:
        audio_duration = None
    except Exception as exc:
        logger.warning("Failed to probe uploaded creation audio duration: %s", exc)
        audio_duration = None

    extra_metadata = {
        "source": "creation_upload",
        "uploaded_via": "creation",
        "original_filename": original_filename,
        "session_id": str(session.id) if session else None,
        "shot_id": str(shot.id) if shot else None,
    }
    if audio_duration:
        extra_metadata["duration"] = audio_duration
    asset = Asset(
        user_id=user.id,
        project_id=project.id if project else None,
        name=asset_name or Path(original_filename).stem or "创作参考音频",
        asset_type="audio",
        category=category,
        file_url=file_url,
        thumbnail_url=None,
        metadata_json=build_managed_storage_metadata(
            import_source="user_upload",
            extra=extra_metadata,
        ),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return CreationAudioUploadResponse(
        asset_id=str(asset.id),
        file_id=str(asset.id),
        fileId=str(asset.id),
        uploaded_url=file_url,
        uploadedUrl=file_url,
        audio=_asset_to_audio_card(asset),
    )


@router.post(
    "/images/generate",
    response_model=CreationTaskResponse,
    status_code=201,
    summary="创建创作图片生成任务",
    description="在创作页发起通用图片生成任务。结果通过 `/tasks/{task_id}` 轮询获取。",
    response_description="图片生成任务。",
)
async def generate_creation_images(
    req: CreationImageGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=req.session_id,
        shot_id=req.shot_id,
        project_id=req.project_id,
    )
    return await _create_creation_image_task(
        req=req,
        user=user,
        db=db,
        session=session,
        shot=shot,
        project=project,
    )


def _sse_frame(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post(
    "/images/generate/stream",
    summary="流式创建创作图片生成任务",
    description=(
        "对支持流式的图片模型（豆包 Seedream 系列）边生成边返回每张图，"
        "SSE 事件：`event: task`（任务已创建）、`event: image`（单张就绪）、"
        "`event: done`（整体完成）、`event: error`（失败）。GenTask 同步落库，"
        "断流后可回退 `/tasks/{task_id}` 轮询。"
    ),
)
async def generate_creation_images_stream(
    req: CreationImageGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=req.session_id,
        shot_id=req.shot_id,
        project_id=req.project_id,
    )

    ctx = await _resolve_and_create_image_task(
        req=req,
        user=user,
        db=db,
        session=session,
        shot=shot,
        project=project,
    )
    task = ctx["task"]
    task_id = task.id
    model = ctx["model"]

    if not image_gen_service.supports_stream(model):
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 不支持流式图片生成，请使用 /images/generate 非流式接口",
        )

    # 在生成器内捕获必要的标量，避免持有请求级 db/ORM 对象。
    user_id = user.id
    project_id = project.id if project else None
    session_id = session.id if session else None
    shot_id = shot.id if shot else None
    watermark = ctx["watermark"]
    reference_images = ctx["reference_images"]
    mentions = ctx["mentions"]
    attachments = ctx["attachments"]
    prompt_raw = ctx["prompt_raw"]
    prompt_resolved = ctx["prompt_resolved"]
    aspect_ratio = ctx["aspect_ratio"]
    resolution = ctx["resolution"]
    count = ctx["count"]
    resolved_size = ctx["resolved_size"]
    task_source = ctx["task_source"]
    category = ctx["category"]
    asset_name = ctx["asset_name"]
    prompt = req.prompt
    save_to_assets = req.save_to_assets
    inherit_project_style = req.inherit_project_style
    output_format = req.output_format
    response_format = req.response_format
    web_search = bool(req.web_search)
    optimize_prompt = req.optimize_prompt
    sequential_image_generation = req.sequential_image_generation

    async def event_generator():
        yield _sse_frame("task", {"task_id": str(task_id), "model": model, "total_count": count})
        async with async_session() as task_db:
            db_task = (
                await task_db.execute(select(GenTask).where(GenTask.id == task_id))
            ).scalar_one_or_none()
            if not db_task:
                yield _sse_frame("error", {"error": "任务不存在"})
                return

            db_task.status = "running"
            await task_db.commit()

            provider_runtime = await get_user_model_provider_runtime(
                user_id,
                task_db,
                category="image",
                requested_model=model,
            )
            if not provider_runtime:
                db_task.status = "failed"
                db_task.fail_count = count
                db_task.results = [{"success": False, "error": "未配置图片模型对应服务商"}]
                await task_db.commit()
                yield _sse_frame("error", {"error": "未配置图片模型对应服务商"})
                return

            api_key, base_url, _, resolved_model, _, _ = provider_runtime

            db_session = None
            db_shot = None
            db_project = None
            if project_id:
                db_project = (
                    await task_db.execute(select(Project).where(Project.id == project_id))
                ).scalar_one_or_none()
            if session_id:
                db_session = (
                    await task_db.execute(select(CreationSession).where(CreationSession.id == session_id))
                ).scalar_one_or_none()
            if shot_id:
                db_shot = (
                    await task_db.execute(select(CreationShot).where(CreationShot.id == shot_id))
                ).scalar_one_or_none()

            final_prompt = prompt_resolved or prompt
            if inherit_project_style:
                final_prompt = await _apply_visual_style(
                    final_prompt, db_session, db_project, user_id, task_db
                )

            results: list[dict] = []
            usage_summary: dict | None = None
            index = 0
            try:
                async for event in image_gen_service.generate_stream(
                    prompt=final_prompt,
                    api_key=api_key,
                    base_url=base_url,
                    model=resolved_model,
                    size=resolved_size,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    reference_images=reference_images,
                    n=count,
                    watermark=watermark,
                    output_format=output_format,
                    response_format=response_format,
                    web_search=web_search,
                    optimize_prompt_mode=optimize_prompt,
                    sequential_image_generation=sequential_image_generation,
                ):
                    event_type = event.get("type")
                    if event_type == "image":
                        index += 1
                        result_record = await _persist_one_creation_image(
                            db=task_db,
                            url=event["url"],
                            index=index,
                            user_id=user_id,
                            project_id=project_id,
                            session_id=session_id,
                            shot_id=shot_id,
                            shot=db_shot,
                            final_prompt=final_prompt,
                            prompt=prompt,
                            prompt_raw=prompt_raw,
                            model=resolved_model,
                            size=resolved_size,
                            aspect_ratio=aspect_ratio,
                            resolution=resolution,
                            reference_images=reference_images,
                            mentions=mentions,
                            attachments=attachments,
                            watermark=watermark,
                            inherit_project_style=inherit_project_style,
                            save_to_assets=save_to_assets,
                            asset_name=asset_name,
                            category=category,
                            source=task_source,
                            task_id=task_id,
                            count=count,
                        )
                        results.append(result_record)
                        db_task.success_count += 1
                        db_task.results = results
                        await task_db.commit()
                        yield _sse_frame(
                            "image",
                            {
                                "index": index,
                                "url": result_record["url"],
                                "asset_id": result_record["asset_id"],
                                "size": event.get("size"),
                            },
                        )
                    elif event_type == "completed":
                        usage_summary = event.get("usage")
                    elif event_type == "error":
                        results.append({"success": False, "error": event.get("error")})
                        db_task.fail_count += 1
                        db_task.results = results
                        await task_db.commit()
                        yield _sse_frame("error", {"error": event.get("error"), "index": event.get("index")})
            except Exception as exc:  # noqa: BLE001 - 透传上游错误到 SSE
                results.append({"success": False, "error": str(exc)})
                db_task.fail_count = max(db_task.fail_count, count - db_task.success_count)
                db_task.results = results
                await task_db.commit()
                yield _sse_frame("error", {"error": str(exc)})

            if db_task.fail_count == 0 and db_task.success_count > 0:
                db_task.status = "completed"
            elif db_task.success_count == 0:
                db_task.status = "failed"
            else:
                db_task.status = "partial"
            await task_db.commit()

            yield _sse_frame(
                "done",
                {
                    "task_id": str(task_id),
                    "status": db_task.status,
                    "success_count": db_task.success_count,
                    "fail_count": db_task.fail_count,
                    "usage": usage_summary,
                },
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get(
    "/tasks",
    response_model=list[CreationTaskResponse],
    summary="获取创作任务列表",
    description="查询当前用户的创作任务列表，可按状态、任务类型、会话或镜头过滤。",
    response_description="创作任务列表。",
)
async def list_creation_tasks(
    status: str | None = Query(None),
    task_type: str | None = Query(None),
    session_id: str | None = Query(None),
    shot_id: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if session_id or shot_id:
        await _resolve_creation_scope(user=user, db=db, session_id=session_id, shot_id=shot_id)

    if task_type and task_type not in CREATION_TASK_TYPES:
        return []

    query = select(GenTask).where(
        GenTask.user_id == user.id,
        GenTask.task_type.in_(tuple(CREATION_TASK_TYPES)),
    )
    if status:
        query = query.where(GenTask.status == status)
    if task_type:
        query = query.where(GenTask.task_type == task_type)
    if session_id:
        query = query.where(GenTask.params["session_id"].as_string() == session_id)
    if shot_id:
        query = query.where(GenTask.params["shot_id"].as_string() == shot_id)
    query = query.order_by(GenTask.created_at.desc(), GenTask.id.desc())

    result = await db.execute(query)
    return [_task_to_response(task) for task in result.scalars().all()]


@router.get(
    "/tasks/{task_id}",
    response_model=CreationImageTaskStatusResponse,
    summary="轮询创作图片任务",
    description="轮询图片类创作任务的最新状态、进度、结果和错误信息。",
    response_description="创作图片任务状态。",
)
async def poll_creation_image_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GenTask).where(
            GenTask.id == UUID(task_id),
            GenTask.user_id == user.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task or task.task_type not in CREATION_TASK_TYPES:
        raise HTTPException(status_code=404, detail="任务不存在")

    images = await _build_task_image_cards(task, db)
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
    aspect_ratio = _resolve_aspect_ratio(params, task.size)
    resolution = _resolve_resolution(params, task.size)
    reference_images = _resolve_reference_images(params)
    session_id = str(params.get("session_id")) if params.get("session_id") else None
    shot_id = str(params.get("shot_id")) if params.get("shot_id") else None

    return CreationImageTaskStatusResponse(
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
        session_id=session_id,
        sessionId=session_id,
        shot_id=shot_id,
        shotId=shot_id,
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
    response_model=CreationImageDeleteResponse,
    summary="批量删除创作图片",
    description="批量删除创作图片结果。当前为软删除语义，删除后会从创作结果区隐藏并进入回收逻辑。",
    response_description="批量删除结果。",
)
async def batch_delete_creation_images(
    req: CreationBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset_ids = _resolve_batch_asset_ids(req)
    if not asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一张图片")

    deleted_count = 0
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_([UUID(asset_id) for asset_id in asset_ids]),
                Asset.user_id == user.id,
                Asset.asset_type == "image",
            )
        )
    )
    assets = result.scalars().all()
    for asset in assets:
        if not _is_creation_managed_image(asset):
            continue
        if mark_asset_deleted(asset):
            deleted_count += 1

    await db.commit()
    return CreationImageDeleteResponse(
        success=True,
        deleted_count=deleted_count,
        deletedCount=deleted_count,
        message=f"已删除 {deleted_count} 张图片",
    )


@router.post(
    "/images/batch-download",
    summary="批量下载创作图片",
    description="按提交的图片资产 ID 列表打包下载创作图片。",
    response_description="创作图片 zip 压缩包流。",
)
async def batch_download_creation_images(
    req: CreationBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset_ids = _resolve_batch_asset_ids(req)
    if not asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一张图片")

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_([UUID(asset_id) for asset_id in asset_ids]),
                Asset.user_id == user.id,
                Asset.asset_type == "image",
            )
        )
    )
    assets = [asset for asset in result.scalars().all() if _is_creation_managed_image(asset)]
    if not assets:
        raise HTTPException(status_code=404, detail="没有可下载的图片")

    zip_buffer = io.BytesIO()
    added_count = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, asset in enumerate(assets, start=1):
            try:
                content = await _read_media_bytes(asset.file_url, timeout=60.0)
            except Exception:
                continue
            filename = _build_download_filename(asset, index)
            zip_file.writestr(f"{_sanitize_zip_segment('creation_images')}/{filename}", content)
            added_count += 1

    if added_count == 0:
        raise HTTPException(status_code=502, detail="没有可成功下载的图片")

    zip_buffer.seek(0)
    download_name = "creation_images.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


@router.post(
    "/images/batch-favorite",
    response_model=list[CreationFavoriteResponse],
    summary="批量收藏或取消收藏创作图片",
    description="批量更新创作图片的收藏状态，适合图片结果区的多选收藏操作。",
    response_description="批量收藏状态更新结果。",
)
async def batch_favorite_creation_images(
    req: CreationBatchImageFavoriteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset_ids = [asset_id for asset_id in (req.asset_ids or req.ids or []) if asset_id]
    if not asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一张图片")

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_([UUID(asset_id) for asset_id in asset_ids]),
                Asset.user_id == user.id,
                Asset.asset_type == "image",
            )
        )
    )
    assets = [asset for asset in result.scalars().all() if _is_creation_managed_image(asset)]
    for asset in assets:
        asset.is_starred = req.liked
    await db.commit()

    return [
        CreationFavoriteResponse(
            success=True,
            asset_id=str(asset.id),
            is_liked=asset.is_starred,
            isLiked=asset.is_starred,
        )
        for asset in assets
    ]


@router.post(
    "/images/{image_id}/favorite",
    response_model=CreationFavoriteResponse,
    summary="收藏或取消收藏创作图片",
    description="更新指定创作图片的收藏状态。该接口与 `/like` 作用相同，仅为兼容不同前端命名。",
    response_description="更新后的收藏状态。",
)
@router.post(
    "/images/{image_id}/like",
    response_model=CreationFavoriteResponse,
    summary="收藏或取消收藏创作图片",
    description="更新指定创作图片的收藏状态。该接口与 `/favorite` 作用相同，仅为兼容不同前端命名。",
    response_description="更新后的收藏状态。",
)
async def toggle_creation_image_favorite(
    image_id: str,
    req: CreationBatchFavoriteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_creation_image_asset(image_id, user, db)
    asset.is_starred = req.liked
    await db.commit()
    await db.refresh(asset)
    return CreationFavoriteResponse(
        success=True,
        asset_id=str(asset.id),
        is_liked=asset.is_starred,
        isLiked=asset.is_starred,
    )


@router.get(
    "/images/{image_id}",
    response_model=CreationImageCard,
    summary="获取创作图片详情",
    description="读取单张创作图片的卡片详情。",
    response_description="创作图片详情。",
)
async def get_creation_image_detail(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_creation_image_asset(image_id, user, db)
    return _asset_to_image_card(asset)


@router.get(
    "/images/{image_id}/download",
    summary="下载创作图片",
    description="下载指定创作图片。",
    response_description="图片二进制流。",
)
async def download_creation_image(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_creation_image_asset(image_id, user, db)
    try:
        media = _resolve_creation_image_media(
            thumbnail_url=asset.thumbnail_url,
            original_url=asset.file_url,
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
    response_model=CreationImageDeleteResponse,
    summary="删除单张创作图片",
    description="删除指定创作图片。当前为软删除语义，成功后返回统一删除结果结构。",
    response_description="删除结果。",
)
async def delete_creation_image(
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_creation_image_asset(image_id, user, db)
    mark_asset_deleted(asset)
    await db.commit()
    return CreationImageDeleteResponse(
        success=True,
        deleted_count=1,
        deletedCount=1,
        message="已删除",
    )


@router.post(
    "/shots/{shot_id}/generate-image",
    response_model=CreationTaskResponse,
    status_code=201,
    summary="生成创作镜头图片",
    description="基于创作镜头的提示词、正文和画幅配置发起图片生成任务。",
    response_description="镜头图片生成任务。",
)
async def generate_creation_shot_image(
    shot_id: str,
    req: CreationShotImageGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    session = await _get_session(str(shot.session_id), user, db)
    _, _, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=str(session.id),
        shot_id=shot_id,
    )

    prompt = (req.prompt or shot.prompt or shot.content or shot.title or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="镜头无可用提示词")

    proxy_req = CreationImageGenerateRequest(
        prompt=prompt,
        model=req.model,
        size=req.size,
        aspect_ratio=req.resolved_aspect_ratio(shot, session),
        resolution=req.resolved_resolution(),
        reference_images=req.reference_images,
        referenceImages=req.referenceImages,
        count=req.count,
        image_count=req.image_count,
        imageCount=req.imageCount,
        asset_name=req.asset_name,
        category=req.category,
        save_to_assets=req.save_to_assets,
        inherit_project_style=req.inherit_project_style,
        session_id=str(session.id),
        shot_id=shot_id,
        project_id=str(project.id) if project else None,
        watermark=req.watermark,
    )
    return await _create_creation_image_task(
        req=proxy_req,
        user=user,
        db=db,
        session=session,
        shot=shot,
        project=project,
        prompt=prompt,
        category=req.category,
        asset_name=req.asset_name or shot.title or f"镜头 {shot.shot_number}",
        source="creation_shot_image",
    )


@router.post(
    "/shots/{shot_id}/generate-audio",
    response_model=CreationShotAudioResponse,
    status_code=201,
    summary="同步生成创作镜头配音",
    description="基于创作镜头文本为该镜头同步生成配音，并立即返回音频结果。",
    response_description="镜头配音结果。",
)
async def generate_creation_shot_audio(
    shot_id: str,
    req: CreationShotAudioGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    session = await _get_session(str(shot.session_id), user, db)

    text = (req.text or shot.content or shot.prompt or shot.title or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="镜头无可用配音文案")

    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="voice",
        requested_model=req.model,
    )
    if not key_data:
        detail = "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"
        if req.model:
            detail = f"未找到可用的配音模型 {req.model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)

    api_key, base_url, provider_type, model_id = key_data
    provider_options = build_tts_provider_options(
        req,
        default_voice_id=req.voice_id,
        default_speed=req.speed,
        default_emotion=req.emotion,
    )
    try:
        tts_result = await tts_service.generate(
            text=text,
            api_key=api_key,
            base_url=base_url,
            voice=req.voice_id,
            speed=req.speed,
            model=model_id,
            provider_type=provider_type,
            provider_options=provider_options,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"配音生成失败: {str(exc)}") from exc

    try:
        audio_url = await persist_if_external(
            tts_result["url"],
            _resolve_creation_subdir(session_id=session.id, shot_id=shot.id, kind="audio"),
            fallback_extension=get_media_fallback_extension("audio"),
            url_label="创作镜头配音地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"配音文件落盘失败: {str(exc)}") from exc
    if not audio_url:
        raise HTTPException(status_code=502, detail="配音文件落盘失败: 未返回可保存的音频地址")

    clip = AudioClip(
        user_id=user.id,
        project_id=shot.project_id,
        storyboard_id=None,
        text=text,
        voice_id=req.voice_id,
        audio_url=audio_url,
        duration=tts_result["duration"],
        speed=req.speed,
        emotion=req.emotion,
    )
    db.add(clip)
    await db.flush()

    asset = Asset(
        user_id=user.id,
        project_id=shot.project_id,
        name=f"{session.title} - 镜头{shot.shot_number}配音",
        asset_type="audio",
        category="audio",
        file_url=audio_url,
        prompt=text,
        model=model_id,
        metadata_json={
            "source": "creation_shot_audio",
            "clip_id": str(clip.id),
            "session_id": str(session.id),
            "shot_id": str(shot.id),
            "shot_number": shot.shot_number,
            "duration": tts_result["duration"],
            "model": model_id,
            "provider_type": provider_type,
            "voice_id": req.voice_id,
            "speed": req.speed,
            "emotion": req.emotion,
            "tts_metadata": tts_result.get("metadata"),
            "tts_request_options": provider_options,
        },
    )
    db.add(asset)

    shot.audio_url = audio_url
    _merge_shot_metadata(
        shot,
        {
            "last_audio_clip_id": str(clip.id),
            "last_audio_asset_id": str(asset.id),
            "last_audio_voice_id": req.voice_id,
        },
    )

    await db.commit()
    await db.refresh(clip)
    await db.refresh(asset)

    return CreationShotAudioResponse(
        clip_id=str(clip.id),
        asset_id=str(asset.id),
        project_id=str(clip.project_id) if clip.project_id else None,
        shot_id=str(shot.id),
        text=clip.text,
        voice_id=clip.voice_id,
        audio_url=clip.audio_url,
        duration=clip.duration,
        speed=clip.speed,
        emotion=clip.emotion,
        created_at=clip.created_at.isoformat(),
    )


@router.post(
    "/shots/{shot_id}/generate-video",
    response_model=CreationShotVideoResponse,
    status_code=201,
    summary="同步生成创作镜头视频",
    description="基于创作镜头内容、参考图和参考音频同步生成镜头视频，并立即返回视频结果。",
    response_description="镜头视频结果。",
)
async def generate_creation_shot_video(
    shot_id: str,
    req: CreationShotVideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shot = await _get_shot(shot_id, user, db)
    session = await _get_session(str(shot.session_id), user, db)
    _, _, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=str(session.id),
        shot_id=shot_id,
    )

    prompt = (req.prompt or shot.prompt or shot.content or shot.title or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="镜头无可用提示词")

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
    watermark = resolve_optional_model_toggle(
        model_id=model,
        category="video",
        capability_key="supports_watermark_toggle",
        requested_value=req.watermark,
        default_value=default_video_watermark,
    )
    explicit_first_frame_url = req.first_frame_url
    first_frame_url = explicit_first_frame_url or shot.image_url
    reference_mode = (
        (req.reference_mode or "").strip()
        or infer_video_reference_mode(
            model,
            first_frame_url=first_frame_url,
            last_frame_url=req.last_frame_url,
            reference_video_url=req.reference_video_url,
            fallback_to_full_on_unsupported_first_frame=True,
        )
    )
    validated = validate_video_request(
        model=model,
        prompt=prompt,
        ratio=req.ratio or session.aspect_ratio or "16:9",
        resolution=req.resolution,
        duration=req.duration,
        generation_mode=req.generation_mode,
        reference_mode=reference_mode,
        first_frame_url=first_frame_url,
        last_frame_url=req.last_frame_url,
        reference_video_url=req.reference_video_url,
        reference_audio_url=req.reference_audio_url or shot.audio_url,
        attachments=[
            item.model_dump(exclude_none=True)
            for item in (req.attachments or [])
        ],
        first_frame_asset_id=req.first_frame_asset_id,
        last_frame_asset_id=req.last_frame_asset_id,
        reference_video_asset_id=req.reference_video_asset_id,
        reference_audio_asset_id=req.reference_audio_asset_id,
        reference_image_asset_ids=req.reference_image_asset_ids or [],
        generate_audio=req.generate_audio,
        audio_setting=req.audio_setting,
        watermark=watermark,
    )
    validated_attachments = _validated_asset_bindings_to_attachments(
        validated.get("asset_bindings")
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

    final_prompt = await _apply_visual_style(prompt, session, project, user.id, db)
    ratio = validated["ratio"] or session.aspect_ratio or "16:9"

    try:
        video_result = await video_gen_service.generate(
            prompt=final_prompt,
            api_key=api_key,
            base_url=base_url,
            image_url=shot.image_url,
            model=model,
            duration=req.duration,
            reference_mode=validated["reference_mode"],
            first_frame_url=effective_first_frame,
            last_frame_url=effective_last_frame,
            resolution=validated["resolution"],
            sound_effect=req.sound_effect,
            reference_video_url=req.reference_video_url,
            reference_audio_url=req.reference_audio_url or shot.audio_url,
            ratio=ratio,
            generate_mode=req.generation_mode,
            generate_audio=req.generate_audio,
            audio_setting=validated["audio_setting"],
            watermark=watermark,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频生成失败: {str(exc)}") from exc

    if not video_result.get("url"):
        raise HTTPException(status_code=502, detail="视频生成失败: 未返回视频地址")

    try:
        video_url = await persist_if_external(
            video_result["url"],
            _resolve_creation_subdir(session_id=session.id, shot_id=shot.id, kind="videos"),
            fallback_extension=get_media_fallback_extension("video"),
            url_label="创作镜头视频地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频文件落盘失败: {str(exc)}") from exc
    if not video_url:
        raise HTTPException(status_code=502, detail="视频生成失败: 未返回可保存的视频地址")

    try:
        thumbnail_url = await persist_if_external(
            video_result.get("thumbnail_url") or shot.image_url,
            _resolve_creation_subdir(session_id=session.id, shot_id=shot.id, kind="video-thumbnails"),
            fallback_extension=get_media_fallback_extension("image"),
            url_label="创作镜头视频缩略图地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频缩略图落盘失败: {str(exc)}") from exc
    thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        thumbnail_url,
        asset_type="video",
    )
    video_playback_metadata = build_video_playback_metadata(
        video_result,
        preview_video_url=video_url,
        download_url=video_url,
        poster_url=thumbnail_url,
    )

    try:
        reference_image_urls = await persist_many_if_external(
            [url for url in [effective_first_frame, effective_last_frame] if url],
            _resolve_creation_subdir(session_id=session.id, shot_id=shot.id, kind="video-reference-images"),
            fallback_extension=get_media_fallback_extension("image"),
            url_label="创作镜头视频参考图地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频参考图落盘失败: {str(exc)}") from exc

    clip = VideoClip(
        user_id=user.id,
        project_id=shot.project_id,
        storyboard_id=None,
        video_url=video_url,
        duration=_coerce_float(video_result.get("duration")) or _coerce_float(req.duration) or 5.0,
        model=model,
        prompt=final_prompt,
    )
    db.add(clip)
    await db.flush()

    asset = Asset(
        user_id=user.id,
        project_id=shot.project_id,
        name=f"{session.title} - 镜头{shot.shot_number}视频",
        asset_type="video",
        category="storyboard",
        file_url=video_url,
        thumbnail_url=thumbnail_url,
        prompt=final_prompt,
        model=model,
        size=validated["resolution"],
        metadata_json={
            "source": "creation_shot_video",
            "clip_id": str(clip.id),
            "session_id": str(session.id),
            "shot_id": str(shot.id),
            "shot_number": shot.shot_number,
            "duration": clip.duration,
            "ratio": ratio,
            "resolution": validated["resolution"],
            "generation_mode": validated["generation_mode"],
            "reference_mode": validated["reference_mode"],
            "watermark": watermark,
            "audio_setting": validated["audio_setting"],
            "first_frame_url": reference_image_urls[0] if reference_image_urls else None,
            "last_frame_url": reference_image_urls[1] if len(reference_image_urls) > 1 else None,
            "prompt_raw": prompt,
            "prompt_resolved": video_result.get("prompt_resolved") or final_prompt,
            "asset_bindings": video_result.get("asset_bindings") or validated_attachments,
            "thumbnail_url": thumbnail_url,
            **video_playback_metadata,
            **derivative_metadata,
        },
    )
    db.add(asset)

    shot.video_url = video_url
    shot.prompt = prompt
    shot.reference_image_urls = reference_image_urls or shot.reference_image_urls
    _merge_shot_metadata(
        shot,
        {
            "last_video_clip_id": str(clip.id),
            "last_video_asset_id": str(asset.id),
            "last_video_model": model,
            "last_video_thumbnail_url": thumbnail_url,
        },
    )

    await db.commit()
    await db.refresh(clip)
    await db.refresh(asset)

    return CreationShotVideoResponse(
        clip_id=str(clip.id),
        asset_id=str(asset.id),
        project_id=str(clip.project_id) if clip.project_id else None,
        shot_id=str(shot.id),
        video_url=clip.video_url,
        thumbnail_url=thumbnail_url,
        duration=clip.duration,
        model=clip.model,
        prompt=clip.prompt,
        created_at=clip.created_at.isoformat(),
    )


# ─── Standalone Video Generation ───────────────────────────────────────────────


async def _asset_to_video_card(asset: Asset, db: AsyncSession) -> CreationVideoCard:
    metadata = asset.metadata_json or {}
    asset_bindings = await _enrich_creation_asset_bindings(
        metadata.get("asset_bindings") or [],
        db=db,
        fallback_user_id=str(asset.user_id),
        fallback_project_id=str(asset.project_id) if asset.project_id else None,
    )
    created_at = asset.created_at.isoformat()
    media = _resolve_creation_video_media(
        video_url=asset.file_url,
        thumbnail_url=asset.thumbnail_url,
        metadata=metadata,
        user_id=str(asset.user_id),
        project_id=str(asset.project_id) if asset.project_id else None,
        resource_id=str(asset.id),
    )
    return CreationVideoCard(
        id=str(asset.id),
        asset_id=str(asset.id),
        assetId=str(asset.id),
        name=asset.name,
        video_url=asset.file_url,
        videoUrl=asset.file_url,
        thumbnail_url=asset.thumbnail_url,
        thumbnailUrl=asset.thumbnail_url,
        poster_url=media["poster_url"],
        posterUrl=media["poster_url"],
        preview_video_url=media["preview_video_url"],
        previewVideoUrl=media["preview_video_url"],
        hls_url=media["hls_url"],
        hlsUrl=media["hls_url"],
        available_qualities=media["available_qualities"],
        availableQualities=media["available_qualities"],
        download_url=media["download_url"],
        downloadUrl=media["download_url"],
        duration=_coerce_float(metadata.get("duration")),
        ratio=metadata.get("ratio"),
        resolution=metadata.get("resolution") or asset.size,
        model=asset.model,
        prompt=asset.prompt,
        generation_mode=metadata.get("generation_mode"),
        generationMode=metadata.get("generation_mode"),
        reference_mode=metadata.get("reference_mode"),
        referenceMode=metadata.get("reference_mode"),
        first_frame_url=metadata.get("first_frame_url"),
        firstFrameUrl=metadata.get("first_frame_url"),
        last_frame_url=metadata.get("last_frame_url"),
        lastFrameUrl=metadata.get("last_frame_url"),
        prompt_raw=metadata.get("prompt_raw") or asset.prompt,
        promptRaw=metadata.get("prompt_raw") or asset.prompt,
        prompt_resolved=metadata.get("prompt_resolved"),
        promptResolved=metadata.get("prompt_resolved"),
        asset_bindings=asset_bindings,
        assetBindings=asset_bindings,
        is_liked=asset.is_starred or False,
        isLiked=asset.is_starred or False,
        created_at=created_at,
        createdAt=created_at,
        preview_ready=media["preview_ready"],
        previewReady=media["preview_ready"],
    )


async def _task_result_to_video_card(
    task: GenTask,
    result: Any,
    db: AsyncSession,
) -> CreationVideoCard | None:
    if not isinstance(result, dict):
        return None

    video_url = (
        result.get("video_url")
        or result.get("videoUrl")
        or result.get("url")
    )
    if not video_url:
        return None

    params = task.params or {}
    asset_id = str(result.get("asset_id") or result.get("assetId") or task.id)
    thumbnail_url = result.get("thumbnail_url") or result.get("thumbnailUrl")
    media = _resolve_creation_video_media(
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        metadata=params,
        user_id=str(task.user_id),
        project_id=str(params.get("project_id")) if params.get("project_id") else None,
        resource_id=asset_id,
    )
    created_at = task.updated_at.isoformat()
    prompt = params.get("prompt_resolved") or params.get("prompt") or ""
    prompt_raw = params.get("prompt_raw") or params.get("prompt") or ""
    prompt_resolved = params.get("prompt_resolved") or prompt
    asset_bindings = await _enrich_creation_asset_bindings(
        params.get("attachments") or [],
        db=db,
        fallback_user_id=str(task.user_id),
        fallback_project_id=str(params.get("project_id")) if params.get("project_id") else None,
    )

    return CreationVideoCard(
        id=asset_id,
        asset_id=asset_id,
        assetId=asset_id,
        name=params.get("asset_name") or "创作视频",
        video_url=video_url,
        videoUrl=video_url,
        thumbnail_url=thumbnail_url,
        thumbnailUrl=thumbnail_url,
        poster_url=media["poster_url"],
        posterUrl=media["poster_url"],
        preview_video_url=media["preview_video_url"],
        previewVideoUrl=media["preview_video_url"],
        hls_url=media["hls_url"],
        hlsUrl=media["hls_url"],
        available_qualities=media["available_qualities"],
        availableQualities=media["available_qualities"],
        download_url=media["download_url"],
        downloadUrl=media["download_url"],
        duration=_coerce_float(result.get("duration") or params.get("duration")),
        ratio=params.get("ratio"),
        resolution=params.get("resolution"),
        model=task.model,
        prompt=prompt,
        generation_mode=params.get("generation_mode"),
        generationMode=params.get("generation_mode"),
        reference_mode=params.get("reference_mode"),
        referenceMode=params.get("reference_mode"),
        first_frame_url=params.get("first_frame_url"),
        firstFrameUrl=params.get("first_frame_url"),
        last_frame_url=params.get("last_frame_url"),
        lastFrameUrl=params.get("last_frame_url"),
        prompt_raw=prompt_raw,
        promptRaw=prompt_raw,
        prompt_resolved=prompt_resolved,
        promptResolved=prompt_resolved,
        asset_bindings=asset_bindings,
        assetBindings=asset_bindings,
        is_liked=False,
        isLiked=False,
        created_at=created_at,
        createdAt=created_at,
        preview_ready=media["preview_ready"],
        previewReady=media["preview_ready"],
    )


def _build_creation_video_task_result(
    *,
    video_url: str,
    thumbnail_url: str | None = None,
    asset_id: str | None = None,
    duration: float | int | None = None,
    warning: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    media = _resolve_creation_video_media(
        video_url=video_url,
        thumbnail_url=thumbnail_url,
        metadata=metadata or {},
        resource_id=asset_id,
    )
    result: dict[str, Any] = {
        "success": True,
        "video_url": video_url,
        "videoUrl": video_url,
        "thumbnail_url": thumbnail_url,
        "thumbnailUrl": thumbnail_url,
        "poster_url": media["poster_url"],
        "posterUrl": media["poster_url"],
        "preview_video_url": media["preview_video_url"],
        "previewVideoUrl": media["preview_video_url"],
        "hls_url": media["hls_url"],
        "hlsUrl": media["hls_url"],
        "available_qualities": media["available_qualities"],
        "availableQualities": media["available_qualities"],
        "download_url": media["download_url"],
        "downloadUrl": media["download_url"],
        "preview_ready": media["preview_ready"],
        "previewReady": media["preview_ready"],
        "current_stage": metadata.get("video_pipeline_stage") if isinstance(metadata, dict) else None,
        "currentStage": metadata.get("video_pipeline_stage") if isinstance(metadata, dict) else None,
        "partial_ready": metadata.get("partial_ready") if isinstance(metadata, dict) else None,
        "partialReady": metadata.get("partial_ready") if isinstance(metadata, dict) else None,
    }
    if asset_id:
        result["asset_id"] = asset_id
        result["assetId"] = asset_id
    if duration is not None:
        result["duration"] = duration
    if warning:
        result["warning"] = warning
    return result


async def _build_video_card_from_task_results(task: GenTask, db: AsyncSession) -> CreationVideoCard | None:
    for item in (task.results or []):
        if not isinstance(item, dict) or item.get("success") is False:
            continue

        asset_id = item.get("asset_id") or item.get("assetId")
        if asset_id:
            try:
                asset_uuid = UUID(str(asset_id))
            except (TypeError, ValueError):
                asset_uuid = None
            if asset_uuid:
                asset_result = await db.execute(
                    apply_asset_visibility(select(Asset).where(Asset.id == asset_uuid))
                )
                asset = asset_result.scalar_one_or_none()
                if asset:
                    return await _asset_to_video_card(asset, db)

        video_card = await _task_result_to_video_card(task, item, db)
        if video_card is not None:
            return video_card

    return None


@router.get(
    "/videos",
    response_model=CreationVideoListResponse,
    summary="获取创作视频列表",
    description="查询创作页生成的视频列表。",
    response_description="创作视频列表。",
)
async def list_creation_videos(
    page: int = Query(1, ge=1),
    page_size: int = Query(CREATION_LIST_DEFAULT_PAGE_SIZE, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Asset).where(
        Asset.user_id == user.id,
        Asset.asset_type == "video",
        Asset.metadata_json["source"].as_string().in_(["creation_video", "creation_shot_video"]),
        Asset.is_deleted == False,
    )
    count_result = await db.execute(select(sa_func.count()).select_from(base_query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query.order_by(Asset.created_at.desc(), Asset.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    assets = result.scalars().all()

    return CreationVideoListResponse(
        list=[await _asset_to_video_card(a, db) for a in assets],
        total=total,
        has_more=(page * page_size) < total,
        hasMore=(page * page_size) < total,
        page=page,
        page_size=page_size,
        pageSize=page_size,
    )


@router.post(
    "/videos/generate",
    response_model=CreationTaskResponse,
    status_code=201,
    summary="创建创作视频生成任务",
    description="发起独立创作视频生成任务，支持文生、图生、首尾帧、多参考图等能力。",
    response_description="视频生成任务。",
    responses={
        201: {
            "description": "任务创建成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "30955dc7-3e0d-4c05-af35-328e84d8071a",
                        "task_type": "creation_video",
                        "status": "pending",
                        "progress": 0,
                        "model": "vidu-q1",
                        "created_at": "2026-06-04T12:30:00",
                        "updated_at": "2026-06-04T12:30:00",
                        "results": [],
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
                        "prompt": "古风庭院夜戏，女主回头凝望，风吹灯影，电影感运镜",
                        "model": "vidu-q1",
                        "ratio": "16:9",
                        "resolution": "1080p",
                        "duration": 5,
                        "generation_mode": "text_to_video",
                        "reference_mode": "first_frame",
                        "first_frame_url": "https://example.com/first-frame.png",
                        "with_audio": False,
                        "watermark": False,
                    }
                }
            }
        }
    },
)
async def generate_creation_video(
    req: CreationVideoGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=req.session_id,
        shot_id=req.shot_id,
        project_id=req.project_id,
    )
    requested_model = req.model or await _get_default_video_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="video",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    default_video_watermark = await _get_model_default_watermark(user.id, "video", model, db)
    watermark = resolve_optional_model_toggle(
        model_id=model,
        category="video",
        capability_key="supports_watermark_toggle",
        requested_value=req.watermark,
        default_value=default_video_watermark,
    )
    validated = validate_video_request(
        model=model,
        prompt=req.prompt,
        ratio=req.ratio,
        resolution=req.resolution,
        duration=req.duration,
        generation_mode=req.generation_mode,
        reference_mode=req.reference_mode,
        first_frame_url=req.first_frame_url,
        last_frame_url=req.last_frame_url,
        reference_video_url=req.reference_video_url,
        reference_audio_url=req.reference_audio_url,
        attachments=[
            item.model_dump(exclude_none=True)
            for item in (req.attachments or [])
        ],
        subjects=[
            item.model_dump(exclude_none=True)
            for item in (req.subjects or [])
        ],
        multiframe_segments=[
            item.model_dump(exclude_none=True)
            for item in (req.multiframe_segments or [])
        ],
        first_frame_asset_id=req.first_frame_asset_id,
        last_frame_asset_id=req.last_frame_asset_id,
        reference_video_asset_id=req.reference_video_asset_id,
        reference_audio_asset_id=req.reference_audio_asset_id,
        reference_image_asset_ids=req.reference_image_asset_ids or [],
        generate_audio=req.with_audio,
        audio_type=req.audio_type,
        audio_setting=req.audio_setting,
        off_peak=req.off_peak,
        watermark=watermark,
    )
    validated_attachments = _validated_asset_bindings_to_attachments(
        validated.get("asset_bindings")
    )
    validated_first_frame_url = validated.get("first_frame_url")
    validated_last_frame_url = validated.get("last_frame_url")
    validated_reference_video_url = validated.get("reference_video_url")
    validated_reference_audio_url = validated.get("reference_audio_url")

    task = GenTask(
        user_id=user.id,
        project_id=project.id if project else None,
        task_type="creation_video",
        status="pending",
        total_count=1,
        model=model,
        size=validated["resolution"],
        params={
            "prompt": req.prompt,
            "model": model,
            "generation_mode": validated["generation_mode"],
            "reference_mode": validated["reference_mode"],
            "ratio": validated["ratio"],
            "resolution": validated["resolution"],
            "duration": validated["duration"],
            "with_audio": req.with_audio,
            "audio_type": req.audio_type,
            "audio_setting": validated["audio_setting"],
            "off_peak": req.off_peak,
            "watermark": watermark,
            "first_frame_url": validated_first_frame_url,
            "last_frame_url": validated_last_frame_url,
            "reference_video_url": validated_reference_video_url,
            "reference_audio_url": validated_reference_audio_url,
            "first_frame_asset_id": req.first_frame_asset_id,
            "last_frame_asset_id": req.last_frame_asset_id,
            "reference_video_asset_id": req.reference_video_asset_id,
            "reference_audio_asset_id": req.reference_audio_asset_id,
            "reference_image_asset_ids": req.reference_image_asset_ids or [],
            "session_id": str(session.id) if session else None,
            "shot_id": str(shot.id) if shot else None,
            "project_id": str(project.id) if project else None,
            "mentions": [
                item.model_dump(exclude_none=True)
                for item in (req.mentions or [])
            ],
            "subjects": [
                item.model_dump(exclude_none=True)
                for item in (req.subjects or [])
            ],
            "multiframe_segments": [
                item.model_dump(exclude_none=True)
                for item in (req.multiframe_segments or [])
            ],
            "attachments": validated_attachments,
            "source": "creation_video",
            "current_stage": "queued",
            "partial_ready": False,
            "metadata_commit_status": "pending",
        },
        results=[],
    )
    db.add(task)
    try:
        await db.commit()
    except (IntegrityError, DataError) as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="创建视频生成任务失败") from exc
    await db.refresh(task)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.creation:_run_creation_video_task",
        kwargs={
            "task_id": task.id,
            "user_id": user.id,
            "prompt": req.prompt,
            "model": model,
            "ratio": validated["ratio"],
            "resolution": validated["resolution"],
            "duration": validated["duration"],
            "with_audio": req.with_audio,
            "generation_mode": validated["generation_mode"],
            "reference_mode": validated["reference_mode"],
            "audio_type": req.audio_type,
            "audio_setting": validated["audio_setting"],
            "off_peak": req.off_peak,
            "watermark": watermark,
            "first_frame_url": validated_first_frame_url,
            "last_frame_url": validated_last_frame_url,
            "reference_video_url": validated_reference_video_url,
            "reference_audio_url": validated_reference_audio_url,
            "first_frame_asset_id": req.first_frame_asset_id,
            "last_frame_asset_id": req.last_frame_asset_id,
            "reference_video_asset_id": req.reference_video_asset_id,
            "reference_audio_asset_id": req.reference_audio_asset_id,
            "reference_image_asset_ids": req.reference_image_asset_ids or [],
            "session_id": str(session.id) if session else None,
            "shot_id": str(shot.id) if shot else None,
            "project_id": str(project.id) if project else None,
            "mentions": [
                item.model_dump(exclude_none=True)
                for item in (req.mentions or [])
            ],
            "subjects": [
                item.model_dump(exclude_none=True)
                for item in (req.subjects or [])
            ],
            "multiframe_segments": [
                item.model_dump(exclude_none=True)
                for item in (req.multiframe_segments or [])
            ],
            "attachments": validated_attachments,
        },
        name=f"gen-task:{task.id}:creation-video",
    )
    return _task_to_response(task)


@router.get(
    "/videos/tasks/{task_id}",
    response_model=CreationVideoTaskStatusResponse,
    summary="轮询创作视频任务",
    description="轮询独立创作视频任务的状态、进度和最终视频结果。",
    response_description="创作视频任务状态。",
)
async def poll_creation_video_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GenTask).where(
            GenTask.id == UUID(task_id),
            GenTask.user_id == user.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task or task.task_type != "creation_video":
        raise HTTPException(status_code=404, detail="任务不存在")

    progress = 0
    if task.status == "running":
        progress = 50
    elif task.status in {"completed", "partial"}:
        progress = 100
    elif task.status == "failed":
        progress = 100

    video_card = None
    if task.status in {"running", "completed", "partial"} and task.results:
        video_card = await _build_video_card_from_task_results(task, db)

    error_msg = None
    if task.status == "failed" and task.results:
        error_msg = task.results[0].get("error") if task.results else None
    params = task.params or {}

    return CreationVideoTaskStatusResponse(
        task_id=str(task.id),
        taskId=str(task.id),
        status=task.status,
        progress=progress,
        current_stage=params.get("current_stage"),
        currentStage=params.get("current_stage"),
        partial_ready=params.get("partial_ready"),
        partialReady=params.get("partial_ready"),
        result=video_card,
        error_msg=error_msg,
        errorMsg=error_msg,
    )


@router.post(
    "/videos/{video_id}/favorite",
    summary="切换创作视频收藏状态",
    description="切换指定创作视频的收藏状态。当前接口会直接对资产的 `is_starred` 做取反更新。",
    response_description="更新后的收藏状态。",
)
async def toggle_creation_video_favorite(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(video_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="视频不存在")

    asset.is_starred = not (asset.is_starred or False)
    await db.commit()
    return {"id": str(asset.id), "is_liked": asset.is_starred}


@router.delete(
    "/videos/{video_id}",
    status_code=204,
    summary="删除创作视频",
    description="删除指定创作视频。当前为软删除语义，成功后返回空响应体。",
    response_description="删除成功，无响应体。",
)
async def delete_creation_video(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(video_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="视频不存在")

    mark_asset_deleted(asset)
    await db.commit()


@router.get(
    "/videos/{video_id}/download",
    summary="下载创作视频",
    description="下载指定创作视频。",
    response_description="视频二进制流。",
)
async def download_creation_video(
    video_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_creation_video_asset(video_id, user, db)
    try:
        media = _resolve_creation_video_media(
            video_url=asset.file_url,
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
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"下载视频失败: {str(exc)}") from exc

    filename = _build_creation_video_filename(asset, 1)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.post(
    "/videos/batch-delete",
    status_code=200,
    summary="批量删除创作视频",
    description="批量删除创作视频结果。当前为软删除语义，成功后返回删除数量。",
    response_description="批量删除结果。",
)
async def batch_delete_creation_videos(
    req: CreationBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = _resolve_batch_asset_ids(req)
    if not ids:
        return {"deleted": 0}

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_([UUID(i) for i in ids]),
                Asset.user_id == user.id,
                Asset.asset_type == "video",
            )
        )
    )
    assets = result.scalars().all()
    for asset in assets:
        mark_asset_deleted(asset)

    await db.commit()
    return {"deleted": len(assets)}


@router.post(
    "/videos/batch-download",
    summary="批量下载创作视频",
    description="按提交的视频资产 ID 列表打包下载创作视频。",
    response_description="创作视频 zip 压缩包流。",
)
async def batch_download_creation_videos(
    req: CreationBatchImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = _resolve_batch_asset_ids(req)
    if not ids:
        raise HTTPException(status_code=400, detail="请至少选择一个视频")

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_([UUID(i) for i in ids]),
                Asset.user_id == user.id,
                Asset.asset_type == "video",
            )
        )
    )
    assets = [asset for asset in result.scalars().all() if _is_creation_managed_video(asset)]
    if not assets:
        raise HTTPException(status_code=404, detail="没有可下载的视频")

    zip_buffer = io.BytesIO()
    added = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, asset in enumerate(assets, start=1):
            content: bytes | None = None
            for candidate_url in _iter_creation_video_download_attempts(asset):
                try:
                    resolved_target = resolve_verified_download_target_from_url(
                        candidate_url,
                        expected_user_id=str(user.id),
                    )
                    content = await _read_media_bytes(resolved_target, timeout=60.0)
                    break
                except MediaDownloadAccessError as exc:
                    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
                except Exception:
                    continue
            if content is None:
                continue
            filename = _build_creation_video_filename(asset, index)
            zip_file.writestr(f"{_sanitize_zip_segment('creation_videos')}/{filename}", content)
            added += 1

    if added == 0:
        raise HTTPException(status_code=502, detail="视频文件暂时不可下载")

    zip_buffer.seek(0)
    download_name = "creation_videos.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


async def _run_creation_video_task(
    *,
    task_id: UUID,
    user_id: UUID,
    prompt: str,
    model: str,
    ratio: str,
    resolution: str,
    duration: float | int,
    with_audio: bool,
    generation_mode: str | None,
    reference_mode: str,
    audio_type: str | None,
    audio_setting: str | None,
    off_peak: bool | None,
    watermark: bool | None,
    first_frame_url: str | None,
    last_frame_url: str | None,
    reference_video_url: str | None,
    reference_audio_url: str | None,
    first_frame_asset_id: str | None,
    last_frame_asset_id: str | None,
    reference_video_asset_id: str | None,
    reference_audio_asset_id: str | None,
    reference_image_asset_ids: list[str] | None,
    session_id: str | None,
    shot_id: str | None,
    project_id: str | None,
    mentions: list[dict] | None,
    subjects: list[dict[str, Any]] | None,
    multiframe_segments: list[dict[str, Any]] | None,
    attachments: list[dict] | None,
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
            category="video",
            requested_model=model,
        )
        if not provider_runtime:
            task.status = "failed"
            task.fail_count = 1
            _update_creation_video_task_runtime_state(
                task,
                current_stage="queued",
                partial_ready=False,
                metadata_commit_status="pending",
            )
            task.results = [{"success": False, "error": "未配置视频模型对应服务商"}]
            await db.commit()
            await _create_notification(
                db, user_id, "creation_log", "视频生成失败", "未配置视频模型对应服务商，请先在设置中配置", "/config"
            )
            return

        api_key, base_url, _, model, _, _ = provider_runtime
        provider_type = provider_runtime[2]

        # #region debug-point B:video-provider-runtime
        try:
            _dbg_url = "http://127.0.0.1:7777/event"
            _dbg_session = "video-tail-frame-401"
            try:
                with open(".dbg/video-tail-frame-401.env", "r", encoding="utf-8") as _dbg_file:
                    for _dbg_line in _dbg_file.read().splitlines():
                        if _dbg_line.startswith("DEBUG_SERVER_URL="):
                            _dbg_url = _dbg_line.split("=", 1)[1] or _dbg_url
                        elif _dbg_line.startswith("DEBUG_SESSION_ID="):
                            _dbg_session = _dbg_line.split("=", 1)[1] or _dbg_session
            except Exception:
                pass
            urllib.request.urlopen(
                urllib.request.Request(
                    _dbg_url,
                    data=json.dumps(
                        {
                            "sessionId": _dbg_session,
                            "runId": "pre-fix",
                            "hypothesisId": "B",
                            "location": "backend/app/routers/creation.py:_run_creation_video_generation_job",
                            "msg": "[DEBUG] resolved video provider runtime",
                            "data": {
                                "taskId": str(task_id),
                                "providerType": provider_type,
                                "model": model,
                                "baseUrl": base_url,
                                "apiKeyFingerprint": hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12],
                                "referenceMode": reference_mode,
                                "generationMode": generation_mode,
                                "hasFirstFrame": bool(first_frame_url),
                                "hasLastFrame": bool(last_frame_url),
                                "hasReferenceVideo": bool(reference_video_url),
                                "hasReferenceAudio": bool(reference_audio_url),
                                "attachmentCount": len(attachments or []),
                                "referenceImageAssetCount": len(reference_image_asset_ids or []),
                            },
                        }
                    ).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                ),
                timeout=1,
            ).read()
        except Exception:
            pass
        # #endregion

        try:
            video_result = await video_gen_service.generate(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                duration=duration,
                generation_mode=generation_mode,
                reference_mode=reference_mode,
                first_frame_url=first_frame_url,
                last_frame_url=last_frame_url,
                resolution=resolution,
                ratio=ratio,
                generate_audio=with_audio,
                audio_type=audio_type,
                audio_setting=audio_setting,
                off_peak=bool(off_peak),
                watermark=watermark,
                reference_video_url=reference_video_url,
                reference_audio_url=reference_audio_url,
                mentions=mentions,
                subjects=subjects,
                multiframe_segments=multiframe_segments,
                attachments=attachments,
                first_frame_asset_id=first_frame_asset_id,
                last_frame_asset_id=last_frame_asset_id,
                reference_video_asset_id=reference_video_asset_id,
                reference_audio_asset_id=reference_audio_asset_id,
                reference_image_asset_ids=reference_image_asset_ids or [],
            )
        except Exception as exc:
            task.status = "failed"
            task.fail_count = 1
            _update_creation_video_task_runtime_state(
                task,
                current_stage="queued",
                partial_ready=False,
                metadata_commit_status="pending",
            )
            task.results = [{"success": False, "error": str(exc)}]
            await db.commit()
            await _create_notification(
                db, user_id, "creation_log", "视频生成失败", str(exc), "/project"
            )
            return

        if not video_result.get("url"):
            result_keys = list(video_result.keys()) if isinstance(video_result, dict) else []
            error_message = (
                "视频生成未返回地址"
                + (f"，返回字段={result_keys[:12]}" if result_keys else "")
            )
            task.status = "failed"
            task.fail_count = 1
            _update_creation_video_task_runtime_state(
                task,
                current_stage="queued",
                partial_ready=False,
                metadata_commit_status="pending",
            )
            task.results = [{"success": False, "error": error_message}]
            await db.commit()
            return

        try:
            video_url = await persist_if_external(
                video_result["url"],
                "creation/global/videos",
                fallback_extension=get_media_fallback_extension("video"),
                url_label="创作视频地址",
            )
        except Exception as exc:
            task.status = "failed"
            task.fail_count = 1
            _update_creation_video_task_runtime_state(
                task,
                current_stage="queued",
                partial_ready=False,
                metadata_commit_status="pending",
            )
            task.results = [{"success": False, "error": f"视频文件落盘失败: {str(exc)}"}]
            await db.commit()
            return
        if not video_url:
            task.status = "failed"
            task.fail_count = 1
            _update_creation_video_task_runtime_state(
                task,
                current_stage="queued",
                partial_ready=False,
                metadata_commit_status="pending",
            )
            task.results = [{"success": False, "error": "视频生成未返回可保存的视频地址"}]
            await db.commit()
            return

        partial_metadata = build_video_playback_metadata(
            video_result,
            preview_video_url=video_url,
            download_url=video_url,
        )
        task.status = "partial"
        task.success_count = 1
        task.fail_count = 0
        _update_creation_video_task_runtime_state(
            task,
            current_stage=str(partial_metadata.get("video_pipeline_stage") or "metadata_committing"),
            partial_ready=bool(partial_metadata.get("partial_ready")),
            metadata_commit_status=str(partial_metadata.get("metadata_commit_status") or "pending"),
        )
        task.results = [
            _build_creation_video_task_result(
                video_url=video_url,
                thumbnail_url=None,
                duration=video_result.get("duration") or duration,
                metadata=partial_metadata,
            )
        ]
        await db.commit()

        postprocess_warnings: list[str] = []
        try:
            thumbnail_url = await persist_if_external(
                video_result.get("thumbnail_url") or None,
                "creation/global/video-thumbnails",
                fallback_extension=get_media_fallback_extension("image"),
                url_label="创作视频缩略图地址",
            )
        except Exception as exc:
            thumbnail_url = None
            postprocess_warnings.append(f"视频缩略图落盘失败: {str(exc)}")

        try:
            stored_reference_images = await persist_many_if_external(
                [url for url in [first_frame_url, last_frame_url] if url],
                "creation/global/video-reference-images",
                fallback_extension=get_media_fallback_extension("image"),
                url_label="创作视频参考图地址",
            )
        except Exception as exc:
            stored_reference_images = []
            postprocess_warnings.append(f"创作视频参考图落盘失败: {str(exc)}")

        stored_first_frame_url = stored_reference_images[0] if stored_reference_images else None
        stored_last_frame_url = stored_reference_images[1] if stored_reference_images and len(stored_reference_images) > 1 else None
        thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
            thumbnail_url,
            asset_type="video",
        )
        if not thumbnail_url:
            thumbnail_url, derivative_metadata = await _derive_video_thumbnail_from_first_frame(video_url)
        video_playback_metadata = build_video_playback_metadata(
            video_result,
            preview_video_url=video_url,
            download_url=video_url,
            poster_url=thumbnail_url,
        )

        asset = Asset(
            user_id=user_id,
            project_id=UUID(project_id) if project_id else None,
            name=f"创作视频 - {prompt[:30]}",
            asset_type="video",
            category="storyboard",
            file_url=video_url,
            thumbnail_url=thumbnail_url or None,
            prompt=prompt,
            model=model,
            size=resolution,
            metadata_json={
                "source": "creation_video",
                "duration": video_result.get("duration") or duration,
                "ratio": ratio,
                "resolution": resolution,
                "generation_mode": generation_mode,
                "reference_mode": reference_mode,
                "watermark": watermark,
                "audio_setting": audio_setting,
                "first_frame_url": stored_first_frame_url,
                "last_frame_url": stored_last_frame_url,
                "session_id": session_id,
                "shot_id": shot_id,
                "project_id": project_id,
                "with_audio": with_audio,
                "prompt_raw": prompt,
                "prompt_resolved": video_result.get("prompt_resolved") or prompt,
                "asset_bindings": video_result.get("asset_bindings") or attachments or [],
                **video_playback_metadata,
                **derivative_metadata,
            },
        )
        db.add(asset)
        await db.flush()

        task.status = "completed"
        task.success_count = 1
        task.fail_count = 0
        _update_creation_video_task_runtime_state(
            task,
            current_stage=str(video_playback_metadata.get("video_pipeline_stage") or "completed"),
            partial_ready=bool(video_playback_metadata.get("partial_ready")),
            metadata_commit_status=str(video_playback_metadata.get("metadata_commit_status") or "ready"),
        )
        task.results = [
            _build_creation_video_task_result(
                video_url=video_url,
                thumbnail_url=thumbnail_url,
                asset_id=str(asset.id),
                duration=video_result.get("duration") or duration,
                warning="；".join(postprocess_warnings) if postprocess_warnings else None,
                metadata=video_playback_metadata,
            )
        ]
        await db.commit()

        await _create_notification(
            db, user_id, "creation_log", "视频生成完成", f"模型: {model}", "/project"
        )


# ─── Creation Audio Endpoints ───────────────────────────────────────────────────


class CreationAudioGenerateRequest(TTSAdvancedOptionsMixin):
    text: str
    prompt_raw: str | None = None
    prompt_resolved: str | None = None
    voice_id: str | None = None
    speed: float = 1.0
    emotion: str | None = None
    model: str | None = None
    session_id: str | None = None
    shot_id: str | None = None
    project_id: str | None = None
    reference_audio_url: str | None = None
    attachments: list["CreationAssetBinding"] | None = None
    mentions: list["CreationPromptMention"] | None = None


class CreationBatchAudioRequest(BaseModel):
    audio_ids: list[str] = Field(default_factory=list)


@router.post(
    "/audios/generate",
    summary="同步生成创作配音",
    description="对较短文本执行同步 TTS 生成，适合即时返回的创作配音场景。",
    response_description="同步生成的配音结果。",
)
async def generate_creation_audio(
    req: CreationAudioGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate audio via TTS (synchronous - TTS is fast)"""
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Text cannot be empty")
    if len(text) > 10000:
        raise HTTPException(400, "Text too long for sync audio generation (max 10000 chars). Please use async generation.")

    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=req.session_id,
        shot_id=req.shot_id,
        project_id=req.project_id,
    )
    mentions = _resolve_prompt_mentions(req.model_dump())
    attachments = _resolve_asset_bindings(req.model_dump())
    prompt_raw, prompt_resolved, resolved_reference_audio_url, mentions, attachments = _resolve_audio_binding_context(
        spoken_text=text,
        prompt_raw=req.prompt_raw,
        prompt_resolved=req.prompt_resolved,
        reference_audio_url=req.reference_audio_url,
        mentions=mentions,
        attachments=attachments,
    )

    # Get user API key
    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="voice",
        requested_model=req.model,
    )
    if not key_data:
        detail = "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"
        if req.model:
            detail = f"未找到可用的配音模型 {req.model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)
    api_key, base_url, provider_type, model_id = key_data

    reference_voice_binding = await _resolve_creation_audio_reference_voice_binding(
        db=db,
        user=user,
        reference_audio_url=resolved_reference_audio_url,
    )
    effective_requested_voice_id = (
        str(req.voice_id or "").strip()
        or str((reference_voice_binding or {}).get("voice_id") or "").strip()
        or "zh-CN-XiaoxiaoNeural"
    )
    requested_voice_source = (
        "explicit_voice"
        if str(req.voice_id or "").strip()
        else "reference_audio"
        if reference_voice_binding and reference_voice_binding.get("voice_id")
        else "default_voice"
    )
    voice_context = await _resolve_creation_audio_voice_context(
        db=db,
        user=user,
        requested_voice_id=effective_requested_voice_id,
    )

    provider_options = build_tts_provider_options(
        req,
        default_voice_id=voice_context["upstream_voice_id"],
        default_speed=req.speed,
        default_emotion=req.emotion,
    )

    # Call TTS service
    try:
        result = await tts_service.generate(
            text=text,
            api_key=api_key,
            base_url=base_url,
            voice=voice_context["upstream_voice_id"],
            speed=req.speed,
            model=model_id,
            provider_type=provider_type,
            provider_options=provider_options,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"配音生成失败: {str(exc)}") from exc

    # Persist audio file
    try:
        audio_url = await persist_if_external(
            result["url"],
            "creation/audio",
            fallback_extension=get_media_fallback_extension("audio"),
            url_label="创作配音地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"配音文件落盘失败: {str(exc)}") from exc
    if not audio_url:
        raise HTTPException(status_code=502, detail="配音文件落盘失败: 未返回可保存的音频地址")

    return await _create_creation_audio_records(
        db=db,
        user=user,
        project_id=project.id if project else None,
        session_id=str(session.id) if session else None,
        shot_id=str(shot.id) if shot else None,
        text=text,
        requested_voice_id=voice_context["upstream_voice_id"],
        voice_name=voice_context["voice_name"],
        speed=req.speed,
        emotion=req.emotion,
        audio_url=audio_url,
        duration=result.get("duration", len(text) * 0.3),
        model_id=model_id,
        provider_type=provider_type,
        provider_options=provider_options,
        tts_metadata=result.get("metadata"),
        voice_context=voice_context,
        extra_metadata={
            "prompt_raw": prompt_raw,
            "prompt_resolved": prompt_resolved,
            "mentions": mentions,
            "asset_bindings": attachments,
            "binding_mode": "reference_only",
            "spoken_text": text,
            "reference_audio_url": resolved_reference_audio_url,
            "reference_audio_voice_id": (reference_voice_binding or {}).get("voice_id"),
            "reference_audio_voice_name": (reference_voice_binding or {}).get("voice_name"),
            "requested_voice_source": requested_voice_source,
        },
    )


@router.post(
    "/audios/generate-async",
    response_model=CreationTaskResponse,
    status_code=201,
    summary="创建异步创作配音任务",
    description="对长文本创建异步配音任务。当前仅支持 MiniMax 官方 voice 模型。",
    response_description="异步配音任务。",
)
async def generate_creation_audio_async(
    req: CreationAudioGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Text cannot be empty")
    if len(text) >= 100000:
        raise HTTPException(400, "Text too long (max 99999 chars)")

    session, shot, project = await _resolve_creation_scope(
        user=user,
        db=db,
        session_id=req.session_id,
        shot_id=req.shot_id,
        project_id=req.project_id,
    )
    mentions = _resolve_prompt_mentions(req.model_dump())
    attachments = _resolve_asset_bindings(req.model_dump())
    prompt_raw, prompt_resolved, resolved_reference_audio_url, mentions, attachments = _resolve_audio_binding_context(
        spoken_text=text,
        prompt_raw=req.prompt_raw,
        prompt_resolved=req.prompt_resolved,
        reference_audio_url=req.reference_audio_url,
        mentions=mentions,
        attachments=attachments,
    )

    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="voice",
        requested_model=req.model,
    )
    if not key_data:
        detail = "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"
        if req.model:
            detail = f"未找到可用的配音模型 {req.model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)
    api_key, base_url, provider_type, model_id = key_data
    if str(provider_type or "").strip().lower() != "minimax":
        raise HTTPException(status_code=400, detail="长文本异步配音当前仅支持 MiniMax 官方 voice 模型")

    reference_voice_binding = await _resolve_creation_audio_reference_voice_binding(
        db=db,
        user=user,
        reference_audio_url=resolved_reference_audio_url,
    )
    effective_requested_voice_id = (
        str(req.voice_id or "").strip()
        or str((reference_voice_binding or {}).get("voice_id") or "").strip()
        or "zh-CN-XiaoxiaoNeural"
    )
    requested_voice_source = (
        "explicit_voice"
        if str(req.voice_id or "").strip()
        else "reference_audio"
        if reference_voice_binding and reference_voice_binding.get("voice_id")
        else "default_voice"
    )
    voice_context = await _resolve_creation_audio_voice_context(
        db=db,
        user=user,
        requested_voice_id=effective_requested_voice_id,
    )
    provider_options = build_tts_provider_options(
        req,
        default_voice_id=voice_context["upstream_voice_id"],
        default_speed=req.speed,
        default_emotion=req.emotion,
    ) or {}

    payload: dict[str, Any] = {
        "model": model_id or "",
        "text": text,
        "voice_setting": {
            "voice_id": voice_context["upstream_voice_id"],
            "speed": req.speed,
            "vol": 1,
            "pitch": 0,
            **dict(provider_options.get("voice_setting") or {}),
        },
    }
    audio_setting = dict(provider_options.get("audio_setting") or {})
    if audio_setting.get("sample_rate") is not None and audio_setting.get("audio_sample_rate") is None:
        audio_setting["audio_sample_rate"] = audio_setting.pop("sample_rate")
    for field_name in (
        "language_boost",
        "pronunciation_dict",
        "voice_modify",
        "subtitle_enable",
        "subtitle_type",
        "output_format",
        "timbre_weights",
    ):
        value = provider_options.get(field_name)
        if value is not None:
            payload[field_name] = value
    if audio_setting:
        payload["audio_setting"] = audio_setting

    runtime = MiniMaxProviderRuntime(api_key=api_key, base_url=base_url)
    try:
        provider_result = await create_minimax_async_tts_task(runtime, payload)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"异步配音任务创建失败: {str(exc)}") from exc

    provider_task_id = (
        provider_result.get("task_id")
        or (provider_result.get("data") or {}).get("task_id")
    )
    if not provider_task_id:
        raise HTTPException(status_code=502, detail="异步配音任务创建失败: MiniMax 未返回 task_id")

    task = GenTask(
        user_id=user.id,
        project_id=project.id if project else None,
        task_type="creation_audio",
        status="pending",
        total_count=1,
        model=model_id,
        size="long_text_audio",
        params={
            "text": text,
            "request_text_length": len(text),
            "model": model_id,
            "provider_type": provider_type,
            "provider_task_id": str(provider_task_id),
            "voice_id": effective_requested_voice_id,
            "provider_voice_id": voice_context["upstream_voice_id"],
            "voice_name": voice_context["voice_name"],
            "voice_origin": voice_context["voice_origin"],
            "voice_db_id": str(voice_context["voice"].id) if voice_context.get("voice") else None,
            "clone_status_snapshot": voice_context.get("clone_status"),
            "requested_voice_source": requested_voice_source,
            "reference_audio_url": resolved_reference_audio_url,
            "reference_audio_voice_id": (reference_voice_binding or {}).get("voice_id"),
            "reference_audio_voice_name": (reference_voice_binding or {}).get("voice_name"),
            "prompt_raw": prompt_raw,
            "prompt_resolved": prompt_resolved,
            "mentions": mentions,
            "asset_bindings": attachments,
            "binding_mode": "reference_only",
            "spoken_text": text,
            "speed": req.speed,
            "emotion": req.emotion,
            "tts_request_options": provider_options,
            "session_id": str(session.id) if session else None,
            "shot_id": str(shot.id) if shot else None,
            "project_id": str(project.id) if project else None,
            "provider_payload": provider_result,
        },
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _task_to_response(task)


@router.get(
    "/audios/tasks/{task_id}",
    response_model=CreationAudioTaskStatusResponse,
    summary="轮询异步创作配音任务",
    description="轮询长文本异步配音任务，并在完成后返回音频结果。",
    response_description="异步配音任务状态。",
)
async def poll_creation_audio_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GenTask).where(
            GenTask.id == UUID(task_id),
            GenTask.user_id == user.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task or task.task_type != "creation_audio":
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status in {"completed", "failed"}:
        return await _build_creation_audio_task_status(task, db)

    params = dict(task.params or {})
    provider_task_id = str(params.get("provider_task_id") or "").strip()
    if not provider_task_id:
        task.status = "failed"
        task.fail_count = 1
        task.results = [{"success": False, "error": "缺少上游任务 ID"}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="voice",
        requested_model=task.model,
    )
    if not key_data:
        task.status = "failed"
        task.fail_count = 1
        task.results = [{"success": False, "error": "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    api_key, base_url, provider_type, model_id = key_data
    if str(provider_type or "").strip().lower() != "minimax":
        task.status = "failed"
        task.fail_count = 1
        task.results = [{"success": False, "error": "长文本异步配音当前仅支持 MiniMax 官方 voice 模型"}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    runtime = MiniMaxProviderRuntime(api_key=api_key, base_url=base_url)
    try:
        provider_payload = await query_minimax_async_tts_task(runtime, provider_task_id)
    except Exception as exc:
        task.status = "failed"
        task.fail_count = 1
        params["error_msg"] = f"查询异步配音任务失败: {str(exc)}"
        task.params = params
        task.results = [{"success": False, "error": params["error_msg"]}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    provider_result = extract_minimax_async_audio_result(provider_payload)
    provider_status = normalize_minimax_async_status(provider_payload)
    params["provider_status"] = provider_status
    params["provider_query_payload"] = provider_payload
    task.params = params

    if provider_status in {"processing", "pending"}:
        task.status = "running"
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    if provider_status in {"failed", "expired"}:
        task.status = "failed"
        task.fail_count = 1
        error_message = "异步音频结果已过期，请重新生成" if provider_status == "expired" else "异步配音生成失败"
        params["error_msg"] = error_message
        task.params = params
        task.results = [{"success": False, "error": error_message, "provider_status": provider_status}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    audio_url = provider_result.get("audio_url")
    if audio_url:
        try:
            persisted_audio_url = await persist_if_external(
                audio_url,
                "creation/audio",
                fallback_extension=get_media_fallback_extension("audio"),
                url_label="创作异步配音地址",
            )
        except Exception as exc:
            task.status = "failed"
            task.fail_count = 1
            params["error_msg"] = f"异步配音文件落盘失败: {str(exc)}"
            task.params = params
            task.results = [{"success": False, "error": params["error_msg"]}]
            await db.commit()
            return await _build_creation_audio_task_status(task, db)
    elif provider_result.get("file_id"):
        try:
            audio_bytes, content_type = await download_minimax_file_content(runtime, str(provider_result["file_id"]))
            persisted_audio_url = _persist_creation_audio_bytes(audio_bytes, content_type)
        except Exception as exc:
            task.status = "failed"
            task.fail_count = 1
            params["error_msg"] = f"异步配音文件下载失败: {str(exc)}"
            task.params = params
            task.results = [{"success": False, "error": params["error_msg"]}]
            await db.commit()
            return await _build_creation_audio_task_status(task, db)
    else:
        task.status = "failed"
        task.fail_count = 1
        params["error_msg"] = "异步配音未返回音频结果"
        task.params = params
        task.results = [{"success": False, "error": params["error_msg"]}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    if not persisted_audio_url:
        task.status = "failed"
        task.fail_count = 1
        params["error_msg"] = "异步配音未返回可保存的音频地址"
        task.params = params
        task.results = [{"success": False, "error": params["error_msg"]}]
        await db.commit()
        return await _build_creation_audio_task_status(task, db)

    voice_context = {
        "voice": None,
        "clone_status": params.get("clone_status_snapshot"),
        "upstream_voice_id": params.get("provider_voice_id") or params.get("voice_id"),
        "voice_name": params.get("voice_name") or params.get("voice_id"),
        "voice_origin": params.get("voice_origin") or "official",
    }
    if params.get("voice_db_id"):
        voice_row = await db.execute(select(Voice).where(Voice.id == UUID(str(params["voice_db_id"]))))
        voice_context["voice"] = voice_row.scalar_one_or_none()

    created = await _create_creation_audio_records(
        db=db,
        user=user,
        project_id=task.project_id,
        session_id=str(params.get("session_id")) if params.get("session_id") else None,
        shot_id=str(params.get("shot_id")) if params.get("shot_id") else None,
        text=str(params.get("text") or ""),
        requested_voice_id=str(params.get("provider_voice_id") or params.get("voice_id") or ""),
        voice_name=str(params.get("voice_name") or params.get("voice_id") or "未命名音色"),
        speed=float(params.get("speed") or 1.0),
        emotion=str(params.get("emotion")) if params.get("emotion") else None,
        audio_url=persisted_audio_url,
        duration=0.0,
        model_id=model_id,
        provider_type=provider_type,
        provider_options=params.get("tts_request_options"),
        tts_metadata={
            "async_provider_result": provider_result.get("raw_payload"),
            "trace_id": provider_result.get("trace_id"),
            "file_id": provider_result.get("file_id"),
            "task_id": provider_task_id,
        },
        voice_context=voice_context,
        extra_metadata={
            "async_task_id": str(task.id),
            "async_provider_task_id": provider_task_id,
            "prompt_raw": params.get("prompt_raw"),
            "prompt_resolved": params.get("prompt_resolved"),
            "mentions": params.get("mentions"),
            "asset_bindings": params.get("asset_bindings"),
            "binding_mode": params.get("binding_mode") or "reference_only",
            "spoken_text": params.get("spoken_text"),
            "reference_audio_url": str(params.get("reference_audio_url") or "").strip() or None,
            "reference_audio_voice_id": params.get("reference_audio_voice_id"),
            "reference_audio_voice_name": params.get("reference_audio_voice_name"),
            "requested_voice_source": params.get("requested_voice_source"),
        },
    )
    task.status = "completed"
    task.success_count = 1
    task.fail_count = 0
    task.results = [{
        "success": True,
        "asset_id": created["asset_id"],
        "audio_url": created["audio_url"],
        "file_id": provider_result.get("file_id"),
    }]
    task.params = params
    await db.commit()
    return await _build_creation_audio_task_status(task, db)


@router.get(
    "/audios",
    summary="获取创作配音列表",
    description="查询当前用户的创作配音列表，支持分页、搜索和收藏过滤。",
    response_description="创作配音列表。",
)
async def list_creation_audios(
    page: int = 1,
    page_size: int = CREATION_LIST_DEFAULT_PAGE_SIZE,
    is_favorite: bool | None = None,
    search: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List creation audio clips"""
    query = select(AudioClip).where(
        AudioClip.user_id == user.id,
        AudioClip.source == "creation",
    )

    if is_favorite is not None:
        query = query.where(AudioClip.is_favorite == is_favorite)
    if search:
        query = query.where(AudioClip.text.ilike(f"%{search}%"))

    # Count
    count_q = select(sa_func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(AudioClip.created_at.desc(), AudioClip.id.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(query)).scalars().all()

    # Get voice names
    voice_ids = list(set(r.voice_id for r in rows))
    voice_map: dict[str, str] = {}
    if voice_ids:
        vq = await db.execute(select(Voice).where(Voice.voice_id.in_(voice_ids)))
        for v in vq.scalars().all():
            voice_map[v.voice_id] = v.name

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, rows)
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, rows, include_deleted=True)

    items = []
    for r in rows:
        deleted_asset = all_asset_map.get(str(r.id))
        if deleted_asset and deleted_asset.is_deleted:
            continue
        asset = active_asset_map.get(str(r.id))
        asset_metadata = dict(asset.metadata_json or {}) if asset and asset.metadata_json else {}
        items.append({
            "id": str(r.id),
            "asset_id": str(asset.id) if asset else None,
            "project_id": str(r.project_id) if r.project_id else None,
            "name": asset.name if asset else f"配音-{voice_map.get(r.voice_id, r.voice_id)}",
            "text": r.text,
            "prompt": asset.prompt if asset and asset.prompt else r.text,
            "voice_id": r.voice_id,
            "voice_name": voice_map.get(r.voice_id, r.voice_id),
            "audio_url": r.audio_url,
            "duration": r.duration,
            "speed": r.speed,
            "emotion": r.emotion,
            "is_favorite": bool(r.is_favorite or (asset.is_starred if asset else False)),
            "model": asset.model if asset else asset_metadata.get("model"),
            "metadata_json": asset_metadata or None,
            "created_at": r.created_at.isoformat(),
        })

    return {
        "list": items,
        "total": total,
        "has_more": page * page_size < total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/audios/{audio_id}",
    summary="获取创作配音详情",
    description="读取单条创作配音详情。",
    response_description="创作配音详情。",
)
async def get_creation_audio_detail(
    audio_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await db.get(AudioClip, UUID(audio_id))
    if not clip or clip.user_id != user.id or clip.source != "creation":
        raise HTTPException(status_code=404, detail="配音不存在")

    voice_name = clip.voice_id
    voice_row = await db.execute(select(Voice).where(Voice.voice_id == clip.voice_id))
    voice = voice_row.scalar_one_or_none()
    if voice:
        voice_name = voice.name

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip])
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip], include_deleted=True)
    deleted_asset = all_asset_map.get(str(clip.id))
    if deleted_asset and deleted_asset.is_deleted:
        raise HTTPException(status_code=404, detail="配音不存在")
    asset = active_asset_map.get(str(clip.id))
    asset_metadata = dict(asset.metadata_json or {}) if asset and asset.metadata_json else {}
    return {
        "id": str(clip.id),
        "asset_id": str(asset.id) if asset else None,
        "project_id": str(clip.project_id) if clip.project_id else None,
        "name": asset.name if asset else f"配音-{voice_name}",
        "text": clip.text,
        "prompt": asset.prompt if asset and asset.prompt else clip.text,
        "voice_id": clip.voice_id,
        "voice_name": voice_name,
        "audio_url": clip.audio_url,
        "duration": clip.duration,
        "speed": clip.speed,
        "emotion": clip.emotion,
        "is_favorite": bool(clip.is_favorite or (asset.is_starred if asset else False)),
        "model": asset.model if asset else asset_metadata.get("model"),
        "metadata_json": asset_metadata or None,
        "created_at": clip.created_at.isoformat(),
    }


@router.get(
    "/audios/{audio_id}/download",
    summary="下载创作配音",
    description="下载指定创作配音文件。",
    response_description="音频二进制流。",
)
async def download_creation_audio(
    audio_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await db.get(AudioClip, UUID(audio_id))
    if not clip or clip.user_id != user.id or clip.source != "creation":
        raise HTTPException(status_code=404, detail="配音不存在")

    voice_name = clip.voice_id
    voice_row = await db.execute(select(Voice).where(Voice.voice_id == clip.voice_id))
    voice = voice_row.scalar_one_or_none()
    if voice:
        voice_name = voice.name

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip])
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip], include_deleted=True)
    deleted_asset = all_asset_map.get(str(clip.id))
    if deleted_asset and deleted_asset.is_deleted:
        raise HTTPException(status_code=404, detail="配音不存在")
    asset = active_asset_map.get(str(clip.id))
    try:
        media = _resolve_creation_audio_media(
            audio_url=clip.audio_url,
            metadata=asset.metadata_json or {} if asset else {},
            user_id=str(user.id),
            project_id=str(asset.project_id) if asset and asset.project_id else None,
            resource_id=str(asset.id) if asset else str(clip.id),
        )
        download_target = resolve_verified_download_target_from_url(
            str(media["download_url"] or clip.audio_url),
            expected_user_id=str(user.id),
        )
        content = await _read_media_bytes(download_target, timeout=60.0)
    except MediaDownloadAccessError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"下载配音失败: {str(exc)}") from exc

    filename = _build_creation_audio_filename(clip, 1, voice_name=voice_name, asset=asset)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="audio/mpeg",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.delete(
    "/audios/{audio_id}",
    summary="删除创作配音",
    description="删除指定创作配音对应的资产记录。",
    response_description="删除结果。",
)
async def delete_creation_audio(
    audio_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await db.get(AudioClip, UUID(audio_id))
    if not clip or clip.user_id != user.id or clip.source != "creation":
        raise HTTPException(status_code=404, detail="配音不存在")

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip])
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip], include_deleted=True)
    deleted_asset = all_asset_map.get(str(clip.id))
    if deleted_asset and deleted_asset.is_deleted:
        raise HTTPException(status_code=404, detail="配音不存在")

    asset = active_asset_map.get(str(clip.id))
    if asset:
        mark_asset_deleted(asset)
    await db.commit()
    return {"success": True}


@router.post(
    "/audios/{audio_id}/favorite",
    summary="切换创作配音收藏状态",
    description="切换指定创作配音的收藏状态。",
    response_description="收藏切换结果。",
)
async def toggle_creation_audio_favorite(
    audio_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clip = await db.get(AudioClip, UUID(audio_id))
    if not clip or clip.user_id != user.id or clip.source != "creation":
        raise HTTPException(status_code=404, detail="配音不存在")

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip])
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, [clip], include_deleted=True)
    deleted_asset = all_asset_map.get(str(clip.id))
    if deleted_asset and deleted_asset.is_deleted:
        raise HTTPException(status_code=404, detail="配音不存在")

    asset = active_asset_map.get(str(clip.id))
    next_favorite = not bool(clip.is_favorite or (asset.is_starred if asset else False))
    clip.is_favorite = next_favorite
    if asset:
        asset.is_starred = next_favorite
    await db.commit()
    return {"is_favorite": next_favorite}


@router.post(
    "/audios/batch-delete",
    summary="批量删除创作配音",
    description="批量删除创作配音对应的资产记录。当前为软删除语义，成功后返回删除数量。",
    response_description="批量删除结果。",
)
async def batch_delete_creation_audios(
    req: CreationBatchAudioRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = [audio_id.strip() for audio_id in req.audio_ids if audio_id.strip()]
    if not ids:
        return {"deleted": 0}

    result = await db.execute(
        select(AudioClip).where(
            AudioClip.id.in_([UUID(audio_id) for audio_id in ids]),
            AudioClip.user_id == user.id,
            AudioClip.source == "creation",
        )
    )
    clips = result.scalars().all()
    active_asset_map = await _load_creation_audio_asset_map(db, user.id, clips)
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, clips, include_deleted=True)

    deleted = 0
    for clip in clips:
        deleted_asset = all_asset_map.get(str(clip.id))
        if deleted_asset and deleted_asset.is_deleted:
            continue
        asset = active_asset_map.get(str(clip.id))
        if asset and mark_asset_deleted(asset):
            deleted += 1

    await db.commit()
    return {"deleted": deleted}


@router.post(
    "/audios/batch-download",
    summary="批量下载创作配音",
    description="按提交的配音 ID 列表打包下载创作配音文件。",
    response_description="创作配音 zip 压缩包流。",
)
async def batch_download_creation_audios(
    req: CreationBatchAudioRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ids = [audio_id.strip() for audio_id in req.audio_ids if audio_id.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="请选择至少一个配音")

    result = await db.execute(
        select(AudioClip).where(
            AudioClip.id.in_([UUID(audio_id) for audio_id in ids]),
            AudioClip.user_id == user.id,
            AudioClip.source == "creation",
        )
    )
    clips = result.scalars().all()
    if not clips:
        raise HTTPException(status_code=404, detail="未找到可下载的配音")

    voice_ids = list(set(clip.voice_id for clip in clips))
    voice_map: dict[str, str] = {}
    if voice_ids:
        voice_result = await db.execute(select(Voice).where(Voice.voice_id.in_(voice_ids)))
        for voice in voice_result.scalars().all():
            voice_map[voice.voice_id] = voice.name

    active_asset_map = await _load_creation_audio_asset_map(db, user.id, clips)
    all_asset_map = await _load_creation_audio_asset_map(db, user.id, clips, include_deleted=True)
    zip_buffer = io.BytesIO()
    added = 0
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for index, clip in enumerate(clips, start=1):
            deleted_asset = all_asset_map.get(str(clip.id))
            if deleted_asset and deleted_asset.is_deleted:
                continue
            asset = active_asset_map.get(str(clip.id))
            content: bytes | None = None
            for candidate_url in _iter_creation_audio_download_attempts(clip, asset=asset):
                try:
                    resolved_target = resolve_verified_download_target_from_url(
                        candidate_url,
                        expected_user_id=str(user.id),
                    )
                    content = await _read_media_bytes(resolved_target, timeout=60.0)
                    break
                except MediaDownloadAccessError as exc:
                    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
                except Exception:
                    continue
            if content is None:
                continue
            filename = _build_creation_audio_filename(
                clip,
                index,
                voice_name=voice_map.get(clip.voice_id, clip.voice_id),
                asset=asset,
            )
            zip_file.writestr(f"{_sanitize_zip_segment('creation_audios')}/{filename}", content)
            added += 1

    if added == 0:
        raise HTTPException(status_code=502, detail="配音文件暂时不可下载")

    zip_buffer.seek(0)
    download_name = "creation_audios.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )
