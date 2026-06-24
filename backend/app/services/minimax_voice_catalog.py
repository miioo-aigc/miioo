import re
import time

from app.services.http_client import upstream_async_client

MINIMAX_SYSTEM_VOICE_MARKDOWN_URL = "https://platform.minimax.io/docs/faq/system-voice-id.md"
MINIMAX_SYSTEM_VOICE_CACHE_TTL_SECONDS = 60 * 60
MINIMAX_SUPPORTED_EMOTIONS = "happy,sad,angry,fearful,disgusted,surprised,calm"

_catalog_cache: dict[str, object] = {
    "expires_at": 0.0,
    "voices": [],
}


def _normalize_markdown_cell(value: str) -> str:
    cleaned = (value or "").strip()
    cleaned = cleaned.replace("\\_", "_")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def _guess_language_boost(language: str) -> str | None:
    normalized = (language or "").strip().lower()
    if normalized == "cantonese":
        return "Chinese,Yue"
    return None


def _to_voice_payload(language: str, voice_id: str, voice_name: str) -> dict[str, object]:
    language_boost = _guess_language_boost(language)
    return {
        "id": "",
        "voice_id": voice_id,
        "name": voice_name or voice_id,
        "gender": None,
        "age_group": None,
        "language": language,
        "style": "官方系统音色",
        "emotions": MINIMAX_SUPPORTED_EMOTIONS,
        "preview_url": None,
        "provider": "minimax",
        "is_custom": False,
        "is_favorite": False,
        "source_label": "MiniMax 官方系统音色",
        "supports_favorite": False,
        "language_boost": language_boost,
    }


def _parse_system_voice_markdown(markdown: str) -> list[dict[str, object]]:
    voices: list[dict[str, object]] = []

    for line in (markdown or "").splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if "Voice_id" in stripped or stripped.startswith("| :--"):
            continue

        cells = [segment.strip() for segment in stripped.strip("|").split("|")]
        if len(cells) < 4:
            continue

        number_cell, language_cell, voice_id_cell, voice_name_cell = cells[:4]
        if not number_cell.isdigit():
            continue

        language = _normalize_markdown_cell(language_cell)
        voice_id = _normalize_markdown_cell(voice_id_cell)
        voice_name = _normalize_markdown_cell(voice_name_cell)
        if not language or not voice_id:
            continue

        voices.append(_to_voice_payload(language, voice_id, voice_name))

    return voices


async def get_minimax_system_voice_catalog(force_refresh: bool = False) -> list[dict[str, object]]:
    now = time.time()
    cached_voices = _catalog_cache.get("voices")
    expires_at = float(_catalog_cache.get("expires_at") or 0.0)
    if not force_refresh and isinstance(cached_voices, list) and cached_voices and expires_at > now:
        return cached_voices

    async with upstream_async_client(
        profile="provider",
        timeout=20.0,
        follow_redirects=True,
    ) as client:
        response = await client.get(MINIMAX_SYSTEM_VOICE_MARKDOWN_URL)
        response.raise_for_status()

    voices = _parse_system_voice_markdown(response.text)
    if not voices:
        raise ValueError("MiniMax 官方系统音色列表解析失败")

    _catalog_cache["voices"] = voices
    _catalog_cache["expires_at"] = now + MINIMAX_SYSTEM_VOICE_CACHE_TTL_SECONDS
    return voices
