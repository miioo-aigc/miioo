from __future__ import annotations

import asyncio
import json
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.services.media_storage import build_upload_url, resolve_upload_dir, resolve_upload_path

VIDEO_HLS_SUBDIR = "derived/assets/video-hls"
VIDEO_HLS_MAX_WIDTH = 1280
VIDEO_HLS_MAX_HEIGHT = 720
VIDEO_HLS_VIDEO_MAXRATE = 1800000
VIDEO_HLS_AUDIO_BITRATE = 128000
VIDEO_HLS_SEGMENT_DURATION_SECONDS = 6
VIDEO_HLS_CRF = "24"


@dataclass(frozen=True)
class GeneratedVideoHls:
    hls_url: str
    hls_master_playlist: str
    available_qualities: list[dict[str, object]]
    variant_count: int
    default_quality: str
    width: int | None = None
    height: int | None = None


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
        raise RuntimeError(f"未检测到 {name}，请先安装后再使用视频 HLS 打包能力")
    return binary


async def _probe_video_stream_metadata(
    source_path: Path,
) -> tuple[int | None, int | None]:
    ffprobe = _require_binary("ffprobe")
    output = await _run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(source_path),
        ]
    )
    if not output:
        return None, None

    data = json.loads(output)
    streams = data.get("streams") if isinstance(data, dict) else None
    stream = streams[0] if isinstance(streams, list) and streams and isinstance(streams[0], dict) else {}
    width = stream.get("width")
    height = stream.get("height")
    return (
        int(width) if isinstance(width, (int, float)) and width > 0 else None,
        int(height) if isinstance(height, (int, float)) and height > 0 else None,
    )


def _resolve_scaled_dimensions(
    width: int | None,
    height: int | None,
) -> tuple[int | None, int | None]:
    if not width or not height:
        return None, None

    scale_ratio = min(
        VIDEO_HLS_MAX_WIDTH / width,
        VIDEO_HLS_MAX_HEIGHT / height,
        1.0,
    )
    scaled_width = max(int(width * scale_ratio), 2)
    scaled_height = max(int(height * scale_ratio), 2)

    if scaled_width % 2 != 0:
        scaled_width -= 1
    if scaled_height % 2 != 0:
        scaled_height -= 1

    return scaled_width or None, scaled_height or None


def _build_master_playlist_content(
    *,
    variant_filename: str,
    bandwidth: int,
    width: int | None,
    height: int | None,
) -> str:
    stream_inf_parts = [
        f"BANDWIDTH={bandwidth}",
        f"AVERAGE-BANDWIDTH={bandwidth}",
        'CODECS="avc1.64001f,mp4a.40.2"',
    ]
    if width and height:
        stream_inf_parts.append(f"RESOLUTION={width}x{height}")
    stream_inf = ",".join(stream_inf_parts)
    return "\n".join(
        [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            f"#EXT-X-STREAM-INF:{stream_inf}",
            variant_filename,
            "",
        ]
    )


def _resolve_quality_label(height: int | None) -> str:
    if height and height > 0:
        return f"{height}p"
    return "source"


async def generate_video_hls(video_url: str) -> GeneratedVideoHls:
    cleaned_video_url = str(video_url or "").strip()
    if not cleaned_video_url:
        raise ValueError("视频地址不能为空")

    source_path = resolve_upload_path(cleaned_video_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"视频文件不存在: {cleaned_video_url}")

    ffmpeg = _require_binary("ffmpeg")
    source_width, source_height = await _probe_video_stream_metadata(source_path)
    output_width, output_height = _resolve_scaled_dimensions(source_width, source_height)
    quality_label = _resolve_quality_label(output_height or source_height)

    folder_name = uuid.uuid4().hex
    output_dir = resolve_upload_dir(f"{VIDEO_HLS_SUBDIR}/{folder_name}")
    variant_filename = f"stream_{quality_label}.m3u8"
    master_filename = "master.m3u8"
    segment_pattern = str(output_dir / "segment_%03d.ts")
    variant_playlist_path = output_dir / variant_filename
    master_playlist_path = output_dir / master_filename

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
            f"scale=w={VIDEO_HLS_MAX_WIDTH}:h={VIDEO_HLS_MAX_HEIGHT}:"
            "force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1"
        ),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        VIDEO_HLS_CRF,
        "-maxrate",
        f"{VIDEO_HLS_VIDEO_MAXRATE}",
        "-bufsize",
        f"{VIDEO_HLS_VIDEO_MAXRATE * 2}",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        f"{VIDEO_HLS_AUDIO_BITRATE}",
        "-ac",
        "2",
        "-f",
        "hls",
        "-hls_time",
        str(VIDEO_HLS_SEGMENT_DURATION_SECONDS),
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        segment_pattern,
        str(variant_playlist_path),
    ]
    await _run_command(command)

    if not variant_playlist_path.exists() or not variant_playlist_path.is_file():
        raise RuntimeError("视频 HLS 打包失败，未生成变体播放列表")

    bandwidth = VIDEO_HLS_VIDEO_MAXRATE + VIDEO_HLS_AUDIO_BITRATE
    master_playlist_path.write_text(
        _build_master_playlist_content(
            variant_filename=variant_filename,
            bandwidth=bandwidth,
            width=output_width,
            height=output_height,
        ),
        encoding="utf-8",
    )

    master_playlist_url = build_upload_url(f"{VIDEO_HLS_SUBDIR}/{folder_name}", master_filename)
    variant_playlist_url = build_upload_url(f"{VIDEO_HLS_SUBDIR}/{folder_name}", variant_filename)
    available_qualities = [
        {
            "id": quality_label,
            "label": quality_label,
            "bandwidth": bandwidth,
            "width": output_width,
            "height": output_height or source_height,
            "default": True,
            "playlist_url": variant_playlist_url,
        }
    ]
    return GeneratedVideoHls(
        hls_url=master_playlist_url,
        hls_master_playlist=master_playlist_url,
        available_qualities=available_qualities,
        variant_count=1,
        default_quality=quality_label,
        width=output_width,
        height=output_height or source_height,
    )
