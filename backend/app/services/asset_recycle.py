from datetime import datetime

from sqlalchemy import Select

from app.models.asset import Asset


def apply_asset_visibility(
    query: Select,
    *,
    include_deleted: bool = False,
    deleted_only: bool = False,
) -> Select:
    if deleted_only:
        return query.where(Asset.is_deleted.is_(True))
    if include_deleted:
        return query
    return query.where(Asset.is_deleted.is_(False))


def mark_asset_deleted(asset: Asset) -> bool:
    if asset.is_deleted:
        return False
    asset.is_deleted = True
    asset.deleted_at = datetime.utcnow()
    return True


def restore_asset(asset: Asset) -> bool:
    if not asset.is_deleted:
        return False
    asset.is_deleted = False
    asset.deleted_at = None
    return True
