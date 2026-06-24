import hashlib
import io
import json
import re
import zipfile
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote, unquote, urlparse
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.episode import Episode
from app.models.subject import Subject
from app.models.storyboard import Storyboard
from app.models.asset import Asset
from app.models.gen_task import GenTask
from app.models.model_config import ModelConfig
from app.services.background_runtime import (
    build_gen_task_job_key,
    dispatch_background_job,
)
from app.services.media_derivative_pipeline import (
    build_image_derivative_bundle,
    build_video_playback_metadata,
    build_video_poster_bundle,
)
from app.services.media_fetch import read_media_bytes
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.storyboard_gen import generate_storyboard
from app.services.image_gen import image_gen_service
from app.services.model_selection import get_default_available_model_id
from app.services.model_capabilities import (
    get_model_capabilities,
    infer_video_reference_mode,
    resolve_optional_model_toggle,
    resolve_user_model,
    validate_image_request,
    validate_video_request,
)
from app.services.asset_recycle import apply_asset_visibility
from app.services.media_storage import (
    build_upload_url,
    get_media_fallback_extension,
    persist_if_external,
    persist_many_if_external,
    persist_remote_file,
    persist_uploaded_file,
    resolve_upload_dir,
    resolve_upload_path,
)
from app.services.project_audio import resolve_storyboard_seedance_voice_video_inputs
from app.services.project_script_service import finalize_project_script, get_or_create_project_script
from app.services.media_view_models import build_image_media_fields, build_video_media_fields
from app.services.video_gen import video_gen_service
from app.services.user_api_key import (
    get_user_api_key,
    get_user_model_provider_credentials,
    get_user_model_provider_runtime,
)
from app.services.visual_styles import append_visual_styles, resolve_visual_style_text
from app.utils.media_urls import is_video_like_url, pick_safe_thumbnail_url
router = APIRouter()
STORYBOARD_SEEDANCE_VOICE_VIDEO_MODEL_IDS = {
    "doubao-seedance-2.0",
    "doubao-seedance-2-0-fast",
}

STORYBOARD_IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
STORYBOARD_IMAGE_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
STORYBOARD_VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mov"}
STORYBOARD_VIDEO_ALLOWED_CONTENT_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_STORYBOARD_IMAGE_SIZE = 20 * 1024 * 1024
STORYBOARD_LIST_DEFAULT_LIMIT = 100
STORYBOARD_LIST_MAX_LIMIT = 200


def _derive_asset_thumbnail(source_url: str | None, *, asset_type: str) -> tuple[str | None, dict]:
    bundle = build_image_derivative_bundle(
        source_url,
        preview_subdir="storyboards/derived/preview",
        asset_type=asset_type,
    )
    return bundle["thumbnail_url"], dict(bundle["metadata_updates"])


def _derive_asset_preview(source_url: str | None, *, output_subdir: str) -> tuple[str | None, dict]:
    bundle = build_image_derivative_bundle(
        source_url,
        preview_subdir=output_subdir,
        asset_type="image",
    )
    return bundle["preview_url"], dict(bundle["metadata_updates"])
MAX_STORYBOARD_VIDEO_SIZE = 100 * 1024 * 1024


CHINESE_DIGITS = "零一二三四五六七八九"


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
                parts.append("零")
                zero_pending = False
            parts.append(f"{CHINESE_DIGITS[digit]}{units[unit_index]}")
        unit_index += 1

    result = "".join(reversed(parts))
    return result[1:] if result.startswith("一十") else result


def _format_storyboard_episode_label(episode_number: int | None) -> str | None:
    if episode_number is None or episode_number <= 0:
        return None
    return f"第{_number_to_chinese(episode_number)}集"


async def _build_storyboard_asset_metadata(
    db: AsyncSession,
    storyboard: Storyboard,
    *,
    extra: dict | None = None,
) -> dict:
    metadata: dict = {
        "storyboard_id": str(storyboard.id),
        "shot_number": storyboard.shot_number,
    }
    gen_params = storyboard.gen_params if isinstance(storyboard.gen_params, dict) else {}
    episode_number = gen_params.get("episode_number")
    episode_title = gen_params.get("episode_title")

    if storyboard.episode_id:
        metadata["episode_id"] = str(storyboard.episode_id)
        if episode_number is None or not episode_title:
            episode = (
                await db.execute(select(Episode).where(Episode.id == storyboard.episode_id))
            ).scalar_one_or_none()
            if episode is not None:
                if episode_number is None:
                    episode_number = episode.episode_number
                if not episode_title:
                    episode_title = episode.title

    if isinstance(episode_number, int) and episode_number > 0:
        metadata["episode_number"] = episode_number
    if isinstance(episode_title, str) and episode_title.strip():
        metadata["episode_title"] = episode_title.strip()

    episode_label = _format_storyboard_episode_label(
        metadata.get("episode_number") if isinstance(metadata.get("episode_number"), int) else None
    )
    if episode_label:
        metadata["episode_label"] = episode_label

    if extra:
        metadata.update(extra)
    return metadata


def _compact_storyboard_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_storyboard_multiline_text(value: str | None) -> str:
    return "\n".join(
        line.strip()
        for line in str(value or "").splitlines()
        if line and line.strip()
    )


def _append_storyboard_narration_to_prompt(
    prompt: str | None,
    narration_text: str | None,
) -> str | None:
    normalized_prompt = str(prompt or "").strip()
    normalized_narration_text = _normalize_storyboard_multiline_text(narration_text)
    if not normalized_narration_text:
        return normalized_prompt or None
    if not normalized_prompt:
        return f"台词与旁白：\n{normalized_narration_text}"
    if normalized_narration_text in normalized_prompt:
        return normalized_prompt
    return f"{normalized_prompt}\n\n台词与旁白：\n{normalized_narration_text}"


def _is_storyboard_seedance_voice_video_model(model: str | None) -> bool:
    return (
        str(model or "").strip().lower()
        in STORYBOARD_SEEDANCE_VOICE_VIDEO_MODEL_IDS
    )


def _format_duration_label(value: float | None) -> str:
    if value is None:
        return ""
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return ""
    if numeric <= 0:
        return ""
    if numeric.is_integer():
        return f"{int(numeric)}s"
    return f"{numeric:.1f}s"


def _normalize_storyboard_video_resolution(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().upper()
    return normalized or None


def _resolve_storyboard_video_resolution(
    *,
    model: str,
    requested_resolution: str | None,
    stored_gen_params: dict | None,
) -> str | None:
    if requested_resolution:
        return requested_resolution

    stored_resolution = None
    if isinstance(stored_gen_params, dict):
        stored_resolution = (
            stored_gen_params.get("video_resolution")
            or stored_gen_params.get("resolution")
        )

    normalized_stored_resolution = _normalize_storyboard_video_resolution(
        stored_resolution
    )
    if not normalized_stored_resolution:
        return None

    supported_resolutions = (
        get_model_capabilities(model, "video").get("supported_resolutions") or []
    )
    if (
        supported_resolutions
        and normalized_stored_resolution not in supported_resolutions
    ):
        return supported_resolutions[0]
    return normalized_stored_resolution


def _extract_storyboard_subject_names(
    storyboard: Storyboard,
    subjects: list[Subject],
) -> tuple[list[str], str | None, list[str]]:
    subject_map = {str(subject.id): subject for subject in subjects}

    character_names: list[str] = []
    for subject_id in storyboard.character_ids or []:
        subject = subject_map.get(str(subject_id))
        if subject and subject.type == "character" and subject.name:
            character_names.append(subject.name)

    scene_name: str | None = None
    if storyboard.scene_id:
        scene_subject = subject_map.get(str(storyboard.scene_id))
        if scene_subject and scene_subject.type == "scene":
            scene_name = scene_subject.name

    prop_names: list[str] = []
    for subject_id in storyboard.prop_ids or []:
        subject = subject_map.get(str(subject_id))
        if subject and subject.type == "prop" and subject.name:
            prop_names.append(subject.name)

    return character_names, scene_name, prop_names


def _build_storyboard_composed_prompt(
    storyboard: Storyboard,
    *,
    subjects: list[Subject],
    visual_style: str,
) -> tuple[str | None, str | None]:
    character_names, scene_name, prop_names = _extract_storyboard_subject_names(storyboard, subjects)
    description = _compact_storyboard_text(storyboard.content)
    framing = _compact_storyboard_text(storyboard.shot_type)
    camera_motion = _compact_storyboard_text(storyboard.camera)
    angle = _compact_storyboard_text(storyboard.camera_angle)
    composition = _compact_storyboard_text(storyboard.composition)
    duration = _format_duration_label(storyboard.duration)
    lighting = _compact_storyboard_text(storyboard.lighting)
    ambient_sound = _compact_storyboard_text(storyboard.ambient_sound)
    voiceover = _compact_storyboard_text(storyboard.voiceover)
    image_prompt = _compact_storyboard_text(storyboard.image_prompt)
    visual_style_text = _compact_storyboard_text(visual_style)

    prompt_sections: list[str] = []
    if description:
        prompt_sections.append(f"镜头内容：{description}")

    subject_bits: list[str] = []
    if character_names:
        subject_bits.append(f"角色：{'、'.join(character_names)}")
    if scene_name:
        subject_bits.append(f"场景：{scene_name}")
    if prop_names:
        subject_bits.append(f"道具：{'、'.join(prop_names)}")
    if subject_bits:
        prompt_sections.append("主体与场景：" + "；".join(subject_bits))

    lens_bits: list[str] = []
    if framing:
        lens_bits.append(f"景别：{framing}")
    if camera_motion:
        lens_bits.append(f"运镜：{camera_motion}")
    if angle:
        lens_bits.append(f"角度：{angle}")
    if composition:
        lens_bits.append(f"构图：{composition}")
    if duration:
        lens_bits.append(f"时长：{duration}")
    if lens_bits:
        prompt_sections.append("镜头语言：" + "；".join(lens_bits))

    atmosphere_bits: list[str] = []
    if lighting:
        atmosphere_bits.append(f"光影：{lighting}")
    if atmosphere_bits:
        prompt_sections.append("光影氛围：" + "；".join(atmosphere_bits))

    sound_bits: list[str] = []
    if ambient_sound:
        sound_bits.append(f"环境音：{ambient_sound}")
    if voiceover:
        sound_bits.append(f"旁白/配音：{voiceover}")
    if sound_bits:
        prompt_sections.append("声音信息：" + "；".join(sound_bits))

    style_bits: list[str] = []
    if visual_style_text:
        style_bits.append(f"项目视觉风格：{visual_style_text}")
    if image_prompt:
        style_bits.append(f"视觉生成参考：{image_prompt}")
    if style_bits:
        prompt_sections.append("风格与一致性：" + "；".join(style_bits))

    if not prompt_sections:
        return None, None

    source_payload = {
        "description": description,
        "characters": character_names,
        "scene": scene_name,
        "props": prop_names,
        "framing": framing,
        "camera_motion": camera_motion,
        "angle": angle,
        "composition": composition,
        "duration": duration,
        "lighting": lighting,
        "ambient_sound": ambient_sound,
        "voiceover": voiceover,
        "image_prompt": image_prompt,
        "visual_style": visual_style_text,
    }
    source_version = hashlib.sha1(
        json.dumps(source_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]
    return "\n".join(prompt_sections), source_version


def _merge_storyboard_prompt_layers(
    *,
    existing_gen_params: dict | None,
    composed_prompt_auto: str | None,
    composed_prompt_source_version: str | None,
    incoming_gen_params: dict | None = None,
) -> dict:
    next_gen_params = dict(existing_gen_params or {})
    if isinstance(incoming_gen_params, dict):
        next_gen_params.update(incoming_gen_params)

    next_gen_params["composed_prompt_auto"] = composed_prompt_auto
    next_gen_params["composed_prompt_source_version"] = composed_prompt_source_version

    manual_prompt = _compact_storyboard_text(next_gen_params.get("composed_prompt_manual"))
    manual_prompt_updated = isinstance(incoming_gen_params, dict) and "composed_prompt_manual" in incoming_gen_params
    dirty_updated = isinstance(incoming_gen_params, dict) and "composed_prompt_dirty" in incoming_gen_params

    if not manual_prompt:
        next_gen_params["composed_prompt_manual"] = None
        next_gen_params["composed_prompt_dirty"] = False
        next_gen_params["composed_prompt_manual_base_version"] = None
        return next_gen_params

    next_gen_params["composed_prompt_manual"] = manual_prompt
    if dirty_updated:
        next_gen_params["composed_prompt_dirty"] = bool(incoming_gen_params.get("composed_prompt_dirty"))
    elif manual_prompt_updated:
        next_gen_params["composed_prompt_dirty"] = manual_prompt != (composed_prompt_auto or "")
    else:
        next_gen_params["composed_prompt_dirty"] = bool(next_gen_params.get("composed_prompt_dirty"))

    if manual_prompt_updated:
        next_gen_params["composed_prompt_manual_base_version"] = composed_prompt_source_version
    elif not next_gen_params["composed_prompt_dirty"]:
        next_gen_params["composed_prompt_manual_base_version"] = composed_prompt_source_version
    elif not next_gen_params.get("composed_prompt_manual_base_version"):
        next_gen_params["composed_prompt_manual_base_version"] = composed_prompt_source_version
    return next_gen_params


def _resolve_storyboard_generation_prompt(storyboard: Storyboard, request_prompt: str | None) -> str | None:
    if request_prompt and request_prompt.strip():
        return request_prompt.strip()

    gen_params = _get_storyboard_gen_params(storyboard)
    manual_prompt = _compact_storyboard_text(gen_params.get("composed_prompt_manual"))
    if manual_prompt and bool(gen_params.get("composed_prompt_dirty")):
        return manual_prompt

    auto_prompt = _compact_storyboard_text(gen_params.get("composed_prompt_auto"))
    if auto_prompt:
        return auto_prompt

    image_prompt = _compact_storyboard_text(storyboard.image_prompt)
    if image_prompt:
        return image_prompt

    content = _compact_storyboard_text(storyboard.content)
    return content or None


def _normalize_string_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            normalized.append(text)
    return normalized


def _resolve_reference_images(payload: dict | None) -> list[str]:
    data = payload or {}
    return _normalize_string_list(
        data.get("reference_images") or data.get("referenceImages")
    )


def _resolve_image_generation_mode(reference_images: list[str] | None) -> str:
    return "image_to_image" if reference_images else "text_to_image"


async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


async def _list_storyboards_in_scope(
    db: AsyncSession,
    project_uuid: UUID,
    episode_uuid: UUID | None,
) -> list[Storyboard]:
    query = select(Storyboard).where(Storyboard.project_id == project_uuid)
    if episode_uuid is None:
        query = query.where(Storyboard.episode_id.is_(None))
    else:
        query = query.where(Storyboard.episode_id == episode_uuid)
    query = query.order_by(Storyboard.sort_order, Storyboard.shot_number, Storyboard.created_at, Storyboard.id)
    result = await db.execute(query)
    return result.scalars().all()


def _normalize_subject_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.strip().lower()
    normalized = re.sub(r"^(角色|人物|场景|地点|道具|物件|props?|characters?|scene)[:：\s-]+", "", normalized)
    normalized = normalized.strip("[]【】()（）\"'“”‘’")
    normalized = re.sub(r"\s+", "", normalized)
    normalized = re.sub(r"[^0-9a-z_\u4e00-\u9fff]+", "", normalized)
    return normalized


def _build_subject_id_maps(subjects: list[Subject], subject_type: str) -> tuple[dict[str, str], dict[str, str]]:
    exact_map: dict[str, str] = {}
    normalized_map: dict[str, str] = {}
    for subject in subjects:
        if subject.type != subject_type:
            continue
        exact_name = (subject.name or "").strip()
        if not exact_name:
            continue
        subject_id = str(subject.id)
        exact_map[exact_name] = subject_id
        normalized_name = _normalize_subject_name(exact_name)
        if normalized_name and normalized_name not in normalized_map:
            normalized_map[normalized_name] = subject_id
    return exact_map, normalized_map


def _resolve_subject_id(
    value: str | None,
    *,
    exact_map: dict[str, str],
    normalized_map: dict[str, str],
) -> str | None:
    if not value:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    if stripped in exact_map:
        return exact_map[stripped]

    normalized = _normalize_subject_name(stripped)
    if not normalized:
        return None

    direct_match = normalized_map.get(normalized)
    if direct_match:
        return direct_match

    if len(normalized) >= 2:
        for candidate_name, subject_id in normalized_map.items():
            if normalized in candidate_name or candidate_name in normalized:
                return subject_id

    return None


def _resolve_subject_ids(
    values: list[str] | None,
    *,
    exact_map: dict[str, str],
    normalized_map: dict[str, str],
) -> list[str]:
    resolved_ids: list[str] = []
    for value in values or []:
        subject_id = _resolve_subject_id(
            value,
            exact_map=exact_map,
            normalized_map=normalized_map,
        )
        if subject_id and subject_id not in resolved_ids:
            resolved_ids.append(subject_id)
    return resolved_ids


def _sanitize_zip_segment(value: str | None) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "_", (value or "").strip())
    return cleaned or "project"


def _build_archive_filename(shot_number: int, url: str, fallback_ext: str) -> str:
    parsed = urlparse(url)
    ext = Path(unquote(parsed.path or url)).suffix.lower() or fallback_ext
    return f"shot_{shot_number}{ext}"


def _get_url_extension(url: str, fallback_ext: str) -> str:
    parsed = urlparse(url)
    return Path(unquote(parsed.path or url)).suffix.lower() or fallback_ext


def _build_storyboard_bundle_folder_name(shot_number: int) -> str:
    return f"镜头_{int(shot_number):02d}"


def _build_storyboard_bundle_filename(
    *,
    shot_number: int,
    asset_role: str,
    url: str,
    fallback_ext: str,
) -> str:
    ext = _get_url_extension(url, fallback_ext)
    role_label = "分镜图" if asset_role == "storyboard_image" else "分镜视频"
    return f"镜头_{int(shot_number):02d}_{role_label}{ext}"


def _build_storyboard_asset_lookup_key(
    storyboard_id: UUID | str | None,
    file_url: str | None,
) -> tuple[str, str] | None:
    if not storyboard_id or not file_url:
        return None
    return (str(storyboard_id), str(file_url))


def _build_storyboard_asset_lookup(assets: Sequence[Asset]) -> dict[tuple[str, str], Asset]:
    lookup: dict[tuple[str, str], Asset] = {}
    for asset in assets:
        metadata = _get_asset_metadata(asset)
        key = _build_storyboard_asset_lookup_key(metadata.get("storyboard_id"), asset.file_url)
        if key and key not in lookup:
            lookup[key] = asset
    return lookup


async def _load_storyboard_asset_lookup(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
) -> dict[tuple[str, str], Asset]:
    asset_result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.user_id == user_id,
                Asset.project_id == project_id,
                Asset.category == "storyboard",
            )
        ).order_by(Asset.created_at.desc(), Asset.id.desc())
    )
    return _build_storyboard_asset_lookup(asset_result.scalars().all())


def _resolve_storyboard_image_download_context(
    shot: Storyboard,
    *,
    asset_lookup: dict[tuple[str, str], Asset],
) -> dict[str, Asset | str | None]:
    source_url = shot.image_url
    matched_asset = asset_lookup.get(_build_storyboard_asset_lookup_key(shot.id, source_url))
    asset_metadata = _get_asset_metadata(matched_asset)
    gen_params = _get_storyboard_gen_params(shot)
    image_media = build_image_media_fields(
        file_url=source_url,
        thumbnail_url=matched_asset.thumbnail_url if matched_asset else None,
        metadata={
            **asset_metadata,
            "preview_url": (
                asset_metadata.get("preview_url")
                or gen_params.get("preview_url")
                or gen_params.get("image_preview_url")
            ),
        },
        user_id=str(matched_asset.user_id) if matched_asset else None,
        project_id=str(matched_asset.project_id) if matched_asset and matched_asset.project_id else str(shot.project_id),
        resource_id=str(matched_asset.id) if matched_asset else None,
    )
    download_url = str(image_media["download_url"] or source_url or "").strip() or None
    return {
        "source_url": source_url,
        "download_url": download_url,
        "matched_asset": matched_asset,
    }


def _resolve_storyboard_video_download_context(
    shot: Storyboard,
    *,
    asset_lookup: dict[tuple[str, str], Asset],
) -> dict[str, Asset | str | None]:
    source_url = shot.video_url
    matched_asset = asset_lookup.get(_build_storyboard_asset_lookup_key(shot.id, source_url))
    asset_metadata = _get_asset_metadata(matched_asset)
    gen_params = _get_storyboard_gen_params(shot)
    video_media = build_video_media_fields(
        file_url=source_url,
        thumbnail_url=matched_asset.thumbnail_url if matched_asset else gen_params.get("video_thumbnail_url"),
        metadata={
            **asset_metadata,
            "poster_url": asset_metadata.get("poster_url") or gen_params.get("poster_url"),
            "preview_video_url": (
                asset_metadata.get("preview_video_url")
                or gen_params.get("preview_video_url")
                or gen_params.get("preview_url")
            ),
            "download_url": asset_metadata.get("download_url") or gen_params.get("download_url"),
        },
        user_id=str(matched_asset.user_id) if matched_asset else None,
        project_id=str(matched_asset.project_id) if matched_asset and matched_asset.project_id else str(shot.project_id),
        resource_id=str(matched_asset.id) if matched_asset else None,
    )
    download_url = str(video_media["download_url"] or source_url or "").strip() or None
    return {
        "source_url": source_url,
        "download_url": download_url,
        "matched_asset": matched_asset,
    }


async def _read_media_bytes(url: str, timeout: float) -> bytes:
    return await read_media_bytes(
        url,
        label="分镜资源地址",
        timeout=timeout,
        follow_redirects=True,
    )


async def _build_storyboard_zip_response(
    *,
    shots: list[Storyboard],
    project_name: str,
    download_context_getter,
    expected_user_id: str,
    fallback_ext: str,
    timeout: float,
    empty_detail: str,
    download_name: str,
) -> StreamingResponse:
    zip_buffer = io.BytesIO()
    added_count = 0

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for shot in sorted(shots, key=lambda item: (item.sort_order, item.shot_number)):
            download_context = download_context_getter(shot)
            source_url = str(download_context.get("source_url") or "").strip()
            download_url = str(download_context.get("download_url") or "").strip()
            if not source_url:
                continue

            filename = _build_archive_filename(shot.shot_number, source_url, fallback_ext)
            try:
                resolved_target = resolve_verified_download_target_from_url(
                    download_url or source_url,
                    expected_user_id=expected_user_id,
                )
                content = await _read_media_bytes(resolved_target, timeout)
            except MediaDownloadAccessError as exc:
                raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
            except Exception:
                continue

            zip_file.writestr(f"{_sanitize_zip_segment(project_name)}/{filename}", content)
            added_count += 1

    if added_count == 0:
        raise HTTPException(status_code=502, detail=empty_detail)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


async def _build_storyboard_bundle_zip_response(
    *,
    shots: list[Storyboard],
    project: Project,
    user_id: UUID,
    db: AsyncSession,
) -> StreamingResponse:
    asset_lookup = await _load_storyboard_asset_lookup(
        db,
        user_id=user_id,
        project_id=project.id,
    )
    project_folder = _sanitize_zip_segment(project.name)
    manifest_items: list[dict] = []
    zip_buffer = io.BytesIO()
    added_count = 0

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for shot in sorted(shots, key=lambda item: (item.sort_order, item.shot_number, item.created_at)):
            storyboard_folder = _build_storyboard_bundle_folder_name(shot.shot_number)
            item_manifest = {
                "storyboard_id": str(shot.id),
                "shot_number": shot.shot_number,
                "archive_folder": storyboard_folder,
                "assets": [],
            }
            asset_specs = [
                {
                    "asset_role": "storyboard_image",
                    "asset_type": "image",
                    "subdir": "images",
                    "url": shot.image_url,
                    "fallback_ext": ".png",
                },
                {
                    "asset_role": "storyboard_video",
                    "asset_type": "video",
                    "subdir": "videos",
                    "url": shot.video_url,
                    "fallback_ext": ".mp4",
                },
            ]

            for spec in asset_specs:
                if spec["asset_type"] == "video":
                    download_context = _resolve_storyboard_video_download_context(
                        shot,
                        asset_lookup=asset_lookup,
                    )
                else:
                    download_context = _resolve_storyboard_image_download_context(
                        shot,
                        asset_lookup=asset_lookup,
                    )
                source_url = str(download_context.get("source_url") or "").strip()
                download_url = str(download_context.get("download_url") or "").strip()
                if not source_url:
                    continue

                try:
                    resolved_target = resolve_verified_download_target_from_url(
                        download_url or source_url,
                        expected_user_id=str(user_id),
                    )
                    content = await _read_media_bytes(
                        resolved_target,
                        120.0 if spec["asset_type"] == "video" else 30.0,
                    )
                except MediaDownloadAccessError as exc:
                    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
                except Exception:
                    continue

                matched_asset = download_context.get("matched_asset")
                archive_filename = _build_storyboard_bundle_filename(
                    shot_number=shot.shot_number,
                    asset_role=spec["asset_role"],
                    url=source_url,
                    fallback_ext=spec["fallback_ext"],
                )
                archive_path = f"{project_folder}/{storyboard_folder}/{spec['subdir']}/{archive_filename}"
                zip_file.writestr(archive_path, content)
                added_count += 1
                item_manifest["assets"].append(
                    {
                        "asset_role": spec["asset_role"],
                        "asset_type": spec["asset_type"],
                        "category": matched_asset.category if matched_asset else "storyboard",
                        "display_name": matched_asset.name if matched_asset else Path(archive_filename).stem,
                        "archive_path": archive_path,
                        "source_url": source_url,
                        "asset_id": str(matched_asset.id) if matched_asset else None,
                    }
                )

            if item_manifest["assets"]:
                manifest_items.append(item_manifest)

        if added_count == 0:
            raise HTTPException(status_code=404, detail="所选分镜没有可下载的资源")

        manifest = {
            "project_id": str(project.id),
            "project_name": project.name,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "selected_storyboard_count": len(shots),
            "storyboard_count": len(manifest_items),
            "items": manifest_items,
        }
        zip_file.writestr(
            f"{project_folder}/manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2),
        )

    zip_buffer.seek(0)
    download_name = f"{project_folder}_分镜资源包.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(download_name)}"},
    )


class StoryboardResponse(BaseModel):
    id: str
    project_id: str
    episode_id: str | None
    shot_number: int
    content: str | None
    shot_type: str | None
    camera: str | None
    camera_angle: str | None
    composition: str | None
    duration: float | None
    lighting: str | None
    ambient_sound: str | None
    voiceover: str | None
    image_prompt: str | None
    image_url: str | None
    thumbnail_url: str | None = None
    preview_url: str | None = None
    large_url: str | None = None
    download_url: str | None = None
    preview_ready: bool | None = None
    video_url: str | None
    video_asset_id: str | None = None
    video_thumbnail_url: str | None = None
    poster_url: str | None = None
    preview_video_url: str | None = None
    hls_url: str | None = None
    available_qualities: list[dict[str, Any]] | None = None
    video_duration: float | None = None
    video_model: str | None = None
    video_resolution: str | None = None
    video_ratio: str | None = None
    video_is_primary: bool = False
    character_ids: list[str] | None
    scene_id: str | None
    prop_ids: list[str] | None
    reference_image_urls: list[str] | None
    gen_params: dict | None
    sort_order: int
    created_at: str
    updated_at: str


class StoryboardGenerationTaskResponse(BaseModel):
    id: str
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
    created_at: str
    updated_at: str


def _task_to_response(task: GenTask) -> StoryboardGenerationTaskResponse:
    return StoryboardGenerationTaskResponse(
        id=str(task.id),
        user_id=str(task.user_id),
        project_id=str(task.project_id) if task.project_id else None,
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


def _stringify_task_error(exc: Exception) -> str:
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        if detail is not None:
            return str(detail)
    message = str(exc).strip()
    return message or repr(exc)


def _build_storyboard_task_stage_label(
    stage: str,
    *,
    current_episode_number: int | None = None,
) -> str:
    if stage == "queued":
        return "等待执行"
    if stage == "validating_final_script":
        return "校验主剧本"
    if stage == "finalizing_script":
        return "拆分正式分集"
    if stage == "loading_subject_context":
        return "装载主体信息"
    if stage == "finalizing_results":
        return "收口任务结果"
    if stage == "completed":
        return "已完成"
    if stage == "partial":
        return "部分完成"
    if stage == "failed":
        return "执行失败"
    if stage.startswith("generating_episode_"):
        if current_episode_number is not None:
            return f"生成第 {current_episode_number} 集分镜"
        return "逐集生成分镜"
    return "处理中"


def _build_storyboard_task_status_message(
    *,
    stage: str,
    total_count: int = 0,
    success_count: int = 0,
    fail_count: int = 0,
    current_episode_number: int | None = None,
    current_episode_title: str | None = None,
) -> str:
    completed_count = success_count + fail_count
    current_episode_label = ""
    if current_episode_number is not None:
        current_episode_label = f"第 {current_episode_number} 集"
        normalized_title = str(current_episode_title or "").strip()
        if normalized_title:
            current_episode_label = f"{current_episode_label}《{normalized_title}》"

    if stage == "queued":
        return "已创建智能分镜任务，等待开始执行"
    if stage == "validating_final_script":
        return "正在校验定稿主剧本"
    if stage == "finalizing_script":
        return "正在拆分正式分集"
    if stage == "loading_subject_context":
        return "正在装载主体信息"
    if stage.startswith("generating_episode_"):
        if total_count > 0 and current_episode_label:
            return f"正在生成 {current_episode_label}，已完成 {completed_count}/{total_count} 集"
        if total_count > 0:
            return f"正在逐集生成分镜，已完成 {completed_count}/{total_count} 集"
        return "正在逐集生成分镜"
    if stage == "finalizing_results":
        return "正在收口智能分镜结果"
    if stage == "completed":
        if total_count > 0:
            return f"智能分镜已完成，成功生成 {success_count}/{total_count} 集"
        return "智能分镜已完成"
    if stage == "partial":
        return f"智能分镜部分完成，成功 {success_count} 集，失败 {fail_count} 集"
    if stage == "failed":
        if total_count > 0:
            return f"智能分镜失败，失败 {max(fail_count, total_count)} 集"
        if fail_count > 0:
            return f"智能分镜失败，失败 {fail_count} 集"
        return "智能分镜失败"
    return "智能分镜处理中"


def _set_storyboard_task_progress(
    task: GenTask,
    *,
    stage: str,
    script_status: str | None = None,
    overwrite_existing: bool | None = None,
    current_episode: Episode | None = None,
    target_episode_ids: list[str] | None = None,
    queued_episode_numbers: list[int] | None = None,
    completed_episode_numbers: list[int] | None = None,
    failed_episode_numbers: list[int] | None = None,
    last_completed_episode: Episode | None = None,
    total_storyboard_count: int | None = None,
    warning_messages: list[str] | None = None,
) -> None:
    params = dict(task.params or {})
    current_episode_number = current_episode.episode_number if current_episode else None
    current_episode_title = current_episode.title if current_episode else None

    params["current_stage"] = stage
    params["stage_label"] = _build_storyboard_task_stage_label(
        stage,
        current_episode_number=current_episode_number,
    )
    params["status_message"] = _build_storyboard_task_status_message(
        stage=stage,
        total_count=task.total_count or 0,
        success_count=task.success_count or 0,
        fail_count=task.fail_count or 0,
        current_episode_number=current_episode_number,
        current_episode_title=current_episode_title,
    )

    if script_status is not None:
        params["script_status"] = script_status
    if overwrite_existing is not None:
        params["overwrite_existing"] = bool(overwrite_existing)
    if target_episode_ids is not None:
        params["target_episode_ids"] = target_episode_ids
    if queued_episode_numbers is not None:
        params["queued_episode_numbers"] = queued_episode_numbers
    if completed_episode_numbers is not None:
        params["completed_episode_numbers"] = completed_episode_numbers
    if failed_episode_numbers is not None:
        params["failed_episode_numbers"] = failed_episode_numbers
    if total_storyboard_count is not None:
        params["total_storyboard_count"] = total_storyboard_count
    if warning_messages is not None:
        params["warning_messages"] = warning_messages

    if current_episode is not None:
        params["current_episode_id"] = str(current_episode.id)
        params["current_episode_number"] = current_episode.episode_number
        params["current_episode_title"] = current_episode.title
    elif stage in {"completed", "partial", "failed"}:
        params["current_episode_id"] = None
        params["current_episode_number"] = None
        params["current_episode_title"] = ""

    if last_completed_episode is not None:
        params["last_completed_episode_id"] = str(last_completed_episode.id)
        params["last_completed_episode_number"] = last_completed_episode.episode_number
        params["last_completed_episode_title"] = last_completed_episode.title

    task.params = params


def _coerce_float(value) -> float | None:
    try:
        if value is None:
            return None
        parsed = float(value)
        return parsed if parsed >= 0 else None
    except (TypeError, ValueError):
        return None


def _get_asset_metadata(asset: Asset | None) -> dict:
    if not asset or not isinstance(asset.metadata_json, dict):
        return {}
    return asset.metadata_json


def _get_storyboard_gen_params(storyboard: Storyboard) -> dict:
    return storyboard.gen_params if isinstance(storyboard.gen_params, dict) else {}


def _get_asset_storyboard_id(asset: Asset) -> str | None:
    metadata = _get_asset_metadata(asset)
    storyboard_id = metadata.get("storyboard_id")
    return str(storyboard_id) if storyboard_id else None


def _select_storyboard_asset(
    storyboard: Storyboard,
    assets_by_storyboard_id: dict[str, list[Asset]],
    assets_by_file_url: dict[str, list[Asset]],
    *,
    file_url: str | None,
) -> Asset | None:
    storyboard_id = str(storyboard.id)
    candidates = assets_by_storyboard_id.get(storyboard_id, [])
    if file_url:
        matched = next((asset for asset in candidates if asset.file_url == file_url), None)
        if matched:
            return matched
    if candidates:
        return candidates[0]
    if file_url:
        file_candidates = assets_by_file_url.get(file_url, [])
        if file_candidates:
            return file_candidates[0]
    return None


def _select_storyboard_video_asset(
    storyboard: Storyboard,
    assets_by_storyboard_id: dict[str, list[Asset]],
    assets_by_file_url: dict[str, list[Asset]],
) -> Asset | None:
    return _select_storyboard_asset(
        storyboard,
        assets_by_storyboard_id,
        assets_by_file_url,
        file_url=storyboard.video_url,
    )


def _select_storyboard_image_asset(
    storyboard: Storyboard,
    assets_by_storyboard_id: dict[str, list[Asset]],
    assets_by_file_url: dict[str, list[Asset]],
) -> Asset | None:
    return _select_storyboard_asset(
        storyboard,
        assets_by_storyboard_id,
        assets_by_file_url,
        file_url=storyboard.image_url,
    )


async def _get_storyboard_assets(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    asset_type: str,
    storyboards: Sequence[Storyboard] | None = None,
) -> tuple[dict[str, list[Asset]], dict[str, list[Asset]]]:
    storyboard_ids = [
        str(storyboard.id)
        for storyboard in (storyboards or [])
    ]
    video_urls = [
        storyboard.video_url
        for storyboard in (storyboards or [])
        if storyboard.video_url
    ]
    if storyboards is not None and not storyboard_ids and not video_urls:
        return {}, {}

    query = apply_asset_visibility(
        select(Asset).where(
            Asset.user_id == user_id,
            Asset.project_id == project_id,
            Asset.category == "storyboard",
            Asset.asset_type == asset_type,
        )
    )
    if storyboards is not None:
        scoped_filters = []
        if storyboard_ids:
            scoped_filters.append(
                Asset.metadata_json["storyboard_id"].as_string().in_(storyboard_ids)
            )
        if video_urls:
            scoped_filters.append(Asset.file_url.in_(video_urls))
        if not scoped_filters:
            return {}, {}
        query = query.where(or_(*scoped_filters))

    result = await db.execute(query.order_by(Asset.created_at.desc(), Asset.id.desc()))
    assets = result.scalars().all()
    assets_by_storyboard_id: dict[str, list[Asset]] = {}
    assets_by_file_url: dict[str, list[Asset]] = {}
    for asset in assets:
        asset_storyboard_id = _get_asset_storyboard_id(asset)
        if asset_storyboard_id:
            assets_by_storyboard_id.setdefault(asset_storyboard_id, []).append(asset)
        if asset.file_url:
            assets_by_file_url.setdefault(asset.file_url, []).append(asset)
    return assets_by_storyboard_id, assets_by_file_url


async def _get_storyboard_video_assets(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    storyboards: Sequence[Storyboard] | None = None,
) -> tuple[dict[str, list[Asset]], dict[str, list[Asset]]]:
    return await _get_storyboard_assets(
        db,
        project_id=project_id,
        user_id=user_id,
        asset_type="video",
        storyboards=storyboards,
    )


async def _get_storyboard_image_assets(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    storyboards: Sequence[Storyboard] | None = None,
) -> tuple[dict[str, list[Asset]], dict[str, list[Asset]]]:
    return await _get_storyboard_assets(
        db,
        project_id=project_id,
        user_id=user_id,
        asset_type="image",
        storyboards=storyboards,
    )


def _to_response(
    s: Storyboard,
    *,
    image_asset: Asset | None = None,
    video_asset: Asset | None = None,
    include_gen_params: bool = True,
) -> StoryboardResponse:
    image_metadata = _get_asset_metadata(image_asset)
    asset_metadata = _get_asset_metadata(video_asset)
    gen_params = _get_storyboard_gen_params(s)
    image_media = build_image_media_fields(
        file_url=s.image_url,
        thumbnail_url=image_asset.thumbnail_url if image_asset else None,
        metadata={
            **image_metadata,
            "preview_url": (
                image_metadata.get("preview_url")
                or gen_params.get("preview_url")
                or gen_params.get("image_preview_url")
            ),
        },
        user_id=str(image_asset.user_id) if image_asset else None,
        project_id=str(image_asset.project_id) if image_asset and image_asset.project_id else str(s.project_id),
        resource_id=str(image_asset.id) if image_asset else None,
    )
    video_media = build_video_media_fields(
        file_url=s.video_url,
        thumbnail_url=video_asset.thumbnail_url if video_asset else gen_params.get("video_thumbnail_url"),
        metadata={
            **asset_metadata,
            "poster_url": (
                asset_metadata.get("poster_url")
                or gen_params.get("poster_url")
            ),
            "preview_video_url": (
                asset_metadata.get("preview_video_url")
                or gen_params.get("preview_video_url")
                or gen_params.get("preview_url")
            ),
            "download_url": (
                asset_metadata.get("download_url")
                or gen_params.get("download_url")
            ),
        },
        user_id=str(video_asset.user_id) if video_asset else None,
        project_id=str(video_asset.project_id) if video_asset and video_asset.project_id else str(s.project_id),
        resource_id=str(video_asset.id) if video_asset else None,
    )
    asset_size = video_asset.size if video_asset else None
    video_duration = (
        _coerce_float(asset_metadata.get("duration"))
        or _coerce_float(gen_params.get("video_duration"))
        or _coerce_float(s.duration)
    )
    video_resolution = (
        asset_metadata.get("resolution")
        or gen_params.get("video_resolution")
        or asset_size
    )
    video_ratio = asset_metadata.get("ratio") or gen_params.get("video_ratio") or gen_params.get("ratio")
    return StoryboardResponse(
        id=str(s.id),
        project_id=str(s.project_id),
        episode_id=str(s.episode_id) if s.episode_id else None,
        shot_number=s.shot_number,
        content=s.content,
        shot_type=s.shot_type,
        camera=s.camera,
        camera_angle=s.camera_angle,
        composition=s.composition,
        duration=s.duration,
        lighting=s.lighting,
        ambient_sound=s.ambient_sound,
        voiceover=s.voiceover,
        image_prompt=s.image_prompt,
        image_url=s.image_url,
        thumbnail_url=image_media["thumbnail_url"],
        preview_url=image_media["preview_url"],
        large_url=image_media["large_url"],
        download_url=image_media["download_url"],
        preview_ready=image_media["preview_ready"],
        video_url=s.video_url,
        video_asset_id=str(video_asset.id) if video_asset else None,
        video_thumbnail_url=pick_safe_thumbnail_url(video_media["poster_url"], image_media["thumbnail_url"], s.image_url),
        poster_url=video_media["poster_url"],
        preview_video_url=video_media["preview_video_url"],
        hls_url=video_media["hls_url"],
        available_qualities=video_media["available_qualities"],
        video_duration=video_duration,
        video_model=(video_asset.model if video_asset else None) or gen_params.get("video_model"),
        video_resolution=video_resolution,
        video_ratio=video_ratio,
        video_is_primary=video_asset.is_primary if video_asset else False,
        character_ids=s.character_ids,
        scene_id=str(s.scene_id) if s.scene_id else None,
        prop_ids=s.prop_ids,
        reference_image_urls=s.reference_image_urls,
        gen_params=s.gen_params if include_gen_params else None,
        sort_order=s.sort_order,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


async def _run_storyboard_image_generation_job(
    *,
    user_id: UUID,
    project_id: UUID,
    storyboard_id: UUID,
    api_key: str,
    base_url: str,
    enhanced_prompt: str,
    model: str,
    size: str,
    aspect_ratio: str | None,
    resolution: str | None,
    reference_images: list[str],
    request_reference_images: list[str],
    generation_mode: str,
    count: int,
) -> None:
    async with async_session() as db:
        result = await db.execute(
            select(Storyboard).where(Storyboard.id == storyboard_id, Storyboard.project_id == project_id)
        )
        sb = result.scalar_one_or_none()
        if not sb:
            return

        try:
            urls = await image_gen_service.generate(
                prompt=enhanced_prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                size=size,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                reference_images=reference_images,
                n=count,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"图片生成失败: {str(exc)}") from exc

        if not urls:
            raise HTTPException(status_code=502, detail="图片生成未返回结果")

        persisted_urls = await persist_many_if_external(
            urls,
            f"storyboards/{project_id}",
            fallback_extension=".png",
        )
        if not persisted_urls:
            raise HTTPException(status_code=502, detail="图片生成未返回可保存结果")

        sb.image_url = persisted_urls[0]
        if request_reference_images:
            sb.reference_image_urls = reference_images or None

        stored_gen_params = _get_storyboard_gen_params(sb)
        storyboard_asset_metadata = await _build_storyboard_asset_metadata(db, sb)
        generated_images: list[dict] = []
        for index, persisted_url in enumerate(persisted_urls, start=1):
            derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
                persisted_url,
                asset_type="image",
            )
            derived_preview_url, preview_metadata = _derive_asset_preview(
                persisted_url,
                output_subdir=f"storyboards/{project_id}/derived/preview",
            )
            asset = Asset(
                user_id=user_id,
                project_id=project_id,
                name=f"分镜 #{sb.shot_number}" if len(persisted_urls) == 1 else f"分镜 #{sb.shot_number} {index}",
                asset_type="image",
                category="storyboard",
                file_url=persisted_url,
                thumbnail_url=derived_thumbnail_url,
                prompt=enhanced_prompt,
                model=model,
                size=size,
                reference_image_urls=reference_images or None,
                metadata_json={
                    **storyboard_asset_metadata,
                    "source": "storyboard_generate_image",
                    "generation_mode": generation_mode,
                    "reference_image_count": len(reference_images),
                    "index": index,
                    "count": len(persisted_urls),
                    "ratio": aspect_ratio,
                    "resolution": resolution,
                    "preview_url": derived_preview_url or persisted_url,
                    **derivative_metadata,
                    **preview_metadata,
                },
            )
            db.add(asset)
            await db.flush()
            generated_images.append(
                {
                    "index": index,
                    "url": persisted_url,
                    "asset_id": str(asset.id),
                    "thumbnail_url": derived_thumbnail_url,
                    "preview_url": derived_preview_url or persisted_url,
                    "download_url": persisted_url,
                    "preview_ready": bool(derived_preview_url or persisted_url),
                }
            )
        sb.gen_params = {
            **stored_gen_params,
            "generated_images": generated_images,
            "last_image_asset_id": generated_images[0]["asset_id"],
            "thumbnail_url": generated_images[0]["thumbnail_url"],
            "preview_url": generated_images[0]["preview_url"],
            "download_url": generated_images[0]["download_url"],
            "last_image_count": len(generated_images),
            "last_image_model": model,
            "last_image_ratio": aspect_ratio,
            "last_image_resolution": resolution,
            "last_image_generation_mode": generation_mode,
            "last_image_reference_count": len(reference_images),
        }
        await db.commit()


async def _run_storyboard_image_task(
    *,
    task_id: UUID,
    user_id: UUID,
    project_id: UUID,
    storyboard_id: UUID,
    api_key: str,
    base_url: str,
    enhanced_prompt: str,
    model: str,
    size: str,
    aspect_ratio: str | None,
    resolution: str | None,
    reference_images: list[str],
    request_reference_images: list[str],
    generation_mode: str,
    count: int,
) -> None:
    async with async_session() as db:
        result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return
        task.status = "running"
        await db.commit()

    try:
        await _run_storyboard_image_generation_job(
            user_id=user_id,
            project_id=project_id,
            storyboard_id=storyboard_id,
            api_key=api_key,
            base_url=base_url,
            enhanced_prompt=enhanced_prompt,
            model=model,
            size=size,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            reference_images=reference_images,
            request_reference_images=request_reference_images,
            generation_mode=generation_mode,
            count=count,
        )
    except Exception as exc:
        async with async_session() as db:
            result = await db.execute(select(GenTask).where(GenTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return
            task.status = "failed"
            task.fail_count = count
            task.results = [
                {
                    "storyboard_id": str(storyboard_id),
                    "project_id": str(project_id),
                    "model": model,
                    "generation_mode": generation_mode,
                    "reference_image_count": len(reference_images),
                    "error": _stringify_task_error(exc),
                }
            ]
            await db.commit()
        return

    async with async_session() as db:
        task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = task_result.scalar_one_or_none()
        if not task:
            return

        storyboard_result = await db.execute(
            select(Storyboard).where(Storyboard.id == storyboard_id, Storyboard.project_id == project_id)
        )
        storyboard = storyboard_result.scalar_one_or_none()
        gen_params = _get_storyboard_gen_params(storyboard) if storyboard else {}
        generated_images = gen_params.get("generated_images") or []
        task.status = "completed"
        task.success_count = max(len(generated_images), 1)
        task.fail_count = 0
        task.results = [
            {
                "storyboard_id": str(storyboard_id),
                "project_id": str(project_id),
                "image_url": storyboard.image_url if storyboard else None,
                "generated_images": generated_images,
                "last_image_asset_id": gen_params.get("last_image_asset_id"),
                "thumbnail_url": gen_params.get("thumbnail_url"),
                "preview_url": gen_params.get("preview_url"),
                "download_url": gen_params.get("download_url"),
                "preview_ready": bool(gen_params.get("preview_url") or storyboard.image_url if storyboard else None),
            }
        ]
        await db.commit()


async def _run_storyboard_video_generation_job(
    *,
    user_id: UUID,
    project_id: UUID,
    storyboard_id: UUID,
    prompt: str,
    model: str,
    duration: float | int | None,
    reference_mode: str,
    effective_image_url: str | None,
    effective_first_frame: str | None,
    effective_last_frame: str | None,
    resolution: str | None,
    sound_effect: bool | None,
    reference_video_url: str | None,
    reference_audio_url: str | None,
    ratio: str,
    generate_mode: str | None,
    generate_audio: bool | None,
    audio_setting: dict | None,
    watermark: bool | None,
    mentions: Sequence[dict],
    attachments: Sequence[dict],
    first_frame_asset_id: str | None,
    last_frame_asset_id: str | None,
    reference_video_asset_id: str | None,
    reference_audio_asset_id: str | None,
    reference_image_asset_ids: list[str],
    request_reference_images: list[str],
    speech_text: str | None,
    seedance_voice_video_trace: dict | None,
) -> str | None:
    async with async_session() as db:
        result = await db.execute(
            select(Storyboard).where(Storyboard.id == storyboard_id, Storyboard.project_id == project_id)
        )
        sb = result.scalar_one_or_none()
        if not sb:
            return None

        stored_gen_params = sb.gen_params or {}
        try:
            provider_runtime = await get_user_model_provider_runtime(
                user_id,
                db,
                category="video",
                requested_model=model,
            )
            if not provider_runtime:
                raise HTTPException(status_code=400, detail="未配置视频模型对应服务商，请先在设置中配置")
            api_key, base_url, _, _, _, _ = provider_runtime
            result_data = await video_gen_service.generate(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                image_url=effective_image_url,
                model=model,
                duration=duration,
                reference_mode=reference_mode,
                first_frame_url=effective_first_frame,
                last_frame_url=effective_last_frame,
                resolution=resolution,
                sound_effect=sound_effect,
                reference_video_url=reference_video_url,
                reference_audio_url=reference_audio_url,
                ratio=ratio,
                generate_mode=generate_mode,
                generate_audio=generate_audio,
                audio_setting=audio_setting,
                watermark=watermark,
                mentions=list(mentions),
                attachments=list(attachments),
                first_frame_asset_id=first_frame_asset_id,
                last_frame_asset_id=last_frame_asset_id,
                reference_video_asset_id=reference_video_asset_id,
                reference_audio_asset_id=reference_audio_asset_id,
                reference_image_asset_ids=reference_image_asset_ids,
                speech_text=speech_text,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"视频生成失败: {str(exc)}") from exc

        if not result_data.get("url"):
            raise HTTPException(status_code=502, detail="视频生成失败: 未返回视频地址")

        video_url = await persist_if_external(
            result_data.get("url"),
            f"storyboards/{project_id}/videos",
            fallback_extension=get_media_fallback_extension("video"),
            url_label="分镜视频地址",
        )
        if not video_url:
            raise HTTPException(status_code=502, detail="视频生成失败: 视频地址托管失败")

        raw_video_thumbnail_url = pick_safe_thumbnail_url(
            result_data.get("thumbnail_url"),
            sb.image_url,
        )
        video_thumbnail_url = await persist_if_external(
            raw_video_thumbnail_url,
            f"storyboards/{project_id}/video-thumbnails",
            fallback_extension=get_media_fallback_extension("image"),
            url_label="分镜视频缩略图地址",
        )
        poster_bundle = await build_video_poster_bundle(
            video_url=video_url,
            fallback_thumbnail_url=video_thumbnail_url,
        )
        video_thumbnail_url = poster_bundle["poster_url"] or video_thumbnail_url
        derivative_metadata = poster_bundle["metadata_updates"]
        video_media = build_video_media_fields(
            file_url=video_url,
            thumbnail_url=video_thumbnail_url,
            metadata={
                **build_video_playback_metadata(
                    result_data,
                    preview_video_url=video_url,
                    download_url=video_url,
                    poster_url=video_thumbnail_url,
                ),
                **derivative_metadata,
            },
            # 这里仍处于“分镜视频已落盘，但资产记录尚未创建”的阶段，不能引用尚未存在的 video_asset。
            # 先使用当前任务上下文生成媒体字段，待资产创建完成后再由详情/列表接口按正式 asset 口径回显。
            user_id=str(user_id),
            project_id=str(project_id),
        )
        final_seedance_trace = dict(seedance_voice_video_trace or {})
        service_seedance_trace = (
            result_data.get("seedance_trace")
            if isinstance(result_data.get("seedance_trace"), dict)
            else {}
        )
        if service_seedance_trace:
            final_seedance_trace.update(service_seedance_trace)
        if speech_text and "speech_text" not in final_seedance_trace:
            final_seedance_trace["speech_text"] = speech_text
        reference_images_to_persist = list(
            dict.fromkeys(
                request_reference_images
                or [url for url in [effective_image_url, effective_first_frame, effective_last_frame] if url]
            )
        )
        reference_image_urls = await persist_many_if_external(
            reference_images_to_persist,
            f"storyboards/{project_id}/video-reference-images",
            fallback_extension=get_media_fallback_extension("image"),
            url_label="分镜视频参考图地址",
        )

        sb.video_url = video_url
        sb.reference_image_urls = reference_image_urls or None
        video_duration = _coerce_float(result_data.get("duration")) or _coerce_float(duration)
        sb.gen_params = {
            **stored_gen_params,
            "reference_video_url": reference_video_url,
            "reference_audio_url": reference_audio_url,
            "reference_mode": reference_mode,
            "ratio": ratio,
            "generate_mode": generate_mode,
            "generate_audio": generate_audio,
            "audio_setting": audio_setting,
            "watermark": watermark,
            "video_model": model,
            "video_resolution": resolution,
            "video_ratio": ratio,
            "video_duration": video_duration,
            "video_thumbnail_url": video_media["poster_url"],
            "poster_url": video_media["poster_url"],
            "preview_video_url": video_media["preview_video_url"],
            "hls_url": video_media["hls_url"],
            "available_qualities": video_media["available_qualities"],
            "download_url": video_media["download_url"],
            "prompt_raw": prompt,
            "prompt_resolved": result_data.get("prompt_resolved") or prompt,
            "asset_bindings": result_data.get("asset_bindings") or [],
            "seedance_voice_video": final_seedance_trace or None,
        }
        storyboard_asset_metadata = await _build_storyboard_asset_metadata(db, sb)

        asset = Asset(
            user_id=user_id,
            project_id=project_id,
            name=f"分镜视频 #{sb.shot_number}",
            asset_type="video",
            category="storyboard",
            file_url=video_url,
            thumbnail_url=video_thumbnail_url,
            prompt=prompt,
            model=model,
            size=resolution,
            metadata_json={
                **storyboard_asset_metadata,
                "duration": video_duration,
                "resolution": resolution,
                "ratio": ratio,
                "watermark": watermark,
                "audio_setting": audio_setting,
                "thumbnail_url": video_media["poster_url"],
                "poster_url": video_media["poster_url"],
                "preview_video_url": video_media["preview_video_url"],
                "hls_url": video_media["hls_url"],
                "available_qualities": video_media["available_qualities"],
                "download_url": video_media["download_url"],
                "source": "storyboard_video_preview",
                "prompt_raw": prompt,
                "prompt_resolved": result_data.get("prompt_resolved") or prompt,
                "asset_bindings": result_data.get("asset_bindings") or [],
                "seedance_voice_video": final_seedance_trace or None,
                **derivative_metadata,
            },
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        return str(asset.id)


async def _run_storyboard_video_task(
    *,
    task_id: UUID,
    user_id: UUID,
    project_id: UUID,
    storyboard_id: UUID,
    prompt: str,
    model: str,
    duration: float | int | None,
    reference_mode: str,
    effective_image_url: str | None,
    effective_first_frame: str | None,
    effective_last_frame: str | None,
    resolution: str | None,
    sound_effect: bool | None,
    reference_video_url: str | None,
    reference_audio_url: str | None,
    ratio: str,
    generate_mode: str | None,
    generate_audio: bool | None,
    audio_setting: dict | None,
    watermark: bool | None,
    mentions: Sequence[dict],
    attachments: Sequence[dict],
    first_frame_asset_id: str | None,
    last_frame_asset_id: str | None,
    reference_video_asset_id: str | None,
    reference_audio_asset_id: str | None,
    reference_image_asset_ids: list[str],
    request_reference_images: list[str],
    speech_text: str | None,
    seedance_voice_video_trace: dict | None,
) -> None:
    async with async_session() as db:
        result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return
        task.status = "running"
        await db.commit()

    try:
        video_asset_id = await _run_storyboard_video_generation_job(
            user_id=user_id,
            project_id=project_id,
            storyboard_id=storyboard_id,
            prompt=prompt,
            model=model,
            duration=duration,
            reference_mode=reference_mode,
            effective_image_url=effective_image_url,
            effective_first_frame=effective_first_frame,
            effective_last_frame=effective_last_frame,
            resolution=resolution,
            sound_effect=sound_effect,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            ratio=ratio,
            generate_mode=generate_mode,
            generate_audio=generate_audio,
            audio_setting=audio_setting,
            watermark=watermark,
            mentions=mentions,
            attachments=attachments,
            first_frame_asset_id=first_frame_asset_id,
            last_frame_asset_id=last_frame_asset_id,
            reference_video_asset_id=reference_video_asset_id,
            reference_audio_asset_id=reference_audio_asset_id,
            reference_image_asset_ids=reference_image_asset_ids,
            request_reference_images=request_reference_images,
            speech_text=speech_text,
            seedance_voice_video_trace=seedance_voice_video_trace,
        )
    except Exception as exc:
        async with async_session() as db:
            result = await db.execute(select(GenTask).where(GenTask.id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return
            task.status = "failed"
            task.fail_count = 1
            task.results = [
                {
                    "storyboard_id": str(storyboard_id),
                    "project_id": str(project_id),
                    "error": _stringify_task_error(exc),
                    "seedance_voice_video": seedance_voice_video_trace or None,
                }
            ]
            await db.commit()
        return

    async with async_session() as db:
        task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = task_result.scalar_one_or_none()
        if not task:
            return

        storyboard_result = await db.execute(
            select(Storyboard).where(Storyboard.id == storyboard_id, Storyboard.project_id == project_id)
        )
        storyboard = storyboard_result.scalar_one_or_none()
        gen_params = _get_storyboard_gen_params(storyboard) if storyboard else {}
        task.status = "completed"
        task.success_count = 1
        task.fail_count = 0
        task.results = [
            {
                "storyboard_id": str(storyboard_id),
                "project_id": str(project_id),
                "video_url": storyboard.video_url if storyboard else None,
                "video_asset_id": video_asset_id,
                "video_duration": gen_params.get("video_duration"),
                "video_resolution": gen_params.get("video_resolution"),
                "video_ratio": gen_params.get("video_ratio"),
                "video_thumbnail_url": gen_params.get("video_thumbnail_url"),
                "poster_url": gen_params.get("poster_url"),
                "preview_video_url": gen_params.get("preview_video_url"),
                "hls_url": gen_params.get("hls_url"),
                "available_qualities": gen_params.get("available_qualities"),
                "download_url": gen_params.get("download_url"),
                "preview_ready": bool(
                    gen_params.get("hls_url")
                    or gen_params.get("preview_video_url")
                    or (storyboard.video_url if storyboard else None)
                ),
                "seedance_voice_video": gen_params.get("seedance_voice_video"),
            }
        ]
        await db.commit()


async def _load_storyboard_subject_context(
    db: AsyncSession,
    *,
    project_id: str,
) -> tuple[list[Subject], list[dict], list[dict], list[dict], dict[str, str], dict[str, str], dict[str, str]]:
    subject_result = await db.execute(
        select(Subject).where(Subject.project_id == UUID(project_id))
    )
    subjects = subject_result.scalars().all()
    characters = [
        {
            "name": s.name,
            "role": s.role,
            "description": s.description,
            "appearance": s.appearance,
            "personality": s.personality,
        }
        for s in subjects
        if s.type == "character"
    ]
    scenes = [
        {
            "name": s.name,
            "description": s.description,
            "time_setting": s.time_setting,
            "atmosphere": s.atmosphere,
        }
        for s in subjects
        if s.type == "scene"
    ]
    props = [
        {
            "name": s.name,
            "description": s.description,
            "importance": s.importance,
        }
        for s in subjects
        if s.type == "prop"
    ]
    char_map, _ = _build_subject_id_maps(subjects, "character")
    scene_map, _ = _build_subject_id_maps(subjects, "scene")
    prop_map, _ = _build_subject_id_maps(subjects, "prop")
    return subjects, characters, scenes, props, char_map, scene_map, prop_map


def _mark_episode_storyboarded(episode: Episode) -> None:
    if episode.status != "storyboarded":
        episode.status = "storyboarded"


async def _generate_storyboards_for_episode(
    *,
    project_id: str,
    episode: Episode,
    model: str | None,
    subjects: list[Subject],
    user: User,
    db: AsyncSession,
    visual_style: str,
    replace_existing: bool = False,
) -> list[Storyboard]:
    if not episode.content:
        raise HTTPException(status_code=400, detail=f"第 {episode.episode_number} 集剧本为空，请先完善正式分集")

    existing_storyboards = await _list_storyboards_in_scope(
        db,
        UUID(project_id),
        episode.id,
    )
    if existing_storyboards and not replace_existing:
        _mark_episode_storyboarded(episode)
        return existing_storyboards

    characters = [
        {
            "name": s.name,
            "role": s.role,
            "description": s.description,
            "appearance": s.appearance,
            "personality": s.personality,
        }
        for s in subjects
        if s.type == "character"
    ]
    scenes = [
        {
            "name": s.name,
            "description": s.description,
            "time_setting": s.time_setting,
            "atmosphere": s.atmosphere,
        }
        for s in subjects
        if s.type == "scene"
    ]
    props = [
        {
            "name": s.name,
            "description": s.description,
            "importance": s.importance,
        }
        for s in subjects
        if s.type == "prop"
    ]
    char_map, normalized_char_map = _build_subject_id_maps(subjects, "character")
    scene_map, normalized_scene_map = _build_subject_id_maps(subjects, "scene")
    prop_map, normalized_prop_map = _build_subject_id_maps(subjects, "prop")

    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="chat",
        requested_model=model,
    )
    if not key_data:
        detail = "当前没有可用的对话模型，请先在 API 配置中启用一个 chat 模型"
        if model:
            detail = f"未找到可用的对话模型 {model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)
    api_key, base_url, _, resolved_model_id = key_data

    generation_metadata: dict = {}
    try:
        generated_payload = await generate_storyboard(
            episode.content,
            characters,
            scenes,
            props,
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
            visual_style=visual_style,
            episode_title=episode.title,
            episode_number=episode.episode_number,
            return_metadata=True,
        )
        if isinstance(generated_payload, tuple):
            shots, generation_metadata = generated_payload
        else:
            shots = generated_payload
    except Exception as e:
        error_message = str(e).strip() or repr(e)
        raise HTTPException(
            status_code=502,
            detail=f"第 {episode.episode_number} 集 AI 分镜生成失败: {error_message}",
        ) from e

    if replace_existing:
        await db.execute(
            delete(Storyboard).where(
                Storyboard.project_id == UUID(project_id),
                Storyboard.episode_id == episode.id,
            )
        )
        await db.flush()

    created: list[Storyboard] = []
    for idx, shot in enumerate(shots):
        raw_characters = shot.get("characters", [])
        if isinstance(raw_characters, str):
            raw_characters = [raw_characters]
        elif not isinstance(raw_characters, list):
            raw_characters = []
        shot_char_ids = _resolve_subject_ids(
            raw_characters,
            exact_map=char_map,
            normalized_map=normalized_char_map,
        )

        shot_scene_id = None
        scene_name = shot.get("scene")
        resolved_scene_id = _resolve_subject_id(
            scene_name,
            exact_map=scene_map,
            normalized_map=normalized_scene_map,
        )
        if resolved_scene_id:
            shot_scene_id = UUID(resolved_scene_id)

        raw_props = shot.get("props", [])
        if isinstance(raw_props, str):
            raw_props = [raw_props]
        elif not isinstance(raw_props, list):
            raw_props = []
        shot_prop_ids = _resolve_subject_ids(
            raw_props,
            exact_map=prop_map,
            normalized_map=normalized_prop_map,
        )

        temporary_storyboard = Storyboard(
            project_id=UUID(project_id),
            episode_id=episode.id,
            shot_number=idx + 1,
            content=shot.get("content"),
            shot_type=shot.get("shot_type"),
            camera=shot.get("camera"),
            camera_angle=shot.get("camera_angle"),
            composition=shot.get("composition"),
            duration=shot.get("duration"),
            lighting=shot.get("lighting"),
            ambient_sound=shot.get("ambient_sound"),
            voiceover=shot.get("voiceover"),
            image_prompt=shot.get("image_prompt"),
            character_ids=shot_char_ids or None,
            scene_id=shot_scene_id,
            prop_ids=shot_prop_ids or None,
        )
        composed_prompt_auto, composed_prompt_source_version = _build_storyboard_composed_prompt(
            temporary_storyboard,
            subjects=subjects,
            visual_style=visual_style,
        )

        storyboard = Storyboard(
            project_id=UUID(project_id),
            episode_id=episode.id,
            shot_number=idx + 1,
            content=shot.get("content"),
            shot_type=shot.get("shot_type"),
            camera=shot.get("camera"),
            camera_angle=shot.get("camera_angle"),
            composition=shot.get("composition"),
            duration=shot.get("duration"),
            lighting=shot.get("lighting"),
            ambient_sound=shot.get("ambient_sound"),
            voiceover=shot.get("voiceover"),
            image_prompt=shot.get("image_prompt"),
            character_ids=shot_char_ids or None,
            scene_id=shot_scene_id,
            prop_ids=shot_prop_ids or None,
            gen_params=_merge_storyboard_prompt_layers(
                existing_gen_params={
                    "ai_subject_candidates": {
                        "characters": raw_characters,
                        "scene": scene_name,
                        "props": raw_props,
                    },
                    "beat_refs": shot.get("beat_refs") or [],
                    "story_beat_count": generation_metadata.get("story_beat_count"),
                    "target_shot_count": generation_metadata.get("target_shot_count"),
                    "episode_number": generation_metadata.get("episode_number"),
                    "episode_title": generation_metadata.get("episode_title") or episode.title,
                    "generation_source": generation_metadata.get("generation_source") or (
                        "final_script_batch" if replace_existing else "episode_generate"
                    ),
                },
                composed_prompt_auto=composed_prompt_auto,
                composed_prompt_source_version=composed_prompt_source_version,
            ),
            sort_order=idx,
        )
        db.add(storyboard)
        created.append(storyboard)

    if created:
        _mark_episode_storyboarded(episode)

    await db.flush()
    return created


@router.get(
    "",
    response_model=list[StoryboardResponse],
    summary="获取分镜列表",
    description="返回项目下的分镜列表，可按 `episode_id` 过滤。结果按排序值和镜头号升序返回。",
    response_description="分镜列表。",
)
async def list_storyboards(
    project_id: str,
    episode_id: str | None = Query(None),
    limit: int = Query(STORYBOARD_LIST_DEFAULT_LIMIT, ge=1, le=STORYBOARD_LIST_MAX_LIMIT),
    offset: int = Query(0, ge=0),
    include_gen_params: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_uuid = UUID(project_id)
    await _get_project(project_id, user, db)
    query = select(Storyboard).where(Storyboard.project_id == project_uuid)
    if episode_id:
        query = query.where(Storyboard.episode_id == UUID(episode_id))
    query = query.order_by(
        Storyboard.sort_order,
        Storyboard.shot_number,
        Storyboard.created_at,
        Storyboard.id,
    ).limit(limit).offset(offset)
    result = await db.execute(query)
    storyboards = result.scalars().all()
    image_assets_by_storyboard_id, image_assets_by_file_url = await _get_storyboard_image_assets(
        db,
        project_id=project_uuid,
        user_id=user.id,
        storyboards=storyboards,
    )
    assets_by_storyboard_id, assets_by_file_url = await _get_storyboard_video_assets(
        db,
        project_id=project_uuid,
        user_id=user.id,
        storyboards=storyboards,
    )
    return [
        _to_response(
            storyboard,
            image_asset=_select_storyboard_image_asset(
                storyboard,
                image_assets_by_storyboard_id,
                image_assets_by_file_url,
            ),
            video_asset=_select_storyboard_video_asset(
                storyboard,
                assets_by_storyboard_id,
                assets_by_file_url,
            ),
            include_gen_params=include_gen_params,
        )
        for storyboard in storyboards
    ]


@router.get(
    "/{storyboard_id}",
    response_model=StoryboardResponse,
    summary="获取单个分镜",
    description="读取指定分镜详情，便于任务轮询完成后刷新单条分镜。",
    response_description="分镜详情。",
)
async def get_storyboard(
    project_id: str,
    storyboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_uuid = UUID(project_id)
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(
            Storyboard.project_id == project_uuid,
            Storyboard.id == UUID(storyboard_id),
        )
    )
    storyboard = result.scalar_one_or_none()
    if not storyboard:
        raise HTTPException(status_code=404, detail="分镜不存在")
    image_assets_by_storyboard_id, image_assets_by_file_url = await _get_storyboard_image_assets(
        db,
        project_id=project_uuid,
        user_id=user.id,
        storyboards=[storyboard],
    )
    assets_by_storyboard_id, assets_by_file_url = await _get_storyboard_video_assets(
        db,
        project_id=project_uuid,
        user_id=user.id,
        storyboards=[storyboard],
    )
    return _to_response(
        storyboard,
        image_asset=_select_storyboard_image_asset(
            storyboard,
            image_assets_by_storyboard_id,
            image_assets_by_file_url,
        ),
        video_asset=_select_storyboard_video_asset(
            storyboard,
            assets_by_storyboard_id,
            assets_by_file_url,
        ),
    )


class StoryboardCreate(BaseModel):
    episode_id: str | None = None
    shot_number: int = 1
    content: str | None = None
    shot_type: str | None = None
    camera: str | None = None
    camera_angle: str | None = None
    composition: str | None = None
    duration: float | None = None
    lighting: str | None = None
    ambient_sound: str | None = None
    voiceover: str | None = None
    image_prompt: str | None = None
    character_ids: list[str] | None = None
    scene_id: str | None = None
    prop_ids: list[str] | None = None
    anchor_storyboard_id: str | None = None
    position: str | None = None
    clone_from_storyboard_id: str | None = None
    gen_params: dict | None = None


@router.post(
    "",
    response_model=StoryboardResponse,
    status_code=201,
    summary="创建分镜",
    description="手动创建一个分镜，可指定插入位置、锚点分镜或复制已有分镜内容。",
    response_description="创建成功后的分镜。",
)
async def create_storyboard(
    project_id: str,
    req: StoryboardCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    project_uuid = UUID(project_id)
    episode_uuid = UUID(req.episode_id) if req.episode_id else None

    existing_storyboards = await _list_storyboards_in_scope(db, project_uuid, episode_uuid)

    position = req.position or "end"
    if position not in {"above", "below", "end"}:
        raise HTTPException(status_code=422, detail="position 仅支持 above、below、end")

    insert_index = len(existing_storyboards)
    if req.anchor_storyboard_id:
        anchor_index = next(
            (idx for idx, item in enumerate(existing_storyboards) if str(item.id) == req.anchor_storyboard_id),
            None,
        )
        if anchor_index is None:
            raise HTTPException(status_code=404, detail="锚点分镜不存在或不在当前集")
        insert_index = anchor_index if position == "above" else anchor_index + 1

    clone_source = None
    if req.clone_from_storyboard_id:
        clone_source = next(
            (item for item in existing_storyboards if str(item.id) == req.clone_from_storyboard_id),
            None,
        )
        if clone_source is None:
            clone_result = await db.execute(
                select(Storyboard).where(
                    Storyboard.id == UUID(req.clone_from_storyboard_id),
                    Storyboard.project_id == project_uuid,
                )
            )
            clone_source = clone_result.scalar_one_or_none()
        if not clone_source:
            raise HTTPException(status_code=404, detail="复制来源分镜不存在")

    sb = Storyboard(
        project_id=project_uuid,
        episode_id=episode_uuid,
        shot_number=insert_index + 1,
        content=req.content if req.content is not None else (clone_source.content if clone_source else None),
        shot_type=req.shot_type if req.shot_type is not None else (clone_source.shot_type if clone_source else None),
        camera=req.camera if req.camera is not None else (clone_source.camera if clone_source else None),
        camera_angle=req.camera_angle if req.camera_angle is not None else (clone_source.camera_angle if clone_source else None),
        composition=req.composition if req.composition is not None else (clone_source.composition if clone_source else None),
        duration=req.duration if req.duration is not None else (clone_source.duration if clone_source else None),
        lighting=req.lighting if req.lighting is not None else (clone_source.lighting if clone_source else None),
        ambient_sound=req.ambient_sound if req.ambient_sound is not None else (clone_source.ambient_sound if clone_source else None),
        voiceover=req.voiceover if req.voiceover is not None else (clone_source.voiceover if clone_source else None),
        image_prompt=req.image_prompt if req.image_prompt is not None else (clone_source.image_prompt if clone_source else None),
        character_ids=req.character_ids if req.character_ids is not None else (clone_source.character_ids if clone_source else None),
        scene_id=UUID(req.scene_id) if req.scene_id else (clone_source.scene_id if clone_source else None),
        prop_ids=req.prop_ids if req.prop_ids is not None else (clone_source.prop_ids if clone_source else None),
        sort_order=insert_index,
    )
    subjects, _, _, _, _, _, _ = await _load_storyboard_subject_context(db, project_id=project_id)
    visual_style = await resolve_visual_style_text(project.visual_style, user.id, db)
    composed_prompt_auto, composed_prompt_source_version = _build_storyboard_composed_prompt(
        sb,
        subjects=subjects,
        visual_style=visual_style,
    )
    sb.gen_params = _merge_storyboard_prompt_layers(
        existing_gen_params=clone_source.gen_params if clone_source else None,
        composed_prompt_auto=composed_prompt_auto,
        composed_prompt_source_version=composed_prompt_source_version,
        incoming_gen_params=req.gen_params,
    )
    db.add(sb)

    ordered_storyboards = existing_storyboards.copy()
    ordered_storyboards.insert(insert_index, sb)
    for idx, storyboard in enumerate(ordered_storyboards):
        storyboard.sort_order = idx
        storyboard.shot_number = idx + 1

    await db.commit()
    await db.refresh(sb)
    return _to_response(sb)


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


class GenerateVideoRequest(BaseModel):
    mode: str = "multi_param"
    prompt: str | None = None
    model: str | None = None
    reference_mode: str | None = None
    reference_images: list[str] | None = None
    first_frame_url: str | None = None
    last_frame_url: str | None = None
    duration: float | str = 5.0
    resolution: str | None = None
    sound_effect: bool = False
    reference_video_url: str | None = None
    reference_audio_url: str | None = None
    ratio: str | None = None
    generate_mode: str | None = None
    generate_audio: bool | None = None
    audio_setting: str | None = None
    watermark: bool | None = None
    mentioned_subjects: list[str] | None = None
    mentions: list["StoryboardPromptMention"] | None = None
    attachments: list["StoryboardAssetBinding"] | None = None
    first_frame_asset_id: str | None = None
    last_frame_asset_id: str | None = None
    reference_video_asset_id: str | None = None
    reference_audio_asset_id: str | None = None
    reference_image_asset_ids: list[str] | None = None


class StoryboardPromptMention(BaseModel):
    mention_id: str | None = None
    asset_id: str | None = None
    asset_type: Literal["image", "video", "audio"] | None = None
    asset_name: str | None = None
    display_text: str
    start: int | None = None
    end: int | None = None
    intended_role: str | None = None


class StoryboardAssetBinding(BaseModel):
    asset_id: str | None = None
    asset_type: Literal["image", "video", "audio"] | None = None
    asset_name: str | None = None
    url: str | None = None
    role: str | None = None
    source: str | None = None


@router.post(
    "/{storyboard_id}/generate-video",
    response_model=StoryboardGenerationTaskResponse,
    summary="生成分镜视频",
    description="基于当前分镜描述、任务2 提示词层和参考素材创建分镜视频生成任务，前端需轮询任务完成后再刷新分镜。",
    response_description="新建的视频生成任务。",
)
async def generate_storyboard_video(
    project_id: str,
    storyboard_id: str,
    req: GenerateVideoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    prompt = _resolve_storyboard_generation_prompt(sb, req.prompt)
    if not prompt:
        raise HTTPException(status_code=400, detail="无可用提示词")

    stored_gen_params = sb.gen_params or {}
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
    explicit_first_frame = req.first_frame_url
    first_frame = explicit_first_frame or sb.image_url
    last_frame = req.last_frame_url
    request_reference_images = _resolve_reference_images(req.model_dump())
    has_request_reference_images = (
        req.reference_images is not None or req.referenceImages is not None
    )
    reference_images = (
        request_reference_images
        if has_request_reference_images
        else list(sb.reference_image_urls or [])
    )
    reference_video_url = req.reference_video_url or stored_gen_params.get("reference_video_url")
    reference_audio_url = req.reference_audio_url or stored_gen_params.get("reference_audio_url")
    ratio = req.ratio or stored_gen_params.get("ratio") or project.aspect_ratio or "16:9"
    resolution = _resolve_storyboard_video_resolution(
        model=model,
        requested_resolution=req.resolution,
        stored_gen_params=stored_gen_params,
    )
    generate_mode = req.generate_mode or stored_gen_params.get("generate_mode")
    generate_audio = (
        resolve_optional_model_toggle(
            model_id=model,
            category="video",
            capability_key="supports_generate_audio_toggle",
            requested_value=req.generate_audio,
            stored_value=stored_gen_params.get("generate_audio"),
        )
    )
    watermark = (
        resolve_optional_model_toggle(
            model_id=model,
            category="video",
            capability_key="supports_watermark_toggle",
            requested_value=req.watermark,
            default_value=default_video_watermark,
            stored_value=stored_gen_params.get("watermark"),
        )
    )
    reference_mode = (
        (req.reference_mode or "").strip()
        or infer_video_reference_mode(
            model,
            first_frame_url=first_frame,
            last_frame_url=last_frame,
            reference_video_url=reference_video_url,
            fallback_to_full_on_unsupported_first_frame=True,
        )
    )
    seedance_voice_video_trace: dict = {
        "eligible_model": _is_storyboard_seedance_voice_video_model(model),
        "reference_mode": reference_mode,
        "manual_reference_audio": bool(req.reference_audio_url),
        "stored_reference_audio": bool(stored_gen_params.get("reference_audio_url")),
    }
    speech_text: str | None = None
    if (
        seedance_voice_video_trace["eligible_model"]
        and reference_mode == "full"
    ):
        subject_result = await db.execute(
            select(Subject).where(Subject.project_id == UUID(project_id))
        )
        subject_map = {
            str(subject.id): subject
            for subject in subject_result.scalars().all()
        }
        resolved_seedance_inputs = await resolve_storyboard_seedance_voice_video_inputs(
            db=db,
            storyboard=sb,
            subject_map=subject_map,
        )
        speech_text = resolved_seedance_inputs.get("speech_text")
        prompt = _append_storyboard_narration_to_prompt(prompt, speech_text)
        auto_reference_audio_url = resolved_seedance_inputs.get("reference_audio_url")
        if not reference_audio_url and auto_reference_audio_url:
            reference_audio_url = auto_reference_audio_url
        seedance_voice_video_trace.update(
            {
                "speech_text": speech_text,
                "speech_text_source": resolved_seedance_inputs.get("speech_text_source"),
                "structured_segment_count": resolved_seedance_inputs.get("structured_segment_count"),
                "narration_job_count": resolved_seedance_inputs.get("narration_job_count"),
                "reference_audio_source": (
                    "request.reference_audio_url"
                    if req.reference_audio_url
                    else (
                        "storyboard.gen_params.reference_audio_url"
                        if stored_gen_params.get("reference_audio_url")
                        else resolved_seedance_inputs.get("reference_audio_source")
                    )
                ),
                "reference_audio_resolution": resolved_seedance_inputs.get("reference_audio_resolution"),
                "requested_voice_id": resolved_seedance_inputs.get("requested_voice_id"),
                "provider_voice_id": resolved_seedance_inputs.get("provider_voice_id"),
                "voice_name": resolved_seedance_inputs.get("voice_name"),
                "subject_id": resolved_seedance_inputs.get("subject_id"),
                "subject_name": resolved_seedance_inputs.get("subject_name"),
                "reference_audio_candidates": resolved_seedance_inputs.get("reference_audio_candidates") or [],
                "auto_reference_audio_resolved": bool(auto_reference_audio_url),
            }
        )
    elif seedance_voice_video_trace["eligible_model"]:
        seedance_voice_video_trace["reference_audio_source"] = (
            "request.reference_audio_url"
            if req.reference_audio_url
            else (
                "storyboard.gen_params.reference_audio_url"
                if stored_gen_params.get("reference_audio_url")
                else None
            )
        )
    seedance_requested_generate_audio = req.generate_audio
    if (
        seedance_voice_video_trace["eligible_model"]
        and reference_mode == "full"
        and seedance_requested_generate_audio is None
        and speech_text
        and reference_audio_url
    ):
        seedance_requested_generate_audio = True
    validated = validate_video_request(
        model=model,
        prompt=prompt,
        ratio=ratio,
        resolution=resolution,
        duration=req.duration,
        generation_mode=generate_mode,
        reference_mode=reference_mode,
        first_frame_url=first_frame,
        last_frame_url=last_frame,
        reference_video_url=reference_video_url,
        reference_audio_url=reference_audio_url,
        attachments=[
            item.model_dump(exclude_none=True)
            for item in (req.attachments or [])
        ],
        first_frame_asset_id=req.first_frame_asset_id,
        last_frame_asset_id=req.last_frame_asset_id,
        reference_video_asset_id=req.reference_video_asset_id,
        reference_audio_asset_id=req.reference_audio_asset_id,
        reference_image_asset_ids=req.reference_image_asset_ids or [],
        generate_audio=generate_audio,
        audio_setting=req.audio_setting,
        watermark=watermark,
    )
    seedance_voice_video_trace["enabled"] = bool(
        seedance_voice_video_trace.get("eligible_model")
        and validated["reference_mode"] == "full"
        and speech_text
        and reference_audio_url
        and generate_audio is not False
    )
    seedance_voice_video_trace["generate_audio"] = generate_audio
    seedance_voice_video_trace["reference_audio_attached"] = bool(reference_audio_url)
    primary_reference_image = reference_images[0] if len(reference_images) > 0 else None
    secondary_reference_image = reference_images[1] if len(reference_images) > 1 else None
    effective_image_url = primary_reference_image if validated["reference_mode"] == "full" else None
    effective_first_frame = None
    if validated["reference_mode"] in {"first_frame", "video_ref"}:
        effective_first_frame = first_frame
    elif validated["reference_mode"] == "full":
        effective_first_frame = explicit_first_frame
    effective_last_frame = (
        last_frame
        if validated["reference_mode"] in {"full", "last_frame", "video_ref"}
        else None
    )
    if validated["reference_mode"] == "full":
        if not effective_image_url and effective_first_frame:
            effective_image_url = effective_first_frame
        if not effective_image_url and primary_reference_image:
            effective_image_url = primary_reference_image
        if not effective_image_url and not effective_first_frame and sb.image_url:
            effective_first_frame = sb.image_url
        if not effective_last_frame and secondary_reference_image:
            effective_last_frame = secondary_reference_image
    ratio = validated["ratio"] or ratio

    task = GenTask(
        user_id=user.id,
        project_id=UUID(project_id),
        task_type="sb_video",
        status="pending",
        total_count=1,
        success_count=0,
        fail_count=0,
        model=model,
        size=validated["resolution"],
        params={
            "storyboard_id": str(sb.id),
            "episode_id": str(sb.episode_id) if sb.episode_id else None,
            "reference_mode": validated["reference_mode"],
            "ratio": ratio,
            "resolution": validated["resolution"],
            "duration": req.duration,
            "generate_mode": generate_mode,
            "generate_audio": generate_audio,
            "watermark": watermark,
            "source": "storyboard_generate_video",
            "seedance_voice_video": seedance_voice_video_trace or None,
        },
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.storyboards:_run_storyboard_video_task",
        kwargs={
            "task_id": task.id,
            "user_id": user.id,
            "project_id": UUID(project_id),
            "storyboard_id": sb.id,
            "prompt": prompt,
            "model": model,
            "duration": req.duration,
            "reference_mode": validated["reference_mode"],
            "effective_image_url": effective_image_url,
            "effective_first_frame": effective_first_frame,
            "effective_last_frame": effective_last_frame,
            "resolution": validated["resolution"],
            "sound_effect": req.sound_effect,
            "reference_video_url": reference_video_url,
            "reference_audio_url": reference_audio_url,
            "ratio": ratio,
            "generate_mode": generate_mode,
            "generate_audio": generate_audio,
            "audio_setting": validated["audio_setting"],
            "watermark": watermark,
            "mentions": [
                item.model_dump(exclude_none=True)
                for item in (req.mentions or [])
            ],
            "attachments": [
                item.model_dump(exclude_none=True)
                for item in (req.attachments or [])
            ],
            "first_frame_asset_id": req.first_frame_asset_id,
            "last_frame_asset_id": req.last_frame_asset_id,
            "reference_video_asset_id": req.reference_video_asset_id,
            "reference_audio_asset_id": req.reference_audio_asset_id,
            "reference_image_asset_ids": req.reference_image_asset_ids or [],
            "request_reference_images": request_reference_images,
            "speech_text": speech_text,
            "seedance_voice_video_trace": seedance_voice_video_trace,
        },
        name=f"gen-task:{task.id}:storyboard-video",
    )
    return _task_to_response(task)


class BatchDownloadRequest(BaseModel):
    storyboard_ids: list[str] | None = None


@router.get(
    "/{storyboard_id}/download-video",
    summary="下载分镜视频",
    description="下载指定分镜的视频文件。",
    response_description="视频二进制流。",
)
async def download_storyboard_video(
    project_id: str,
    storyboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(
            Storyboard.id == UUID(storyboard_id),
            Storyboard.project_id == UUID(project_id),
        )
    )
    storyboard = result.scalar_one_or_none()
    if not storyboard or not storyboard.video_url:
        raise HTTPException(status_code=404, detail="当前分镜没有可下载的视频")

    try:
        assets_by_storyboard_id, assets_by_file_url = await _get_storyboard_video_assets(
            db,
            project_id=UUID(project_id),
            user_id=user.id,
            storyboards=[storyboard],
        )
        video_asset = _select_storyboard_video_asset(
            storyboard,
            assets_by_storyboard_id,
            assets_by_file_url,
        )
        media = build_video_media_fields(
            file_url=storyboard.video_url,
            thumbnail_url=video_asset.thumbnail_url if video_asset else None,
            metadata=video_asset.metadata_json if video_asset else {},
            user_id=str(video_asset.user_id) if video_asset else None,
            project_id=str(video_asset.project_id) if video_asset and video_asset.project_id else str(project.id),
            resource_id=str(video_asset.id) if video_asset else None,
        )
        download_target = resolve_verified_download_target_from_url(
            str(media["download_url"] or storyboard.video_url),
            expected_user_id=str(user.id),
        )
        content = await _read_media_bytes(download_target, 120.0)
    except MediaDownloadAccessError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="视频文件不存在")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"视频下载失败: {exc}")

    filename = _build_archive_filename(storyboard.shot_number, storyboard.video_url, ".mp4")
    project_prefix = _sanitize_zip_segment(project.name)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(project_prefix + '_' + filename)}"
        },
    )


@router.post(
    "/download/images",
    summary="批量下载分镜图",
    description="按项目或指定分镜 ID 列表打包下载分镜图片。",
    response_description="分镜图 zip 压缩包流。",
)
async def batch_download_images(
    project_id: str,
    req: BatchDownloadRequest = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    project_uuid = UUID(project_id)

    query = select(Storyboard).where(Storyboard.project_id == project_uuid)
    if req and req.storyboard_ids:
        query = query.where(Storyboard.id.in_([UUID(sid) for sid in req.storyboard_ids]))
    query = query.where(Storyboard.image_url.isnot(None))

    result = await db.execute(query)
    shots = result.scalars().all()

    if not shots:
        raise HTTPException(status_code=404, detail="没有可下载的分镜图")

    project_result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = project_result.scalar_one_or_none()
    project_name = project.name if project else "project"
    asset_lookup = await _load_storyboard_asset_lookup(
        db,
        user_id=user.id,
        project_id=project_uuid,
    )
    return await _build_storyboard_zip_response(
        shots=shots,
        project_name=project_name,
        download_context_getter=lambda shot: _resolve_storyboard_image_download_context(
            shot,
            asset_lookup=asset_lookup,
        ),
        expected_user_id=str(user.id),
        fallback_ext=".png",
        timeout=30.0,
        empty_detail="没有可成功下载的分镜图",
        download_name=f"{_sanitize_zip_segment(project_name)}_分镜图.zip",
    )


@router.post(
    "/download/videos",
    summary="批量下载分镜视频",
    description="按项目或指定分镜 ID 列表打包下载分镜视频。",
    response_description="分镜视频 zip 压缩包流。",
)
async def batch_download_videos(
    project_id: str,
    req: BatchDownloadRequest = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    project_uuid = UUID(project_id)

    query = select(Storyboard).where(Storyboard.project_id == project_uuid)
    if req and req.storyboard_ids:
        query = query.where(Storyboard.id.in_([UUID(sid) for sid in req.storyboard_ids]))
    query = query.where(Storyboard.video_url.isnot(None))

    result = await db.execute(query)
    shots = result.scalars().all()

    if not shots:
        raise HTTPException(status_code=404, detail="没有可下载的分镜视频")

    project_result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = project_result.scalar_one_or_none()
    project_name = project.name if project else "project"
    asset_lookup = await _load_storyboard_asset_lookup(
        db,
        user_id=user.id,
        project_id=project_uuid,
    )
    return await _build_storyboard_zip_response(
        shots=shots,
        project_name=project_name,
        download_context_getter=lambda shot: _resolve_storyboard_video_download_context(
            shot,
            asset_lookup=asset_lookup,
        ),
        expected_user_id=str(user.id),
        fallback_ext=".mp4",
        timeout=120.0,
        empty_detail="没有可成功下载的分镜视频",
        download_name=f"{_sanitize_zip_segment(project_name)}_分镜视频.zip",
    )


@router.post(
    "/download/bundle",
    summary="批量下载分镜资源包",
    description="按所选分镜打包当前分镜图与分镜视频，压缩包内按分镜目录组织并附带 manifest。",
    response_description="分镜资源 zip 压缩包流。",
)
async def batch_download_storyboard_bundle(
    project_id: str,
    req: BatchDownloadRequest = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)

    query = select(Storyboard).where(Storyboard.project_id == UUID(project_id))
    if req and req.storyboard_ids:
        query = query.where(Storyboard.id.in_([UUID(sid) for sid in req.storyboard_ids]))
    result = await db.execute(
        query.order_by(
            Storyboard.sort_order,
            Storyboard.shot_number,
            Storyboard.created_at,
            Storyboard.id,
        )
    )
    shots = result.scalars().all()

    if not shots:
        raise HTTPException(status_code=404, detail="没有匹配的分镜")

    return await _build_storyboard_bundle_zip_response(
        shots=shots,
        project=project,
        user_id=user.id,
        db=db,
    )


class StoryboardUpdate(BaseModel):
    content: str | None = None
    shot_type: str | None = None
    camera: str | None = None
    camera_angle: str | None = None
    composition: str | None = None
    duration: float | None = None
    lighting: str | None = None
    ambient_sound: str | None = None
    voiceover: str | None = None
    image_prompt: str | None = None
    image_url: str | None = None
    video_url: str | None = None
    character_ids: list[str] | None = None
    scene_id: str | None = None
    prop_ids: list[str] | None = None
    reference_image_urls: list[str] | None = None
    gen_params: dict | None = None


@router.patch(
    "/{storyboard_id}",
    response_model=StoryboardResponse,
    summary="更新分镜",
    description="更新分镜的任务1 结构化字段、任务2 提示词层或图片/视频地址。更新后会自动刷新组合提示词自动稿。",
    response_description="更新后的分镜对象。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "content": "女主站在廊下回头，神情迟疑却倔强",
                        "shot_type": "medium",
                        "camera": "static",
                        "camera_angle": "eye_level",
                        "composition": "centered",
                        "duration": 4.5,
                        "lighting": "evening warm light",
                        "ambient_sound": "风吹竹叶声",
                        "voiceover": "她知道自己已经没有退路",
                        "character_ids": ["3b4d0ec0-ae15-4d9d-9f39-b5b7dcb90245"],
                        "scene_id": "a84964b1-f307-467f-8a48-4f9e0bb10f5b",
                        "prop_ids": [],
                        "gen_params": {
                            "composed_prompt_manual": "古风写实，电影感，中景，女主回头，廊下暮色，情绪克制但紧张",
                            "composed_prompt_dirty": True
                        }
                    }
                }
            }
        }
    },
)
async def update_storyboard(
    project_id: str,
    storyboard_id: str,
    req: StoryboardUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    for field in ["content", "shot_type", "camera", "camera_angle", "composition", "duration",
                  "lighting", "ambient_sound", "voiceover", "image_prompt", "image_url", "video_url",
                  "character_ids", "prop_ids", "reference_image_urls"]:
        value = getattr(req, field)
        if value is not None:
            setattr(sb, field, value)

    if req.scene_id is not None:
        sb.scene_id = UUID(req.scene_id) if req.scene_id else None

    subjects, _, _, _, _, _, _ = await _load_storyboard_subject_context(db, project_id=project_id)
    visual_style = await resolve_visual_style_text(project.visual_style, user.id, db)
    composed_prompt_auto, composed_prompt_source_version = _build_storyboard_composed_prompt(
        sb,
        subjects=subjects,
        visual_style=visual_style,
    )
    sb.gen_params = _merge_storyboard_prompt_layers(
        existing_gen_params=sb.gen_params,
        composed_prompt_auto=composed_prompt_auto,
        composed_prompt_source_version=composed_prompt_source_version,
        incoming_gen_params=req.gen_params,
    )

    await db.commit()
    await db.refresh(sb)
    return _to_response(sb)


@router.delete(
    "/{storyboard_id}",
    summary="删除分镜",
    description="删除指定分镜，并重排同一作用域下剩余分镜的顺序与镜头号。",
    response_description="删除结果。",
)
async def delete_storyboard(
    project_id: str,
    storyboard_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")
    scope_episode_id = sb.episode_id
    await db.delete(sb)
    await db.flush()
    remaining_storyboards = await _list_storyboards_in_scope(db, UUID(project_id), scope_episode_id)
    for idx, storyboard in enumerate(remaining_storyboards):
        storyboard.sort_order = idx
        storyboard.shot_number = idx + 1
    await db.commit()
    return {"message": "已删除"}


class ReorderRequest(BaseModel):
    ordered_ids: list[str]


@router.post(
    "/reorder",
    summary="重排分镜顺序",
    description="按前端提交的 ID 顺序重写分镜排序值和镜头号。",
    response_description="重排结果。",
)
async def reorder_storyboards(
    project_id: str,
    req: ReorderRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    for idx, sid in enumerate(req.ordered_ids):
        result = await db.execute(
            select(Storyboard).where(Storyboard.id == UUID(sid), Storyboard.project_id == UUID(project_id))
        )
        sb = result.scalar_one_or_none()
        if sb:
            sb.sort_order = idx
            sb.shot_number = idx + 1
    await db.commit()
    return {"message": "已排序"}


# --- AI 智能分镜 ---

class GenerateStoryboardRequest(BaseModel):
    episode_id: str
    model: str | None = None


@router.post(
    "/generate",
    response_model=list[StoryboardResponse],
    summary="从单集剧本生成分镜",
    description="基于指定正式分集剧本自动生成分镜，不会覆盖已有分镜。",
    response_description="新生成的分镜列表。",
)
async def generate_storyboard_from_episode(
    project_id: str,
    req: GenerateStoryboardRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)

    # 获取剧本
    ep_result = await db.execute(
        select(Episode).where(Episode.id == UUID(req.episode_id), Episode.project_id == UUID(project_id))
    )
    episode = ep_result.scalar_one_or_none()
    if not episode or not episode.content:
        raise HTTPException(status_code=400, detail="剧本为空，请先生成或编辑剧本")

    visual_style = await resolve_visual_style_text(project.visual_style, user.id, db)
    subjects, _, _, _, _, _, _ = await _load_storyboard_subject_context(db, project_id=project_id)
    created = await _generate_storyboards_for_episode(
        project_id=project_id,
        episode=episode,
        model=req.model,
        subjects=subjects,
        user=user,
        db=db,
        visual_style=visual_style,
        replace_existing=False,
    )

    if not created:
        raise HTTPException(status_code=502, detail="AI 未生成有效分镜，请检查正式分集内容或稍后重试")

    await db.commit()
    for sb in created:
        await db.refresh(sb)

    return [_to_response(sb) for sb in created]


class EpisodeStoryboardGenerationResult(BaseModel):
    episode_id: str
    episode_number: int
    title: str
    storyboard_count: int


class GenerateStoryboardsFromFinalScriptRequest(BaseModel):
    model: str | None = None
    episode_count: int | None = None
    split_mode: str = "rule_first"
    continue_in_background: bool = True


async def _continue_generate_storyboards_from_final_script(
    *,
    task_id: UUID,
    project_id: str,
    user_id: UUID,
    episode_count: int | None,
    model: str | None,
    split_mode: str,
) -> None:
    try:
        async with async_session() as db:
            task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
            task = task_result.scalar_one_or_none()
            if not task:
                return
            task.status = "running"
            _set_storyboard_task_progress(
                task,
                stage="validating_final_script",
                overwrite_existing=True,
            )
            await db.commit()

            project_result = await db.execute(
                select(Project).where(Project.id == UUID(project_id), Project.user_id == user_id)
            )
            project = project_result.scalar_one_or_none()
            if not project:
                raise HTTPException(status_code=404, detail="项目不存在")

            user_result = await db.execute(select(User).where(User.id == user_id))
            bg_user = user_result.scalar_one_or_none()
            if not bg_user:
                raise HTTPException(status_code=404, detail="用户不存在")

            project_script = await get_or_create_project_script(project_id, db)
            script_content = (project_script.content or project_script.parsed_content or "").strip()
            if not script_content:
                raise HTTPException(status_code=400, detail="主剧本为空，请先完成剧本定稿")

            _set_storyboard_task_progress(
                task,
                stage="finalizing_script",
                script_status=project_script.status,
                overwrite_existing=True,
            )
            await db.commit()

            await finalize_project_script(
                project=project,
                project_script=project_script,
                episode_count=episode_count,
                model=model,
                split_mode=split_mode,
                db=db,
            )

            episodes_result = await db.execute(
                select(Episode)
                .where(
                    Episode.project_id == UUID(project_id),
                )
                .order_by(Episode.episode_number, Episode.created_at, Episode.id)
            )
            episodes = episodes_result.scalars().all()
            if not episodes:
                raise HTTPException(status_code=400, detail="未找到可用于生成分镜的正式分集")

            task.total_count = len(episodes)
            task.results = []
            task.success_count = 0
            task.fail_count = 0
            target_episode_ids = [str(episode.id) for episode in episodes]
            queued_episode_numbers = [episode.episode_number for episode in episodes]
            completed_episode_numbers: list[int] = []
            failed_episode_numbers: list[int] = []
            warning_messages: list[str] = []
            _set_storyboard_task_progress(
                task,
                stage="loading_subject_context",
                script_status=project_script.status,
                overwrite_existing=True,
                target_episode_ids=target_episode_ids,
                queued_episode_numbers=queued_episode_numbers,
                completed_episode_numbers=completed_episode_numbers,
                failed_episode_numbers=failed_episode_numbers,
                total_storyboard_count=0,
                warning_messages=warning_messages,
            )
            await db.commit()

            visual_style = await resolve_visual_style_text(project.visual_style, user_id, db)
            subjects, _, _, _, _, _, _ = await _load_storyboard_subject_context(db, project_id=project_id)
            if not subjects:
                warning_messages = [
                    *warning_messages,
                    "当前主体库为空，本次将仅按剧本内容抽镜",
                ]
                _set_storyboard_task_progress(
                    task,
                    stage="loading_subject_context",
                    script_status=project_script.status,
                    overwrite_existing=True,
                    target_episode_ids=target_episode_ids,
                    queued_episode_numbers=queued_episode_numbers,
                    completed_episode_numbers=completed_episode_numbers,
                    failed_episode_numbers=failed_episode_numbers,
                    total_storyboard_count=0,
                    warning_messages=warning_messages,
                )
                await db.commit()
            total_storyboard_count = 0
            first_episode_id: str | None = None
            last_completed_episode: Episode | None = None

            for episode in episodes:
                _set_storyboard_task_progress(
                    task,
                    stage=f"generating_episode_{episode.episode_number}",
                    script_status=project_script.status,
                    overwrite_existing=True,
                    current_episode=episode,
                    target_episode_ids=target_episode_ids,
                    queued_episode_numbers=[item.episode_number for item in episodes if item.episode_number >= episode.episode_number],
                    completed_episode_numbers=completed_episode_numbers,
                    failed_episode_numbers=failed_episode_numbers,
                    last_completed_episode=last_completed_episode,
                    total_storyboard_count=total_storyboard_count,
                    warning_messages=warning_messages,
                )
                await db.commit()
                try:
                    created = await _generate_storyboards_for_episode(
                        project_id=project_id,
                        episode=episode,
                        model=model,
                        subjects=subjects,
                        user=bg_user,
                        db=db,
                        visual_style=visual_style,
                        replace_existing=True,
                    )
                    total_storyboard_count += len(created)
                    if first_episode_id is None and created:
                        first_episode_id = str(episode.id)
                    task.success_count += 1
                    completed_episode_numbers = [*completed_episode_numbers, episode.episode_number]
                    last_completed_episode = episode
                    task.results = [
                        *(task.results or []),
                        {
                            "episode_id": str(episode.id),
                            "episode_number": episode.episode_number,
                            "title": episode.title,
                            "storyboard_count": len(created),
                            "status": "completed",
                        },
                    ]
                    remaining_episode_numbers = [
                        item.episode_number for item in episodes
                        if item.episode_number > episode.episode_number
                    ]
                    _set_storyboard_task_progress(
                        task,
                        stage="finalizing_results" if not remaining_episode_numbers else f"generating_episode_{remaining_episode_numbers[0]}",
                        script_status=project_script.status,
                        overwrite_existing=True,
                        current_episode=None if not remaining_episode_numbers else next(
                            (item for item in episodes if item.episode_number == remaining_episode_numbers[0]),
                            None,
                        ),
                        target_episode_ids=target_episode_ids,
                        queued_episode_numbers=remaining_episode_numbers,
                        completed_episode_numbers=completed_episode_numbers,
                        failed_episode_numbers=failed_episode_numbers,
                        last_completed_episode=last_completed_episode,
                        total_storyboard_count=total_storyboard_count,
                        warning_messages=warning_messages,
                    )
                    task.params = {
                        **(task.params or {}),
                        "first_episode_id": first_episode_id,
                    }
                    await db.commit()
                except Exception as exc:
                    await db.rollback()
                    task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
                    task = task_result.scalar_one_or_none()
                    if not task:
                        return
                    task.fail_count += 1
                    failed_episode_numbers = [*failed_episode_numbers, episode.episode_number]
                    task.results = [
                        *(task.results or []),
                        {
                            "episode_id": str(episode.id),
                            "episode_number": episode.episode_number,
                            "title": episode.title,
                            "storyboard_count": 0,
                            "status": "failed",
                            "error": _stringify_task_error(exc),
                        },
                    ]
                    remaining_episode_numbers = [
                        item.episode_number for item in episodes
                        if item.episode_number > episode.episode_number
                    ]
                    _set_storyboard_task_progress(
                        task,
                        stage="finalizing_results" if not remaining_episode_numbers else f"generating_episode_{remaining_episode_numbers[0]}",
                        script_status=project_script.status,
                        overwrite_existing=True,
                        current_episode=None if not remaining_episode_numbers else next(
                            (item for item in episodes if item.episode_number == remaining_episode_numbers[0]),
                            None,
                        ),
                        target_episode_ids=target_episode_ids,
                        queued_episode_numbers=remaining_episode_numbers,
                        completed_episode_numbers=completed_episode_numbers,
                        failed_episode_numbers=failed_episode_numbers,
                        last_completed_episode=last_completed_episode,
                        total_storyboard_count=total_storyboard_count,
                        warning_messages=warning_messages,
                    )
                    await db.commit()

            task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
            task = task_result.scalar_one_or_none()
            if not task:
                return
            if task.fail_count == 0 and task.success_count > 0:
                task.status = "completed"
            elif task.success_count == 0:
                task.status = "failed"
                if not task.results:
                    task.results = [{"status": "failed", "error": "AI 未生成有效分镜，请检查正式分集内容或稍后重试"}]
            else:
                task.status = "partial"
            _set_storyboard_task_progress(
                task,
                stage=task.status,
                script_status=project_script.status,
                overwrite_existing=True,
                target_episode_ids=target_episode_ids,
                queued_episode_numbers=[],
                completed_episode_numbers=completed_episode_numbers,
                failed_episode_numbers=failed_episode_numbers,
                last_completed_episode=last_completed_episode,
                total_storyboard_count=total_storyboard_count,
                warning_messages=warning_messages,
            )
            task.params = {
                **(task.params or {}),
                "first_episode_id": first_episode_id,
            }
            await db.commit()
    except Exception:
        async with async_session() as db:
            task_result = await db.execute(select(GenTask).where(GenTask.id == task_id))
            task = task_result.scalar_one_or_none()
            if not task:
                return
            task.status = "failed"
            task.fail_count = max(task.fail_count, task.total_count or 1)
            task.results = [
                *(task.results or []),
                {
                    "status": "failed",
                    "error": "批量智能分镜任务执行失败，请稍后重试",
                },
            ]
            _set_storyboard_task_progress(
                task,
                stage="failed",
                overwrite_existing=True,
            )
            await db.commit()


@router.post(
    "/generate-from-final-script",
    response_model=StoryboardGenerationTaskResponse,
    summary="从主剧本定稿批量生成分镜",
    description="以正式分集为基础批量生成全项目分镜。请求会立即返回任务对象，后台按分集逐步写入分镜结果。",
    response_description="已创建的批量分镜任务。",
    responses={
        200: {
            "description": "任务创建成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "4b7ba474-c564-4cfa-8a18-5db9c15401fd",
                        "task_type": "storyboard_generate",
                        "status": "pending",
                        "total_count": 0,
                        "success_count": 0,
                        "fail_count": 0,
                        "params": {
                            "source": "storyboard_generate_from_final_script",
                            "current_stage": "queued",
                            "split_mode": "rule_first",
                        },
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
                        "model": "gpt-4.1",
                    }
                }
            }
        }
    },
)
async def generate_storyboards_from_final_script(
    project_id: str,
    req: GenerateStoryboardsFromFinalScriptRequest | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = req or GenerateStoryboardsFromFinalScriptRequest()
    await _get_project(project_id, user, db)
    project_script = await get_or_create_project_script(project_id, db)
    script_content = (project_script.content or project_script.parsed_content or "").strip()
    if not script_content:
        raise HTTPException(status_code=400, detail="主剧本为空，请先完成剧本定稿")

    task = GenTask(
        user_id=user.id,
        project_id=UUID(project_id),
        task_type="storyboard_generate",
        status="pending",
        total_count=0,
        success_count=0,
        fail_count=0,
        model=req.model,
        size=None,
        params={
            "source": "storyboard_generate_from_final_script",
            "script_status": project_script.status,
            "episode_count_requested": req.episode_count,
            "split_mode": req.split_mode,
            "current_stage": "queued",
            "stage_label": _build_storyboard_task_stage_label("queued"),
            "status_message": _build_storyboard_task_status_message(stage="queued"),
            "overwrite_existing": True,
            "target_episode_ids": [],
            "queued_episode_numbers": [],
            "completed_episode_numbers": [],
            "failed_episode_numbers": [],
            "warning_messages": [],
        },
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.storyboards:_continue_generate_storyboards_from_final_script",
        kwargs={
            "task_id": task.id,
            "project_id": project_id,
            "user_id": user.id,
            "episode_count": req.episode_count,
            "model": req.model,
            "split_mode": req.split_mode,
        },
        name=f"storyboard_generate:{project_id}",
    )

    return _task_to_response(task)


# --- 单镜头图片生成 ---

class GenerateImageRequest(BaseModel):
    prompt: str | None = None
    model: str = "dall-e-3"
    size: str = "1024x1024"
    aspect_ratio: str | None = None
    aspectRatio: str | None = None
    resolution: str | None = None
    reference_images: list[str] | None = None
    referenceImages: list[str] | None = None
    count: int | None = None
    image_count: int | None = None
    imageCount: int | None = None

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1


@router.post(
    "/{storyboard_id}/generate-image",
    response_model=StoryboardGenerationTaskResponse,
    summary="生成分镜图",
    description="基于分镜描述、组合提示词和参考图创建分镜图片生成任务，前端需轮询任务完成后再刷新分镜。",
    response_description="新建的图片生成任务。",
)
async def generate_storyboard_image(
    project_id: str,
    storyboard_id: str,
    req: GenerateImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    prompt = _resolve_storyboard_generation_prompt(sb, req.prompt)
    if not prompt:
        raise HTTPException(status_code=400, detail="请提供生成提示词或先填写画面描述")

    enhanced_prompt = await append_visual_styles(prompt, [project.visual_style], user.id, db)
    requested_model = req.model or await _get_default_image_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="image",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    provider_runtime = await get_user_model_provider_runtime(
        user.id,
        db,
        category="image",
        requested_model=model,
    )
    if not provider_runtime:
        raise HTTPException(status_code=400, detail="未配置图片模型对应服务商，请先在设置中配置")
    api_key, base_url, _, model, _, _ = provider_runtime
    request_reference_images = _resolve_reference_images(req.model_dump())
    has_request_reference_images = (
        req.reference_images is not None or req.referenceImages is not None
    )
    reference_images = (
        request_reference_images
        if has_request_reference_images
        else list(sb.reference_image_urls or [])
    )
    requested_aspect_ratio = req.aspect_ratio or req.aspectRatio or project.aspect_ratio
    validated = validate_image_request(
        model=model,
        size=req.size,
        aspect_ratio=requested_aspect_ratio,
        resolution=req.resolution,
        count=req.resolved_count(),
        reference_images=reference_images,
    )
    reference_images = validated["reference_images"]
    generation_mode = _resolve_image_generation_mode(reference_images)

    task = GenTask(
        user_id=user.id,
        project_id=UUID(project_id),
        task_type="sb_image",
        status="pending",
        total_count=validated["count"],
        success_count=0,
        fail_count=0,
        model=model,
        size=validated["size"],
        params={
            "storyboard_id": str(sb.id),
            "episode_id": str(sb.episode_id) if sb.episode_id else None,
            "aspect_ratio": validated["aspect_ratio"],
            "resolution": validated["resolution"],
            "generation_mode": generation_mode,
            "count": validated["count"],
            "source": "storyboard_generate_image",
        },
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.storyboards:_run_storyboard_image_task",
        kwargs={
            "task_id": task.id,
            "user_id": user.id,
            "project_id": UUID(project_id),
            "storyboard_id": sb.id,
            "api_key": api_key,
            "base_url": base_url,
            "enhanced_prompt": enhanced_prompt,
            "model": model,
            "size": validated["size"],
            "aspect_ratio": validated["aspect_ratio"],
            "resolution": validated["resolution"],
            "reference_images": reference_images,
            "request_reference_images": request_reference_images,
            "generation_mode": generation_mode,
            "count": validated["count"],
        },
        name=f"gen-task:{task.id}:storyboard-image",
    )
    return _task_to_response(task)


@router.post(
    "/{storyboard_id}/upload-image",
    summary="上传分镜图",
    description="为指定分镜手动上传图片，并同步创建一条分镜图片资产记录。",
    response_description="更新后的分镜对象。",
)
async def upload_storyboard_image(
    project_id: str,
    storyboard_id: str,
    file: UploadFile = File(..., description="分镜图片文件，支持 jpg / png / webp，大小不超过 20MB。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    if file.size and file.size > MAX_STORYBOARD_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="图片大小不能超过 20MB")

    if file.content_type not in STORYBOARD_IMAGE_ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="仅支持 JPG、PNG、WEBP 格式")

    import uuid as uuid_lib

    upload_dir = resolve_upload_dir(f"storyboards/{project_id}")

    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"{uuid_lib.uuid4()}.{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    file_url = build_upload_url(f"storyboards/{project_id}", filename)

    sb.image_url = file_url
    derived_thumbnail_url, derivative_metadata = _derive_asset_thumbnail(
        file_url,
        asset_type="image",
    )
    derived_preview_url, preview_metadata = _derive_asset_preview(
        file_url,
        output_subdir=f"storyboards/{project_id}/derived/preview",
    )
    sb.gen_params = {
        **(sb.gen_params or {}),
        "thumbnail_url": derived_thumbnail_url,
        "preview_url": derived_preview_url or file_url,
        "download_url": file_url,
    }

    asset = Asset(
        user_id=user.id,
        project_id=UUID(project_id),
        name=f"分镜图 #{sb.shot_number}",
        asset_type="image",
        category="storyboard",
        file_url=file_url,
        thumbnail_url=derived_thumbnail_url,
        metadata_json=await _build_storyboard_asset_metadata(
            db,
            sb,
            extra={
                "preview_url": derived_preview_url or file_url,
                **derivative_metadata,
                **preview_metadata,
            },
        ),
    )
    db.add(asset)

    await db.commit()
    await db.refresh(sb)
    return _to_response(sb, image_asset=asset)


@router.post(
    "/{storyboard_id}/upload-video",
    response_model=StoryboardResponse,
    summary="上传分镜视频",
    description="为指定分镜手动上传视频，并同步创建一条分镜视频资产记录。",
    response_description="更新后的分镜对象。",
)
async def upload_storyboard_video(
    project_id: str,
    storyboard_id: str,
    file: UploadFile = File(..., description="分镜视频文件，支持 mp4 / webm / mov。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Storyboard).where(Storyboard.id == UUID(storyboard_id), Storyboard.project_id == UUID(project_id))
    )
    sb = result.scalar_one_or_none()
    if not sb:
        raise HTTPException(status_code=404, detail="分镜不存在")

    try:
        file_url = await persist_uploaded_file(
            file,
            f"storyboards/{project_id}/videos",
            allowed_extensions=STORYBOARD_VIDEO_ALLOWED_EXTENSIONS,
            allowed_content_types=STORYBOARD_VIDEO_ALLOWED_CONTENT_TYPES,
            max_size=MAX_STORYBOARD_VIDEO_SIZE,
            fallback_extension=".mp4",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    video_thumbnail_url = (
        (sb.gen_params or {}).get("video_thumbnail_url")
        or sb.image_url
    )
    video_thumbnail_url = pick_safe_thumbnail_url(video_thumbnail_url, sb.image_url)
    poster_bundle = await build_video_poster_bundle(
        video_url=file_url,
        fallback_thumbnail_url=video_thumbnail_url,
    )
    video_thumbnail_url = poster_bundle["poster_url"] or video_thumbnail_url
    derivative_metadata = poster_bundle["metadata_updates"]
    video_media = build_video_media_fields(
        file_url=file_url,
        thumbnail_url=video_thumbnail_url,
        metadata={
            "poster_url": video_thumbnail_url,
            "preview_video_url": file_url,
            "download_url": file_url,
            **derivative_metadata,
        },
        # 上传阶段视频文件已落盘，但对应资产记录尚未创建，不能提前引用 video_asset。
        # 先用当前请求上下文生成媒体字段，待资产创建并回显时再补齐正式 asset 语义。
        user_id=str(user.id),
        project_id=str(sb.project_id),
    )
    sb.video_url = file_url
    sb.gen_params = {
        **(sb.gen_params or {}),
        "video_thumbnail_url": video_media["poster_url"],
        "poster_url": video_media["poster_url"],
        "preview_video_url": video_media["preview_video_url"],
        "hls_url": video_media["hls_url"],
        "available_qualities": video_media["available_qualities"],
        "download_url": video_media["download_url"],
        **derivative_metadata,
    }

    original_filename = file.filename or f"分镜视频-{sb.shot_number}.mp4"
    asset = Asset(
        user_id=user.id,
        project_id=UUID(project_id),
        name=Path(original_filename).stem or f"分镜视频 #{sb.shot_number}",
        asset_type="video",
        category="storyboard",
        file_url=file_url,
        thumbnail_url=video_thumbnail_url,
        metadata_json=await _build_storyboard_asset_metadata(
            db,
            sb,
            extra={
                "thumbnail_url": video_media["poster_url"],
                "poster_url": video_media["poster_url"],
                "preview_video_url": video_media["preview_video_url"],
                "hls_url": video_media["hls_url"],
                "available_qualities": video_media["available_qualities"],
                "download_url": video_media["download_url"],
                "source": "storyboard_video_upload",
                "original_filename": original_filename,
                **derivative_metadata,
            },
        ),
    )
    db.add(asset)

    await db.commit()
    await db.refresh(sb)
    return _to_response(sb, video_asset=asset)
