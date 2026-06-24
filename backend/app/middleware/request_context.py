import json
import logging
import urllib.request
from time import perf_counter

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.observability import (
    REQUEST_ID_HEADER,
    coerce_log_level,
    elapsed_ms,
    generate_request_id,
    reset_request_id,
    set_request_id,
)

logger = logging.getLogger("app.request")


# #region debug-point A:request-context
def _debug_report(hypothesis_id: str, location: str, msg: str, data: dict | None = None) -> None:
    import os

    payload = {
        "sessionId": "auth-login-500",
        "runId": "pre-fix",
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": f"[DEBUG] {msg}",
        "data": data or {},
    }
    url = "http://127.0.0.1:7777/event"
    env_path = os.path.join(".dbg", "auth-login-500.env")
    try:
        with open(env_path, encoding="utf-8") as env_file:
            for line in env_file:
                if line.startswith("DEBUG_SERVER_URL="):
                    url = line.split("=", 1)[1].strip() or url
                elif line.startswith("DEBUG_SESSION_ID="):
                    payload["sessionId"] = line.split("=", 1)[1].strip() or payload["sessionId"]
    except Exception:
        pass
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                url,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=0.8,
        ).read()
    except Exception:
        pass
# #endregion


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(raw=scope.get("headers", []))
        # #region debug-point A:request-enter
        if scope.get("path") == "/api/auth/verify-code-login":
            _debug_report(
                "A",
                "request_context.py:request-enter",
                "verify-code-login request entered middleware",
                {
                    "method": scope.get("method", "UNKNOWN"),
                    "origin": headers.get("origin"),
                        "host": headers.get("host"),
                    "content_type": headers.get("content-type"),
                },
            )
        # #endregion
        request_id = headers.get(REQUEST_ID_HEADER) or generate_request_id()
        token = set_request_id(request_id)
        scope.setdefault("state", {})["request_id"] = request_id

        start_time = perf_counter()
        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "/")
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            # #region debug-point A:request-exception
            if path == "/api/auth/verify-code-login":
                _debug_report(
                    "A",
                    "request_context.py:request-exception",
                    "verify-code-login raised application exception",
                    {
                        "method": method,
                        "path": path,
                        "request_id": request_id,
                    },
                )
            # #endregion
            duration_ms = elapsed_ms(start_time)
            logger.exception(
                "request failed method=%s path=%s status_code=500 duration_ms=%.2f",
                method,
                path,
                duration_ms,
            )
            raise
        else:
            duration_ms = elapsed_ms(start_time)
            # #region debug-point A:request-exit
            if path == "/api/auth/verify-code-login":
                _debug_report(
                    "A",
                    "request_context.py:request-exit",
                    "verify-code-login completed middleware",
                    {
                        "method": method,
                        "status_code": status_code,
                        "request_id": request_id,
                    },
                )
            # #endregion
            level = (
                logging.WARNING
                if duration_ms >= settings.SLOW_REQUEST_THRESHOLD_MS
                else coerce_log_level(settings.REQUEST_LOG_LEVEL)
            )
            message = (
                "slow request method=%s path=%s status_code=%s duration_ms=%.2f"
                if duration_ms >= settings.SLOW_REQUEST_THRESHOLD_MS
                else "request completed method=%s path=%s status_code=%s duration_ms=%.2f"
            )
            logger.log(
                level,
                message,
                method,
                path,
                status_code,
                duration_ms,
            )
        finally:
            reset_request_id(token)
