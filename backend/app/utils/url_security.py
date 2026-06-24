import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import HTTPException

from app.config import settings


def _is_private_host(hostname: str) -> bool:
    normalized = hostname.strip().lower()
    if normalized in {"localhost", "localhost.localdomain"}:
        return True

    try:
        addresses = socket.getaddrinfo(normalized, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return True

    for _, _, _, _, sockaddr in addresses:
        host = sockaddr[0]
        ip = ipaddress.ip_address(host)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return True

    return False


def validate_outbound_url(
    url: str,
    *,
    allow_private: bool = False,
    label: str = "URL",
) -> str:
    cleaned = (url or "").strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail=f"{label} 仅支持 http 或 https")
    if not parsed.netloc or not parsed.hostname:
        raise HTTPException(status_code=400, detail=f"{label} 无效")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail=f"{label} 不允许包含账号信息")
    if not allow_private and not settings.ALLOW_PRIVATE_OUTBOUND_URLS and _is_private_host(parsed.hostname):
        raise HTTPException(status_code=400, detail=f"{label} 不允许指向内网或本机地址")
    return cleaned
