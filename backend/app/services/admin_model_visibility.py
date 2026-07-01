from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_model_visibility import AdminModelVisibility
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

ADMIN_MODEL_HIDDEN_DETAIL = "当前模型已被管理员关闭，请选择其他模型"
PROVIDER_DISPLAY_NAMES: dict[str, str] = {
    "onelink": "OneLinkAI",
    "minimax": "MiniMax",
    "aiping": "AI Ping",
    "volcengine": "火山引擎",
    "vidu": "Vidu",
    "fal": "Fal",
}


def normalize_visibility_value(value: str | None) -> str:
    return str(value or "").strip().lower()


def build_visibility_join_condition(
    *,
    provider_type_column,
    model_id_column,
    category_column,
):
    return and_(
        func.lower(AdminModelVisibility.provider_type) == func.lower(provider_type_column),
        func.lower(AdminModelVisibility.model_id) == func.lower(model_id_column),
        func.lower(AdminModelVisibility.category) == func.lower(category_column),
    )


def apply_visibility_filter(
    query,
    *,
    provider_type_column,
    model_id_column,
    category_column,
):
    return (
        query.outerjoin(
            AdminModelVisibility,
            build_visibility_join_condition(
                provider_type_column=provider_type_column,
                model_id_column=model_id_column,
                category_column=category_column,
            ),
        ).where(
            or_(
                AdminModelVisibility.id.is_(None),
                AdminModelVisibility.is_visible == True,
            )
        )
    )


async def get_admin_model_visibility_record(
    db: AsyncSession,
    *,
    provider_type: str,
    model_id: str,
    category: str,
) -> AdminModelVisibility | None:
    normalized_provider_type = normalize_visibility_value(provider_type)
    normalized_model_id = normalize_visibility_value(model_id)
    normalized_category = normalize_visibility_value(category)
    if not normalized_provider_type or not normalized_model_id or not normalized_category:
        return None

    result = await db.execute(
        select(AdminModelVisibility).where(
            func.lower(AdminModelVisibility.provider_type) == normalized_provider_type,
            func.lower(AdminModelVisibility.model_id) == normalized_model_id,
            func.lower(AdminModelVisibility.category) == normalized_category,
        )
    )
    return result.scalar_one_or_none()


async def is_model_visible_for_provider(
    db: AsyncSession,
    *,
    provider_type: str,
    model_id: str,
    category: str,
) -> bool:
    record = await get_admin_model_visibility_record(
        db,
        provider_type=provider_type,
        model_id=model_id,
        category=category,
    )
    return True if record is None else bool(record.is_visible)


async def raise_if_model_hidden_for_user(
    db: AsyncSession,
    *,
    user_id,
    category: str,
    requested_model: str | None,
) -> None:
    normalized_model = normalize_visibility_value(requested_model)
    normalized_category = normalize_visibility_value(category)
    if not normalized_model or not normalized_category:
        return

    query = (
        select(ModelConfig.id)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .join(
            AdminModelVisibility,
            build_visibility_join_condition(
                provider_type_column=ApiProvider.provider_type,
                model_id_column=ModelConfig.model_id,
                category_column=ModelConfig.category,
            ),
        )
        .where(
            ModelConfig.user_id == user_id,
            ApiProvider.user_id == user_id,
            ModelConfig.is_enabled == True,
            ApiProvider.is_enabled == True,
            func.lower(ModelConfig.category) == normalized_category,
            func.lower(ModelConfig.model_id) == normalized_model,
            AdminModelVisibility.is_visible == False,
        )
        .limit(1)
    )
    result = await db.execute(query)
    if result.first():
        raise HTTPException(status_code=400, detail=ADMIN_MODEL_HIDDEN_DETAIL)


def get_provider_display_name(provider_type: str | None, fallback: str | None = None) -> str:
    normalized_provider_type = normalize_visibility_value(provider_type)
    if normalized_provider_type in PROVIDER_DISPLAY_NAMES:
        return PROVIDER_DISPLAY_NAMES[normalized_provider_type]
    return str(fallback or normalized_provider_type or "未知服务商")
