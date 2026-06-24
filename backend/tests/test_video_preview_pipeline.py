import asyncio
from pathlib import Path

import app.services.video_preview_pipeline as video_preview_pipeline


def test_generate_video_preview_returns_managed_preview_metadata(
    monkeypatch,
    tmp_path,
):
    source_path = tmp_path / "source.mp4"
    source_path.write_bytes(b"video-source")
    output_dir = tmp_path / "derived-preview"

    async def fake_probe_video_stream_metadata(path: Path):
        assert path == source_path
        return 1920, 1080, 6.5

    async def fake_run_command(command: list[str]) -> str:
        output_path = Path(command[-1])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(b"video-preview")
        return ""

    monkeypatch.setattr(
        video_preview_pipeline,
        "resolve_upload_path",
        lambda url: source_path,
    )
    monkeypatch.setattr(
        video_preview_pipeline,
        "resolve_upload_dir",
        lambda subdir: output_dir,
    )
    monkeypatch.setattr(
        video_preview_pipeline,
        "build_upload_url",
        lambda subdir, filename: f"/uploads/{subdir}/{filename}",
    )
    monkeypatch.setattr(
        video_preview_pipeline,
        "_require_binary",
        lambda name: f"/usr/bin/{name}",
    )
    monkeypatch.setattr(
        video_preview_pipeline,
        "_probe_video_stream_metadata",
        fake_probe_video_stream_metadata,
    )
    monkeypatch.setattr(
        video_preview_pipeline,
        "_run_command",
        fake_run_command,
    )

    preview = asyncio.run(
        video_preview_pipeline.generate_video_preview(
            "/uploads/videos/source.mp4"
        )
    )

    assert preview.preview_url.startswith("/uploads/derived/assets/video-preview/")
    assert preview.preview_url.endswith(".mp4")
    assert preview.width == 1920
    assert preview.height == 1080
    assert preview.duration == 6.5
    assert preview.codec == "h264_aac_mp4"
    assert preview.profile == "video_preview_mp4_v1"
