from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.media_delivery_urls import build_object_storage_public_url
from app.services.media_storage import resolve_managed_storage_key, resolve_upload_path

_WRITE_ENABLED_MODES = {"hybrid", "object_storage"}


@dataclass(frozen=True)
class ObjectStorageObject:
    bucket: str
    key: str
    public_url: str | None


def _clean(value: str | None) -> str:
    return (value or "").strip()


def object_storage_write_enabled() -> bool:
    mode = _clean(getattr(settings, "MEDIA_STORAGE_MODE", "")).lower()
    provider = _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos")).lower()
    has_credentials = all(
        [
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_REGION", "")),
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_ID", "")),
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_KEY", "")),
        ]
    )
    has_bucket = any(
        [
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_RAW", "")),
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", "")),
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", "")),
            _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD", "")),
        ]
    )
    return (
        mode in _WRITE_ENABLED_MODES
        and provider in {"", "tencent_cos"}
        and has_credentials
        and has_bucket
    )


def _bucket_for_kind(kind: str) -> str:
    normalized_kind = _clean(kind).lower()
    bucket_map = {
        "raw": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_RAW", "")),
        "preview": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", "")),
        "derived": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", "")),
        "hls": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_HLS", "")),
        "private_download": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD", "")),
    }
    bucket = bucket_map.get(normalized_kind, "")
    return bucket or bucket_map["raw"]


def _prefix_for_kind(kind: str) -> str:
    normalized_kind = _clean(kind).lower()
    prefix_map = {
        "raw": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW", "raw")),
        "preview": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW", "preview")),
        "derived": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED", "derived")),
        "hls": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS", "hls")),
        "private_download": _clean(
            getattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD", "private-download")
        ),
    }
    return prefix_map.get(normalized_kind, "") or prefix_map["raw"]


def _build_storage_key(managed_url: str, *, kind: str) -> str:
    relative_path = resolve_managed_storage_key(managed_url)
    if not relative_path:
        raise ValueError(f"无法从托管地址解析存储 key: {managed_url}")
    prefix = _prefix_for_kind(kind).strip("/")
    normalized_relative = relative_path.lstrip("/")
    return f"{prefix}/{normalized_relative}" if prefix else normalized_relative


def _guess_content_type(file_path: Path) -> str:
    guessed, _ = mimetypes.guess_type(file_path.name)
    return guessed or "application/octet-stream"


def _build_client() -> Any:
    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError as exc:  # pragma: no cover - exercised in deployment/runtime
        raise RuntimeError("缺少 cos-python-sdk-v5 依赖，无法写入腾讯 COS") from exc

    config = CosConfig(
        Region=_clean(getattr(settings, "MEDIA_OBJECT_STORAGE_REGION", "")),
        SecretId=_clean(getattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_ID", "")),
        SecretKey=_clean(getattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_KEY", "")),
        Scheme="https",
    )
    return CosS3Client(config)


def upload_managed_file_to_object_storage(
    managed_url: str,
    *,
    kind: str,
) -> ObjectStorageObject:
    if not object_storage_write_enabled():
        raise RuntimeError("对象存储写入当前未启用")

    file_path = resolve_upload_path(managed_url)
    if not file_path.exists() or not file_path.is_file():
        raise FileNotFoundError(f"待上传文件不存在: {managed_url}")

    bucket = _bucket_for_kind(kind)
    if not bucket:
        raise RuntimeError(f"未配置 {kind} 对应的对象存储 bucket")

    key = _build_storage_key(managed_url, kind=kind)
    client = _build_client()
    with file_path.open("rb") as file_obj:
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_obj,
            ContentType=_guess_content_type(file_path),
        )

    return ObjectStorageObject(
        bucket=bucket,
        key=key,
        public_url=build_object_storage_public_url(
            bucket=bucket,
            key=key,
            prefer_cdn=kind != "raw",
        ),
    )


def sync_managed_image_bundle_to_object_storage(
    *,
    source_url: str,
    preview_url: str | None = None,
    thumbnail_url: str | None = None,
) -> dict[str, Any]:
    if not object_storage_write_enabled():
        return {}

    objects: dict[str, dict[str, str | None]] = {}

    def _serialize(label: str, managed_url: str | None, *, kind: str) -> None:
        if not managed_url:
            return
        uploaded = upload_managed_file_to_object_storage(managed_url, kind=kind)
        objects[label] = {
            "bucket": uploaded.bucket,
            "key": uploaded.key,
            "url": uploaded.public_url,
        }

    _serialize("origin", source_url, kind="raw")
    _serialize("preview", preview_url, kind="preview")
    _serialize("thumbnail", thumbnail_url, kind="derived")

    if not objects:
        return {}

    return {
        "object_storage_sync": {
            "provider": _clean(getattr(settings, "MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos")) or "tencent_cos",
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "objects": objects,
        }
    }
