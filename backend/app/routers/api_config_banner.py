from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user, get_current_user
from app.models.api_config_banner import ApiConfigBanner
from app.models.user import User
from app.schemas.api_config_banner import (
    ApiConfigBannerResponse,
    ApiConfigBannerUpdateRequest,
)

router = APIRouter()


def _to_response(record: ApiConfigBanner | None) -> ApiConfigBannerResponse:
    if not record:
        return ApiConfigBannerResponse()
    return ApiConfigBannerResponse(
        id=str(record.id),
        image_url=record.image_url,
        is_enabled=bool(record.is_enabled),
        created_at=record.created_at.isoformat() if record.created_at else None,
        updated_at=record.updated_at.isoformat() if record.updated_at else None,
    )


async def _get_banner_record(db: AsyncSession) -> ApiConfigBanner | None:
    result = await db.execute(
        select(ApiConfigBanner)
        .order_by(ApiConfigBanner.created_at.asc(), ApiConfigBanner.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get(
    "",
    response_model=ApiConfigBannerResponse,
    summary="获取 API 配置推荐图区图片",
    description="读取 API 配置弹窗顶部推荐图区当前生效的单张主图。若管理员尚未配置图片，会返回空对象结构，前端应展示占位态。",
    response_description="推荐图区图片配置。",
    responses={
        200: {
            "description": "读取成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "3f9fd8c2-aef6-4f11-a91e-b7fc5f9c4a63",
                        "image_url": "/uploads/images/banner.png",
                        "is_enabled": True,
                        "created_at": "2026-06-04T10:30:00",
                        "updated_at": "2026-06-04T10:35:00",
                    }
                }
            },
        }
    },
)
async def get_api_config_banner(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ = user
    record = await _get_banner_record(db)
    return _to_response(record)


@router.put(
    "",
    response_model=ApiConfigBannerResponse,
    summary="保存或替换 API 配置推荐图区图片",
    description="管理员保存 API 配置推荐图区主图及启用状态。若当前没有记录则创建，已有记录时覆盖更新。",
    response_description="保存后的推荐图区图片配置。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "image_url": "/uploads/images/banner.png",
                        "is_enabled": True,
                    }
                }
            }
        }
    },
)
async def update_api_config_banner(
    req: ApiConfigBannerUpdateRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_banner_record(db)
    if not record:
        record = ApiConfigBanner(
            image_url=req.image_url,
            is_enabled=bool(req.is_enabled),
            created_by=admin_user.id,
            updated_by=admin_user.id,
        )
        db.add(record)
    else:
        record.image_url = req.image_url
        record.is_enabled = bool(req.is_enabled)
        if record.created_by is None:
            record.created_by = admin_user.id
        record.updated_by = admin_user.id

    await db.commit()
    await db.refresh(record)
    return _to_response(record)


@router.delete(
    "/image",
    response_model=ApiConfigBannerResponse,
    summary="删除 API 配置推荐图区图片",
    description="管理员删除当前推荐图区图片。该操作会清空 `image_url`，并把 `is_enabled` 置为 `false`。",
    response_description="删除后的推荐图区图片配置。",
)
async def delete_api_config_banner_image(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_banner_record(db)
    if not record:
        return ApiConfigBannerResponse()

    record.image_url = None
    record.is_enabled = False
    if record.created_by is None:
        record.created_by = admin_user.id
    record.updated_by = admin_user.id
    await db.commit()
    await db.refresh(record)
    return _to_response(record)
