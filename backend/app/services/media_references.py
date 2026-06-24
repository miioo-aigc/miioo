from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.composition import Composition
from app.models.creation_shot import CreationShot
from app.models.storyboard import Storyboard
from app.models.subject_image import SubjectImage
from app.models.video_clip import VideoClip
from app.services.media_storage import delete_managed_upload, is_managed_upload_url


async def count_media_url_references(
    db: AsyncSession,
    url: str | None,
    *,
    excluding_asset_id: UUID | None = None,
    excluding_creation_shot_id: UUID | None = None,
) -> int:
    if not url:
        return 0

    total = 0

    asset_query = select(Asset).where(
        or_(
            Asset.file_url == url,
            Asset.thumbnail_url == url,
        )
    )
    if excluding_asset_id is not None:
        asset_query = asset_query.where(Asset.id != excluding_asset_id)
    asset_rows = (await db.execute(asset_query)).scalars().all()
    total += len(asset_rows)

    asset_reference_rows = (
        await db.execute(select(Asset).where(Asset.reference_image_urls.is_not(None)))
    ).scalars().all()
    for asset in asset_reference_rows:
        if excluding_asset_id is not None and asset.id == excluding_asset_id:
            continue
        if url in (asset.reference_image_urls or []):
            total += 1

    shot_query = select(CreationShot).where(
        or_(
            CreationShot.image_url == url,
            CreationShot.audio_url == url,
            CreationShot.video_url == url,
        )
    )
    if excluding_creation_shot_id is not None:
        shot_query = shot_query.where(CreationShot.id != excluding_creation_shot_id)
    shot_rows = (await db.execute(shot_query)).scalars().all()
    total += len(shot_rows)

    shot_reference_rows = (
        await db.execute(select(CreationShot).where(CreationShot.reference_image_urls.is_not(None)))
    ).scalars().all()
    for shot in shot_reference_rows:
        if excluding_creation_shot_id is not None and shot.id == excluding_creation_shot_id:
            continue
        if url in (shot.reference_image_urls or []):
            total += 1

    total += len((await db.execute(select(Storyboard).where(Storyboard.image_url == url))).scalars().all())
    total += len((await db.execute(select(Storyboard).where(Storyboard.video_url == url))).scalars().all())
    total += len((await db.execute(select(SubjectImage).where(SubjectImage.image_url == url))).scalars().all())
    total += len((await db.execute(select(AudioClip).where(AudioClip.audio_url == url))).scalars().all())
    total += len((await db.execute(select(VideoClip).where(VideoClip.video_url == url))).scalars().all())
    total += len((await db.execute(select(Composition).where(Composition.output_url == url))).scalars().all())

    return total


async def delete_managed_upload_if_unreferenced(
    db: AsyncSession,
    url: str | None,
    *,
    excluding_asset_id: UUID | None = None,
    excluding_creation_shot_id: UUID | None = None,
) -> bool:
    if not is_managed_upload_url(url):
        return False

    reference_count = await count_media_url_references(
        db,
        url,
        excluding_asset_id=excluding_asset_id,
        excluding_creation_shot_id=excluding_creation_shot_id,
    )
    if reference_count > 0:
        return False

    return delete_managed_upload(url)
