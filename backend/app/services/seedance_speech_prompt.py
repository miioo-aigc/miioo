"""Build Seedance speech/narration prompt blocks."""

from __future__ import annotations


def _clean_text(value: object) -> str:
    return str(value or "").strip()


def _format_speed(value: object) -> str:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = 1.0
    if numeric.is_integer():
        return f"{int(numeric)}.0"
    return f"{numeric:.1f}".rstrip("0").rstrip(".")


def build_seedance_speech_prompt(
    segments: list[dict] | None,
    *,
    fallback_text: str | None = None,
    reference_audio_token: str = "参考音频1",
) -> str | None:
    normalized_segments = [
        segment
        for segment in (segments or [])
        if isinstance(segment, dict) and _clean_text(segment.get("value") or segment.get("lines"))
    ]

    lines: list[str] = ["【台词与旁白】"]
    if normalized_segments:
        for segment in normalized_segments:
            role = _clean_text(segment.get("role")) or "旁白"
            value = _clean_text(segment.get("value") or segment.get("lines"))
            emotion = _clean_text(segment.get("emotion")) or "中性"
            speed = _format_speed(segment.get("speed", 1.0))
            lines.append(
                f"{role}（{reference_audio_token}，语速{speed}x，情感{emotion}）：{value}"
            )
    else:
        fallback = _clean_text(fallback_text)
        if not fallback:
            return None
        lines.append(fallback)

    lines.extend(
        [
            "【配音要求】",
            f"- 音色贴合{reference_audio_token}",
            "- 语调与情感符合台词内容，口型与发声自然同步",
            "- 完整念出台词，不要省略或改写",
        ]
    )
    return "\n".join(lines)
