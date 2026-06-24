from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.dependencies import get_current_user
from app.models.asset import Asset
from app.models.composition import Composition
from app.models.gen_task import GenTask
from app.models.notification import Notification
from app.models.project import Project
from app.models.user import User
from app.services.asset_recycle import apply_asset_visibility, restore_asset
from app.services.background_runtime import build_gen_task_job_key, dispatch_background_job
from app.services.composition_export import (
    build_export_plan,
    build_export_plan_from_values,
    render_composition_to_file,
)

router = APIRouter()


class CompositionResponse(BaseModel):
    id: str
    project_id: str
    name: str
    timeline: list | None
    subtitle_style: dict | None
    resolution: str
    aspect_ratio: str
    status: str
    output_url: str | None
    created_at: str
    updated_at: str


class CompositionCreate(BaseModel):
    name: str = "未命名成片"
    timeline: list | None = None
    resolution: str = "1080p"
    aspect_ratio: str = "16:9"


class CompositionUpdate(BaseModel):
    name: str | None = None
    timeline: list | None = None
    subtitle_style: dict | None = None
    resolution: str | None = None
    aspect_ratio: str | None = None


def _to_response(c: Composition) -> CompositionResponse:
    return CompositionResponse(
        id=str(c.id), project_id=str(c.project_id), name=c.name,
        timeline=c.timeline, subtitle_style=c.subtitle_style,
        resolution=c.resolution, aspect_ratio=c.aspect_ratio,
        status=c.status, output_url=c.output_url,
        created_at=c.created_at.isoformat(), updated_at=c.updated_at.isoformat(),
    )


async def _create_notification(
    db: AsyncSession,
    user_id: UUID,
    notif_type: str,
    title: str,
    content: str | None = None,
    link: str | None = None,
):
    db.add(
        Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            content=content,
            link=link,
        )
    )


async def _validate_timeline_for_save(
    db: AsyncSession,
    *,
    user: User,
    project_id: UUID,
    timeline: list | None,
    resolution: str,
    aspect_ratio: str,
) -> None:
    if timeline is None:
        return

    await build_export_plan_from_values(
        db,
        user_id=user.id,
        project_id=project_id,
        timeline=timeline,
        resolution=resolution,
        aspect_ratio=aspect_ratio,
    )


async def _upsert_film_asset(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    composition: Composition,
    task: GenTask,
    total_duration: float,
) -> Asset:
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.user_id == user_id,
                Asset.project_id == project_id,
                Asset.category == "film",
            ),
            include_deleted=True,
        )
    )
    existing_asset = None
    for asset in result.scalars().all():
        metadata = asset.metadata_json or {}
        if metadata.get("composition_id") == str(composition.id):
            existing_asset = asset
            break

    metadata_json = {
        "composition_id": str(composition.id),
        "task_id": str(task.id),
        "timeline_count": len(composition.timeline or []),
        "duration": total_duration,
        "resolution": composition.resolution,
        "aspect_ratio": composition.aspect_ratio,
    }

    if existing_asset:
        existing_asset.name = composition.name
        existing_asset.file_url = composition.output_url or ""
        existing_asset.asset_type = "video"
        existing_asset.category = "film"
        existing_asset.metadata_json = metadata_json
        restore_asset(existing_asset)
        return existing_asset

    asset = Asset(
        user_id=user_id,
        project_id=project_id,
        name=composition.name,
        asset_type="video",
        category="film",
        file_url=composition.output_url or "",
        metadata_json=metadata_json,
    )
    db.add(asset)
    return asset


async def _run_composition_export_task(
    task_id: UUID,
    comp_id: UUID,
    user_id: UUID,
    project_id: UUID,
):
    async with async_session() as db:
        task = (
            await db.execute(
                select(GenTask).where(
                    GenTask.id == task_id,
                    GenTask.user_id == user_id,
                    GenTask.project_id == project_id,
                )
            )
        ).scalar_one_or_none()
        composition = (
            await db.execute(
                select(Composition).where(
                    Composition.id == comp_id,
                    Composition.user_id == user_id,
                    Composition.project_id == project_id,
                )
            )
        ).scalar_one_or_none()

        if not task or not composition:
            return

        try:
            task.status = "running"
            composition.status = "rendering"
            await db.commit()

            plan = await build_export_plan(db, composition)
            output_url = await render_composition_to_file(composition, plan)

            composition.output_url = output_url
            composition.status = "completed"
            task.status = "completed"
            task.success_count = task.total_count
            task.fail_count = 0
            task.results = [
                {
                    "composition_id": str(composition.id),
                    "url": output_url,
                    "duration": plan.total_duration,
                    "timeline_count": len(plan.items),
                    "resolution": composition.resolution,
                    "aspect_ratio": composition.aspect_ratio,
                    "success": True,
                }
            ]

            await _upsert_film_asset(
                db,
                user_id=user_id,
                project_id=project_id,
                composition=composition,
                task=task,
                total_duration=plan.total_duration,
            )
            await db.commit()

            await _create_notification(
                db,
                user_id,
                "creation_log",
                "成片导出完成",
                f"《{composition.name}》已导出为 MP4 并写入资产库",
                "/tasks",
            )
            await db.commit()
        except Exception as exc:
            composition.status = "failed"
            task.status = "failed"
            task.success_count = 0
            task.fail_count = max(task.total_count, 1)
            task.results = [
                {
                    "composition_id": str(comp_id),
                    "success": False,
                    "error": str(exc),
                }
            ]
            await db.commit()

            await _create_notification(
                db,
                user_id,
                "creation_log",
                "成片导出失败",
                str(exc),
                "/tasks",
            )
            await db.commit()


@router.get(
    "",
    response_model=list[CompositionResponse],
    summary="获取成片工程列表",
    description="读取当前项目下的成片工程列表，按创建时间倒序返回，供剪辑成片页展示已有工程。",
    response_description="成片工程列表。",
)
async def list_compositions(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Composition).where(
        Composition.project_id == UUID(project_id), Composition.user_id == user.id
    ).order_by(Composition.created_at.desc(), Composition.id.desc())
    result = await db.execute(query)
    return [_to_response(c) for c in result.scalars().all()]


@router.post(
    "",
    response_model=CompositionResponse,
    status_code=201,
    summary="创建成片工程",
    description="在当前项目下新建一个成片工程，并保存初始时间线、分辨率和画幅比例。",
    response_description="新建后的成片工程。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "name": "第一版剪辑",
                        "timeline": [],
                        "resolution": "1080p",
                        "aspect_ratio": "16:9",
                    }
                }
            }
        }
    },
)
async def create_composition(
    project_id: str,
    req: CompositionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_uuid = UUID(project_id)
    result = await db.execute(select(Project).where(Project.id == project_uuid, Project.user_id == user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    await _validate_timeline_for_save(
        db,
        user=user,
        project_id=project_uuid,
        timeline=req.timeline,
        resolution=req.resolution,
        aspect_ratio=req.aspect_ratio,
    )

    comp = Composition(
        user_id=user.id,
        project_id=project_uuid,
        name=req.name,
        timeline=req.timeline,
        resolution=req.resolution,
        aspect_ratio=req.aspect_ratio,
    )
    db.add(comp)
    await db.commit()
    await db.refresh(comp)
    return _to_response(comp)


@router.patch(
    "/{comp_id}",
    response_model=CompositionResponse,
    summary="更新成片工程",
    description="更新指定成片工程的名称、时间线、字幕样式、分辨率或画幅比例。涉及时间线或输出参数变更时会先进行保存前校验。",
    response_description="更新后的成片工程。",
)
async def update_composition(
    project_id: str,
    comp_id: str,
    req: CompositionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Composition).where(
            Composition.id == UUID(comp_id),
            Composition.project_id == UUID(project_id),
            Composition.user_id == user.id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="成片不存在")

    next_timeline = req.timeline if req.timeline is not None else comp.timeline
    next_resolution = req.resolution if req.resolution is not None else comp.resolution
    next_aspect_ratio = req.aspect_ratio if req.aspect_ratio is not None else comp.aspect_ratio

    if req.timeline is not None or req.resolution is not None or req.aspect_ratio is not None:
        await _validate_timeline_for_save(
            db,
            user=user,
            project_id=UUID(project_id),
            timeline=next_timeline,
            resolution=next_resolution,
            aspect_ratio=next_aspect_ratio,
        )

    if req.name is not None:
        comp.name = req.name
    if req.timeline is not None:
        comp.timeline = req.timeline
    if req.subtitle_style is not None:
        comp.subtitle_style = req.subtitle_style
    if req.resolution is not None:
        comp.resolution = req.resolution
    if req.aspect_ratio is not None:
        comp.aspect_ratio = req.aspect_ratio

    await db.commit()
    await db.refresh(comp)
    return _to_response(comp)


@router.post(
    "/{comp_id}/render",
    response_model=CompositionResponse,
    summary="发起成片导出任务",
    description="为指定成片工程创建导出任务并切换到渲染中状态。任务提交后会后台执行，并通过任务中心与通知中心反馈结果。",
    response_description="已进入渲染状态的成片工程。",
)
async def render_composition(
    project_id: str,
    comp_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Composition).where(
            Composition.id == UUID(comp_id),
            Composition.project_id == UUID(project_id),
            Composition.user_id == user.id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="成片不存在")

    await build_export_plan(db, comp)

    active_tasks = (
        await db.execute(
            select(GenTask).where(
                GenTask.user_id == user.id,
                GenTask.project_id == UUID(project_id),
                GenTask.task_type == "composition_export",
                GenTask.status.in_(("pending", "running")),
            )
        )
    ).scalars().all()
    for task in active_tasks:
        params = task.params or {}
        if params.get("composition_id") == comp_id:
            raise HTTPException(status_code=400, detail="该成片已有导出任务进行中，请稍后再试")

    comp.status = "rendering"
    comp.output_url = None

    task = GenTask(
        user_id=user.id,
        project_id=UUID(project_id),
        task_type="composition_export",
        status="pending",
        total_count=len(comp.timeline or []),
        params={
            "composition_id": comp_id,
            "composition_name": comp.name,
            "resolution": comp.resolution,
            "aspect_ratio": comp.aspect_ratio,
        },
        results=[],
    )
    db.add(task)
    await db.commit()
    await db.refresh(comp)

    await dispatch_background_job(
        build_gen_task_job_key(task.id, task.task_type),
        handler_path="app.routers.compositions:_run_composition_export_task",
        kwargs={
            "task_id": task.id,
            "composition_id": comp.id,
            "user_id": user.id,
            "project_id": UUID(project_id),
        },
        name=f"gen-task:{task.id}:composition-export",
    )
    return _to_response(comp)


@router.delete(
    "/{comp_id}",
    summary="删除成片工程",
    description="删除当前项目下的指定成片工程。该操作会移除工程记录，不会自动清理已导出的历史媒体文件。",
    response_description="删除结果。",
    responses={
        200: {
            "description": "删除成功",
            "content": {
                "application/json": {
                    "example": {
                        "message": "已删除",
                    }
                }
            },
        }
    },
)
async def delete_composition(
    project_id: str,
    comp_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Composition).where(
            Composition.id == UUID(comp_id),
            Composition.project_id == UUID(project_id),
            Composition.user_id == user.id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="成片不存在")
    await db.delete(comp)
    await db.commit()
    return {"message": "已删除"}
