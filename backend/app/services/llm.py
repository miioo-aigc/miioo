from collections.abc import AsyncGenerator

import json
import time
import urllib.request
import uuid

import httpx

from app.services.http_client import upstream_async_client
from app.utils.onelink_base_url import get_onelink_openai_compat_base_url


DEBUG_ENV_PATH = "/Users/xingyi/Desktop/打通前后端 2/.dbg/storyboard-524-timeout.env"
DEBUG_LOG_PATH = "/Users/xingyi/Desktop/打通前后端 2/.dbg/trae-debug-log-storyboard-524-timeout.ndjson"


def _send_storyboard_debug_event(trace_id: str, msg: str, data: dict) -> None:
    debug_url = "http://127.0.0.1:7777/event"
    try:
        with open(DEBUG_ENV_PATH, encoding="utf-8") as env_file:
            for line in env_file:
                if line.startswith("DEBUG_SERVER_URL="):
                    debug_url = line.split("=", 1)[1].strip() or debug_url
                    break
    except Exception:
        pass

    payload = {
        "sessionId": "storyboard-524-timeout",
        "runId": "pre-fix",
        "hypothesisId": "A",
        "traceId": trace_id,
        "location": "app/services/llm.py:chat_completion",
        "msg": msg,
        "data": data,
        "ts": int(time.time() * 1000),
    }
    serialized_payload = json.dumps(payload, ensure_ascii=False)
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as log_file:
            log_file.write(serialized_payload + "\n")
    except Exception:
        pass
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                debug_url,
                data=serialized_payload.encode("utf-8"),
                headers={"Content-Type": "application/json"},
            ),
            timeout=1,
        ).read()
    except Exception:
        pass


class LLMService:
    def __init__(self):
        pass

    def _headers(self, api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def chat_completion(
        self,
        messages: list[dict],
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        model: str | None = None,
        default_model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: float = 120.0,
        trace_id: str | None = None,
    ) -> dict:
        payload: dict = {
            "model": model or default_model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        request_base_url = get_onelink_openai_compat_base_url(base_url)
        # #region debug-point A:llm-chat-start
        _dbg_started_at = time.perf_counter(); _dbg_trace_id = trace_id or f"llm-{uuid.uuid4().hex[:8]}"; _dbg_messages_chars = sum(len(json.dumps(message, ensure_ascii=False)) for message in messages); _send_storyboard_debug_event(_dbg_trace_id, "[DEBUG] LLM chat start", {"model": payload["model"], "base_url": request_base_url, "timeout": timeout, "temperature": temperature, "max_tokens": max_tokens, "messages_count": len(messages), "messages_chars": _dbg_messages_chars})
        # #endregion
        async with upstream_async_client(profile="model", timeout=timeout) as client:
            try:
                resp = await client.post(
                    f"{request_base_url.rstrip('/')}/v1/chat/completions",
                    headers=self._headers(api_key),
                    json=payload,
                )
                resp.raise_for_status()
                # #region debug-point A:llm-chat-success
                _send_storyboard_debug_event(_dbg_trace_id, "[DEBUG] LLM chat success", {"model": payload["model"], "status_code": resp.status_code, "elapsed_ms": round((time.perf_counter() - _dbg_started_at) * 1000, 2), "response_chars": len(resp.text), "request_url": str(resp.request.url)})
                # #endregion
                return resp.json()
            except httpx.HTTPStatusError as exc:
                # #region debug-point A:llm-chat-http-error
                _send_storyboard_debug_event(_dbg_trace_id, "[DEBUG] LLM chat HTTP error", {"model": payload["model"], "elapsed_ms": round((time.perf_counter() - _dbg_started_at) * 1000, 2), "status_code": getattr(exc.response, "status_code", None), "error_type": type(exc).__name__, "response_text": (exc.response.text or "")[:400], "request_url": str(exc.request.url) if exc.request else None})
                # #endregion
                raise
            except httpx.TimeoutException as exc:
                # #region debug-point A:llm-chat-timeout
                _send_storyboard_debug_event(_dbg_trace_id, "[DEBUG] LLM chat timeout", {"model": payload["model"], "elapsed_ms": round((time.perf_counter() - _dbg_started_at) * 1000, 2), "error_type": type(exc).__name__, "request_url": str(exc.request.url) if getattr(exc, "request", None) else None})
                # #endregion
                raise
            except Exception as exc:
                # #region debug-point A:llm-chat-unexpected
                _send_storyboard_debug_event(_dbg_trace_id, "[DEBUG] LLM chat unexpected error", {"model": payload["model"], "elapsed_ms": round((time.perf_counter() - _dbg_started_at) * 1000, 2), "error_type": type(exc).__name__, "error_message": str(exc)[:400]})
                # #endregion
                raise

    async def stream_chat_completion(
        self,
        messages: list[dict],
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        model: str | None = None,
        default_model: str = "gpt-4o",
        temperature: float = 0.7,
        max_tokens: int | None = None,
        timeout: float = 120.0,
    ) -> AsyncGenerator[str, None]:
        payload: dict = {
            "model": model or default_model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        request_base_url = get_onelink_openai_compat_base_url(base_url)
        async with upstream_async_client(profile="model", timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{request_base_url.rstrip('/')}/v1/chat/completions",
                headers=self._headers(api_key),
                json=payload,
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield line + "\n\n"

    async def list_models(
        self,
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
    ) -> list[dict]:
        request_base_url = get_onelink_openai_compat_base_url(base_url)
        async with upstream_async_client(profile="model", timeout=10.0) as client:
            resp = await client.get(
                f"{request_base_url.rstrip('/')}/v1/models",
                headers=self._headers(api_key),
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [])


llm_service = LLMService()
