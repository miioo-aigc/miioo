import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.admin_model_visibility import AdminModelVisibility
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.routers.admin_model_visibility import (
    list_admin_model_visibility,
    update_admin_model_visibility,
)
from app.schemas.admin_model_visibility import AdminModelVisibilityUpdateRequest


@pytest.mark.anyio
async def test_admin_model_visibility_list_defaults_to_visible_and_update_returns_names():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    ApiProvider.__table__,
                    ModelConfig.__table__,
                    AdminModelVisibility.__table__,
                ],
            )
        )

    admin_user_id = uuid.uuid4()

    async with session_factory() as session:
        admin_user = User(
            id=admin_user_id,
            display_id="miioo_admin_001",
            phone="13800000999",
            password_hash="hashed",
            nickname="管理员",
            is_admin=True,
        )
        session.add(admin_user)
        await session.flush()

        provider = ApiProvider(
            user_id=admin_user_id,
            name="OneLinkAI",
            provider_type="onelink",
            api_key_encrypted="encrypted",
            is_enabled=True,
        )
        session.add(provider)
        await session.flush()

        model = ModelConfig(
            provider_id=provider.id,
            user_id=admin_user_id,
            name="GPT-4o",
            model_id="gpt-4o",
            category="chat",
            is_enabled=True,
            is_default=True,
        )
        session.add(model)
        await session.commit()

        payload = await list_admin_model_visibility(
            page=1,
            page_size=20,
            keyword=None,
            provider_type=None,
            category=None,
            admin_user=admin_user,
            db=session,
        )
        assert payload.total == 1
        assert payload.visible_total == 1
        assert payload.page == 1
        assert payload.page_size == 20
        assert payload.has_more is False
        assert len(payload.list) == 1
        assert payload.list[0].provider_name == "OneLinkAI"
        assert payload.list[0].name == "GPT-4o"
        assert payload.list[0].is_visible is True

        updated = await update_admin_model_visibility(
            "onelink",
            "chat",
            "gpt-4o",
            AdminModelVisibilityUpdateRequest(is_visible=False),
            admin_user=admin_user,
            db=session,
        )

        assert updated.provider_name == "OneLinkAI"
        assert updated.name == "GPT-4o"
        assert updated.is_visible is False

    await engine.dispose()


@pytest.mark.anyio
async def test_admin_model_visibility_list_supports_pagination_and_filters():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    ApiProvider.__table__,
                    ModelConfig.__table__,
                    AdminModelVisibility.__table__,
                ],
            )
        )

    admin_user_id = uuid.uuid4()

    async with session_factory() as session:
        admin_user = User(
            id=admin_user_id,
            display_id="miioo_admin_002",
            phone="13800001000",
            password_hash="hashed",
            nickname="管理员",
            is_admin=True,
        )
        session.add(admin_user)
        await session.flush()

        provider = ApiProvider(
            user_id=admin_user_id,
            name="OneLinkAI",
            provider_type="onelink",
            api_key_encrypted="encrypted",
            is_enabled=True,
        )
        session.add(provider)
        await session.flush()

        session.add_all(
            [
                ModelConfig(
                    provider_id=provider.id,
                    user_id=admin_user_id,
                    name="GPT-4o",
                    model_id="gpt-4o",
                    category="chat",
                    is_enabled=True,
                    is_default=True,
                ),
                ModelConfig(
                    provider_id=provider.id,
                    user_id=admin_user_id,
                    name="Kling 1.6",
                    model_id="kling-v1-6",
                    category="video",
                    is_enabled=True,
                    is_default=False,
                ),
            ]
        )
        session.add(
            AdminModelVisibility(
                provider_type="onelink",
                model_id="kling-v1-6",
                category="video",
                is_visible=False,
                created_by=admin_user_id,
                updated_by=admin_user_id,
            )
        )
        await session.commit()

        first_page = await list_admin_model_visibility(
            page=1,
            page_size=1,
            keyword=None,
            provider_type=None,
            category=None,
            admin_user=admin_user,
            db=session,
        )
        assert first_page.total == 2
        assert first_page.visible_total == 1
        assert first_page.page == 1
        assert first_page.page_size == 1
        assert first_page.has_more is True
        assert len(first_page.list) == 1

        filtered = await list_admin_model_visibility(
            page=1,
            page_size=20,
            keyword="kling",
            provider_type="onelink",
            category="video",
            admin_user=admin_user,
            db=session,
        )
        assert filtered.total == 1
        assert filtered.visible_total == 0
        assert filtered.has_more is False
        assert len(filtered.list) == 1
        assert filtered.list[0].model_id == "kling-v1-6"
        assert filtered.list[0].is_visible is False

    await engine.dispose()
