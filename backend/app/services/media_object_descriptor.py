from __future__ import annotations

from typing import Any

from app.services.media_delivery_urls import build_object_storage_public_url
from app.services.media_storage import (
    extract_managed_or_private_upload_url,
    resolve_managed_storage_key,
)


def _normalize_metadata(metadata: dict[str, Any] | None) -> dict[str, Any]:
    return metadata if isinstance(metadata, dict) else {}


def _build_descriptor(
    *,
    storage_mode: str,
    storage_bucket: str | None,
    storage_key: str | None,
    source_url: str | None,
    metadata: dict[str, Any],
    is_local_upload: bool,
) -> dict[str, Any]:
    origin_storage_key = metadata.get("origin_storage_key") or metadata.get("original_storage_key")
    preview_storage_key = metadata.get("preview_storage_key")
    download_storage_key = metadata.get("download_storage_key")
    resolved_origin_storage_key = origin_storage_key or storage_key
    resolved_preview_storage_key = preview_storage_key or storage_key
    resolved_download_storage_key = download_storage_key or resolved_origin_storage_key or storage_key
    cdn_url = metadata.get("cdn_url") or metadata.get("public_cdn_url")
    if not cdn_url and storage_bucket and resolved_preview_storage_key:
        cdn_url = build_object_storage_public_url(
            bucket=storage_bucket,
            key=resolved_preview_storage_key,
            prefer_cdn=True,
        )

    download_url = metadata.get("download_url")
    if not download_url and storage_bucket and resolved_download_storage_key:
        download_url = build_object_storage_public_url(
            bucket=storage_bucket,
            key=resolved_download_storage_key,
            prefer_cdn=False,
        )

    resolved_source_url = source_url
    if not resolved_source_url and storage_bucket and resolved_origin_storage_key:
        resolved_source_url = build_object_storage_public_url(
            bucket=storage_bucket,
            key=resolved_origin_storage_key,
            prefer_cdn=False,
        )

    return {
        "storage_mode": storage_mode,
        "storage_bucket": storage_bucket,
        "storage_key": storage_key,
        "origin_storage_key": resolved_origin_storage_key,
        "preview_storage_key": preview_storage_key,
        "download_storage_key": resolved_download_storage_key,
        "source_url": resolved_source_url,
        "cdn_url": cdn_url,
        "download_url": download_url,
        "is_local_upload": is_local_upload,
    }


def build_local_object_descriptor(
    url: str | None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    normalized_metadata = _normalize_metadata(metadata)
    managed_url = extract_managed_or_private_upload_url(url)
    storage_key = normalized_metadata.get("storage_key") or resolve_managed_storage_key(managed_url)
    if not managed_url or not storage_key:
        return None

    storage_mode = str(normalized_metadata.get("storage_mode") or "managed_upload").strip() or "managed_upload"
    return _build_descriptor(
        storage_mode=storage_mode,
        storage_bucket=None,
        storage_key=storage_key,
        source_url=managed_url,
        metadata=normalized_metadata,
        is_local_upload=True,
    )


def build_object_storage_descriptor(
    *,
    bucket: str | None,
    key: str | None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    normalized_metadata = _normalize_metadata(metadata)
    resolved_bucket = (
        bucket
        or normalized_metadata.get("storage_bucket")
        or normalized_metadata.get("bucket")
        or normalized_metadata.get("object_bucket")
    )
    resolved_key = (
        key
        or normalized_metadata.get("storage_key")
        or normalized_metadata.get("object_key")
        or normalized_metadata.get("origin_storage_key")
        or normalized_metadata.get("download_storage_key")
    )
    if not resolved_bucket and not resolved_key:
        return None

    storage_mode = str(normalized_metadata.get("storage_mode") or "object_storage").strip() or "object_storage"
    return _build_descriptor(
        storage_mode=storage_mode,
        storage_bucket=resolved_bucket,
        storage_key=resolved_key,
        source_url=normalized_metadata.get("source_url") or normalized_metadata.get("origin_url"),
        metadata=normalized_metadata,
        is_local_upload=False,
    )


def build_media_object_descriptor(
    *,
    url: str | None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    normalized_metadata = _normalize_metadata(metadata)

    object_descriptor = build_object_storage_descriptor(
        bucket=normalized_metadata.get("storage_bucket"),
        key=normalized_metadata.get("storage_key"),
        metadata=normalized_metadata,
    )
    if object_descriptor:
        return object_descriptor

    return build_local_object_descriptor(url, normalized_metadata)
