from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.episode import Episode
from app.services.script_parser import (
    ALLOWED_SCRIPT_EXTENSIONS,
    get_script_file_extension,
    parse_script_upload,
)

router = APIRouter()

async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


@router.post(
    "/{episode_id}/upload",
    summary="上传分集剧本文档",
    description="向指定正式分集上传剧本文档。后端会解析 TXT、Markdown、Word 或 PDF 内容，并将清洗后的文本写回该分集 `content`。",
    response_description="写回内容后的分集对象。",
)
async def upload_script(
    project_id: str,
    episode_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)

    ext = get_script_file_extension(file.filename or "")
    if ext not in ALLOWED_SCRIPT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"仅支持 TXT、Markdown、Word、PDF 文件，当前: {ext}")

    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")

    parsed = await parse_script_upload(file)

    episode.content = parsed.cleaned_text
    episode.status = "scripted"
    await db.commit()
    await db.refresh(episode)

    return {
        "id": str(episode.id),
        "project_id": str(episode.project_id),
        "title": episode.title,
        "episode_number": episode.episode_number,
        "content": episode.content,
        "summary": episode.summary,
        "status": episode.status,
        "created_at": episode.created_at.isoformat(),
        "updated_at": episode.updated_at.isoformat(),
    }
