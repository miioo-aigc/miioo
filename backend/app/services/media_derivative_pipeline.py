from __future__ import annotations

from typing import Any

from app.config import settings
from app.services.image_derivatives import (
    build_derivative_metadata,
    generate_asset_card_thumbnail,
    generate_asset_preview_image,
)
from app.services.video_hls_pipeline import generate_video_hls
from app.services.video_frame import extract_video_frame
from app.services.video_preview_pipeline import generate_video_preview


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


def merge_media_derivative_metadata(
    existing: dict | None,
    updates: dict | None = None,
) -> dict | None:
    metadata = dict(existing or {})
    if updates:
        metadata.update(updates)
    return metadata or None


def _build_video_pipeline_state_metadata(
    *,
    source_video_url: str | None,
    poster_url: str | None,
    preview_video_url: str | None,
    hls_url: str | None,
    hls_packaging_status: str | None = None,
    metadata_committed: bool = False,
) -> dict[str, Any]:
    partial_ready = bool(poster_url and preview_video_url)

    if not source_video_url:
        stage = "queued"
    elif not preview_video_url:
        stage = "preview_transcoding"
    elif not poster_url:
        stage = "poster_extracting"
    elif metadata_committed:
        stage = "completed"
    elif hls_url or hls_packaging_status in {"disabled", "failed"}:
        stage = "metadata_committing"
    else:
        stage = "hls_packaging"

    return {
        "partial_ready": partial_ready,
        "video_pipeline_stage": stage,
        "metadata_commit_status": "ready" if metadata_committed else "pending",
    }


def build_video_playback_metadata(
    source: dict[str, Any] | None,
    *,
    preview_video_url: str | None,
    download_url: str | None,
    poster_url: str | None = None,
) -> dict[str, Any]:
    normalized_source = source if isinstance(source, dict) else {}
    hls_master_playlist = _pick_first_url(
        normalized_source.get("hls_master_playlist"),
        normalized_source.get("hlsMasterPlaylist"),
    )
    hls_url = _pick_first_url(
        normalized_source.get("hls_url"),
        normalized_source.get("hlsUrl"),
        hls_master_playlist,
    )
    available_qualities = _normalize_available_qualities(
        normalized_source.get("available_qualities")
        or normalized_source.get("availableQualities")
    )
    resolved_preview_video_url = _pick_first_url(
        normalized_source.get("preview_video_url"),
        normalized_source.get("previewVideoUrl"),
        preview_video_url,
    )
    resolved_download_url = _pick_first_url(
        normalized_source.get("download_url"),
        normalized_source.get("downloadUrl"),
        download_url,
    )

    metadata_updates: dict[str, Any] = {
        "preview_video_url": resolved_preview_video_url,
        "download_url": resolved_download_url,
        "preview_ready": bool(hls_url or resolved_preview_video_url),
    }
    if poster_url:
        metadata_updates["poster_url"] = poster_url
    if hls_url:
        metadata_updates["hls_url"] = hls_url
    if hls_master_playlist:
        metadata_updates["hls_master_playlist"] = hls_master_playlist
    if available_qualities:
        metadata_updates["available_qualities"] = available_qualities
    metadata_updates.update(
        _build_video_pipeline_state_metadata(
            source_video_url=resolved_download_url,
            poster_url=poster_url,
            preview_video_url=resolved_preview_video_url,
            hls_url=hls_url,
        )
    )

    return metadata_updates


def build_image_derivative_bundle(
    source_url: str | None,
    *,
    preview_subdir: str,
    asset_type: str = "image",
) -> dict[str, Any]:
    if not source_url:
        return {
            "thumbnail_url": source_url,
            "preview_url": source_url,
            "download_url": source_url,
            "poster_url": None,
            "metadata_updates": {
                "preview_url": source_url,
                "download_url": source_url,
                "preview_ready": False,
                "derivative_status": "missing_source",
            },
            "preview_ready": False,
            "derivative_status": "missing_source",
            "derivative_error": "missing_source",
        }

    thumbnail_url = source_url
    preview_url = source_url
    metadata_updates: dict[str, Any] = {}
    derivative_error: str | None = None

    try:
        derived_thumbnail = generate_asset_card_thumbnail(source_url, asset_type=asset_type)
        thumbnail_url = derived_thumbnail.url
        metadata_updates.update(build_derivative_metadata(derived_thumbnail))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        derivative_error = str(exc)

    try:
        derived_preview = generate_asset_preview_image(source_url, output_subdir=preview_subdir)
        preview_url = derived_preview.url
        metadata_updates.update(
            {
                "preview_variant": derived_preview.variant,
                "preview_format": derived_preview.format,
                "preview_width": derived_preview.width,
                "preview_height": derived_preview.height,
            }
        )
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        preview_url = source_url
        if derivative_error is None:
            derivative_error = str(exc)

    derivative_status = "ready" if preview_url else "missing_source"
    metadata_updates.update(
        {
            "preview_url": preview_url,
            "download_url": source_url,
            "preview_ready": bool(preview_url),
            "derivative_status": derivative_status,
        }
    )
    if derivative_error:
        metadata_updates["derivative_error"] = derivative_error

    return {
        "thumbnail_url": thumbnail_url,
        "preview_url": preview_url,
        "download_url": source_url,
        "poster_url": thumbnail_url if asset_type == "video" else None,
        "metadata_updates": metadata_updates,
        "preview_ready": bool(preview_url),
        "derivative_status": derivative_status,
        "derivative_error": derivative_error,
    }


async def build_video_poster_bundle(
    *,
    video_url: str | None,
    fallback_thumbnail_url: str | None = None,
) -> dict[str, Any]:
    poster_source_url = fallback_thumbnail_url
    preview_video_url = video_url
    metadata_updates: dict[str, Any] = {
        "preview_video_url": preview_video_url,
        "download_url": video_url,
        "preview_ready": bool(video_url),
        "derivative_status": "ready" if video_url else "missing_source",
    }
    derivative_error: str | None = None
    preview_transcode_enabled = bool(
        getattr(settings, "MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE", True)
    )
    hls_enabled = bool(getattr(settings, "MEDIA_ENABLE_VIDEO_HLS", True))

    if preview_transcode_enabled and video_url:
        try:
            preview = await generate_video_preview(video_url)
        except (FileNotFoundError, ValueError, RuntimeError) as exc:
            derivative_error = str(exc)
            metadata_updates["preview_transcode_status"] = "failed"
            metadata_updates["preview_transcode_error"] = str(exc)
        else:
            preview_video_url = preview.preview_url
            metadata_updates.update(
                {
                    "preview_video_url": preview.preview_url,
                    "preview_variant": "video_preview_mp4",
                    "preview_codec": preview.codec,
                    "preview_bitrate": preview.bitrate,
                    "preview_duration": preview.duration,
                    "preview_width": preview.width,
                    "preview_height": preview.height,
                    "transcode_profile": preview.profile,
                    "preview_transcode_status": "ready",
                }
            )
    elif video_url:
        metadata_updates["preview_transcode_status"] = "disabled"

    if hls_enabled and video_url:
        try:
            generated_hls = await generate_video_hls(video_url)
        except (FileNotFoundError, ValueError, RuntimeError) as exc:
            metadata_updates["hls_packaging_status"] = "failed"
            metadata_updates["hls_packaging_error"] = str(exc)
            if derivative_error is None:
                derivative_error = str(exc)
        else:
            metadata_updates.update(
                {
                    "hls_url": generated_hls.hls_url,
                    "hls_master_playlist": generated_hls.hls_master_playlist,
                    "available_qualities": generated_hls.available_qualities,
                    "hls_variant_count": generated_hls.variant_count,
                    "default_quality": generated_hls.default_quality,
                    "hls_packaging_status": "ready",
                    "video_pipeline_stage": "completed",
                }
            )
    elif video_url:
        metadata_updates["hls_packaging_status"] = "disabled"

    if not poster_source_url and video_url:
        try:
            extracted = await extract_video_frame(video_url, "first")
        except (FileNotFoundError, ValueError, RuntimeError) as exc:
            derivative_error = str(exc)
        else:
            poster_source_url = extracted.frame_url
            metadata_updates.update(
                {
                    "auto_thumbnail_generated": True,
                    "auto_thumbnail_url": extracted.frame_url,
                    "auto_thumbnail_position": extracted.frame_position,
                    "auto_thumbnail_source": "first_frame",
                }
            )
            if extracted.duration is not None:
                metadata_updates["auto_thumbnail_source_video_duration"] = extracted.duration

    poster_bundle = build_image_derivative_bundle(
        poster_source_url,
        preview_subdir="derived/assets/video-posters",
        asset_type="video",
    )
    if not poster_bundle["thumbnail_url"] and fallback_thumbnail_url:
        poster_bundle = {
            **poster_bundle,
            "thumbnail_url": fallback_thumbnail_url,
            "poster_url": fallback_thumbnail_url,
        }

    metadata_updates.update(poster_bundle["metadata_updates"])
    metadata_updates["preview_video_url"] = preview_video_url
    metadata_updates["download_url"] = video_url
    metadata_updates["preview_ready"] = bool(
        metadata_updates.get("hls_url") or preview_video_url
    )
    metadata_updates.update(
        _build_video_pipeline_state_metadata(
            source_video_url=video_url,
            poster_url=poster_bundle["poster_url"] or poster_bundle["thumbnail_url"],
            preview_video_url=preview_video_url,
            hls_url=metadata_updates.get("hls_url"),
            hls_packaging_status=metadata_updates.get("hls_packaging_status"),
            metadata_committed=True,
        )
    )
    if derivative_error and "derivative_error" not in metadata_updates:
        metadata_updates["derivative_error"] = derivative_error

    return {
        "poster_url": poster_bundle["poster_url"] or poster_bundle["thumbnail_url"],
        "thumbnail_url": poster_bundle["thumbnail_url"],
        "preview_url": preview_video_url,
        "preview_video_url": preview_video_url,
        "download_url": video_url,
        "metadata_updates": metadata_updates,
        "preview_ready": bool(metadata_updates.get("hls_url") or preview_video_url),
        "derivative_status": "ready" if video_url else "missing_source",
        "derivative_error": derivative_error or poster_bundle.get("derivative_error"),
    }
