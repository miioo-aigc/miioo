from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.services.media_storage import build_upload_url, resolve_upload_dir, resolve_upload_path

VIDEO_PREVIEW_SUBDIR = "derived/assets/video-preview"
VIDEO_PREVIEW_MAX_WIDTH = 1280
VIDEO_PREVIEW_MAX_HEIGHT = 720
VIDEO_PREVIEW_VIDEO_BITRATE = "1200k"
VIDEO_PREVIEW_AUDIO_BITRATE = "96k"
VIDEO_PREVIEW_CRF = "30"
VIDEO_PREVIEW_PROFILE = "video_preview_mp4_v1"
VIDEO_PREVIEW_CODEC = "h264_aac_mp4"


@dataclass(frozen=True)
class GeneratedVideoPreview:
    preview_url: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    codec: str = VIDEO_PREVIEW_CODEC
    bitrate: str = VIDEO_PREVIEW_VIDEO_BITRATE
    profile: str = VIDEO_PREVIEW_PROFILE


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
        raise RuntimeError(f"未检测到 {name}，请先安装后再使用视频轻量预览转码能力")
    return binary


async def _probe_video_stream_metadata(
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
    stream = streams[0] if isinstance(streams, list) and streams and isinstance(streams[0], dict) else {}
    width = stream.get("width")
    height = stream.get("height")

    duration: float | None = None
    format_data = data.get("format") if isinstance(data, dict) else None
    if isinstance(format_data, dict):
        raw_duration = format_data.get("duration")
        if isinstance(raw_duration, (int, float)) and raw_duration > 0:
            duration = float(raw_duration)
        elif isinstance(raw_duration, str):
            try:
                parsed_duration = float(raw_duration.strip())
            except ValueError:
                parsed_duration = 0.0
            if parsed_duration > 0:
                duration = parsed_duration

    return (
        int(width) if isinstance(width, (int, float)) and width > 0 else None,
        int(height) if isinstance(height, (int, float)) and height > 0 else None,
        duration,
    )


async def generate_video_preview(video_url: str) -> GeneratedVideoPreview:
    cleaned_video_url = str(video_url or "").strip()
    if not cleaned_video_url:
        raise ValueError("视频地址不能为空")

    source_path = resolve_upload_path(cleaned_video_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"视频文件不存在: {cleaned_video_url}")

    ffmpeg = _require_binary("ffmpeg")
    width, height, duration = await _probe_video_stream_metadata(source_path)

    output_dir = resolve_upload_dir(VIDEO_PREVIEW_SUBDIR)
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
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        (
            f"scale=w='min({VIDEO_PREVIEW_MAX_WIDTH},iw)':"
            f"h='min({VIDEO_PREVIEW_MAX_HEIGHT},ih)':"
            "force_original_aspect_ratio=decrease,setsar=1"
        ),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        VIDEO_PREVIEW_CRF,
        "-maxrate",
        VIDEO_PREVIEW_VIDEO_BITRATE,
        "-bufsize",
        "2400k",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        VIDEO_PREVIEW_AUDIO_BITRATE,
        "-ac",
        "2",
        str(output_path),
    ]
    await _run_command(command)

    if not output_path.exists() or not output_path.is_file():
        raise RuntimeError("视频轻量预览转码失败，未生成输出文件")

    preview_url = build_upload_url(VIDEO_PREVIEW_SUBDIR, filename)
    return GeneratedVideoPreview(
        preview_url=preview_url,
        width=width,
        height=height,
        duration=duration,
    )
