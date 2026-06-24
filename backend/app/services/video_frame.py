import asyncio
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.services.media_storage import build_upload_url, resolve_upload_dir, resolve_upload_path

EXTRACTED_FRAME_SUBDIR = "assets/extracted-frames"
LAST_FRAME_EPSILON_SECONDS = 0.1


@dataclass(frozen=True)
class ExtractedVideoFrame:
    frame_url: str
    frame_position: Literal["first", "last"]
    duration: float | None = None


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
        raise RuntimeError(f"未检测到 {name}，请先安装后再使用视频提帧能力")
    return binary


async def _probe_duration(source_path: Path) -> float | None:
    ffprobe = _require_binary("ffprobe")
    output = await _run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(source_path),
        ]
    )
    if not output:
        return None
    try:
        duration = float(output)
    except ValueError:
        return None
    return duration if duration > 0 else None


def _resolve_seek_seconds(position: Literal["first", "last"], duration: float | None) -> float:
    if position == "first":
        return 0.0
    if not duration or duration <= 0:
        return 0.0
    return max(duration - LAST_FRAME_EPSILON_SECONDS, 0.0)


async def extract_video_frame(
    video_url: str,
    position: Literal["first", "last"],
) -> ExtractedVideoFrame:
    if position not in {"first", "last"}:
        raise ValueError("提帧位置仅支持 first 或 last")

    ffmpeg = _require_binary("ffmpeg")
    source_path = resolve_upload_path(video_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"视频文件不存在: {video_url}")

    duration = await _probe_duration(source_path)
    seek_seconds = _resolve_seek_seconds(position, duration)

    output_dir = resolve_upload_dir(EXTRACTED_FRAME_SUBDIR)
    filename = f"{uuid.uuid4().hex}.png"
    output_path = output_dir / filename

    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source_path),
        "-ss",
        f"{seek_seconds:.3f}",
        "-frames:v",
        "1",
        str(output_path),
    ]
    await _run_command(command)

    if not output_path.exists() or not output_path.is_file():
        raise RuntimeError("提帧失败，未生成图片文件")

    return ExtractedVideoFrame(
        frame_url=build_upload_url(EXTRACTED_FRAME_SUBDIR, filename),
        frame_position=position,
        duration=duration,
    )
