from app.services import media_access_resolver
from app.services import media_delivery_urls
from app.services.media_access_resolver import (
    resolve_download_url,
    resolve_image_large_url,
    resolve_preview_url,
    resolve_video_available_qualities,
    resolve_video_hls_url,
)


def test_resolve_preview_url_prefers_video_preview_metadata():
    preview_url = resolve_preview_url(
        {"source_url": "/uploads/videos/source.mp4"},
        metadata={
            "preview_video_url": "https://cdn.example.com/videos/preview.mp4",
            "preview_url": "https://cdn.example.com/videos/fallback.mp4",
        },
        fallback_url="/uploads/videos/source.mp4",
        media_type="video",
    )

    assert preview_url == "https://cdn.example.com/videos/preview.mp4"


def test_resolve_preview_url_uses_descriptor_cdn_when_explicit_preview_missing():
    preview_url = resolve_preview_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "cdn_url": "https://cdn.example.com/images/preview.webp",
            "source_url": "https://origin.example.com/images/source.png",
        },
        metadata={},
        fallback_url="/uploads/images/source.png",
        media_type="image",
    )

    assert preview_url == "https://cdn.example.com/images/preview.webp"


def test_resolve_preview_url_falls_back_to_source_when_object_storage_preview_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW", False)

    preview_url = resolve_preview_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "cdn_url": "https://cdn.example.com/images/preview.webp",
            "source_url": "https://origin.example.com/images/source.png",
        },
        metadata={},
        fallback_url="/uploads/images/source.png",
        media_type="image",
    )

    assert preview_url == "https://origin.example.com/images/source.png"


def test_resolve_preview_url_falls_back_to_source_when_explicit_object_storage_preview_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW", False)

    preview_url = resolve_preview_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "source_url": "https://origin.example.com/videos/source.mp4",
        },
        metadata={"preview_video_url": "https://cdn.example.com/videos/preview.m3u8"},
        fallback_url="/uploads/videos/source.mp4",
        media_type="video",
    )

    assert preview_url == "https://origin.example.com/videos/source.mp4"


def test_resolve_image_large_url_returns_explicit_large_variant_when_enabled():
    large_url = resolve_image_large_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
        },
        metadata={"large_url": "https://cdn.example.com/images/large.avif"},
    )

    assert large_url == "https://cdn.example.com/images/large.avif"


def test_resolve_image_large_url_returns_none_when_large_variant_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_IMAGE_LARGE_VARIANT", False)

    large_url = resolve_image_large_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
        },
        metadata={"large_url": "https://cdn.example.com/images/large.avif"},
    )

    assert large_url is None


def test_resolve_video_hls_url_returns_explicit_hls_when_enabled():
    hls_url = resolve_video_hls_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
        },
        metadata={"hls_url": "https://cdn.example.com/videos/master.m3u8"},
    )

    assert hls_url == "https://cdn.example.com/videos/master.m3u8"


def test_resolve_video_hls_url_returns_none_when_hls_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_VIDEO_HLS", False)

    hls_url = resolve_video_hls_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
        },
        metadata={"hls_url": "https://cdn.example.com/videos/master.m3u8"},
    )

    assert hls_url is None


def test_resolve_video_available_qualities_returns_metadata_when_enabled():
    qualities = resolve_video_available_qualities(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
        },
        metadata={
            "available_qualities": [
                {"id": "540p", "label": "540p", "default": True},
                {"id": "720p", "label": "720p", "default": False},
            ]
        },
    )

    assert qualities == [
        {"id": "540p", "label": "540p", "default": True},
        {"id": "720p", "label": "720p", "default": False},
    ]


def test_resolve_download_url_prefers_explicit_download_url():
    download_url = resolve_download_url(
        {"source_url": "/uploads/videos/source.mp4"},
        metadata={
            "download_url": "https://cdn.example.com/videos/source.mov",
            "origin_url": "https://origin.example.com/videos/source.mov",
        },
        fallback_url="/uploads/videos/source.mp4",
        media_type="video",
    )

    assert download_url == "https://cdn.example.com/videos/source.mov"


def test_resolve_download_url_falls_back_to_origin_then_source():
    download_url = resolve_download_url(
        {"source_url": "/uploads/audio/source.mp3"},
        metadata={"origin_url": "https://origin.example.com/audio/source.wav"},
        fallback_url="/uploads/audio/source.mp3",
        media_type="audio",
    )

    assert download_url == "https://origin.example.com/audio/source.wav"


def test_resolve_download_url_builds_object_storage_origin_url_when_metadata_missing(monkeypatch):
    monkeypatch.setattr(
        media_delivery_urls.settings,
        "MEDIA_PUBLIC_BASE_URL",
        "https://www.miiooai.com/media/origin",
        raising=False,
    )

    download_url = resolve_download_url(
        {
            "storage_mode": "object_storage",
            "storage_bucket": "media-private",
            "storage_key": "preview/videos/source.mp4",
            "origin_storage_key": "raw/videos/source.mov",
            "download_storage_key": "private/videos/source.mov",
        },
        metadata={},
        fallback_url=None,
        media_type="video",
    )

    assert download_url == "https://www.miiooai.com/media/origin/media-private/private/videos/source.mov"


def test_resolve_download_url_returns_controlled_route_when_identity_provided():
    download_url = resolve_download_url(
        {
            "storage_mode": "managed_upload",
            "storage_key": "videos/source.mp4",
            "source_url": "/uploads/videos/source.mp4",
        },
        metadata={"origin_url": "https://origin.example.com/videos/source.mov"},
        fallback_url="/uploads/videos/source.mp4",
        media_type="video",
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
    )

    assert isinstance(download_url, str)
    assert download_url.startswith("/api/media/downloads/")


def test_resolve_download_url_falls_back_to_legacy_url_when_signed_download_disabled(monkeypatch):
    monkeypatch.setattr(media_access_resolver.settings, "MEDIA_ENABLE_SIGNED_DOWNLOAD", False)

    download_url = resolve_download_url(
        {
            "storage_mode": "managed_upload",
            "storage_key": "videos/source.mp4",
            "source_url": "/uploads/videos/source.mp4",
        },
        metadata={"origin_url": "https://origin.example.com/videos/source.mov"},
        fallback_url="/uploads/videos/source.mp4",
        media_type="video",
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
    )

    assert download_url == "https://origin.example.com/videos/source.mov"
