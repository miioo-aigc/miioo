import contextvars
import logging
from time import perf_counter
from typing import Any
from uuid import uuid4

from app.config import settings

REQUEST_ID_HEADER = "X-Request-ID"
_request_id_context: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default="-",
)
_logging_initialized = False


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = get_request_id()
        return True


def coerce_log_level(level_name: str | int) -> int:
    if isinstance(level_name, int):
        return level_name
    level = logging.getLevelName(str(level_name).upper())
    if isinstance(level, int):
        return level
    return logging.INFO


def initialize_logging() -> None:
    global _logging_initialized
    if _logging_initialized:
        return

    logging.basicConfig(
        level=coerce_log_level(settings.LOG_LEVEL),
        format="%(asctime)s %(levelname)s [%(name)s] [request_id=%(request_id)s] %(message)s",
        force=True,
    )

    request_id_filter = RequestIdFilter()
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        handler.addFilter(request_id_filter)

    _logging_initialized = True


def generate_request_id() -> str:
    return uuid4().hex


def get_request_id() -> str:
    request_id = _request_id_context.get()
    return request_id or "-"


def set_request_id(request_id: str) -> contextvars.Token[str]:
    return _request_id_context.set(request_id)


def reset_request_id(token: contextvars.Token[str]) -> None:
    _request_id_context.reset(token)


def truncate_for_log(value: Any, *, limit: int = 800) -> str:
    if value is None:
        return "None"
    compact = " ".join(str(value).split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 3]}..."


def elapsed_ms(start_time: float) -> float:
    return round((perf_counter() - start_time) * 1000, 2)
