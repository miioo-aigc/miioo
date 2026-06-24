import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_admin_user, get_current_user
from app.models.user import User
from app.models.voice import Voice
from app.models.voice_favorite import VoiceFavorite
from app.services.media_storage import delete_managed_upload, persist_uploaded_file, resolve_upload_path
from app.services.miioo_voice_library_sync import sync_miioo_voice_library_from_directory
from app.services.minimax_voice_catalog import get_minimax_system_voice_catalog
from app.services.minimax_voice_runtime import (
    clone_minimax_voice,
    extract_minimax_clone_result,
    get_minimax_provider_runtime,
    normalize_minimax_voice_query_result,
    query_minimax_voices,
    upload_minimax_file,
)
from app.services.volcengine_voice_catalog import get_volcengine_system_voice_catalog
from app.utils.security import decode_token

router = APIRouter()

optional_security = HTTPBearer(auto_error=False)
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
MAX_CUSTOM_VOICE_SIZE = 20 * 1024 * 1024
MAX_SYSTEM_VOICE_PREVIEW_SIZE = 20 * 1024 * 1024
OFFICIAL_LANGUAGE_ALIASES = {
    "zh": {"chinese (mandarin)"},
    "en": {"english"},
    "ja": {"japanese"},
    "jp": {"japanese"},
    "yue": {"cantonese"},
    "ko": {"korean"},
    "multi": {"multilingual", "multi"},
}


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Return current user if authenticated, None otherwise."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if not payload or payload.get("type") != "access":
            return None
        user_id = UUID(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        return result.scalar_one_or_none()
    except Exception:
        return None


class VoiceResponse(BaseModel):
    id: str
    voice_id: str
    name: str
    gender: str | None
    age_group: str | None
    language: str | None
    style: str | None
    emotions: str | None
    preview_url: str | None
    provider: str
    is_custom: bool
    is_favorite: bool
    source_label: str | None = None
    supports_favorite: bool = True
    supports_generate: bool = True
    language_boost: str | None = None
    provider_voice_id: str | None = None
    clone_status: str | None = None
    expires_at: str | None = None
    source_audio_url: str | None = None
    is_enabled: bool = True
    sort_order: int = 0


class UpdateCustomVoiceRequest(BaseModel):
    name: str | None = None
    gender: str | None = None
    age_group: str | None = None
    language: str | None = None
    style: str | None = None
    emotions: str | None = None


class AdminVoiceLibraryResponse(VoiceResponse):
    pass


class MiiooVoiceLibrarySyncResponse(BaseModel):
    source_dir: str
    total_files: int
    created_count: int
    updated_count: int
    disabled_count: int
    message: str


def _safe_uuid(value: str, detail: str = "音色 ID 非法") -> UUID:
    try:
        return UUID(str(value))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=detail) from exc


def _coerce_clone_status(raw_status: Any) -> str | None:
    normalized = str(raw_status or "").strip().lower()
    if not normalized:
        return None
    if normalized in {"success", "succeeded", "ready", "available", "completed", "finished"}:
        return "ready"
    if normalized in {"processing", "pending", "running", "cloning", "creating", "queued"}:
        return "processing"
    if normalized in {"failed", "error"}:
        return "failed"
    if normalized in {"expired", "expire"}:
        return "expired"
    return normalized


def _extract_nested_value(data: Any, paths: tuple[str, ...]) -> Any:
    for path in paths:
        current = data
        matched = True
        for segment in path.split("."):
            if isinstance(current, dict) and segment in current:
                current = current[segment]
            else:
                matched = False
                break
        if matched:
            return current
    return None


def _build_custom_voice_source_label(voice: Voice) -> str:
    status = _coerce_clone_status(voice.clone_status)
    if status == "ready":
        return "可生成"
    if status == "processing":
        return "复刻中"
    if status == "failed":
        return "复刻失败"
    if status == "expired":
        return "已过期"
    return "已保存"


def _build_provider_voice_id(user: User) -> str:
    return f"miioo_{str(user.id).split('-')[0]}_{uuid.uuid4().hex[:16]}"


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


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


def serialize_voice(voice: Voice, favorite_voice_ids: set[UUID] | None = None) -> VoiceResponse:
    favorite_ids = favorite_voice_ids or set()
    clone_status = _coerce_clone_status(voice.clone_status)
    source_label = _build_custom_voice_source_label(voice) if voice.is_custom else None
    preview_url = voice.preview_url or (voice.source_audio_url if voice.is_custom else None)
    return VoiceResponse(
        id=str(voice.id),
        voice_id=voice.voice_id,
        name=voice.name,
        gender=voice.gender,
        age_group=voice.age_group,
        language=voice.language,
        style=voice.style,
        emotions=voice.emotions,
        preview_url=preview_url,
        provider=voice.provider,
        is_custom=voice.is_custom,
        is_favorite=voice.id in favorite_ids,
        source_label=source_label,
        supports_favorite=True,
        supports_generate=(not voice.is_custom) or clone_status == "ready",
        language_boost=None,
        provider_voice_id=voice.provider_voice_id,
        clone_status=clone_status,
        expires_at=voice.expires_at.astimezone(timezone.utc).isoformat() if voice.expires_at else None,
        source_audio_url=voice.source_audio_url,
        is_enabled=bool(getattr(voice, "is_enabled", True)),
        sort_order=int(getattr(voice, "sort_order", 0) or 0),
    )


def ensure_custom_voice_owner(voice: Voice, current_user: User) -> None:
    if not voice.is_custom:
        raise HTTPException(status_code=400, detail="该音色不是自定义音色")
    if voice.owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="自定义音色不存在")


@router.get(
    "",
    summary="获取音色列表",
    description="按 tab 返回音色列表。支持全部、收藏、自定义三种视角，并可按性别、年龄、语言和情绪类型过滤。",
    response_description="音色列表。",
)
async def list_voices(
    tab: str = "all",
    gender: str | None = None,
    age_group: str | None = None,
    language: str | None = None,
    emotion_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    query = select(Voice)

    # Tab filtering
    if tab == "favorite":
        if not current_user:
            return []
        fav_subq = select(VoiceFavorite.voice_id).where(VoiceFavorite.user_id == current_user.id)
        query = query.where(Voice.id.in_(fav_subq))
    elif tab == "custom":
        if not current_user:
            return []
        query = query.where(Voice.is_custom == True, Voice.owner_user_id == current_user.id)

    if tab == "favorite":
        query = query.where(or_(Voice.is_custom == False, Voice.owner_user_id == current_user.id))
    elif tab != "custom":
        query = query.where(Voice.is_custom == False, Voice.is_enabled == True)

    # Filters
    if gender:
        query = query.where(Voice.gender == gender)
    if age_group:
        query = query.where(Voice.age_group == age_group)
    if language:
        query = query.where(Voice.language == language)
    if emotion_type == "multi":
        # Voices with multiple emotions (contains comma)
        query = query.where(Voice.emotions.ilike("%,%"))
    elif emotion_type == "single":
        # Voices with single or no emotion (no comma)
        query = query.where(
            (Voice.emotions == None) | (~Voice.emotions.ilike("%,%"))
        )

    query = query.order_by(Voice.sort_order.asc(), Voice.name.asc(), Voice.id.asc())
    result = await db.execute(query)
    voices = result.scalars().all()

    # Get favorites for current user
    favorite_voice_ids: set[UUID] = set()
    if current_user:
        fav_result = await db.execute(
            select(VoiceFavorite.voice_id).where(VoiceFavorite.user_id == current_user.id)
        )
        favorite_voice_ids = {row[0] for row in fav_result.all()}

    return [serialize_voice(v, favorite_voice_ids) for v in voices]


@router.get(
    "/library",
    response_model=list[AdminVoiceLibraryResponse],
    summary="获取系统音色库",
    description="读取后台系统音色库。普通用户默认只看到启用项，管理员可通过 `include_disabled=true` 查看停用项。",
    response_description="系统音色库列表。",
)
async def list_voice_library(
    provider: str | None = None,
    gender: str | None = None,
    age_group: str | None = None,
    language: str | None = None,
    emotion: str | None = None,
    keyword: str | None = None,
    include_disabled: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Voice).where(Voice.is_custom == False)
    if provider:
        query = query.where(Voice.provider == provider)
    if not include_disabled or not current_user.is_admin:
        query = query.where(Voice.is_enabled == True)
    if gender:
        query = query.where(Voice.gender == gender)
    if age_group:
        query = query.where(Voice.age_group == age_group)
    if language:
        query = query.where(Voice.language == language)
    if emotion:
        query = query.where(Voice.emotions.ilike(f"%{emotion}%"))
    if keyword:
        keyword_value = f"%{keyword.strip()}%"
        query = query.where(or_(Voice.name.ilike(keyword_value), Voice.style.ilike(keyword_value), Voice.emotions.ilike(keyword_value)))
    query = query.order_by(Voice.sort_order.asc(), Voice.name.asc(), Voice.id.asc())
    result = await db.execute(query)
    voices = result.scalars().all()
    favorite_voice_ids: set[UUID] = set()
    if current_user:
        fav_result = await db.execute(
            select(VoiceFavorite.voice_id).where(VoiceFavorite.user_id == current_user.id)
        )
        favorite_voice_ids = {row[0] for row in fav_result.all()}
    return [serialize_voice(voice, favorite_voice_ids) for voice in voices]


@router.post(
    "/library",
    response_model=AdminVoiceLibraryResponse,
    status_code=201,
    summary="新建系统音色",
    description="在系统音色库中新增一条系统音色。仅管理员可调用，可上传预览音频。",
    response_description="创建成功后的系统音色。",
)
async def create_voice_library_item(
    name: str = Form(..., description="音色名称。"),
    gender: str | None = Form(None),
    age_group: str | None = Form(None),
    language: str | None = Form(None),
    emotions: str | None = Form(None),
    style: str | None = Form(None),
    provider: str | None = Form(None),
    voice_id: str | None = Form(None),
    sort_order: str | None = Form("0"),
    is_enabled: str | None = Form("true"),
    preview_file: UploadFile | None = File(None, description="可选预览音频文件。"),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="音色名称不能为空")

    normalized_voice_id = _clean_optional_text(voice_id) or f"system_voice_{uuid.uuid4().hex[:12]}"
    existing = await db.execute(select(Voice).where(Voice.voice_id == normalized_voice_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="音色标识已存在")

    preview_url: str | None = None
    if preview_file:
        try:
            preview_url = await persist_uploaded_file(
                preview_file,
                "voice-library/system",
                allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
                allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
                max_size=MAX_SYSTEM_VOICE_PREVIEW_SIZE,
                fallback_extension=".mp3",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    now = datetime.utcnow()
    voice = Voice(
        voice_id=normalized_voice_id,
        name=cleaned_name[:100],
        gender=_clean_optional_text(gender),
        age_group=_clean_optional_text(age_group),
        language=_clean_optional_text(language),
        style=_clean_optional_text(style),
        emotions=_clean_optional_text(emotions),
        preview_url=preview_url,
        provider=_clean_optional_text(provider) or "miioo",
        is_custom=False,
        is_enabled=_coerce_optional_bool(is_enabled, default=True),
        sort_order=_coerce_optional_int(sort_order, default=0),
        created_by=admin_user.id,
        updated_by=admin_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return serialize_voice(voice)


@router.patch(
    "/library/{voice_id}",
    response_model=AdminVoiceLibraryResponse,
    summary="更新系统音色",
    description="更新系统音色库中的元数据、排序、启用状态或预览文件。仅管理员可调用。",
    response_description="更新后的系统音色。",
)
async def update_voice_library_item(
    voice_id: str,
    name: str | None = Form(None),
    gender: str | None = Form(None),
    age_group: str | None = Form(None),
    language: str | None = Form(None),
    emotions: str | None = Form(None),
    style: str | None = Form(None),
    provider: str | None = Form(None),
    sort_order: str | None = Form(None),
    is_enabled: str | None = Form(None),
    preview_file: UploadFile | None = File(None, description="可选新的预览音频文件。"),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    voice_result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = voice_result.scalar_one_or_none()
    if not voice or voice.is_custom:
        raise HTTPException(status_code=404, detail="系统音色不存在")

    old_preview_url = voice.preview_url
    if name is not None:
        voice.name = (_clean_optional_text(name) or "").strip()
        if not voice.name:
            raise HTTPException(status_code=400, detail="音色名称不能为空")
    if gender is not None:
        voice.gender = _clean_optional_text(gender)
    if age_group is not None:
        voice.age_group = _clean_optional_text(age_group)
    if language is not None:
        voice.language = _clean_optional_text(language)
    if emotions is not None:
        voice.emotions = _clean_optional_text(emotions)
    if style is not None:
        voice.style = _clean_optional_text(style)
    if provider is not None:
        voice.provider = _clean_optional_text(provider) or "miioo"
    if sort_order is not None:
        voice.sort_order = _coerce_optional_int(sort_order, default=voice.sort_order)
    if is_enabled is not None:
        voice.is_enabled = _coerce_optional_bool(is_enabled, default=voice.is_enabled)

    if preview_file:
        try:
            voice.preview_url = await persist_uploaded_file(
                preview_file,
                "voice-library/system",
                allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
                allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
                max_size=MAX_SYSTEM_VOICE_PREVIEW_SIZE,
                fallback_extension=".mp3",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    voice.updated_by = admin_user.id
    await db.commit()
    await db.refresh(voice)
    if preview_file and old_preview_url and old_preview_url != voice.preview_url:
        delete_managed_upload(old_preview_url)
    return serialize_voice(voice)


@router.delete(
    "/library/{voice_id}",
    response_model=AdminVoiceLibraryResponse,
    summary="停用系统音色",
    description="将指定系统音色标记为停用。当前行为是软停用，不会物理删除记录。",
    response_description="停用后的系统音色。",
)
async def delete_voice_library_item(
    voice_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    voice_result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = voice_result.scalar_one_or_none()
    if not voice or voice.is_custom:
        raise HTTPException(status_code=404, detail="系统音色不存在")
    voice.is_enabled = False
    voice.updated_by = admin_user.id
    await db.commit()
    await db.refresh(voice)
    return serialize_voice(voice)


@router.post(
    "/library/sync-local",
    response_model=MiiooVoiceLibrarySyncResponse,
    summary="同步本地 miioo 音色库",
    description="将后端本地 `语音库文件` 目录中的音频批量同步到 miioo 系统音色库。仅管理员可调用。",
    response_description="本次同步结果摘要。",
)
async def sync_local_miioo_voice_library(
    disable_missing: bool = False,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    try:
        result = await sync_miioo_voice_library_from_directory(
            db,
            admin_user_id=admin_user.id,
            disable_missing=disable_missing,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    total_changed = result["created_count"] + result["updated_count"] + result["disabled_count"]
    message = (
        f"miioo 音色库同步完成：新增 {result['created_count']} 条，"
        f"更新 {result['updated_count']} 条，停用 {result['disabled_count']} 条。"
        if total_changed
        else "miioo 音色库已是最新，无需同步。"
    )
    return MiiooVoiceLibrarySyncResponse(**result, message=message)


@router.get(
    "/official",
    response_model=list[VoiceResponse],
    summary="获取官方音色目录",
    description="获取第三方 provider 的官方音色目录，当前支持 `volcengine` 和 `minimax`。未传 provider 时默认回退到 MiniMax 系统目录。",
    response_description="官方音色目录列表。",
)
async def list_official_voices(
    language: str | None = None,
    provider: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    normalized_provider = (provider or "").strip().lower()
    if normalized_provider == "volcengine":
        voices = await get_volcengine_system_voice_catalog()
    else:
        voices = []
        if normalized_provider == "minimax" and current_user:
            try:
                runtime = await get_minimax_provider_runtime(current_user.id, db)
                if runtime:
                    payload = await query_minimax_voices(runtime, voice_type="all")
                    normalized_voices = normalize_minimax_voice_query_result(payload)
                    voices = [
                        {
                            "id": "",
                            "voice_id": item["voice_id"],
                            "name": item["name"],
                            "gender": None,
                            "age_group": None,
                            "language": None,
                            "style": "官方系统音色" if item["voice_type"] == "system" else "官方私有音色",
                            "emotions": None,
                            "preview_url": None,
                            "provider": "minimax",
                            "is_custom": bool(item["is_custom"]),
                            "is_favorite": False,
                            "source_label": item.get("source_label"),
                            "supports_favorite": False,
                            "supports_generate": True,
                            "language_boost": None,
                            "provider_voice_id": item["voice_id"],
                            "clone_status": "ready" if item["is_custom"] else None,
                            "expires_at": None,
                            "source_audio_url": None,
                        }
                        for item in normalized_voices
                    ]
            except Exception:
                voices = []
        if not voices:
            voices = await get_minimax_system_voice_catalog()
    if language:
        normalized_language = language.strip().lower()
        target_languages = OFFICIAL_LANGUAGE_ALIASES.get(normalized_language, {normalized_language})
        voices = [
            voice for voice in voices
            if str(voice.get("language") or "").strip().lower() in target_languages
        ]
    return voices


@router.post(
    "/custom",
    response_model=VoiceResponse,
    status_code=201,
    summary="创建自定义音色",
    description="上传音频样本并调用 MiniMax 进行音色复刻，创建用户自定义音色。",
    response_description="创建后的自定义音色。",
)
async def create_custom_voice(
    name: str = Form(..., description="自定义音色名称。"),
    file: UploadFile = File(..., description="用于复刻的音频样本文件。"),
    gender: str | None = Form(None),
    age_group: str | None = Form(None),
    language: str | None = Form(None),
    style: str | None = Form(None),
    emotions: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="音色名称不能为空")

    try:
        runtime = await get_minimax_provider_runtime(current_user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not runtime:
        raise HTTPException(status_code=400, detail="请先在 API 配置中保存并启用 MiniMax 官方 Provider")

    try:
        source_audio_url = await persist_uploaded_file(
            file,
            f"voices/{current_user.id}",
            allowed_extensions=AUDIO_ALLOWED_EXTENSIONS,
            allowed_content_types=AUDIO_ALLOWED_CONTENT_TYPES,
            max_size=MAX_CUSTOM_VOICE_SIZE,
            fallback_extension=".mp3",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    source_audio_path = resolve_upload_path(source_audio_url)
    source_audio_bytes = source_audio_path.read_bytes()
    target_voice_id = _build_provider_voice_id(current_user)

    try:
        upload_result = await upload_minimax_file(
            runtime,
            file_name=file.filename or Path(source_audio_path).name,
            file_bytes=source_audio_bytes,
            purpose="voice_clone",
            content_type=(file.content_type or "").split(";", 1)[0].strip().lower() or "audio/mpeg",
        )
        provider_file_id = _extract_nested_value(upload_result, ("file.file_id", "file_id", "data.file_id"))
        if not provider_file_id:
            raise ValueError("MiniMax 未返回 file_id")

        clone_result = await clone_minimax_voice(
            runtime,
            source_file_id=str(provider_file_id),
            target_voice_id=target_voice_id,
        )
        detail_result: dict[str, Any] | None = None
        detail_error: str | None = None
        try:
            detail_query_payload = await query_minimax_voices(runtime, voice_type="all")
            normalized_voices = normalize_minimax_voice_query_result(detail_query_payload)
            matched_voice = next(
                (
                    item for item in normalized_voices
                    if str(item.get("voice_id") or "").strip() == target_voice_id
                ),
                None,
            )
            detail_result = {"voice": matched_voice, "raw_payload": detail_query_payload} if matched_voice else None
        except Exception as exc:
            detail_error = str(exc)

        final_payload = detail_result or clone_result
        clone_info = extract_minimax_clone_result(final_payload, target_voice_id)
        clone_status = _coerce_clone_status(
            _extract_nested_value(
                final_payload,
                (
                    "status",
                    "data.status",
                    "voice.status",
                ),
            )
        ) or "processing"
        preview_url = (
            clone_info.get("preview_url")
            or _extract_nested_value(final_payload, ("voice.preview_audio_url", "data.preview_audio_url"))
            or source_audio_url
        )
        provider_task_id = _extract_nested_value(
            clone_result,
            (
                "task_id",
                "data.task_id",
                "voice.task_id",
            ),
        )
    except HTTPException:
        delete_managed_upload(source_audio_url)
        raise
    except Exception as exc:
        delete_managed_upload(source_audio_url)
        raise HTTPException(status_code=502, detail=f"MiniMax 音色复刻失败: {str(exc)}") from exc

    now = datetime.utcnow()
    voice = Voice(
        voice_id=clone_info["voice_id"],
        name=cleaned_name[:100],
        gender=(gender or "").strip() or None,
        age_group=(age_group or "").strip() or None,
        language=(language or "").strip() or None,
        style=(style or "").strip() or None,
        emotions=(emotions or "").strip() or None,
        preview_url=preview_url,
        provider="minimax",
        is_custom=True,
        provider_voice_id=clone_info["voice_id"],
        clone_status=clone_status,
        source_audio_url=source_audio_url,
        provider_file_id=str(provider_file_id),
        provider_task_id=str(provider_task_id) if provider_task_id else None,
        expires_at=clone_info.get("expires_at"),
        metadata_json={
            "source_audio_filename": file.filename,
            "upload_result": upload_result,
            "clone_result": clone_result,
            "voice_detail": detail_result,
            "voice_detail_error": detail_error,
        },
        owner_user_id=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return serialize_voice(voice)


@router.patch(
    "/{voice_id}",
    response_model=VoiceResponse,
    summary="更新自定义音色",
    description="更新自定义音色名称、语言、年龄、风格和情绪等元数据。",
    response_description="更新后的自定义音色。",
)
async def update_custom_voice(
    voice_id: str,
    req: UpdateCustomVoiceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    voice_result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = voice_result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="音色不存在")
    ensure_custom_voice_owner(voice, current_user)

    updates = {
        "name": req.name,
        "gender": req.gender,
        "age_group": req.age_group,
        "language": req.language,
        "style": req.style,
        "emotions": req.emotions,
    }
    for field, value in updates.items():
        if value is None:
            continue
        cleaned = value.strip()
        setattr(voice, field, cleaned or None)

    if not (voice.name or "").strip():
        raise HTTPException(status_code=400, detail="音色名称不能为空")

    await db.commit()
    await db.refresh(voice)

    fav_result = await db.execute(
        select(VoiceFavorite.voice_id).where(
            VoiceFavorite.user_id == current_user.id,
            VoiceFavorite.voice_id == voice.id,
        )
    )
    favorite_ids = {row[0] for row in fav_result.all()}
    return serialize_voice(voice, favorite_ids)


@router.delete(
    "/{voice_id}",
    summary="删除自定义音色",
    description="删除当前用户拥有的自定义音色，并清理其上传音频。",
    response_description="删除结果。",
)
async def delete_custom_voice(
    voice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    voice_result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = voice_result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="音色不存在")
    ensure_custom_voice_owner(voice, current_user)

    preview_url = voice.preview_url
    source_audio_url = voice.source_audio_url
    await db.execute(delete(VoiceFavorite).where(VoiceFavorite.voice_id == voice.id))
    await db.delete(voice)
    await db.commit()

    delete_managed_upload(preview_url)
    if source_audio_url != preview_url:
        delete_managed_upload(source_audio_url)
    return {"success": True, "message": "删除成功"}


@router.post(
    "/{voice_id}/favorite",
    summary="收藏音色",
    description="将指定音色加入当前用户收藏列表。",
    response_description="收藏结果。",
)
async def add_voice_favorite(
    voice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify voice exists
    result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="音色不存在")
    if voice.is_custom and voice.owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="音色不存在")

    # Check if already favorited
    existing = await db.execute(
        select(VoiceFavorite).where(
            VoiceFavorite.user_id == current_user.id,
            VoiceFavorite.voice_id == _safe_uuid(voice_id),
        )
    )
    if existing.scalar_one_or_none():
        return {"success": True, "message": "已收藏"}

    fav = VoiceFavorite(user_id=current_user.id, voice_id=_safe_uuid(voice_id))
    db.add(fav)
    await db.commit()
    return {"success": True, "message": "收藏成功"}


@router.delete(
    "/{voice_id}/favorite",
    summary="取消收藏音色",
    description="将指定音色从当前用户收藏列表移除。",
    response_description="取消收藏结果。",
)
async def remove_voice_favorite(
    voice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    voice_result = await db.execute(select(Voice).where(Voice.id == _safe_uuid(voice_id)))
    voice = voice_result.scalar_one_or_none()
    if voice and voice.is_custom and voice.owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="音色不存在")

    result = await db.execute(
        select(VoiceFavorite).where(
            VoiceFavorite.user_id == current_user.id,
            VoiceFavorite.voice_id == _safe_uuid(voice_id),
        )
    )
    fav = result.scalar_one_or_none()
    if not fav:
        raise HTTPException(status_code=404, detail="未收藏该音色")

    await db.delete(fav)
    await db.commit()
    return {"success": True, "message": "已取消收藏"}
