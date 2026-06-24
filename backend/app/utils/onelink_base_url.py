from urllib.parse import urlsplit, urlunsplit


ONELINK_CANONICAL_BASE_URL = "https://api.onelinkai.cloud"
ONELINK_OPENAI_COMPAT_BASE_URL = "https://api.onelinkai.cloud"
_LEGACY_ONELINK_HOSTS = {
    "api.onelinkai.cloud",
}
_OPENAI_COMPAT_HOSTS = {
    "api.onelinkai.cloud",
}


def _strip_trailing_openai_path(path: str) -> str:
    normalized_path = path.rstrip("/")
    if normalized_path == "/v1":
        return ""
    return path


def normalize_onelink_base_url(base_url: str | None) -> str | None:
    """Map legacy OneLinkAI hosts to the current canonical gateway domain."""
    if not base_url:
        return base_url

    parsed = urlsplit(base_url.strip())
    hostname = parsed.hostname or ""
    if hostname not in _LEGACY_ONELINK_HOSTS:
        return base_url.strip()

    canonical = urlsplit(ONELINK_CANONICAL_BASE_URL)
    return urlunsplit(
        (
            canonical.scheme,
            canonical.netloc,
            _strip_trailing_openai_path(parsed.path),
            parsed.query,
            parsed.fragment,
        )
    )


def get_onelink_openai_compat_base_url(base_url: str | None) -> str:
    """Return the stable OpenAI-compatible host for chat/models/tts style APIs."""
    if not base_url:
        return ONELINK_OPENAI_COMPAT_BASE_URL

    parsed = urlsplit(base_url.strip())
    hostname = parsed.hostname or ""
    if hostname not in _OPENAI_COMPAT_HOSTS:
        return base_url.strip()

    compat = urlsplit(ONELINK_OPENAI_COMPAT_BASE_URL)
    return urlunsplit(
        (
            compat.scheme,
            compat.netloc,
            _strip_trailing_openai_path(parsed.path),
            parsed.query,
            parsed.fragment,
        )
    )
