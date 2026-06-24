from uuid import UUID
import json
import urllib.request

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.models.user import User
from app.models.voice import Voice
from app.schemas.tts import TTSAdvancedOptionsMixin, build_tts_provider_options
from app.services.audio_voice_context import resolve_audio_voice_context
from app.services.media_storage import get_media_fallback_extension, persist_if_external
from app.services.tts import tts_service
from app.services.user_api_key import get_user_model_provider_credentials


class ProjectAudioRequestOptions(TTSAdvancedOptionsMixin):
    pass


def serialize_project_audio_clip(clip: AudioClip) -> dict:
    return {
        "id": str(clip.id),
        "project_id": str(clip.project_id) if clip.project_id else None,
        "storyboard_id": str(clip.storyboard_id) if clip.storyboard_id else None,
        "text": clip.text,
        "voice_id": clip.voice_id,
        "audio_url": clip.audio_url,
        "duration": clip.duration,
        "speed": clip.speed,
        "emotion": clip.emotion,
        "source": clip.source,
        "created_at": clip.created_at.isoformat(),
    }


def _normalize_speed(value: object, fallback: float = 1.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if numeric <= 0:
        return fallback
    return numeric


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _get_storyboard_gen_params(storyboard: Storyboard) -> dict:
    return storyboard.gen_params if isinstance(storyboard.gen_params, dict) else {}


def build_storyboard_narration_jobs(
    storyboard: Storyboard,
    *,
    subject_map: dict[str, Subject],
    target_subject_id: str | None = None,
) -> list[dict]:
    normalized_target_subject_id = _clean_text(target_subject_id)
    gen_params = _get_storyboard_gen_params(storyboard)
    global_voice_params = (
        gen_params.get("global_voice_params")
        if isinstance(gen_params.get("global_voice_params"), dict)
        else {}
    )
    raw_segments = (
        gen_params.get("narration_segments")
        if isinstance(gen_params.get("narration_segments"), list)
        else []
    )
    character_subjects = [
        subject_map[str(subject_id)]
        for subject_id in (storyboard.character_ids or [])
        if subject_id and str(subject_id) in subject_map and subject_map[str(subject_id)].type == "character"
    ]
    voice_ready_subjects = [
        subject for subject in character_subjects if subject.voice_id
    ]
    role_subject_map: dict[str, Subject] = {}
    for subject in character_subjects:
        for candidate in (subject.name, subject.role):
            key = _clean_text(candidate)
            if key and key not in role_subject_map:
                role_subject_map[key] = subject

    normalized_segments = [
        segment
        for segment in raw_segments
        if isinstance(segment, dict) and _clean_text(segment.get("value"))
    ]
    has_structured_segments = any(
        any(
            segment.get(field) is not None
            for field in ("role", "speed", "volume", "usesGlobal", "_usesGlobal")
        )
        for segment in normalized_segments
    )

    jobs: list[dict] = []
    if has_structured_segments:
        for segment in normalized_segments:
            text = _clean_text(segment.get("value"))
            role = _clean_text(segment.get("role"))
            matched_subject = role_subject_map.get(role)
            if matched_subject is None and len(voice_ready_subjects) == 1:
                matched_subject = voice_ready_subjects[0]
            if matched_subject is None and not role and len(character_subjects) == 1:
                matched_subject = character_subjects[0]
            if not matched_subject or not matched_subject.voice_id:
                continue
            if normalized_target_subject_id and str(matched_subject.id) != normalized_target_subject_id:
                continue

            global_for_role = (
                global_voice_params.get(role)
                if role and isinstance(global_voice_params.get(role), dict)
                else {}
            )
            jobs.append(
                {
                    "text": text,
                    "role": role or matched_subject.name,
                    "subject_id": str(matched_subject.id),
                    "subject_name": matched_subject.name,
                    "voice_id": matched_subject.voice_id,
                    "speed": _normalize_speed(
                        segment.get("speed", global_for_role.get("speed")),
                        1.0,
                    ),
                }
            )
        return jobs

    fallback_text = "".join(
        _clean_text(segment.get("value"))
        for segment in normalized_segments
    ) or _clean_text(storyboard.voiceover)
    if not fallback_text or len(character_subjects) != 1:
        return []

    matched_subject = character_subjects[0]
    if not matched_subject.voice_id:
        return []
    if normalized_target_subject_id and str(matched_subject.id) != normalized_target_subject_id:
        return []

    return [
        {
            "text": fallback_text,
            "role": matched_subject.name,
            "subject_id": str(matched_subject.id),
            "subject_name": matched_subject.name,
            "voice_id": matched_subject.voice_id,
            "speed": 1.0,
        }
    ]


async def resolve_storyboard_seedance_voice_video_inputs(
    *,
    db: AsyncSession,
    storyboard: Storyboard,
    subject_map: dict[str, Subject],
) -> dict:
    gen_params = _get_storyboard_gen_params(storyboard)
    raw_segments = (
        gen_params.get("narration_segments")
        if isinstance(gen_params.get("narration_segments"), list)
        else []
    )
    normalized_segments = [
        segment
        for segment in raw_segments
        if isinstance(segment, dict) and _clean_text(segment.get("value"))
    ]
    structured_segment_count = len(normalized_segments)
    speech_segments = [_clean_text(segment.get("value")) for segment in normalized_segments]
    speech_segments = [segment for segment in speech_segments if segment]

    speech_text = "\n".join(speech_segments)
    speech_text_source = "narration_segments" if speech_text else None
    if not speech_text:
        fallback_voiceover = _clean_text(storyboard.voiceover)
        if fallback_voiceover:
            speech_text = fallback_voiceover
            speech_text_source = "voiceover"

    narration_jobs = build_storyboard_narration_jobs(
        storyboard,
        subject_map=subject_map,
    )
    unique_requested_voice_ids = []
    seen_requested_voice_ids: set[str] = set()
    for job in narration_jobs:
        requested_voice_id = _clean_text(job.get("voice_id"))
        if not requested_voice_id or requested_voice_id in seen_requested_voice_ids:
            continue
        seen_requested_voice_ids.add(requested_voice_id)
        unique_requested_voice_ids.append(requested_voice_id)

    voice_map: dict[str, Voice] = {}
    if unique_requested_voice_ids:
        voice_result = await db.execute(
            select(Voice).where(Voice.voice_id.in_(unique_requested_voice_ids))
        )
        voice_map = {
            voice.voice_id: voice
            for voice in voice_result.scalars().all()
            if voice and voice.voice_id
        }

    candidates: list[dict] = []
    seen_candidate_urls: set[str] = set()
    for job in narration_jobs:
        requested_voice_id = _clean_text(job.get("voice_id"))
        if not requested_voice_id:
            continue
        voice = voice_map.get(requested_voice_id)
        if not voice:
            continue
        source_audio_url = _clean_text(voice.source_audio_url)
        preview_audio_url = _clean_text(voice.preview_url)
        candidate_url = source_audio_url or preview_audio_url
        if not candidate_url or candidate_url in seen_candidate_urls:
            continue
        seen_candidate_urls.add(candidate_url)
        candidates.append(
            {
                "reference_audio_url": candidate_url,
                "reference_audio_source": (
                    "voice.source_audio_url"
                    if source_audio_url
                    else "voice.preview_url"
                ),
                "requested_voice_id": requested_voice_id,
                "provider_voice_id": _clean_text(voice.provider_voice_id) or None,
                "voice_name": _clean_text(voice.name) or requested_voice_id,
                "subject_id": _clean_text(job.get("subject_id")) or None,
                "subject_name": _clean_text(job.get("subject_name")) or None,
                "role": _clean_text(job.get("role")) or None,
            }
        )

    selected_candidate = candidates[0] if len(candidates) == 1 else None
    resolution_reason = None
    if len(candidates) > 1:
        resolution_reason = "multiple_voice_sources"
    elif narration_jobs and not candidates:
        resolution_reason = "voice_source_unavailable"

    return {
        "speech_text": speech_text or None,
        "speech_text_source": speech_text_source,
        "structured_segment_count": structured_segment_count,
        "narration_job_count": len(narration_jobs),
        "reference_audio_candidates": [
            {
                "requested_voice_id": candidate.get("requested_voice_id"),
                "voice_name": candidate.get("voice_name"),
                "subject_id": candidate.get("subject_id"),
                "subject_name": candidate.get("subject_name"),
                "role": candidate.get("role"),
                "reference_audio_source": candidate.get("reference_audio_source"),
            }
            for candidate in candidates
        ],
        "reference_audio_resolution": resolution_reason or (
            "resolved" if selected_candidate else "not_applicable"
        ),
        "reference_audio_url": (
            selected_candidate.get("reference_audio_url")
            if selected_candidate
            else None
        ),
        "reference_audio_source": (
            selected_candidate.get("reference_audio_source")
            if selected_candidate
            else None
        ),
        "requested_voice_id": (
            selected_candidate.get("requested_voice_id")
            if selected_candidate
            else None
        ),
        "provider_voice_id": (
            selected_candidate.get("provider_voice_id")
            if selected_candidate
            else None
        ),
        "voice_name": (
            selected_candidate.get("voice_name")
            if selected_candidate
            else None
        ),
        "subject_id": (
            selected_candidate.get("subject_id")
            if selected_candidate
            else None
        ),
        "subject_name": (
            selected_candidate.get("subject_name")
            if selected_candidate
            else None
        ),
    }


async def generate_project_audio_clip(
    *,
    db: AsyncSession,
    user: User,
    project_id: UUID,
    text: str,
    requested_voice_id: str,
    storyboard_id: UUID | None = None,
    speed: float = 1.0,
    emotion: str | None = None,
    model: str | None = None,
    request_options: TTSAdvancedOptionsMixin | None = None,
    provider_runtime: tuple[str, str, str, str] | None = None,
    source: str = "audio_clip",
    extra_metadata: dict | None = None,
) -> dict:
    # #region debug-point E:project-audio-enter
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "project_audio.py:generate_project_audio_clip:enter",
                        "msg": "[DEBUG] project audio generation entered",
                        "data": {
                            "project_id": str(project_id),
                            "storyboard_id": str(storyboard_id) if storyboard_id else None,
                            "requested_voice_id": requested_voice_id,
                            "source": source,
                            "text_length": len(text or ""),
                            "model": model,
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion
    if not provider_runtime:
        provider_runtime = await get_user_model_provider_credentials(
            user.id,
            db,
            category="voice",
            requested_model=model,
        )
    if not provider_runtime:
        detail = "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"
        if model:
            detail = f"未找到可用的配音模型 {model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)

    api_key, base_url, provider_type, model_id = provider_runtime
    # #region debug-point E:project-audio-provider
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "project_audio.py:generate_project_audio_clip:provider",
                        "msg": "[DEBUG] project audio provider resolved",
                        "data": {
                            "project_id": str(project_id),
                            "provider_type": provider_type,
                            "model_id": model_id,
                            "has_api_key": bool(api_key),
                            "base_url": base_url,
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion
    voice_context = await resolve_audio_voice_context(
        db=db,
        user=user,
        requested_voice_id=requested_voice_id,
    )
    # #region debug-point E:project-audio-voice
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://127.0.0.1:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "narration-audio-button",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "project_audio.py:generate_project_audio_clip:voice",
                        "msg": "[DEBUG] project audio voice context resolved",
                        "data": {
                            "project_id": str(project_id),
                            "requested_voice_id": requested_voice_id,
                            "upstream_voice_id": voice_context.get("upstream_voice_id"),
                            "voice_name": voice_context.get("voice_name"),
                            "voice_origin": voice_context.get("voice_origin"),
                            "clone_status": voice_context.get("clone_status"),
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        ).read()
    except Exception:
        pass
    # #endregion

    options_model = request_options or ProjectAudioRequestOptions()
    provider_options = build_tts_provider_options(
        options_model,
        default_voice_id=voice_context["upstream_voice_id"],
        default_speed=speed,
        default_emotion=emotion,
    )

    try:
        # #region debug-point E:project-audio-tts-start
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    "http://127.0.0.1:7777/event",
                    data=json.dumps(
                        {
                            "sessionId": "narration-audio-button",
                            "runId": "pre-fix",
                            "hypothesisId": "E",
                            "location": "project_audio.py:generate_project_audio_clip:tts_start",
                            "msg": "[DEBUG] project audio tts start",
                            "data": {
                                "project_id": str(project_id),
                                "provider_type": provider_type,
                                "model_id": model_id,
                                "voice": voice_context.get("upstream_voice_id"),
                                "speed": speed,
                            },
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                )
            ).read()
        except Exception:
            pass
        # #endregion
        tts_result = await tts_service.generate(
            text=text,
            api_key=api_key,
            base_url=base_url,
            voice=voice_context["upstream_voice_id"],
            speed=speed,
            model=model_id,
            provider_type=provider_type,
            provider_options=provider_options,
        )
        # #region debug-point E:project-audio-tts-success
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    "http://127.0.0.1:7777/event",
                    data=json.dumps(
                        {
                            "sessionId": "narration-audio-button",
                            "runId": "pre-fix",
                            "hypothesisId": "E",
                            "location": "project_audio.py:generate_project_audio_clip:tts_success",
                            "msg": "[DEBUG] project audio tts success",
                            "data": {
                                "project_id": str(project_id),
                                "duration": tts_result.get("duration"),
                                "has_url": bool(tts_result.get("url")),
                            },
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                )
            ).read()
        except Exception:
            pass
        # #endregion
    except Exception as exc:
        # #region debug-point E:project-audio-tts-error
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    "http://127.0.0.1:7777/event",
                    data=json.dumps(
                        {
                            "sessionId": "narration-audio-button",
                            "runId": "pre-fix",
                            "hypothesisId": "E",
                            "location": "project_audio.py:generate_project_audio_clip:tts_error",
                            "msg": "[DEBUG] project audio tts error",
                            "data": {
                                "project_id": str(project_id),
                                "error": str(exc),
                            },
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                )
            ).read()
        except Exception:
            pass
        # #endregion
        raise HTTPException(status_code=502, detail=f"配音生成失败: {str(exc)}") from exc

    try:
        audio_url = await persist_if_external(
            tts_result["url"],
            f"audio-clips/{project_id}",
            fallback_extension=get_media_fallback_extension("audio"),
            url_label="配音文件地址",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"配音文件落盘失败: {str(exc)}") from exc

    if not audio_url:
        raise HTTPException(status_code=502, detail="配音生成失败: 未返回可保存的音频地址")

    clip = AudioClip(
        user_id=user.id,
        project_id=project_id,
        storyboard_id=storyboard_id,
        text=text,
        voice_id=requested_voice_id,
        audio_url=audio_url,
        duration=tts_result["duration"],
        speed=speed,
        emotion=emotion,
        source=source,
    )
    db.add(clip)
    await db.flush()

    metadata_json = {
        "source": source,
        "clip_id": str(clip.id),
        "storyboard_id": str(storyboard_id) if storyboard_id else None,
        "duration": tts_result["duration"],
        "model": model_id,
        "provider_type": provider_type,
        "voice_id": requested_voice_id,
        "voice_name": voice_context["voice_name"],
        "provider_voice_id": voice_context["upstream_voice_id"],
        "voice_origin": voice_context["voice_origin"],
        "clone_status_snapshot": voice_context["clone_status"],
        "speed": speed,
        "emotion": emotion,
        "tts_metadata": tts_result.get("metadata"),
        "tts_request_options": provider_options,
    }
    if extra_metadata:
        metadata_json.update(extra_metadata)

    asset = Asset(
        user_id=user.id,
        project_id=project_id,
        name=f"配音 - {text[:20]}",
        asset_type="audio",
        category="audio",
        file_url=audio_url,
        prompt=text,
        model=model_id,
        metadata_json=metadata_json,
    )
    db.add(asset)

    await db.commit()
    await db.refresh(clip)
    return serialize_project_audio_clip(clip)


async def generate_storyboard_narration_audio(
    *,
    db: AsyncSession,
    user: User,
    project_id: UUID,
    storyboard: Storyboard,
    subject_map: dict[str, Subject],
    model: str | None = None,
    request_options: TTSAdvancedOptionsMixin | None = None,
    source: str = "storyboard_narration",
    target_subject_id: str | None = None,
) -> list[dict]:
    jobs = build_storyboard_narration_jobs(
        storyboard,
        subject_map=subject_map,
        target_subject_id=target_subject_id,
    )
    if not jobs:
        raise HTTPException(status_code=400, detail="当前分镜暂无可生成的旁白文本，或相关角色尚未绑定音色")

    provider_runtime = await get_user_model_provider_credentials(
        user.id,
        db,
        category="voice",
        requested_model=model,
    )
    if not provider_runtime:
        detail = "当前没有可用的配音模型，请先在 API 配置中启用一个 voice 模型"
        if model:
            detail = f"未找到可用的配音模型 {model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)

    created: list[dict] = []
    for job in jobs:
        created.append(
            await generate_project_audio_clip(
                db=db,
                user=user,
                project_id=project_id,
                storyboard_id=storyboard.id,
                text=job["text"],
                requested_voice_id=job["voice_id"],
                speed=job["speed"],
                emotion=None,
                model=model,
                request_options=request_options,
                provider_runtime=provider_runtime,
                source=source,
                extra_metadata={
                    "role": job["role"],
                    "subject_id": job["subject_id"],
                    "subject_name": job["subject_name"],
                    "narration_type": "storyboard_segment",
                },
            )
        )
    return created
