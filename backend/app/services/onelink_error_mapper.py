from __future__ import annotations

import json
import re
from typing import Any

import httpx


UNKNOWN_ONELINK_ERROR_MESSAGE = "OneLinkAI 返回了暂时无法识别的错误，请稍后重试"


def _parse_json_object(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _pick_first_string(payload: Any, paths: list[tuple[str, ...]]) -> str | None:
    for path in paths:
        current = payload
        valid = True
        for part in path:
            if isinstance(current, dict):
                current = current.get(part)
                continue
            valid = False
            break
        if not valid:
            continue
        if isinstance(current, str) and current.strip():
            return current.strip()
    return None


def _extract_request_id(payload: dict[str, Any] | None, response_text: str | None) -> str | None:
    request_id = _pick_first_string(
        payload,
        [
            ("request_id",),
            ("req_id",),
            ("trace_id",),
            ("error", "request_id"),
            ("error", "req_id"),
            ("detail", "request_id"),
        ],
    )
    if request_id:
        return request_id
    if not isinstance(response_text, str):
        return None
    match = re.search(r"(?:request[_\s-]*id|req[_\s-]*id|trace[_\s-]*id)[:= ]+([A-Za-z0-9._-]+)", response_text, re.IGNORECASE)
    return match.group(1) if match else None


def _extract_message_payload(
    *,
    payload: dict[str, Any] | None,
    response_text: str | None,
) -> tuple[str | None, str | None, str | None]:
    message = _pick_first_string(
        payload,
        [
            ("detail", "message"),
            ("error", "message"),
            ("detail",),
            ("message",),
            ("error",),
            ("msg",),
        ],
    )
    provider_code = _pick_first_string(
        payload,
        [
            ("error", "code"),
            ("code",),
            ("detail", "code"),
            ("type",),
            ("error", "type"),
        ],
    )
    nested_payload = _parse_json_object(message) if message else None
    if nested_payload:
        nested_message = _pick_first_string(
            nested_payload,
            [
                ("error", "message"),
                ("message",),
                ("detail",),
                ("error",),
            ],
        )
        nested_code = _pick_first_string(
            nested_payload,
            [
                ("error", "code"),
                ("code",),
                ("type",),
            ],
        )
        if nested_message:
            message = nested_message
        if nested_code and not provider_code:
            provider_code = nested_code

    if not message and isinstance(response_text, str):
        stripped = response_text.strip()
        if stripped:
            message = stripped
    request_id = _extract_request_id(payload, response_text)
    return message, provider_code, request_id


def _normalize_message(message: str | None) -> str:
    return str(message or "").strip().lower()


def _append_request_id(message: str, request_id: str | None) -> str:
    if not request_id:
        return message
    return f"{message}（请求编号：{request_id}）"


def map_onelink_error(
    *,
    exc: Exception | None = None,
    payload: dict[str, Any] | None = None,
    response_text: str | None = None,
    status_code: int | None = None,
    model: str | None = None,
    route: str | None = None,
) -> dict[str, Any]:
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response is not None:
            status_code = exc.response.status_code
            if response_text is None:
                try:
                    response_text = exc.response.text
                except Exception:
                    response_text = None
    elif isinstance(exc, httpx.TimeoutException):
        if response_text is None:
            response_text = str(exc)
    elif response_text is None and exc is not None:
        response_text = str(exc)

    response_payload = payload or _parse_json_object(response_text)
    raw_message, provider_code, request_id = _extract_message_payload(
        payload=response_payload,
        response_text=response_text,
    )
    normalized_message = _normalize_message(raw_message)
    normalized_code = _normalize_message(provider_code)
    normalized_model = str(model or "").strip()
    normalized_route = str(route or "").strip()

    if isinstance(exc, httpx.TimeoutException) or status_code in {408, 504, 524} or any(
        token in normalized_message for token in ("timeout", "timed out", "time out", "deadline exceeded")
    ):
        return {
            "user_message": _append_request_id("OneLinkAI 响应超时，请稍后重试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if status_code == 429 or any(
        token in normalized_message for token in ("rate limit", "too many requests", "requests per minute", "quota exceeded")
    ):
        return {
            "user_message": _append_request_id("OneLinkAI 当前请求过于频繁，请稍后再试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if any(
        token in normalized_message or token in normalized_code
        for token in (
            "insufficient quota",
            "insufficient balance",
            "quota insufficient",
            "balance",
            "budget",
            "credit balance",
            "quota_exceeded",
        )
    ):
        return {
            "user_message": _append_request_id("OneLinkAI 余额或额度不足，请充值后重试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if status_code in {401, 403} or any(
        token in normalized_message for token in ("unauthorized", "authentication", "invalid api key", "api key", "forbidden")
    ):
        return {
            "user_message": _append_request_id("OneLinkAI API Key 无效、已过期或当前无权限访问该能力", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if any(
        token in normalized_message for token in (
            "model_not_found",
            "model does not exist",
            "unknown model",
            "unsupported model",
            "model not found",
            "not allowed to use this model",
            "permission denied for model",
        )
    ):
        model_prefix = f"模型 {normalized_model} 当前不可用" if normalized_model else "当前模型不可用"
        return {
            "user_message": _append_request_id(f"{model_prefix}，请更换其他模型后重试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if any(
        token in normalized_message or token in normalized_code
        for token in (
            "content policy",
            "moderation",
            "unsafe",
            "sensitive",
            "privacyinformation",
            "privacy information",
            "real person",
            "safety",
        )
    ):
        route_prefix = f"{normalized_route}请求内容" if normalized_route else "请求内容"
        return {
            "user_message": _append_request_id(f"{route_prefix}触发了内容安全或隐私风控，请调整后重试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if status_code in {400, 422} or any(
        token in normalized_message for token in ("invalid", "validation", "bad request", "parameter", "unsupported size")
    ):
        detail = "请检查请求参数是否完整、模型是否支持当前尺寸/时长/参考素材后重试"
        return {
            "user_message": _append_request_id(f"OneLinkAI 请求参数不合法，{detail}", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    if status_code in {500, 502, 503} or any(
        token in normalized_message for token in ("internal server error", "upstream", "service unavailable", "bad gateway")
    ):
        return {
            "user_message": _append_request_id("OneLinkAI 服务暂时不可用，请稍后重试", request_id),
            "status_code": status_code,
            "provider_code": provider_code,
            "request_id": request_id,
            "raw_message": raw_message,
        }

    return {
        "user_message": _append_request_id(UNKNOWN_ONELINK_ERROR_MESSAGE, request_id),
        "status_code": status_code,
        "provider_code": provider_code,
        "request_id": request_id,
        "raw_message": raw_message,
    }


def describe_onelink_http_error(
    exc: httpx.HTTPStatusError,
    *,
    model: str | None = None,
    route: str | None = None,
) -> str:
    return map_onelink_error(exc=exc, model=model, route=route)["user_message"]


def describe_onelink_timeout_error(
    exc: httpx.TimeoutException,
    *,
    model: str | None = None,
    route: str | None = None,
) -> str:
    return map_onelink_error(exc=exc, model=model, route=route)["user_message"]


def describe_onelink_response_error(
    *,
    response_text: str | None,
    status_code: int | None,
    model: str | None = None,
    route: str | None = None,
) -> str:
    return map_onelink_error(
        response_text=response_text,
        status_code=status_code,
        model=model,
        route=route,
    )["user_message"]
