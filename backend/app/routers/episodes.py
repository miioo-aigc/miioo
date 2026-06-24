from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.episode import Episode
from app.schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.services.script_gen import generate_script, stream_generate_script
from app.services.user_api_key import get_user_api_key
from app.services.visual_styles import resolve_visual_style_text

router = APIRouter()


async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


def _to_response(ep: Episode) -> EpisodeResponse:
    return EpisodeResponse(
        id=str(ep.id),
        project_id=str(ep.project_id),
        title=ep.title,
        episode_number=ep.episode_number,
        content=ep.content,
        summary=ep.summary,
        status=ep.status,
        created_at=ep.created_at.isoformat(),
        updated_at=ep.updated_at.isoformat(),
    )


@router.get(
    "",
    response_model=list[EpisodeResponse],
    summary="获取分集列表",
    description="返回指定项目下的正式分集列表，按 `episode_number` 排序。",
    response_description="分集列表。",
)
async def list_episodes(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode)
        .where(Episode.project_id == UUID(project_id))
        .order_by(Episode.episode_number, Episode.id.asc())
    )
    return [_to_response(ep) for ep in result.scalars().all()]


@router.post(
    "",
    response_model=EpisodeResponse,
    status_code=201,
    summary="创建分集",
    description="手动创建一条正式分集。若 `episode_number` 已存在会返回错误。",
    response_description="创建成功后的分集。",
)
async def create_episode(project_id: str, req: EpisodeCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_project(project_id, user, db)

    existing = await db.execute(
        select(Episode).where(Episode.project_id == UUID(project_id), Episode.episode_number == req.episode_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该集数编号已存在")

    episode = Episode(
        project_id=UUID(project_id),
        title=req.title,
        episode_number=req.episode_number,
        content=req.content,
        summary=req.summary,
    )
    db.add(episode)
    await db.commit()
    await db.refresh(episode)
    return _to_response(episode)


@router.patch(
    "/{episode_id}",
    response_model=EpisodeResponse,
    summary="更新分集",
    description="更新分集标题、正文、摘要或状态。常用于剧本页编辑后的保存。",
    response_description="更新后的分集。",
)
async def update_episode(project_id: str, episode_id: str, req: EpisodeUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")

    if req.title is not None:
        episode.title = req.title
    if req.content is not None:
        episode.content = req.content
    if req.summary is not None:
        episode.summary = req.summary
    if req.status is not None:
        episode.status = req.status

    await db.commit()
    await db.refresh(episode)
    return _to_response(episode)


@router.delete(
    "/{episode_id}",
    summary="删除分集",
    description="删除指定正式分集。",
    response_description="删除结果。",
)
async def delete_episode(project_id: str, episode_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")

    await db.delete(episode)
    await db.commit()
    return {"message": "已删除"}


class GenerateScriptRequest(BaseModel):
    prompt: str = Field(min_length=1, description="用于生成该集剧本的提示词。", example="请生成这一集的完整短剧台词和场景")
    model: str | None = Field(default=None, description="可选聊天模型 ID。")


@router.post(
    "/{episode_id}/generate",
    response_model=EpisodeResponse,
    summary="同步生成分集剧本",
    description="为指定正式分集同步生成剧本内容。生成成功后会写回 `content` 并将状态更新为 `scripted`。",
    response_description="生成并写回后的分集。",
)
async def generate_episode_script(
    project_id: str,
    episode_id: str,
    req: GenerateScriptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")

    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data
    resolved_visual_style = await resolve_visual_style_text(project.visual_style, user.id, db)

    try:
        content = await generate_script(
            prompt=req.prompt,
            api_key=api_key,
            base_url=base_url,
            project_name=project.name,
            visual_style=resolved_visual_style,
            episode_title=episode.title,
            episode_number=episode.episode_number,
            model=req.model,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 生成失败: {str(e)}")

    episode.content = content
    episode.status = "scripted"
    await db.commit()
    await db.refresh(episode)
    return _to_response(episode)


@router.post(
    "/{episode_id}/generate/stream",
    summary="流式生成分集剧本",
    description="以 `text/event-stream` 形式流式返回剧本生成过程。适合前端边生成边渲染输出。",
    response_description="SSE 流响应。",
)
async def stream_episode_script(
    project_id: str,
    episode_id: str,
    req: GenerateScriptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")

    async def event_generator():
        try:
            key_data = await get_user_api_key(user.id, db)
            if not key_data:
                yield f"data: {{\"error\": \"未配置 API Key\"}}\n\n"
                return

            api_key, base_url = key_data
            resolved_visual_style = await resolve_visual_style_text(project.visual_style, user.id, db)

            async for chunk in stream_generate_script(
                prompt=req.prompt,
                api_key=api_key,
                base_url=base_url,
                project_name=project.name,
                visual_style=resolved_visual_style,
                episode_title=episode.title,
                episode_number=episode.episode_number,
                model=req.model,
            ):
                yield chunk
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
