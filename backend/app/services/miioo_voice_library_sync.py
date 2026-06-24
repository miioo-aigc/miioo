import hashlib
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.voice import Voice
from app.services.media_storage import build_upload_url, resolve_upload_dir

AUDIO_ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a"}
VOICE_ID_PREFIX = "miioo_library_"
UPLOAD_SUBDIR = "voice-library/system/miioo"
IMPORT_SOURCE = "miioo_local_voice_library"


def resolve_miioo_voice_library_source_dir() -> Path:
    configured = str(settings.MIIOO_VOICE_LIBRARY_SOURCE_DIR or "").strip()
    source_dir = Path(configured) if configured else settings.backend_dir.parents[1] / "语音库文件"
    if not source_dir.is_absolute():
        source_dir = (settings.backend_dir / source_dir).resolve()
    return source_dir.resolve()


def _build_voice_id(file_path: Path) -> str:
    digest = hashlib.sha1(file_path.name.encode("utf-8")).hexdigest()[:16]
    return f"{VOICE_ID_PREFIX}{digest}"


def _extract_display_name(file_path: Path) -> str:
    stem = file_path.stem
    stem = re.sub(r"(?i)_no-watermark$", "", stem)
    parts = [part.strip() for part in stem.split("_") if part.strip()]
    meaningful_parts: list[str] = []
    for part in parts:
        lowered = part.lower()
        if lowered in {"minimax", "no-watermark"}:
            continue
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", part):
            continue
        if re.fullmatch(r"\d{2}", part):
            continue
        meaningful_parts.append(part)
    return (meaningful_parts[-1] if meaningful_parts else stem.replace("_", " ")).strip()[:100]


def _infer_gender(name: str) -> str | None:
    if any(keyword in name for keyword in ("少女", "奶奶", "御姐", "女")):
        return "female"
    if any(keyword in name for keyword in ("青年", "男", "少年")):
        return "male"
    return None


def _infer_age_group(name: str) -> str | None:
    if any(keyword in name for keyword in ("少女", "少年")):
        return "youth"
    if any(keyword in name for keyword in ("奶奶", "御姐", "青年")):
        return "adult"
    return None


def _infer_emotions(name: str) -> str | None:
    for keyword in ("温暖", "傲娇", "不羁", "冷静", "活泼", "霸气"):
        if keyword in name:
            return keyword
    return None


def _build_metadata(*, source_path: Path, imported_url: str) -> dict[str, Any]:
    stat = source_path.stat()
    return {
        "import_source": IMPORT_SOURCE,
        "source_filename": source_path.name,
        "source_path": str(source_path),
        "source_size": stat.st_size,
        "source_mtime_ns": stat.st_mtime_ns,
        "managed_preview_url": imported_url,
    }


def _copy_source_audio_to_uploads(source_path: Path) -> str:
    upload_dir = resolve_upload_dir(UPLOAD_SUBDIR)
    destination_name = f"{hashlib.sha1(source_path.name.encode('utf-8')).hexdigest()[:16]}{source_path.suffix.lower()}"
    destination_path = upload_dir / destination_name
    shutil.copy2(source_path, destination_path)
    return build_upload_url(UPLOAD_SUBDIR, destination_name)


async def sync_miioo_voice_library_from_directory(
    db: AsyncSession,
    *,
    admin_user_id: UUID,
    disable_missing: bool = False,
) -> dict[str, Any]:
    source_dir = resolve_miioo_voice_library_source_dir()
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"miioo 音色库目录不存在: {source_dir}")

    source_files = sorted(
        file_path for file_path in source_dir.iterdir()
        if file_path.is_file() and file_path.suffix.lower() in AUDIO_ALLOWED_EXTENSIONS
    )

    existing_result = await db.execute(
        select(Voice).where(
            Voice.is_custom == False,
            Voice.voice_id.like(f"{VOICE_ID_PREFIX}%"),
        )
    )
    existing_items = {voice.voice_id: voice for voice in existing_result.scalars().all()}

    created_count = 0
    updated_count = 0
    disabled_count = 0
    imported_voice_ids: set[str] = set()

    for index, source_file in enumerate(source_files):
        now = datetime.utcnow()
        voice_id = _build_voice_id(source_file)
        imported_voice_ids.add(voice_id)
        display_name = _extract_display_name(source_file)
        preview_url = _copy_source_audio_to_uploads(source_file)
        metadata = _build_metadata(source_path=source_file, imported_url=preview_url)

        existing_voice = existing_items.get(voice_id)
        if existing_voice is None:
            voice = Voice(
                voice_id=voice_id,
                name=display_name,
                gender=_infer_gender(display_name),
                age_group=_infer_age_group(display_name),
                language="zh",
                style=display_name,
                emotions=_infer_emotions(display_name),
                preview_url=preview_url,
                source_audio_url=preview_url,
                provider="miioo",
                is_custom=False,
                is_enabled=True,
                sort_order=index,
                metadata_json=metadata,
                created_by=admin_user_id,
                updated_by=admin_user_id,
                created_at=now,
                updated_at=now,
            )
            db.add(voice)
            created_count += 1
            continue

        should_update = any([
            existing_voice.name != display_name,
            existing_voice.preview_url != preview_url,
            existing_voice.source_audio_url != preview_url,
            existing_voice.provider != "miioo",
            existing_voice.is_enabled is not True,
            int(existing_voice.sort_order or 0) != index,
            (existing_voice.metadata_json or {}).get("source_mtime_ns") != metadata["source_mtime_ns"],
        ])
        if should_update:
            existing_voice.name = display_name
            existing_voice.gender = _infer_gender(display_name)
            existing_voice.age_group = _infer_age_group(display_name)
            existing_voice.language = "zh"
            existing_voice.style = display_name
            existing_voice.emotions = _infer_emotions(display_name)
            existing_voice.preview_url = preview_url
            existing_voice.source_audio_url = preview_url
            existing_voice.provider = "miioo"
            existing_voice.is_enabled = True
            existing_voice.sort_order = index
            existing_voice.metadata_json = metadata
            existing_voice.updated_by = admin_user_id
            existing_voice.updated_at = now
            updated_count += 1

    if disable_missing:
        for voice_id, voice in existing_items.items():
            if voice_id in imported_voice_ids:
                continue
            if voice.is_enabled:
                voice.is_enabled = False
                voice.updated_by = admin_user_id
                voice.updated_at = datetime.utcnow()
                disabled_count += 1

    await db.commit()
    return {
        "source_dir": str(source_dir),
        "total_files": len(source_files),
        "created_count": created_count,
        "updated_count": updated_count,
        "disabled_count": disabled_count,
    }
