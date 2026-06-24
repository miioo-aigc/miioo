import base64
import json
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func as sa_func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, async_session
from app.dependencies import get_current_user
from app.models.user import User
from app.models.gen_task import GenTask
from app.models.storyboard import Storyboard
from app.models.asset import Asset
from app.models.notification import Notification
from app.models.project import Project
from app.services.image_gen import image_gen_service
from app.services.background_runtime import (
    build_gen_task_job_key,
    cancel_background_job,
    dispatch_background_job,
)
from app.services.media_storage import persist_remote_file
from app.services.runtime_state import check_rate_limit
from app.services.user_api_key import get_user_model_provider_credentials
from app.services.visual_styles import resolve_visual_style_text

router = APIRouter()
TASK_CURSOR_VERSION = 1


async def _enforce_task_mutation_rate_limit(user_id: UUID, action: str) -> None:
    allowed, _ = await check_rate_limit(
        "task-mutation",
        f"{user_id}:{action}",
        limit=settings.TASK_MUTATION_RATE_LIMIT,
        window_seconds=settings.TASK_MUTATION_RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="任务操作过于频繁，请稍后再试")


async def _create_notification(
    db: AsyncSession,
    user_id: UUID,
    notif_type: str,
    title: str,
    content: str | None = None,
    link: str | None = None,
):
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        title=title,
        content=content,
        link=link,
    )
    db.add(notif)
    await db.commit()


class GenTaskResponse(BaseModel):
    id: str = Field(description="任务 UUID。")
    user_id: str = Field(description="所属用户 UUID。")
    project_id: str | None = Field(description="所属项目 UUID。")
    task_type: str = Field(description="任务类型。")
    status: str = Field(description="任务状态，例如 pending / running / completed / partial / failed。")
    total_count: int = Field(description="总处理数量。")
    success_count: int = Field(description="成功数量。")
    fail_count: int = Field(description="失败数量。")
    model: str | None = Field(description="使用的模型。")
    size: str | None = Field(description="生成尺寸。")
    params: dict | None = Field(description="生成参数。")
    results: list | None = Field(description="任务执行结果列表。")
    current_stage: str | None = Field(default=None, description="当前任务阶段。")
    currentStage: str | None = Field(default=None, description="当前任务阶段（camelCase）。")
    partial_ready: bool | None = Field(default=None, description="是否已达到可部分回显状态。")
    partialReady: bool | None = Field(default=None, description="是否已达到可部分回显状态（camelCase）。")
    created_at: str = Field(description="创建时间。")
    updated_at: str = Field(description="更新时间。")


class GenTaskListResponse(BaseModel):
    list: List[GenTaskResponse] = Field(default_factory=list, description="任务列表。")
    total: int = Field(description="任务总数。")
    has_more: bool = Field(description="是否还有更多。")
    hasMore: bool = Field(description="是否还有更多。")
    limit: int = Field(description="当前页容量。")
    offset: int = Field(description="当前偏移量。")
    next_cursor: str | None = Field(default=None, description="下一页游标。")
    nextCursor: str | None = Field(default=None, description="下一页游标。")


def _encode_task_cursor(task: GenTask) -> str:
    payload = {
        "v": TASK_CURSOR_VERSION,
        "id": str(task.id),
        "created_at": task.created_at.isoformat(),
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    ).decode("utf-8")
    return encoded.rstrip("=")


def _decode_task_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        created_at = datetime.fromisoformat(payload["created_at"])
        task_id = UUID(payload["id"])
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="任务分页游标无效") from exc

    if payload.get("v") != TASK_CURSOR_VERSION:
        raise HTTPException(status_code=400, detail="任务分页游标无效")
    return created_at, task_id


def _apply_task_cursor(query, *, created_at: datetime, task_id: UUID):
    return query.where(
        or_(
            GenTask.created_at < created_at,
            and_(GenTask.created_at == created_at, GenTask.id < task_id),
        )
    )


def _to_response(t: GenTask) -> GenTaskResponse:
    params = t.params or {}
    return GenTaskResponse(
        id=str(t.id),
        user_id=str(t.user_id),
        project_id=str(t.project_id) if t.project_id else None,
        task_type=t.task_type,
        status=t.status,
        total_count=t.total_count,
        success_count=t.success_count,
        fail_count=t.fail_count,
        model=t.model,
        size=t.size,
        params=params,
        results=t.results,
        current_stage=params.get("current_stage"),
        currentStage=params.get("current_stage"),
        partial_ready=params.get("partial_ready"),
        partialReady=params.get("partial_ready"),
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    )


@router.get(
    "",
    response_model=GenTaskListResponse,
    summary="获取任务列表",
    description="查询当前用户的生成任务列表，可按项目和状态过滤，按创建时间倒序分页返回。",
    response_description="生成任务列表。",
)
async def list_tasks(
    project_id: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    cursor: str | None = Query(
        None,
        description="基于上一页最后一条任务生成的游标；传入后将优先按 keyset 深分页。",
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(GenTask).where(GenTask.user_id == user.id)
    count_query = select(sa_func.count()).select_from(GenTask).where(GenTask.user_id == user.id)
    if project_id:
        project_uuid = UUID(project_id)
        query = query.where(GenTask.project_id == project_uuid)
        count_query = count_query.where(GenTask.project_id == project_uuid)
    if status:
        query = query.where(GenTask.status == status)
        count_query = count_query.where(GenTask.status == status)

    if cursor:
        cursor_created_at, cursor_task_id = _decode_task_cursor(cursor)
        query = _apply_task_cursor(
            query,
            created_at=cursor_created_at,
            task_id=cursor_task_id,
        )

    query = query.order_by(GenTask.created_at.desc(), GenTask.id.desc())
    query = query.limit(limit + 1) if cursor else query.limit(limit).offset(offset)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(query)
    records = result.scalars().all()
    has_more = len(records) > limit if cursor else offset + len(records) < total
    current_page = records[:limit] if cursor else records
    next_cursor = _encode_task_cursor(current_page[-1]) if has_more and current_page else None
    items = [_to_response(t) for t in current_page]
    return GenTaskListResponse(
        list=items,
        total=total,
        has_more=has_more,
        hasMore=has_more,
        limit=limit,
        offset=offset,
        next_cursor=next_cursor,
        nextCursor=next_cursor,
    )


@router.get(
    "/{task_id}",
    response_model=GenTaskResponse,
    summary="获取任务详情",
    description="读取单个生成任务的状态、进度和结果。",
    response_description="生成任务详情。",
)
async def get_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GenTask).where(GenTask.id == UUID(task_id), GenTask.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _to_response(task)


class CreateTaskRequest(BaseModel):
    project_id: str = Field(description="所属项目 UUID。")
    task_type: str = Field(default="storyboard", description="任务类型。当前主要为 storyboard。")
    storyboard_ids: list[str] = Field(default_factory=list, description="要批量生成的分镜 ID 列表。")
    model: str = Field(default="dall-e-3", description="用于生成的图片模型 ID。")
    size: str = Field(default="1024x1024", description="生成尺寸。")
    params: dict | None = Field(default=None, description="扩展生成参数。")


async def _run_storyboard_gen_task(task_id: UUID, storyboard_ids: list[str], model: str, size: str, user_id: UUID, project_id: UUID, visual_style: str = ""):
    async with async_session() as db:
        result = await db.execute(select(GenTask).where(GenTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return

        task.status = "running"
        await db.commit()

        key_data = await get_user_model_provider_credentials(
            user_id,
            db,
            category="image",
            requested_model=model,
        )
        if not key_data:
            task.status = "failed"
            task.results = [{"error": "未配置图片模型对应服务商"}]
            await db.commit()
            await _create_notification(
                db, user_id, "creation_log",
                f"分镜图生成失败",
                f"未配置图片模型对应服务商，请先在配置页面设置",
                f"/config"
            )
            return

        api_key, base_url, _, model = key_data

        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()
        if project and not visual_style:
            visual_style = project.visual_style or ""
        resolved_visual_style = await resolve_visual_style_text(visual_style, user_id, db)

        results = []
        for sid in storyboard_ids:
            sb_result = await db.execute(select(Storyboard).where(Storyboard.id == UUID(sid)))
            sb = sb_result.scalar_one_or_none()
            if not sb or not sb.image_prompt:
                results.append({"id": sid, "success": False, "error": "无提示词"})
                task.fail_count += 1
                continue

            prompt = sb.image_prompt
            if resolved_visual_style:
                prompt = f"{sb.image_prompt}, {resolved_visual_style}"

            try:
                urls = await image_gen_service.generate(prompt=prompt, api_key=api_key, base_url=base_url, model=model, size=size)
                if urls:
                    persisted_url = await persist_remote_file(
                        urls[0],
                        f"storyboards/{project_id}",
                        fallback_extension=".png",
                    )
                    sb.image_url = persisted_url
                    asset = Asset(
                        user_id=user_id,
                        project_id=project_id,
                        name=f"分镜 #{sb.shot_number}",
                        asset_type="image",
                        category="storyboard",
                        file_url=persisted_url,
                        prompt=prompt,
                        model=model,
                        size=size,
                    )
                    db.add(asset)
                    results.append({"id": sid, "success": True, "url": persisted_url})
                    task.success_count += 1
                else:
                    results.append({"id": sid, "success": False, "error": "未返回结果"})
                    task.fail_count += 1
            except Exception as e:
                results.append({"id": sid, "success": False, "error": str(e)})
                task.fail_count += 1

            task.results = results
            await db.commit()

        # 最终状态
        if task.fail_count == 0:
            task.status = "completed"
        elif task.success_count == 0:
            task.status = "failed"
        else:
            task.status = "partial"

        task.results = results
        await db.commit()

        # 创建通知
        if task.status == "completed":
            await _create_notification(
                db, user_id, "creation_log",
                f"分镜图生成完成",
                f"成功生成 {task.success_count} 张分镜图",
                f"/tasks"
            )
        elif task.status == "failed":
            await _create_notification(
                db, user_id, "creation_log",
                f"分镜图生成失败",
                f"任务执行失败，请检查 API Key 和网络",
                f"/tasks"
            )
        elif task.status == "partial":
            await _create_notification(
                db, user_id, "creation_log",
                f"分镜图生成部分完成",
                f"成功 {task.success_count} 张，失败 {task.fail_count} 张",
                f"/tasks"
            )


@router.post(
    "",
    response_model=GenTaskResponse,
    status_code=201,
    summary="创建生成任务",
    description="创建旧版批量分镜图生成任务。任务提交后会在后台异步执行，并通过通知中心提示结果。",
    response_description="新建的生成任务。",
)
async def create_task(
    req: CreateTaskRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_task_mutation_rate_limit(user.id, "create")
    visual_style = ""
    project_result = await db.execute(select(Project).where(Project.id == UUID(req.project_id)))
    project = project_result.scalar_one_or_none()
    if project:
        visual_style = project.visual_style or ""

    task = GenTask(
        user_id=user.id,
        project_id=UUID(req.project_id),
        task_type=req.task_type,
        status="pending",
        total_count=len(req.storyboard_ids),
        model=req.model,
        size=req.size,
        params=req.params,
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    if req.task_type == "storyboard" and req.storyboard_ids:
        await dispatch_background_job(
            build_gen_task_job_key(task.id, task.task_type),
            handler_path="app.routers.tasks:_run_storyboard_gen_task",
            kwargs={
                "task_id": task.id,
                "storyboard_ids": req.storyboard_ids,
                "model": req.model,
                "size": req.size,
                "user_id": user.id,
                "project_id": UUID(req.project_id),
                "visual_style": visual_style,
            },
            name=f"gen-task:{task.id}:storyboard-batch",
        )

    return _to_response(task)


@router.post(
    "/{task_id}/cancel",
    summary="取消任务",
    description="取消当前仍处于处理中状态的旧版生成任务。已完成、已失败或已取消的任务不可再次取消。",
    response_description="取消结果。",
    responses={
        200: {
            "description": "取消成功",
            "content": {
                "application/json": {
                    "example": {
                        "message": "已取消",
                    }
                }
            },
        }
    },
)
async def cancel_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_task_mutation_rate_limit(user.id, "cancel")
    result = await db.execute(
        select(GenTask).where(GenTask.id == UUID(task_id), GenTask.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail="任务已结束，无法取消")

    task.status = "cancelled"
    await db.commit()
    await cancel_background_job(build_gen_task_job_key(task.id, task.task_type))
    return {"message": "已取消"}


@router.post(
    "/{task_id}/retry",
    response_model=GenTaskResponse,
    summary="重试任务失败项",
    description="针对已执行过的旧版生成任务，筛出失败项并重新提交后台执行。当前主要用于旧版分镜图批量生成任务的失败重试。",
    response_description="重试后重新进入 pending 状态的任务。",
)
async def retry_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _enforce_task_mutation_rate_limit(user.id, "retry")
    result = await db.execute(
        select(GenTask).where(GenTask.id == UUID(task_id), GenTask.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 收集失败项
    failed_ids = [r["id"] for r in (task.results or []) if not r.get("success")]
    if not failed_ids:
        raise HTTPException(status_code=400, detail="没有失败项可重试")

    task.status = "pending"
    task.fail_count = 0
    task.results = [r for r in (task.results or []) if r.get("success")]
    await db.commit()
    await db.refresh(task)

    if task.task_type == "storyboard":
        visual_style = ""
        project_result = await db.execute(select(Project).where(Project.id == task.project_id))
        project = project_result.scalar_one_or_none()
        if project:
            visual_style = project.visual_style or ""
        await dispatch_background_job(
            build_gen_task_job_key(task.id, task.task_type),
            handler_path="app.routers.tasks:_run_storyboard_gen_task",
            kwargs={
                "task_id": task.id,
                "storyboard_ids": failed_ids,
                "model": task.model or "dall-e-3",
                "size": task.size or "1024x1024",
                "user_id": user.id,
                "project_id": task.project_id,
                "visual_style": visual_style,
            },
            name=f"gen-task:{task.id}:storyboard-retry",
        )

    return _to_response(task)


class VideoTaskStatusResponse(BaseModel):
    status: str
    progress: int
    current_stage: str | None = None
    currentStage: str | None = None
    partial_ready: bool | None = None
    partialReady: bool | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    error: str | None = None


@router.get(
    "/video/{task_id}",
    response_model=VideoTaskStatusResponse,
    summary="查询视频任务状态",
    description="兼容旧前端的视频任务轮询接口，返回统一后的状态、进度、视频地址、缩略图地址和错误信息。",
    response_description="视频任务当前状态。",
    responses={
        200: {
            "description": "查询成功",
            "content": {
                "application/json": {
                    "example": {
                        "status": "done",
                        "progress": 100,
                        "video_url": "/uploads/videos/demo.mp4",
                        "thumbnail_url": "/uploads/images/demo-cover.png",
                        "error": None,
                    }
                }
            },
        }
    },
)
async def get_video_task_status(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GenTask).where(GenTask.id == UUID(task_id), GenTask.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    params = task.params or {}

    if task.status == "completed":
        video_url = None
        thumbnail_url = None
        if task.results and len(task.results) > 0:
            first_result = task.results[0]
            video_url = first_result.get("url")
            thumbnail_url = first_result.get("thumbnail_url")
        return VideoTaskStatusResponse(
            status="done",
            progress=100,
            current_stage=params.get("current_stage"),
            currentStage=params.get("current_stage"),
            partial_ready=params.get("partial_ready"),
            partialReady=params.get("partial_ready"),
            video_url=video_url,
            thumbnail_url=thumbnail_url,
        )
    elif task.status == "failed":
        error_msg = "任务执行失败"
        if task.results and len(task.results) > 0:
            error_msg = task.results[0].get("error", error_msg)
        return VideoTaskStatusResponse(
            status="failed",
            progress=0,
            current_stage=params.get("current_stage"),
            currentStage=params.get("current_stage"),
            partial_ready=params.get("partial_ready"),
            partialReady=params.get("partial_ready"),
            error=error_msg,
        )
    elif task.status == "running":
        progress = 50
        return VideoTaskStatusResponse(
            status="generating",
            progress=progress,
            current_stage=params.get("current_stage"),
            currentStage=params.get("current_stage"),
            partial_ready=params.get("partial_ready"),
            partialReady=params.get("partial_ready"),
        )
    else:
        return VideoTaskStatusResponse(
            status="pending",
            progress=0,
            current_stage=params.get("current_stage"),
            currentStage=params.get("current_stage"),
            partial_ready=params.get("partial_ready"),
            partialReady=params.get("partial_ready"),
        )
