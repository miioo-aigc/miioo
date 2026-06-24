from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider


def build_available_models_query(
    user_id: UUID,
    *,
    category: str | None = None,
    default_only: bool | None = None,
):
    query = (
        select(ModelConfig)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .where(
            ModelConfig.user_id == user_id,
            ApiProvider.user_id == user_id,
            ModelConfig.is_enabled == True,
            ApiProvider.is_enabled == True,
        )
    )
    if category:
        query = query.where(ModelConfig.category == category)
    if default_only is True:
        query = query.where(ModelConfig.is_default == True)
    elif default_only is False:
        query = query.where(ModelConfig.is_default == False)
    return query


async def get_default_available_model_id(
    user_id: UUID,
    db: AsyncSession,
    *,
    category: str,
    fallback_model_id: str,
) -> str:
    default_result = await db.execute(
        build_available_models_query(user_id, category=category, default_only=True).limit(1)
    )
    default_model = default_result.scalars().first()
    if default_model:
        return default_model.model_id

    fallback_result = await db.execute(
        build_available_models_query(user_id, category=category).limit(1)
    )
    fallback_model = fallback_result.scalars().first()
    if fallback_model:
        return fallback_model.model_id

    return fallback_model_id
