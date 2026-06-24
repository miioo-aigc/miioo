from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.voice import Voice

MIIOO_LIBRARY_PROVIDER = "miioo"
AIPING_DEFAULT_COMPAT_VOICE_ID = "male-qn-qingse"
MIIOO_LIBRARY_COMPAT_VOICE_BY_NAME = {
    "不羁青年": "male-qn-qingse",
    "青涩男声": "male-qn-qingse",
    "中文抒情": "Chinese (Mandarin)_Lyrical_Voice",
    "港风乘务": "Chinese (Mandarin)_HK_Flight_Attendant",
}


def coerce_voice_clone_status(raw_status: Any) -> str | None:
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


def build_audio_error_for_clone_status(status: str | None) -> str:
    if status == "processing":
        return "音色复刻中，请稍后再试"
    if status == "failed":
        return "音色复刻失败，请重新上传"
    if status == "expired":
        return "音色已过期，请重新复刻"
    return "当前音色暂不可用于生成"


def resolve_miioo_library_provider_voice_id(voice: Voice | None) -> str | None:
    if not voice:
        return None
    if str(voice.provider or "").strip().lower() != MIIOO_LIBRARY_PROVIDER:
        return None
    exact = MIIOO_LIBRARY_COMPAT_VOICE_BY_NAME.get(str(voice.name or "").strip())
    if exact:
        return exact

    normalized_name = str(voice.name or "").strip()
    if any(keyword in normalized_name for keyword in ("男", "青年", "少年")):
        return "male-qn-qingse"
    if any(keyword in normalized_name for keyword in ("奶奶", "阿姨", "女士", "女", "姐")):
        return "Chinese (Mandarin)_Lyrical_Voice"
    return AIPING_DEFAULT_COMPAT_VOICE_ID


async def resolve_audio_voice_context(
    *,
    db: AsyncSession,
    user: User,
    requested_voice_id: str,
) -> dict[str, Any]:
    safe_voice_id = str(requested_voice_id or "").strip()
    if not safe_voice_id:
        raise HTTPException(status_code=400, detail="缺少音色 ID")

    voice_result = await db.execute(
        select(Voice).where(
            or_(
                Voice.voice_id == safe_voice_id,
                Voice.provider_voice_id == safe_voice_id,
            )
        )
    )
    voice = voice_result.scalars().first()
    clone_status = coerce_voice_clone_status(voice.clone_status) if voice else None
    if voice and voice.is_custom:
        if voice.owner_user_id != user.id:
            raise HTTPException(status_code=404, detail="音色不存在")
        if clone_status != "ready":
            raise HTTPException(status_code=400, detail=build_audio_error_for_clone_status(clone_status))

    fallback_provider_voice_id = resolve_miioo_library_provider_voice_id(voice)
    upstream_voice_id = safe_voice_id
    if voice:
        if voice.is_custom:
            upstream_voice_id = voice.provider_voice_id or voice.voice_id
        elif voice.provider_voice_id:
            upstream_voice_id = voice.provider_voice_id
        elif fallback_provider_voice_id:
            upstream_voice_id = fallback_provider_voice_id
    voice_name = voice.name if voice else safe_voice_id
    return {
        "voice": voice,
        "clone_status": clone_status,
        "upstream_voice_id": upstream_voice_id,
        "voice_name": voice_name,
        "voice_origin": "custom" if voice and voice.is_custom else "official",
    }
