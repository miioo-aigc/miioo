import asyncio

from app.routers import auth as auth_router


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    def __init__(self):
        self.added_user = None
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, _stmt):
        return _FakeResult(None)

    def add(self, user):
        self.added_user = user

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _user):
        self.refresh_count += 1


def test_verify_code_login_new_user_has_display_id_before_commit(monkeypatch):
    db = _FakeSession()

    async def _fake_generate_unique_display_id(_db, **_kwargs):
        return "miioo_654321"

    monkeypatch.setattr(auth_router, "generate_unique_display_id", _fake_generate_unique_display_id)
    monkeypatch.setattr(auth_router, "hash_password", lambda _value: "hashed-password")

    user = asyncio.run(auth_router._get_or_create_user("13800139000", db))

    assert db.added_user is not None
    assert db.added_user.display_id == "miioo_654321"
    assert user.display_id == "miioo_654321"
    assert db.commit_count == 1
    assert db.refresh_count == 1
