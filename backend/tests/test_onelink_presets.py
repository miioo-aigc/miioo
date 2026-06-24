import uuid
from collections import Counter

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.services.onelink_presets import (
    cleanup_onelink_legacy_models,
    sync_onelink_preset_models,
)


@pytest.mark.anyio
async def test_sync_onelink_presets_preserves_user_disabled_state():
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
            display_id="miioo_100003",
            phone="13800000003",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        provider = ApiProvider(
            user_id=user_id,
            name="OneLinkAI",
            provider_type="onelink",
            base_url="https://api.onelinkai.cloud",
            api_key_encrypted="encrypted-key",
            is_enabled=True,
        )
        session.add(provider)
        await session.flush()

        disabled_chat_model = ModelConfig(
            provider_id=provider.id,
            user_id=user_id,
            name="DeepSeek-V4-Pro 深度推理",
            model_id="deepseek-v4-pro",
            category="chat",
            description="old description",
            is_enabled=False,
            is_default=False,
        )
        session.add(disabled_chat_model)
        await session.commit()

        await sync_onelink_preset_models(session, user_id, provider)
        await session.commit()
        await session.refresh(disabled_chat_model)

        assert disabled_chat_model.is_enabled is False
        assert disabled_chat_model.is_default is False
        assert disabled_chat_model.description == "文本生成 / 长内容推理"

    await engine.dispose()


@pytest.mark.anyio
async def test_cleanup_onelink_presets_keeps_chat_seedream_and_seedance_models():
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
            display_id="miioo_100004",
            phone="13800000004",
            password_hash="hashed",
            nickname="tester",
        )
        session.add(user)
        await session.flush()

        provider = ApiProvider(
            user_id=user_id,
            name="OneLinkAI",
            provider_type="onelink",
            base_url="https://api.onelinkai.cloud",
            api_key_encrypted="encrypted-key",
            is_enabled=True,
        )
        session.add(provider)
        await session.flush()

        session.add_all(
            [
                ModelConfig(
                    provider_id=provider.id,
                    user_id=user_id,
                    name="GPT-4o 全能对话",
                    model_id="gpt-4o",
                    category="chat",
                    description="legacy chat",
                    is_enabled=True,
                    is_default=True,
                ),
                ModelConfig(
                    provider_id=provider.id,
                    user_id=user_id,
                    name="Kling V3 图像生成",
                    model_id="image-kling-v3",
                    category="image",
                    description="legacy image",
                    is_enabled=True,
                    is_default=False,
                ),
            ]
        )
        await session.commit()

        await sync_onelink_preset_models(session, user_id, provider)
        cleanup_result = await cleanup_onelink_legacy_models(session, user_id, provider)
        await sync_onelink_preset_models(session, user_id, provider)
        await session.commit()

        result = await session.execute(
            select(ModelConfig).where(
                ModelConfig.user_id == user_id,
                ModelConfig.provider_id == provider.id,
            )
        )
        models = result.scalars().all()
        model_ids = {model.model_id for model in models}
        categories = Counter(model.category for model in models)

        assert cleanup_result["removed_legacy_count"] == 1
        assert cleanup_result["removed_duplicate_count"] == 0
        assert model_ids == {
            "gpt-4o",
            "deepseek-v4-pro",
            "deepseek-v4-flash",
            "GLM-5.1",
            "mimo-v2-pro",
            "minimax-m2.7",
            "minimax-m3",
            "gemini-3.5-flash",
            "step-3.5-flash",
            "doubao-seed-2.0-lite-260215",
            "doubao-seed-2.0-pro-260215",
            "qwen3.7-max",
            "qwen3.7-plus",
            "qwen-long",
            "kimi-k2-thinking",
            "doubao-seedream-5.0-lite",
            "doubao-seedance-2.0",
            "doubao-seedance-2-0-fast",
        }
        assert categories == {"chat": 15, "image": 1, "video": 2}

    await engine.dispose()
