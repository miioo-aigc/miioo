import asyncio
from datetime import date, datetime, timedelta, timezone

from app.services import runtime_state


async def _no_redis_client():
    return None


def test_login_code_state_falls_back_to_memory(monkeypatch):
    monkeypatch.setattr(runtime_state, "_get_redis_client", _no_redis_client)
    runtime_state._memory_login_codes.clear()

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    state = {
        "code": "123456",
        "expires_at": expires_at,
        "last_sent_at": expires_at - timedelta(seconds=30),
        "sent_date": date.today(),
        "send_count": 1,
        "verify_errors": 0,
    }

    asyncio.run(runtime_state.set_login_code_state("13800000000", state))
    loaded = asyncio.run(runtime_state.get_login_code_state("13800000000"))

    assert loaded is not None
    assert loaded["code"] == "123456"
    assert loaded["expires_at"] == expires_at
    assert loaded["sent_date"] == date.today()

    asyncio.run(runtime_state.delete_login_code_state("13800000000"))
    assert asyncio.run(runtime_state.get_login_code_state("13800000000")) is None


def test_expired_memory_runtime_state_is_cleaned_on_read(monkeypatch):
    monkeypatch.setattr(runtime_state, "_get_redis_client", _no_redis_client)
    runtime_state._memory_qr_sessions.clear()
    runtime_state._memory_qr_sessions["session-1"] = {
        "status": "pending",
        "expires_at": datetime.now(timezone.utc) - timedelta(seconds=1),
        "tokens": None,
    }

    loaded = asyncio.run(runtime_state.get_qr_session_state("session-1"))

    assert loaded is None
    assert "session-1" not in runtime_state._memory_qr_sessions


def test_phone_rebind_state_preserves_payload_in_memory_fallback(monkeypatch):
    monkeypatch.setattr(runtime_state, "_get_redis_client", _no_redis_client)
    runtime_state._memory_phone_rebind_codes.clear()

    state = {
        "phone": "13900001111",
        "code": "654321",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        "last_sent_at": datetime.now(timezone.utc),
        "sent_date": date.today(),
        "send_count": 2,
        "verify_errors": 1,
    }

    asyncio.run(runtime_state.set_phone_rebind_code_state("user-1", state))
    loaded = asyncio.run(runtime_state.get_phone_rebind_code_state("user-1"))

    assert loaded is not None
    assert loaded["phone"] == "13900001111"
    assert loaded["verify_errors"] == 1
