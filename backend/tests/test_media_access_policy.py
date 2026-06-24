from app.services.media_access_policy import (
    AUTHENTICATED_PREVIEW,
    CONTROLLED_DOWNLOAD,
    INTERNAL_ONLY,
    PUBLIC_PREVIEW,
    resolve_media_access_level,
)


def test_image_preview_is_public_preview():
    assert (
        resolve_media_access_level(
            media_type="image",
            usage="preview",
            is_original=False,
        )
        == PUBLIC_PREVIEW
    )


def test_video_original_download_is_controlled():
    assert (
        resolve_media_access_level(
            media_type="video",
            usage="download",
            is_original=True,
        )
        == CONTROLLED_DOWNLOAD
    )


def test_audio_preview_is_authenticated_preview():
    assert (
        resolve_media_access_level(
            media_type="audio",
            usage="preview",
            is_original=False,
        )
        == AUTHENTICATED_PREVIEW
    )


def test_internal_usage_is_internal_only():
    assert (
        resolve_media_access_level(
            media_type="image",
            usage="internal",
            is_original=False,
        )
        == INTERNAL_ONLY
    )
