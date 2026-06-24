from __future__ import annotations

from urllib.parse import urlparse

from app.services.media_delivery_urls import build_object_storage_public_url
from app.services.media_download_audit import audit_media_download
from app.services.media_download_signing import MediaDownloadTokenError, verify_download_token
from app.utils.url_security import validate_outbound_url

CONTROLLED_DOWNLOAD_PREFIX = "/api/media/downloads/"


class MediaDownloadAccessError(ValueError):
    def __init__(self, detail: str, *, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def is_controlled_download_url(url: str | None) -> bool:
    if not isinstance(url, str):
        return False
    parsed = urlparse(url)
    path = parsed.path or url
    return path.startswith(CONTROLLED_DOWNLOAD_PREFIX)


def extract_controlled_download_token(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path or url
    if not path.startswith(CONTROLLED_DOWNLOAD_PREFIX):
        raise MediaDownloadAccessError("不是受控下载地址", status_code=400)
    token = path.removeprefix(CONTROLLED_DOWNLOAD_PREFIX).strip().strip("/")
    if not token:
        raise MediaDownloadAccessError("受控下载 token 缺失", status_code=400)
    return token


def resolve_download_target(payload: dict) -> str:
    explicit_download_url = str(payload.get("download_url") or "").strip()
    if explicit_download_url:
        if explicit_download_url.startswith("/uploads/"):
            return explicit_download_url

        parsed = urlparse(explicit_download_url)
        if parsed.scheme in {"http", "https"}:
            return validate_outbound_url(explicit_download_url, label="媒体下载地址")
        raise MediaDownloadAccessError("下载地址非法", status_code=400)

    storage_mode = str(payload.get("storage_mode") or "").strip().lower()
    storage_bucket = str(payload.get("storage_bucket") or "").strip()
    storage_key = str(payload.get("storage_key") or "").strip().lstrip("/")
    if storage_mode == "managed_upload" and storage_key:
        return f"/uploads/{storage_key}"
    if storage_mode == "object_storage" and storage_key:
        resolved_target = build_object_storage_public_url(
            bucket=storage_bucket or None,
            key=storage_key,
            prefer_cdn=False,
        )
        if resolved_target:
            return resolved_target

    raise MediaDownloadAccessError("下载资源不存在", status_code=404)


def resolve_verified_download_target_from_url(
    download_url: str,
    *,
    expected_user_id: str,
) -> str:
    if not is_controlled_download_url(download_url):
        audit_media_download(
            event="download_target_resolve",
            outcome="passthrough",
            user_id=expected_user_id,
            download_url=download_url,
            resolved_target=download_url,
            context={"delivery_mode": "legacy_direct", "controlled": False},
        )
        return download_url

    token = extract_controlled_download_token(download_url)
    try:
        payload = verify_download_token(token)
    except MediaDownloadTokenError as exc:
        audit_media_download(
            event="download_target_resolve",
            outcome="invalid_token",
            user_id=expected_user_id,
            download_url=download_url,
            detail=str(exc),
            context={"delivery_mode": "internal_resolve", "controlled": True},
        )
        raise MediaDownloadAccessError(str(exc), status_code=401) from exc

    token_user_id = str(payload.get("user_id") or "").strip()
    if not token_user_id or token_user_id != expected_user_id:
        audit_media_download(
            event="download_target_resolve",
            outcome="forbidden",
            user_id=expected_user_id,
            payload=payload,
            download_url=download_url,
            detail="当前用户无权访问该下载资源",
            context={"delivery_mode": "internal_resolve", "controlled": True},
        )
        raise MediaDownloadAccessError("当前用户无权访问该下载资源", status_code=403)

    try:
        target_url = resolve_download_target(payload)
    except MediaDownloadAccessError as exc:
        audit_media_download(
            event="download_target_resolve",
            outcome="not_found" if exc.status_code == 404 else "rejected",
            user_id=expected_user_id,
            payload=payload,
            download_url=download_url,
            detail=exc.detail,
            context={"delivery_mode": "internal_resolve", "controlled": True},
        )
        raise

    audit_media_download(
        event="download_target_resolve",
        outcome="resolved",
        user_id=expected_user_id,
        payload=payload,
        download_url=download_url,
        resolved_target=target_url,
        context={"delivery_mode": "internal_resolve", "controlled": True},
    )
    return target_url
