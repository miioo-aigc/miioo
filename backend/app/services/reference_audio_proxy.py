import asyncio
import json
import shutil
from pathlib import Path

from app.services.media_storage import _extract_private_upload_url, is_managed_upload_url, resolve_upload_path

REFERENCE_AUDIO_MAX_DURATION_SECONDS = 15.2


class MissingBinaryError(RuntimeError):
    """Raised when ffprobe is not installed on the runtime host."""


async def _run_command(command: list[str]) -> str:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        error_text = stderr.decode().strip() or stdout.decode().strip() or "未知错误"
        raise RuntimeError(error_text)
    return stdout.decode().strip()


def _require_binary(name: str) -> str:
    binary = shutil.which(name)
    if not binary:
        raise MissingBinaryError(f"未检测到 {name}，无法探测参考音频时长")
    return binary


async def _probe_audio_duration(source_path: Path) -> float | None:
    ffprobe = _require_binary("ffprobe")
    output = await _run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(source_path),
        ]
    )
    if not output:
        return None
    data = json.loads(output)
    formats = data.get("format") if isinstance(data, dict) else None
    if not isinstance(formats, dict):
        return None
    raw_duration = formats.get("duration")
    if isinstance(raw_duration, (int, float)) and raw_duration > 0:
        return float(raw_duration)
    if isinstance(raw_duration, str):
        try:
            parsed = float(raw_duration.strip())
        except ValueError:
            return None
        return parsed if parsed > 0 else None
    return None


def _normalize_duration(duration_seconds: float | int | str | None) -> float | None:
    if duration_seconds is None:
        return None
    try:
        parsed = float(duration_seconds)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _format_duration_hint(duration_seconds: float | None) -> str:
    if duration_seconds is None:
        return "未知"
    return f"{duration_seconds:.1f}s"


def _resolve_local_audio_path(url: str | None) -> Path | None:
    cleaned = str(url or "").strip()
    if not cleaned:
        return None
    local_upload_url = cleaned if is_managed_upload_url(cleaned) else _extract_private_upload_url(cleaned)
    if not local_upload_url:
        return None
    return resolve_upload_path(local_upload_url)


async def probe_reference_audio_duration(url: str | None) -> float | None:
    source_path = _resolve_local_audio_path(url)
    if not source_path:
        return None
    if not source_path.exists() or not source_path.is_file():
        return None
    return await _probe_audio_duration(source_path)


async def validate_seedance_reference_audio_duration(
    url: str | None,
    *,
    known_duration_seconds: float | int | str | None = None,
    media_label: str = "参考音频",
) -> float | None:
    duration_seconds = _normalize_duration(known_duration_seconds)
    if duration_seconds is None:
        try:
            duration_seconds = await probe_reference_audio_duration(url)
        except MissingBinaryError:
            return None
    if duration_seconds is None:
        return None
    if duration_seconds > REFERENCE_AUDIO_MAX_DURATION_SECONDS:
        raise ValueError(
            f"{media_label}时长超过 Seedance 上限 {REFERENCE_AUDIO_MAX_DURATION_SECONDS:g} 秒，"
            f"当前约 {_format_duration_hint(duration_seconds)}。请裁短到 15 秒内后重试"
        )
    return duration_seconds
