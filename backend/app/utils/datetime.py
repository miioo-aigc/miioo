from __future__ import annotations

from datetime import datetime, timezone


def utcnow_naive() -> datetime:
    """Return a naive UTC datetime for TIMESTAMP columns without timezone."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def serialize_utc_datetime(value: datetime | None) -> str | None:
    if not value:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.astimezone(timezone.utc).isoformat()
