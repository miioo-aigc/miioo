import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.user import User
from app.models.voice import Voice
from app.models.voice_favorite import VoiceFavorite
from app.routers.voices import list_voice_library


@pytest.mark.anyio
async def test_admin_voice_library_returns_paginated_payload():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    Voice.__table__,
                    VoiceFavorite.__table__,
                ],
            )
        )

    admin_user_id = uuid.uuid4()

    async with session_factory() as session:
        admin_user = User(
            id=admin_user_id,
            display_id="miioo_admin_voice_001",
            phone="13800002000",
            password_hash="hashed",
            nickname="管理员",
            is_admin=True,
        )
        session.add(admin_user)
        await session.flush()

        session.add_all(
            [
                Voice(
                    voice_id="voice-enabled-1",
                    name="启用音色 A",
                    provider="miioo",
                    is_custom=False,
                    is_enabled=True,
                    sort_order=1,
                ),
                Voice(
                    voice_id="voice-disabled-1",
                    name="停用音色 B",
                    provider="miioo",
                    is_custom=False,
                    is_enabled=False,
                    sort_order=2,
                ),
                Voice(
                    voice_id="voice-other-provider",
                    name="其它服务商音色",
                    provider="other",
                    is_custom=False,
                    is_enabled=True,
                    sort_order=3,
                ),
            ]
        )
        await session.commit()

        payload = await list_voice_library(
            page=1,
            page_size=1,
            provider="miioo",
            gender=None,
            age_group=None,
            language=None,
            emotion=None,
            keyword=None,
            is_enabled=None,
            include_disabled=True,
            db=session,
            current_user=admin_user,
        )

        assert payload.total == 2
        assert payload.enabled_total == 1
        assert payload.page == 1
        assert payload.page_size == 1
        assert payload.has_more is True
        assert len(payload.list) == 1
        assert payload.list[0].voice_id == "voice-enabled-1"

        disabled_only = await list_voice_library(
            page=1,
            page_size=20,
            provider="miioo",
            gender=None,
            age_group=None,
            language=None,
            emotion=None,
            keyword=None,
            is_enabled=False,
            include_disabled=True,
            db=session,
            current_user=admin_user,
        )

        assert disabled_only.total == 1
        assert disabled_only.enabled_total == 0
        assert disabled_only.has_more is False
        assert [item.voice_id for item in disabled_only.list] == ["voice-disabled-1"]

    await engine.dispose()


@pytest.mark.anyio
async def test_non_admin_voice_library_still_hides_disabled_items():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    Voice.__table__,
                    VoiceFavorite.__table__,
                ],
            )
        )

    user_id = uuid.uuid4()

    async with session_factory() as session:
        current_user = User(
            id=user_id,
            display_id="miioo_user_voice_001",
            phone="13800002001",
            password_hash="hashed",
            nickname="普通用户",
            is_admin=False,
        )
        session.add(current_user)
        await session.flush()

        session.add_all(
            [
                Voice(
                    voice_id="voice-enabled-2",
                    name="启用音色 C",
                    provider="miioo",
                    is_custom=False,
                    is_enabled=True,
                    sort_order=1,
                ),
                Voice(
                    voice_id="voice-disabled-2",
                    name="停用音色 D",
                    provider="miioo",
                    is_custom=False,
                    is_enabled=False,
                    sort_order=2,
                ),
            ]
        )
        await session.commit()

        payload = await list_voice_library(
            page=1,
            page_size=20,
            provider="miioo",
            gender=None,
            age_group=None,
            language=None,
            emotion=None,
            keyword=None,
            is_enabled=None,
            include_disabled=True,
            db=session,
            current_user=current_user,
        )

        assert payload.total == 1
        assert payload.enabled_total == 1
        assert payload.has_more is False
        assert [item.voice_id for item in payload.list] == ["voice-enabled-2"]

    await engine.dispose()
