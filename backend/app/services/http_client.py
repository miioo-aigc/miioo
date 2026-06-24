from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Literal

import httpx

from app.config import settings
from app.observability import truncate_for_log

UpstreamProfile = Literal["provider", "model", "media"]

_PROFILE_SETTINGS = {
    "provider": "UPSTREAM_PROVIDER_MAX_CONCURRENCY",
    "model": "UPSTREAM_MODEL_MAX_CONCURRENCY",
    "media": "UPSTREAM_MEDIA_MAX_CONCURRENCY",
}
_SEMAPHORES: dict[str, asyncio.Semaphore] = {}
logger = logging.getLogger("app.upstream")


def _resolve_profile_limit(profile: UpstreamProfile) -> int:
    setting_name = _PROFILE_SETTINGS.get(profile, "UPSTREAM_PROVIDER_MAX_CONCURRENCY")
    return max(int(getattr(settings, setting_name, 8)), 1)


def _get_semaphore(profile: UpstreamProfile) -> asyncio.Semaphore:
    semaphore = _SEMAPHORES.get(profile)
    if semaphore is None:
        semaphore = asyncio.Semaphore(_resolve_profile_limit(profile))
        _SEMAPHORES[profile] = semaphore
    return semaphore


def build_upstream_limits() -> httpx.Limits:
    return httpx.Limits(
        max_connections=max(int(settings.UPSTREAM_HTTP_MAX_CONNECTIONS), 1),
        max_keepalive_connections=max(int(settings.UPSTREAM_HTTP_MAX_KEEPALIVE_CONNECTIONS), 1),
        keepalive_expiry=max(int(settings.UPSTREAM_HTTP_KEEPALIVE_EXPIRY_SECONDS), 1),
    )


def classify_upstream_error(exc: Exception) -> dict[str, str | int | None]:
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code if exc.response else None
        category = "http_status"
        retryable = False
        if status_code in {408, 429, 500, 502, 503, 504}:
            category = "retryable_http_status"
            retryable = True
        return {
            "category": category,
            "status_code": status_code,
            "retryable": retryable,
            "message": str(exc),
        }
    if isinstance(exc, httpx.TimeoutException):
        return {
            "category": "timeout",
            "status_code": None,
            "retryable": True,
            "message": str(exc),
        }
    if isinstance(exc, httpx.RequestError):
        return {
            "category": "request_error",
            "status_code": None,
            "retryable": True,
            "message": str(exc),
        }
    return {
        "category": "unexpected",
        "status_code": None,
        "retryable": False,
        "message": str(exc),
    }


def _format_upstream_log_context(context: dict[str, Any] | None) -> str:
    if not context:
        return ""

    parts: list[str] = []
    for key in sorted(context):
        value = context[key]
        if value is None:
            continue
        parts.append(f"{key}={truncate_for_log(value, limit=120)}")
    return " ".join(parts)


def log_upstream_failure(
    *,
    profile: UpstreamProfile,
    operation: str,
    exc: Exception,
    context: dict[str, Any] | None = None,
) -> dict[str, str | int | bool | None]:
    detail = classify_upstream_error(exc)
    message = (
        "upstream failure profile=%s operation=%s category=%s "
        "retryable=%s status_code=%s detail=%s"
    )
    extra_context = _format_upstream_log_context(context)
    log_args = (
        profile,
        operation,
        detail["category"],
        detail["retryable"],
        detail["status_code"],
        truncate_for_log(detail["message"], limit=240),
    )

    if extra_context:
        message = f"{message} context={extra_context}"

    level = logging.WARNING if detail["retryable"] else logging.ERROR
    logger.log(level, message, *log_args)
    return detail


@asynccontextmanager
async def upstream_async_client(
    *,
    profile: UpstreamProfile = "provider",
    timeout: httpx.Timeout | float | None = None,
    follow_redirects: bool = False,
) -> AsyncIterator[httpx.AsyncClient]:
    semaphore = _get_semaphore(profile)
    await semaphore.acquire()
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=follow_redirects,
            limits=build_upstream_limits(),
        ) as client:
            yield client
    finally:
        semaphore.release()
