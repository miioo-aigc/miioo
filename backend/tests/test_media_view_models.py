from app.services import media_access_resolver
from app.services.media_view_models import (
    build_audio_media_fields,
    build_image_media_fields,
    build_video_media_fields,
)


def test_build_image_media_fields_uses_resolver_without_changing_field_shape():
    fields = build_image_media_fields(
        file_url="/uploads/images/source.png",
        thumbnail_url="/uploads/images/thumb.png",
        metadata={
            "preview_url": "https://cdn.example.com/images/preview.webp",
            "large_url": "https://cdn.example.com/images/large.avif",
            "origin_url": "https://origin.example.com/images/source.png",
        },
    )

    assert fields["thumbnail_url"] == "/uploads/images/thumb.png"
    assert fields["preview_url"] == "https://cdn.example.com/images/preview.webp"
    assert fields["largeUrl"] == "https://cdn.example.com/images/large.avif"
    assert fields["download_url"] == "https://origin.example.com/images/source.png"
    assert fields["posterUrl"] is None
    assert fields["previewVideoUrl"] is None
    assert fields["hlsUrl"] is None
    assert fields["availableQualities"] is None
    assert fields["previewReady"] is True


def test_build_video_media_fields_keeps_preview_and_download_semantics():
    fields = build_video_media_fields(
        file_url="/uploads/videos/source.mp4",
        thumbnail_url="/uploads/videos/poster.png",
        metadata={
            "preview_video_url": "https://cdn.example.com/videos/preview.mp4",
            "hls_url": "https://cdn.example.com/videos/master.m3u8",
            "available_qualities": [
                {"id": "540p", "label": "540p", "default": True},
                {"id": "720p", "label": "720p", "default": False},
            ],
            "download_url": "https://cdn.example.com/videos/master.mov",
        },
    )

    assert fields["posterUrl"] == "/uploads/videos/poster.png"
    assert fields["previewVideoUrl"] == "https://cdn.example.com/videos/preview.mp4"
    assert fields["hlsUrl"] == "https://cdn.example.com/videos/master.m3u8"
    assert fields["availableQualities"] == [
        {"id": "540p", "label": "540p", "default": True},
        {"id": "720p", "label": "720p", "default": False},
    ]
    assert fields["downloadUrl"] == "https://cdn.example.com/videos/master.mov"
    assert fields["previewReady"] is True


def test_build_audio_media_fields_fall_back_to_file_url():
    fields = build_audio_media_fields(
        file_url="/uploads/audio/source.mp3",
        metadata={},
    )

    assert fields["previewUrl"] == "/uploads/audio/source.mp3"
    assert fields["downloadUrl"] == "/uploads/audio/source.mp3"
    assert fields["thumbnail_url"] is None
    assert fields["largeUrl"] is None
    assert fields["posterUrl"] is None
    assert fields["previewVideoUrl"] is None
    assert fields["hlsUrl"] is None
    assert fields["availableQualities"] is None


def test_build_video_media_fields_returns_controlled_download_url_when_user_context_present():
    fields = build_video_media_fields(
        file_url="/uploads/videos/source.mp4",
        thumbnail_url="/uploads/videos/poster.png",
        metadata={"origin_url": "https://origin.example.com/videos/source.mov"},
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
    )

    assert isinstance(fields["downloadUrl"], str)
    assert fields["downloadUrl"].startswith("/api/media/downloads/")


def test_build_video_media_fields_fall_back_to_legacy_download_url_when_signed_download_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_SIGNED_DOWNLOAD", False)

    fields = build_video_media_fields(
        file_url="/uploads/videos/source.mp4",
        thumbnail_url="/uploads/videos/poster.png",
        metadata={"origin_url": "https://origin.example.com/videos/source.mov"},
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
    )

    assert fields["downloadUrl"] == "https://origin.example.com/videos/source.mov"


def test_build_image_media_fields_omits_large_variant_when_large_feature_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_IMAGE_LARGE_VARIANT", False)

    fields = build_image_media_fields(
        file_url="/uploads/images/source.png",
        thumbnail_url="/uploads/images/thumb.png",
        metadata={
            "preview_url": "https://cdn.example.com/images/preview.webp",
            "large_url": "https://cdn.example.com/images/large.avif",
        },
    )

    assert fields["largeUrl"] is None


def test_build_image_media_fields_fall_back_to_origin_when_object_storage_preview_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW", False)

    fields = build_image_media_fields(
        file_url="/uploads/images/source.png",
        thumbnail_url="/uploads/images/thumb.png",
        metadata={
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "storage_key": "preview/images/source.avif",
            "cdn_url": "https://cdn.example.com/images/preview.avif",
            "origin_url": "https://origin.example.com/images/source.png",
        },
    )

    assert fields["previewUrl"] == "https://origin.example.com/images/source.png"


def test_build_video_media_fields_fall_back_to_origin_preview_when_object_storage_preview_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW", False)

    fields = build_video_media_fields(
        file_url="/uploads/videos/source.mp4",
        thumbnail_url="/uploads/videos/poster.png",
        metadata={
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "storage_key": "preview/videos/source.mp4",
            "preview_video_url": "https://cdn.example.com/videos/preview.mp4",
            "origin_url": "https://origin.example.com/videos/source.mov",
        },
    )

    assert fields["previewVideoUrl"] == "https://origin.example.com/videos/source.mov"


def test_build_video_media_fields_omits_hls_when_hls_feature_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_VIDEO_HLS", False)

    fields = build_video_media_fields(
        file_url="/uploads/videos/source.mp4",
        thumbnail_url="/uploads/videos/poster.png",
        metadata={
            "hls_url": "https://cdn.example.com/videos/master.m3u8",
            "available_qualities": [
                {"id": "540p", "label": "540p", "default": True},
            ],
        },
    )

    assert fields["hlsUrl"] is None
    assert fields["availableQualities"] is None
