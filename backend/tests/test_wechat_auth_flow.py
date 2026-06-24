from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.user import User
from app.routers import auth
from app.schemas.auth import QrCodeConfirmRequest


async def _make_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    # 微信扫码链路只读写 users 表。Base.metadata 里包含对 episodes 的外键，
    # 但本测试不注册 Episode 模型，整表 create_all 会因外键无法解析而报错。
    # 故仅创建 User 表，既隔离了被测范围，也避开未注册表的依赖。
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[User.__table__])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


@pytest.mark.anyio
async def test_real_wechat_callback_confirms_existing_bound_user(monkeypatch):
    engine, session_factory = await _make_session()
    saved_states = []

    async def fake_get_qr_session_state(_session_id):
        return {
            "status": "pending",
            "kind": "login",
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=180),
            "tokens": None,
            "message": None,
        }

    async def fake_set_qr_session_state(_session_id, state):
        saved_states.append(state.copy())

    monkeypatch.setattr(auth, "get_qr_session_state", fake_get_qr_session_state)
    monkeypatch.setattr(auth, "set_qr_session_state", fake_set_qr_session_state)
    monkeypatch.setattr(auth, "cleanup_auth_runtime_state", lambda: None)

    async def fake_fetch_wechat_profile(_code):
        return {
            "openid": "wx-openid-001",
            "nickname": "微信已绑定用户",
            "avatar_url": "https://example.com/avatar.png",
        }

    monkeypatch.setattr(auth, "_fetch_wechat_profile", fake_fetch_wechat_profile)

    async with session_factory() as db:
        user = User(
            phone="13800000000",
            password_hash="hash",
            nickname="tester",
            wechat_openid="wx-openid-001",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        status_value, message = await auth._process_real_wechat_callback("sid-001", "code-001", db)

        assert status_value == "confirmed"
        assert "登录成功" in message
        assert saved_states
        assert saved_states[-1]["status"] == "confirmed"
        assert saved_states[-1]["tokens"]["access_token"]
        assert saved_states[-1]["tokens"]["refresh_token"]

    await engine.dispose()


@pytest.mark.anyio
async def test_real_wechat_callback_requires_mobile_for_new_wechat(monkeypatch):
    engine, session_factory = await _make_session()
    saved_states = []

    async def fake_get_qr_session_state(_session_id):
        return {
            "status": "pending",
            "kind": "login",
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=180),
            "tokens": None,
            "message": None,
        }

    async def fake_set_qr_session_state(_session_id, state):
        saved_states.append(state.copy())

    monkeypatch.setattr(auth, "get_qr_session_state", fake_get_qr_session_state)
    monkeypatch.setattr(auth, "set_qr_session_state", fake_set_qr_session_state)
    monkeypatch.setattr(auth, "cleanup_auth_runtime_state", lambda: None)

    async def fake_fetch_wechat_profile(_code):
        return {
            "openid": "wx-openid-new",
            "nickname": "新微信用户",
            "avatar_url": "https://example.com/new-avatar.png",
        }

    monkeypatch.setattr(auth, "_fetch_wechat_profile", fake_fetch_wechat_profile)

    async with session_factory() as db:
        status_value, message = await auth._process_real_wechat_callback("sid-002", "code-002", db)

        assert status_value == "need_bind_mobile"
        assert "绑定手机号" in message
        assert saved_states
        assert saved_states[-1]["status"] == "need_bind_mobile"
        assert saved_states[-1]["bind_token"] == "sid-002"
        assert saved_states[-1]["wechat_profile"]["openid"] == "wx-openid-new"

    await engine.dispose()


@pytest.mark.anyio
async def test_wechat_confirm_creates_account_and_binds_phone(monkeypatch):
    """新微信扫码后绑定手机号：自动建号 + 写入 openid + 返回登录 token。"""
    engine, session_factory = await _make_session()
    saved_states = []

    qr_session = {
        "status": "need_bind_mobile",
        "kind": "login",
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=180),
        "tokens": None,
        "bind_token": "sid-bind",
        "wechat_profile": {
            "openid": "wx-openid-bind",
            "nickname": "待绑定微信",
            "avatar_url": "https://example.com/bind-avatar.png",
        },
        "message": None,
    }

    async def fake_get_qr_session_state(_session_id):
        return qr_session

    async def fake_set_qr_session_state(_session_id, state):
        saved_states.append(state.copy())

    # 模拟手机验证码已发送且校验通过（confirm 内部会 _consume_login_code）
    async def fake_get_login_code_state(_phone):
        return {
            "code": "123456",
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=300),
            "verify_errors": 0,
        }

    async def fake_delete_login_code_state(_phone):
        return None

    monkeypatch.setattr(auth, "get_qr_session_state", fake_get_qr_session_state)
    monkeypatch.setattr(auth, "set_qr_session_state", fake_set_qr_session_state)
    monkeypatch.setattr(auth, "get_login_code_state", fake_get_login_code_state)
    monkeypatch.setattr(auth, "delete_login_code_state", fake_delete_login_code_state)
    monkeypatch.setattr(auth, "cleanup_auth_runtime_state", lambda: None)
    monkeypatch.setattr(auth.settings, "WECHAT_LOGIN_ENABLED", True)

    req = QrCodeConfirmRequest(
        session_id="sid-bind",
        phone="13900000000",
        sms_code="123456",
        nickname="新注册用户",
    )

    async with session_factory() as db:
        result = await auth.confirm_wechat_login(req, db)

        assert result.status == "confirmed"
        assert saved_states[-1]["tokens"]["access_token"]
        assert saved_states[-1]["tokens"]["refresh_token"]

        # 账号已自动创建，openid 与手机号都已落库
        created = (
            await db.execute(select(User).where(User.phone == "13900000000"))
        ).scalar_one()
        assert created.wechat_openid == "wx-openid-bind"
        assert created.registered_phone == "13900000000"
        assert created.display_id  # 自动分配的展示 ID

    await engine.dispose()
