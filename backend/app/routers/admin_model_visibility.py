from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, literal, or_, select, true, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user
from app.models.admin_model_visibility import AdminModelVisibility
from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.schemas.admin_model_visibility import (
    AdminModelVisibilityListResponse,
    AdminModelVisibilityResponse,
    AdminModelVisibilityUpdateRequest,
)
from app.services.admin_model_visibility import (
    get_admin_model_visibility_record,
    get_provider_display_name,
    normalize_visibility_value,
)

router = APIRouter()


def _to_response(
    *,
    provider_type: str,
    provider_name: str | None,
    model_id: str,
    name: str | None,
    category: str,
    is_visible: bool,
    updated_at: str | None,
) -> AdminModelVisibilityResponse:
    return AdminModelVisibilityResponse(
        provider_type=normalize_visibility_value(provider_type),
        provider_name=get_provider_display_name(provider_type, provider_name),
        model_id=model_id,
        name=name or model_id,
        category=normalize_visibility_value(category),
        is_visible=bool(is_visible),
        updated_at=updated_at,
    )


@router.get(
    "",
    response_model=AdminModelVisibilityListResponse,
    summary="获取管理员模型开放列表",
    description="管理员查看当前系统中可管理的模型开放状态。未写入单独控制记录的模型默认视为开放。",
    response_description="模型开放状态列表。",
)
async def list_admin_model_visibility(
    page: int = Query(1, ge=1, description="页码，从 1 开始。"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量，默认 20。"),
    keyword: str | None = Query(None, description="按模型名称、模型 ID 或服务商搜索。"),
    provider_type: str | None = Query(None, description="按服务商类型筛选。"),
    category: str | None = Query(None, description="按模型分类筛选。"),
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    _ = admin_user
    normalized_provider = normalize_visibility_value(provider_type)
    normalized_category = normalize_visibility_value(category)
    normalized_keyword = (keyword or "").strip()

    deduped_model_rows = (
        select(
            ApiProvider.provider_type.label("provider_type"),
            ApiProvider.name.label("provider_name"),
            ModelConfig.model_id.label("model_id"),
            ModelConfig.name.label("name"),
            ModelConfig.category.label("category"),
            func.coalesce(AdminModelVisibility.is_visible, true()).label("is_visible"),
            AdminModelVisibility.updated_at.label("updated_at"),
            func.row_number()
            .over(
                partition_by=(
                    ApiProvider.provider_type,
                    ModelConfig.category,
                    ModelConfig.model_id,
                ),
                order_by=(ModelConfig.created_at.asc(), ModelConfig.id.asc()),
            )
            .label("row_num"),
        )
        .select_from(ModelConfig)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .outerjoin(
            AdminModelVisibility,
            and_(
                AdminModelVisibility.provider_type == ApiProvider.provider_type,
                AdminModelVisibility.category == ModelConfig.category,
                AdminModelVisibility.model_id == ModelConfig.model_id,
            ),
        )
        .subquery()
    )

    model_rows_stmt = select(
        deduped_model_rows.c.provider_type,
        deduped_model_rows.c.provider_name,
        deduped_model_rows.c.model_id,
        deduped_model_rows.c.name,
        deduped_model_rows.c.category,
        deduped_model_rows.c.is_visible,
        deduped_model_rows.c.updated_at,
    ).where(deduped_model_rows.c.row_num == 1)

    record_has_matching_model = (
        select(literal(1))
        .select_from(ModelConfig)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .where(
            ApiProvider.provider_type == AdminModelVisibility.provider_type,
            ModelConfig.category == AdminModelVisibility.category,
            ModelConfig.model_id == AdminModelVisibility.model_id,
        )
        .exists()
    )

    visibility_only_stmt = select(
        AdminModelVisibility.provider_type.label("provider_type"),
        literal(None).label("provider_name"),
        AdminModelVisibility.model_id.label("model_id"),
        AdminModelVisibility.model_id.label("name"),
        AdminModelVisibility.category.label("category"),
        AdminModelVisibility.is_visible.label("is_visible"),
        AdminModelVisibility.updated_at.label("updated_at"),
    ).where(~record_has_matching_model)

    combined = union_all(model_rows_stmt, visibility_only_stmt).subquery()
    filtered_stmt = select(combined)

    conditions = []
    if normalized_provider:
        conditions.append(func.lower(combined.c.provider_type) == normalized_provider.lower())
    if normalized_category:
        conditions.append(func.lower(combined.c.category) == normalized_category.lower())
    if normalized_keyword:
        search = f"%{normalized_keyword}%"
        conditions.append(
            or_(
                combined.c.name.ilike(search),
                combined.c.model_id.ilike(search),
                combined.c.provider_type.ilike(search),
                func.coalesce(combined.c.provider_name, "").ilike(search),
            )
        )

    if conditions:
        filtered_stmt = filtered_stmt.where(*conditions)
    filtered_subquery = filtered_stmt.subquery()

    total = int((await db.execute(select(func.count()).select_from(filtered_subquery))).scalar_one() or 0)
    visible_total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(filtered_subquery)
                .where(filtered_subquery.c.is_visible == true())
            )
        ).scalar_one()
        or 0
    )

    page_stmt = (
        select(filtered_subquery)
        .order_by(
            filtered_subquery.c.provider_type.asc(),
            filtered_subquery.c.category.asc(),
            func.lower(filtered_subquery.c.name).asc(),
            func.lower(filtered_subquery.c.model_id).asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(page_stmt)).all()

    return AdminModelVisibilityListResponse(
        list=[
            _to_response(
                provider_type=row.provider_type,
                provider_name=row.provider_name,
                model_id=row.model_id,
                name=row.name,
                category=row.category,
                is_visible=bool(row.is_visible),
                updated_at=row.updated_at.isoformat() if row.updated_at else None,
            )
            for row in rows
        ],
        total=total,
        visible_total=visible_total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.put(
    "/{provider_type}/{category}/{model_id:path}",
    response_model=AdminModelVisibilityResponse,
    summary="更新管理员模型开放状态",
    description="管理员控制某个服务商下具体模型是否对普通用户开放。",
    response_description="更新后的模型开放状态。",
)
async def update_admin_model_visibility(
    provider_type: str,
    category: str,
    model_id: str,
    req: AdminModelVisibilityUpdateRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    normalized_provider_type = normalize_visibility_value(provider_type)
    normalized_category = normalize_visibility_value(category)
    normalized_model_id = (model_id or "").strip()

    record = await get_admin_model_visibility_record(
        db,
        provider_type=normalized_provider_type,
        model_id=normalized_model_id,
        category=normalized_category,
    )
    if not record:
        record = AdminModelVisibility(
            provider_type=normalized_provider_type,
            model_id=normalized_model_id,
            category=normalized_category,
            is_visible=bool(req.is_visible),
            created_by=admin_user.id,
            updated_by=admin_user.id,
        )
        db.add(record)
    else:
        record.is_visible = bool(req.is_visible)
        if record.created_by is None:
            record.created_by = admin_user.id
        record.updated_by = admin_user.id

    await db.commit()
    await db.refresh(record)

    model_result = await db.execute(
        select(ModelConfig, ApiProvider)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .where(
            ApiProvider.provider_type == record.provider_type,
            ModelConfig.category == record.category,
            ModelConfig.model_id == record.model_id,
        )
        .order_by(ModelConfig.created_at.asc(), ModelConfig.id.asc())
        .limit(1)
    )
    model_row = model_result.first()
    model_name = model_row[0].name if model_row else record.model_id
    provider_name = model_row[1].name if model_row else None

    return _to_response(
        provider_type=record.provider_type,
        provider_name=provider_name,
        model_id=record.model_id,
        name=model_name,
        category=record.category,
        is_visible=record.is_visible,
        updated_at=record.updated_at.isoformat() if record.updated_at else None,
    )
