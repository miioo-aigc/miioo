import asyncio
from pathlib import Path

import app.services.video_hls_pipeline as video_hls_pipeline


def test_generate_video_hls_returns_master_playlist_metadata(
    monkeypatch,
    tmp_path,
):
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"video-source")
    output_dir = tmp_path / "derived-hls"

    async def fake_probe_video_stream_metadata(path: Path):
        assert path == source_path
        return 1920, 1080

    async def fake_run_command(command: list[str]) -> str:
        variant_playlist_path = Path(command[-1])
        variant_playlist_path.parent.mkdir(parents=True, exist_ok=True)
        variant_playlist_path.write_text("#EXTM3U\n", encoding="utf-8")
        return ""

    monkeypatch.setattr(
        video_hls_pipeline,
        "resolve_upload_path",
        lambda url: source_path,
    )
    monkeypatch.setattr(
        video_hls_pipeline,
        "resolve_upload_dir",
        lambda subdir: output_dir,
    )
    monkeypatch.setattr(
        video_hls_pipeline,
        "build_upload_url",
        lambda subdir, filename: f"/uploads/{subdir}/{filename}",
    )
    monkeypatch.setattr(
        video_hls_pipeline,
        "_require_binary",
        lambda name: f"/usr/bin/{name}",
    )
    monkeypatch.setattr(
        video_hls_pipeline,
        "_probe_video_stream_metadata",
        fake_probe_video_stream_metadata,
    )
    monkeypatch.setattr(
        video_hls_pipeline,
        "_run_command",
        fake_run_command,
    )

    generated = asyncio.run(
        video_hls_pipeline.generate_video_hls("/uploads/videos/source.mp4")
    )

    assert generated.hls_url.startswith("/uploads/derived/assets/video-hls/")
    assert generated.hls_url.endswith("/master.m3u8")
    assert generated.hls_master_playlist == generated.hls_url
    assert generated.variant_count == 1
    assert generated.default_quality == "720p"
    assert generated.available_qualities == [
        {
            "id": "720p",
            "label": "720p",
            "bandwidth": 1928000,
            "width": 1280,
            "height": 720,
            "default": True,
            "playlist_url": generated.hls_url.replace("master.m3u8", "stream_720p.m3u8"),
        }
    ]
