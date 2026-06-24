from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

VOLCENGINE_PROVIDER_NAME = "Volcengine"
VOLCENGINE_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
VOLCENGINE_VOICE_BASE_URL = "https://openspeech.bytedance.com"
VOLCENGINE_CREDENTIAL_MODE = "dual_api_key"

VOLCENGINE_PRESET_MODELS = [
    {
        "name": "豆包 Seed 2.0 Lite",
        "model_id": "doubao-seed-2-0-lite-260215",
        "category": "chat",
        "description": "火山方舟官方对话模型 / 首版默认 chat 模型",
        "is_default": True,
    },
    {
        "name": "豆包 Seedream 5.0 Lite",
        "model_id": "doubao-seedream-5.0-lite",
        "category": "image",
        "description": "火山官方图片生成模型 / 文生图与参考图生图",
        "is_default": True,
    },
    {
        "name": "豆包 Seedance 2.0",
        "model_id": "doubao-seedance-2.0",
        "category": "video",
        "description": "火山官方视频生成模型 / 文生视频与参考生视频",
        "is_default": True,
    },
]


async def sync_volcengine_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []

    for preset in VOLCENGINE_PRESET_MODELS:
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

    for preset in VOLCENGINE_PRESET_MODELS:
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
