from __future__ import annotations

import asyncio
import importlib
import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings

try:
    from redis import asyncio as redis_asyncio
    from redis.exceptions import RedisError
except ImportError:  # pragma: no cover - exercised in environments without redis installed
    redis_asyncio = None

    class RedisError(Exception):
        """Fallback Redis error when redis-py is unavailable."""


logger = logging.getLogger("app.background_runtime")

_RUNTIME_KEY_PREFIX = "miioo:background-runtime"
_scheduled_tasks: dict[str, asyncio.Task[Any]] = {}
_redis_client = None


def build_gen_task_job_key(task_id: str | uuid.UUID, task_type: str) -> str:
    return f"gen-task:{task_id}:{task_type}"


def build_storyboard_background_job_key(
    project_id: str | uuid.UUID,
    episode_ids: list[str] | list[uuid.UUID],
    task_id: str | uuid.UUID,
) -> str:
    episode_part = ",".join(sorted(str(item) for item in episode_ids)) or "none"
    return f"storyboard-bg:{project_id}:{episode_part}:{task_id}"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _should_use_queue_runtime() -> bool:
    return settings.BACKGROUND_JOB_EXECUTION_MODE.strip().lower() == "queue"


def _serialize_value(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return {"__type__": "uuid", "value": str(value)}
    if isinstance(value, datetime):
        aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return {"__type__": "datetime", "value": aware.astimezone(timezone.utc).isoformat()}
    if isinstance(value, Path):
        return {"__type__": "path", "value": str(value)}
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_value(item) for item in value]
    return value


def _deserialize_value(value: Any) -> Any:
    if isinstance(value, dict):
        marker = value.get("__type__")
        if marker == "uuid":
            return uuid.UUID(str(value["value"]))
        if marker == "datetime":
            return datetime.fromisoformat(str(value["value"]))
        if marker == "path":
            return Path(str(value["value"]))
        return {key: _deserialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_deserialize_value(item) for item in value]
    return value


def _build_state_key(job_key: str) -> str:
    return f"{_RUNTIME_KEY_PREFIX}:state:{job_key}"


def _resolve_handler(handler_path: str) -> Callable[..., Awaitable[Any]]:
    module_path, _, callable_name = handler_path.partition(":")
    if not module_path or not callable_name:
        raise ValueError(f"invalid handler path: {handler_path}")
    module = importlib.import_module(module_path)
    handler = getattr(module, callable_name, None)
    if handler is None or not callable(handler):
        raise ValueError(f"background handler not found: {handler_path}")
    return handler


async def _get_redis_client():
    global _redis_client
    if redis_asyncio is None:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = redis_asyncio.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception:  # pragma: no cover - defensive path
        logger.exception("failed to initialize redis client for background runtime")
        _redis_client = None
        return None


async def _require_redis_client():
    client = await _get_redis_client()
    if client is None:
        raise RuntimeError("background queue mode requires redis to be installed and reachable")
    return client


async def ensure_background_runtime_ready() -> None:
    if not _should_use_queue_runtime():
        return
    client = await _require_redis_client()
    try:
        await client.ping()
    except RedisError as exc:  # pragma: no cover - runtime safeguard
        raise RuntimeError(f"background queue runtime redis ping failed: {exc}") from exc


async def _get_job_state(job_key: str) -> dict[str, Any] | None:
    client = await _require_redis_client()
    raw = await client.get(_build_state_key(job_key))
    if not raw:
        return None
    return _deserialize_value(json.loads(raw))


async def _set_job_state(job_key: str, state: dict[str, Any]) -> None:
    client = await _require_redis_client()
    await client.set(_build_state_key(job_key), json.dumps(_serialize_value(state)))


async def _merge_job_state(job_key: str, **updates: Any) -> dict[str, Any]:
    state = await _get_job_state(job_key) or {}
    state.update(updates)
    await _set_job_state(job_key, state)
    return state


def schedule_background_job(
    job_key: str,
    coroutine: Awaitable[Any],
    *,
    name: str,
) -> asyncio.Task[Any]:
    existing = _scheduled_tasks.get(job_key)
    if existing and not existing.done():
        logger.warning(
            "background job %s already running as %s; cancelling stale in-process task",
            job_key,
            existing.get_name(),
        )
        existing.cancel()

    async def _runner() -> Any:
        try:
            return await coroutine
        except asyncio.CancelledError:
            logger.info("background job cancelled: %s", job_key)
            raise
        except Exception:
            logger.exception("background job failed: %s", job_key)
            raise
        finally:
            current = asyncio.current_task()
            if current is not None and _scheduled_tasks.get(job_key) is current:
                _scheduled_tasks.pop(job_key, None)

    task = asyncio.create_task(_runner(), name=name)
    _scheduled_tasks[job_key] = task
    return task


async def dispatch_background_job(
    job_key: str,
    *,
    handler_path: str,
    kwargs: dict[str, Any],
    name: str,
) -> asyncio.Task[Any] | None:
    if not _should_use_queue_runtime():
        handler = _resolve_handler(handler_path)
        return schedule_background_job(job_key, handler(**kwargs), name=name)

    job_id = str(uuid.uuid4())
    payload = {
        "job_id": job_id,
        "job_key": job_key,
        "name": name,
        "handler_path": handler_path,
        "kwargs": kwargs,
        "enqueued_at": _utcnow_iso(),
    }
    await _set_job_state(
        job_key,
        {
            "job_id": job_id,
            "job_key": job_key,
            "name": name,
            "handler_path": handler_path,
            "status": "pending",
            "cancel_requested": False,
            "enqueued_at": payload["enqueued_at"],
            "started_at": None,
            "finished_at": None,
            "worker_id": None,
            "error": None,
        },
    )
    client = await _require_redis_client()
    await client.rpush(settings.BACKGROUND_JOB_QUEUE_NAME, json.dumps(_serialize_value(payload)))
    return None


async def cancel_background_job(job_key: str) -> bool:
    cancelled = False
    task = _scheduled_tasks.get(job_key)
    if task is not None and not task.done():
        task.cancel()
        cancelled = True
    else:
        _scheduled_tasks.pop(job_key, None)

    if _should_use_queue_runtime():
        state = await _get_job_state(job_key)
        if state:
            await _merge_job_state(
                job_key,
                cancel_requested=True,
                status="cancelled" if state.get("status") == "pending" else state.get("status", "cancelled"),
                cancelled_at=_utcnow_iso(),
            )
            cancelled = True
    return cancelled


async def _run_queued_payload(payload: dict[str, Any], *, worker_id: str) -> None:
    job_key = str(payload["job_key"])
    handler_path = str(payload["handler_path"])
    state = await _get_job_state(job_key)
    if not state:
        logger.warning("background queue payload lost state: %s", job_key)
        return
    if str(state.get("job_id")) != str(payload["job_id"]):
        logger.info("skip stale background payload for %s", job_key)
        return
    if state.get("cancel_requested"):
        logger.info("skip cancelled background payload for %s", job_key)
        await _merge_job_state(job_key, status="cancelled", finished_at=_utcnow_iso(), worker_id=worker_id)
        return

    handler = _resolve_handler(handler_path)
    await _merge_job_state(
        job_key,
        status="running",
        started_at=_utcnow_iso(),
        worker_id=worker_id,
        error=None,
    )
    task = asyncio.create_task(handler(**payload["kwargs"]), name=payload["name"])
    try:
        while True:
            done, _ = await asyncio.wait({task}, timeout=settings.BACKGROUND_JOB_CANCEL_POLL_SECONDS)
            if task in done:
                break
            state = await _get_job_state(job_key)
            if state and str(state.get("job_id")) != str(payload["job_id"]):
                logger.info("superseded queued background job detected: %s", job_key)
                task.cancel()
                break
            if state and state.get("cancel_requested"):
                task.cancel()
                break
        await task
    except asyncio.CancelledError:
        current_state = await _get_job_state(job_key)
        if current_state and str(current_state.get("job_id")) == str(payload["job_id"]):
            await _merge_job_state(job_key, status="cancelled", finished_at=_utcnow_iso())
        raise
    except Exception as exc:
        current_state = await _get_job_state(job_key)
        if current_state and str(current_state.get("job_id")) == str(payload["job_id"]):
            await _merge_job_state(job_key, status="failed", finished_at=_utcnow_iso(), error=str(exc))
        logger.exception("queued background job failed: %s", job_key)
    else:
        current_state = await _get_job_state(job_key)
        if current_state and str(current_state.get("job_id")) == str(payload["job_id"]):
            await _merge_job_state(job_key, status="completed", finished_at=_utcnow_iso())


async def run_background_worker(*, worker_id: str | None = None, stop_event: asyncio.Event | None = None) -> None:
    client = await _require_redis_client()
    resolved_worker_id = worker_id or f"bg-worker:{uuid.uuid4()}"
    logger.info(
        "background worker started: %s (queue=%s)",
        resolved_worker_id,
        settings.BACKGROUND_JOB_QUEUE_NAME,
    )
    while True:
        if stop_event is not None and stop_event.is_set():
            logger.info("background worker stop requested: %s", resolved_worker_id)
            return
        item = await client.blpop(settings.BACKGROUND_JOB_QUEUE_NAME, timeout=settings.BACKGROUND_JOB_DEQUEUE_TIMEOUT_SECONDS)
        if not item:
            continue
        _, raw_payload = item
        payload = _deserialize_value(json.loads(raw_payload))
        await _run_queued_payload(payload, worker_id=resolved_worker_id)


async def shutdown_background_jobs() -> None:
    if not _scheduled_tasks:
        return
    running_tasks = list(_scheduled_tasks.items())
    _scheduled_tasks.clear()
    for _, task in running_tasks:
        if not task.done():
            task.cancel()
    await asyncio.gather(*(task for _, task in running_tasks), return_exceptions=True)
