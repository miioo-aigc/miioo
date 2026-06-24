from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

VIDU_PROVIDER_NAME = "Vidu"
VIDU_BASE_URL = "https://api.vidu.cn"
VIDU_PRESET_MODELS = [
    {
        "name": "Vidu 图片生成 Q2",
        "model_id": "image-vidu-q2",
        "category": "image",
        "description": "官方 Vidu 图片生成 / 参考图生图",
        "is_default": True,
    },
    {
        "name": "Vidu Q3 Pro 生视频",
        "model_id": "viduq3-pro",
        "category": "video",
        "description": "官方 Vidu 文生视频 / 图生视频 / 首尾帧",
        "is_default": True,
    },
    {
        "name": "Vidu Q3 Turbo 生视频",
        "model_id": "viduq3-turbo",
        "category": "video",
        "description": "官方 Vidu 文生视频 / 图生视频 / 首尾帧 / 更快",
        "is_default": False,
    },
    {
        "name": "Vidu Q3 Pro Fast 生视频",
        "model_id": "viduq3-pro-fast",
        "category": "video",
        "description": "官方 Vidu 图生视频 / 首尾帧 / 高速版本",
        "is_default": False,
    },
    {
        "name": "Vidu Q3 Mix 参考生视频",
        "model_id": "viduq3-mix",
        "category": "video",
        "description": "官方 Vidu 参考生视频 / 多图参考主体一致",
        "is_default": False,
    },
    {
        "name": "Vidu Q2 Pro 多帧视频",
        "model_id": "viduq2-pro",
        "category": "video",
        "description": "官方 Vidu 智能多帧 / 参考主体 / Q2 Pro",
        "is_default": False,
    },
    {
        "name": "Vidu Q2 Turbo 多帧视频",
        "model_id": "viduq2-turbo",
        "category": "video",
        "description": "官方 Vidu 智能多帧 / Q2 Turbo",
        "is_default": False,
    },
]


async def sync_vidu_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []

    for preset in VIDU_PRESET_MODELS:
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

    for preset in VIDU_PRESET_MODELS:
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
