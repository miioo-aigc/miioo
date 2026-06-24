from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider import ApiProvider
from app.services.http_client import (
    classify_upstream_error,
    log_upstream_failure,
    upstream_async_client,
)
from app.services.minimax_presets import MINIMAX_BASE_URL
from app.utils.encryption import decrypt_api_key
from app.utils.url_security import validate_outbound_url


@dataclass
class MiniMaxProviderRuntime:
    api_key: str
    base_url: str


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
    }


def _resolve_base_url(base_url: str | None) -> str:
    return validate_outbound_url(
        (base_url or "").strip() or MINIMAX_BASE_URL,
        label="MiniMax Base URL",
    )


def _extract_nested_value(data: Any, paths: tuple[str, ...]) -> Any:
    for path in paths:
        current = data
        matched = True
        for segment in path.split("."):
            if isinstance(current, dict) and segment in current:
                current = current[segment]
            else:
                matched = False
                break
        if matched:
            return current
    return None


def _parse_base_resp(data: dict[str, Any]) -> dict[str, Any]:
    return data.get("base_resp") or data.get("baseResp") or {}


def _extract_trace_id(data: dict[str, Any]) -> str | None:
    trace_id = data.get("trace_id") or data.get("traceId")
    if trace_id is None:
        return None
    normalized = str(trace_id).strip()
    return normalized or None


def _ensure_minimax_success(data: dict[str, Any], default_message: str) -> None:
    base_resp = _parse_base_resp(data)
    status_code = base_resp.get("status_code", 0)
    if status_code not in (0, "0", None):
        raise ValueError(base_resp.get("status_msg") or default_message)


def _raise_minimax_upstream_error(exc: Exception, message: str) -> None:
    log_upstream_failure(
        profile="provider",
        operation="minimax_voice_runtime",
        exc=exc,
        context={"message": message},
    )
    detail = classify_upstream_error(exc)
    status_code = detail.get("status_code")
    suffix = f" (category={detail['category']}, status={status_code})" if status_code is not None else f" (category={detail['category']})"
    raise ValueError(f"{message}{suffix}") from exc


def _audio_content_type(audio_format: str | None) -> str:
    normalized_format = str(audio_format or "mp3").strip().lower()
    return {
        "mp3": "audio/mpeg",
        "mpeg": "audio/mpeg",
        "wav": "audio/wav",
        "pcm": "audio/L16",
        "ogg": "audio/ogg",
        "opus": "audio/ogg",
        "flac": "audio/flac",
    }.get(normalized_format, "audio/mpeg")


def _build_audio_data_uri_from_hex(encoded_audio: str, audio_format: str | None) -> str:
    normalized_audio = re.sub(r"\s+", "", str(encoded_audio or "").strip())
    if not normalized_audio:
        raise ValueError("MiniMax 语音接口未返回音频数据")
    if normalized_audio.startswith(("data:", "http://", "https://", "/uploads/")):
        return normalized_audio
    try:
        audio_bytes = bytes.fromhex(normalized_audio)
    except ValueError as exc:
        raise ValueError("MiniMax 返回的音频不是合法 hex 编码") from exc
    return (
        f"data:{_audio_content_type(audio_format)};base64,"
        f"{base64.b64encode(audio_bytes).decode('ascii')}"
    )


def _coerce_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        return datetime.fromisoformat(text)
    except Exception:
        return None


def infer_clone_expires_at(payload: dict[str, Any] | None) -> datetime | None:
    data = payload or {}
    expires_at = _extract_nested_value(
        data,
        (
            "expires_at",
            "expired_at",
            "data.expires_at",
            "data.expired_at",
            "voice.expires_at",
            "voice.expired_at",
        ),
    )
    parsed = _coerce_datetime(expires_at)
    if parsed:
        return parsed
    created_at = _coerce_datetime(
        _extract_nested_value(
            data,
            (
                "created_at",
                "data.created_at",
                "voice.created_at",
            ),
        )
    )
    if created_at:
        return created_at + timedelta(days=7)
    return datetime.now(timezone.utc) + timedelta(days=7)


async def get_minimax_provider_runtime(user_id, db: AsyncSession) -> MiniMaxProviderRuntime | None:
    result = await db.execute(
        select(ApiProvider).where(
            and_(
                ApiProvider.user_id == user_id,
                ApiProvider.provider_type == "minimax",
                ApiProvider.is_enabled == True,
            )
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        return None

    api_key = decrypt_api_key(provider.api_key_encrypted)
    if not api_key or "*" in api_key:
        raise ValueError("MiniMax API Key 不可用，请在 API 配置中重新填写真实 Key")
    return MiniMaxProviderRuntime(
        api_key=api_key,
        base_url=_resolve_base_url(provider.base_url),
    )


async def upload_minimax_file(
    runtime: MiniMaxProviderRuntime,
    *,
    file_name: str,
    file_bytes: bytes,
    purpose: str = "voice_clone",
    content_type: str = "audio/mpeg",
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/files/upload"
    files = {
        "file": (file_name, file_bytes, content_type),
    }
    data = {
        "purpose": purpose,
    }
    try:
        async with upstream_async_client(profile="provider", timeout=120.0) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {runtime.api_key}"},
                data=data,
                files=files,
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        _raise_minimax_upstream_error(exc, "MiniMax 文件上传失败")
    _ensure_minimax_success(payload, "MiniMax 文件上传失败")
    file_id = _extract_nested_value(payload, ("file.file_id", "file_id", "data.file_id"))
    if not file_id:
        raise ValueError("MiniMax 文件上传成功但未返回 file_id")
    return payload


async def generate_minimax_tts(
    runtime: MiniMaxProviderRuntime,
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/t2a_v2"
    try:
        async with upstream_async_client(profile="provider", timeout=120.0) as client:
            response = await client.post(
                url,
                headers={
                    **_headers(runtime.api_key),
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
    except Exception as exc:
        _raise_minimax_upstream_error(exc, "MiniMax 同步配音失败")
    _ensure_minimax_success(result, "MiniMax 同步配音失败")
    return result


def extract_minimax_tts_result(payload: dict[str, Any], text: str) -> dict[str, Any]:
    data = payload.get("data") or {}
    extra_info = payload.get("extra_info") or {}
    audio_hex = data.get("audio") or ""
    audio_length = extra_info.get("audio_length")
    duration = len(text) * 0.3
    if isinstance(audio_length, (int, float)) and audio_length > 0:
        duration = float(audio_length) / 1000.0
    return {
        "url": _build_audio_data_uri_from_hex(audio_hex, extra_info.get("audio_format")),
        "duration": duration,
        "metadata": {
            "trace_id": _extract_trace_id(payload),
            "status": data.get("status"),
            "extra_info": extra_info,
            "base_resp": _parse_base_resp(payload),
        },
        "raw_payload": payload,
    }


async def clone_minimax_voice(
    runtime: MiniMaxProviderRuntime,
    *,
    source_file_id: str,
    target_voice_id: str,
    prompt_file_id: str | None = None,
    prompt_text: str | None = None,
    text: str | None = None,
    model: str | None = None,
    language_boost: str | None = None,
    need_noise_reduction: bool | None = None,
    need_volume_normalization: bool | None = None,
    aigc_watermark: bool | None = None,
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/voice_clone"
    payload: dict[str, Any] = {
        "file_id": source_file_id,
        "voice_id": target_voice_id,
    }
    if prompt_file_id:
        payload["clone_prompt"] = {
            "prompt_audio": prompt_file_id,
            "prompt_text": prompt_text or "",
        }
    if text:
        payload["text"] = text
    if model:
        payload["model"] = model
    if language_boost:
        payload["language_boost"] = language_boost
    if need_noise_reduction is not None:
        payload["need_noise_reduction"] = need_noise_reduction
    if need_volume_normalization is not None:
        payload["need_volume_normalization"] = need_volume_normalization
    if aigc_watermark is not None:
        payload["aigc_watermark"] = aigc_watermark
    async with upstream_async_client(profile="provider", timeout=120.0) as client:
        response = await client.post(
            url,
            headers={
                **_headers(runtime.api_key),
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    _ensure_minimax_success(result, "MiniMax 音色复刻失败")
    return result


async def design_minimax_voice(
    runtime: MiniMaxProviderRuntime,
    *,
    prompt: str,
    preview_text: str,
    voice_id: str | None = None,
    aigc_watermark: bool | None = None,
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/voice_design"
    payload: dict[str, Any] = {
        "prompt": prompt,
        "preview_text": preview_text,
    }
    if voice_id:
        payload["voice_id"] = voice_id
    if aigc_watermark is not None:
        payload["aigc_watermark"] = aigc_watermark
    async with upstream_async_client(profile="provider", timeout=60.0) as client:
        response = await client.post(
            url,
            headers={
                **_headers(runtime.api_key),
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    _ensure_minimax_success(result, "MiniMax 音色设计失败")
    return result


def extract_minimax_voice_design_result(payload: dict[str, Any]) -> dict[str, Any]:
    voice_id = _extract_nested_value(payload, ("voice_id", "data.voice_id"))
    if not voice_id:
        raise ValueError("MiniMax 音色设计成功但未返回 voice_id")
    trial_audio = _extract_nested_value(payload, ("trial_audio", "data.trial_audio"))
    return {
        "voice_id": str(voice_id).strip(),
        "trial_audio_url": (
            _build_audio_data_uri_from_hex(trial_audio, "mp3")
            if str(trial_audio or "").strip()
            else None
        ),
        "raw_payload": payload,
    }


async def query_minimax_voices(
    runtime: MiniMaxProviderRuntime,
    *,
    voice_type: str,
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/get_voice"
    payload = {"voice_type": voice_type}
    async with upstream_async_client(profile="provider", timeout=60.0) as client:
        response = await client.post(
            url,
            headers={
                **_headers(runtime.api_key),
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    _ensure_minimax_success(result, "获取 MiniMax 音色信息失败")
    return result


def normalize_minimax_voice_query_result(payload: dict[str, Any]) -> list[dict[str, Any]]:
    voices: list[dict[str, Any]] = []
    for voice in payload.get("system_voice") or []:
        voice_id = str(voice.get("voice_id") or "").strip()
        if not voice_id:
            continue
        descriptions = voice.get("description") or []
        voices.append(
            {
                "voice_id": voice_id,
                "name": str(voice.get("voice_name") or voice_id).strip() or voice_id,
                "description": descriptions if isinstance(descriptions, list) else [],
                "created_time": voice.get("created_time"),
                "voice_type": "system",
                "provider": "minimax",
                "is_custom": False,
                "source_label": "MiniMax 官方系统音色",
            }
        )
    for voice_type_key in ("voice_cloning", "voice_generation"):
        for voice in payload.get(voice_type_key) or []:
            voice_id = str(voice.get("voice_id") or "").strip()
            if not voice_id:
                continue
            descriptions = voice.get("description") or []
            voices.append(
                {
                    "voice_id": voice_id,
                    "name": voice_id,
                    "description": descriptions if isinstance(descriptions, list) else [],
                    "created_time": voice.get("created_time"),
                    "voice_type": voice_type_key,
                    "provider": "minimax",
                    "is_custom": True,
                    "source_label": "MiniMax 私有音色",
                }
            )
    return voices


def extract_minimax_clone_result(payload: dict[str, Any], fallback_voice_id: str) -> dict[str, Any]:
    resolved_voice_id = _extract_nested_value(
        payload,
        (
            "voice_id",
            "data.voice_id",
            "voice.voice_id",
            "voice_id_list.0",
        ),
    ) or fallback_voice_id
    preview_url = _extract_nested_value(
        payload,
        (
            "preview_url",
            "data.preview_url",
            "voice.preview_url",
        ),
    )
    return {
        "voice_id": str(resolved_voice_id).strip() or fallback_voice_id,
        "preview_url": preview_url,
        "expires_at": infer_clone_expires_at(payload),
        "trace_id": _extract_trace_id(payload),
        "raw_payload": payload,
    }


async def create_minimax_async_tts_task(
    runtime: MiniMaxProviderRuntime,
    payload: dict[str, Any],
) -> dict[str, Any]:
    url = f"{runtime.base_url.rstrip('/')}/v1/t2a_async_v2"
    async with upstream_async_client(profile="provider", timeout=120.0) as client:
        response = await client.post(
            url,
            headers={
                **_headers(runtime.api_key),
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        result = response.json()
    _ensure_minimax_success(result, "MiniMax 异步配音任务创建失败")
    return result


async def query_minimax_async_tts_task(
    runtime: MiniMaxProviderRuntime,
    task_id: str,
) -> dict[str, Any]:
    safe_task_id = str(task_id or "").strip()
    if not safe_task_id:
        raise ValueError("缺少 MiniMax task_id")
    url = f"{runtime.base_url.rstrip('/')}/v1/query/t2a_async_query_v2"
    async with upstream_async_client(profile="provider", timeout=60.0) as client:
        response = await client.get(
            url,
            headers=_headers(runtime.api_key),
            params={"task_id": safe_task_id},
        )
        response.raise_for_status()
        result = response.json()
    _ensure_minimax_success(result, "查询 MiniMax 异步配音任务失败")
    return result


async def download_minimax_file_content(
    runtime: MiniMaxProviderRuntime,
    file_id: str,
) -> tuple[bytes, str | None]:
    safe_file_id = str(file_id or "").strip()
    if not safe_file_id:
        raise ValueError("缺少 MiniMax file_id")
    url = f"{runtime.base_url.rstrip('/')}/v1/files/retrieve_content"
    async with upstream_async_client(profile="provider", timeout=120.0) as client:
        response = await client.get(
            url,
            headers=_headers(runtime.api_key),
            params={"file_id": safe_file_id},
        )
        response.raise_for_status()
        return response.content, response.headers.get("content-type")


def normalize_minimax_async_status(payload: dict[str, Any]) -> str:
    raw_status = _extract_nested_value(
        payload,
        (
            "status",
            "data.status",
            "task.status",
            "task_result.status",
        ),
    )
    status = str(raw_status or "").strip().lower()
    if status in {"success", "succeeded", "completed", "finished"}:
        return "completed"
    if status in {"failed", "error", "expired", "canceled", "cancelled"}:
        return "failed" if status != "expired" else "expired"
    if status in {"processing", "pending", "running", "queued"}:
        return "processing"
    return status or "processing"


def extract_minimax_async_audio_result(payload: dict[str, Any]) -> dict[str, Any]:
    audio_url = _extract_nested_value(
        payload,
        (
            "audio_file.url",
            "audio_url",
            "data.audio_url",
            "data.audio_file.url",
            "result.audio_url",
        ),
    )
    file_id = _extract_nested_value(
        payload,
        (
            "file_id",
            "data.file_id",
            "audio_file.file_id",
        ),
    )
    task_token = _extract_nested_value(payload, ("task_token", "data.task_token"))
    return {
        "audio_url": audio_url,
        "file_id": file_id,
        "task_token": task_token,
        "status": normalize_minimax_async_status(payload),
        "trace_id": _extract_trace_id(payload),
        "raw_payload": payload,
    }


def dumps_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)
