from datetime import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.routers.models import _to_response
from app.services.model_selection import (
    build_available_models_query,
    get_default_available_model_id,
)


@pytest.mark.anyio
async def test_build_available_models_query_excludes_disabled_provider_models():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[User.__table__, ApiProvider.__table__, ModelConfig.__table__],
            )
        )

    user_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_100001",
            phone="13800000001",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        enabled_provider = ApiProvider(
            user_id=user_id,
            name="Enabled Provider",
            provider_type="custom",
            api_key_encrypted="key-1",
            is_enabled=True,
        )
        disabled_provider = ApiProvider(
            user_id=user_id,
            name="Disabled Provider",
            provider_type="custom",
            api_key_encrypted="key-2",
            is_enabled=False,
        )
        session.add_all([enabled_provider, disabled_provider])
        await session.flush()

        available_model = ModelConfig(
            provider_id=enabled_provider.id,
            user_id=user_id,
            name="Available Image Model",
            model_id="available-image-model",
            category="image",
            is_enabled=True,
            is_default=False,
        )
        disabled_provider_model = ModelConfig(
            provider_id=disabled_provider.id,
            user_id=user_id,
            name="Hidden Image Model",
            model_id="hidden-image-model",
            category="image",
            is_enabled=True,
            is_default=True,
        )
        disabled_model = ModelConfig(
            provider_id=enabled_provider.id,
            user_id=user_id,
            name="Disabled Image Model",
            model_id="disabled-image-model",
            category="image",
            is_enabled=False,
            is_default=False,
        )
        session.add_all([available_model, disabled_provider_model, disabled_model])
        await session.commit()

        result = await session.execute(
            build_available_models_query(user_id, category="image")
        )
        models = result.scalars().all()

        assert [model.model_id for model in models] == ["available-image-model"]

    await engine.dispose()


@pytest.mark.anyio
async def test_get_default_available_model_id_ignores_disabled_provider_default():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[User.__table__, ApiProvider.__table__, ModelConfig.__table__],
            )
        )

    user_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_100002",
            phone="13800000002",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        disabled_provider = ApiProvider(
            user_id=user_id,
            name="Disabled OneLinkAI",
            provider_type="onelink",
            api_key_encrypted="key-disabled",
            is_enabled=False,
        )
        enabled_provider = ApiProvider(
            user_id=user_id,
            name="Enabled OneLinkAI",
            provider_type="onelink",
            api_key_encrypted="key-enabled",
            is_enabled=True,
        )
        session.add_all([disabled_provider, enabled_provider])
        await session.flush()

        disabled_default = ModelConfig(
            provider_id=disabled_provider.id,
            user_id=user_id,
            name="Disabled Default",
            model_id="disabled-default-image",
            category="image",
            is_enabled=True,
            is_default=True,
        )
        enabled_fallback = ModelConfig(
            provider_id=enabled_provider.id,
            user_id=user_id,
            name="Enabled Fallback",
            model_id="enabled-fallback-image",
            category="image",
            is_enabled=True,
            is_default=False,
        )
        session.add_all([disabled_default, enabled_fallback])
        await session.commit()

        selected_model_id = await get_default_available_model_id(
            user_id,
            session,
            category="image",
            fallback_model_id="dall-e-3",
        )

        assert selected_model_id == "enabled-fallback-image"

    await engine.dispose()


def test_model_response_exposes_runtime_capabilities():
    provider = ApiProvider(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="OneLinkAI",
        provider_type="onelink",
        api_key_encrypted="encrypted-key",
        is_enabled=True,
    )
    model = ModelConfig(
        id=uuid.uuid4(),
        provider_id=provider.id,
        user_id=provider.user_id,
        name="Vidu Q3 Pro",
        model_id="video-viduq3-pro",
        category="video",
        description="视频生成模型",
        is_enabled=True,
        is_default=False,
        created_at=datetime(2026, 6, 17, 12, 0, 0),
    )

    response = _to_response(model, provider)

    assert response.capabilities is not None
    assert "720P" in response.capabilities["supported_resolutions"]
    assert "1080P" in response.capabilities["supported_resolutions"]
