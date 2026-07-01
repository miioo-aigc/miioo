"""Estimate storyboard shot duration from narration text."""

from __future__ import annotations

import math
import re

SEEDANCE_MIN_DURATION = 4
SEEDANCE_MAX_DURATION = 15
DEFAULT_CHARS_PER_SECOND = 3.5


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


def collect_narration_text(
    *,
    voiceover: str | None = None,
    narration_segments: list[dict] | None = None,
) -> str:
    segments = narration_segments if isinstance(narration_segments, list) else []
    segment_texts = [
        _clean_text(segment.get("value") or segment.get("lines"))
        for segment in segments
        if isinstance(segment, dict)
    ]
    segment_texts = [text for text in segment_texts if text]
    if segment_texts:
        return "\n".join(segment_texts)
    return _clean_text(voiceover)


def estimate_narration_duration_seconds(
    text: str,
    *,
    speed: float = 1.0,
    min_duration: int = SEEDANCE_MIN_DURATION,
    max_duration: int = SEEDANCE_MAX_DURATION,
    chars_per_second: float = DEFAULT_CHARS_PER_SECOND,
) -> float | None:
    normalized = _clean_text(text)
    if not normalized:
        return None

    normalized_speed = _normalize_speed(speed)
    effective_rate = max(chars_per_second * normalized_speed, 0.5)
    estimated = math.ceil(len(normalized) / effective_rate)
    clamped = max(min_duration, min(max_duration, estimated))
    return float(clamped)


def estimate_segments_duration_seconds(
    segments: list[dict] | None,
    *,
    min_duration: int = SEEDANCE_MIN_DURATION,
    max_duration: int = SEEDANCE_MAX_DURATION,
) -> float | None:
    if not isinstance(segments, list) or not segments:
        return None

    total_chars = 0
    slowest_speed = 1.0
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        text = _clean_text(segment.get("value") or segment.get("lines"))
        if not text:
            continue
        total_chars += len(text)
        slowest_speed = min(slowest_speed, _normalize_speed(segment.get("speed"), 1.0))

    if total_chars <= 0:
        return None

    return estimate_narration_duration_seconds(
        "x" * total_chars,
        speed=slowest_speed,
        min_duration=min_duration,
        max_duration=max_duration,
    )


def split_text_by_sentences(text: str, *, max_chars: int) -> list[str]:
    normalized = _clean_text(text)
    if not normalized:
        return []
    if len(normalized) <= max_chars:
        return [normalized]

    sentences = [
        part.strip()
        for part in re.split(r"(?<=[。！？!?；;])\s*", normalized)
        if part.strip()
    ]
    if not sentences:
        sentences = [normalized]

    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            start = 0
            while start < len(sentence):
                chunks.append(sentence[start : start + max_chars])
                start += max_chars
            continue

        candidate = f"{current}{sentence}" if current else sentence
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)
    return chunks


def max_chars_for_duration(
    duration_seconds: float,
    *,
    speed: float = 1.0,
    chars_per_second: float = DEFAULT_CHARS_PER_SECOND,
) -> int:
    normalized_speed = _normalize_speed(speed)
    effective_rate = max(chars_per_second * normalized_speed, 0.5)
    return max(1, int(duration_seconds * effective_rate))
