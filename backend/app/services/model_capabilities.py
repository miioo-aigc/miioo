from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.services.fal_runtime import (
    FAL_FLUX_DEV_MODEL_ID,
    FAL_FLUX_SCHNELL_MODEL_ID,
    FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
    is_fal_kling_motion_control_model,
    FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID,
    FAL_STABLE_VIDEO_MODEL_ID,
    FAL_WAN_FLF2V_MODEL_ID,
)

COMMON_IMAGE_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"]
COMMON_VIDEO_RATIOS = ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"]


def _build_image_capability(
    *,
    supported_sizes: list[str],
    supported_aspect_ratios: list[str],
    supported_generation_modes: list[str] | None = None,
    resolution_size_map: dict[str, dict[str, str]] | None = None,
    supported_reference_counts: list[int] | None = None,
    max_reference_images: int = 1,
    max_output_images: int = 4,
    supports_reference_images: bool = True,
    supports_multi_image: bool = True,
    supports_watermark_toggle: bool = True,
    supports_editing: bool = False,
    supports_outpainting: bool = False,
    max_total_images: int | None = None,
    supported_output_formats: list[str] | None = None,
    supported_response_formats: list[str] | None = None,
    supports_web_search: bool = False,
    supports_optimize_prompt: bool = False,
    supports_stream: bool = False,
    notes: str | None = None,
) -> dict[str, Any]:
    resolutions = list((resolution_size_map or {}).keys())
    normalized_supports_reference_images = supports_reference_images and max_reference_images > 0
    normalized_supported_reference_counts = supported_reference_counts
    if normalized_supported_reference_counts is None:
        if normalized_supports_reference_images:
            normalized_supported_reference_counts = list(range(0, max_reference_images + 1))
        else:
            normalized_supported_reference_counts = [0]
    return {
        "category": "image",
        "supported_generation_modes": supported_generation_modes or ["reference_image"],
        "supported_sizes": supported_sizes,
        "supported_aspect_ratios": supported_aspect_ratios,
        "supported_resolutions": resolutions,
        "resolution_size_map": resolution_size_map or {},
        "supported_reference_counts": normalized_supported_reference_counts,
        "max_reference_images": max_reference_images,
        "max_output_images": max_output_images,
        "max_total_images": max_total_images,
        "supports_reference_images": normalized_supports_reference_images,
        "supports_multi_image": supports_multi_image,
        "supports_watermark_toggle": supports_watermark_toggle,
        "supports_editing": supports_editing,
        "supports_outpainting": supports_outpainting,
        "supported_output_formats": supported_output_formats or [],
        "supported_response_formats": supported_response_formats or [],
        "supports_web_search": supports_web_search,
        "supports_optimize_prompt": supports_optimize_prompt,
        "supports_stream": supports_stream,
        "notes": notes,
    }


def _build_video_capability(
    *,
    supported_aspect_ratios: list[str] | None = None,
    supported_resolutions: list[str] | None = None,
    supported_durations: list[str] | None = None,
    supported_generation_modes: list[str] | None = None,
    reference_modes: list[str] | None = None,
    max_reference_images: int = 0,
    max_reference_videos: int = 0,
    max_reference_audios: int = 0,
    max_total_attachments: int | None = None,
    prompt_max_chars: int | None = None,
    supports_reference_video: bool = False,
    supports_reference_audio: bool = False,
    supports_generate_audio_toggle: bool = False,
    supports_watermark_toggle: bool = False,
    supports_text_only: bool = False,
    supports_reference_subjects: bool = False,
    supports_multiframe: bool = False,
    supports_audio_type: bool = False,
    supports_audio_setting: bool = False,
    supports_off_peak: bool = False,
    supports_video_edit: bool = False,
    supports_video_extension: bool = False,
    supports_web_search: bool = False,
    supports_return_last_frame: bool = False,
    supports_sample_mode: bool = False,
    supports_service_tier_flex: bool = False,
    supports_ratio_selection: bool | None = None,
    supports_duration_selection: bool | None = None,
    requires_first_frame: bool = False,
    requires_reference_video: bool = False,
    max_subjects: int = 0,
    max_subject_images_per_subject: int = 0,
    max_multiframe_segments: int = 0,
    notes: str | None = None,
) -> dict[str, Any]:
    return {
        "category": "video",
        "supported_aspect_ratios": supported_aspect_ratios or [],
        "supported_resolutions": supported_resolutions or [],
        "supported_durations": supported_durations or [],
        "supported_generation_modes": supported_generation_modes or ["full"],
        "reference_modes": reference_modes or ["full"],
        "max_reference_images": max_reference_images,
        "max_reference_videos": max_reference_videos,
        "max_reference_audios": max_reference_audios,
        "max_total_attachments": max_total_attachments,
        "max_subjects": max_subjects,
        "max_subject_images_per_subject": max_subject_images_per_subject,
        "max_multiframe_segments": max_multiframe_segments,
        "prompt_max_chars": prompt_max_chars,
        "supports_reference_video": supports_reference_video,
        "supports_reference_audio": supports_reference_audio,
        "supports_generate_audio_toggle": supports_generate_audio_toggle,
        "supports_watermark_toggle": supports_watermark_toggle,
        "supports_text_only": supports_text_only,
        "supports_reference_subjects": supports_reference_subjects,
        "supports_multiframe": supports_multiframe,
        "supports_audio_type": supports_audio_type,
        "supports_audio_setting": supports_audio_setting,
        "supports_off_peak": supports_off_peak,
        "supports_video_edit": supports_video_edit,
        "supports_video_extension": supports_video_extension,
        "supports_web_search": supports_web_search,
        "supports_return_last_frame": supports_return_last_frame,
        "supports_sample_mode": supports_sample_mode,
        "supports_service_tier_flex": supports_service_tier_flex,
        "supports_ratio_selection": bool(supported_aspect_ratios)
        if supports_ratio_selection is None
        else supports_ratio_selection,
        "supports_duration_selection": bool(supported_durations)
        if supports_duration_selection is None
        else supports_duration_selection,
        "requires_first_frame": requires_first_frame,
        "requires_reference_video": requires_reference_video,
        "notes": notes,
    }


IMAGE_MODEL_CAPABILITIES: dict[str, dict[str, Any]] = {
    FAL_FLUX_DEV_MODEL_ID: _build_image_capability(
        supported_sizes=[
            "square_hd",
            "square",
            "portrait_4_3",
            "portrait_16_9",
            "landscape_4_3",
            "landscape_16_9",
        ],
        supported_aspect_ratios=["1:1", "4:3", "3:4", "16:9", "9:16"],
        supported_generation_modes=["text_to_image"],
        max_reference_images=0,
        max_output_images=4,
        max_total_images=4,
        supports_reference_images=False,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        notes="依据 fal-ai/flux/dev 官方 API 收口；当前已放开 1-4 张文生图输出，不开放参考图与自定义水印。",
    ),
    FAL_FLUX_SCHNELL_MODEL_ID: _build_image_capability(
        supported_sizes=[
            "square_hd",
            "square",
            "portrait_4_3",
            "portrait_16_9",
            "landscape_4_3",
            "landscape_16_9",
        ],
        supported_aspect_ratios=["1:1", "4:3", "3:4", "16:9", "9:16"],
        supported_generation_modes=["text_to_image"],
        max_reference_images=0,
        max_output_images=1,
        max_total_images=1,
        supports_reference_images=False,
        supports_multi_image=False,
        supports_watermark_toggle=False,
        notes="依据 fal-ai/flux/schnell 官方 API 收口；当前作为快速文生图预置保守按单张输出接入，不开放参考图与自定义水印。",
    ),
    "doubao-seedream-5.0-lite": _build_image_capability(
        supported_sizes=["2K", "3K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS,
        supported_generation_modes=["text_to_image", "reference_image"],
        resolution_size_map={
            "2K": {
                "1:1": "2048x2048",
                "4:3": "2304x1728",
                "3:4": "1728x2304",
                "16:9": "2848x1600",
                "9:16": "1600x2848",
                "3:2": "2496x1664",
                "2:3": "1664x2496",
                "21:9": "3136x1344",
            },
            "3K": {
                "1:1": "3072x3072",
                "4:3": "3456x2592",
                "3:4": "2592x3456",
                "16:9": "4096x2304",
                "9:16": "2304x4096",
                "3:2": "3744x2496",
                "2:3": "2496x3744",
                "21:9": "4704x2016",
            },
            "4K": {
                "1:1": "4096x4096",
                "4:3": "4704x3520",
                "3:4": "3520x4704",
                "16:9": "5504x3040",
                "9:16": "3040x5504",
                "3:2": "4992x3328",
                "2:3": "3328x4992",
                "21:9": "6240x2656",
            },
        },
        supported_reference_counts=list(range(0, 15)),
        max_reference_images=14,
        max_output_images=15,
        max_total_images=15,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=True,
        supports_outpainting=True,
        supported_output_formats=["png", "jpeg"],
        supported_response_formats=["url", "b64_json"],
        supports_web_search=True,
        supports_optimize_prompt=True,
        supports_stream=True,
        notes="依据豆包 Seedream 5.0 Lite 官方图片生成文档收口；当前按官方 image/string|array 与 sequential_image_generation 参数透传，已支持文生图、单图/多图参考生图，以及文生/单图/多图参考组图；新增 output_format(png/jpeg)、response_format(url/b64_json)、web_search 联网搜索、optimize_prompt 提示词优化、stream 流式输出透传；参考图最多 14 张，且参考图数量 + 生成数量总和需 <= 15。",
    ),
    "doubao-seedream-4.5": _build_image_capability(
        supported_sizes=["2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS,
        supported_generation_modes=["text_to_image", "reference_image"],
        resolution_size_map={
            "2K": {
                "1:1": "2048x2048",
                "4:3": "2304x1728",
                "3:4": "1728x2304",
                "16:9": "2848x1600",
                "9:16": "1600x2848",
                "3:2": "2496x1664",
                "2:3": "1664x2496",
                "21:9": "3136x1344",
            },
            "4K": {
                "1:1": "4096x4096",
                "4:3": "4704x3520",
                "3:4": "3520x4704",
                "16:9": "5504x3040",
                "9:16": "3040x5504",
                "3:2": "4992x3328",
                "2:3": "3328x4992",
                "21:9": "6240x2656",
            },
        },
        supported_reference_counts=list(range(0, 15)),
        max_reference_images=14,
        max_output_images=15,
        max_total_images=15,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=True,
        supported_response_formats=["url", "b64_json"],
        supports_optimize_prompt=True,
        supports_stream=True,
        notes="依据豆包 Seedream 4.5 官方图片生成文档收口；当前按官方 image/string|array 与 sequential_image_generation 参数透传，已支持文生图、单图/多图参考生图，以及文生/单图/多图参考组图；支持 response_format、optimize_prompt、stream，但不支持 output_format/web_search（仅 5.0-lite）；不支持原生 1K 和 3K 档位，参考图最多 14 张，且参考图数量 + 生成数量总和需 <= 15。",
    ),
    "doubao-seedream-4.0": _build_image_capability(
        supported_sizes=["1K", "2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS,
        supported_generation_modes=["text_to_image", "reference_image"],
        resolution_size_map={
            "1K": {
                "1:1": "1024x1024",
                "4:3": "1152x864",
                "3:4": "864x1152",
                "16:9": "1280x720",
                "9:16": "720x1280",
                "3:2": "1248x832",
                "2:3": "832x1248",
                "21:9": "1512x648",
            },
            "2K": {
                "1:1": "2048x2048",
                "4:3": "2304x1728",
                "3:4": "1728x2304",
                "16:9": "2848x1600",
                "9:16": "1600x2848",
                "3:2": "2496x1664",
                "2:3": "1664x2496",
                "21:9": "3136x1344",
            },
            "4K": {
                "1:1": "4096x4096",
                "4:3": "4704x3520",
                "3:4": "3520x4704",
                "16:9": "5504x3040",
                "9:16": "3040x5504",
                "3:2": "4992x3328",
                "2:3": "3328x4992",
                "21:9": "6240x2656",
            },
        },
        supported_reference_counts=list(range(0, 15)),
        max_reference_images=14,
        max_output_images=15,
        max_total_images=15,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=True,
        supported_response_formats=["url", "b64_json"],
        supports_optimize_prompt=True,
        supports_stream=True,
        notes="依据豆包 Seedream 4.0 官方图片生成文档收口；当前按官方 image/string|array 与 sequential_image_generation 参数透传，已支持文生图、单图/多图参考生图，以及文生/单图/多图参考组图；支持 response_format、optimize_prompt、stream，但不支持 output_format/web_search（仅 5.0-lite）；不支持原生 3K 档位，参考图最多 14 张，且参考图数量 + 生成数量总和需 <= 15。",
    ),
    "gpt-image-2": _build_image_capability(
        supported_sizes=["1024x1024", "1536x1024", "1024x1536", "1792x1024", "1024x1792"],
        supported_aspect_ratios=["1:1", "3:2", "2:3", "16:9", "9:16"],
        supported_generation_modes=["text_to_image", "reference_image"],
        resolution_size_map={
            "1K": {"1:1": "1024x1024"},
            "2K": {
                "3:2": "1536x1024",
                "2:3": "1024x1536",
                "16:9": "1792x1024",
                "9:16": "1024x1792",
                "1:1": "1024x1024",
            },
        },
        max_reference_images=16,
        max_output_images=1,
        max_total_images=17,
        supports_reference_images=True,
        supports_multi_image=False,
        supports_watermark_toggle=False,
        supports_editing=True,
        supports_outpainting=True,
        notes="依据《模型要求.md》整理，并结合 OpenAI 官方 Image Generation 文档与现有服务适配收口；当前项目按新版兼容接口通过 image_urls 透传参考图，保留单图 / 多图参考声明，但多图上限仍待真实联调进一步核实。",
    ),
    "gemini-3.1-flash-image-preview": _build_image_capability(
        supported_sizes=["1K", "2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS + ["9:21", "1:8", "8:1"],
        supported_generation_modes=["text_to_image", "reference_image"],
        max_reference_images=14,
        max_output_images=4,
        max_total_images=18,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        supports_editing=True,
        notes="依据《模型要求.md》整理，并结合 Google Gemini 官方 image generation 文档收口；当前项目走 Gemini generateContent，并将参考图转 inlineData 透传；单图 / 多图参考上限仍待真实联调进一步核实。",
    ),
    "nano-banana-2-pro": _build_image_capability(
        supported_sizes=["0.5K", "1K", "2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS + ["9:21", "1:8", "8:1"],
        supported_generation_modes=["text_to_image", "reference_image"],
        max_reference_images=14,
        max_output_images=4,
        max_total_images=18,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        supports_editing=True,
        notes="依据《模型要求.md》整理，并结合 Google Gemini 官方 image generation 文档；当前项目已按 Gemini generateContent 链路接入，并将参考图转 inlineData 透传；单图 / 多图参考上限仍待真实联调进一步核实。",
    ),
    "nano-banana-2": _build_image_capability(
        supported_sizes=["0.5K", "1K", "2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS + ["9:21", "1:8", "8:1"],
        supported_generation_modes=["text_to_image", "reference_image"],
        max_reference_images=14,
        max_output_images=4,
        max_total_images=18,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        supports_editing=True,
        notes="依据《模型要求.md》整理，并结合 Google Gemini 官方 image generation 文档；当前项目已按 Gemini generateContent 链路接入，并将参考图转 inlineData 透传；单图 / 多图参考上限仍待真实联调进一步核实。",
    ),
    "image-vidu-q2": _build_image_capability(
        supported_sizes=["1080p", "2K", "4K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS,
        supported_generation_modes=["text_to_image", "reference_image"],
        max_reference_images=7,
        max_output_images=4,
        max_total_images=11,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        supports_editing=True,
        notes="依据《模型要求.md》与 OneLinkAI Vidu reference2image 文档整理；官方示例已覆盖仅 prompt 调用，因此当前保留 0 图 / 有图共用同一入口；最大 7 张参考图上限暂沿项目能力表保留，待真实联调进一步核实。",
    ),
    "image-kling-v3": _build_image_capability(
        supported_sizes=["1K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS,
        resolution_size_map={
            "1K": {
                "1:1": "1K",
                "4:3": "1K",
                "3:4": "1K",
                "16:9": "1K",
                "9:16": "1K",
                "3:2": "1K",
                "2:3": "1K",
                "21:9": "1K",
            }
        },
        supported_reference_counts=[0, 2, 3, 4],
        max_reference_images=4,
        max_output_images=4,
        max_total_images=5,
        supports_reference_images=True,
        supports_multi_image=True,
        supports_watermark_toggle=False,
        notes="依据 OneLinkAI Kling 图像兼容文档；当前统一使用真实模型名 image-kling-v3；无参考图时走 /kling/v1/images/generations，2 至 4 张参考图时走 /kling/v1/images/multi-image2image；页面按模型能力自动收敛输入。",
    ),
    "image-kling-v3-omni": _build_image_capability(
        supported_sizes=["1K"],
        supported_aspect_ratios=COMMON_IMAGE_RATIOS + ["auto"],
        resolution_size_map={
            "1K": {
                "1:1": "1K",
                "4:3": "1K",
                "3:4": "1K",
                "16:9": "1K",
                "9:16": "1K",
                "3:2": "1K",
                "2:3": "1K",
                "21:9": "1K",
                "auto": "1K",
            }
        },
        supported_reference_counts=[0, 1],
        max_reference_images=1,
        max_output_images=1,
        max_total_images=2,
        supports_reference_images=True,
        supports_multi_image=False,
        supports_watermark_toggle=False,
        supports_editing=True,
        notes="依据 OneLinkAI Kling 图像 Omni 兼容文档；当前统一使用真实模型名 image-kling-v3-omni；走 /kling/v1/images/omni-image；页面仅取首张参考图作为主输入。",
    ),
}

SEEDANCE_2_SUPPORTED_RATIOS = COMMON_VIDEO_RATIOS + ["adaptive"]
SEEDANCE_15_PRO_SUPPORTED_DURATIONS = [str(value) for value in range(4, 13)]
SEEDANCE_2_SUPPORTED_DURATIONS = [str(value) for value in range(4, 16)]
SEEDANCE_2_REFERENCE_MODES = ["full", "video_ref", "first_frame", "last_frame"]
SEEDANCE_15_PRO_GENERATION_MODES = ["text_to_video", "first_frame", "start_end"]
SEEDANCE_2_SUPPORTED_GENERATION_MODES = [
    "full",
    "text_to_video",
    "first_frame",
    "start_end",
    "video_ref",
]
SEEDANCE_SERIES_NOTES = (
    "依据《Doubao Seedance 2.0 系列教程》收口；"
    "Seedance 2.0 与 2.0 Fast 的能力类型一致，均支持文生、首帧、首尾帧、多模态参考、视频编辑、延长视频、联网搜索、样片模式、返回尾帧与离线推理；"
    "多模态输入支持文本、图片(0-9)、视频(0-3)、音频(0-3)，但不支持“文本+音频”或纯音频输入；"
    "当前项目侧已接入多模态参考、有声视频、水印开关，并按现有页面语义收口为 full / text_to_video / first_frame / start_end / video_ref。"
)
SEEDANCE_15_PRO_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=SEEDANCE_2_SUPPORTED_RATIOS,
    supported_resolutions=["480P", "720P", "1080P"],
    supported_durations=SEEDANCE_15_PRO_SUPPORTED_DURATIONS,
    supported_generation_modes=SEEDANCE_15_PRO_GENERATION_MODES,
    reference_modes=SEEDANCE_2_REFERENCE_MODES,
    max_reference_images=2,
    max_total_attachments=2,
    prompt_max_chars=2000,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_text_only=True,
    notes=(
        "依据 Seedance 1.5 Pro 公开能力页收口；当前按文生、首帧图生、首尾帧接入，"
        "支持 480P / 720P / 1080P、4-12 秒和原生音视频同步。"
    ),
)
SEEDANCE_2_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=SEEDANCE_2_SUPPORTED_RATIOS,
    supported_resolutions=["480P", "720P", "1080P"],
    supported_durations=SEEDANCE_2_SUPPORTED_DURATIONS,
    supported_generation_modes=SEEDANCE_2_SUPPORTED_GENERATION_MODES,
    reference_modes=SEEDANCE_2_REFERENCE_MODES,
    max_reference_images=9,
    max_reference_videos=3,
    max_reference_audios=3,
    max_total_attachments=15,
    prompt_max_chars=2000,
    supports_reference_video=True,
    supports_reference_audio=True,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_video_edit=True,
    supports_video_extension=True,
    supports_web_search=True,
    supports_return_last_frame=True,
    supports_sample_mode=True,
    supports_service_tier_flex=True,
    notes=SEEDANCE_SERIES_NOTES,
)
SEEDANCE_2_FAST_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=SEEDANCE_2_SUPPORTED_RATIOS,
    supported_resolutions=["480P", "720P"],
    supported_durations=SEEDANCE_2_SUPPORTED_DURATIONS,
    supported_generation_modes=SEEDANCE_2_SUPPORTED_GENERATION_MODES,
    reference_modes=SEEDANCE_2_REFERENCE_MODES,
    max_reference_images=9,
    max_reference_videos=3,
    max_reference_audios=3,
    max_total_attachments=15,
    prompt_max_chars=2000,
    supports_reference_video=True,
    supports_reference_audio=True,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_video_edit=True,
    supports_video_extension=True,
    supports_web_search=True,
    supports_return_last_frame=True,
    supports_sample_mode=True,
    supports_service_tier_flex=True,
    notes=SEEDANCE_SERIES_NOTES,
)
KLING_V3_SUPPORTED_RATIOS = ["16:9", "9:16", "1:1"]
KLING_V3_SUPPORTED_DURATIONS = [str(value) for value in range(3, 16)]
KLING_V3_TEXT_NOTES = (
    "依据 fal.ai Kling Video V3 官方 API 收口；当前按文生视频接入，支持 16:9 / 9:16 / 1:1 和 3-15 秒。"
)
KLING_V3_IMAGE_NOTES = (
    "依据 fal.ai Kling Video V3 官方 API 收口；当前按首帧图生视频接入，支持 16:9 / 9:16 / 1:1 和 3-15 秒。"
)
KLING_V3_MOTION_NOTES = (
    "依据 fal.ai Kling Video V3 官方 API 收口；当前按运动控制/视频编辑接入，需要 1 张首帧图和 1 段参考视频。"
)
FAL_KLING_V3_STANDARD_TEXT_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=KLING_V3_SUPPORTED_RATIOS,
    supported_resolutions=[],
    supported_durations=KLING_V3_SUPPORTED_DURATIONS,
    supported_generation_modes=["text_to_video"],
    reference_modes=[],
    max_reference_images=0,
    max_total_attachments=0,
    supports_generate_audio_toggle=True,
    supports_text_only=True,
    notes=KLING_V3_TEXT_NOTES,
)
FAL_KLING_V3_PRO_TEXT_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=KLING_V3_SUPPORTED_RATIOS,
    supported_resolutions=[],
    supported_durations=KLING_V3_SUPPORTED_DURATIONS,
    supported_generation_modes=["text_to_video"],
    reference_modes=[],
    max_reference_images=0,
    max_total_attachments=0,
    supports_generate_audio_toggle=True,
    supports_text_only=True,
    notes=KLING_V3_TEXT_NOTES,
)
FAL_KLING_V3_STANDARD_IMAGE_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=KLING_V3_SUPPORTED_RATIOS,
    supported_resolutions=[],
    supported_durations=KLING_V3_SUPPORTED_DURATIONS,
    supported_generation_modes=["first_frame", "start_end"],
    reference_modes=["first_frame", "last_frame"],
    max_reference_images=2,
    max_total_attachments=2,
    supports_generate_audio_toggle=True,
    requires_first_frame=True,
    notes=KLING_V3_IMAGE_NOTES,
)
FAL_KLING_V3_PRO_IMAGE_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=KLING_V3_SUPPORTED_RATIOS,
    supported_resolutions=[],
    supported_durations=KLING_V3_SUPPORTED_DURATIONS,
    supported_generation_modes=["first_frame", "start_end"],
    reference_modes=["first_frame", "last_frame"],
    max_reference_images=2,
    max_total_attachments=2,
    supports_generate_audio_toggle=True,
    requires_first_frame=True,
    notes=KLING_V3_IMAGE_NOTES,
)
FAL_KLING_V3_STANDARD_MOTION_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=[],
    supported_resolutions=[],
    supported_durations=[],
    supported_generation_modes=["video_edit"],
    reference_modes=["video_ref"],
    max_reference_images=1,
    max_reference_videos=1,
    max_total_attachments=2,
    supports_reference_video=True,
    supports_video_edit=True,
    supports_generate_audio_toggle=False,
    supports_ratio_selection=False,
    supports_duration_selection=False,
    requires_first_frame=True,
    requires_reference_video=True,
    notes=KLING_V3_MOTION_NOTES,
)
FAL_KLING_V3_PRO_MOTION_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=[],
    supported_resolutions=[],
    supported_durations=[],
    supported_generation_modes=["video_edit"],
    reference_modes=["video_ref"],
    max_reference_images=1,
    max_reference_videos=1,
    max_total_attachments=2,
    supports_reference_video=True,
    supports_video_edit=True,
    supports_generate_audio_toggle=False,
    supports_ratio_selection=False,
    supports_duration_selection=False,
    requires_first_frame=True,
    requires_reference_video=True,
    notes=KLING_V3_MOTION_NOTES,
)
KLING_V3_VIDEO_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=COMMON_VIDEO_RATIOS,
    supported_resolutions=[],
    supported_durations=["5"],
    supported_generation_modes=["text_to_video", "first_frame", "reference_subjects"],
    reference_modes=["full", "first_frame"],
    max_reference_images=4,
    max_total_attachments=4,
    prompt_max_chars=2500,
    supports_generate_audio_toggle=True,
    notes="依据 OneLinkAI Kling 视频兼容文档；当前统一使用真实模型名 video-kling-v3；纯提示词走 /kling/v1/videos/text2video，单图参考走 /kling/v1/videos/image2video，多图参考走 /kling/v1/videos/multi-image2video。",
)
KLING_OMNI_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=[],
    supported_resolutions=[],
    supported_durations=["5"],
    supported_generation_modes=["video_ref"],
    reference_modes=["video_ref"],
    max_reference_images=0,
    max_reference_videos=1,
    max_total_attachments=1,
    prompt_max_chars=2500,
    supports_reference_video=True,
    requires_reference_video=True,
    notes="依据 OneLinkAI Kling 视频 Omni 兼容文档；当前统一使用真实模型名 video-kling-v3-omni；走 /kling/v1/videos/omni-video；需要 1 段参考视频。",
)
VEO_31_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9", "9:16"],
    supported_resolutions=["720P", "1080P", "4K"],
    supported_durations=["4", "6", "8"],
    supported_generation_modes=["text_to_video", "first_frame", "start_end", "reference_subjects"],
    reference_modes=["full", "first_frame", "video_ref"],
    max_reference_images=3,
    max_total_attachments=3,
    supports_text_only=True,
    supports_reference_subjects=True,
    notes="依据 Veo 3.1 / OneLinkAI Gemini 兼容文档收口；当前按文生、图生、首尾帧、多参考图引导接入；涉及参考图的模式统一只支持 8 秒。",
)

VIDU_Q3_PRO_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9", "9:16", "4:3", "3:4", "1:1"],
    supported_resolutions=["540P", "720P", "1080P"],
    supported_durations=[str(value) for value in range(1, 17)],
    supported_generation_modes=["text_to_video", "first_frame", "start_end"],
    reference_modes=["first_frame", "video_ref"],
    max_reference_images=2,
    max_total_attachments=2,
    prompt_max_chars=5000,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_text_only=True,
    supports_audio_type=False,
    supports_off_peak=True,
    notes="依据 Vidu Q3 文生视频、图生视频、首尾帧文档；当前支持文生、首帧图生与首尾帧模式。",
)
VIDU_Q3_TURBO_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9", "9:16", "4:3", "3:4", "1:1"],
    supported_resolutions=["540P", "720P", "1080P"],
    supported_durations=[str(value) for value in range(1, 17)],
    supported_generation_modes=["text_to_video", "first_frame", "start_end"],
    reference_modes=["first_frame", "video_ref"],
    max_reference_images=2,
    max_total_attachments=2,
    prompt_max_chars=5000,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_text_only=True,
    supports_audio_type=False,
    supports_off_peak=True,
    notes="依据 Vidu Q3 Turbo 文生视频、图生视频、首尾帧文档；当前能力与 Q3 Pro 口径接近，但更强调生成速度。",
)
VIDU_Q3_PRO_FAST_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9", "9:16", "4:3", "3:4", "1:1"],
    supported_resolutions=["720P", "1080P"],
    supported_durations=[str(value) for value in range(1, 17)],
    supported_generation_modes=["first_frame", "start_end"],
    reference_modes=["first_frame", "video_ref"],
    max_reference_images=2,
    max_total_attachments=2,
    prompt_max_chars=5000,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_text_only=False,
    supports_audio_type=False,
    supports_off_peak=True,
    notes="依据 Vidu 图生视频文档；当前按 OneLinkAI 新代际图生/首尾帧模型口径接入。",
)
VIDU_Q3_MIX_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9", "9:16", "1:1"],
    supported_resolutions=["720P", "1080P"],
    supported_durations=[str(value) for value in range(3, 17)],
    supported_generation_modes=["reference_subjects"],
    reference_modes=["full"],
    max_reference_images=7,
    max_total_attachments=7,
    prompt_max_chars=2000,
    supports_generate_audio_toggle=True,
    supports_watermark_toggle=True,
    supports_text_only=False,
    supports_reference_subjects=True,
    max_subjects=7,
    max_subject_images_per_subject=3,
    notes="依据 Vidu 参考生视频文档（非主体调用）；当前通过多张图片参考生成主体一致视频。",
)
VIDU_Q2_MULTIFRAME_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9"],
    supported_resolutions=["540P", "720P", "1080P"],
    supported_durations=["2", "3", "4", "5", "6", "7"],
    supported_generation_modes=["multiframe"],
    reference_modes=["full"],
    max_reference_images=10,
    max_total_attachments=10,
    prompt_max_chars=5000,
    supports_text_only=False,
    supports_multiframe=True,
    supports_watermark_toggle=True,
    requires_first_frame=True,
    max_multiframe_segments=9,
    notes="依据 Vidu 智能多帧文档；使用首帧图加多段关键帧配置生成视频。",
)

VIDEO_MODEL_CAPABILITIES: dict[str, dict[str, Any]] = {
    FAL_STABLE_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=[],
        supported_resolutions=[],
        supported_durations=[],
        supported_generation_modes=["first_frame"],
        reference_modes=["first_frame"],
        max_reference_images=1,
        max_total_attachments=1,
        supports_text_only=False,
        supports_ratio_selection=False,
        supports_duration_selection=False,
        requires_first_frame=True,
        notes="依据 fal-ai/stable-video 官方 API 收口；当前首版按单张首帧图生视频接入，比例与时长跟随官方默认行为。",
    ),
    FAL_WAN_FLF2V_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["16:9", "9:16", "1:1"],
        supported_resolutions=["480P", "720P"],
        supported_durations=[],
        supported_generation_modes=["start_end"],
        reference_modes=["video_ref"],
        max_reference_images=2,
        max_total_attachments=2,
        supports_text_only=False,
        supports_duration_selection=False,
        requires_first_frame=True,
        notes="依据 fal-ai/wan-flf2v 官方 API 收口；当前按首尾帧过渡视频接入，要求同时提供首帧和尾帧，分辨率支持 480P / 720P。",
    ),
    FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID: FAL_KLING_V3_STANDARD_TEXT_CAPABILITIES,
    FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID: FAL_KLING_V3_PRO_TEXT_CAPABILITIES,
    FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID: FAL_KLING_V3_STANDARD_IMAGE_CAPABILITIES,
    FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID: FAL_KLING_V3_PRO_IMAGE_CAPABILITIES,
    FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID: FAL_KLING_V3_STANDARD_MOTION_CAPABILITIES,
    FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID: FAL_KLING_V3_PRO_MOTION_CAPABILITIES,
    FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["text_to_video"],
        reference_modes=[],
        supports_generate_audio_toggle=True,
        supports_text_only=True,
        notes="依据 fal.ai Seedance 2.0 text-to-video 官方 API 收口；当前按纯文生视频接入，支持 480P / 720P 和 4-15 秒。",
    ),
    FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["text_to_video"],
        reference_modes=[],
        supports_generate_audio_toggle=True,
        supports_text_only=True,
        notes="依据 fal.ai Seedance 2.0 fast text-to-video 官方 API 收口；当前按纯文生视频快速档接入，支持 480P / 720P 和 4-15 秒。",
    ),
    FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P", "1080P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["first_frame", "start_end"],
        reference_modes=["first_frame", "last_frame"],
        max_reference_images=2,
        max_total_attachments=2,
        supports_generate_audio_toggle=True,
        requires_first_frame=True,
        notes="依据 fal.ai Seedance 2.0 image-to-video 官方 API 收口；当前按首帧图生视频接入，可选尾帧图，支持 480P / 720P / 1080P 和 4-15 秒。",
    ),
    FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["first_frame", "start_end"],
        reference_modes=["first_frame", "last_frame"],
        max_reference_images=2,
        max_total_attachments=2,
        supports_generate_audio_toggle=True,
        requires_first_frame=True,
        notes="依据 fal.ai Seedance 2.0 fast image-to-video 官方 API 收口；当前按首帧图生视频快速档接入，可选尾帧图，支持 480P / 720P 和 4-15 秒。",
    ),
    FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P", "1080P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["full"],
        reference_modes=["full"],
        max_reference_images=9,
        max_reference_videos=3,
        max_reference_audios=3,
        max_total_attachments=12,
        supports_reference_video=True,
        supports_reference_audio=True,
        supports_generate_audio_toggle=True,
        supports_text_only=True,
        notes="依据 fal.ai Seedance 2.0 reference-to-video 官方 API 收口；当前按多模态参考生视频接入，可同时使用图片、视频与音频参考，支持 480P / 720P / 1080P 和 4-15 秒。",
    ),
    FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID: _build_video_capability(
        supported_aspect_ratios=["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
        supported_resolutions=["480P", "720P"],
        supported_durations=[str(value) for value in range(4, 16)],
        supported_generation_modes=["full"],
        reference_modes=["full"],
        max_reference_images=9,
        max_reference_videos=3,
        max_reference_audios=3,
        max_total_attachments=12,
        supports_reference_video=True,
        supports_reference_audio=True,
        supports_generate_audio_toggle=True,
        supports_text_only=True,
        notes="依据 fal.ai Seedance 2.0 fast reference-to-video 官方 API 收口；当前按多模态参考生视频快速档接入，可同时使用图片、视频与音频参考，支持 480P / 720P 和 4-15 秒。",
    ),
    "video-viduq3-pro": VIDU_Q3_PRO_CAPABILITIES,
    "video-vidu-q2": VIDU_Q2_MULTIFRAME_CAPABILITIES,
    "vidu-q2-turbo": VIDU_Q2_MULTIFRAME_CAPABILITIES,
    "doubao-seedance-1.5-pro": SEEDANCE_15_PRO_CAPABILITIES,
    "doubao-seedance-2.0": SEEDANCE_2_CAPABILITIES,
    "doubao-seedance-2-0-fast": SEEDANCE_2_FAST_CAPABILITIES,
    "happyhorse-1.0-t2v": _build_video_capability(
        supported_aspect_ratios=["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4"],
        supported_resolutions=["720P", "1080P"],
        supported_durations=[str(value) for value in range(3, 16)],
        supported_generation_modes=["text_to_video"],
        reference_modes=["full"],
        max_reference_images=0,
        supports_text_only=True,
        notes="依据 HappyHorse 文生视频文档；走 OneLinkAI /happyhorse/v1/services/aigc/video-generation/video-synthesis。",
    ),
    "happyhorse-1.0-i2v": _build_video_capability(
        supported_aspect_ratios=[],
        supported_resolutions=["720P", "1080P"],
        supported_durations=[str(value) for value in range(3, 16)],
        supported_generation_modes=["first_frame"],
        reference_modes=["first_frame"],
        max_reference_images=1,
        max_total_attachments=1,
        requires_first_frame=True,
        supports_ratio_selection=False,
        notes="依据 HappyHorse 图生视频文档；输入 1 张首帧图，输出比例跟随输入图片近似一致。",
    ),
    "happyhorse-1.0-r2v": _build_video_capability(
        supported_aspect_ratios=["16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "5:4"],
        supported_resolutions=["720P", "1080P"],
        supported_durations=[str(value) for value in range(3, 16)],
        supported_generation_modes=["reference_subjects"],
        reference_modes=["full"],
        max_reference_images=9,
        max_total_attachments=9,
        supports_reference_subjects=True,
        notes="依据 HappyHorse 参考生视频文档；支持 1-9 张参考图，提示词可通过 [Image n] 指代参考图。",
    ),
    "happyhorse-1.0-video-edit": _build_video_capability(
        supported_aspect_ratios=[],
        supported_resolutions=["720P", "1080P"],
        supported_durations=[],
        supported_generation_modes=["video_edit"],
        reference_modes=["video_ref"],
        max_reference_images=5,
        max_reference_videos=1,
        max_total_attachments=6,
        supports_reference_video=True,
        supports_audio_setting=True,
        supports_video_edit=True,
        supports_ratio_selection=False,
        supports_duration_selection=False,
        requires_reference_video=True,
        notes="依据 HappyHorse 视频编辑文档；需要 1 段待编辑视频，可选 0-5 张参考图，并支持 audio_setting=auto/origin。",
    ),
    "video-kling-v3": KLING_V3_VIDEO_CAPABILITIES,
    "video-kling-v3-omni": KLING_OMNI_CAPABILITIES,
    "veo-3.1-generate-preview": VEO_31_CAPABILITIES,
}

DEFAULT_IMAGE_CAPABILITIES = _build_image_capability(
    supported_sizes=["1024x1024", "1792x1024", "1024x1792"],
    supported_aspect_ratios=["1:1", "16:9", "9:16"],
    resolution_size_map={
        "1K": {"1:1": "1024x1024"},
        "2K": {"16:9": "1792x1024", "9:16": "1024x1792"},
    },
    max_reference_images=4,
    max_output_images=4,
    max_total_images=8,
    supports_reference_images=True,
    supports_multi_image=True,
    supports_watermark_toggle=False,
    notes="默认图片能力兜底。",
)

DEFAULT_VIDEO_CAPABILITIES = _build_video_capability(
    supported_aspect_ratios=["16:9"],
    supported_resolutions=["720P"],
    supported_durations=["5"],
    reference_modes=["full"],
    max_reference_images=0,
    notes="默认视频能力兜底。",
)


def _normalize_video_attachment_type(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    if normalized in {"image", "video", "audio"}:
        return normalized
    return None


def _collect_video_reference_counts(
    *,
    attachments: list[dict[str, Any]] | None = None,
    first_frame_url: str | None = None,
    last_frame_url: str | None = None,
    reference_video_url: str | None = None,
    reference_audio_url: str | None = None,
    first_frame_asset_id: str | None = None,
    last_frame_asset_id: str | None = None,
    reference_video_asset_id: str | None = None,
    reference_audio_asset_id: str | None = None,
    reference_image_asset_ids: list[str] | None = None,
) -> dict[str, int]:
    counts = {"image": 0, "video": 0, "audio": 0, "total": 0}
    seen: set[tuple[str, str]] = set()

    def _push(media_type: str | None, *, asset_id: Any = None, url: Any = None) -> None:
        if media_type not in counts:
            return
        asset_key = str(asset_id or "").strip()
        url_key = str(url or "").strip()
        unique_value = asset_key or url_key
        if not unique_value:
            return
        dedupe_key = (media_type, unique_value)
        if dedupe_key in seen:
            return
        seen.add(dedupe_key)
        counts[media_type] += 1
        counts["total"] += 1

    for item in attachments or []:
        media_type = _normalize_video_attachment_type(item.get("asset_type") or item.get("assetType"))
        _push(
            media_type,
            asset_id=item.get("asset_id") or item.get("assetId"),
            url=item.get("url"),
        )

    _push("image", asset_id=first_frame_asset_id, url=first_frame_url)
    _push("image", asset_id=last_frame_asset_id, url=last_frame_url)
    _push("video", asset_id=reference_video_asset_id, url=reference_video_url)
    _push("audio", asset_id=reference_audio_asset_id, url=reference_audio_url)

    for asset_id in reference_image_asset_ids or []:
        _push("image", asset_id=asset_id)

    return counts


def normalize_model_id(model_id: str | None) -> str:
    normalized = (model_id or "").strip().lower()
    if normalized in {"video-kling-v3", "video-kling-v3-omni", "image-kling-v3", "image-kling-v3-omni"}:
        return normalized
    if normalized in {"kling-v2-6", "kling-v1", "kling-v1-6", "kling-v3"}:
        return "video-kling-v3"
    if normalized in {"kling-video-o1", "kling-v3-omni"}:
        return "video-kling-v3-omni"
    if normalized in {"kling-v2-1", "kling-v2", "kling-v3-image"}:
        return "image-kling-v3"
    if normalized in {"kling-image-o1", "kling-v3-omni-image"}:
        return "image-kling-v3-omni"
    if normalized in {
        "video-viduq3-pro",
        "video-vidu-q2",
        "vidu-q2-turbo",
        "image-vidu-q2",
    }:
        return normalized
    if normalized.startswith("viduq3"):
        return "video-viduq3-pro"
    if (
        normalized.startswith("image-vidu") and normalized.endswith("q2")
    ) or normalized.endswith("-turbo-image"):
        return "image-vidu-q2"
    if normalized.startswith("vidu" "q2"):
        if "turbo" in normalized and "image" not in normalized:
            return "vidu-q2-turbo"
        return "video-vidu-q2"
    return normalized


def get_model_capabilities(model_id: str | None, category: str) -> dict[str, Any]:
    normalized = normalize_model_id(model_id)
    if category == "image":
        return IMAGE_MODEL_CAPABILITIES.get(normalized, DEFAULT_IMAGE_CAPABILITIES)
    if category == "video":
        return VIDEO_MODEL_CAPABILITIES.get(normalized, DEFAULT_VIDEO_CAPABILITIES)
    return {"category": category}


def infer_model_category(model_id: str | None) -> str:
    normalized = normalize_model_id(model_id)
    if normalized in VIDEO_MODEL_CAPABILITIES:
        return "video"
    if normalized in IMAGE_MODEL_CAPABILITIES:
        return "image"
    # 资产绑定当前主要服务于视频生成，未知模型按视频兜底。
    return "video"


def infer_video_reference_mode(
    model_id: str,
    *,
    first_frame_url: str | None = None,
    last_frame_url: str | None = None,
    reference_video_url: str | None = None,
    fallback_to_full_on_unsupported_first_frame: bool = False,
) -> str:
    # `full` 是默认兜底的多模态可选参考模式；仅当调用方明显提供了
    # 首尾帧或参考视频时，才推断到更具体的约束型模式。
    capabilities = get_model_capabilities(model_id, "video")
    reference_modes = set(capabilities.get("reference_modes") or ["full"])

    if reference_video_url:
        return "video_ref"

    if first_frame_url and last_frame_url:
        return "video_ref"

    if first_frame_url:
        if "first_frame" in reference_modes:
            return "first_frame"
        if fallback_to_full_on_unsupported_first_frame:
            return "full"
        return "first_frame"

    if last_frame_url:
        return "last_frame"

    return "full"


def resolve_optional_model_toggle(
    *,
    model_id: str,
    category: str,
    capability_key: str,
    requested_value: bool | None,
    default_value: Any = None,
    stored_value: Any = None,
) -> bool | None:
    if requested_value is not None:
        return requested_value

    capabilities = get_model_capabilities(model_id, category)
    if not capabilities.get(capability_key, False):
        return None

    if isinstance(default_value, bool):
        return default_value

    return stored_value if isinstance(stored_value, bool) else None


async def resolve_user_model(
    *,
    db: AsyncSession,
    user_id: UUID,
    category: str,
    requested_model: str | None,
    fallback_model: str,
) -> str:
    model_id = (requested_model or fallback_model).strip()
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.user_id == user_id,
            ModelConfig.category == category,
            ModelConfig.is_enabled == True,
        )
    )
    enabled_models = result.scalars().all()
    if not enabled_models:
        raise HTTPException(status_code=400, detail=f"当前没有可用的{category}模型")

    enabled_model_ids = {item.model_id for item in enabled_models}
    if model_id not in enabled_model_ids:
        raise HTTPException(status_code=400, detail=f"模型 {model_id} 未启用或不属于{category}分类")
    return model_id


def _normalize_ratio(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().replace(" ", "")
    return normalized or None


def _normalize_resolution(value: str | None) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    normalized = raw.upper()
    if normalized == "1080P":
        return "1080p"
    return normalized


def _normalize_image_size(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _infer_image_dimensions_from_size(
    *,
    size: str | None,
    resolution_size_map: dict[str, dict[str, str]] | None,
) -> tuple[str | None, str | None]:
    normalized_size = (size or "").strip().lower()
    if not normalized_size:
        return None, None

    resolution_map = resolution_size_map or {}
    for resolution, ratio_map in resolution_map.items():
        for ratio, mapped_size in (ratio_map or {}).items():
            if str(mapped_size).strip().lower() == normalized_size:
                return ratio, resolution

    symbolic_resolution = _normalize_resolution(size)
    if symbolic_resolution and symbolic_resolution in resolution_map:
        return None, symbolic_resolution

    return None, None


def _normalize_video_resolution(value: str | None) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    normalized = raw.upper()
    if normalized == "1080P":
        return "1080P"
    return normalized


def _coerce_count(value: int | None, default: int = 1) -> int:
    return int(value or default)


def validate_image_request(
    *,
    model: str,
    size: str | None,
    aspect_ratio: str | None,
    resolution: str | None,
    count: int | None,
    reference_images: list[str] | None = None,
    watermark: bool | None = None,
) -> dict[str, Any]:
    capabilities = get_model_capabilities(model, "image")
    resolution_size_map = capabilities.get("resolution_size_map") or {}
    ratio = _normalize_ratio(aspect_ratio)
    normalized_resolution = _normalize_resolution(resolution)
    normalized_size = _normalize_image_size(size)
    normalized_count = _coerce_count(count, default=1)
    normalized_references = [item for item in (reference_images or []) if item]

    if normalized_count > int(capabilities.get("max_output_images") or 1):
        raise HTTPException(status_code=400, detail=f"模型 {model} 最多生成 {capabilities['max_output_images']} 张图片")

    max_reference_images = int(capabilities.get("max_reference_images") or 0)
    if len(normalized_references) > max_reference_images:
        raise HTTPException(status_code=400, detail=f"模型 {model} 最多支持 {max_reference_images} 张参考图")

    supported_reference_counts = [
        int(item)
        for item in (capabilities.get("supported_reference_counts") or [])
        if isinstance(item, (int, float)) or str(item).isdigit()
    ]
    if supported_reference_counts and len(normalized_references) not in supported_reference_counts:
        allowed_counts = "、".join(str(item) for item in supported_reference_counts)
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 仅支持 {allowed_counts} 张参考图组合，当前为 {len(normalized_references)} 张",
        )

    max_total_images = capabilities.get("max_total_images")
    if max_total_images is not None and (len(normalized_references) + normalized_count) > int(max_total_images):
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 的参考图数量与生成数量总和不能超过 {max_total_images}",
        )

    if watermark is False and not capabilities.get("supports_watermark_toggle", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持自定义水印开关")

    inferred_ratio, inferred_resolution = _infer_image_dimensions_from_size(
        size=normalized_size,
        resolution_size_map=resolution_size_map,
    )
    ratio = ratio or inferred_ratio
    normalized_resolution = normalized_resolution or inferred_resolution

    resolved_size = normalized_size
    if ratio and normalized_resolution and resolution_size_map.get(normalized_resolution):
        mapped_size = resolution_size_map[normalized_resolution].get(ratio)
        if not mapped_size:
            raise HTTPException(
                status_code=400,
                detail=f"模型 {model} 不支持 {ratio} + {normalized_resolution} 的组合",
            )
        resolved_size = mapped_size
    elif normalized_size and "x" not in normalized_size.lower():
        size_upper = normalized_size.upper()
        if size_upper in resolution_size_map:
            normalized_resolution = normalized_resolution or size_upper
            ratio_options = resolution_size_map[size_upper]
            selected_ratio = ratio or next(iter(ratio_options.keys()), None)
            if not selected_ratio or selected_ratio not in ratio_options:
                raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {selected_ratio or '当前比例'}")
            ratio = selected_ratio
            resolved_size = ratio_options[selected_ratio]
        else:
            resolved_size = size_upper

    supported_ratios = capabilities.get("supported_aspect_ratios") or []
    if ratio and supported_ratios and ratio not in supported_ratios:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {ratio}")

    supported_resolutions = capabilities.get("supported_resolutions") or []
    if normalized_resolution and supported_resolutions and normalized_resolution not in supported_resolutions:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {normalized_resolution}")

    supported_sizes = capabilities.get("supported_sizes") or []
    if resolved_size and supported_sizes:
        size_candidates = {item.lower() for item in supported_sizes}
        if resolved_size.lower() not in size_candidates and resolved_size.upper() not in supported_sizes:
            if "x" in resolved_size.lower():
                # 对以 ratio+resolution 映射出的尺寸不再额外限制。
                pass
            else:
                raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {resolved_size}")

    return {
        "model": model,
        "capabilities": capabilities,
        "size": resolved_size,
        "aspect_ratio": ratio,
        "resolution": normalized_resolution,
        "count": normalized_count,
        "reference_images": normalized_references,
    }


def validate_video_request(
    *,
    model: str,
    prompt: str | None = None,
    ratio: str | None,
    resolution: str | None,
    duration: float | int | str | None,
    generation_mode: str | None = None,
    reference_mode: str | None = None,
    first_frame_url: str | None = None,
    last_frame_url: str | None = None,
    reference_video_url: str | None = None,
    reference_audio_url: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
    subjects: list[dict[str, Any]] | None = None,
    multiframe_segments: list[dict[str, Any]] | None = None,
    first_frame_asset_id: str | None = None,
    last_frame_asset_id: str | None = None,
    reference_video_asset_id: str | None = None,
    reference_audio_asset_id: str | None = None,
    reference_image_asset_ids: list[str] | None = None,
    generate_audio: bool | None = None,
    audio_type: str | None = None,
    audio_setting: str | None = None,
    off_peak: bool | None = None,
    watermark: bool | None = None,
) -> dict[str, Any]:
    capabilities = get_model_capabilities(model, "video")
    normalized_ratio = _normalize_ratio(ratio)
    normalized_resolution = _normalize_video_resolution(resolution)
    duration_value = str(int(duration)) if isinstance(duration, (int, float)) else (str(duration).strip() if duration is not None else None)
    mode = (reference_mode or "full").strip() or "full"
    normalized_generation_mode = (generation_mode or "").strip() or None
    validated_assets = validate_asset_bindings(
        model=model,
        attachments=attachments,
        reference_video_url=reference_video_url,
        reference_audio_url=reference_audio_url,
        first_frame_url=first_frame_url,
        last_frame_url=last_frame_url,
        reference_video_asset_id=reference_video_asset_id,
        reference_audio_asset_id=reference_audio_asset_id,
        first_frame_asset_id=first_frame_asset_id,
        last_frame_asset_id=last_frame_asset_id,
        reference_image_asset_ids=reference_image_asset_ids or [],
    )

    def _collect_ref_urls(
        refs: list[dict[str, Any]],
        *,
        roles: set[str] | None = None,
    ) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()
        normalized_roles = {str(role).strip().lower() for role in (roles or set()) if str(role).strip()}
        for ref in refs:
            url = str(ref.get("url") or "").strip()
            role = str(ref.get("role") or "").strip().lower()
            if not url or url in seen:
                continue
            if normalized_roles and role not in normalized_roles:
                continue
            seen.add(url)
            urls.append(url)
        return urls

    video_refs = validated_assets.get("video_refs") or []
    audio_refs = validated_assets.get("audio_refs") or []
    image_refs = validated_assets.get("image_refs") or []

    generic_image_urls = _collect_ref_urls(
        image_refs,
        roles={"reference", "reference_image", "character", "scene", "prop", ""},
    )
    first_frame_candidate_urls = _collect_ref_urls(image_refs, roles={"first_frame"})
    last_frame_candidate_urls = _collect_ref_urls(image_refs, roles={"last_frame"})
    video_candidate_urls = _collect_ref_urls(video_refs)
    audio_candidate_urls = _collect_ref_urls(audio_refs)

    effective_image_url = generic_image_urls[0] if generic_image_urls else None
    effective_first_frame_url = (
        first_frame_url
        or (first_frame_candidate_urls[0] if first_frame_candidate_urls else None)
        or effective_image_url
    )
    effective_last_frame_url = (
        last_frame_url
        or (last_frame_candidate_urls[0] if last_frame_candidate_urls else None)
    )
    effective_reference_video_url = (
        reference_video_url
        or (video_candidate_urls[0] if video_candidate_urls else None)
    )
    effective_reference_audio_url = (
        reference_audio_url
        or (audio_candidate_urls[0] if audio_candidate_urls else None)
    )

    supported_ratios = capabilities.get("supported_aspect_ratios") or []
    if normalized_ratio and supported_ratios and normalized_ratio not in supported_ratios:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {normalized_ratio}")

    supported_resolutions = capabilities.get("supported_resolutions") or []
    if normalized_resolution and supported_resolutions and normalized_resolution not in supported_resolutions:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {normalized_resolution}")

    supported_durations = capabilities.get("supported_durations") or []
    if duration_value and duration_value != "auto" and supported_durations and duration_value not in supported_durations:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {duration_value} 秒")

    prompt_max_chars = capabilities.get("prompt_max_chars")
    normalized_prompt = str(prompt or "")
    if prompt_max_chars is not None and len(normalized_prompt) > int(prompt_max_chars):
        raise HTTPException(status_code=400, detail=f"模型 {model} 的提示词最多支持 {prompt_max_chars} 个字符")

    reference_modes = capabilities.get("reference_modes") or ["full"]
    if mode not in reference_modes:
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {mode} 参考模式")

    reference_counts = {
        "image": len(image_refs),
        "video": len(video_refs),
        "audio": len(audio_refs),
        "total": int(validated_assets.get("total_count") or 0),
    }

    supported_generation_modes = capabilities.get("supported_generation_modes") or []
    if supported_generation_modes:
        if not normalized_generation_mode:
            # 只有“纯视频编辑型”模型在未显式指定 generation_mode 时，
            # 才根据参考视频自动落到 video_edit；像 Seedance 这类同时支持
            # 全能参考和视频编辑的模型，默认仍应保留调用方传入/推断出的参考模式。
            should_infer_video_edit = (
                bool(effective_reference_video_url)
                and "video_edit" in supported_generation_modes
                and (
                    capabilities.get("requires_reference_video")
                    or len(supported_generation_modes) == 1
                )
            )
            if should_infer_video_edit:
                normalized_generation_mode = "video_edit"
            elif normalize_model_id(model) in {"video-vidu-q2", "vidu-q2-turbo"}:
                normalized_generation_mode = "multiframe"
            elif "reference_subjects" in supported_generation_modes and (reference_image_asset_ids or reference_counts.get("image", 0) > 0):
                normalized_generation_mode = "reference_subjects"
            elif mode == "full" and reference_counts.get("total", 0) > 0 and "full" in supported_generation_modes:
                # `reference_mode=full` 且带参考素材时，应落到多模态全能参考，
                # 不能误判为 text_to_video，否则会被后续“文生视频不支持参考素材”校验拦截。
                normalized_generation_mode = "full"
            elif effective_first_frame_url and effective_last_frame_url:
                normalized_generation_mode = "start_end"
            elif effective_first_frame_url:
                normalized_generation_mode = "first_frame"
            else:
                normalized_generation_mode = "text_to_video"
        if normalized_generation_mode not in supported_generation_modes:
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持 {normalized_generation_mode} 模式")

    # 只有模型能力显式要求首帧时，才做首帧必填校验；`full` 本身不强制依赖首帧/尾帧。
    if capabilities.get("requires_first_frame") and not (
        effective_first_frame_url
        or (mode == "video_ref" and effective_last_frame_url)
    ):
        raise HTTPException(status_code=400, detail=f"模型 {model} 需要首帧参考图")

    if mode == "video_ref" and effective_last_frame_url:
        max_reference_images = int(capabilities.get("max_reference_images") or 0)
        if max_reference_images and max_reference_images < 2:
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持尾帧参考")

    if effective_reference_video_url and not capabilities.get("supports_reference_video", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持参考视频")

    if capabilities.get("requires_reference_video") and not effective_reference_video_url:
        raise HTTPException(status_code=400, detail=f"模型 {model} 需要提供参考视频")

    if effective_reference_audio_url and not capabilities.get("supports_reference_audio", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持参考音频")

    if audio_type and not capabilities.get("supports_audio_type", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持音频类型拆分")

    normalized_audio_setting = str(audio_setting or "").strip().lower() or None
    if normalized_audio_setting and not capabilities.get("supports_audio_setting", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持音频设置")
    if normalized_audio_setting and normalized_audio_setting not in {"auto", "origin"}:
        raise HTTPException(status_code=400, detail="audio_setting 仅支持 auto 或 origin")

    if generate_audio is not None and not capabilities.get("supports_generate_audio_toggle", False):
        default_generate_audio = generate_audio is True
        if default_generate_audio is False:
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持音频开关")

    if off_peak is True and not capabilities.get("supports_off_peak", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持错峰生成")

    if watermark is False and not capabilities.get("supports_watermark_toggle", False):
        raise HTTPException(status_code=400, detail=f"模型 {model} 不支持自定义水印开关")

    max_reference_images = int(capabilities.get("max_reference_images") or 0)
    max_reference_videos = int(capabilities.get("max_reference_videos") or 0)
    max_reference_audios = int(capabilities.get("max_reference_audios") or 0)
    max_total_attachments = capabilities.get("max_total_attachments")

    if reference_counts["image"] > max_reference_images:
        raise HTTPException(status_code=400, detail=f"模型 {model} 最多支持 {max_reference_images} 个图片参考素材")

    if reference_counts["video"] > max_reference_videos:
        raise HTTPException(status_code=400, detail=f"模型 {model} 最多支持 {max_reference_videos} 个视频参考素材")

    if reference_counts["audio"] > max_reference_audios:
        raise HTTPException(status_code=400, detail=f"模型 {model} 最多支持 {max_reference_audios} 个音频参考素材")

    if max_total_attachments is not None and reference_counts["total"] > int(max_total_attachments):
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 的参考素材总数不能超过 {max_total_attachments}",
        )

    normalized_subjects = [item for item in (subjects or []) if isinstance(item, dict)]
    normalized_multiframe_segments = [
        item for item in (multiframe_segments or []) if isinstance(item, dict)
    ]

    if normalized_generation_mode == "text_to_video" and reference_counts["total"] > 0:
        raise HTTPException(status_code=400, detail=f"模型 {model} 的文生视频模式不支持额外参考素材")
    if normalized_generation_mode == "first_frame" and not effective_first_frame_url:
        raise HTTPException(status_code=400, detail=f"模型 {model} 的首帧参考模式需要首帧图片")
    if normalized_generation_mode == "first_frame" and reference_counts["video"] > 0:
        raise HTTPException(status_code=400, detail=f"模型 {model} 的首帧参考模式不支持视频参考")
    if normalized_generation_mode == "first_frame" and reference_counts["audio"] > 0:
        raise HTTPException(status_code=400, detail=f"模型 {model} 的首帧参考模式不支持音频参考")
    if normalized_generation_mode == "start_end" and not (
        effective_first_frame_url and effective_last_frame_url
    ):
        raise HTTPException(status_code=400, detail=f"模型 {model} 的首尾帧模式需要同时提供首帧和尾帧")
    if normalized_generation_mode == "reference_subjects":
        if not capabilities.get("supports_reference_subjects", False):
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持主体参考模式")
        if not normalized_subjects and reference_counts["image"] <= 0:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的主体参考模式至少需要 1 张参考图")
        max_subjects = int(capabilities.get("max_subjects") or 0)
        if max_subjects and len(normalized_subjects) > max_subjects:
            raise HTTPException(status_code=400, detail=f"模型 {model} 最多支持 {max_subjects} 个主体")
    if normalized_generation_mode == "multiframe":
        if not capabilities.get("supports_multiframe", False):
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持智能多帧")
        if not effective_first_frame_url:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的智能多帧模式需要起始图")
        if len(normalized_multiframe_segments) < 2:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的智能多帧模式至少需要 2 个关键帧")
        max_multiframe_segments = int(capabilities.get("max_multiframe_segments") or 0)
        if max_multiframe_segments and len(normalized_multiframe_segments) > max_multiframe_segments:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的关键帧数量不能超过 {max_multiframe_segments}")
    if normalized_generation_mode == "video_edit":
        if not capabilities.get("supports_video_edit", False):
            raise HTTPException(status_code=400, detail=f"模型 {model} 不支持视频编辑")
        if not effective_reference_video_url:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的视频编辑模式需要待编辑视频")
        if not is_fal_kling_motion_control_model(model) and (
            effective_first_frame_url or effective_last_frame_url
        ):
            raise HTTPException(status_code=400, detail=f"模型 {model} 的视频编辑模式不支持首尾帧字段")
        if reference_counts["audio"] > 0:
            raise HTTPException(status_code=400, detail=f"模型 {model} 的视频编辑模式不支持音频参考")

    if normalize_model_id(model) == "veo-3.1-generate-preview":
        if normalized_generation_mode in {"first_frame", "start_end", "reference_subjects"} and duration_value != "8":
            raise HTTPException(
                status_code=400,
                detail="Veo 3.1 的图生/首尾帧/多参考图模式当前仅支持 8 秒",
            )

    return {
        "model": model,
        "capabilities": capabilities,
        "ratio": normalized_ratio,
        "resolution": normalized_resolution,
        "duration": duration_value,
        "generation_mode": normalized_generation_mode,
        "reference_mode": mode,
        "reference_counts": reference_counts,
        "audio_setting": normalized_audio_setting,
        "image_url": effective_image_url,
        "first_frame_url": effective_first_frame_url,
        "last_frame_url": effective_last_frame_url,
        "reference_video_url": effective_reference_video_url,
        "reference_audio_url": effective_reference_audio_url,
        "asset_bindings": validated_assets,
    }


# ============================================================================
# 资产绑定能力配置系统
# ============================================================================

def get_model_asset_binding_capabilities(model: str) -> dict[str, Any]:
    """
    获取模型的资产绑定能力配置

    返回格式：
    {
        "reference_video": {
            "enabled": bool,
            "max_count": int,
            "max_duration_seconds": int | None,
            "supported_formats": list[str],
            "notes": str | None,
        },
        "reference_audio": { ... },
        "reference_image": { ... },
        "first_last_frame": { ... },
    }
    """
    category = infer_model_category(model)
    capabilities = get_model_capabilities(model, category)
    max_reference_images = int(capabilities.get("max_reference_images") or 0)
    max_total_attachments = capabilities.get("max_total_attachments")
    if category == "image" and max_total_attachments is None:
        max_total_attachments = capabilities.get("max_total_images")

    # 从现有 capabilities 提取资产绑定配置
    return {
        "reference_video": {
            "enabled": category == "video" and capabilities.get("supports_reference_video", False),
            "max_count": int(capabilities.get("max_reference_videos") or 0) if category == "video" else 0,
            "max_duration_seconds": None,  # 可后续扩展
            "supported_formats": ["mp4", "mov"],
            "notes": "支持参考视频动作迁移" if category == "video" and capabilities.get("supports_reference_video") else None,
        },
        "reference_audio": {
            "enabled": category == "video" and capabilities.get("supports_reference_audio", False),
            "max_count": int(capabilities.get("max_reference_audios") or 0) if category == "video" else 0,
            "max_duration_seconds": None,
            "supported_formats": ["mp3", "wav"],
            "notes": "支持参考音频驱动" if category == "video" and capabilities.get("supports_reference_audio") else None,
        },
        "reference_image": {
            "enabled": max_reference_images > 0,
            "max_count": max_reference_images,
            "roles": ["character", "scene", "prop", "reference"],
            "notes": None,
        },
        "first_last_frame": {
            "enabled": category == "video" and (
                "first_frame" in capabilities.get("supported_generation_modes", [])
                or "start_end" in capabilities.get("supported_generation_modes", [])
            ),
            "notes": "支持首尾帧图片控制" if category == "video" else None,
        },
        "subjects": {
            "enabled": category == "video" and capabilities.get("supports_reference_subjects", False),
            "max_subjects": int(capabilities.get("max_subjects") or 0) if category == "video" else 0,
            "max_images_per_subject": int(capabilities.get("max_subject_images_per_subject") or 0)
            if category == "video"
            else 0,
            "notes": "支持多主体参考图片" if category == "video" else None,
        },
        "multiframe": {
            "enabled": category == "video" and capabilities.get("supports_multiframe", False),
            "max_segments": int(capabilities.get("max_multiframe_segments") or 0) if category == "video" else 0,
            "notes": "支持多帧分段控制" if category == "video" else None,
        },
        "total_attachments": {
            "max_count": max_total_attachments,
            "notes": "所有类型资产总数限制",
        },
    }


def validate_asset_bindings(
    model: str,
    attachments: list[dict] | None = None,
    reference_video_url: str | None = None,
    reference_audio_url: str | None = None,
    first_frame_url: str | None = None,
    last_frame_url: str | None = None,
    reference_video_asset_id: str | None = None,
    reference_audio_asset_id: str | None = None,
    first_frame_asset_id: str | None = None,
    last_frame_asset_id: str | None = None,
    reference_image_asset_ids: list[str] | None = None,
) -> dict[str, Any]:
    """
    验证资产绑定是否符合模型能力

    返回标准化的资产绑定结构：
    {
        "video_refs": [{"url": str, "asset_id": str | None, "role": str}],
        "audio_refs": [...],
        "image_refs": [...],
    }

    Raises:
        HTTPException: 当资产绑定不符合模型能力时
    """
    capabilities = get_model_asset_binding_capabilities(model)

    # 收集所有资产引用
    video_refs = []
    audio_refs = []
    image_refs = []

    # 1. 兼容旧格式 - 显式 URL 参数
    if reference_video_url or reference_video_asset_id:
        video_refs.append({
            "url": reference_video_url,
            "asset_id": reference_video_asset_id,
            "role": "reference",
            "source": "legacy_param" if reference_video_url else "legacy_asset_id",
        })
    if reference_audio_url or reference_audio_asset_id:
        audio_refs.append({
            "url": reference_audio_url,
            "asset_id": reference_audio_asset_id,
            "role": "reference",
            "source": "legacy_param" if reference_audio_url else "legacy_asset_id",
        })
    if first_frame_url or first_frame_asset_id:
        image_refs.append({
            "url": first_frame_url,
            "asset_id": first_frame_asset_id,
            "role": "first_frame",
            "source": "legacy_param" if first_frame_url else "legacy_asset_id",
        })
    if last_frame_url or last_frame_asset_id:
        image_refs.append({
            "url": last_frame_url,
            "asset_id": last_frame_asset_id,
            "role": "last_frame",
            "source": "legacy_param" if last_frame_url else "legacy_asset_id",
        })

    # 2. 解析 reference_image_asset_ids（仅 asset_id，URL 由调用方解析）
    if reference_image_asset_ids:
        for asset_id in reference_image_asset_ids:
            if asset_id and asset_id.strip():
                image_refs.append({
                    "url": None,  # 需要调用方解析
                    "asset_id": asset_id,
                    "role": "reference",
                    "source": "legacy_asset_id",
                })

    # 3. 解析统一的 attachments 数组（新格式，优先级更高）
    for att in attachments or []:
        asset_type = att.get("asset_type") or att.get("assetType")
        url = att.get("url")
        asset_id = att.get("asset_id") or att.get("assetId")
        role = att.get("role", "reference")

        if not asset_type or (not url and not asset_id):
            continue

        binding = {
            "url": url,
            "asset_id": asset_id,
            "role": role,
            "source": "attachments",
            "asset_name": att.get("asset_name"),
        }

        if asset_type == "video":
            video_refs.append(binding)
        elif asset_type == "audio":
            audio_refs.append(binding)
        elif asset_type == "image":
            image_refs.append(binding)

    # 4. 去重（同一个 asset_id 或 url 只保留一个，attachments 优先）
    def dedupe_refs(refs: list[dict]) -> list[dict]:
        seen_urls = set()
        seen_asset_ids = set()
        unique_refs = []

        # 优先保留 attachments 来源的
        sorted_refs = sorted(refs, key=lambda x: 0 if x.get("source") == "attachments" else 1)

        for ref in sorted_refs:
            url = ref.get("url")
            asset_id = ref.get("asset_id")

            # 跳过已见过的
            if url and url in seen_urls:
                continue
            if asset_id and asset_id in seen_asset_ids:
                continue

            unique_refs.append(ref)
            if url:
                seen_urls.add(url)
            if asset_id:
                seen_asset_ids.add(asset_id)

        return unique_refs

    video_refs = dedupe_refs(video_refs)
    audio_refs = dedupe_refs(audio_refs)
    image_refs = dedupe_refs(image_refs)

    # 5. 能力校验
    if video_refs and not capabilities["reference_video"]["enabled"]:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 不支持参考视频"
        )

    if audio_refs and not capabilities["reference_audio"]["enabled"]:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 不支持参考音频"
        )

    # 数量限制
    max_videos = capabilities["reference_video"]["max_count"]
    if len(video_refs) > max_videos:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 最多支持 {max_videos} 个参考视频，当前提供了 {len(video_refs)} 个"
        )

    max_audios = capabilities["reference_audio"]["max_count"]
    if len(audio_refs) > max_audios:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 最多支持 {max_audios} 个参考音频，当前提供了 {len(audio_refs)} 个"
        )

    max_images = capabilities["reference_image"]["max_count"]
    if len(image_refs) > max_images:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 最多支持 {max_images} 个参考图片，当前提供了 {len(image_refs)} 个"
        )

    # 总附件数限制
    max_total = capabilities["total_attachments"]["max_count"]
    total_count = len(video_refs) + len(audio_refs) + len(image_refs)
    if max_total is not None and total_count > max_total:
        raise HTTPException(
            status_code=400,
            detail=f"模型 {model} 所有资产总数不能超过 {max_total}，当前提供了 {total_count} 个"
        )

    return {
        "video_refs": video_refs,
        "audio_refs": audio_refs,
        "image_refs": image_refs,
        "total_count": total_count,
        "capabilities": capabilities,
    }
