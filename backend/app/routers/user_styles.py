from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_style import UserStyle
from app.schemas.user_style import (
    CreateUserStyleRequest,
    UpdateUserStyleRequest,
    UserStyleResponse,
    VisualStyleOptionResponse,
)
from app.services.visual_styles import ACTIVE_BUILT_IN_VISUAL_STYLES, CUSTOM_VISUAL_STYLE_PREFIX

router = APIRouter()


def _to_response(s: UserStyle) -> UserStyleResponse:
    return UserStyleResponse(
        id=str(s.id),
        name=s.name,
        prompt=s.prompt,
        color=s.color,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


def _to_visual_style_option(s: UserStyle) -> VisualStyleOptionResponse:
    return VisualStyleOptionResponse(
        id=str(s.id),
        value=f"{CUSTOM_VISUAL_STYLE_PREFIX}{s.id}",
        label=s.name,
        prompt=s.prompt,
        color=s.color,
        description=s.prompt,
        badge=None,
        is_builtin=False,
        is_custom=True,
    )


@router.get(
    "",
    response_model=list[UserStyleResponse],
    summary="获取用户自定义视觉风格列表",
    description="读取当前登录用户创建的自定义视觉风格列表，按创建时间倒序返回。",
    response_description="用户自定义视觉风格列表。",
)
async def list_user_styles(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserStyle)
        .where(UserStyle.user_id == user.id)
        .order_by(UserStyle.created_at.desc(), UserStyle.id.desc())
    )
    return [_to_response(s) for s in result.scalars().all()]


@router.get(
    "/options",
    response_model=list[VisualStyleOptionResponse],
    summary="获取视觉风格选项",
    description="聚合返回内置视觉风格和当前用户自定义视觉风格，供项目创建和项目编辑等页面直接展示选择器。",
    response_description="视觉风格选项列表。",
)
async def list_visual_style_options(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    built_in_options = [
        VisualStyleOptionResponse(
            id=style.id,
            value=style.id,
            label=style.name,
            prompt=style.prompt,
            color=None,
            description=style.description_cn,
            badge=style.badge,
            is_builtin=True,
            is_custom=False,
        )
        for style in ACTIVE_BUILT_IN_VISUAL_STYLES.values()
    ]

    result = await db.execute(
        select(UserStyle)
        .where(UserStyle.user_id == user.id)
        .order_by(UserStyle.created_at.desc(), UserStyle.id.desc())
    )
    custom_options = [_to_visual_style_option(style) for style in result.scalars().all()]

    return [*built_in_options, *custom_options]


@router.post(
    "",
    response_model=UserStyleResponse,
    summary="创建用户自定义视觉风格",
    description="创建一条新的用户自定义视觉风格，后续可在项目配置中以 `custom:{style_id}` 形式引用。",
    response_description="新创建的用户自定义视觉风格。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "name": "暗黑电影风",
                        "prompt": "dark cinematic, dramatic light",
                        "color": "#111111",
                    }
                }
            }
        }
    },
)
async def create_user_style(req: CreateUserStyleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    style = UserStyle(
        user_id=user.id,
        name=req.name,
        prompt=req.prompt,
        color=req.color,
    )
    db.add(style)
    await db.commit()
    await db.refresh(style)
    return _to_response(style)


@router.patch(
    "/{style_id}",
    response_model=UserStyleResponse,
    summary="更新用户自定义视觉风格",
    description="更新指定自定义视觉风格的名称、提示词或颜色。",
    response_description="更新后的用户自定义视觉风格。",
)
async def update_user_style(style_id: str, req: UpdateUserStyleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserStyle).where(UserStyle.id == UUID(style_id), UserStyle.user_id == user.id)
    )
    style = result.scalar_one_or_none()
    if not style:
        raise HTTPException(status_code=404, detail="风格不存在")

    if req.name is not None:
        style.name = req.name
    if req.prompt is not None:
        style.prompt = req.prompt
    if req.color is not None:
        style.color = req.color

    await db.commit()
    await db.refresh(style)
    return _to_response(style)


@router.delete(
    "/{style_id}",
    summary="删除用户自定义视觉风格",
    description="删除指定的用户自定义视觉风格。删除后该风格不会继续出现在视觉风格选项中。",
    response_description="删除结果。",
)
async def delete_user_style(style_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserStyle).where(UserStyle.id == UUID(style_id), UserStyle.user_id == user.id)
    )
    style = result.scalar_one_or_none()
    if not style:
        raise HTTPException(status_code=404, detail="风格不存在")

    await db.delete(style)
    await db.commit()
    return {"message": "已删除"}
