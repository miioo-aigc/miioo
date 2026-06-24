from urllib.parse import urlparse


_VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".m4v")
_AUDIO_EXTENSIONS = (".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac")
_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp")


def _get_url_path(url: str | None) -> str:
    if not url:
        return ""
    return urlparse(str(url)).path.lower()


def is_video_like_url(url: str | None) -> bool:
    return _get_url_path(url).endswith(_VIDEO_EXTENSIONS)


def is_audio_like_url(url: str | None) -> bool:
    return _get_url_path(url).endswith(_AUDIO_EXTENSIONS)


def is_image_like_url(url: str | None) -> bool:
    return _get_url_path(url).endswith(_IMAGE_EXTENSIONS)


def pick_safe_thumbnail_url(*candidates: str | None) -> str | None:
    for candidate in candidates:
        cleaned = str(candidate or "").strip()
        if not cleaned:
            continue
        if is_video_like_url(cleaned) or is_audio_like_url(cleaned):
            continue
        return cleaned
    return None
