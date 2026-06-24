from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.provider import ApiProvider
from app.models.user import User
from app.models.model_config import ModelConfig
from app.services.aiping_presets import AIPING_PROVIDER_NAME, sync_aiping_preset_models
from app.services.fal_presets import FAL_PROVIDER_NAME, sync_fal_preset_models
from app.services.minimax_presets import MINIMAX_PROVIDER_NAME, sync_minimax_preset_models
from app.services.model_capabilities import get_model_asset_binding_capabilities
from app.services.model_capabilities import get_model_capabilities
from app.services.model_selection import build_available_models_query
from app.services.onelink_presets import (
    ONECLICK_PROVIDER_NAME,
    cleanup_onelink_legacy_models,
    sync_onelink_preset_models,
)
from app.services.vidu_presets import VIDU_PROVIDER_NAME, sync_vidu_preset_models
from app.services.volcengine_presets import VOLCENGINE_PROVIDER_NAME, sync_volcengine_preset_models
from app.services.user_api_key import SHARED_ADMIN_AIPING_MODEL_IDS
from app.schemas.model_config import CreateModelRequest, UpdateModelRequest, ModelConfigResponse

router = APIRouter()
LEGACY_HIDDEN_MODEL_IDS = {
    "tts-1",
    "doubao-seed-tts-2.0",
}


def _to_response(m: ModelConfig, provider: ApiProvider | None = None) -> ModelConfigResponse:
    return ModelConfigResponse(
        id=str(m.id),
        provider_id=str(m.provider_id),
        provider_type=provider.provider_type if provider else None,
        provider_name=provider.name if provider else None,
        name=m.name,
        model_id=m.model_id,
        category=m.category,
        description=m.description,
        is_enabled=m.is_enabled,
        is_default=m.is_default,
        capabilities=get_model_capabilities(m.model_id, m.category),
        created_at=m.created_at.isoformat(),
    )


async def _get_provider_by_name(
    db: AsyncSession,
    user_id,
    provider_name: str,
) -> ApiProvider | None:
    result = await db.execute(
        select(ApiProvider).where(
            ApiProvider.user_id == user_id,
            ApiProvider.name == provider_name,
        ).order_by(
            ApiProvider.is_enabled.desc(),
            ApiProvider.updated_at.desc(),
            ApiProvider.created_at.desc(),
            ApiProvider.id.desc(),
        )
    )
    return result.scalars().first()


async def _sync_builtin_provider_models(db: AsyncSession, user_id) -> None:
    builtins: tuple[tuple[str, object, bool], ...] = (
        (ONECLICK_PROVIDER_NAME, sync_onelink_preset_models, True),
        (AIPING_PROVIDER_NAME, sync_aiping_preset_models, False),
        (MINIMAX_PROVIDER_NAME, sync_minimax_preset_models, False),
        (VIDU_PROVIDER_NAME, sync_vidu_preset_models, False),
        (FAL_PROVIDER_NAME, sync_fal_preset_models, False),
        (VOLCENGINE_PROVIDER_NAME, sync_volcengine_preset_models, False),
    )
    changed = False
    for provider_name, sync_fn, should_cleanup in builtins:
        provider = await _get_provider_by_name(db, user_id, provider_name)
        if not provider:
            continue
        await sync_fn(db, user_id, provider)
        if should_cleanup:
            await cleanup_onelink_legacy_models(db, user_id, provider)
            await sync_fn(db, user_id, provider)
        changed = True
    if changed:
        await db.commit()


async def _build_provider_map(
    db: AsyncSession,
    user_id,
) -> dict[str, ApiProvider]:
    result = await db.execute(select(ApiProvider).where(ApiProvider.user_id == user_id))
    providers = result.scalars().all()
    return {str(provider.id): provider for provider in providers}


async def _get_shared_admin_voice_models(
    db: AsyncSession,
) -> tuple[list[ModelConfig], dict[str, ApiProvider]]:
    query = (
        select(ModelConfig, ApiProvider)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .join(User, User.id == ApiProvider.user_id)
        .where(
            and_(
                User.is_admin == True,
                ModelConfig.user_id == User.id,
                ModelConfig.category == "voice",
                ModelConfig.is_enabled == True,
                ModelConfig.model_id.in_(SHARED_ADMIN_AIPING_MODEL_IDS),
                ApiProvider.user_id == User.id,
                ApiProvider.provider_type == "aiping",
                ApiProvider.is_enabled == True,
            )
        )
        .order_by(
            ModelConfig.is_default.desc(),
            ApiProvider.updated_at.desc(),
            ApiProvider.id.desc(),
            ModelConfig.created_at.asc(),
            ModelConfig.id.asc(),
        )
    )
    result = await db.execute(query)
    rows = result.all()
    models: list[ModelConfig] = []
    provider_map: dict[str, ApiProvider] = {}
    seen_model_ids: set[str] = set()
    for model, provider in rows:
        normalized_model_id = (model.model_id or "").strip().lower()
        if normalized_model_id in seen_model_ids:
            continue
        seen_model_ids.add(normalized_model_id)
        models.append(model)
        provider_map[str(provider.id)] = provider
    return models, provider_map


@router.get(
    "",
    response_model=list[ModelConfigResponse],
    summary="获取模型列表",
    description="返回当前用户可用的模型配置列表。读取前会同步内置 provider 的预置模型，并可按 `category` 过滤。",
    response_description="模型配置列表。",
)
async def list_models(
    category: str | None = Query(None),
    available_only: bool = Query(False, description="仅返回模型和 provider 都处于启用状态的可用模型。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _sync_builtin_provider_models(db, user.id)
    provider_map = await _build_provider_map(db, user.id)

    if available_only:
        query = build_available_models_query(user.id, category=category)
    else:
        query = select(ModelConfig).where(ModelConfig.user_id == user.id)
        if category:
            query = query.where(ModelConfig.category == category)
    query = query.where(~ModelConfig.model_id.in_(LEGACY_HIDDEN_MODEL_IDS))
    result = await db.execute(query)
    models = result.scalars().all()
    if category == "voice":
        existing_voice_model_ids = {
            (model.model_id or "").strip().lower()
            for model in models
        }
        shared_models, shared_provider_map = await _get_shared_admin_voice_models(db)
        for shared_model in shared_models:
            normalized_model_id = (shared_model.model_id or "").strip().lower()
            if normalized_model_id in existing_voice_model_ids:
                continue
            models.append(shared_model)
            existing_voice_model_ids.add(normalized_model_id)
        provider_map.update(shared_provider_map)
    return [_to_response(m, provider_map.get(str(m.provider_id))) for m in models]


@router.post(
    "",
    response_model=ModelConfigResponse,
    summary="创建模型配置",
    description="为指定 provider 新建一个模型配置，可同时设为该分类默认模型。",
    response_description="创建成功后的模型配置。",
)
async def create_model(req: CreateModelRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    provider_result = await db.execute(
        select(ApiProvider).where(ApiProvider.id == UUID(req.provider_id), ApiProvider.user_id == user.id)
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")

    model = ModelConfig(
        provider_id=provider.id,
        user_id=user.id,
        name=req.name,
        model_id=req.model_id,
        category=req.category,
        description=req.description,
        is_enabled=bool(req.is_enabled if req.is_enabled is not None else True),
        is_default=False,
    )

    if req.is_default:
        others = await db.execute(
            select(ModelConfig).where(
                and_(ModelConfig.user_id == user.id, ModelConfig.category == req.category, ModelConfig.is_default == True)
            )
        )
        for other in others.scalars().all():
            other.is_default = False
        model.is_default = True
        model.is_enabled = True

    db.add(model)
    await db.commit()
    await db.refresh(model)
    return _to_response(model, provider)


@router.patch(
    "/{model_id}",
    response_model=ModelConfigResponse,
    summary="更新模型配置",
    description="更新模型启用状态、默认状态、展示名称或描述。设置为默认模型时会自动取消同分类其它默认项。",
    response_description="更新后的模型配置。",
)
async def update_model(model_id: str, req: UpdateModelRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == UUID(model_id), ModelConfig.user_id == user.id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")

    if req.is_enabled is not None:
        model.is_enabled = req.is_enabled
        if req.is_enabled is False and req.is_default is None:
            model.is_default = False
    if req.name is not None:
        model.name = req.name
    if req.description is not None:
        model.description = req.description

    if req.is_default is True:
        others = await db.execute(
            select(ModelConfig).where(
                and_(ModelConfig.user_id == user.id, ModelConfig.category == model.category, ModelConfig.is_default == True)
            )
        )
        for other in others.scalars().all():
            other.is_default = False
        model.is_default = True
        model.is_enabled = True
    elif req.is_default is False:
        model.is_default = False

    await db.commit()
    await db.refresh(model)
    provider = await db.get(ApiProvider, model.provider_id)
    return _to_response(model, provider)


@router.delete(
    "/{model_id}",
    summary="删除模型配置",
    description="删除当前用户下的指定模型配置。",
    response_description="删除结果。",
)
async def delete_model(model_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == UUID(model_id), ModelConfig.user_id == user.id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")

    await db.delete(model)
    await db.commit()
    return {"message": "已删除"}


@router.get(
    "/defaults",
    summary="获取默认模型映射",
    description="返回当前用户按 `category` 聚合的默认模型映射，适合前端初始化模型下拉框默认值。",
    response_description="分类到默认模型的映射。",
)
async def get_defaults(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        build_available_models_query(user.id, default_only=True).where(
            ~ModelConfig.model_id.in_(LEGACY_HIDDEN_MODEL_IDS)
        )
    )
    models = result.scalars().all()
    provider_map = await _build_provider_map(db, user.id)
    return {m.category: _to_response(m, provider_map.get(str(m.provider_id))) for m in models}


@router.get(
    "/{model_id}/asset-capabilities",
    summary="获取模型资产绑定能力",
    description="返回指定模型支持的资产类型和限制，用于前端动态显示资产绑定入口。",
    response_description="模型资产绑定能力配置。",
)
async def get_model_asset_capabilities(
    model_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取模型的资产绑定能力

    返回示例：
    {
        "model": "doubao-seedance-2.0",
        "asset_capabilities": {
            "reference_video": {
                "enabled": true,
                "max_count": 1,
                "supported_formats": ["mp4", "mov"],
                "notes": "支持参考视频动作迁移"
            },
            "reference_audio": { ... },
            "reference_image": { ... },
            ...
        }
    }
    """
    # 查询模型是否存在且用户有权限
    result = await db.execute(
        select(ModelConfig).where(
            ModelConfig.user_id == user.id,
            ModelConfig.model_id == model_id,
        )
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail=f"模型 {model_id} 不存在或无权限访问")

    capabilities = get_model_asset_binding_capabilities(model_id)

    return {
        "model": model_id,
        "model_name": model.name,
        "category": model.category,
        "asset_capabilities": capabilities,
    }
