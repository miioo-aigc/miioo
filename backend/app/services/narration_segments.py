"""Normalize and enrich storyboard narration segments."""

from __future__ import annotations

from app.models.subject import Subject
from app.models.storyboard import Storyboard


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _normalize_speed(value: object, fallback: float = 1.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if numeric <= 0:
        return fallback
    return numeric


def _normalize_volume(value: object, fallback: float = 70.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return fallback
    if numeric < 0:
        return fallback
    return numeric


def parse_voiceover_lines(voiceover: str | None) -> list[dict]:
    normalized = _clean_text(voiceover)
    if not normalized:
        return []

    segments: list[dict] = []
    for line in normalized.splitlines():
        cleaned = _clean_text(line)
        if not cleaned:
            continue
        role = ""
        value = cleaned
        for separator in ("：", ":"):
            idx = cleaned.find(separator)
            if idx > 0:
                role = cleaned[:idx].strip()
                value = cleaned[idx + len(separator) :].strip()
                break
        if value:
            segments.append({"role": role, "value": value})
    return segments


def segments_to_voiceover(segments: list[dict] | None) -> str | None:
    if not isinstance(segments, list) or not segments:
        return None

    lines: list[str] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        role = _clean_text(segment.get("role"))
        value = _clean_text(segment.get("value") or segment.get("lines"))
        if not value:
            continue
        lines.append(f"{role}：{value}" if role else value)
    return "\n".join(lines) if lines else None


def normalize_narration_segment(segment: dict, *, global_voice_params: dict | None = None) -> dict | None:
    if not isinstance(segment, dict):
        return None

    role = _clean_text(segment.get("role"))
    value = _clean_text(segment.get("value") or segment.get("lines"))
    if not value:
        return None

    global_for_role = (
        global_voice_params.get(role)
        if role and isinstance(global_voice_params, dict) and isinstance(global_voice_params.get(role), dict)
        else {}
    )

    emotion = _clean_text(segment.get("emotion") or global_for_role.get("emotion")) or "中性"
    speed = _normalize_speed(segment.get("speed", global_for_role.get("speed")), 1.0)
    volume = _normalize_volume(segment.get("volume", global_for_role.get("volume")), 70.0)

    normalized = {
        "role": role,
        "value": value,
        "speed": speed,
        "volume": volume,
        "emotion": emotion,
    }

    if segment.get("usesGlobal") is True or segment.get("_usesGlobal") is True:
        normalized["usesGlobal"] = True

    subject_id = _clean_text(segment.get("subject_id"))
    voice_id = _clean_text(segment.get("voice_id"))
    if subject_id:
        normalized["subject_id"] = subject_id
    if voice_id:
        normalized["voice_id"] = voice_id

    return normalized


def build_role_subject_map(subjects: list[Subject]) -> dict[str, Subject]:
    role_map: dict[str, Subject] = {}
    for subject in subjects:
        if subject.type != "character":
            continue
        for candidate in (subject.name, subject.role):
            key = _clean_text(candidate)
            if key and key not in role_map:
                role_map[key] = subject
    return role_map


def enrich_narration_segments(
    segments: list[dict] | None,
    *,
    subjects: list[Subject],
    character_ids: list[str] | None = None,
    global_voice_params: dict | None = None,
) -> list[dict]:
    role_map = build_role_subject_map(subjects)
    character_subjects = [
        subject
        for subject in subjects
        if subject.type == "character" and str(subject.id) in {str(item) for item in (character_ids or [])}
    ]
    if not character_subjects:
        character_subjects = [subject for subject in subjects if subject.type == "character"]

    enriched: list[dict] = []
    raw_segments = segments if isinstance(segments, list) else []
    for segment in raw_segments:
        normalized = normalize_narration_segment(segment, global_voice_params=global_voice_params)
        if not normalized:
            continue

        role = normalized.get("role") or ""
        matched_subject = role_map.get(role)
        if matched_subject is None and not role and len(character_subjects) == 1:
            matched_subject = character_subjects[0]
        if matched_subject is None and len(character_subjects) == 1 and role == character_subjects[0].name:
            matched_subject = character_subjects[0]

        if matched_subject:
            normalized["subject_id"] = str(matched_subject.id)
            if matched_subject.voice_id:
                normalized["voice_id"] = matched_subject.voice_id
            if not normalized.get("role"):
                normalized["role"] = matched_subject.name

        enriched.append(normalized)
    return enriched


def merge_storyboard_narration_gen_params(
    existing_gen_params: dict | None,
    incoming_gen_params: dict | None,
    *,
    subjects: list[Subject],
    storyboard: Storyboard,
) -> dict:
    next_gen_params = dict(existing_gen_params or {})
    if isinstance(incoming_gen_params, dict):
        for key, value in incoming_gen_params.items():
            if key not in {"narration_segments", "global_voice_params"}:
                next_gen_params[key] = value

    global_voice_params = (
        incoming_gen_params.get("global_voice_params")
        if isinstance(incoming_gen_params, dict) and isinstance(incoming_gen_params.get("global_voice_params"), dict)
        else next_gen_params.get("global_voice_params")
    )
    if not isinstance(global_voice_params, dict):
        global_voice_params = {}

    incoming_segments = None
    if isinstance(incoming_gen_params, dict) and "narration_segments" in incoming_gen_params:
        incoming_segments = incoming_gen_params.get("narration_segments")
    elif storyboard.voiceover:
        incoming_segments = parse_voiceover_lines(storyboard.voiceover)
    elif isinstance(next_gen_params.get("narration_segments"), list):
        incoming_segments = next_gen_params.get("narration_segments")

    enriched_segments = enrich_narration_segments(
        incoming_segments if isinstance(incoming_segments, list) else [],
        subjects=subjects,
        character_ids=storyboard.character_ids,
        global_voice_params=global_voice_params,
    )

    if enriched_segments:
        next_gen_params["narration_segments"] = enriched_segments
    elif isinstance(incoming_gen_params, dict) and "narration_segments" in incoming_gen_params:
        next_gen_params["narration_segments"] = []

    if global_voice_params:
        next_gen_params["global_voice_params"] = global_voice_params

    voiceover = segments_to_voiceover(enriched_segments) or _clean_text(storyboard.voiceover) or None
    if voiceover:
        storyboard.voiceover = voiceover

    return next_gen_params
