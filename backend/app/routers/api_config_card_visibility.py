from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user, get_current_user
from app.models.api_config_card_visibility import ApiConfigCardVisibility
from app.models.user import User
from app.schemas.api_config_card_visibility import (
    ApiConfigCardKey,
    ApiConfigCardVisibilityResponse,
    ApiConfigCardVisibilityUpdateRequest,
)

router = APIRouter()


def _default_items() -> list[ApiConfigCardVisibilityResponse]:
    return [
        ApiConfigCardVisibilityResponse(card_key=card_key, is_visible=True)
        for card_key in ApiConfigCardKey
    ]


@router.get(
    "",
    response_model=list[ApiConfigCardVisibilityResponse],
    summary="获取 API 配置内置卡片展示状态",
    description="读取 API 配置弹窗内置服务商卡片的显示开关。若某张卡片尚未写入数据库，默认视为可见。",
    response_description="内置卡片展示状态列表。",
    responses={
        200: {
            "description": "读取成功",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "card_key": "onelink",
                            "is_visible": True,
                            "updated_at": "2026-06-04T10:30:00",
                        },
                        {
                            "card_key": "fal",
                            "is_visible": False,
                            "updated_at": "2026-06-04T10:35:00",
                        },
                    ]
                }
            },
        }
    },
)
async def get_api_config_card_visibility(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ = user
    result = await db.execute(select(ApiConfigCardVisibility))
    records = {
        record.card_key: record
        for record in result.scalars().all()
        if record.card_key in {item.value for item in ApiConfigCardKey}
    }

    items: list[ApiConfigCardVisibilityResponse] = []
    for card_key in ApiConfigCardKey:
        record = records.get(card_key.value)
        items.append(
            ApiConfigCardVisibilityResponse(
                card_key=card_key,
                is_visible=bool(record.is_visible) if record else True,
                updated_at=record.updated_at.isoformat() if record and record.updated_at else None,
            )
        )
    return items or _default_items()


@router.put(
    "/{card_key}",
    response_model=ApiConfigCardVisibilityResponse,
    summary="更新单张 API 配置卡片展示状态",
    description="管理员更新某张内置服务商卡片在 API 配置弹窗中的可见状态。该配置只影响前端展示，不影响 provider 本身是否启用。",
    response_description="更新后的单张卡片展示状态。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "is_visible": False,
                    }
                }
            }
        }
    },
)
async def update_api_config_card_visibility(
    card_key: ApiConfigCardKey,
    req: ApiConfigCardVisibilityUpdateRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiConfigCardVisibility).where(ApiConfigCardVisibility.card_key == card_key.value)
    )
    record = result.scalar_one_or_none()

    if not record:
        record = ApiConfigCardVisibility(
            card_key=card_key.value,
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
    return ApiConfigCardVisibilityResponse(
        card_key=ApiConfigCardKey(record.card_key),
        is_visible=bool(record.is_visible),
        updated_at=record.updated_at.isoformat() if record.updated_at else None,
    )
