from typing import Any

from app.services.media_access_resolver import (
    resolve_download_url,
    resolve_image_large_url,
    resolve_preview_url,
    resolve_video_available_qualities,
    resolve_video_hls_url,
)
from app.services.media_object_descriptor import build_media_object_descriptor
from app.utils.media_urls import pick_safe_thumbnail_url


def _normalize_metadata(metadata: dict | None) -> dict:
    return metadata if isinstance(metadata, dict) else {}


def _build_descriptor(file_url: str | None, metadata: dict) -> dict | None:
    return build_media_object_descriptor(url=file_url, metadata=metadata)


def build_image_media_fields(
    *,
    file_url: str | None,
    thumbnail_url: str | None = None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, str | bool | None]:
    metadata = _normalize_metadata(metadata)
    descriptor = _build_descriptor(file_url, metadata)
    resolved_thumbnail = pick_safe_thumbnail_url(
        thumbnail_url,
        metadata.get("thumbnail_url"),
        metadata.get("auto_thumbnail_url"),
        metadata.get("preview_url"),
        file_url,
    )
    preview_url = resolve_preview_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url or resolved_thumbnail,
        media_type="image",
    )
    large_url = resolve_image_large_url(
        descriptor,
        metadata=metadata,
    )
    download_url = resolve_download_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url or preview_url,
        media_type="image",
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )
    preview_ready = bool(preview_url)
    return {
        "thumbnail_url": resolved_thumbnail,
        "preview_url": preview_url,
        "previewUrl": preview_url,
        "large_url": large_url,
        "largeUrl": large_url,
        "download_url": download_url,
        "downloadUrl": download_url,
        "poster_url": None,
        "posterUrl": None,
        "preview_video_url": None,
        "previewVideoUrl": None,
        "hls_url": None,
        "hlsUrl": None,
        "available_qualities": None,
        "availableQualities": None,
        "preview_ready": preview_ready,
        "previewReady": preview_ready,
    }


def build_video_media_fields(
    *,
    file_url: str | None,
    thumbnail_url: str | None = None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, Any]:
    metadata = _normalize_metadata(metadata)
    descriptor = _build_descriptor(file_url, metadata)
    poster_url = pick_safe_thumbnail_url(
        metadata.get("poster_url"),
        thumbnail_url,
        metadata.get("thumbnail_url"),
        metadata.get("auto_thumbnail_url"),
        metadata.get("first_frame_url"),
        metadata.get("last_frame_url"),
    )
    preview_video_url = resolve_preview_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url,
        media_type="video",
    )
    hls_url = resolve_video_hls_url(
        descriptor,
        metadata=metadata,
    )
    available_qualities = resolve_video_available_qualities(
        descriptor,
        metadata=metadata,
    )
    download_url = resolve_download_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url,
        media_type="video",
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )
    preview_ready = bool(hls_url or preview_video_url)
    return {
        "thumbnail_url": poster_url,
        "preview_url": preview_video_url,
        "previewUrl": preview_video_url,
        # 视频本体不派生图片大图变体；保留 large_url 键以与图片/音频字段结构一致，
        # 避免 _to_response 等统一消费方对视频资产取键时抛 KeyError。
        "large_url": None,
        "largeUrl": None,
        "poster_url": poster_url,
        "posterUrl": poster_url,
        "preview_video_url": preview_video_url,
        "previewVideoUrl": preview_video_url,
        "hls_url": hls_url,
        "hlsUrl": hls_url,
        "available_qualities": available_qualities,
        "availableQualities": available_qualities,
        "download_url": download_url,
        "downloadUrl": download_url,
        "preview_ready": preview_ready,
        "previewReady": preview_ready,
    }


def build_audio_media_fields(
    *,
    file_url: str | None,
    metadata: dict | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    resource_id: str | None = None,
) -> dict[str, str | bool | None]:
    metadata = _normalize_metadata(metadata)
    descriptor = _build_descriptor(file_url, metadata)
    preview_url = resolve_preview_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url,
        media_type="audio",
    )
    download_url = resolve_download_url(
        descriptor,
        metadata=metadata,
        fallback_url=file_url,
        media_type="audio",
        user_id=user_id,
        project_id=project_id,
        resource_id=resource_id,
    )
    preview_ready = bool(preview_url)
    return {
        "thumbnail_url": None,
        "preview_url": preview_url,
        "previewUrl": preview_url,
        "large_url": None,
        "largeUrl": None,
        "download_url": download_url,
        "downloadUrl": download_url,
        "poster_url": None,
        "posterUrl": None,
        "preview_video_url": None,
        "previewVideoUrl": None,
        "hls_url": None,
        "hlsUrl": None,
        "available_qualities": None,
        "availableQualities": None,
        "preview_ready": preview_ready,
        "previewReady": preview_ready,
    }
