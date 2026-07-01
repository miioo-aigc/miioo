from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.live_material_asset import LiveMaterialAsset
from app.models.live_material_group import LiveMaterialGroup
from app.models.user import User
from app.schemas.live_material import (
    LiveMaterialAssetCreateRequest,
    LiveMaterialAssetResponse,
    LiveMaterialAuthSessionCompleteRequest,
    LiveMaterialAuthSessionCompleteResponse,
    LiveMaterialAuthSessionCreateRequest,
    LiveMaterialAuthSessionCreateResponse,
    LiveMaterialGroupResponse,
)
from app.services.media_storage import persist_uploaded_file
from app.services.live_material_runtime import (
    complete_live_material_auth_session,
    create_live_material_asset,
    create_live_material_auth_session,
    refresh_live_material_asset_status,
    serialize_live_material_asset,
    serialize_live_material_group,
)
from app.services.object_storage import object_storage_write_enabled, upload_managed_file_to_object_storage

router = APIRouter()

LIVE_MATERIAL_IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
LIVE_MATERIAL_IMAGE_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
LIVE_MATERIAL_MAX_IMAGE_SIZE = 20 * 1024 * 1024
LIVE_MATERIAL_VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov"}
LIVE_MATERIAL_VIDEO_ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime"}
LIVE_MATERIAL_MAX_VIDEO_SIZE = 50 * 1024 * 1024


async def _get_group_or_404(group_id: str, *, user_id: UUID, db: AsyncSession) -> LiveMaterialGroup:
    try:
        group_uuid = UUID(str(group_id))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="真人素材组 ID 非法") from exc
    result = await db.execute(
        select(LiveMaterialGroup).where(
            LiveMaterialGroup.id == group_uuid,
            LiveMaterialGroup.user_id == user_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="真人素材组不存在")
    return group


async def _get_asset_or_404(asset_id: str, *, user_id: UUID, db: AsyncSession) -> LiveMaterialAsset:
    try:
        asset_uuid = UUID(str(asset_id))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="真人素材 ID 非法") from exc
    result = await db.execute(
        select(LiveMaterialAsset).where(
            LiveMaterialAsset.id == asset_uuid,
            LiveMaterialAsset.user_id == user_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="真人素材不存在")
    return asset


@router.post(
    "/auth-sessions",
    response_model=LiveMaterialAuthSessionCreateResponse,
    summary="创建真人认证会话",
    description="创建 OneLinkAI 真人认证 H5 链接，用于真人素材能力的第一步认证。",
)
async def create_auth_session(
    req: LiveMaterialAuthSessionCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await create_live_material_auth_session(
            user_id=user.id,
            db=db,
            session_id=str(uuid4()),
            source=req.source,
            project_id=req.project_id,
            storyboard_id=req.storyboard_id,
            return_path=req.return_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"创建真人认证会话失败: {str(exc)}") from exc


@router.post(
    "/auth-sessions/{session_id}/complete",
    response_model=LiveMaterialAuthSessionCompleteResponse,
    summary="完成真人认证回调",
    description="接收回跳参数，换取 GroupId 并在系统内持久化真人素材组。",
)
async def complete_auth_session(
    session_id: str,
    req: LiveMaterialAuthSessionCompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id 不能为空")
    try:
        return await complete_live_material_auth_session(
            user_id=user.id,
            db=db,
            result_code=req.result_code,
            byted_token=req.byted_token,
            query_params=req.query_params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"完成真人认证失败: {str(exc)}") from exc


@router.get(
    "/groups",
    response_model=list[LiveMaterialGroupResponse],
    summary="获取真人素材组列表",
    description="返回当前用户已完成认证的真人素材组列表。",
)
async def list_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LiveMaterialGroup, func.count(LiveMaterialAsset.id))
        .outerjoin(LiveMaterialAsset, LiveMaterialAsset.group_id == LiveMaterialGroup.id)
        .where(LiveMaterialGroup.user_id == user.id)
        .group_by(LiveMaterialGroup.id)
        .order_by(LiveMaterialGroup.created_at.desc(), LiveMaterialGroup.id.desc())
    )
    return [
        serialize_live_material_group(group, asset_count=asset_count or 0)
        for group, asset_count in result.all()
    ]


@router.get(
    "/groups/{group_id}/assets",
    response_model=list[LiveMaterialAssetResponse],
    summary="获取真人素材列表",
    description="返回指定真人素材组下的素材列表。",
)
async def list_group_assets(
    group_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_group_or_404(group_id, user_id=user.id, db=db)
    result = await db.execute(
        select(LiveMaterialAsset)
        .where(
            LiveMaterialAsset.user_id == user.id,
            LiveMaterialAsset.group_id == UUID(group_id),
        )
        .order_by(LiveMaterialAsset.created_at.desc(), LiveMaterialAsset.id.desc())
    )
    return [serialize_live_material_asset(item) for item in result.scalars().all()]


@router.post(
    "/groups/{group_id}/assets",
    response_model=LiveMaterialAssetResponse,
    summary="创建真人素材",
    description="把一条公网 URL 上传为真人素材，并返回可轮询的素材记录。",
)
async def create_group_asset(
    group_id: str,
    req: LiveMaterialAssetCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(group_id, user_id=user.id, db=db)
    try:
        asset = await create_live_material_asset(
            user_id=user.id,
            db=db,
            group=group,
            url=req.url,
            asset_type=req.asset_type,
            name=req.name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"创建真人素材失败: {str(exc)}") from exc
    return serialize_live_material_asset(asset)


@router.post(
    "/groups/{group_id}/assets/upload",
    response_model=LiveMaterialAssetResponse,
    summary="上传真人素材文件",
    description="接收图片或视频文件，实时同步到对象存储并直接创建真人素材记录。",
)
async def upload_group_asset(
    group_id: str,
    file: UploadFile = File(..., description="真人素材文件，支持图片或视频。"),
    asset_type: str = Form(..., description="素材类型：image / video。"),
    name: str | None = Form(None, description="素材名称。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(group_id, user_id=user.id, db=db)
    normalized_asset_type = str(asset_type or "").strip().lower()
    if normalized_asset_type == "image":
        allowed_extensions = LIVE_MATERIAL_IMAGE_ALLOWED_EXTENSIONS
        allowed_content_types = LIVE_MATERIAL_IMAGE_ALLOWED_CONTENT_TYPES
        max_size = LIVE_MATERIAL_MAX_IMAGE_SIZE
    elif normalized_asset_type == "video":
        allowed_extensions = LIVE_MATERIAL_VIDEO_ALLOWED_EXTENSIONS
        allowed_content_types = LIVE_MATERIAL_VIDEO_ALLOWED_CONTENT_TYPES
        max_size = LIVE_MATERIAL_MAX_VIDEO_SIZE
    else:
        raise HTTPException(status_code=400, detail="真人素材上传仅支持 image / video")

    if not object_storage_write_enabled():
        raise HTTPException(status_code=500, detail="当前环境未启用对象存储写入，无法完成真人素材实时上传")

    try:
        managed_url = await persist_uploaded_file(
            file,
            f"live-materials/{user.id}/{group.id}",
            allowed_extensions=allowed_extensions,
            allowed_content_types=allowed_content_types,
            max_size=max_size,
            fallback_extension=".png" if normalized_asset_type == "image" else ".mp4",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        uploaded_object = upload_managed_file_to_object_storage(managed_url, kind="raw")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"真人素材文件同步到对象存储失败: {str(exc)}") from exc

    public_url = str(uploaded_object.public_url or "").strip()
    if not public_url:
        raise HTTPException(status_code=500, detail="对象存储未返回可用公网地址，无法创建真人素材")

    extra_metadata = {
        "upload": {
            "uploaded_via": "live_material_upload",
            "original_filename": file.filename or "",
            "managed_url": managed_url,
            "object_storage": {
                "bucket": uploaded_object.bucket,
                "key": uploaded_object.key,
                "public_url": public_url,
            },
        }
    }
    try:
        asset = await create_live_material_asset(
            user_id=user.id,
            db=db,
            group=group,
            url=public_url,
            asset_type=normalized_asset_type,
            name=name,
            extra_metadata=extra_metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"创建真人素材失败: {str(exc)}") from exc
    return serialize_live_material_asset(asset)


@router.get(
    "/assets/{asset_id}",
    response_model=LiveMaterialAssetResponse,
    summary="获取真人素材详情",
    description="返回指定真人素材详情，并刷新一次上游素材状态。",
)
async def get_asset(
    asset_id: str,
    refresh: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = await _get_asset_or_404(asset_id, user_id=user.id, db=db)
    if refresh:
        try:
            asset = await refresh_live_material_asset_status(user_id=user.id, db=db, asset=asset)
        except Exception:
            # 详情页允许在上游刷新失败时回退到本地状态，避免整页不可读
            pass
    return serialize_live_material_asset(asset)
