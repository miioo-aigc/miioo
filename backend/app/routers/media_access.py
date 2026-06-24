from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.dependencies import get_current_user
from app.models.user import User
from app.services.media_download_audit import audit_media_download
from app.services.media_download_runtime import (
    MediaDownloadAccessError,
    resolve_download_target,
)
from app.services.media_download_signing import MediaDownloadTokenError, verify_download_token

router = APIRouter()


@router.get(
    "/downloads/{token}",
    summary="受控下载媒体资源",
    description="校验短时下载 token 与当前登录用户后，302 跳转到实际媒体下载地址。",
    response_description="302 跳转到实际媒体资源地址。",
)
async def download_media_resource(
    token: str,
    user: User = Depends(get_current_user),
):
    try:
        payload = verify_download_token(token)
    except MediaDownloadTokenError as exc:
        audit_media_download(
            event="controlled_download",
            outcome="invalid_token",
            user_id=str(user.id),
            download_url=f"/api/media/downloads/{token}",
            detail=str(exc),
            context={"delivery_mode": "redirect", "controlled": True},
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    token_user_id = str(payload.get("user_id") or "").strip()
    if not token_user_id or token_user_id != str(user.id):
        audit_media_download(
            event="controlled_download",
            outcome="forbidden",
            user_id=str(user.id),
            payload=payload,
            download_url=f"/api/media/downloads/{token}",
            detail="当前用户无权访问该下载资源",
            context={"delivery_mode": "redirect", "controlled": True},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前用户无权访问该下载资源")

    try:
        target_url = resolve_download_target(payload)
    except MediaDownloadAccessError as exc:
        audit_media_download(
            event="controlled_download",
            outcome="not_found" if exc.status_code == 404 else "rejected",
            user_id=str(user.id),
            payload=payload,
            download_url=f"/api/media/downloads/{token}",
            detail=exc.detail,
            context={"delivery_mode": "redirect", "controlled": True},
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    audit_media_download(
        event="controlled_download",
        outcome="redirected",
        user_id=str(user.id),
        payload=payload,
        download_url=f"/api/media/downloads/{token}",
        resolved_target=target_url,
        context={"delivery_mode": "redirect", "controlled": True},
    )
    return RedirectResponse(url=target_url, status_code=status.HTTP_302_FOUND)
