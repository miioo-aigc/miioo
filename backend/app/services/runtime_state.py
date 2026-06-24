from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from app.config import settings

try:
    from redis import asyncio as redis_asyncio
    from redis.exceptions import RedisError
except ImportError:  # pragma: no cover - exercised in environments without redis installed
    redis_asyncio = None

    class RedisError(Exception):
        """Fallback Redis error when redis-py is unavailable."""


logger = logging.getLogger("app.runtime_state")
_REDIS_KEY_PREFIX = "miioo:runtime-state"
_REDIS_UNAVAILABLE = object()

_redis_client = None
_redis_warning_logged = False

_memory_login_codes: dict[str, dict[str, Any]] = {}
_memory_qr_sessions: dict[str, dict[str, Any]] = {}
_memory_phone_rebind_codes: dict[str, dict[str, Any]] = {}
_memory_rate_limit_windows: dict[str, dict[str, Any]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_timezone(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_runtime_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"__type__": "datetime", "value": _ensure_timezone(value).isoformat()}
    if isinstance(value, date):
        return {"__type__": "date", "value": value.isoformat()}
    if isinstance(value, dict):
        return {key: _serialize_runtime_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_runtime_value(item) for item in value]
    return value


def _deserialize_runtime_value(value: Any) -> Any:
    if isinstance(value, dict):
        marker = value.get("__type__")
        if marker == "datetime":
            return _ensure_timezone(datetime.fromisoformat(str(value["value"])))
        if marker == "date":
            return date.fromisoformat(str(value["value"]))
        return {key: _deserialize_runtime_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_deserialize_runtime_value(item) for item in value]
    return value


def _remaining_ttl_seconds(expires_at: datetime) -> int:
    return max(1, int((_ensure_timezone(expires_at) - _utcnow()).total_seconds()))


def _build_runtime_key(namespace: str, key: str) -> str:
    return f"{_REDIS_KEY_PREFIX}:{namespace}:{key}"


def _log_redis_warning_once(message: str) -> None:
    global _redis_warning_logged
    if _redis_warning_logged:
        return
    logger.warning("%s; falling back to in-memory runtime state", message)
    _redis_warning_logged = True


async def _get_redis_client():
    global _redis_client
    if redis_asyncio is None:
        _log_redis_warning_once("redis dependency is not installed")
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = redis_asyncio.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception as exc:  # pragma: no cover - defensive path
        _log_redis_warning_once(f"failed to initialize redis client: {exc}")
        _redis_client = None
        return None


async def _redis_get_state(namespace: str, key: str) -> dict[str, Any] | None | object:
    client = await _get_redis_client()
    if client is None:
        return _REDIS_UNAVAILABLE
    try:
        raw = await client.get(_build_runtime_key(namespace, key))
    except RedisError as exc:
        _log_redis_warning_once(f"redis read failed: {exc}")
        return _REDIS_UNAVAILABLE
    if not raw:
        return None
    payload = json.loads(raw)
    return _deserialize_runtime_value(payload)


async def _redis_set_state(namespace: str, key: str, state: dict[str, Any], ttl_seconds: int) -> bool:
    client = await _get_redis_client()
    if client is None:
        return False
    try:
        await client.set(_build_runtime_key(namespace, key), json.dumps(_serialize_runtime_value(state)), ex=ttl_seconds)
        return True
    except RedisError as exc:
        _log_redis_warning_once(f"redis write failed: {exc}")
        return False


async def _redis_delete_state(namespace: str, key: str) -> bool:
    client = await _get_redis_client()
    if client is None:
        return False
    try:
        await client.delete(_build_runtime_key(namespace, key))
        return True
    except RedisError as exc:
        _log_redis_warning_once(f"redis delete failed: {exc}")
        return False


async def ensure_runtime_state_ready(*, require_redis: bool = False) -> None:
    client = await _get_redis_client()
    if client is None:
        if require_redis:
            raise RuntimeError("runtime state requires redis, but redis client is unavailable")
        return
    try:
        await client.ping()
    except RedisError as exc:
        if require_redis:
            raise RuntimeError(f"runtime state redis ping failed: {exc}") from exc
        _log_redis_warning_once(f"redis ping failed: {exc}")


async def check_rate_limit(
    namespace: str,
    key: str,
    *,
    limit: int,
    window_seconds: int,
) -> tuple[bool, int]:
    bucket_key = _build_runtime_key(f"rate-limit:{namespace}", key)
    client = await _get_redis_client()
    if client is not None:
        try:
            count = int(await client.incr(bucket_key))
            if count == 1:
                await client.expire(bucket_key, window_seconds)
            return count <= limit, max(0, limit - count)
        except RedisError as exc:
            _log_redis_warning_once(f"redis rate limit failed: {exc}")

    state = _memory_rate_limit_windows.get(bucket_key)
    now = _utcnow()
    if not state or _ensure_timezone(state["reset_at"]) <= now:
        state = {
            "count": 0,
            "reset_at": now.replace(microsecond=0) + timedelta(seconds=window_seconds),
        }
    state["count"] += 1
    _memory_rate_limit_windows[bucket_key] = state
    return state["count"] <= limit, max(0, limit - int(state["count"]))


def _memory_get_state(store: dict[str, dict[str, Any]], key: str) -> dict[str, Any] | None:
    state = store.get(key)
    if not state:
        return None
    expires_at = state.get("expires_at")
    if isinstance(expires_at, datetime) and _ensure_timezone(expires_at) <= _utcnow():
        store.pop(key, None)
        return None
    return dict(state)


def _memory_set_state(store: dict[str, dict[str, Any]], key: str, state: dict[str, Any]) -> None:
    store[key] = dict(state)


def _memory_delete_state(store: dict[str, dict[str, Any]], key: str) -> None:
    store.pop(key, None)


def _cleanup_expired_memory_store(store: dict[str, dict[str, Any]]) -> None:
    expired_keys = []
    now = _utcnow()
    for key, state in store.items():
        expires_at = state.get("expires_at")
        if isinstance(expires_at, datetime) and _ensure_timezone(expires_at) <= now:
            expired_keys.append(key)
    for key in expired_keys:
        store.pop(key, None)


async def get_login_code_state(phone: str) -> dict[str, Any] | None:
    state = await _redis_get_state("login-code", phone)
    if state is not _REDIS_UNAVAILABLE:
        return state
    return _memory_get_state(_memory_login_codes, phone)


async def set_login_code_state(phone: str, state: dict[str, Any]) -> None:
    ttl_seconds = _remaining_ttl_seconds(state["expires_at"])
    written = await _redis_set_state("login-code", phone, state, ttl_seconds)
    if written:
        _memory_delete_state(_memory_login_codes, phone)
        return
    _memory_set_state(_memory_login_codes, phone, state)


async def delete_login_code_state(phone: str) -> None:
    await _redis_delete_state("login-code", phone)
    _memory_delete_state(_memory_login_codes, phone)


async def get_qr_session_state(session_id: str) -> dict[str, Any] | None:
    state = await _redis_get_state("qr-session", session_id)
    if state is not _REDIS_UNAVAILABLE:
        return state
    return _memory_get_state(_memory_qr_sessions, session_id)


async def set_qr_session_state(session_id: str, state: dict[str, Any]) -> None:
    ttl_seconds = _remaining_ttl_seconds(state["expires_at"])
    written = await _redis_set_state("qr-session", session_id, state, ttl_seconds)
    if written:
        _memory_delete_state(_memory_qr_sessions, session_id)
        return
    _memory_set_state(_memory_qr_sessions, session_id, state)


async def delete_qr_session_state(session_id: str) -> None:
    await _redis_delete_state("qr-session", session_id)
    _memory_delete_state(_memory_qr_sessions, session_id)


async def get_phone_rebind_code_state(user_id: str) -> dict[str, Any] | None:
    state = await _redis_get_state("phone-rebind-code", user_id)
    if state is not _REDIS_UNAVAILABLE:
        return state
    return _memory_get_state(_memory_phone_rebind_codes, user_id)


async def set_phone_rebind_code_state(user_id: str, state: dict[str, Any]) -> None:
    ttl_seconds = _remaining_ttl_seconds(state["expires_at"])
    written = await _redis_set_state("phone-rebind-code", user_id, state, ttl_seconds)
    if written:
        _memory_delete_state(_memory_phone_rebind_codes, user_id)
        return
    _memory_set_state(_memory_phone_rebind_codes, user_id, state)


async def delete_phone_rebind_code_state(user_id: str) -> None:
    await _redis_delete_state("phone-rebind-code", user_id)
    _memory_delete_state(_memory_phone_rebind_codes, user_id)


def cleanup_auth_runtime_state() -> None:
    _cleanup_expired_memory_store(_memory_login_codes)
    _cleanup_expired_memory_store(_memory_qr_sessions)


def cleanup_phone_rebind_runtime_state() -> None:
    _cleanup_expired_memory_store(_memory_phone_rebind_codes)
