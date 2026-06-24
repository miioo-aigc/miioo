import asyncio

import app.services.media_derivative_pipeline as media_derivative_pipeline
from app.services.media_derivative_pipeline import build_video_playback_metadata
from app.services.video_hls_pipeline import GeneratedVideoHls
from app.services.video_preview_pipeline import GeneratedVideoPreview


def test_build_video_playback_metadata_prefers_upstream_hls_fields():
    metadata = build_video_playback_metadata(
        {
            "previewVideoUrl": "https://cdn.example.com/videos/preview.mp4",
            "hlsUrl": "https://cdn.example.com/videos/master.m3u8",
            "availableQualities": [
                {"id": "540p", "label": "540p", "default": True},
                {"id": "720p", "label": "720p", "default": False},
            ],
        },
        preview_video_url="/uploads/videos/source.mp4",
        download_url="/uploads/videos/source.mp4",
        poster_url="/uploads/videos/poster.png",
    )

    assert metadata["poster_url"] == "/uploads/videos/poster.png"
    assert metadata["preview_video_url"] == "https://cdn.example.com/videos/preview.mp4"
    assert metadata["hls_url"] == "https://cdn.example.com/videos/master.m3u8"
    assert metadata["available_qualities"] == [
        {"id": "540p", "label": "540p", "default": True},
        {"id": "720p", "label": "720p", "default": False},
    ]
    assert metadata["download_url"] == "/uploads/videos/source.mp4"
    assert metadata["preview_ready"] is True
    assert metadata["partial_ready"] is True
    assert metadata["video_pipeline_stage"] == "metadata_committing"
    assert metadata["metadata_commit_status"] == "pending"


def test_build_video_playback_metadata_falls_back_to_runtime_urls():
    metadata = build_video_playback_metadata(
        {
            "available_qualities": ["bad", {"id": "540p", "label": "540p"}],
        },
        preview_video_url="/uploads/videos/source.mp4",
        download_url="/uploads/videos/source.mp4",
    )

    assert metadata["preview_video_url"] == "/uploads/videos/source.mp4"
    assert metadata["download_url"] == "/uploads/videos/source.mp4"
    assert "hls_url" not in metadata
    assert metadata["available_qualities"] == [{"id": "540p", "label": "540p"}]
    assert metadata["preview_ready"] is True
    assert metadata["partial_ready"] is False
    assert metadata["video_pipeline_stage"] == "poster_extracting"
    assert metadata["metadata_commit_status"] == "pending"


def test_build_video_poster_bundle_uses_transcoded_preview(monkeypatch):
    async def fake_generate_video_preview(video_url: str) -> GeneratedVideoPreview:
        return GeneratedVideoPreview(
            preview_url=f"{video_url}.preview.mp4",
            width=1280,
            height=720,
            duration=5.0,
        )

    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE",
        True,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_preview",
        fake_generate_video_preview,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "build_image_derivative_bundle",
        lambda source_url, *, preview_subdir, asset_type: {
            "thumbnail_url": source_url,
            "poster_url": source_url,
            "metadata_updates": {"thumbnail_url": source_url},
            "derivative_error": None,
        },
    )

    bundle = asyncio.run(
        media_derivative_pipeline.build_video_poster_bundle(
            video_url="/uploads/videos/source.mp4",
            fallback_thumbnail_url="/uploads/videos/poster.png",
        )
    )

    assert bundle["preview_video_url"] == "/uploads/videos/source.mp4.preview.mp4"
    assert bundle["preview_ready"] is True
    assert bundle["metadata_updates"]["preview_video_url"] == "/uploads/videos/source.mp4.preview.mp4"
    assert bundle["metadata_updates"]["preview_transcode_status"] == "ready"
    assert bundle["metadata_updates"]["transcode_profile"] == "video_preview_mp4_v1"
    assert bundle["metadata_updates"]["preview_width"] == 1280
    assert bundle["metadata_updates"]["preview_height"] == 720
    assert bundle["metadata_updates"]["partial_ready"] is True
    assert bundle["metadata_updates"]["video_pipeline_stage"] == "completed"
    assert bundle["metadata_updates"]["metadata_commit_status"] == "ready"


def test_build_video_poster_bundle_skips_transcode_when_disabled(monkeypatch):
    async def fail_generate_video_preview(video_url: str) -> GeneratedVideoPreview:
        raise AssertionError("preview transcode should not run when disabled")

    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE",
        False,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_preview",
        fail_generate_video_preview,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "build_image_derivative_bundle",
        lambda source_url, *, preview_subdir, asset_type: {
            "thumbnail_url": source_url,
            "poster_url": source_url,
            "metadata_updates": {"thumbnail_url": source_url},
            "derivative_error": None,
        },
    )

    bundle = asyncio.run(
        media_derivative_pipeline.build_video_poster_bundle(
            video_url="/uploads/videos/source.mp4",
            fallback_thumbnail_url="/uploads/videos/poster.png",
        )
    )

    assert bundle["preview_video_url"] == "/uploads/videos/source.mp4"
    assert bundle["metadata_updates"]["preview_video_url"] == "/uploads/videos/source.mp4"
    assert bundle["metadata_updates"]["preview_transcode_status"] == "disabled"
    assert bundle["metadata_updates"]["partial_ready"] is True
    assert bundle["metadata_updates"]["video_pipeline_stage"] == "completed"


def test_build_video_poster_bundle_uses_generated_hls(monkeypatch):
    async def fake_generate_video_preview(video_url: str) -> GeneratedVideoPreview:
        return GeneratedVideoPreview(
            preview_url=f"{video_url}.preview.mp4",
        )

    async def fake_generate_video_hls(video_url: str) -> GeneratedVideoHls:
        return GeneratedVideoHls(
            hls_url=f"{video_url}.master.m3u8",
            hls_master_playlist=f"{video_url}.master.m3u8",
            available_qualities=[
                {
                    "id": "720p",
                    "label": "720p",
                    "default": True,
                    "playlist_url": f"{video_url}.stream_720p.m3u8",
                }
            ],
            variant_count=1,
            default_quality="720p",
            width=1280,
            height=720,
        )

    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE",
        True,
    )
    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_HLS",
        True,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_preview",
        fake_generate_video_preview,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_hls",
        fake_generate_video_hls,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "build_image_derivative_bundle",
        lambda source_url, *, preview_subdir, asset_type: {
            "thumbnail_url": source_url,
            "poster_url": source_url,
            "metadata_updates": {"thumbnail_url": source_url},
            "derivative_error": None,
        },
    )

    bundle = asyncio.run(
        media_derivative_pipeline.build_video_poster_bundle(
            video_url="/uploads/videos/source.mp4",
            fallback_thumbnail_url="/uploads/videos/poster.png",
        )
    )

    assert bundle["metadata_updates"]["hls_url"] == "/uploads/videos/source.mp4.master.m3u8"
    assert bundle["metadata_updates"]["hls_master_playlist"] == "/uploads/videos/source.mp4.master.m3u8"
    assert bundle["metadata_updates"]["available_qualities"] == [
        {
            "id": "720p",
            "label": "720p",
            "default": True,
            "playlist_url": "/uploads/videos/source.mp4.stream_720p.m3u8",
        }
    ]
    assert bundle["metadata_updates"]["hls_packaging_status"] == "ready"
    assert bundle["metadata_updates"]["default_quality"] == "720p"
    assert bundle["metadata_updates"]["hls_variant_count"] == 1
    assert bundle["metadata_updates"]["partial_ready"] is True
    assert bundle["metadata_updates"]["video_pipeline_stage"] == "completed"
    assert bundle["metadata_updates"]["metadata_commit_status"] == "ready"


def test_build_video_poster_bundle_skips_hls_when_disabled(monkeypatch):
    async def fake_generate_video_preview(video_url: str) -> GeneratedVideoPreview:
        return GeneratedVideoPreview(
            preview_url=f"{video_url}.preview.mp4",
        )

    async def fail_generate_video_hls(video_url: str) -> GeneratedVideoHls:
        raise AssertionError("HLS package should not run when disabled")

    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE",
        True,
    )
    monkeypatch.setattr(
        media_derivative_pipeline.settings,
        "MEDIA_ENABLE_VIDEO_HLS",
        False,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_preview",
        fake_generate_video_preview,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "generate_video_hls",
        fail_generate_video_hls,
    )
    monkeypatch.setattr(
        media_derivative_pipeline,
        "build_image_derivative_bundle",
        lambda source_url, *, preview_subdir, asset_type: {
            "thumbnail_url": source_url,
            "poster_url": source_url,
            "metadata_updates": {"thumbnail_url": source_url},
            "derivative_error": None,
        },
    )

    bundle = asyncio.run(
        media_derivative_pipeline.build_video_poster_bundle(
            video_url="/uploads/videos/source.mp4",
            fallback_thumbnail_url="/uploads/videos/poster.png",
        )
    )

    assert "hls_url" not in bundle["metadata_updates"]
    assert bundle["metadata_updates"]["hls_packaging_status"] == "disabled"
    assert bundle["metadata_updates"]["partial_ready"] is True
    assert bundle["metadata_updates"]["video_pipeline_stage"] == "completed"
