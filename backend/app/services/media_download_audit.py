from __future__ import annotations

import logging
from typing import Any

from app.observability import truncate_for_log

logger = logging.getLogger("app.media_download")


def _format_context(context: dict[str, Any] | None) -> str:
    if not context:
        return ""

    parts: list[str] = []
    for key in sorted(context):
        value = context[key]
        if value is None:
            continue
        parts.append(f"{key}={truncate_for_log(value, limit=120)}")
    return " ".join(parts)


def _resolve_log_level(outcome: str) -> int:
    normalized = str(outcome or "").strip().lower()
    if normalized in {"redirected", "resolved", "passthrough"}:
        return logging.INFO
    if normalized in {"invalid_token", "forbidden", "not_found", "rejected"}:
        return logging.WARNING
    return logging.ERROR


def audit_media_download(
    *,
    event: str,
    outcome: str,
    user_id: str | int | None,
    payload: dict[str, Any] | None = None,
    download_url: str | None = None,
    resolved_target: str | None = None,
    detail: str | None = None,
    context: dict[str, Any] | None = None,
) -> None:
    payload = payload or {}
    message = (
        "media download audit event=%s outcome=%s user_id=%s project_id=%s "
        "resource_id=%s access_level=%s storage_mode=%s storage_key=%s "
        "download_url=%s resolved_target=%s detail=%s"
    )
    extra_context = _format_context(context)
    if extra_context:
        message = f"{message} context={extra_context}"

    logger.log(
        _resolve_log_level(outcome),
        message,
        event,
        outcome,
        str(user_id or "").strip() or "-",
        str(payload.get("project_id") or "").strip() or "-",
        str(payload.get("resource_id") or "").strip() or "-",
        str(payload.get("access_level") or "").strip() or "-",
        str(payload.get("storage_mode") or "").strip() or "-",
        str(payload.get("storage_key") or "").strip() or "-",
        truncate_for_log(download_url, limit=200),
        truncate_for_log(resolved_target, limit=200),
        truncate_for_log(detail, limit=200),
    )
