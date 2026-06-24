import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.routers.auth import _mark_login_success, _sync_registration_phone
from app.routers.users import _apply_admin_user_account_update, _build_admin_user_account_item, router
from app.schemas.user import AdminUserAccountUpdateRequest
from app.utils.datetime import serialize_utc_datetime, utcnow_naive


async def _make_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[User.__table__],
            )
        )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


def _build_client(session_factory, current_user: User) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/users")

    async def override_get_db():
        async with session_factory() as session:
            yield session

    async def override_get_current_user():
        return current_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app)


def test_sync_registration_phone_only_sets_when_missing():
    user = User(
        id=uuid.uuid4(),
        phone="13800000000",
        password_hash="hash",
        nickname="tester",
    )

    changed = _sync_registration_phone(user, "13800000000")

    assert changed is True
    assert user.registered_phone == "13800000000"
    assert _sync_registration_phone(user, "13900000000") is False
    assert user.registered_phone == "13800000000"


def test_mark_login_success_updates_latest_login_fields():
    user = User(
        id=uuid.uuid4(),
        phone="13800000000",
        password_hash="hash",
        nickname="tester",
    )

    before = utcnow_naive()
    _mark_login_success(user, "13900001111")
    after = utcnow_naive()

    assert user.last_login_phone == "13900001111"
    assert user.last_login_at is not None
    assert user.last_login_at.tzinfo is None
    assert before <= user.last_login_at <= after


def test_build_admin_user_account_item_uses_current_phone_as_registered_fallback():
    now = datetime.now(timezone.utc)
    user = User(
        id=uuid.uuid4(),
        display_id="miioo_123456",
        phone="13800000000",
        password_hash="hash",
        nickname="tester",
        last_login_phone="13900001111",
        last_login_at=now,
        is_admin=True,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    item = _build_admin_user_account_item(user)

    assert item.display_id == "miioo_123456"
    assert item.current_phone == "13800000000"
    assert item.registered_phone == "13800000000"
    assert item.last_login_phone == "13900001111"
    assert item.last_login_at == serialize_utc_datetime(now)
    assert item.is_admin is True


def test_apply_admin_user_account_update_updates_profile_and_status():
    async def scenario():
        engine, session_factory = await _make_session()
        try:
            async with session_factory() as session:
                admin_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200001",
                    phone="13800000001",
                    password_hash="hash",
                    nickname="admin",
                    is_admin=True,
                    is_active=True,
                )
                target_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200002",
                    phone="13800000002",
                    password_hash="hash",
                    nickname="old-name",
                    is_admin=False,
                    is_active=True,
                )
                session.add_all([admin_user, target_user])
                await session.commit()

                updated_user = await _apply_admin_user_account_update(
                    target_user,
                    AdminUserAccountUpdateRequest(
                        nickname="new-name",
                        phone="13900001111",
                        is_admin=True,
                        is_active=False,
                    ),
                    session,
                )

                assert updated_user.nickname == "new-name"
                assert updated_user.phone == "13900001111"
                assert updated_user.is_phone_bound is True
                assert updated_user.is_admin is True
                assert updated_user.is_active is False
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_apply_admin_user_account_update_rejects_duplicate_phone():
    async def scenario():
        engine, session_factory = await _make_session()
        try:
            async with session_factory() as session:
                admin_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200003",
                    phone="13800000003",
                    password_hash="hash",
                    nickname="admin",
                    is_admin=True,
                    is_active=True,
                )
                target_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200004",
                    phone="13800000004",
                    password_hash="hash",
                    nickname="target",
                    is_admin=False,
                    is_active=True,
                )
                occupied_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200005",
                    phone="13900002222",
                    password_hash="hash",
                    nickname="occupied",
                    is_admin=False,
                    is_active=True,
                )
                session.add_all([admin_user, target_user, occupied_user])
                await session.commit()

                with pytest.raises(Exception) as exc_info:
                    await _apply_admin_user_account_update(
                        target_user,
                        AdminUserAccountUpdateRequest(phone="13900002222"),
                        session,
                    )

                assert "该手机号已绑定其他账号" in str(exc_info.value)
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_apply_admin_user_account_update_keeps_last_active_admin():
    async def scenario():
        engine, session_factory = await _make_session()
        try:
            async with session_factory() as session:
                last_admin = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200006",
                    phone="13800000006",
                    password_hash="hash",
                    nickname="last-admin",
                    is_admin=True,
                    is_active=True,
                )
                normal_user = User(
                    id=uuid.uuid4(),
                    display_id="miioo_200007",
                    phone="13800000007",
                    password_hash="hash",
                    nickname="normal-user",
                    is_admin=False,
                    is_active=True,
                )
                session.add_all([last_admin, normal_user])
                await session.commit()

                with pytest.raises(Exception) as exc_info:
                    await _apply_admin_user_account_update(
                        last_admin,
                        AdminUserAccountUpdateRequest(is_admin=False),
                        session,
                    )

                assert "至少保留一个启用中的管理员账号" in str(exc_info.value)
        finally:
            await engine.dispose()

    asyncio.run(scenario())


def test_update_admin_user_account_route_rejects_non_admin():
    async def prepare_data():
        engine, session_factory = await _make_session()
        async with session_factory() as session:
            target_user = User(
                id=uuid.uuid4(),
                display_id="miioo_200009",
                phone="13800000009",
                password_hash="hash",
                nickname="target",
                is_admin=False,
                is_active=True,
            )
            session.add(target_user)
            await session.commit()
            return engine, session_factory, str(target_user.id)

    current_user = User(
        id=uuid.uuid4(),
        display_id="miioo_200008",
        phone="13800000008",
        password_hash="hash",
        nickname="viewer",
        is_admin=False,
        is_active=True,
    )

    engine, session_factory, target_id = asyncio.run(prepare_data())
    try:
        client = _build_client(session_factory, current_user)
        response = client.patch(
            f"/api/users/admin/accounts/{target_id}",
            json={"nickname": "should-fail"},
        )
        client.close()
    finally:
        asyncio.run(engine.dispose())

    assert response.status_code == 403
