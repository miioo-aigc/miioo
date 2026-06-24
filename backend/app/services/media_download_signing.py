from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import settings


class MediaDownloadTokenError(ValueError):
    """Raised when a media download token is invalid or expired."""


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _get_signing_secret() -> bytes:
    return settings.media_download_token_secret.encode("utf-8")


def _sign_payload(payload_bytes: bytes) -> str:
    signature = hmac.new(_get_signing_secret(), payload_bytes, hashlib.sha256).digest()
    return _base64url_encode(signature)


def issue_download_token(
    *,
    user_id: str | int,
    project_id: str | int | None,
    resource_id: str,
    storage_key: str,
    access_level: str,
    storage_mode: str | None = None,
    storage_bucket: str | None = None,
    download_url: str | None = None,
    expires_in: int | None = None,
) -> str:
    issued_at = int(time.time())
    ttl_seconds = max(
        int(expires_in or settings.MEDIA_DOWNLOAD_TOKEN_EXPIRE_SECONDS),
        1,
    )
    payload: dict[str, Any] = {
        "user_id": str(user_id),
        "project_id": None if project_id is None else str(project_id),
        "resource_id": str(resource_id),
        "storage_key": str(storage_key),
        "access_level": str(access_level),
        "storage_mode": None if storage_mode is None else str(storage_mode),
        "storage_bucket": None if storage_bucket is None else str(storage_bucket),
        "download_url": None if download_url is None else str(download_url),
        "issued_at": issued_at,
        "expires_at": issued_at + ttl_seconds,
        "nonce": secrets.token_urlsafe(8),
    }
    payload_bytes = json.dumps(
        payload,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    payload_part = _base64url_encode(payload_bytes)
    signature_part = _sign_payload(payload_bytes)
    return f"{payload_part}.{signature_part}"


def build_controlled_download_url(token: str) -> str:
    return f"/api/media/downloads/{token}"


def verify_download_token(token: str) -> dict[str, Any]:
    if not isinstance(token, str) or "." not in token:
        raise MediaDownloadTokenError("非法下载 token")

    payload_part, signature_part = token.split(".", 1)
    try:
        payload_bytes = _base64url_decode(payload_part)
    except Exception as exc:  # pragma: no cover - defensive decode guard
        raise MediaDownloadTokenError("下载 token 解码失败") from exc

    expected_signature = _sign_payload(payload_bytes)
    if not hmac.compare_digest(signature_part, expected_signature):
        raise MediaDownloadTokenError("下载 token 签名无效")

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise MediaDownloadTokenError("下载 token 载荷非法") from exc

    expires_at = payload.get("expires_at")
    if not isinstance(expires_at, int):
        raise MediaDownloadTokenError("下载 token 缺少过期时间")
    if expires_at < int(time.time()):
        raise MediaDownloadTokenError("下载 token 已过期")

    return payload
