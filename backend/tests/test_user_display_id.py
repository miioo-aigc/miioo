import asyncio
import uuid

import pytest

from app.models.user import User
from app.services import user_display_id


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    def __init__(self, taken_ids=None):
        self.taken_ids = set(taken_ids or [])
        self.commit_count = 0
        self.refreshed_users = []

    async def execute(self, stmt):
        params = stmt.compile().params
        display_id = params.get("display_id_1")
        return _FakeResult(display_id if display_id in self.taken_ids else None)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, user):
        self.refreshed_users.append(user.id)


def test_build_random_display_id_matches_rule():
    display_id = user_display_id.build_random_display_id()

    assert display_id.startswith("miioo_")
    assert len(display_id) == 12
    assert display_id[6:].isdigit()
    assert user_display_id.is_valid_display_id(display_id) is True


def test_ensure_user_display_id_keeps_existing_value():
    db = _FakeSession()
    user = User(
        id=uuid.uuid4(),
        display_id="miioo_123456",
        phone="13800000000",
        password_hash="hash",
        nickname="tester",
    )

    display_id = asyncio.run(user_display_id.ensure_user_display_id(user, db))

    assert display_id == "miioo_123456"
    assert user.display_id == "miioo_123456"
    assert db.commit_count == 0
    assert db.refreshed_users == []


def test_ensure_user_display_id_generates_unique_value(monkeypatch):
    db = _FakeSession({"miioo_000001"})
    user = User(
        id=uuid.uuid4(),
        display_id=None,
        phone="13800000000",
        password_hash="hash",
        nickname="tester",
    )
    candidates = iter(["miioo_000001", "miioo_654321"])

    monkeypatch.setattr(user_display_id, "build_random_display_id", lambda: next(candidates))

    display_id = asyncio.run(user_display_id.ensure_user_display_id(user, db))

    assert display_id == "miioo_654321"
    assert user.display_id == "miioo_654321"
    assert db.commit_count == 1
    assert db.refreshed_users == [user.id]
