from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter()


class NotificationResponse(BaseModel):
    id: str = Field(description="通知 UUID。")
    type: str = Field(description="通知类型。", example="creation_log")
    title: str = Field(description="通知标题。")
    content: str | None = Field(description="通知正文。")
    link: str | None = Field(description="前端跳转链接。")
    is_read: bool = Field(description="是否已读。")
    created_at: str = Field(description="通知创建时间。")


class NotificationListResponse(BaseModel):
    list: List[NotificationResponse] = Field(default_factory=list, description="通知列表。")
    total: int = Field(description="通知总数。")
    has_more: bool = Field(description="是否还有更多。")
    hasMore: bool = Field(description="是否还有更多。")
    page: int = Field(description="当前页码。")
    page_size: int = Field(description="每页数量。")
    pageSize: int = Field(description="每页数量。")


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="获取通知列表",
    description="获取当前用户通知列表，可按已读状态和通知类型过滤，按创建时间倒序分页返回。",
    response_description="通知列表。",
)
async def list_notifications(
    is_read: bool | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(Notification.user_id == user.id)
    count_query = select(sa_func.count()).select_from(Notification).where(Notification.user_id == user.id)
    if is_read is not None:
        query = query.where(Notification.is_read == is_read)
        count_query = count_query.where(Notification.is_read == is_read)
    if type:
        query = query.where(Notification.type == type)
        count_query = count_query.where(Notification.type == type)
    offset = (page - 1) * page_size
    query = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(page_size).offset(offset)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(query)
    items = [
        NotificationResponse(
            id=str(n.id), type=n.type, title=n.title,
            content=n.content, link=n.link, is_read=n.is_read,
            created_at=n.created_at.isoformat(),
        )
        for n in result.scalars().all()
    ]
    has_more = offset + len(items) < total
    return NotificationListResponse(
        list=items,
        total=total,
        has_more=has_more,
        hasMore=has_more,
        page=page,
        page_size=page_size,
        pageSize=page_size,
    )


@router.get(
    "/unread-count",
    summary="获取未读通知数量",
    description="返回当前用户的未读通知总数。",
    response_description="未读通知数量。",
)
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(sa_func.count()).where(Notification.user_id == user.id, Notification.is_read == False)
    )
    count = result.scalar() or 0
    return {"count": count}


@router.patch(
    "/{notification_id}/read",
    summary="标记通知为已读",
    description="将指定通知标记为已读。",
    response_description="标记结果。",
)
async def mark_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.id == UUID(notification_id), Notification.user_id == user.id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="通知不存在")
    n.is_read = True
    await db.commit()
    return {"message": "已读"}


@router.post(
    "/read-all",
    summary="全部标记为已读",
    description="将当前用户全部未读通知批量标记为已读。",
    response_description="批量标记结果。",
)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification).where(Notification.user_id == user.id, Notification.is_read == False).values(is_read=True)
    )
    await db.commit()
    return {"message": "全部已读"}


@router.delete(
    "/{notification_id}",
    summary="删除通知",
    description="删除指定通知。",
    response_description="删除结果。",
)
async def delete_notification(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.id == UUID(notification_id), Notification.user_id == user.id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(status_code=404, detail="通知不存在")
    await db.delete(n)
    await db.commit()
    return {"message": "已删除"}
