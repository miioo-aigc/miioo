from __future__ import annotations

from typing import Any

from app.config import settings
from app.services.media_access_policy import (
    AUTHENTICATED_PREVIEW,
    CONTROLLED_DOWNLOAD,
    PUBLIC_PREVIEW,
    resolve_media_access_level,
)
from app.services.media_delivery_urls import build_object_storage_public_url
from app.services.media_download_signing import build_controlled_download_url, issue_download_token


def _normalize_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    return metadata if isinstance(metadata, dict) else {}


def _clean_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


def _pick_first_url(*values: Any) -> str | None:
    for value in values:
        cleaned = _clean_url(value)
        if cleaned:
            return cleaned
    return None


def _is_controlled_download_url(url: str | None) -> bool:
    if not url:
        return False
    return "/api/media/downloads/" in url or "/media/downloads/" in url


def _descriptor_url(descriptor: dict[str, Any] | None, key: str) -> str | None:
    if not isinstance(descriptor, dict):
        return None
    return _clean_url(descriptor.get(key))


def _signed_download_enabled() -> bool:
    return bool(getattr(settings, "MEDIA_ENABLE_SIGNED_DOWNLOAD", True))


def _object_storage_preview_enabled() -> bool:
    return bool(getattr(settings, "MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW", True))


def _image_large_variant_enabled() -> bool:
    return bool(getattr(settings, "MEDIA_ENABLE_IMAGE_LARGE_VARIANT", True))


def _video_hls_enabled() -> bool:
    return bool(getattr(settings, "MEDIA_ENABLE_VIDEO_HLS", True))


def _is_object_storage_descriptor(descriptor: dict[str, Any] | None) -> bool:
    if not isinstance(descriptor, dict):
        return False
    storage_mode = (_descriptor_url(descriptor, "storage_mode") or "").strip().lower()
    return storage_mode == "object_storage" or bool(_descriptor_url(descriptor, "storage_bucket"))


def _normalize_available_qualities(value: Any) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None

    normalized_items: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        normalized_item = {
            str(key): item[key]
            for key in item
            if isinstance(key, str)
        }
        if normalized_item:
            normalized_items.append(normalized_item)
    return normalized_items or None


def resolve_preview_url(
    descriptor: dict[str, Any] | None,
    *,
    metadata: dict[str, Any] | None = None,
    fallback_url: str | None = None,
    media_type: str | None = None,
) -> str | None:
    normalized_metadata = _normalize_metadata(metadata)
    normalized_media_type = (media_type or "").strip().lower()

    preview_candidate = None
    if normalized_media_type == "video":
        preview_candidate = _pick_first_url(
            normalized_metadata.get("preview_video_url"),
            normalized_metadata.get("preview_url"),
        )
    elif normalized_media_type == "image":
        preview_candidate = _pick_first_url(
            normalized_metadata.get("preview_url"),
            normalized_metadata.get("large_url"),
        )
    else:
        preview_candidate = _pick_first_url(normalized_metadata.get("preview_url"))

    descriptor_source_url = _descriptor_url(descriptor, "source_url")
    object_storage_preview_enabled = _object_storage_preview_enabled()
    object_storage_descriptor = _is_object_storage_descriptor(descriptor)

    if preview_candidate:
        if object_storage_descriptor and not object_storage_preview_enabled:
            return _pick_first_url(descriptor_source_url, fallback_url, preview_candidate)
        return preview_candidate

    descriptor_cdn_url = _descriptor_url(descriptor, "cdn_url")
    if descriptor_cdn_url and object_storage_preview_enabled:
        access_level = resolve_media_access_level(
            media_type=normalized_media_type or "document",
            usage="preview",
            is_original=False,
        )
        if access_level in {PUBLIC_PREVIEW, AUTHENTICATED_PREVIEW}:
            return descriptor_cdn_url

    return _pick_first_url(
        descriptor_source_url,
        fallback_url,
    )


def resolve_image_large_url(
    descriptor: dict[str, Any] | None,
    *,
    metadata: dict[str, Any] | None = None,
) -> str | None:
    if not _image_large_variant_enabled():
        return None

    normalized_metadata = _normalize_metadata(metadata)
    if not _object_storage_preview_enabled() and _is_object_storage_descriptor(descriptor):
        return None

    return _pick_first_url(normalized_metadata.get("large_url"))


def resolve_video_hls_url(
    descriptor: dict[str, Any] | None,
    *,
    metadata: dict[str, Any] | None = None,
) -> str | None:
    if not _video_hls_enabled():
        return None

    normalized_metadata = _normalize_metadata(metadata)
    if not _object_storage_preview_enabled() and _is_object_storage_descriptor(descriptor):
        return None

    return _pick_first_url(
        normalized_metadata.get("hls_url"),
        normalized_metadata.get("hls_master_playlist"),
    )


def resolve_video_available_qualities(
    descriptor: dict[str, Any] | None,
    *,
    metadata: dict[str, Any] | None = None,
) -> list[dict[str, Any]] | None:
    if not _video_hls_enabled():
        return None

    normalized_metadata = _normalize_metadata(metadata)
    if not _object_storage_preview_enabled() and _is_object_storage_descriptor(descriptor):
        return None

    return _normalize_available_qualities(normalized_metadata.get("available_qualities"))


def resolve_download_url(
    descriptor: dict[str, Any] | None,
    *,
    metadata: dict[str, Any] | None = None,
    fallback_url: str | None = None,
    media_type: str | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> str | None:
    normalized_metadata = _normalize_metadata(metadata)
    normalized_media_type = (media_type or "").strip().lower()

    explicit_download_url = _pick_first_url(normalized_metadata.get("download_url"))
    if explicit_download_url and _is_controlled_download_url(explicit_download_url):
        return explicit_download_url

    access_level = resolve_media_access_level(
        media_type=normalized_media_type or "document",
        usage="download",
        is_original=True,
    )
    descriptor_download_url = _descriptor_url(descriptor, "download_url")
    descriptor_source_url = _descriptor_url(descriptor, "source_url")
    origin_url = _pick_first_url(normalized_metadata.get("origin_url"))
    resolved_download_url = _pick_first_url(
        explicit_download_url,
        origin_url,
        descriptor_download_url,
        descriptor_source_url,
        fallback_url,
    )
    if not resolved_download_url and _is_object_storage_descriptor(descriptor):
        resolved_download_url = build_object_storage_public_url(
            bucket=_descriptor_url(descriptor, "storage_bucket"),
            key=_pick_first_url(
                _descriptor_url(descriptor, "download_storage_key"),
                _descriptor_url(descriptor, "origin_storage_key"),
                _descriptor_url(descriptor, "storage_key"),
            ),
            prefer_cdn=False,
        )

    if (
        access_level == CONTROLLED_DOWNLOAD
        and _signed_download_enabled()
        and user_id
        and resource_id
        and resolved_download_url
    ):
        storage_key = _pick_first_url(
            _descriptor_url(descriptor, "download_storage_key"),
            _descriptor_url(descriptor, "origin_storage_key"),
            _descriptor_url(descriptor, "storage_key"),
        ) or resolved_download_url
        token = issue_download_token(
            user_id=user_id,
            project_id=project_id,
            resource_id=resource_id,
            storage_key=storage_key,
            access_level=access_level,
            storage_mode=_descriptor_url(descriptor, "storage_mode"),
            storage_bucket=_descriptor_url(descriptor, "storage_bucket"),
            download_url=resolved_download_url,
        )
        return build_controlled_download_url(token)

    if descriptor_download_url and (
        access_level != CONTROLLED_DOWNLOAD or _is_controlled_download_url(descriptor_download_url)
    ):
        return descriptor_download_url

    return resolved_download_url
