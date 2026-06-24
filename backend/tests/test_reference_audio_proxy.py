import asyncio

import pytest

from app.services.reference_audio_proxy import (
    MissingBinaryError,
    REFERENCE_AUDIO_MAX_DURATION_SECONDS,
    validate_seedance_reference_audio_duration,
)


def test_validate_seedance_reference_audio_duration_rejects_long_audio(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "long-reference.mp3"
    source.write_bytes(b"fake-audio")

    monkeypatch.setattr(
        "app.services.reference_audio_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_audio_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        return 18.3

    monkeypatch.setattr(
        "app.services.reference_audio_proxy._probe_audio_duration",
        fake_probe,
    )

    with pytest.raises(ValueError) as exc_info:
        asyncio.run(
            validate_seedance_reference_audio_duration("/uploads/reference.mp3")
        )

    message = str(exc_info.value)
    assert f"{REFERENCE_AUDIO_MAX_DURATION_SECONDS:g}" in message
    assert "18.3s" in message
    assert "15 秒内" in message


def test_validate_seedance_reference_audio_duration_skips_when_ffprobe_missing(
    monkeypatch,
    tmp_path,
):
    source = tmp_path / "reference.mp3"
    source.write_bytes(b"fake-audio")

    monkeypatch.setattr(
        "app.services.reference_audio_proxy.is_managed_upload_url",
        lambda url: True,
    )
    monkeypatch.setattr(
        "app.services.reference_audio_proxy.resolve_upload_path",
        lambda url: source,
    )

    async def fake_probe(_source_path):
        raise MissingBinaryError("未检测到 ffprobe，无法探测参考音频时长")

    monkeypatch.setattr(
        "app.services.reference_audio_proxy._probe_audio_duration",
        fake_probe,
    )

    duration = asyncio.run(
        validate_seedance_reference_audio_duration("/uploads/reference.mp3")
    )

    assert duration is None
