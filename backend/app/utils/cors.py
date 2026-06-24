from __future__ import annotations

import ipaddress
from urllib.parse import urlsplit


def _is_ip_address(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except ValueError:
        return False


def _should_expand_www_variant(hostname: str) -> bool:
    if not hostname or hostname.endswith(".local") or _is_ip_address(hostname):
        return False
    if hostname.startswith("www."):
        return True
    return hostname.count(".") == 1


def expand_allowed_origin_variants(origin: str) -> list[str]:
    normalized = str(origin or "").strip().rstrip("/")
    if not normalized:
        return []

    parsed = urlsplit(normalized)
    if not parsed.scheme or not parsed.netloc:
        return [normalized]

    hostname = parsed.hostname or ""
    variants = [normalized]
    if not _should_expand_www_variant(hostname):
        return variants

    alt_hostname = hostname[4:] if hostname.startswith("www.") else f"www.{hostname}"
    alt_netloc = (
        parsed.netloc[:-len(hostname)] + alt_hostname
        if parsed.netloc.endswith(hostname)
        else alt_hostname
    )
    alternate = parsed._replace(netloc=alt_netloc).geturl().rstrip("/")
    if alternate and alternate not in variants:
        variants.append(alternate)
    return variants


def build_allowed_origins(cors_origins: str) -> list[str]:
    ordered_origins: list[str] = []
    seen: set[str] = set()

    for raw_origin in str(cors_origins or "").split(","):
        for origin in expand_allowed_origin_variants(raw_origin):
            if origin in seen:
                continue
            seen.add(origin)
            ordered_origins.append(origin)

    return ordered_origins
