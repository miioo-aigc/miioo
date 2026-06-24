import base64
import json
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import List, Literal
from urllib.parse import quote, unquote, urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, func as sa_func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.asset import Asset
from app.models.episode import Episode
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse
from app.services.asset_recycle import (
    apply_asset_visibility,
    mark_asset_deleted,
    restore_asset,
)
from app.services.asset_reference_cleanup import cleanup_asset_references
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.media_fetch import read_media_bytes
from app.services.image_derivatives import (
    build_derivative_metadata,
    generate_asset_card_thumbnail,
)
from app.services.media_references import delete_managed_upload_if_unreferenced
from app.services.media_storage import (
    build_managed_storage_metadata,
    get_media_fallback_extension,
    is_external_media_url,
    is_managed_upload_url,
    persist_if_external,
    persist_many_if_external,
    resolve_upload_path,
)
from app.services.media_view_models import (
    build_audio_media_fields,
    build_image_media_fields,
    build_video_media_fields,
)
from app.services.video_frame import ExtractedVideoFrame, extract_video_frame
from app.utils.media_urls import pick_safe_thumbnail_url
from app.utils.url_security import validate_outbound_url

router = APIRouter()
ASSET_IMPORT_SUBDIRS = {
    "image": "assets/imported/images",
    "video": "assets/imported/videos",
    "audio": "assets/imported/audios",
    "document": "assets/imported/documents",
}
ASSET_LIST_DEFAULT_LIMIT = 100
ASSET_LIST_MAX_LIMIT = 200
ASSET_CURSOR_VERSION = 1
CHINESE_DIGITS = "零一二三四五六七八九"
ASSET_LIST_METADATA_KEYS = {
    "duration",
    "duration_seconds",
    "thumbnail_url",
    "auto_thumbnail_url",
    "auto_thumbnail_generated",
    "resolution",
    "ratio",
    "shot_number",
    "source",
}


def _number_to_chinese(value: int) -> str:
    if value <= 0:
        return str(value)

    parts: list[str] = []
    units = ["", "十", "百", "千", "万"]
    zero_pending = False
    unit_index = 0
    remaining = value

    while remaining > 0:
        remaining, digit = divmod(remaining, 10)
        if digit == 0:
            if parts:
                zero_pending = True
        else:
            if zero_pending:
                parts.append(CHINESE_DIGITS[0])
                zero_pending = False
            parts.append(f"{CHINESE_DIGITS[digit]}{units[unit_index]}")
        unit_index += 1

    result = "".join(reversed(parts))
    return result[1:] if result.startswith("一十") else result


def _format_episode_label(episode_number: int | None) -> str | None:
    if episode_number is None or episode_number <= 0:
        return None
    return f"第{_number_to_chinese(episode_number)}集"


def _extract_storyboard_id(asset: Asset) -> str | None:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    storyboard_id = metadata.get("storyboard_id")
    if storyboard_id is None:
        return None
    cleaned = str(storyboard_id).strip()
    return cleaned or None


def _parse_uuid_or_none(value: object) -> UUID | None:
    if value is None:
        return None
    try:
        cleaned = str(value).strip()
    except Exception:
        return None
    if not cleaned:
        return None
    try:
        return UUID(cleaned)
    except (ValueError, TypeError, AttributeError):
        return None


async def _build_storyboard_episode_label_map(
    db: AsyncSession,
    assets: list[Asset],
) -> dict[str, str]:
    storyboard_uuid_map = {
        str(storyboard_uuid): storyboard_uuid
        for storyboard_uuid in (
            _parse_uuid_or_none(_extract_storyboard_id(asset))
            for asset in assets
        )
        if storyboard_uuid
    }
    if not storyboard_uuid_map:
        return {}

    storyboard_rows = await db.execute(
        select(Storyboard.id, Storyboard.episode_id).where(
            Storyboard.id.in_(storyboard_uuid_map.values())
        )
    )
    storyboard_episode_ids = {
        str(storyboard_id): str(episode_id) if episode_id else None
        for storyboard_id, episode_id in storyboard_rows.all()
    }
    episode_ids = {
        episode_uuid
        for episode_uuid in (
            _parse_uuid_or_none(episode_id)
            for episode_id in storyboard_episode_ids.values()
        )
        if episode_uuid
    }
    if not episode_ids:
        return {}

    episode_rows = await db.execute(
        select(Episode.id, Episode.episode_number).where(Episode.id.in_(episode_ids))
    )
    episode_number_map = {
        str(episode_id): episode_number
        for episode_id, episode_number in episode_rows.all()
    }
    return {
        storyboard_id: label
        for storyboard_id, episode_id in storyboard_episode_ids.items()
        for label in [_format_episode_label(episode_number_map.get(episode_id)) if episode_id else None]
        if label
    }


def _resolve_asset_episode_label(
    asset: Asset,
    storyboard_episode_label_map: dict[str, str] | None = None,
) -> str | None:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    episode_label = metadata.get("episode_label") or metadata.get("episodeLabel")
    if isinstance(episode_label, str) and episode_label.strip():
        return episode_label.strip()

    storyboard_id = _extract_storyboard_id(asset)
    if not storyboard_id:
        return None
    return (storyboard_episode_label_map or {}).get(storyboard_id)


def _sanitize_download_name(value: str | None) -> str:
    raw = (value or "").strip()
    cleaned = "".join(ch if ch not in '<>:"/\\|?*' else "_" for ch in raw)
    collapsed = " ".join(cleaned.split())
    return collapsed[:80] or "asset"


def _guess_download_extension(url: str | None, asset_type: str | None) -> str:
    parsed = urlparse(url or "")
    suffix = Path(unquote(parsed.path or url or "")).suffix.lower()
    if suffix:
        return suffix
    return get_media_fallback_extension(asset_type)


def _build_asset_download_filename(asset: Asset, url: str | None) -> str:
    safe_name = _sanitize_download_name(asset.name)
    if Path(safe_name).suffix:
        return safe_name
    return f"{safe_name}{_guess_download_extension(url, asset.asset_type)}"


async def _read_media_bytes(url: str, *, label: str, timeout: float = 60.0) -> bytes:
    return await read_media_bytes(
        url,
        label=label,
        timeout=timeout,
        follow_redirects=True,
    )


def _iter_asset_download_candidates(a: Asset, *, prefer_origin: bool = True) -> list[tuple[str, str]]:
    metadata = a.metadata_json if isinstance(a.metadata_json, dict) else {}
    explicit_download_url = metadata.get("download_url") if isinstance(metadata.get("download_url"), str) else None
    origin_url = metadata.get("origin_url") if isinstance(metadata.get("origin_url"), str) else None
    ordered_candidates = (
        [
            (explicit_download_url, "资产下载地址"),
            (origin_url, "资产原始地址"),
            (a.file_url, "资产文件地址"),
        ]
        if prefer_origin
        else [
            (a.file_url, "资产文件地址"),
            (explicit_download_url, "资产下载地址"),
            (origin_url, "资产原始地址"),
        ]
    )
    candidates: list[tuple[str, str]] = []
    seen_urls: set[str] = set()
    for url, label in ordered_candidates:
        cleaned = str(url or "").strip()
        if not cleaned or cleaned in seen_urls:
            continue
        seen_urls.add(cleaned)
        candidates.append((cleaned, label))
    return candidates


def _iter_asset_download_attempts(a: Asset, *, prefer_origin: bool = True) -> list[tuple[str, str]]:
    resolved_media = _resolve_asset_media_fields(a)
    unified_download_url = str(resolved_media.get("download_url") or "").strip()
    legacy_candidates = _iter_asset_download_candidates(a, prefer_origin=prefer_origin)

    merged_candidates: list[tuple[str, str]] = []
    seen_urls: set[str] = set()

    def _append_candidate(url: str | None, label: str) -> None:
        cleaned = str(url or "").strip()
        if not cleaned or cleaned in seen_urls:
            return
        seen_urls.add(cleaned)
        merged_candidates.append((cleaned, label))

    if prefer_origin:
        _append_candidate(unified_download_url, "资产统一下载地址")
        for url, label in legacy_candidates:
            _append_candidate(url, label)
        return merged_candidates

    if legacy_candidates:
        first_url, first_label = legacy_candidates[0]
        _append_candidate(first_url, first_label)
        _append_candidate(unified_download_url, "资产统一下载地址")
        for url, label in legacy_candidates[1:]:
            _append_candidate(url, label)
        return merged_candidates

    _append_candidate(unified_download_url, "资产统一下载地址")
    return merged_candidates


def _resolve_asset_media_fields(a: Asset) -> dict:
    metadata = a.metadata_json if isinstance(a.metadata_json, dict) else {}
    common_kwargs = {
        "user_id": str(a.user_id),
        "project_id": str(a.project_id) if a.project_id else None,
        "resource_id": str(a.id),
    }

    if a.asset_type == "video":
        return build_video_media_fields(
            file_url=a.file_url,
            thumbnail_url=a.thumbnail_url,
            metadata=metadata,
            **common_kwargs,
        )
    if a.asset_type == "audio":
        return build_audio_media_fields(
            file_url=a.file_url,
            metadata=metadata,
            **common_kwargs,
        )
    return build_image_media_fields(
        file_url=a.file_url,
        thumbnail_url=a.thumbnail_url,
        metadata=metadata,
        **common_kwargs,
    )


def _is_creation_scope_asset() -> object:
    return or_(
        Asset.metadata_json["source"].as_string().like("creation_%"),
        and_(
            Asset.metadata_json["source"].as_string() == "upload",
            Asset.metadata_json["uploaded_via"].as_string() == "creation",
        ),
    )


def _to_response(
    a: Asset,
    *,
    storyboard_episode_label_map: dict[str, str] | None = None,
) -> AssetResponse:
    media_fields = _resolve_asset_media_fields(a)
    episode_label = _resolve_asset_episode_label(a, storyboard_episode_label_map)
    return AssetResponse(
        id=str(a.id),
        user_id=str(a.user_id),
        project_id=str(a.project_id) if a.project_id else None,
        subject_id=str(a.subject_id) if a.subject_id else None,
        name=a.name,
        asset_type=a.asset_type,
        category=a.category,
        file_url=a.file_url,
        thumbnail_url=media_fields["thumbnail_url"],
        preview_url=media_fields["preview_url"],
        previewUrl=media_fields["previewUrl"],
        large_url=media_fields["large_url"],
        largeUrl=media_fields["largeUrl"],
        download_url=media_fields["download_url"],
        downloadUrl=media_fields["downloadUrl"],
        poster_url=media_fields["poster_url"],
        posterUrl=media_fields["posterUrl"],
        preview_video_url=media_fields["preview_video_url"],
        previewVideoUrl=media_fields["previewVideoUrl"],
        hls_url=media_fields["hls_url"],
        hlsUrl=media_fields["hlsUrl"],
        available_qualities=media_fields["available_qualities"],
        availableQualities=media_fields["availableQualities"],
        preview_ready=media_fields["preview_ready"],
        previewReady=media_fields["previewReady"],
        prompt=a.prompt,
        model=a.model,
        size=a.size,
        is_primary=a.is_primary,
        is_starred=a.is_starred,
        metadata_json=a.metadata_json,
        description=a.description,
        reference_image_urls=a.reference_image_urls,
        episode_label=episode_label,
        episodeLabel=episode_label,
        is_deleted=a.is_deleted,
        deleted_at=a.deleted_at.isoformat() if a.deleted_at else None,
        created_at=a.created_at.isoformat(),
    )


def _to_list_response(
    a: Asset,
    *,
    storyboard_episode_label_map: dict[str, str] | None = None,
) -> AssetResponse:
    metadata = a.metadata_json if isinstance(a.metadata_json, dict) else {}
    media_fields = _resolve_asset_media_fields(a)
    episode_label = _resolve_asset_episode_label(a, storyboard_episode_label_map)
    light_metadata = {
        key: metadata[key]
        for key in ASSET_LIST_METADATA_KEYS
        if metadata.get(key) is not None
    }
    return AssetResponse(
        id=str(a.id),
        user_id=str(a.user_id),
        project_id=str(a.project_id) if a.project_id else None,
        subject_id=str(a.subject_id) if a.subject_id else None,
        name=a.name,
        asset_type=a.asset_type,
        category=a.category,
        file_url=a.file_url,
        thumbnail_url=media_fields["thumbnail_url"],
        preview_url=media_fields["preview_url"],
        previewUrl=media_fields["previewUrl"],
        large_url=media_fields["large_url"],
        largeUrl=media_fields["largeUrl"],
        download_url=media_fields["download_url"],
        downloadUrl=media_fields["downloadUrl"],
        poster_url=media_fields["poster_url"],
        posterUrl=media_fields["posterUrl"],
        preview_video_url=media_fields["preview_video_url"],
        previewVideoUrl=media_fields["previewVideoUrl"],
        hls_url=media_fields["hls_url"],
        hlsUrl=media_fields["hlsUrl"],
        available_qualities=media_fields["available_qualities"],
        availableQualities=media_fields["availableQualities"],
        preview_ready=media_fields["preview_ready"],
        previewReady=media_fields["previewReady"],
        prompt=a.prompt,
        model=a.model,
        size=a.size,
        is_primary=a.is_primary,
        is_starred=a.is_starred,
        metadata_json=light_metadata or None,
        description=a.description,
        reference_image_urls=None,
        episode_label=episode_label,
        episodeLabel=episode_label,
        is_deleted=a.is_deleted,
        deleted_at=a.deleted_at.isoformat() if a.deleted_at else None,
        created_at=a.created_at.isoformat(),
    )


class AssetListResponse(BaseModel):
    list: List[AssetResponse] = Field(default_factory=list)
    total: int
    has_more: bool
    hasMore: bool
    limit: int
    offset: int
    next_cursor: str | None = None
    nextCursor: str | None = None


def _encode_asset_cursor(asset: Asset, *, deleted_only: bool) -> str | None:
    if deleted_only and asset.deleted_at is None:
        return None
    payload = {
        "v": ASSET_CURSOR_VERSION,
        "mode": "deleted" if deleted_only else "default",
        "id": str(asset.id),
        "created_at": asset.created_at.isoformat(),
        "deleted_at": asset.deleted_at.isoformat() if asset.deleted_at else None,
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    ).decode("utf-8")
    return encoded.rstrip("=")


def _decode_asset_cursor(cursor: str, *, deleted_only: bool) -> tuple[datetime, datetime | None, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        created_at = datetime.fromisoformat(payload["created_at"])
        deleted_at = (
            datetime.fromisoformat(payload["deleted_at"])
            if payload.get("deleted_at")
            else None
        )
        asset_id = UUID(payload["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="资产分页游标无效") from exc

    expected_mode = "deleted" if deleted_only else "default"
    if payload.get("v") != ASSET_CURSOR_VERSION or payload.get("mode") != expected_mode:
        raise HTTPException(status_code=400, detail="资产分页游标无效")
    if deleted_only and deleted_at is None:
        raise HTTPException(status_code=400, detail="资产分页游标无效")
    return created_at, deleted_at, asset_id


def _apply_asset_cursor(
    query,
    *,
    created_at: datetime,
    deleted_at: datetime | None,
    asset_id: UUID,
    deleted_only: bool,
):
    if deleted_only:
        return query.where(
            or_(
                Asset.deleted_at < deleted_at,
                and_(Asset.deleted_at == deleted_at, Asset.created_at < created_at),
                and_(
                    Asset.deleted_at == deleted_at,
                    Asset.created_at == created_at,
                    Asset.id < asset_id,
                ),
            )
        )
    return query.where(
        or_(
            Asset.created_at < created_at,
            and_(Asset.created_at == created_at, Asset.id < asset_id),
        )
    )


def _is_creation_video_asset(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    source = metadata.get("source")
    if source in {"creation_video", "creation_shot_video", "creation_upload"}:
        return True
    return source == "upload" and metadata.get("uploaded_via") == "creation"


def _build_extracted_frame_metadata(asset: Asset, extracted: ExtractedVideoFrame) -> dict:
    original_metadata = dict(asset.metadata_json or {})
    source = "creation_video_frame_extract" if _is_creation_video_asset(asset) else "video_frame_extract"
    extra: dict = {
        "source": source,
        "frame_position": extracted.frame_position,
        "extracted_from": "video_frame",
        "source_video_asset_id": str(asset.id),
        "source_video_url": asset.file_url,
        "source_video_name": asset.name,
        "source_video_category": asset.category,
        "source_video_source": original_metadata.get("source"),
    }
    if extracted.duration is not None:
        extra["source_video_duration"] = extracted.duration
    if original_metadata.get("ratio"):
        extra["ratio"] = original_metadata.get("ratio")
    if original_metadata.get("resolution") or asset.size:
        extra["resolution"] = original_metadata.get("resolution") or asset.size
    for field_name in ("uploaded_via", "session_id", "shot_id"):
        if original_metadata.get(field_name) is not None:
            extra[field_name] = original_metadata.get(field_name)
    return build_managed_storage_metadata(import_source="video_frame_extract", extra=extra)


def _sanitize_asset_url(url: str | None, *, field_name: str) -> str | None:
    if url is None:
        return None
    cleaned = url.strip()
    if not cleaned:
        return None
    if is_managed_upload_url(cleaned):
        return cleaned
    return validate_outbound_url(cleaned, label=field_name)


def _resolve_asset_import_subdir(asset_type: str, *, variant: str = "file") -> str:
    base_dir = ASSET_IMPORT_SUBDIRS.get(asset_type, "assets/imported/others")
    if variant == "thumbnail":
        return f"{base_dir}/thumbnails"
    if variant == "reference":
        return "assets/imported/references"
    return base_dir


async def _persist_asset_media_url(
    url: str | None,
    *,
    asset_type: str,
    field_name: str,
    variant: str = "file",
) -> tuple[str | None, str | None]:
    cleaned = _sanitize_asset_url(url, field_name=field_name)
    if not cleaned:
        return None, None

    fallback_type = "image" if variant in {"thumbnail", "reference"} else asset_type
    persisted = await persist_if_external(
        cleaned,
        _resolve_asset_import_subdir(asset_type, variant=variant),
        fallback_extension=get_media_fallback_extension(fallback_type),
        url_label=field_name,
    )
    origin_url = cleaned if is_external_media_url(cleaned) else None
    return persisted, origin_url


async def _persist_asset_reference_urls(asset_type: str, urls: list[str] | None) -> tuple[list[str] | None, list[str] | None]:
    sanitized_urls = [
        sanitized
        for sanitized in (
            _sanitize_asset_url(url, field_name="参考图片地址")
            for url in (urls or [])
        )
        if sanitized
    ]
    if not sanitized_urls:
        return None, None

    persisted_urls = await persist_many_if_external(
        sanitized_urls,
        _resolve_asset_import_subdir(asset_type, variant="reference"),
        fallback_extension=get_media_fallback_extension("image"),
        url_label="参考图片地址",
    )
    origin_urls = [url for url in sanitized_urls if is_external_media_url(url)]
    return persisted_urls, origin_urls or None


def _merge_asset_metadata(existing: dict | None, updates: dict | None = None) -> dict | None:
    metadata = dict(existing or {})
    if updates:
        metadata.update(updates)
    return metadata or None


def _derive_asset_thumbnail(
    source_url: str | None,
    *,
    asset_type: str,
) -> tuple[str | None, dict]:
    if not source_url or asset_type not in {"image", "video"}:
        return source_url, {}
    try:
        derived = generate_asset_card_thumbnail(source_url, asset_type=asset_type)
    except (FileNotFoundError, ValueError, RuntimeError):
        return source_url, {}
    return derived.url, build_derivative_metadata(derived)


async def _validate_project_binding(project_id: str | None, user: User, db: AsyncSession) -> UUID | None:
    if not project_id:
        return None
    pid = UUID(project_id)
    result = await db.execute(select(Project).where(Project.id == pid, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project.id


async def _validate_subject_binding(subject_id: str | None, project_id: UUID | None, user: User, db: AsyncSession) -> UUID | None:
    if not subject_id:
        return None
    sid = UUID(subject_id)
    query = (
        select(Subject)
        .join(Project, Subject.project_id == Project.id)
        .where(Subject.id == sid, Project.user_id == user.id)
    )
    if project_id is not None:
        query = query.where(Subject.project_id == project_id)
    result = await db.execute(query)
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="主体不存在")
    return subject.id


@router.get(
    "",
    response_model=AssetListResponse,
    summary="获取资产列表",
    description="查询当前用户的资产列表，可按项目、作用域、类型、分类、收藏、主图状态、关键词和回收站状态过滤，并按稳定顺序分页返回。",
    response_description="资产列表。",
)
async def list_assets(
    project_id: str | None = Query(None),
    scope: Literal["project", "creation"] | None = Query(None),
    asset_type: str | None = Query(None),
    category: str | None = Query(None),
    is_starred: bool | None = Query(None),
    is_primary: bool | None = Query(None),
    search: str | None = Query(None),
    include_deleted: bool = Query(False),
    deleted_only: bool = Query(False),
    limit: int = Query(ASSET_LIST_DEFAULT_LIMIT, ge=1, le=ASSET_LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(
        None,
        description="基于上一页最后一条记录生成的游标；传入后将优先按 keyset 深分页。",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = apply_asset_visibility(
        select(Asset).where(Asset.user_id == user.id),
        include_deleted=include_deleted,
        deleted_only=deleted_only,
    )
    count_query = apply_asset_visibility(
        select(sa_func.count()).select_from(Asset).where(Asset.user_id == user.id),
        include_deleted=include_deleted,
        deleted_only=deleted_only,
    )

    if project_id:
        project_uuid = UUID(project_id)
        query = query.where(Asset.project_id == project_uuid)
        count_query = count_query.where(Asset.project_id == project_uuid)
    if scope == "project":
        query = query.where(Asset.project_id.is_not(None))
        count_query = count_query.where(Asset.project_id.is_not(None))
    elif scope == "creation":
        scope_condition = _is_creation_scope_asset()
        query = query.where(scope_condition)
        count_query = count_query.where(scope_condition)
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)
        count_query = count_query.where(Asset.asset_type == asset_type)
    if category:
        query = query.where(Asset.category == category)
        count_query = count_query.where(Asset.category == category)
    if is_starred is not None:
        query = query.where(Asset.is_starred == is_starred)
        count_query = count_query.where(Asset.is_starred == is_starred)
    if is_primary is not None:
        query = query.where(Asset.is_primary == is_primary)
        count_query = count_query.where(Asset.is_primary == is_primary)
    if search:
        search_condition = or_(Asset.name.ilike(f"%{search}%"), Asset.prompt.ilike(f"%{search}%"))
        query = query.where(search_condition)
        count_query = count_query.where(search_condition)

    if cursor:
        cursor_created_at, cursor_deleted_at, cursor_asset_id = _decode_asset_cursor(
            cursor,
            deleted_only=deleted_only,
        )
        query = _apply_asset_cursor(
            query,
            created_at=cursor_created_at,
            deleted_at=cursor_deleted_at,
            asset_id=cursor_asset_id,
            deleted_only=deleted_only,
        )

    if deleted_only:
        query = query.order_by(Asset.deleted_at.desc(), Asset.created_at.desc(), Asset.id.desc())
    else:
        query = query.order_by(Asset.created_at.desc(), Asset.id.desc())
    query = query.limit(limit + 1) if cursor else query.limit(limit).offset(offset)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(query)
    records = result.scalars().all()
    has_more = len(records) > limit if cursor else offset + len(records) < total
    current_page = records[:limit] if cursor else records
    next_cursor = (
        _encode_asset_cursor(current_page[-1], deleted_only=deleted_only)
        if has_more and current_page
        else None
    )
    storyboard_episode_label_map = await _build_storyboard_episode_label_map(db, current_page)
    items = [
        _to_list_response(a, storyboard_episode_label_map=storyboard_episode_label_map)
        for a in current_page
    ]
    return AssetListResponse(
        list=items,
        total=total,
        has_more=has_more,
        hasMore=has_more,
        limit=limit,
        offset=offset,
        next_cursor=next_cursor,
        nextCursor=next_cursor,
    )


@router.get(
    "/{asset_id}",
    response_model=AssetResponse,
    summary="获取资产详情",
    description="读取单个资产详情。",
    response_description="资产详情。",
)
async def get_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    storyboard_episode_label_map = await _build_storyboard_episode_label_map(db, [asset])
    return _to_response(asset, storyboard_episode_label_map=storyboard_episode_label_map)


class ExtractAssetFrameRequest(BaseModel):
    position: Literal["first", "last"]


@router.post(
    "/{asset_id}/extract-frame",
    response_model=AssetResponse,
    summary="提取视频首帧或尾帧",
    description="对视频资产提取首帧或尾帧，并以图片资产形式落库返回。",
    response_description="新创建的帧图片资产。",
)
async def extract_asset_frame(
    asset_id: str,
    req: ExtractAssetFrameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if asset.asset_type != "video":
        raise HTTPException(status_code=400, detail="仅支持对视频资产提取首帧或尾帧")
    if not asset.file_url:
        raise HTTPException(status_code=400, detail="当前视频资产缺少文件地址")

    try:
        extracted = await extract_video_frame(asset.file_url, req.position)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    image_asset = Asset(
        user_id=asset.user_id,
        project_id=asset.project_id,
        subject_id=asset.subject_id,
        name=f"{_sanitize_download_name(asset.name)}-{'首帧' if req.position == 'first' else '尾帧'}",
        asset_type="image",
        category=asset.category or "reference",
        file_url=extracted.frame_url,
        prompt=asset.prompt,
        model=asset.model,
        size=(asset.metadata_json or {}).get("resolution") or asset.size,
        is_primary=False,
        is_starred=False,
        metadata_json=None,
        description=asset.description or asset.prompt,
        reference_image_urls=None,
    )
    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        extracted.frame_url,
        asset_type="image",
    )
    image_asset.thumbnail_url = derived_thumbnail_url
    image_asset.metadata_json = _merge_asset_metadata(
        _build_extracted_frame_metadata(asset, extracted),
        derivative_metadata,
    )
    db.add(image_asset)
    await db.commit()
    await db.refresh(image_asset)
    return _to_response(image_asset)


@router.post(
    "/{asset_id}/ensure-thumbnail",
    response_model=AssetResponse,
    summary="为视频资产补缩略图",
    description="若视频资产当前没有缩略图，则自动提取首帧生成缩略图并写回资产。",
    response_description="更新后的资产对象。",
)
async def ensure_asset_thumbnail(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if asset.asset_type != "video":
        raise HTTPException(status_code=400, detail="仅支持对视频资产生成封面")
    if not asset.file_url:
        raise HTTPException(status_code=400, detail="当前视频资产缺少文件地址")
    if asset.thumbnail_url:
        return _to_response(asset)

    try:
        extracted = await extract_video_frame(asset.file_url, "first")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        extracted.frame_url,
        asset_type="video",
    )

    metadata_updates: dict = {
        "auto_thumbnail_generated": True,
        "auto_thumbnail_url": extracted.frame_url,
        "auto_thumbnail_position": extracted.frame_position,
        "auto_thumbnail_source": "first_frame",
    }
    if extracted.duration is not None:
        metadata_updates["auto_thumbnail_source_video_duration"] = extracted.duration

    metadata_updates.update(derivative_metadata)
    asset.thumbnail_url = derived_thumbnail_url
    asset.metadata_json = _merge_asset_metadata(asset.metadata_json, metadata_updates)
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)


@router.get(
    "/{asset_id}/download",
    summary="下载资产文件",
    description="下载指定资产。默认优先尝试原始地址，失败后回退到当前托管文件地址。",
    response_description="资产二进制流。",
)
async def download_asset(
    asset_id: str,
    prefer_origin: bool = Query(True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id),
            include_deleted=True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    candidate_urls = _iter_asset_download_attempts(asset, prefer_origin=prefer_origin)

    if not candidate_urls:
        raise HTTPException(status_code=404, detail="资产暂无可下载文件")

    download_url = candidate_urls[0][0]
    content: bytes | None = None
    for url, label in candidate_urls:
        try:
            resolved_target = resolve_verified_download_target_from_url(
                url,
                expected_user_id=str(user.id),
            )
            content = await _read_media_bytes(resolved_target, label=label)
            download_url = resolved_target
            break
        except MediaDownloadAccessError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
        except FileNotFoundError:
            continue
        except (httpx.HTTPError, ValueError):
            continue

    if content is None:
        raise HTTPException(status_code=502, detail="资产下载失败，请稍后重试")

    filename = _build_asset_download_filename(asset, download_url)
    media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.post(
    "",
    response_model=AssetResponse,
    status_code=201,
    summary="创建资产",
    description="手动登记一个资产。若传入外链文件、缩略图或参考图地址，后端会尝试托管到本地 uploads。",
    response_description="创建成功后的资产。",
)
async def create_asset(
    req: AssetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bound_project_id = await _validate_project_binding(req.project_id, user, db)
    bound_subject_id = await _validate_subject_binding(req.subject_id, bound_project_id, user, db)
    file_url, origin_file_url = await _persist_asset_media_url(
        req.file_url,
        asset_type=req.asset_type,
        field_name="资产文件地址",
    )
    thumbnail_url, origin_thumbnail_url = await _persist_asset_media_url(
        req.thumbnail_url,
        asset_type=req.asset_type,
        field_name="资产缩略图地址",
        variant="thumbnail",
    )
    thumbnail_source_url = pick_safe_thumbnail_url(thumbnail_url, file_url)
    thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        thumbnail_source_url,
        asset_type=req.asset_type,
    )
    reference_image_urls, origin_reference_urls = await _persist_asset_reference_urls(
        req.asset_type,
        req.reference_image_urls,
    )

    metadata_updates: dict = {}
    if is_managed_upload_url(file_url):
        metadata_updates["storage_mode"] = "managed_upload"
        metadata_updates["import_source"] = "manual_asset_import"
    if origin_file_url:
        metadata_updates.update(
            build_managed_storage_metadata(
                origin_url=origin_file_url,
                import_source="manual_asset_import",
            )
        )
    if origin_thumbnail_url:
        metadata_updates["origin_thumbnail_url"] = origin_thumbnail_url
    if origin_reference_urls:
        metadata_updates["origin_reference_urls"] = origin_reference_urls
    metadata_updates.update(derivative_metadata)

    asset = Asset(
        user_id=user.id,
        project_id=bound_project_id,
        subject_id=bound_subject_id,
        name=req.name,
        asset_type=req.asset_type,
        category=req.category,
        file_url=file_url or "",
        thumbnail_url=thumbnail_url,
        prompt=req.prompt,
        model=req.model,
        size=req.size,
        is_primary=req.is_primary,
        is_starred=req.is_starred,
        metadata_json=_merge_asset_metadata(req.metadata_json, metadata_updates),
        description=req.description,
        reference_image_urls=reference_image_urls,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)


@router.patch(
    "/{asset_id}",
    response_model=AssetResponse,
    summary="更新资产",
    description="更新资产名称、主图状态、收藏状态、分类、描述、元数据和主体绑定。",
    response_description="更新后的资产。",
)
async def update_asset(
    asset_id: str,
    req: AssetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    if req.name is not None:
        asset.name = req.name
    if req.is_primary is not None:
        asset.is_primary = req.is_primary
    if req.is_starred is not None:
        asset.is_starred = req.is_starred
    if req.category is not None:
        asset.category = req.category
    if req.subject_id is not None:
        asset.subject_id = await _validate_subject_binding(
            req.subject_id,
            asset.project_id,
            user,
            db,
        )
    metadata = dict(asset.metadata_json or {})
    if req.metadata_json is not None:
        metadata.update(req.metadata_json)
    if req.description is not None:
        asset.description = req.description
    if req.reference_image_urls is not None:
        reference_image_urls, origin_reference_urls = await _persist_asset_reference_urls(
            asset.asset_type,
            req.reference_image_urls,
        )
        asset.reference_image_urls = reference_image_urls
        if reference_image_urls and any(is_managed_upload_url(url) for url in reference_image_urls):
            metadata["storage_mode"] = "managed_upload"
        if origin_reference_urls:
            metadata["import_source"] = "manual_asset_import"
            metadata["origin_reference_urls"] = origin_reference_urls

    asset.metadata_json = metadata or None

    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)


@router.delete(
    "/{asset_id}",
    summary="删除资产到回收站",
    description="将指定资产移入回收站，而不是物理删除文件。",
    response_description="移入回收站结果。",
)
async def delete_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id)
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")

    mark_asset_deleted(asset)
    await cleanup_asset_references(asset, db)
    await db.commit()
    return {"message": "已移入回收站"}


class BatchDeleteRequest(BaseModel):
    asset_ids: list[str]


@router.post(
    "/batch-delete",
    summary="批量移入回收站",
    description="将多个资产批量移入回收站。",
    response_description="批量删除结果。",
)
async def batch_delete_assets(
    req: BatchDeleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = 0
    for aid in req.asset_ids:
        result = await db.execute(
            apply_asset_visibility(
                select(Asset).where(Asset.id == UUID(aid), Asset.user_id == user.id)
            )
        )
        asset = result.scalar_one_or_none()
        if asset and mark_asset_deleted(asset):
            await cleanup_asset_references(asset, db)
            deleted += 1

    await db.commit()
    return {"message": f"已移入回收站 {deleted} 个资产"}


class BatchRestoreRequest(BaseModel):
    asset_ids: list[str]


@router.post(
    "/restore",
    summary="批量恢复资产",
    description="将回收站中的多个资产批量恢复。",
    response_description="批量恢复结果。",
)
async def batch_restore_assets(
    req: BatchRestoreRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    restored = 0
    for aid in req.asset_ids:
        result = await db.execute(
            apply_asset_visibility(
                select(Asset).where(Asset.id == UUID(aid), Asset.user_id == user.id),
                include_deleted=True,
            )
        )
        asset = result.scalar_one_or_none()
        if asset and restore_asset(asset):
            restored += 1

    await db.commit()
    return {"message": f"已恢复 {restored} 个资产"}


@router.post(
    "/{asset_id}/restore",
    response_model=AssetResponse,
    summary="恢复单个资产",
    description="将指定回收站资产恢复为可见状态。",
    response_description="恢复后的资产对象。",
)
async def restore_deleted_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.id == UUID(asset_id), Asset.user_id == user.id),
            include_deleted=True,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="资产不存在")
    if not asset.is_deleted:
        raise HTTPException(status_code=400, detail="资产未被删除")

    restore_asset(asset)
    await db.commit()
    await db.refresh(asset)
    return _to_response(asset)
