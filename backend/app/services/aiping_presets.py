from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

AIPING_PROVIDER_NAME = "AI Ping"
AIPING_BASE_URL = "https://aiping.cn/api"
AIPING_PRESET_MODELS = [
    {
        "name": "MiniMax 高清配音 2.8（AI Ping）",
        "model_id": "MiniMax-Speech-2.8-hd",
        "category": "voice",
        "description": "配音合成 / AI Ping MiniMax 高清语音模型",
        "is_default": True,
    },
]


async def sync_aiping_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []

    for preset in AIPING_PRESET_MODELS:
        stmt = (
            select(ModelConfig)
            .where(
                and_(
                    ModelConfig.user_id == user_id,
                    ModelConfig.provider_id == provider.id,
                    ModelConfig.category == preset["category"],
                    ModelConfig.model_id == preset["model_id"],
                )
            )
            .limit(1)
        )
        existing = await db.execute(stmt)
        model = existing.scalar_one_or_none()

        if model:
            model.name = preset["name"]
            model.description = preset["description"]
            model.is_enabled = True
        else:
            model = ModelConfig(
                provider_id=provider.id,
                user_id=user_id,
                name=preset["name"],
                model_id=preset["model_id"],
                category=preset["category"],
                description=preset["description"],
                is_enabled=True,
                is_default=False,
            )
            db.add(model)

        synced_models.append(model)

    for preset in AIPING_PRESET_MODELS:
        if not preset.get("is_default"):
            continue

        result = await db.execute(
            select(ModelConfig).where(
                and_(
                    ModelConfig.user_id == user_id,
                    ModelConfig.category == preset["category"],
                    ModelConfig.is_default == True,
                )
            )
        )
        current_defaults = result.scalars().all()
        if current_defaults:
            continue

        for model in synced_models:
            if model.category == preset["category"] and model.model_id == preset["model_id"]:
                model.is_default = True
                model.is_enabled = True
                break

    return synced_models
