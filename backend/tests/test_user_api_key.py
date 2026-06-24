from datetime import datetime, timedelta
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.services.user_api_key import get_user_model_provider_runtime


@pytest.mark.anyio
async def test_get_user_model_provider_runtime_prefers_volcengine_for_doubao_duplicates(monkeypatch):
    monkeypatch.setattr("app.services.user_api_key.decrypt_api_key", lambda value: value)

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
    now = datetime(2026, 6, 23, 18, 0, 0)

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_100101",
            phone="13800000101",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        onelink_provider = ApiProvider(
            user_id=user_id,
            name="OneLinkAI",
            provider_type="onelink",
            base_url="https://api.onelinkai.cloud",
            api_key_encrypted="onelink-key",
            is_enabled=True,
            updated_at=now - timedelta(days=3),
        )
        volcengine_provider = ApiProvider(
            user_id=user_id,
            name="Volcengine",
            provider_type="volcengine",
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            api_key_encrypted="volcengine-key",
            is_enabled=True,
            updated_at=now,
        )
        session.add_all([onelink_provider, volcengine_provider])
        await session.flush()

        session.add_all(
            [
                ModelConfig(
                    provider_id=onelink_provider.id,
                    user_id=user_id,
                    name="OneLink Seedream",
                    model_id="doubao-seedream-5.0-lite",
                    category="image",
                    is_enabled=True,
                    is_default=True,
                    created_at=now - timedelta(days=7),
                ),
                ModelConfig(
                    provider_id=volcengine_provider.id,
                    user_id=user_id,
                    name="Volcengine Seedream",
                    model_id="doubao-seedream-5.0-lite",
                    category="image",
                    is_enabled=True,
                    is_default=False,
                    created_at=now - timedelta(days=1),
                ),
            ]
        )
        await session.commit()

        runtime = await get_user_model_provider_runtime(
            user_id,
            session,
            category="image",
            requested_model="doubao-seedream-5.0-lite",
        )

        assert runtime is not None
        api_key, base_url, provider_type, model_id, _, _ = runtime
        assert api_key == "volcengine-key"
        assert base_url == "https://ark.cn-beijing.volces.com/api/v3"
        assert provider_type == "volcengine"
        assert model_id == "doubao-seedream-5.0-lite"

    await engine.dispose()


@pytest.mark.anyio
async def test_get_user_model_provider_runtime_keeps_existing_order_for_non_official_duplicates(monkeypatch):
    monkeypatch.setattr("app.services.user_api_key.decrypt_api_key", lambda value: value)

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
    now = datetime(2026, 6, 23, 18, 30, 0)

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_100102",
            phone="13800000102",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        default_provider = ApiProvider(
            user_id=user_id,
            name="Default Provider",
            provider_type="onelink",
            base_url="https://default.example.com",
            api_key_encrypted="default-key",
            is_enabled=True,
            updated_at=now - timedelta(days=2),
        )
        newer_provider = ApiProvider(
            user_id=user_id,
            name="Newer Provider",
            provider_type="fal",
            base_url="https://fal.run",
            api_key_encrypted="newer-key",
            is_enabled=True,
            updated_at=now,
        )
        session.add_all([default_provider, newer_provider])
        await session.flush()

        session.add_all(
            [
                ModelConfig(
                    provider_id=default_provider.id,
                    user_id=user_id,
                    name="Default Custom Image",
                    model_id="custom-image-model",
                    category="image",
                    is_enabled=True,
                    is_default=True,
                    created_at=now - timedelta(days=5),
                ),
                ModelConfig(
                    provider_id=newer_provider.id,
                    user_id=user_id,
                    name="Newer Custom Image",
                    model_id="custom-image-model",
                    category="image",
                    is_enabled=True,
                    is_default=False,
                    created_at=now - timedelta(days=1),
                ),
            ]
        )
        await session.commit()

        runtime = await get_user_model_provider_runtime(
            user_id,
            session,
            category="image",
            requested_model="custom-image-model",
        )

        assert runtime is not None
        api_key, base_url, provider_type, model_id, _, _ = runtime
        assert api_key == "default-key"
        assert base_url == "https://default.example.com"
        assert provider_type == "onelink"
        assert model_id == "custom-image-model"

    await engine.dispose()


@pytest.mark.anyio
async def test_get_user_model_provider_runtime_falls_back_to_preferred_provider_even_without_matching_model_row(
    monkeypatch,
):
    monkeypatch.setattr("app.services.user_api_key.decrypt_api_key", lambda value: value)

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
    now = datetime(2026, 6, 23, 21, 30, 0)

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_100103",
            phone="13800000103",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        onelink_provider = ApiProvider(
            user_id=user_id,
            name="OneLinkAI",
            provider_type="onelink",
            base_url="https://api.onelinkai.cloud",
            api_key_encrypted="onelink-key",
            is_enabled=True,
            updated_at=now - timedelta(days=2),
        )
        volcengine_provider = ApiProvider(
            user_id=user_id,
            name="Volcengine",
            provider_type="volcengine",
            base_url="https://ark.cn-beijing.volces.com/api/v3",
            api_key_encrypted="volcengine-key",
            is_enabled=True,
            default_video_watermark=True,
            updated_at=now,
        )
        session.add_all([onelink_provider, volcengine_provider])
        await session.flush()

        session.add(
            ModelConfig(
                provider_id=onelink_provider.id,
                user_id=user_id,
                name="OneLink Seedance",
                model_id="doubao-seedance-2.0",
                category="video",
                is_enabled=True,
                is_default=True,
                created_at=now - timedelta(days=5),
            )
        )
        await session.commit()

        runtime = await get_user_model_provider_runtime(
            user_id,
            session,
            category="video",
            requested_model="doubao-seedance-2.0",
        )

        assert runtime is not None
        api_key, base_url, provider_type, model_id, _, default_video_watermark = runtime
        assert api_key == "volcengine-key"
        assert base_url == "https://ark.cn-beijing.volces.com/api/v3"
        assert provider_type == "volcengine"
        assert model_id == "doubao-seedance-2.0"
        assert default_video_watermark is True

    await engine.dispose()
