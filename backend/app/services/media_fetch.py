from __future__ import annotations

from urllib.parse import urlparse

from app.services.http_client import upstream_async_client
from app.services.media_storage import resolve_upload_path
from app.utils.url_security import validate_outbound_url


async def read_media_bytes(
    url: str,
    *,
    label: str,
    timeout: float = 60.0,
    follow_redirects: bool = True,
) -> bytes:
    if url.startswith("/uploads/"):
        local_path = resolve_upload_path(url)
        if not local_path.exists() or not local_path.is_file():
            raise FileNotFoundError(f"本地文件不存在: {url}")
        return local_path.read_bytes()

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"不支持的下载地址: {url}")

    safe_url = validate_outbound_url(url, label=label)
    async with upstream_async_client(
        profile="media",
        timeout=timeout,
        follow_redirects=follow_redirects,
    ) as client:
        response = await client.get(safe_url)
        response.raise_for_status()
        return response.content
