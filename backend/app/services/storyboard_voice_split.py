"""Split storyboard shots when multiple speakers require different voice references."""

from __future__ import annotations

from copy import deepcopy
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.services.narration_duration import (
    SEEDANCE_MAX_DURATION,
    estimate_narration_duration_seconds,
    max_chars_for_duration,
    split_text_by_sentences,
)
from app.services.narration_segments import (
    enrich_narration_segments,
    normalize_narration_segment,
    segments_to_voiceover,
)


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _segment_voice_key(segment: dict) -> str:
    voice_id = _clean_text(segment.get("voice_id"))
    subject_id = _clean_text(segment.get("subject_id"))
    role = _clean_text(segment.get("role"))
    return voice_id or subject_id or role or "__unknown__"


def _normalize_segments(raw_segments: list[dict] | None) -> list[dict]:
    if not isinstance(raw_segments, list):
        return []
    normalized: list[dict] = []
    for segment in raw_segments:
        item = normalize_narration_segment(segment)
        if item:
            normalized.append(item)
    return normalized


def should_split_storyboard_by_voice(segments: list[dict] | None) -> bool:
    normalized = _normalize_segments(segments)
    voice_keys = {_segment_voice_key(segment) for segment in normalized if _segment_voice_key(segment) != "__unknown__"}
    return len(voice_keys) > 1


def _expand_long_segment(segment: dict) -> list[dict]:
    value = _clean_text(segment.get("value"))
    if not value:
        return []

    speed = segment.get("speed", 1.0)
    estimated = estimate_narration_duration_seconds(value, speed=speed)
    if estimated is None or estimated <= SEEDANCE_MAX_DURATION:
        return [segment]

    max_chars = max_chars_for_duration(SEEDANCE_MAX_DURATION, speed=speed)
    chunks = split_text_by_sentences(value, max_chars=max_chars)
    if len(chunks) <= 1:
        return [segment]

    expanded: list[dict] = []
    for chunk in chunks:
        clone = dict(segment)
        clone["value"] = chunk
        expanded.append(clone)
    return expanded


def build_voice_split_shot_payloads(
    storyboard: Storyboard,
    *,
    segments: list[dict] | None,
) -> list[dict]:
    normalized = _normalize_segments(segments)
    if not normalized:
        return []

    grouped: dict[str, list[dict]] = {}
    for segment in normalized:
        expanded = _expand_long_segment(segment)
        for item in expanded:
            key = _segment_voice_key(item)
            grouped.setdefault(key, []).append(item)

    if len(grouped) <= 1 and len(normalized) == len(next(iter(grouped.values()), [])):
        return []

    payloads: list[dict] = []
    for group_segments in grouped.values():
        voiceover = segments_to_voiceover(group_segments)
        duration = estimate_narration_duration_seconds(
            "\n".join(_clean_text(item.get("value")) for item in group_segments),
            speed=min(float(item.get("speed") or 1.0) for item in group_segments),
        )
        gen_params = deepcopy(storyboard.gen_params) if isinstance(storyboard.gen_params, dict) else {}
        gen_params["narration_segments"] = group_segments
        payloads.append(
            {
                "content": storyboard.content,
                "shot_type": storyboard.shot_type,
                "camera": storyboard.camera,
                "camera_angle": storyboard.camera_angle,
                "composition": storyboard.composition,
                "duration": duration or storyboard.duration,
                "lighting": storyboard.lighting,
                "ambient_sound": storyboard.ambient_sound,
                "voiceover": voiceover,
                "image_prompt": storyboard.image_prompt,
                "character_ids": list(storyboard.character_ids or []),
                "scene_id": str(storyboard.scene_id) if storyboard.scene_id else None,
                "prop_ids": list(storyboard.prop_ids or []),
                "reference_image_urls": list(storyboard.reference_image_urls or []),
                "image_url": storyboard.image_url,
                "video_url": storyboard.video_url,
                "gen_params": gen_params,
            }
        )
    return payloads


async def apply_storyboard_voice_split(
    *,
    db: AsyncSession,
    storyboard: Storyboard,
    subjects: list[Subject],
    segments: list[dict] | None,
) -> dict | None:
    enriched_segments = enrich_narration_segments(
        segments if isinstance(segments, list) else [],
        subjects=subjects,
        character_ids=storyboard.character_ids,
        global_voice_params=(
            storyboard.gen_params.get("global_voice_params")
            if isinstance(storyboard.gen_params, dict)
            else None
        ),
    )
    if not should_split_storyboard_by_voice(enriched_segments):
        return None

    payloads = build_voice_split_shot_payloads(storyboard, segments=enriched_segments)
    if len(payloads) <= 1:
        return None

    source_storyboard_id = str(storyboard.id)
    episode_id = storyboard.episode_id
    project_id = storyboard.project_id
    original_id = storyboard.id

    from sqlalchemy import select

    scope_query = select(Storyboard).where(
        Storyboard.project_id == project_id,
        Storyboard.episode_id == episode_id,
    ).order_by(Storyboard.sort_order.asc())
    result = await db.execute(scope_query)
    ordered = list(result.scalars().all())
    original_index = next((idx for idx, item in enumerate(ordered) if item.id == original_id), storyboard.sort_order)

    await db.delete(storyboard)
    await db.flush()

    created: list[Storyboard] = []
    for offset, payload in enumerate(payloads):
        sb = Storyboard(
            project_id=project_id,
            episode_id=episode_id,
            shot_number=original_index + offset + 1,
            content=payload.get("content"),
            shot_type=payload.get("shot_type"),
            camera=payload.get("camera"),
            camera_angle=payload.get("camera_angle"),
            composition=payload.get("composition"),
            duration=payload.get("duration"),
            lighting=payload.get("lighting"),
            ambient_sound=payload.get("ambient_sound"),
            voiceover=payload.get("voiceover"),
            image_prompt=payload.get("image_prompt"),
            character_ids=payload.get("character_ids"),
            scene_id=UUID(payload["scene_id"]) if payload.get("scene_id") else None,
            prop_ids=payload.get("prop_ids"),
            reference_image_urls=payload.get("reference_image_urls"),
            image_url=payload.get("image_url") if offset == 0 else None,
            video_url=payload.get("video_url") if offset == 0 else None,
            sort_order=original_index + offset,
            gen_params=payload.get("gen_params") or {},
        )
        db.add(sb)
        created.append(sb)

    remaining = [item for item in ordered if item.id != original_id]
    new_ordered = remaining[:original_index] + created + remaining[original_index:]
    for idx, item in enumerate(new_ordered):
        item.sort_order = idx
        item.shot_number = idx + 1

    await db.flush()
    return {
        "split_applied": True,
        "source_storyboard_id": source_storyboard_id,
        "created_storyboard_ids": [str(item.id) for item in created],
        "created_count": len(created),
    }
