from app.services import media_delivery_urls
from app.services.media_object_descriptor import (
    build_local_object_descriptor,
    build_media_object_descriptor,
    build_object_storage_descriptor,
)


def test_build_local_object_descriptor_from_managed_upload():
    descriptor = build_local_object_descriptor(
        "/uploads/storyboards/abc/file.png",
        {"storage_mode": "managed_upload"},
    )

    assert descriptor == {
        "storage_mode": "managed_upload",
        "storage_bucket": None,
        "storage_key": "storyboards/abc/file.png",
        "origin_storage_key": "storyboards/abc/file.png",
        "preview_storage_key": None,
        "download_storage_key": "storyboards/abc/file.png",
        "source_url": "/uploads/storyboards/abc/file.png",
        "cdn_url": None,
        "download_url": None,
        "is_local_upload": True,
    }


def test_build_object_storage_descriptor_uses_metadata_keys():
    descriptor = build_object_storage_descriptor(
        bucket=None,
        key=None,
        metadata={
            "storage_mode": "object_storage",
            "storage_bucket": "media-preview",
            "storage_key": "preview/videos/demo.mp4",
            "origin_storage_key": "raw/videos/demo.mov",
            "download_storage_key": "private/videos/demo.mov",
            "cdn_url": "https://cdn.example.com/videos/demo.mp4",
        },
    )

    assert descriptor == {
        "storage_mode": "object_storage",
        "storage_bucket": "media-preview",
        "storage_key": "preview/videos/demo.mp4",
        "origin_storage_key": "raw/videos/demo.mov",
        "preview_storage_key": None,
        "download_storage_key": "private/videos/demo.mov",
        "source_url": None,
        "cdn_url": "https://cdn.example.com/videos/demo.mp4",
        "download_url": None,
        "is_local_upload": False,
    }


def test_build_media_object_descriptor_prefers_object_storage_metadata():
    descriptor = build_media_object_descriptor(
        url="/uploads/storyboards/abc/file.png",
        metadata={
            "storage_bucket": "media-preview",
            "storage_key": "preview/storyboards/file.png",
        },
    )

    assert descriptor["storage_bucket"] == "media-preview"
    assert descriptor["storage_key"] == "preview/storyboards/file.png"
    assert descriptor["is_local_upload"] is False


def test_build_object_storage_descriptor_builds_public_urls_from_config(monkeypatch):
    monkeypatch.setattr(
        media_delivery_urls.settings,
        "MEDIA_PUBLIC_BASE_URL",
        "https://www.miiooai.com/media/origin",
        raising=False,
    )
    monkeypatch.setattr(
        media_delivery_urls.settings,
        "MEDIA_CDN_BASE_URL",
        "https://www.miiooai.com/media/cdn",
        raising=False,
    )

    descriptor = build_object_storage_descriptor(
        bucket="media-preview",
        key="preview/storyboards/file.png",
        metadata={
            "origin_storage_key": "raw/storyboards/file.png",
            "download_storage_key": "private/storyboards/file.png",
        },
    )

    assert descriptor["source_url"] == "https://www.miiooai.com/media/origin/media-preview/raw/storyboards/file.png"
    assert descriptor["cdn_url"] == "https://www.miiooai.com/media/cdn/media-preview/preview/storyboards/file.png"
    assert descriptor["download_url"] == "https://www.miiooai.com/media/origin/media-preview/private/storyboards/file.png"
