from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user, get_current_user
from app.models.reference_audio_library_item import ReferenceAudioLibraryItem
from app.models.user import User
from app.schemas.reference_audio_library import ReferenceAudioLibraryItemResponse
from app.services.media_storage import delete_managed_upload, persist_uploaded_file

router = APIRouter()

AUDIO_ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}
AUDIO_ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp4",
    "audio/x-m4a",
}
MAX_REFERENCE_AUDIO_SIZE = 30 * 1024 * 1024


def _serialize_item(item: ReferenceAudioLibraryItem) -> ReferenceAudioLibraryItemResponse:
    return ReferenceAudioLibraryItemResponse(
        id=str(item.id),
        name=item.name,
        description=item.description,
        audio_url=item.audio_url,
        preview_url=item.preview_url or item.audio_url,
        gender=item.gender,
        age_group=item.age_group,
        language=item.language,
        emotion=item.emotion,
        tags=list(item.tags_json or []),
        is_enabled=bool(item.is_enabled),
        sort_order=int(item.sort_order or 0),
        created_at=item.created_at.isoformat() if item.created_at else None,
        updated_at=item.updated_at.isoformat() if item.updated_at else None,
    )


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _safe_uuid(value: str, detail: str = "参考音频 ID 非法") -> UUID:
    try:
        return UUID(str(value))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=detail) from exc


def _coerce_optional_int(value: str | int | None, *, default: int = 0) -> int:
    if value in {None, ""}:
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="排序值非法") from exc


def _coerce_optional_bool(value: str | bool | None, *, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    normalized = str(value or "").strip().lower()
    if not normalized:
        return default
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    raise HTTPException(status_code=400, detail="启用状态非法")


def _split_tags(value: str | None) -> list[str]:
    if value is None:
        return []
    parts = [part.strip() for part in str(value).replace("，", ",").split(",")]
    seen: set[str] = set()
    items: list[str] = []
    for part in parts:
        if not part or part in seen:
            continue
        seen.add(part)
        items.append(part)
    return items


@router.get(
    "",
    response_model=list[ReferenceAudioLibraryItemResponse],
    summary="获取参考音频库列表",
    description="读取系统参考音频素材列表。普通用户默认只返回启用项，管理员可通过 `include_disabled=true` 查看已停用素材。",
    response_description="参考音频列表。",
)
async def list_reference_audio_library(
    gender: str | None = None,
    age_group: str | None = None,
    language: str | None = None,
    emotion: str | None = None,
    keyword: str | None = None,
    include_disabled: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(ReferenceAudioLibraryItem)
    if not include_disabled or not current_user.is_admin:
        query = query.where(ReferenceAudioLibraryItem.is_enabled == True)
    if gender:
        query = query.where(ReferenceAudioLibraryItem.gender == gender)
    if age_group:
        query = query.where(ReferenceAudioLibraryItem.age_group == age_group)
    if language:
        query = query.where(ReferenceAudioLibraryItem.language == language)
    if emotion:
        query = query.where(ReferenceAudioLibraryItem.emotion.ilike(f"%{emotion}%"))
    if keyword:
        keyword_value = f"%{keyword.strip()}%"
        query = query.where(
            or_(
                ReferenceAudioLibraryItem.name.ilike(keyword_value),
                ReferenceAudioLibraryItem.description.ilike(keyword_value),
            )
        )
    query = query.order_by(
        ReferenceAudioLibraryItem.sort_order.asc(),
        ReferenceAudioLibraryItem.created_at.asc(),
        ReferenceAudioLibraryItem.id.asc(),
    )
    result = await db.execute(query)
    return [_serialize_item(item) for item in result.scalars().all()]


@router.post(
    "",
    response_model=ReferenceAudioLibraryItemResponse,
    status_code=201,
    summary="新建参考音频",
    description="上传并创建一条系统参考音频素材。当前仅管理员可调用，适合沉淀创作和配音链路中的可复用参考音频。",
    response_description="创建成功后的参考音频对象。",
)
async def create_reference_audio_library_item(
    name: str = Form(..., description="参考音频名称。"),
    description: str | None = Form(None, description="参考音频描述。"),
    gender: str | None = Form(None, description="性别标签。"),
    age_group: str | None = Form(None, description="年龄段标签。"),
    language: str | None = Form(None, description="语言标签。"),
    emotion: str | None = Form(None, description="情绪标签。"),
    tags: str | None = Form(None, description="逗号分隔的标签列表。"),
    sort_order: str | None = Form("0", description="排序值，越小越靠前。"),
    is_enabled: str | None = Form("true", description="是否启用，支持 true/false。"),
    audio_file: UploadFile = File(..., description="音频文件，支持 mp3 / wav / m4a，大小限制 30MB。"),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="参考音频名称不能为空")

    try:
        audio_url = await persist_uploaded_file(
            audio_file,
            "reference-audio-library/system",
            allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
            allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
            max_size=MAX_REFERENCE_AUDIO_SIZE,
            fallback_extension=".mp3",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    item = ReferenceAudioLibraryItem(
        name=cleaned_name[:120],
        description=_clean_optional_text(description),
        audio_url=audio_url,
        preview_url=audio_url,
        gender=_clean_optional_text(gender),
        age_group=_clean_optional_text(age_group),
        language=_clean_optional_text(language),
        emotion=_clean_optional_text(emotion),
        tags_json=_split_tags(tags),
        sort_order=_coerce_optional_int(sort_order, default=0),
        is_enabled=_coerce_optional_bool(is_enabled, default=True),
        created_by=admin_user.id,
        updated_by=admin_user.id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _serialize_item(item)


@router.patch(
    "/{item_id}",
    response_model=ReferenceAudioLibraryItemResponse,
    summary="更新参考音频",
    description="更新参考音频的元数据、启用状态或替换音频文件。若替换音频成功，旧托管文件会被清理。",
    response_description="更新后的参考音频对象。",
)
async def update_reference_audio_library_item(
    item_id: str,
    name: str | None = Form(None, description="参考音频名称。"),
    description: str | None = Form(None, description="参考音频描述。"),
    gender: str | None = Form(None, description="性别标签。"),
    age_group: str | None = Form(None, description="年龄段标签。"),
    language: str | None = Form(None, description="语言标签。"),
    emotion: str | None = Form(None, description="情绪标签。"),
    tags: str | None = Form(None, description="逗号分隔的标签列表。"),
    sort_order: str | None = Form(None, description="排序值。"),
    is_enabled: str | None = Form(None, description="是否启用，支持 true/false。"),
    audio_file: UploadFile | None = File(None, description="可选的新音频文件。"),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ReferenceAudioLibraryItem).where(ReferenceAudioLibraryItem.id == _safe_uuid(item_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="参考音频不存在")

    old_audio_url = item.audio_url
    if name is not None:
        item.name = (_clean_optional_text(name) or "").strip()
        if not item.name:
            raise HTTPException(status_code=400, detail="参考音频名称不能为空")
    if description is not None:
        item.description = _clean_optional_text(description)
    if gender is not None:
        item.gender = _clean_optional_text(gender)
    if age_group is not None:
        item.age_group = _clean_optional_text(age_group)
    if language is not None:
        item.language = _clean_optional_text(language)
    if emotion is not None:
        item.emotion = _clean_optional_text(emotion)
    if tags is not None:
        item.tags_json = _split_tags(tags)
    if sort_order is not None:
        item.sort_order = _coerce_optional_int(sort_order, default=item.sort_order)
    if is_enabled is not None:
        item.is_enabled = _coerce_optional_bool(is_enabled, default=item.is_enabled)
    if audio_file:
        try:
            item.audio_url = await persist_uploaded_file(
                audio_file,
                "reference-audio-library/system",
                allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
                allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
                max_size=MAX_REFERENCE_AUDIO_SIZE,
                fallback_extension=".mp3",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        item.preview_url = item.audio_url
    item.updated_by = admin_user.id
    await db.commit()
    await db.refresh(item)
    if audio_file and old_audio_url and old_audio_url != item.audio_url:
        delete_managed_upload(old_audio_url)
    return _serialize_item(item)


@router.delete(
    "/{item_id}",
    response_model=ReferenceAudioLibraryItemResponse,
    summary="停用参考音频",
    description="将指定参考音频标记为停用。当前行为是软停用：`is_enabled=false`，而不是物理删除记录。",
    response_description="停用后的参考音频对象。",
)
async def delete_reference_audio_library_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(ReferenceAudioLibraryItem).where(ReferenceAudioLibraryItem.id == _safe_uuid(item_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="参考音频不存在")
    item.is_enabled = False
    item.updated_by = admin_user.id
    await db.commit()
    await db.refresh(item)
    return _serialize_item(item)
