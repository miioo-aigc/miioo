import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.subject import Subject
from app.models.subject_image import SubjectImage
from app.models.user import User
from app.schemas.project_script import (
    ProjectScriptApplySplitRequest,
    ProjectScriptApplySplitResponse,
    ProjectScriptChatRequest,
    ProjectScriptExtractSubjectsResponse,
    ProjectScriptFinalizeRequest,
    ProjectScriptFinalizeResponse,
    ProjectScriptHistoryListResponse,
    ProjectScriptHistoryResponse,
    ProjectScriptMessageResponse,
    ProjectScriptResponse,
    ProjectScriptSplitPreviewRequest,
    ProjectScriptSplitPreviewResponse,
    ProjectScriptUpdateRequest,
    ProjectScriptWorkspaceResponse,
)
from app.schemas.subject import SubjectResponse
from app.services.project_script_service import (
    apply_split_to_episodes,
    chat_with_project_script,
    create_script_history,
    extract_global_subjects_from_script,
    finalize_project_script_workspace,
    finalize_project_script_and_extract_subjects,
    get_or_create_project_script,
    get_script_history,
    list_project_script_messages,
    list_script_histories,
    restore_script_history,
    split_project_script_preview,
    stream_chat_with_project_script,
)
from app.services.script_parser import ALLOWED_SCRIPT_EXTENSIONS, parse_script_upload

router = APIRouter()


async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


def _to_script_response(script) -> ProjectScriptResponse:
    return ProjectScriptResponse(
        id=str(script.id),
        project_id=str(script.project_id),
        source_type=script.source_type,
        title=script.title,
        content=script.content,
        parsed_content=script.parsed_content,
        status=script.status,
        last_uploaded_filename=script.last_uploaded_filename,
        last_uploaded_file_type=script.last_uploaded_file_type,
        created_at=script.created_at.isoformat(),
        updated_at=script.updated_at.isoformat(),
    )


def _to_message_response(message) -> ProjectScriptMessageResponse:
    return ProjectScriptMessageResponse(
        id=str(message.id),
        role=message.role,
        content=message.content,
        message_type=message.message_type,
        created_at=message.created_at.isoformat(),
    )


def _to_history_response(history) -> ProjectScriptHistoryResponse:
    snapshot_items = (history.snapshot_payload or {}).get("items") if history.snapshot_payload else None
    return ProjectScriptHistoryResponse(
        id=str(history.id),
        version_number=history.version_number,
        source_type=history.source_type,
        source_detail=history.source_detail,
        history_kind=history.snapshot_type,
        content=history.content,
        episode_count=len(snapshot_items) if snapshot_items else None,
        snapshot_payload=snapshot_items,
        created_at=history.created_at.isoformat(),
    )


async def _to_subject_response(subject: Subject, db: AsyncSession) -> SubjectResponse:
    image_result = await db.execute(
        select(SubjectImage).where(SubjectImage.subject_id == subject.id, SubjectImage.is_primary == True)
    )
    primary_image = image_result.scalar_one_or_none()
    count_result = await db.execute(
        select(sa_func.count()).where(SubjectImage.subject_id == subject.id)
    )
    image_count = count_result.scalar() or 0
    return SubjectResponse(
        id=str(subject.id),
        project_id=str(subject.project_id),
        episode_id=str(subject.episode_id) if subject.episode_id else None,
        type=subject.type,
        name=subject.name,
        role=subject.role,
        description=subject.description,
        appearance=subject.appearance,
        personality=subject.personality,
        prompt=subject.prompt,
        image_url=subject.image_url,
        is_global=subject.is_global,
        age=subject.age,
        gender=subject.gender,
        background=subject.background,
        scene_type=subject.scene_type,
        time_setting=subject.time_setting,
        atmosphere=subject.atmosphere,
        importance=subject.importance,
        owner_subject_id=str(subject.owner_subject_id) if subject.owner_subject_id else None,
        voice_id=subject.voice_id,
        reference_image_url=subject.reference_image_url,
        reference_asset_id=str(subject.reference_asset_id) if subject.reference_asset_id else None,
        gen_config=subject.gen_config,
        primary_image_url=primary_image.image_url if primary_image else subject.image_url,
        image_count=image_count,
        created_at=subject.created_at.isoformat(),
        updated_at=subject.updated_at.isoformat(),
    )


@router.get(
    "",
    response_model=ProjectScriptWorkspaceResponse,
    summary="获取主剧本工作区",
    description="读取项目级主剧本工作区，包括当前整稿内容和该工作区下的对话消息记录。",
    response_description="主剧本工作区信息。",
)
async def get_script_workspace(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    messages = await list_project_script_messages(script.id, db)
    return ProjectScriptWorkspaceResponse(
        script=_to_script_response(script),
        messages=[_to_message_response(message) for message in messages],
    )


@router.post(
    "/upload",
    response_model=ProjectScriptWorkspaceResponse,
    summary="上传主剧本文档",
    description="上传 TXT、Markdown、Word 或 PDF 作为项目主剧本。上传后写入主剧本工作区并创建一条历史记录。",
    response_description="上传后的主剧本工作区信息。",
)
async def upload_project_script(
    project_id: str,
    file: UploadFile = File(..., description="主剧本文档文件，支持 txt / md / markdown / docx / pdf。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    extension = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if extension not in ALLOWED_SCRIPT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"仅支持 TXT、Markdown、Word、PDF 文件，当前: {extension}")

    parsed = await parse_script_upload(file)
    script = await get_or_create_project_script(project_id, db)
    script.source_type = "upload"
    script.title = script.title or "项目主剧本"
    script.content = parsed.cleaned_text
    script.parsed_content = parsed.cleaned_text
    script.status = "parsed"
    script.last_uploaded_filename = parsed.filename
    script.last_uploaded_file_type = parsed.extension
    await db.flush()
    await create_script_history(script, "upload", parsed.filename, db)
    await db.commit()
    await db.refresh(script)
    messages = await list_project_script_messages(script.id, db)
    return ProjectScriptWorkspaceResponse(
        script=_to_script_response(script),
        messages=[_to_message_response(message) for message in messages],
    )


@router.patch(
    "",
    response_model=ProjectScriptResponse,
    summary="更新主剧本内容",
    description="手动更新主剧本标题或正文。若正文非空，工作区状态会更新为 parsed，并新增一条 manual 历史记录。",
    response_description="更新后的主剧本工作区对象。",
)
async def update_project_script(
    project_id: str,
    req: ProjectScriptUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    if req.title is not None:
        script.title = req.title.strip() or None
    if req.content is not None:
        script.content = req.content
        script.status = "parsed" if req.content and req.content.strip() else "draft"
        script.source_type = "manual"
        await db.flush()
        await create_script_history(script, "manual", "手动编辑", db)
    await db.commit()
    await db.refresh(script)
    return _to_script_response(script)


@router.post(
    "/chat",
    response_model=ProjectScriptWorkspaceResponse,
    summary="与主剧本对话生成",
    description="向主剧本工作区发送 AI 指令。可用于从创意生成整稿，或基于当前整稿继续修改。",
    response_description="更新后的主剧本工作区与消息列表。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "message": "请基于这个项目生成 3 集短剧整稿，每集都有明确冲突和反转",
                        "episode_count": 3,
                        "model": "gpt-4.1",
                        "apply_to_script": True,
                    }
                }
            }
        }
    },
)
async def chat_project_script(
    project_id: str,
    req: ProjectScriptChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    script, _, _ = await chat_with_project_script(
        project=project,
        project_script=script,
        user_message=req.message,
        episode_count=req.episode_count,
        model=req.model,
        apply_to_script=req.apply_to_script,
        db=db,
    )
    messages = await list_project_script_messages(script.id, db)
    return ProjectScriptWorkspaceResponse(
        script=_to_script_response(script),
        messages=[_to_message_response(message) for message in messages],
    )


@router.post(
    "/chat/stream",
    summary="流式与主剧本对话生成",
    description="向主剧本工作区发送 AI 指令，并以 `text/event-stream` 形式持续返回增量内容。适合前端边生成边展示整稿。",
    response_description="SSE 数据流，按 chunk 持续返回模型输出。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "message": "请基于这个项目生成 3 集短剧整稿，每集都有明确冲突和反转",
                        "episode_count": 3,
                        "model": "gpt-4.1",
                        "apply_to_script": True,
                    }
                }
            }
        }
    },
)
async def chat_project_script_stream(
    project_id: str,
    req: ProjectScriptChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)

    async def event_generator():
        try:
            async for chunk in stream_chat_with_project_script(
                project=project,
                project_script=script,
                user_message=req.message,
                episode_count=req.episode_count,
                model=req.model,
                apply_to_script=req.apply_to_script,
                db=db,
            ):
                yield chunk
        except Exception as exc:
            detail = getattr(exc, "detail", str(exc))
            yield f"data: {json.dumps({'error': detail}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/split-preview",
    response_model=ProjectScriptSplitPreviewResponse,
    summary="获取拆分预览",
    description="基于当前主剧本工作区内容，生成正式分集的拆分预览结果，不直接写入 episodes。",
    response_description="拆分预览结果。",
)
async def preview_split_project_script(
    project_id: str,
    req: ProjectScriptSplitPreviewRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    items = await split_project_script_preview(
        split_mode=req.split_mode,
        project=project,
        project_script=script,
        episode_count=req.episode_count,
        model=req.model,
        db=db,
    )
    preview_items, split_source = items
    return ProjectScriptSplitPreviewResponse(items=preview_items, split_source=split_source)


@router.post(
    "/apply-split",
    response_model=ProjectScriptApplySplitResponse,
    summary="按预览结果应用拆分",
    description="将前端确认后的拆分结果正式写入 episodes。适用于前端允许手动调整拆分结果后再提交的场景。",
    response_description="正式分集写入结果。",
)
async def apply_project_script_split(
    project_id: str,
    req: ProjectScriptApplySplitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    replaced_count, created_count, _ = await apply_split_to_episodes(script, req.items, db)
    return ProjectScriptApplySplitResponse(
        replaced_count=replaced_count,
        created_count=created_count,
        script_status=script.status,
    )


@router.post(
    "/finalize",
    response_model=ProjectScriptFinalizeResponse,
    summary="定稿主剧本并拆分分集",
    description="将主剧本工作区正式定稿为 episodes，并可选自动触发主体提取。这是剧本页整稿生成链路的关键收口接口。",
    response_description="定稿、拆分与主体提取结果。",
    responses={
        200: {
            "description": "定稿成功",
            "content": {
                "application/json": {
                    "example": {
                        "replaced_count": 0,
                        "created_count": 3,
                        "script_status": "finalized",
                        "selected_episode_number": 1,
                        "backup_history_id": "8d89e4fb-4b7f-409d-8bb6-c5539fef91d2",
                        "items": [
                            {
                                "episode_number": 1,
                                "title": "第1集 误入侯府",
                                "summary": "女主误入侯府并与男主第一次交锋",
                                "content": "第1集完整正文……",
                            },
                            {
                                "episode_number": 2,
                                "title": "第2集 暗潮涌动",
                                "summary": "误会升级，双方开始试探",
                                "content": "第2集完整正文……",
                            },
                        ],
                        "split_source": "ai",
                        "extracted_episode_count": 3,
                        "subject_created_count": 9,
                        "subject_updated_count": 2,
                        "failed_episode_numbers": [],
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
                        "episode_count": 3,
                        "model": "gpt-4.1",
                        "split_mode": "rule_first",
                        "apply_split": True,
                        "auto_extract_subjects": True,
                    }
                }
            }
        }
    },
)
async def finalize_project_script_endpoint(
    project_id: str,
    req: ProjectScriptFinalizeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    if not req.apply_split:
        await finalize_project_script_workspace(script, db, source_detail="剧本定稿（仅整稿）")
        await db.commit()
        await db.refresh(script)
        return ProjectScriptFinalizeResponse(
            split_applied=False,
            replaced_count=0,
            created_count=0,
            script_status=script.status,
            selected_episode_number=None,
            backup_history_id=None,
            items=[],
            split_source="none",
            extracted_episode_count=0,
            subject_created_count=0,
            subject_updated_count=0,
            failed_episode_numbers=[],
        )

    (
        items,
        replaced_count,
        created_count,
        selected_episode_number,
        backup_history,
        split_source,
        extracted_episode_count,
        subject_created_count,
        subject_updated_count,
        failed_episode_numbers,
    ) = await finalize_project_script_and_extract_subjects(
        project=project,
        project_script=script,
        episode_count=req.episode_count,
        model=req.model,
        split_mode=req.split_mode,
        auto_extract_subjects=req.auto_extract_subjects,
        db=db,
    )
    return ProjectScriptFinalizeResponse(
        split_applied=True,
        replaced_count=replaced_count,
        created_count=created_count,
        script_status=script.status,
        selected_episode_number=selected_episode_number,
        backup_history_id=str(backup_history.id) if backup_history else None,
        items=items,
        split_source=split_source,
        extracted_episode_count=extracted_episode_count,
        subject_created_count=subject_created_count,
        subject_updated_count=subject_updated_count,
        failed_episode_numbers=failed_episode_numbers,
    )


@router.post(
    "/extract-subjects",
    response_model=ProjectScriptExtractSubjectsResponse,
    summary="从主剧本提取全局主体",
    description="从当前主剧本工作区抽取项目级全局主体。与单分集 `subjects/extract?episode_id=` 链路不同，这里偏向整稿层抽取。",
    response_description="新增与更新的主体列表。",
)
async def extract_subjects_from_project_script(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    created, updated = await extract_global_subjects_from_script(project, script, db)
    return ProjectScriptExtractSubjectsResponse(
        created=[await _to_subject_response(subject, db) for subject in created],
        updated=[await _to_subject_response(subject, db) for subject in updated],
    )


@router.get(
    "/history",
    response_model=ProjectScriptHistoryListResponse,
    summary="获取主剧本历史版本列表",
    description="读取当前主剧本工作区的历史版本列表，供前端展示版本记录和回滚入口。",
    response_description="主剧本历史版本列表。",
)
async def get_script_history_list(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    histories = await list_script_histories(script.id, db)
    return ProjectScriptHistoryListResponse(items=[_to_history_response(h) for h in histories])


@router.get(
    "/history/{history_id}",
    response_model=ProjectScriptHistoryResponse,
    summary="获取单条主剧本历史版本",
    description="读取指定历史版本的内容、来源和拆分快照信息。",
    response_description="主剧本历史版本详情。",
)
async def get_script_history_detail(
    project_id: str,
    history_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    history = await get_script_history(history_id, script.id, db)
    if not history:
        raise HTTPException(status_code=404, detail="历史版本不存在")
    return _to_history_response(history)


@router.post(
    "/history/{history_id}/restore",
    response_model=ProjectScriptWorkspaceResponse,
    summary="恢复主剧本历史版本",
    description="将指定历史版本恢复为当前主剧本工作区内容，并返回恢复后的工作区与消息列表。",
    response_description="恢复后的主剧本工作区信息。",
)
async def restore_script_history_endpoint(
    project_id: str,
    history_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    script = await get_or_create_project_script(project_id, db)
    script = await restore_script_history(script, history_id, db)
    messages = await list_project_script_messages(script.id, db)
    return ProjectScriptWorkspaceResponse(
        script=_to_script_response(script),
        messages=[_to_message_response(message) for message in messages],
    )
