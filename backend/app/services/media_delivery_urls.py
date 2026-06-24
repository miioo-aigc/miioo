from __future__ import annotations

from urllib.parse import quote

from app.config import settings


def _clean_string(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None


def _join_url(base_url: str, *parts: str) -> str:
    normalized = [base_url.rstrip("/")]
    for part in parts:
        cleaned = part.strip().strip("/")
        if cleaned:
            normalized.append(quote(cleaned, safe="/:@"))
    return "/".join(normalized)


def _default_cos_origin_url(bucket: str, key: str) -> str | None:
    provider = (_clean_string(getattr(settings, "MEDIA_OBJECT_STORAGE_PROVIDER", "")) or "").lower()
    if provider and provider != "tencent_cos":
        return None

    region = _clean_string(getattr(settings, "MEDIA_OBJECT_STORAGE_REGION", ""))
    if not region:
        return None
    return f"https://{bucket}.cos.{region}.myqcloud.com/{quote(key, safe='/:@')}"


def build_object_storage_public_url(
    *,
    bucket: str | None,
    key: str | None,
    prefer_cdn: bool,
) -> str | None:
    resolved_bucket = _clean_string(bucket)
    resolved_key = _clean_string(key)
    if not resolved_bucket or not resolved_key:
        return None

    configured_base_url = None
    if prefer_cdn:
        configured_base_url = _clean_string(getattr(settings, "MEDIA_CDN_BASE_URL", ""))
    if not configured_base_url:
        configured_base_url = _clean_string(getattr(settings, "MEDIA_PUBLIC_BASE_URL", ""))
    if configured_base_url:
        return _join_url(configured_base_url, resolved_bucket, resolved_key)

    return _default_cos_origin_url(resolved_bucket, resolved_key)
