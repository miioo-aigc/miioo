from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user
from app.models.community_qr_config import CommunityQrConfig
from app.models.user import User
from app.schemas.community_qr_config import (
    CommunityQrConfigResponse,
    CommunityQrConfigUpdateRequest,
)

router = APIRouter()


def _to_response(record: CommunityQrConfig | None) -> CommunityQrConfigResponse:
    if not record:
        return CommunityQrConfigResponse()
    return CommunityQrConfigResponse(
        id=str(record.id),
        image_url=record.image_url,
        is_enabled=bool(record.is_enabled),
        created_at=record.created_at.isoformat() if record.created_at else None,
        updated_at=record.updated_at.isoformat() if record.updated_at else None,
    )


async def _get_config_record(db: AsyncSession) -> CommunityQrConfig | None:
    result = await db.execute(
        select(CommunityQrConfig)
        .order_by(CommunityQrConfig.created_at.asc(), CommunityQrConfig.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get(
    "",
    response_model=CommunityQrConfigResponse,
    summary="获取首页社群二维码配置",
    description="读取首页左下角“应用”入口使用的社群二维码图片配置。该接口允许匿名访问，便于未登录用户也能看到社群入口。",
    response_description="社群二维码配置。",
    responses={
        200: {
            "description": "读取成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "3f9fd8c2-aef6-4f11-a91e-b7fc5f9c4a63",
                        "image_url": "/uploads/images/community-qr.png",
                        "is_enabled": True,
                        "created_at": "2026-06-04T10:30:00",
                        "updated_at": "2026-06-04T10:35:00",
                    }
                }
            },
        }
    },
)
async def get_community_qr_config(
    db: AsyncSession = Depends(get_db),
):
    record = await _get_config_record(db)
    return _to_response(record)


@router.put(
    "",
    response_model=CommunityQrConfigResponse,
    summary="保存或替换首页社群二维码配置",
    description="管理员保存首页社群二维码图片及启用状态。若不存在记录则创建，已有记录时覆盖更新。",
    response_description="保存后的社群二维码配置。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "image_url": "/uploads/images/community-qr.png",
                        "is_enabled": True,
                    }
                }
            }
        }
    },
)
async def update_community_qr_config(
    req: CommunityQrConfigUpdateRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_config_record(db)
    if not record:
        record = CommunityQrConfig(
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
