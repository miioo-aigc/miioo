import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

from app.database import async_session
from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.composition import Composition
from app.models.creation_session import CreationSession
from app.models.creation_shot import CreationShot
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.models.subject_image import SubjectImage
from app.models.video_clip import VideoClip
from app.services.media_storage import (
    build_managed_storage_metadata,
    get_media_fallback_extension,
    is_external_media_url,
    is_managed_upload_url,
    persist_if_external,
    persist_many_if_external,
)

CREATION_SHOT_IMPORT_CONFIG = {
    "image_url": {"asset_type": "image", "category": "storyboard", "label": "图片"},
    "audio_url": {"asset_type": "audio", "category": "audio", "label": "音频"},
    "video_url": {"asset_type": "video", "category": "storyboard", "label": "视频"},
}


@dataclass
class MigrationStats:
    scanned: int = 0
    migrated: int = 0
    skipped: int = 0
    failed: int = 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="回填历史外链媒体为本站托管地址")
    parser.add_argument("--dry-run", action="store_true", help="只扫描，不实际下载和写库")
    parser.add_argument(
        "--tables",
        default="assets,storyboards,subject_images,audio_clips,video_clips,creation_shots,compositions",
        help="逗号分隔的表名过滤",
    )
    parser.add_argument(
        "--media-types",
        default="image,video,audio,document",
        help="逗号分隔的媒体类型过滤",
    )
    parser.add_argument("--user-id", default=None, help="仅处理指定用户")
    parser.add_argument("--project-id", default=None, help="仅处理指定项目")
    return parser.parse_args()


def _parse_csv_set(raw: str | None) -> set[str]:
    return {item.strip() for item in (raw or "").split(",") if item.strip()}


def _allowed(value: str, allowed_values: set[str]) -> bool:
    return not allowed_values or value in allowed_values


async def _persist_single(
    url: str | None,
    *,
    subdir: str,
    media_type: str,
    label: str,
    dry_run: bool,
) -> tuple[str | None, str | None, bool]:
    if not url:
        return url, None, False
    cleaned = url.strip()
    if not cleaned or is_managed_upload_url(cleaned) or not is_external_media_url(cleaned):
        return cleaned, None, False
    if dry_run:
        return cleaned, cleaned, True
    persisted = await persist_if_external(
        cleaned,
        subdir,
        fallback_extension=get_media_fallback_extension(media_type),
        url_label=label,
    )
    return persisted, cleaned, persisted != cleaned


async def _persist_list(
    urls: list[str] | None,
    *,
    subdir: str,
    media_type: str,
    label: str,
    dry_run: bool,
) -> tuple[list[str] | None, list[str] | None, bool]:
    cleaned_urls = [url.strip() for url in (urls or []) if isinstance(url, str) and url.strip()]
    if not cleaned_urls:
        return None, None, False
    origin_urls = [url for url in cleaned_urls if is_external_media_url(url)]
    if not origin_urls:
        return cleaned_urls, None, False
    if dry_run:
        return cleaned_urls, origin_urls, True
    persisted = await persist_many_if_external(
        cleaned_urls,
        subdir,
        fallback_extension=get_media_fallback_extension(media_type),
        url_label=label,
    )
    changed = persisted != cleaned_urls
    return persisted, origin_urls, changed


def _merge_metadata(existing: dict | None, updates: dict | None = None) -> dict | None:
    metadata = dict(existing or {})
    if updates:
        metadata.update(updates)
    return metadata or None


async def _update_assets_by_file_url(db, old_url: str, new_url: str) -> None:
    result = await db.execute(select(Asset).where(Asset.file_url == old_url))
    for asset in result.scalars().all():
        asset.file_url = new_url


async def _ensure_creation_shot_import_asset(
    db,
    *,
    user_id: str,
    shot: CreationShot,
    field_name: str,
    file_url: str,
    origin_url: str | None,
) -> None:
    config = CREATION_SHOT_IMPORT_CONFIG[field_name]
    result = await db.execute(
        select(Asset).where(
            Asset.user_id == user_id,
            Asset.asset_type == config["asset_type"],
            Asset.metadata_json["source"].as_string() == "creation_shot_import",
            Asset.metadata_json["shot_id"].as_string() == str(shot.id),
            Asset.metadata_json["imported_field"].as_string() == field_name,
        )
    )
    asset = result.scalar_one_or_none()
    metadata = build_managed_storage_metadata(
        origin_url=origin_url,
        import_source="migration",
        extra={
            "source": "creation_shot_import",
            "session_id": str(shot.session_id),
            "shot_id": str(shot.id),
            "imported_field": field_name,
        },
    )
    if asset:
        asset.project_id = shot.project_id
        asset.category = config["category"]
        asset.file_url = file_url
        asset.metadata_json = _merge_metadata(asset.metadata_json, metadata)
        return

    db.add(
        Asset(
            user_id=user_id,
            project_id=shot.project_id,
            name=f"镜头#{shot.shot_number}{config['label']}",
            asset_type=config["asset_type"],
            category=config["category"],
            file_url=file_url,
            metadata_json=metadata,
        )
    )


async def _process_assets(db, args, stats: MigrationStats) -> None:
    result = await db.execute(select(Asset))
    for asset in result.scalars().all():
        if args.user_id and str(asset.user_id) != args.user_id:
            continue
        if args.project_id and str(asset.project_id or "") != args.project_id:
            continue
        if not _allowed(asset.asset_type, args.media_types):
            continue

        stats.scanned += 1
        try:
            file_url, origin_url, file_changed = await _persist_single(
                asset.file_url,
                subdir=f"migration/assets/{asset.asset_type}s",
                media_type=asset.asset_type,
                label="资产文件地址",
                dry_run=args.dry_run,
            )
            thumbnail_url, origin_thumbnail_url, thumb_changed = await _persist_single(
                asset.thumbnail_url,
                subdir=f"migration/assets/{asset.asset_type}s/thumbnails",
                media_type="image",
                label="资产缩略图地址",
                dry_run=args.dry_run,
            )
            reference_urls, origin_reference_urls, ref_changed = await _persist_list(
                asset.reference_image_urls,
                subdir="migration/assets/references",
                media_type="image",
                label="资产参考图地址",
                dry_run=args.dry_run,
            )
            if not any([file_changed, thumb_changed, ref_changed]):
                stats.skipped += 1
                continue
            if not args.dry_run:
                asset.file_url = file_url or asset.file_url
                asset.thumbnail_url = thumbnail_url
                asset.reference_image_urls = reference_urls
                metadata_updates = build_managed_storage_metadata(
                    origin_url=origin_url,
                    import_source="migration",
                )
                if origin_thumbnail_url:
                    metadata_updates["origin_thumbnail_url"] = origin_thumbnail_url
                if origin_reference_urls:
                    metadata_updates["origin_reference_urls"] = origin_reference_urls
                asset.metadata_json = _merge_metadata(asset.metadata_json, metadata_updates)
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[assets] {asset.id} failed: {exc}")


async def _process_storyboards(db, args, stats: MigrationStats, project_users: dict[str, str]) -> None:
    result = await db.execute(select(Storyboard))
    for storyboard in result.scalars().all():
        project_id = str(storyboard.project_id)
        if args.project_id and project_id != args.project_id:
            continue
        if args.user_id and project_users.get(project_id) != args.user_id:
            continue

        media_specs = []
        if _allowed("image", args.media_types):
            media_specs.append(("image_url", "image", "migration/storyboards/images"))
        if _allowed("video", args.media_types):
            media_specs.append(("video_url", "video", "migration/storyboards/videos"))
        for field_name, media_type, subdir in media_specs:
            stats.scanned += 1
            try:
                old_url = getattr(storyboard, field_name)
                new_url, origin_url, changed = await _persist_single(
                    old_url,
                    subdir=subdir,
                    media_type=media_type,
                    label=f"分镜{field_name}",
                    dry_run=args.dry_run,
                )
                if not changed:
                    stats.skipped += 1
                    continue
                if not args.dry_run:
                    setattr(storyboard, field_name, new_url)
                    await _update_assets_by_file_url(db, old_url, new_url)
                    if field_name == "video_url":
                        metadata = dict(storyboard.gen_params or {})
                        metadata.update(build_managed_storage_metadata(origin_url=origin_url, import_source="migration"))
                        storyboard.gen_params = metadata
                stats.migrated += 1
            except Exception as exc:
                stats.failed += 1
                print(f"[storyboards] {storyboard.id}.{field_name} failed: {exc}")


async def _process_subject_images(
    db,
    args,
    stats: MigrationStats,
    subject_project_map: dict[str, str],
    project_users: dict[str, str],
) -> None:
    if not _allowed("image", args.media_types):
        return
    result = await db.execute(select(SubjectImage))
    for image in result.scalars().all():
        project_id = subject_project_map.get(str(image.subject_id))
        if args.project_id and project_id != args.project_id:
            continue
        if args.user_id and project_users.get(project_id or "") != args.user_id:
            continue

        stats.scanned += 1
        try:
            new_url, _, changed = await _persist_single(
                image.image_url,
                subdir="migration/subjects/images",
                media_type="image",
                label="主体图片地址",
                dry_run=args.dry_run,
            )
            if not changed:
                stats.skipped += 1
                continue
            if not args.dry_run:
                old_url = image.image_url
                image.image_url = new_url or image.image_url
                await _update_assets_by_file_url(db, old_url, image.image_url)
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[subject_images] {image.id} failed: {exc}")


async def _process_audio_clips(db, args, stats: MigrationStats) -> None:
    if not _allowed("audio", args.media_types):
        return
    result = await db.execute(select(AudioClip))
    for clip in result.scalars().all():
        if args.user_id and str(clip.user_id) != args.user_id:
            continue
        if args.project_id and str(clip.project_id or "") != args.project_id:
            continue

        stats.scanned += 1
        try:
            new_url, _, changed = await _persist_single(
                clip.audio_url,
                subdir="migration/audio-clips",
                media_type="audio",
                label="音频地址",
                dry_run=args.dry_run,
            )
            if not changed:
                stats.skipped += 1
                continue
            if not args.dry_run:
                old_url = clip.audio_url
                clip.audio_url = new_url or clip.audio_url
                await _update_assets_by_file_url(db, old_url, clip.audio_url)
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[audio_clips] {clip.id} failed: {exc}")


async def _process_video_clips(db, args, stats: MigrationStats) -> None:
    if not _allowed("video", args.media_types):
        return
    result = await db.execute(select(VideoClip))
    for clip in result.scalars().all():
        if args.user_id and str(clip.user_id) != args.user_id:
            continue
        if args.project_id and str(clip.project_id or "") != args.project_id:
            continue

        stats.scanned += 1
        try:
            new_url, _, changed = await _persist_single(
                clip.video_url,
                subdir="migration/video-clips",
                media_type="video",
                label="视频地址",
                dry_run=args.dry_run,
            )
            if not changed:
                stats.skipped += 1
                continue
            if not args.dry_run:
                old_url = clip.video_url
                clip.video_url = new_url or clip.video_url
                await _update_assets_by_file_url(db, old_url, clip.video_url)
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[video_clips] {clip.id} failed: {exc}")


async def _process_creation_shots(db, args, stats: MigrationStats, session_users: dict[str, str]) -> None:
    result = await db.execute(select(CreationShot))
    for shot in result.scalars().all():
        if args.project_id and str(shot.project_id or "") != args.project_id:
            continue
        if args.user_id and session_users.get(str(shot.session_id)) != args.user_id:
            continue

        for field_name, config in CREATION_SHOT_IMPORT_CONFIG.items():
            if not _allowed(config["asset_type"], args.media_types):
                continue
            stats.scanned += 1
            try:
                old_url = getattr(shot, field_name)
                new_url, origin_url, changed = await _persist_single(
                    old_url,
                    subdir=f"migration/creation-shots/{field_name}",
                    media_type=config["asset_type"],
                    label=f"创作镜头{field_name}",
                    dry_run=args.dry_run,
                )
                if not changed:
                    stats.skipped += 1
                    continue
                if not args.dry_run:
                    setattr(shot, field_name, new_url)
                    metadata = dict(shot.metadata_json or {})
                    imported_origins = dict(metadata.get("imported_origins") or {})
                    if origin_url:
                        imported_origins[field_name] = origin_url
                    if imported_origins:
                        metadata["imported_origins"] = imported_origins
                    shot.metadata_json = metadata
                    await _ensure_creation_shot_import_asset(
                        db,
                        user_id=session_users[str(shot.session_id)],
                        shot=shot,
                        field_name=field_name,
                        file_url=new_url or old_url,
                        origin_url=origin_url,
                    )
                stats.migrated += 1
            except Exception as exc:
                stats.failed += 1
                print(f"[creation_shots] {shot.id}.{field_name} failed: {exc}")

        if _allowed("image", args.media_types):
            stats.scanned += 1
            try:
                new_refs, origin_refs, changed = await _persist_list(
                    shot.reference_image_urls,
                    subdir="migration/creation-shots/references",
                    media_type="image",
                    label="创作镜头参考图地址",
                    dry_run=args.dry_run,
                )
                if not changed:
                    stats.skipped += 1
                    continue
                if not args.dry_run:
                    shot.reference_image_urls = new_refs
                    metadata = dict(shot.metadata_json or {})
                    imported_origins = dict(metadata.get("imported_origins") or {})
                    if origin_refs:
                        imported_origins["reference_image_urls"] = origin_refs
                    if imported_origins:
                        metadata["imported_origins"] = imported_origins
                    shot.metadata_json = metadata
                stats.migrated += 1
            except Exception as exc:
                stats.failed += 1
                print(f"[creation_shots] {shot.id}.reference_image_urls failed: {exc}")


async def _process_compositions(db, args, stats: MigrationStats, project_users: dict[str, str]) -> None:
    if not _allowed("video", args.media_types):
        return
    result = await db.execute(select(Composition))
    for composition in result.scalars().all():
        if args.project_id and str(composition.project_id) != args.project_id:
            continue
        if args.user_id and str(composition.user_id) != args.user_id:
            continue

        stats.scanned += 1
        try:
            new_url, _, changed = await _persist_single(
                composition.output_url,
                subdir=f"compositions/{composition.project_id}",
                media_type="video",
                label="成片输出地址",
                dry_run=args.dry_run,
            )
            if not changed:
                stats.skipped += 1
                continue
            if not args.dry_run:
                old_url = composition.output_url
                composition.output_url = new_url
                await _update_assets_by_file_url(db, old_url, composition.output_url)
            stats.migrated += 1
        except Exception as exc:
            stats.failed += 1
            print(f"[compositions] {composition.id} failed: {exc}")


async def main() -> None:
    args = _parse_args()
    args.tables = _parse_csv_set(args.tables)
    args.media_types = _parse_csv_set(args.media_types)

    async with async_session() as db:
        project_rows = (await db.execute(select(Project.id, Project.user_id))).all()
        project_users = {str(project_id): str(user_id) for project_id, user_id in project_rows}
        subject_rows = (await db.execute(select(Subject.id, Subject.project_id))).all()
        subject_project_map = {str(subject_id): str(project_id) for subject_id, project_id in subject_rows}
        session_rows = (await db.execute(select(CreationSession.id, CreationSession.user_id))).all()
        session_users = {str(session_id): str(user_id) for session_id, user_id in session_rows}

        stats = MigrationStats()
        if _allowed("assets", args.tables):
            await _process_assets(db, args, stats)
        if _allowed("storyboards", args.tables):
            await _process_storyboards(db, args, stats, project_users)
        if _allowed("subject_images", args.tables):
            await _process_subject_images(db, args, stats, subject_project_map, project_users)
        if _allowed("audio_clips", args.tables):
            await _process_audio_clips(db, args, stats)
        if _allowed("video_clips", args.tables):
            await _process_video_clips(db, args, stats)
        if _allowed("creation_shots", args.tables):
            await _process_creation_shots(db, args, stats, session_users)
        if _allowed("compositions", args.tables):
            await _process_compositions(db, args, stats, project_users)

        if args.dry_run:
            await db.rollback()
        else:
            await db.commit()

    print("Backfill finished")
    print(f"scanned={stats.scanned}")
    print(f"migrated={stats.migrated}")
    print(f"skipped={stats.skipped}")
    print(f"failed={stats.failed}")


if __name__ == "__main__":
    asyncio.run(main())
