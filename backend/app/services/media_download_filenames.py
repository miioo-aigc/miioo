from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote, urlparse

from app.services.media_storage import get_media_fallback_extension

PROMPT_EXCERPT_LIMIT = 24
FILENAME_SEGMENT_LIMIT = 120

_GENERIC_NAME_PATTERNS = (
    re.compile(r"^asset(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^image(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^video(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^audio(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^creation(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^download(?:[_ -]?\d+)?$", re.IGNORECASE),
    re.compile(r"^创作图片(?:[_ -]?\d+)?$"),
    re.compile(r"^创作视频(?:[_ -]?\d+)?$"),
    re.compile(r"^创作配音(?:[_ -]?\d+)?$"),
    re.compile(r"^配音[-_ ].*$"),
    re.compile(r"^分镜(?:图|视频)? ?#?\d+(?:[_ -]?\d+)?$"),
    re.compile(r"^镜头 ?#?\d+(?:[_ -]?\d+)?$"),
    re.compile(r"^subject-image(?:[_ -]?\d+)?$", re.IGNORECASE),
)


def sanitize_filename_segment(
    value: str | None,
    *,
    fallback: str = "asset",
    limit: int = FILENAME_SEGMENT_LIMIT,
) -> str:
    raw = str(value or "").strip()
    cleaned = re.sub(r'[\x00-\x1f<>:"/\\|?*]+', "_", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ._")
    if not cleaned:
        return fallback
    return cleaned[:limit] or fallback


def normalize_prompt_text(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    normalized = re.sub(r"\s+", " ", raw)
    normalized = re.sub(r"[\r\n\t]+", " ", normalized)
    normalized = normalized.strip(" ,.;:!?-_")
    return normalized


def extract_prompt_excerpt(*values: object, limit: int = PROMPT_EXCERPT_LIMIT) -> str | None:
    for value in values:
        normalized = normalize_prompt_text(_coerce_prompt_value(value))
        if normalized:
            return normalized[:limit]
    return None


def build_download_filename(
    *,
    prefix: str,
    prompt: object = None,
    preferred_name: str | None = None,
    fallback_name: str | None = None,
    sequence: int | str | None = None,
    url: str | None = None,
    asset_type: str | None = None,
    extension: str | None = None,
) -> str:
    prompt_excerpt = extract_prompt_excerpt(prompt)
    preferred_segment = sanitize_filename_segment(preferred_name, fallback="", limit=FILENAME_SEGMENT_LIMIT) if preferred_name else ""
    use_preferred_name = bool(preferred_segment and not is_generic_asset_name(preferred_segment))

    if use_preferred_name:
        base = preferred_segment
    else:
        base = sanitize_filename_segment(prefix or fallback_name or preferred_name, fallback="asset")

    if prompt_excerpt and prompt_excerpt not in base:
        base = f"{base}_{sanitize_filename_segment(prompt_excerpt, fallback='prompt', limit=PROMPT_EXCERPT_LIMIT)}"
    elif not use_preferred_name and fallback_name:
        fallback_segment = sanitize_filename_segment(fallback_name, fallback="", limit=FILENAME_SEGMENT_LIMIT)
        if fallback_segment and fallback_segment not in base:
            base = f"{base}_{fallback_segment}"

    if sequence is not None:
        base = f"{base}_{sequence}"

    suffix = normalize_extension(extension) or guess_extension(url, asset_type)
    return f"{sanitize_filename_segment(base, fallback='asset')}{suffix}"


def is_generic_asset_name(value: str | None) -> bool:
    cleaned = sanitize_filename_segment(value, fallback="", limit=FILENAME_SEGMENT_LIMIT)
    if not cleaned:
        return True
    return any(pattern.match(cleaned) for pattern in _GENERIC_NAME_PATTERNS)


def guess_extension(url: str | None, asset_type: str | None = None) -> str:
    parsed = urlparse(url or "")
    suffix = Path(unquote(parsed.path or url or "")).suffix.lower()
    if suffix:
        return suffix
    return get_media_fallback_extension(asset_type)


def normalize_extension(value: str | None) -> str | None:
    cleaned = str(value or "").strip()
    if not cleaned:
        return None
    return cleaned if cleaned.startswith(".") else f".{cleaned}"


def _coerce_prompt_value(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("input_prompt", "prompt", "prompt_resolved", "prompt_raw", "original_prompt", "text", "content"):
            nested = _coerce_prompt_value(value.get(key))
            if nested:
                return nested
        return None
    if isinstance(value, (list, tuple)):
        for item in value:
            nested = _coerce_prompt_value(item)
            if nested:
                return nested
        return None
    return str(value)
