import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import async_session
from app.models.asset import Asset
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.utils.media_urls import is_video_like_url, pick_safe_thumbnail_url


@dataclass
class BackfillStats:
    storyboard_scanned: int = 0
    storyboard_fixed: int = 0
    storyboard_skipped: int = 0
    asset_scanned: int = 0
    asset_fixed: int = 0
    asset_skipped: int = 0
    failed: int = 0


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="回填分镜视频错误缩略图")
    parser.add_argument("--dry-run", action="store_true", help="只扫描不写库")
    parser.add_argument("--project-id", default=None, help="仅处理指定项目")
    parser.add_argument("--user-id", default=None, help="仅处理指定用户")
    return parser.parse_args()


def _build_storyboard_thumbnail_fallback(storyboard: Storyboard) -> str | None:
    gen_params = storyboard.gen_params if isinstance(storyboard.gen_params, dict) else {}
    return pick_safe_thumbnail_url(
        gen_params.get("video_thumbnail_url"),
        storyboard.image_url,
    )


async def _backfill_storyboards(db, args: argparse.Namespace, stats: BackfillStats, project_users: dict[str, str]) -> dict[str, Storyboard]:
    result = await db.execute(select(Storyboard))
    storyboards = result.scalars().all()
    storyboard_map: dict[str, Storyboard] = {}
    for storyboard in storyboards:
        storyboard_map[str(storyboard.id)] = storyboard
        project_id = str(storyboard.project_id)
        if args.project_id and project_id != args.project_id:
            continue
        if args.user_id and project_users.get(project_id) != args.user_id:
            continue

        gen_params = storyboard.gen_params if isinstance(storyboard.gen_params, dict) else {}
        current_thumbnail = gen_params.get("video_thumbnail_url")
        if not current_thumbnail:
            continue

        stats.storyboard_scanned += 1
        if not is_video_like_url(current_thumbnail):
            stats.storyboard_skipped += 1
            continue

        fallback = _build_storyboard_thumbnail_fallback(storyboard)
        if args.dry_run:
            print(
                f"[storyboard] {storyboard.id} invalid={current_thumbnail} "
                f"fallback={fallback or '<clear>'}"
            )
            stats.storyboard_fixed += 1
            continue

        next_gen_params = dict(gen_params)
        if fallback:
            next_gen_params["video_thumbnail_url"] = fallback
        else:
            next_gen_params.pop("video_thumbnail_url", None)
        storyboard.gen_params = next_gen_params or None
        stats.storyboard_fixed += 1
    return storyboard_map


async def _backfill_storyboard_video_assets(
    db,
    args: argparse.Namespace,
    stats: BackfillStats,
    storyboard_map: dict[str, Storyboard],
) -> None:
    result = await db.execute(select(Asset).where(Asset.asset_type == "video", Asset.category == "storyboard"))
    for asset in result.scalars().all():
        if args.project_id and str(asset.project_id or "") != args.project_id:
            continue
        if args.user_id and str(asset.user_id) != args.user_id:
            continue

        metadata = dict(asset.metadata_json or {})
        current_asset_thumbnail = asset.thumbnail_url
        current_metadata_thumbnail = metadata.get("thumbnail_url")
        if not is_video_like_url(current_asset_thumbnail) and not is_video_like_url(current_metadata_thumbnail):
            continue

        stats.asset_scanned += 1
        storyboard = storyboard_map.get(str(metadata.get("storyboard_id"))) if metadata.get("storyboard_id") else None
        fallback = pick_safe_thumbnail_url(
            metadata.get("auto_thumbnail_url"),
            storyboard.image_url if storyboard else None,
        )

        if args.dry_run:
            print(
                f"[asset] {asset.id} invalid_asset={current_asset_thumbnail or '<none>'} "
                f"invalid_meta={current_metadata_thumbnail or '<none>'} "
                f"fallback={fallback or '<clear>'}"
            )
            stats.asset_fixed += 1
            continue

        asset.thumbnail_url = fallback
        if fallback:
            metadata["thumbnail_url"] = fallback
        else:
            metadata.pop("thumbnail_url", None)
        asset.metadata_json = metadata or None
        stats.asset_fixed += 1


async def main() -> None:
    args = _parse_args()
    stats = BackfillStats()

    async with async_session() as db:
        project_rows = (await db.execute(select(Project.id, Project.user_id))).all()
        project_users = {str(project_id): str(user_id) for project_id, user_id in project_rows}

        try:
            storyboard_map = await _backfill_storyboards(db, args, stats, project_users)
            await _backfill_storyboard_video_assets(db, args, stats, storyboard_map)
        except Exception as exc:
            stats.failed += 1
            if args.dry_run:
                await db.rollback()
            else:
                await db.rollback()
            raise exc

        if args.dry_run:
            await db.rollback()
        else:
            await db.commit()

    print("Storyboard thumbnail backfill finished")
    print(f"storyboard_scanned={stats.storyboard_scanned}")
    print(f"storyboard_fixed={stats.storyboard_fixed}")
    print(f"storyboard_skipped={stats.storyboard_skipped}")
    print(f"asset_scanned={stats.asset_scanned}")
    print(f"asset_fixed={stats.asset_fixed}")
    print(f"asset_skipped={stats.asset_skipped}")
    print(f"failed={stats.failed}")


if __name__ == "__main__":
    asyncio.run(main())
