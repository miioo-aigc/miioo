import asyncio
from typing import Any

import fal_client

FAL_PROVIDER_NAME = "fal"
FAL_BASE_URL = "https://api.fal.ai"

FAL_FLUX_DEV_MODEL_ID = "fal-ai/flux/dev"
FAL_FLUX_SCHNELL_MODEL_ID = "fal-ai/flux/schnell"
FAL_STABLE_VIDEO_MODEL_ID = "fal-ai/stable-video"
FAL_WAN_FLF2V_MODEL_ID = "fal-ai/wan-flf2v"
FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID = "fal-ai/kling-video/v3/standard/text-to-video"
FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID = "fal-ai/kling-video/v3/standard/image-to-video"
FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID = "fal-ai/kling-video/v3/standard/motion-control"
FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID = "fal-ai/kling-video/v3/pro/text-to-video"
FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video"
FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID = "fal-ai/kling-video/v3/pro/motion-control"
FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/text-to-video"
FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/fast/text-to-video"
FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/image-to-video"
FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/fast/image-to-video"
FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/reference-to-video"
FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID = "bytedance/seedance-2.0/fast/reference-to-video"

FAL_SUPPORTED_IMAGE_MODELS = {
    FAL_FLUX_DEV_MODEL_ID,
    FAL_FLUX_SCHNELL_MODEL_ID,
}

FAL_SUPPORTED_VIDEO_MODELS = {
    FAL_STABLE_VIDEO_MODEL_ID,
    FAL_WAN_FLF2V_MODEL_ID,
    FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID,
}


def normalize_fal_model_id(model: str | None) -> str:
    return str(model or "").strip().lower()


def is_fal_provider(provider_type: str | None) -> bool:
    return str(provider_type or "").strip().lower() == FAL_PROVIDER_NAME


def is_fal_image_model(model: str | None) -> bool:
    return normalize_fal_model_id(model) in FAL_SUPPORTED_IMAGE_MODELS


def is_fal_video_model(model: str | None) -> bool:
    return normalize_fal_model_id(model) in FAL_SUPPORTED_VIDEO_MODELS


def is_fal_start_end_video_model(model: str | None) -> bool:
    return normalize_fal_model_id(model) == FAL_WAN_FLF2V_MODEL_ID


def is_fal_kling_video_model(model: str | None) -> bool:
    return normalize_fal_model_id(model) in {
        FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
        FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
        FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
        FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
        FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
        FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    }


def is_fal_kling_motion_control_model(model: str | None) -> bool:
    return normalize_fal_model_id(model) in {
        FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
        FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    }


def _parse_size_dimensions(size: str | None) -> dict[str, int] | None:
    normalized = str(size or "").strip().lower()
    if "x" not in normalized:
        return None
    width, height = normalized.split("x", 1)
    try:
        resolved_width = int(width)
        resolved_height = int(height)
    except ValueError:
        return None
    if resolved_width <= 0 or resolved_height <= 0:
        return None
    return {
        "width": resolved_width,
        "height": resolved_height,
    }


def resolve_flux_image_size(
    *,
    aspect_ratio: str | None,
    size: str | None,
) -> str | dict[str, int]:
    explicit_size = _parse_size_dimensions(size)
    if explicit_size:
        return explicit_size

    normalized_ratio = str(aspect_ratio or "").strip().replace(" ", "")
    ratio_to_size = {
        "1:1": "square_hd",
        "4:3": "landscape_4_3",
        "3:4": "portrait_4_3",
        "16:9": "landscape_16_9",
        "9:16": "portrait_16_9",
    }
    return ratio_to_size.get(normalized_ratio, "landscape_4_3")


async def run_fal_job(
    *,
    model_id: str,
    arguments: dict[str, Any],
    api_key: str,
) -> tuple[dict[str, Any], str]:
    def _submit_and_wait() -> tuple[dict[str, Any], str]:
        client = fal_client.SyncClient(key=api_key)
        handle = client.submit(model_id, arguments)
        result = handle.get()
        return result, handle.request_id

    return await asyncio.to_thread(_submit_and_wait)


def extract_fal_image_urls(result: dict[str, Any]) -> list[str]:
    images: list[str] = []
    raw_images = result.get("images")
    if isinstance(raw_images, list):
        for item in raw_images:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            if url:
                images.append(url)
    if images:
        return images

    image = result.get("image")
    if isinstance(image, dict):
        url = str(image.get("url") or "").strip()
        if url:
            return [url]
    return []


def extract_fal_video_payload(result: dict[str, Any]) -> dict[str, str]:
    video = result.get("video")
    if isinstance(video, dict):
        url = str(video.get("url") or "").strip()
        if url:
            return {
                "url": url,
                "thumbnail_url": str(
                    video.get("thumbnail_url")
                    or video.get("poster_url")
                    or video.get("cover_url")
                    or ""
                ).strip(),
            }
    return {
        "url": "",
        "thumbnail_url": "",
    }
