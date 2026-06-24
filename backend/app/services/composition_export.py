import asyncio
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.composition import Composition
from app.models.storyboard import Storyboard
from app.models.video_clip import VideoClip
from app.services.asset_recycle import apply_asset_visibility
from app.services.http_client import upstream_async_client
from app.services.media_storage import get_upload_root, is_managed_upload_url
from app.utils.url_security import validate_outbound_url

SUPPORTED_TIMELINE_TYPES = {"image", "audio", "video"}
DEFAULT_FPS = 30
DEFAULT_AUDIO_SAMPLE_RATE = 44100
TIME_EPSILON = 0.05

RESOLUTION_PRESETS: dict[tuple[str, str], tuple[int, int]] = {
    ("720p", "16:9"): (1280, 720),
    ("720p", "9:16"): (720, 1280),
    ("720p", "1:1"): (720, 720),
    ("1080p", "16:9"): (1920, 1080),
    ("1080p", "9:16"): (1080, 1920),
    ("1080p", "1:1"): (1080, 1080),
    ("4k", "16:9"): (3840, 2160),
    ("4k", "9:16"): (2160, 3840),
    ("4k", "1:1"): (2160, 2160),
}


@dataclass(frozen=True)
class TimelineItem:
    type: str
    clip_id: uuid.UUID
    start: float
    duration: float
    track: str

    @property
    def end(self) -> float:
        return self.start + self.duration


@dataclass(frozen=True)
class TimelineSource:
    item: TimelineItem
    source_url: str
    source_name: str
    source_duration: float | None = None


@dataclass(frozen=True)
class ExportPlan:
    items: list[TimelineItem]
    visuals: list[TimelineSource]
    audios: list[TimelineSource]
    total_duration: float
    width: int
    height: int


def _raise_bad_request(detail: str) -> None:
    raise HTTPException(status_code=400, detail=detail)


def _parse_uuid(value: Any, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        _raise_bad_request(f"时间线字段 {field_name} 非法")


def _parse_float(value: Any, field_name: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        _raise_bad_request(f"时间线字段 {field_name} 非法")
    return parsed


def _validate_timeline_items(raw_timeline: list[Any] | None) -> list[TimelineItem]:
    if raw_timeline is None:
        return []
    if not raw_timeline:
        _raise_bad_request("时间线为空，请先添加素材")

    items: list[TimelineItem] = []
    for index, raw_item in enumerate(raw_timeline, start=1):
        if not isinstance(raw_item, dict):
            _raise_bad_request(f"时间线第 {index} 项格式错误")

        item_type = raw_item.get("type")
        if item_type not in SUPPORTED_TIMELINE_TYPES:
            _raise_bad_request(f"时间线第 {index} 项类型不支持")

        clip_id = _parse_uuid(raw_item.get("clip_id"), "clip_id")
        start = _parse_float(raw_item.get("start"), "start")
        duration = _parse_float(raw_item.get("duration"), "duration")
        track = str(raw_item.get("track") or "").strip()

        if start < 0:
            _raise_bad_request(f"时间线第 {index} 项开始时间不能小于 0")
        if duration <= 0:
            _raise_bad_request(f"时间线第 {index} 项时长必须大于 0")
        if not track:
            _raise_bad_request(f"时间线第 {index} 项缺少轨道信息")

        items.append(
            TimelineItem(
                type=item_type,
                clip_id=clip_id,
                start=start,
                duration=duration,
                track=track,
            )
        )

    items.sort(key=lambda item: (item.start, item.track, str(item.clip_id)))
    return items


def _parse_asset_duration(asset: Asset) -> float | None:
    metadata = asset.metadata_json if isinstance(asset.metadata_json, dict) else {}
    raw_duration = metadata.get("duration")
    if raw_duration is None:
        return None

    try:
        duration = float(raw_duration)
    except (TypeError, ValueError):
        return None
    return duration if duration > 0 else None


async def _load_project_assets(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    project_id: uuid.UUID,
    asset_type: str,
    asset_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Asset]:
    if not asset_ids:
        return {}

    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.user_id == user_id,
                Asset.project_id == project_id,
                Asset.asset_type == asset_type,
                Asset.id.in_(asset_ids),
            )
        )
    )
    return {asset.id: asset for asset in result.scalars().all()}


def _validate_source_duration(
    requested_duration: float,
    source_duration: float | None,
    detail: str,
) -> None:
    if source_duration is not None and requested_duration - source_duration > TIME_EPSILON:
        _raise_bad_request(detail)


def _resolve_dimensions(resolution: str, aspect_ratio: str) -> tuple[int, int]:
    key = ((resolution or "1080p").lower(), (aspect_ratio or "16:9").strip())
    if key in RESOLUTION_PRESETS:
        return RESOLUTION_PRESETS[key]

    if "x" in key[0]:
        width_str, height_str = key[0].split("x", 1)
        try:
            return int(width_str), int(height_str)
        except ValueError:
            pass

    _raise_bad_request("不支持的导出分辨率或宽高比")


async def build_export_plan_from_values(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    project_id: uuid.UUID,
    timeline: list[Any] | None,
    resolution: str,
    aspect_ratio: str,
    require_visual_track: bool = True,
) -> ExportPlan:
    items = _validate_timeline_items(timeline)

    image_ids = [item.clip_id for item in items if item.type == "image"]
    audio_ids = [item.clip_id for item in items if item.type == "audio"]
    video_ids = [item.clip_id for item in items if item.type == "video"]

    storyboards_by_id: dict[uuid.UUID, Storyboard] = {}
    audio_by_id: dict[uuid.UUID, AudioClip] = {}
    video_by_id: dict[uuid.UUID, VideoClip] = {}
    image_assets_by_id: dict[uuid.UUID, Asset] = {}
    audio_assets_by_id: dict[uuid.UUID, Asset] = {}
    video_assets_by_id: dict[uuid.UUID, Asset] = {}

    if image_ids:
        result = await db.execute(
            select(Storyboard).where(
                Storyboard.project_id == project_id,
                Storyboard.id.in_(image_ids),
            )
        )
        storyboards_by_id = {storyboard.id: storyboard for storyboard in result.scalars().all()}
        image_assets_by_id = await _load_project_assets(
            db,
            user_id=user_id,
            project_id=project_id,
            asset_type="image",
            asset_ids=image_ids,
        )

    if audio_ids:
        result = await db.execute(
            select(AudioClip).where(
                AudioClip.user_id == user_id,
                AudioClip.project_id == project_id,
                AudioClip.id.in_(audio_ids),
            )
        )
        audio_by_id = {audio.id: audio for audio in result.scalars().all()}
        audio_assets_by_id = await _load_project_assets(
            db,
            user_id=user_id,
            project_id=project_id,
            asset_type="audio",
            asset_ids=audio_ids,
        )

    if video_ids:
        result = await db.execute(
            select(VideoClip).where(
                VideoClip.user_id == user_id,
                VideoClip.project_id == project_id,
                VideoClip.id.in_(video_ids),
            )
        )
        video_by_id = {video.id: video for video in result.scalars().all()}
        video_assets_by_id = await _load_project_assets(
            db,
            user_id=user_id,
            project_id=project_id,
            asset_type="video",
            asset_ids=video_ids,
        )

    visuals: list[TimelineSource] = []
    audios: list[TimelineSource] = []
    visual_tracks: set[str] = set()

    for item in items:
        if item.type == "image":
            storyboard = storyboards_by_id.get(item.clip_id)
            asset = image_assets_by_id.get(item.clip_id)
            if storyboard and storyboard.image_url:
                visuals.append(
                    TimelineSource(
                        item=item,
                        source_url=storyboard.image_url,
                        source_name=f"镜头 #{storyboard.shot_number}",
                    )
                )
            elif asset and asset.file_url:
                visuals.append(
                    TimelineSource(
                        item=item,
                        source_url=asset.file_url,
                        source_name=asset.name,
                    )
                )
            else:
                _raise_bad_request("时间线中存在不可用的图片素材，请先生成、上传或重新选择素材")
            visual_tracks.add(item.track)
            continue

        if item.type == "video":
            video = video_by_id.get(item.clip_id)
            asset = video_assets_by_id.get(item.clip_id)
            if video and video.video_url:
                _validate_source_duration(item.duration, video.duration, "时间线中的视频片段时长超过素材原始时长")
                visuals.append(
                    TimelineSource(
                        item=item,
                        source_url=video.video_url,
                        source_name="视频片段",
                        source_duration=video.duration,
                    )
                )
            elif asset and asset.file_url:
                asset_duration = _parse_asset_duration(asset)
                _validate_source_duration(item.duration, asset_duration, "时间线中的视频素材时长超过资产原始时长")
                visuals.append(
                    TimelineSource(
                        item=item,
                        source_url=asset.file_url,
                        source_name=asset.name,
                        source_duration=asset_duration,
                    )
                )
            else:
                _raise_bad_request("时间线中存在不可用的视频素材，请先生成、上传或重新选择素材")
            visual_tracks.add(item.track)
            continue

        audio = audio_by_id.get(item.clip_id)
        asset = audio_assets_by_id.get(item.clip_id)
        if audio and audio.audio_url:
            _validate_source_duration(item.duration, audio.duration, "时间线中的音频片段时长超过素材原始时长")
            audios.append(
                TimelineSource(
                    item=item,
                    source_url=audio.audio_url,
                    source_name=audio.text[:20] or "配音",
                    source_duration=audio.duration,
                )
            )
        elif asset and asset.file_url:
            asset_duration = _parse_asset_duration(asset)
            _validate_source_duration(item.duration, asset_duration, "时间线中的音频素材时长超过资产原始时长")
            audios.append(
                TimelineSource(
                    item=item,
                    source_url=asset.file_url,
                    source_name=asset.name,
                    source_duration=asset_duration,
                )
            )
        else:
            _raise_bad_request("时间线中存在不可用的音频素材，请先生成、上传或重新选择素材")

    if require_visual_track and not visuals:
        _raise_bad_request("至少需要一个图片或视频片段才能导出成片")

    if len(visual_tracks) > 1:
        _raise_bad_request("当前导出仅支持单条视频轨道，请整理时间线后重试")

    visuals.sort(key=lambda source: source.item.start)
    audios.sort(key=lambda source: source.item.start)

    last_visual_end = 0.0
    for source in visuals:
        if source.item.start + TIME_EPSILON < last_visual_end:
            _raise_bad_request("视频轨道存在重叠片段，暂不支持导出")
        last_visual_end = max(last_visual_end, source.item.end)

    last_audio_end = max((source.item.end for source in audios), default=0.0)
    total_duration = max(last_visual_end, last_audio_end)
    if total_duration <= 0:
        _raise_bad_request("时间线总时长无效，无法导出")

    width, height = _resolve_dimensions(resolution, aspect_ratio)
    return ExportPlan(
        items=items,
        visuals=visuals,
        audios=audios,
        total_duration=round(total_duration, 3),
        width=width,
        height=height,
    )


async def build_export_plan(
    db: AsyncSession,
    composition: Composition,
    *,
    require_visual_track: bool = True,
) -> ExportPlan:
    return await build_export_plan_from_values(
        db,
        user_id=composition.user_id,
        project_id=composition.project_id,
        timeline=composition.timeline,
        resolution=composition.resolution,
        aspect_ratio=composition.aspect_ratio,
        require_visual_track=require_visual_track,
    )


def _uploads_root() -> Path:
    return get_upload_root()


def _local_media_path(url: str) -> Path | None:
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"}:
        return None

    if is_managed_upload_url(url):
        relative = url.removeprefix("/uploads/")
        return (_uploads_root() / relative).resolve()

    path = Path(url)
    if path.is_absolute():
        return path

    return (Path.cwd() / path).resolve()


async def _materialize_media(url: str, cache_dir: Path, prefix: str) -> Path:
    local_path = _local_media_path(url)
    if local_path:
        if local_path.exists():
            return local_path
        raise RuntimeError(f"素材文件不存在: {local_path}")

    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix or ".bin"
    target_path = cache_dir / f"{prefix}{suffix}"
    safe_url = validate_outbound_url(url, label="导出素材地址")

    async with upstream_async_client(
        profile="media",
        timeout=120.0,
        follow_redirects=True,
    ) as client:
        response = await client.get(safe_url)
        response.raise_for_status()
        target_path.write_bytes(response.content)

    return target_path


def _video_scale_filter(width: int, height: int) -> str:
    return (
        "scale="
        f"{width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        "format=yuv420p"
    )


async def _run_command(command: list[str]) -> None:
    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        error_text = stderr.decode().strip() or stdout.decode().strip() or "未知错误"
        raise RuntimeError(error_text)


async def _render_gap_segment(output_path: Path, duration: float, width: int, height: int) -> None:
    command = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=black:s={width}x{height}:r={DEFAULT_FPS}",
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=channel_layout=stereo:sample_rate={DEFAULT_AUDIO_SAMPLE_RATE}",
        "-t",
        f"{duration:.3f}",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    await _run_command(command)


async def _render_image_segment(
    source_path: Path,
    output_path: Path,
    duration: float,
    width: int,
    height: int,
) -> None:
    command = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-loop",
        "1",
        "-i",
        str(source_path),
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=channel_layout=stereo:sample_rate={DEFAULT_AUDIO_SAMPLE_RATE}",
        "-t",
        f"{duration:.3f}",
        "-vf",
        _video_scale_filter(width, height),
        "-r",
        str(DEFAULT_FPS),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    await _run_command(command)


async def _render_video_segment(
    source_path: Path,
    output_path: Path,
    duration: float,
    width: int,
    height: int,
) -> None:
    command = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source_path),
        "-f",
        "lavfi",
        "-i",
        f"anullsrc=channel_layout=stereo:sample_rate={DEFAULT_AUDIO_SAMPLE_RATE}",
        "-t",
        f"{duration:.3f}",
        "-vf",
        _video_scale_filter(width, height),
        "-r",
        str(DEFAULT_FPS),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    await _run_command(command)


async def _render_visual_segments(plan: ExportPlan, work_dir: Path) -> Path:
    cache_dir = work_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    segments_dir = work_dir / "segments"
    segments_dir.mkdir(parents=True, exist_ok=True)
    concat_file = work_dir / "segments.txt"

    segment_paths: list[Path] = []
    cursor = 0.0

    for index, source in enumerate(plan.visuals):
        if source.item.start - cursor > TIME_EPSILON:
            gap_path = segments_dir / f"{len(segment_paths):03d}_gap.mp4"
            await _render_gap_segment(
                gap_path,
                source.item.start - cursor,
                plan.width,
                plan.height,
            )
            segment_paths.append(gap_path)
            cursor = source.item.start

        materialized = await _materialize_media(
            source.source_url,
            cache_dir,
            f"{source.item.type}_{index}_{source.item.clip_id.hex}_",
        )
        segment_path = segments_dir / f"{len(segment_paths):03d}_{source.item.type}.mp4"
        if source.item.type == "image":
            await _render_image_segment(
                materialized,
                segment_path,
                source.item.duration,
                plan.width,
                plan.height,
            )
        else:
            await _render_video_segment(
                materialized,
                segment_path,
                source.item.duration,
                plan.width,
                plan.height,
            )

        segment_paths.append(segment_path)
        cursor = source.item.end

    if plan.total_duration - cursor > TIME_EPSILON:
        gap_path = segments_dir / f"{len(segment_paths):03d}_tail.mp4"
        await _render_gap_segment(
            gap_path,
            plan.total_duration - cursor,
            plan.width,
            plan.height,
        )
        segment_paths.append(gap_path)

    concat_file.write_text(
        "".join(f"file '{segment_path.as_posix()}'\n" for segment_path in segment_paths),
        encoding="utf-8",
    )

    base_output_path = work_dir / "base.mp4"
    command = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        str(base_output_path),
    ]
    await _run_command(command)
    return base_output_path


async def _mix_audio_tracks(base_video_path: Path, plan: ExportPlan, work_dir: Path) -> Path:
    if not plan.audios:
        return base_video_path

    cache_dir = work_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    command = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(base_video_path),
    ]
    filter_parts: list[str] = []
    mix_inputs = "[0:a]"

    for index, source in enumerate(plan.audios, start=1):
        materialized = await _materialize_media(
            source.source_url,
            cache_dir,
            f"audio_{index}_{source.item.clip_id.hex}_",
        )
        command.extend(["-i", str(materialized)])
        delay_ms = max(0, int(round(source.item.start * 1000)))
        filter_parts.append(
            f"[{index}:a]atrim=0:{source.item.duration:.3f},asetpts=PTS-STARTPTS,"
            f"adelay={delay_ms}|{delay_ms}[a{index}]"
        )
        mix_inputs += f"[a{index}]"

    filter_parts.append(
        f"{mix_inputs}amix=inputs={len(plan.audios) + 1}:duration=first:dropout_transition=0[aout]"
    )

    output_path = work_dir / "mixed.mp4"
    command.extend(
        [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            str(output_path),
        ]
    )
    await _run_command(command)
    return output_path


def _export_subdir(project_id: uuid.UUID) -> Path:
    return _uploads_root() / "compositions" / str(project_id)


def _export_url(project_id: uuid.UUID, filename: str) -> str:
    return f"/uploads/compositions/{project_id}/{filename}"


async def render_composition_to_file(composition: Composition, plan: ExportPlan) -> str:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("未检测到 FFmpeg，请先安装后再导出")

    output_dir = _export_subdir(composition.project_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_name = f"{composition.id.hex}_{uuid.uuid4().hex}.mp4"
    output_path = output_dir / output_name

    with tempfile.TemporaryDirectory(prefix="miioo-comp-") as temp_dir:
        work_dir = Path(temp_dir)
        base_video_path = await _render_visual_segments(plan, work_dir)
        final_video_path = await _mix_audio_tracks(base_video_path, plan, work_dir)
        shutil.copyfile(final_video_path, output_path)

    return _export_url(composition.project_id, output_name)
