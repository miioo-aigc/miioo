from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.services.fal_runtime import (
    FAL_BASE_URL,
    FAL_FLUX_DEV_MODEL_ID,
    FAL_FLUX_SCHNELL_MODEL_ID,
    FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
    FAL_PROVIDER_NAME,
    FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID,
    FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID,
    FAL_STABLE_VIDEO_MODEL_ID,
    FAL_WAN_FLF2V_MODEL_ID,
)

FAL_PRESET_MODELS = [
    {
        "name": "fal FLUX.1 [dev]",
        "model_id": FAL_FLUX_DEV_MODEL_ID,
        "category": "image",
        "description": "fal 官方 FLUX 文生图模型",
        "is_default": False,
    },
    {
        "name": "fal FLUX.1 [schnell]",
        "model_id": FAL_FLUX_SCHNELL_MODEL_ID,
        "category": "image",
        "description": "fal 官方 FLUX 快速文生图模型",
        "is_default": False,
    },
    {
        "name": "fal Stable Video",
        "model_id": FAL_STABLE_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Stable Video 图生视频模型",
        "is_default": False,
    },
    {
        "name": "fal WAN FLF2V",
        "model_id": FAL_WAN_FLF2V_MODEL_ID,
        "category": "video",
        "description": "fal 官方首尾帧过渡视频模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 标准文生视频",
        "model_id": FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Standard 文生视频模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 标准图生视频",
        "model_id": FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Standard 图生视频模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 标准运动控制",
        "model_id": FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Standard 运动控制模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 Pro 文生视频",
        "model_id": FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Pro 文生视频模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 Pro 图生视频",
        "model_id": FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Pro 图生视频模型",
        "is_default": False,
    },
    {
        "name": "Kling V3 Pro 运动控制",
        "model_id": FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Kling V3 Pro 运动控制模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 文生视频",
        "model_id": FAL_SEEDANCE_TEXT_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 文生视频模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 文生视频（Fast）",
        "model_id": FAL_SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 快速文生视频模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 图生视频",
        "model_id": FAL_SEEDANCE_IMAGE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 图生视频模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 图生视频（Fast）",
        "model_id": FAL_SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 快速图生视频模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 参考生视频",
        "model_id": FAL_SEEDANCE_REFERENCE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 多模态参考生视频模型",
        "is_default": False,
    },
    {
        "name": "Seedance 2.0 参考生视频（Fast）",
        "model_id": FAL_SEEDANCE_FAST_REFERENCE_TO_VIDEO_MODEL_ID,
        "category": "video",
        "description": "fal 官方 Seedance 2.0 快速多模态参考生视频模型",
        "is_default": False,
    },
]


async def sync_fal_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []

    for preset in FAL_PRESET_MODELS:
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
            model.is_enabled = False
            model.is_default = False
        else:
            model = ModelConfig(
                provider_id=provider.id,
                user_id=user_id,
                name=preset["name"],
                model_id=preset["model_id"],
                category=preset["category"],
                description=preset["description"],
                is_enabled=False,
                is_default=False,
            )
            db.add(model)

        synced_models.append(model)

    return synced_models


__all__ = [
    "FAL_BASE_URL",
    "FAL_PROVIDER_NAME",
    "FAL_PRESET_MODELS",
    "sync_fal_preset_models",
]
