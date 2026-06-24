import asyncio
import json
import logging
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.services.media_storage import (
    _extract_private_upload_url,
    build_upload_url,
    is_managed_upload_url,
    resolve_upload_dir,
    resolve_upload_path,
)

REFERENCE_VIDEO_MAX_WIDTH = 1920
REFERENCE_VIDEO_MAX_HEIGHT = 1080
REFERENCE_VIDEO_MAX_PIXELS = 2086876
# Seedance 2.0 r2v 要求参考视频总时长 <= 15.2s，留 0.2s 安全余量。
REFERENCE_VIDEO_MAX_DURATION_SECONDS = 15.0
COMPRESSED_REFERENCE_VIDEO_SUBDIR = "runtime/reference-videos"

logger = logging.getLogger(__name__)


class MissingBinaryError(RuntimeError):
    """Raised when ffmpeg/ffprobe is not installed on the runtime host."""


@dataclass(frozen=True)
class PreparedReferenceVideo:
    url: str
    compressed: bool
    trimmed: bool = False
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None


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
        raise MissingBinaryError(f"未检测到 {name}，无法自动压缩参考视频")
    return binary


async def _probe_video_metadata(
    source_path: Path,
) -> tuple[int | None, int | None, float | None]:
    ffprobe = _require_binary("ffprobe")
    output = await _run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height:format=duration",
            "-of",
            "json",
            str(source_path),
        ]
    )
    if not output:
        return None, None, None
    data = json.loads(output)
    streams = data.get("streams") if isinstance(data, dict) else None
    if not streams or not isinstance(streams, list):
        return None, None, None
    stream = streams[0] if isinstance(streams[0], dict) else {}
    width = stream.get("width")
    height = stream.get("height")

    duration: float | None = None
    formats = data.get("format") if isinstance(data, dict) else None
    if isinstance(formats, dict):
        raw_duration = formats.get("duration")
        if isinstance(raw_duration, (int, float)) and raw_duration > 0:
            duration = float(raw_duration)
        elif isinstance(raw_duration, str):
            try:
                parsed = float(raw_duration.strip())
            except ValueError:
                parsed = 0.0
            if parsed > 0:
                duration = parsed

    return (
        int(width) if isinstance(width, (int, float)) and width > 0 else None,
        int(height) if isinstance(height, (int, float)) and height > 0 else None,
        duration,
    )


def _needs_compression(width: int | None, height: int | None) -> bool:
    if not width or not height:
        return False
    if width > REFERENCE_VIDEO_MAX_WIDTH or height > REFERENCE_VIDEO_MAX_HEIGHT:
        return True
    return width * height > REFERENCE_VIDEO_MAX_PIXELS


def _needs_trim(duration_seconds: float | None) -> bool:
    if duration_seconds is None:
        return False
    return duration_seconds > REFERENCE_VIDEO_MAX_DURATION_SECONDS


def _format_duration_hint(duration_seconds: float | None) -> str:
    if duration_seconds is None:
        return "未知"
    return f"{duration_seconds:.1f}s"


async def _transcode_reference_video(
    source_path: Path,
    *,
    trim: bool,
    compress: bool,
) -> str:
    ffmpeg = _require_binary("ffmpeg")
    output_dir = resolve_upload_dir(COMPRESSED_REFERENCE_VIDEO_SUBDIR)
    filename = f"{uuid.uuid4().hex}.mp4"
    output_path = output_dir / filename

    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source_path),
    ]
    if trim:
        command.extend(["-t", str(REFERENCE_VIDEO_MAX_DURATION_SECONDS)])
    command.extend(["-map", "0:v:0", "-map", "0:a?"])
    if compress:
        command.extend(
            [
                "-vf",
                (
                    f"scale=w='min({REFERENCE_VIDEO_MAX_WIDTH},iw)':"
                    f"h='min({REFERENCE_VIDEO_MAX_HEIGHT},ih)':"
                    "force_original_aspect_ratio=decrease,setsar=1"
                ),
            ]
        )
    command.extend(
        [
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ac",
            "2",
            str(output_path),
        ]
    )
    await _run_command(command)

    if not output_path.exists() or not output_path.is_file():
        raise RuntimeError("参考视频处理失败，未生成输出文件")

    return build_upload_url(COMPRESSED_REFERENCE_VIDEO_SUBDIR, filename)


async def prepare_local_reference_video_for_upstream(url: str | None) -> PreparedReferenceVideo:
    cleaned = str(url or "").strip()
    if not cleaned:
        raise ValueError("参考视频地址不能为空")

    local_upload_url = None
    if is_managed_upload_url(cleaned):
        local_upload_url = cleaned
    else:
        local_upload_url = _extract_private_upload_url(cleaned)

    # 仅对本地 / 私网托管参考视频做自动压缩；公网素材继续沿用原地址。
    if not local_upload_url:
        return PreparedReferenceVideo(url=cleaned, compressed=False)

    source_path = resolve_upload_path(local_upload_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"参考视频文件不存在: {cleaned}")

    try:
        width, height, duration_seconds = await _probe_video_metadata(source_path)
    except MissingBinaryError as exc:
        logger.warning(
            "Skip reference video probe/transcode because ffprobe is unavailable: %s",
            exc,
        )
        return PreparedReferenceVideo(url=local_upload_url, compressed=False)

    needs_trim = _needs_trim(duration_seconds)
    needs_compress = _needs_compression(width, height)

    if not needs_trim and not needs_compress:
        return PreparedReferenceVideo(
            url=local_upload_url,
            compressed=False,
            trimmed=False,
            width=width,
            height=height,
            duration_seconds=duration_seconds,
        )

    if needs_trim:
        try:
            _require_binary("ffmpeg")
        except MissingBinaryError as exc:
            raise ValueError(
                "参考视频时长超出 Seedance 全能参考上限（"
                f"{REFERENCE_VIDEO_MAX_DURATION_SECONDS:g}s），当前约 "
                f"{_format_duration_hint(duration_seconds)}。"
                "云端未安装 ffmpeg，无法自动裁剪，请上传不超过 15 秒的参考视频，"
                "或在服务器安装 ffmpeg 后重试。"
            ) from exc

    try:
        processed_url = await _transcode_reference_video(
            source_path,
            trim=needs_trim,
            compress=needs_compress,
        )
    except MissingBinaryError as exc:
        if needs_trim:
            raise ValueError(
                "参考视频时长超出 Seedance 全能参考上限（"
                f"{REFERENCE_VIDEO_MAX_DURATION_SECONDS:g}s），当前约 "
                f"{_format_duration_hint(duration_seconds)}。"
                "云端未安装 ffmpeg，无法自动裁剪，请上传不超过 15 秒的参考视频。"
            ) from exc
        logger.warning(
            "Skip oversized reference video compression because ffmpeg is unavailable: %s",
            exc,
        )
        return PreparedReferenceVideo(
            url=local_upload_url,
            compressed=False,
            trimmed=False,
            width=width,
            height=height,
            duration_seconds=duration_seconds,
        )

    return PreparedReferenceVideo(
        url=processed_url,
        compressed=needs_compress,
        trimmed=needs_trim,
        width=width,
        height=height,
        duration_seconds=duration_seconds,
    )
