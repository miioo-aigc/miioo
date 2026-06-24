from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

MINIMAX_PROVIDER_NAME = "MiniMax"
MINIMAX_BASE_URL = "https://api.minimaxi.com"
MINIMAX_PRESET_MODELS = [
    {
        "name": "MiniMax 高清配音 2.8",
        "model_id": "speech-2.8-hd",
        "category": "voice",
        "description": "MiniMax 官方高清配音模型 / 情绪渲染与语气词增强",
        "is_default": True,
    },
    {
        "name": "MiniMax 极速配音 2.8",
        "model_id": "speech-2.8-turbo",
        "category": "voice",
        "description": "MiniMax 官方极速配音模型 / 速度更快",
        "is_default": False,
    },
    {
        "name": "MiniMax 高清配音 2.6",
        "model_id": "speech-2.6-hd",
        "category": "voice",
        "description": "MiniMax 官方高清配音模型 / 更稳定自然",
        "is_default": False,
    },
    {
        "name": "MiniMax 极速配音 2.6",
        "model_id": "speech-2.6-turbo",
        "category": "voice",
        "description": "MiniMax 官方极速配音模型 / 适合低延迟场景",
        "is_default": False,
    },
]


async def sync_minimax_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []

    for preset in MINIMAX_PRESET_MODELS:
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

    for preset in MINIMAX_PRESET_MODELS:
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
