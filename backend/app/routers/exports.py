from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.asset import Asset
from app.services.asset_recycle import apply_asset_visibility

router = APIRouter()


class ExportRequest(BaseModel):
    asset_ids: list[str] = Field(default_factory=list, description="指定要导出的资产 ID 列表。若为空，则按项目和分类筛选。")
    project_id: str | None = Field(default=None, description="导出指定项目下的资产。")
    category: str | None = Field(default=None, description="按业务分类筛选，例如 storyboard / character。")
    only_primary: bool = Field(default=False, description="仅导出主资产。")


class ExportResponse(BaseModel):
    files: list[dict] = Field(description="可供前端逐个下载的文件列表。")
    total_count: int = Field(description="文件总数。")


@router.post(
    "/prepare",
    response_model=ExportResponse,
    summary="准备导出清单",
    description="根据资产 ID 列表或筛选条件返回可导出的文件列表，供前端逐个下载或自行打包。",
    response_description="导出文件清单。",
    responses={
        200: {
            "description": "导出清单生成成功",
            "content": {
                "application/json": {
                    "example": {
                        "files": [
                            {
                                "id": "855ccb07-1634-45ec-8c6c-bc6f1d1c2fb2",
                                "name": "第1镜 分镜图",
                                "url": "/uploads/storyboards/demo-shot-1.png",
                                "type": "image",
                                "category": "storyboard",
                            },
                            {
                                "id": "be6a3ecf-807a-49ec-ad36-b59c8f6fd8a0",
                                "name": "女主角色定版",
                                "url": "/uploads/subjects/heroine-primary.png",
                                "type": "image",
                                "category": "character",
                            },
                        ],
                        "total_count": 2,
                    }
                }
            },
        }
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "project_id": "0df3240d-14a3-4a74-8a10-a8b70d1d20d4",
                        "category": "storyboard",
                        "only_primary": False,
                        "asset_ids": [],
                    }
                }
            }
        }
    },
)
async def prepare_export(
    req: ExportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """准备导出：返回文件列表供前端逐个下载"""
    query = apply_asset_visibility(select(Asset).where(Asset.user_id == user.id))

    if req.asset_ids:
        query = query.where(Asset.id.in_([UUID(aid) for aid in req.asset_ids]))
    else:
        if req.project_id:
            query = query.where(Asset.project_id == UUID(req.project_id))
        if req.category:
            query = query.where(Asset.category == req.category)
        if req.only_primary:
            query = query.where(Asset.is_primary == True)

    result = await db.execute(query.order_by(Asset.created_at.desc(), Asset.id.desc()))
    assets = result.scalars().all()

    files = [
        {
            "id": str(a.id),
            "name": a.name,
            "url": a.file_url,
            "type": a.asset_type,
            "category": a.category,
        }
        for a in assets
    ]

    return ExportResponse(files=files, total_count=len(files))
