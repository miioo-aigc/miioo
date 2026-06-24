import asyncio

import pytest

from app.services.reference_video_proxy import (
    MissingBinaryError,
    REFERENCE_VIDEO_MAX_DURATION_SECONDS,
    prepare_local_reference_video_for_upstream,
)


def test_prepare_local_reference_video_skips_probe_when_ffprobe_missing(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "reference.mp4"
    source.write_bytes(b"fake-video")

    monkeypatch.setattr(
        "app.services.reference_video_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        raise MissingBinaryError("未检测到 ffprobe，无法自动处理参考视频")

    monkeypatch.setattr(
        "app.services.reference_video_proxy._probe_video_metadata",
        fake_probe,
    )

    prepared = asyncio.run(
        prepare_local_reference_video_for_upstream("/uploads/reference.mp4")
    )

    assert prepared.url == "/uploads/reference.mp4"
    assert prepared.compressed is False
    assert prepared.trimmed is False
    assert prepared.width is None
    assert prepared.height is None
    assert prepared.duration_seconds is None


def test_prepare_local_reference_video_skips_compression_when_ffmpeg_missing(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "oversized-reference.mp4"
    source.write_bytes(b"fake-video")

    monkeypatch.setattr(
        "app.services.reference_video_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        return 3840, 2160, 8.0

    async def fake_transcode(_source_path, *, trim, compress):
        assert trim is False
        assert compress is True
        raise MissingBinaryError("未检测到 ffmpeg，无法自动压缩参考视频")

    monkeypatch.setattr(
        "app.services.reference_video_proxy._probe_video_metadata",
        fake_probe,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy._transcode_reference_video",
        fake_transcode,
    )

    prepared = asyncio.run(
        prepare_local_reference_video_for_upstream("/uploads/reference.mp4")
    )

    assert prepared.url == "/uploads/reference.mp4"
    assert prepared.compressed is False
    assert prepared.trimmed is False
    assert prepared.width == 3840
    assert prepared.height == 2160


def test_prepare_local_reference_video_trims_when_duration_exceeds_limit(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "long-reference.mp4"
    source.write_bytes(b"fake-video")

    monkeypatch.setattr(
        "app.services.reference_video_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        return 1280, 720, 28.5

    async def fake_transcode(_source_path, *, trim, compress):
        assert trim is True
        assert compress is False
        return "/uploads/runtime/reference-videos/trimmed.mp4"

    monkeypatch.setattr(
        "app.services.reference_video_proxy._probe_video_metadata",
        fake_probe,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy._transcode_reference_video",
        fake_transcode,
    )

    prepared = asyncio.run(
        prepare_local_reference_video_for_upstream("/uploads/reference.mp4")
    )

    assert prepared.url == "/uploads/runtime/reference-videos/trimmed.mp4"
    assert prepared.trimmed is True
    assert prepared.compressed is False
    assert prepared.duration_seconds == 28.5


def test_prepare_local_reference_video_rejects_long_video_without_ffmpeg(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "long-reference.mp4"
    source.write_bytes(b"fake-video")

    monkeypatch.setattr(
        "app.services.reference_video_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        return 1280, 720, 28.5

    monkeypatch.setattr(
        "app.services.reference_video_proxy._probe_video_metadata",
        fake_probe,
    )
    monkeypatch.setattr(
        "app.services.reference_video_proxy._require_binary",
        lambda _name: (_ for _ in ()).throw(
            MissingBinaryError("未检测到 ffmpeg，无法自动压缩参考视频")
        ),
    )

    with pytest.raises(ValueError) as exc_info:
        asyncio.run(
            prepare_local_reference_video_for_upstream("/uploads/reference.mp4")
        )

    message = str(exc_info.value)
    assert f"{REFERENCE_VIDEO_MAX_DURATION_SECONDS:g}s" in message
    assert "28.5s" in message
    assert "ffmpeg" in message
