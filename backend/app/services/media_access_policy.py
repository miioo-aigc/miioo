from __future__ import annotations

PUBLIC_PREVIEW = "public_preview"
AUTHENTICATED_PREVIEW = "authenticated_preview"
CONTROLLED_DOWNLOAD = "controlled_download"
INTERNAL_ONLY = "internal_only"


def _normalize_value(value: str | None) -> str:
    return (value or "").strip().lower()


def resolve_media_access_level(
    *,
    media_type: str,
    usage: str,
    is_original: bool,
) -> str:
    normalized_media_type = _normalize_value(media_type)
    normalized_usage = _normalize_value(usage)

    if normalized_usage in {"internal", "derived_internal"}:
        return INTERNAL_ONLY

    if normalized_usage in {"download", "original_download"} and is_original:
        return CONTROLLED_DOWNLOAD

    if normalized_usage in {"download", "original_download"}:
        if normalized_media_type == "image":
            return PUBLIC_PREVIEW
        return AUTHENTICATED_PREVIEW

    if normalized_media_type == "image":
        return PUBLIC_PREVIEW

    if normalized_media_type in {"video", "audio"}:
        return AUTHENTICATED_PREVIEW

    return INTERNAL_ONLY
