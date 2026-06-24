from datetime import datetime
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import Base
from app.models.asset import Asset
from app.models.episode import Episode
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.user import User
from app.routers.assets import get_asset, list_assets
from app.routers.storyboards import _build_storyboard_asset_metadata


@pytest.mark.anyio
async def test_list_assets_backfills_episode_label_for_historical_storyboard_assets():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    Project.__table__,
                    Episode.__table__,
                    Storyboard.__table__,
                    Asset.__table__,
                ],
            )
        )

    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    episode_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()
    storyboard_asset_id = uuid.uuid4()
    manual_asset_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_200001",
            phone="13800000011",
            password_hash="hashed",
            nickname="tester",
        )
        project = Project(
            id=project_id,
            user_id=user_id,
            name="资产测试项目",
            visual_style="写实",
        )
        episode = Episode(
            id=episode_id,
            project_id=project_id,
            title="正式第一集",
            episode_number=1,
        )
        storyboard = Storyboard(
            id=storyboard_id,
            project_id=project_id,
            episode_id=episode_id,
            shot_number=3,
            content="镜头内容",
        )
        storyboard_asset = Asset(
            id=storyboard_asset_id,
            user_id=user_id,
            project_id=project_id,
            name="分镜图 #3",
            asset_type="image",
            category="storyboard",
            file_url="https://example.com/storyboard-3.png",
            thumbnail_url="https://example.com/storyboard-3-thumb.png",
            metadata_json={
                "storyboard_id": str(storyboard_id),
                "source": "storyboard_generate_image",
            },
            is_deleted=False,
            created_at=datetime(2026, 6, 17, 19, 0, 0),
        )
        manual_asset = Asset(
            id=manual_asset_id,
            user_id=user_id,
            project_id=project_id,
            name="普通图片",
            asset_type="image",
            category="reference",
            file_url="https://example.com/manual.png",
            thumbnail_url="https://example.com/manual-thumb.png",
            metadata_json={"source": "manual_asset_import"},
            is_deleted=False,
            created_at=datetime(2026, 6, 17, 18, 0, 0),
        )
        session.add_all([user, project, episode, storyboard, storyboard_asset, manual_asset])
        await session.commit()

        payload = await list_assets(
            project_id=str(project_id),
            scope=None,
            asset_type=None,
            category=None,
            is_starred=None,
            is_primary=None,
            search=None,
            include_deleted=False,
            deleted_only=False,
            limit=100,
            offset=0,
            cursor=None,
            user=user,
            db=session,
        )

        items_by_id = {item.id: item for item in payload.list}
        assert items_by_id[str(storyboard_asset_id)].episode_label == "第一集"
        assert items_by_id[str(storyboard_asset_id)].episodeLabel == "第一集"
        assert items_by_id[str(manual_asset_id)].episode_label is None
        assert items_by_id[str(manual_asset_id)].episodeLabel is None

    await engine.dispose()


@pytest.mark.anyio
async def test_list_assets_ignores_invalid_storyboard_id_metadata():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    Project.__table__,
                    Episode.__table__,
                    Storyboard.__table__,
                    Asset.__table__,
                ],
            )
        )

    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    valid_storyboard_id = uuid.uuid4()
    valid_asset_id = uuid.uuid4()
    invalid_asset_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_200001a",
            phone="13800000021",
            password_hash="hashed",
            nickname="tester",
        )
        project = Project(
            id=project_id,
            user_id=user_id,
            name="脏数据项目",
            visual_style="写实",
        )
        storyboard = Storyboard(
            id=valid_storyboard_id,
            project_id=project_id,
            episode_id=None,
            shot_number=1,
            content="镜头内容",
        )
        invalid_asset = Asset(
            id=invalid_asset_id,
            user_id=user_id,
            project_id=project_id,
            name="坏分镜元数据",
            asset_type="image",
            category="character",
            file_url="https://example.com/invalid.png",
            thumbnail_url="https://example.com/invalid-thumb.png",
            metadata_json={
                "storyboard_id": "legacy-storyboard-id",
                "source": "manual_asset_import",
            },
            is_deleted=False,
            created_at=datetime(2026, 6, 22, 10, 0, 0),
        )
        valid_asset = Asset(
            id=valid_asset_id,
            user_id=user_id,
            project_id=project_id,
            name="有效分镜元数据",
            asset_type="image",
            category="storyboard",
            file_url="https://example.com/valid.png",
            thumbnail_url="https://example.com/valid-thumb.png",
            metadata_json={
                "storyboard_id": str(valid_storyboard_id),
                "source": "storyboard_generate_image",
            },
            is_deleted=False,
            created_at=datetime(2026, 6, 22, 9, 0, 0),
        )
        session.add_all([user, project, storyboard, invalid_asset, valid_asset])
        await session.commit()

        payload = await list_assets(
            project_id=str(project_id),
            scope=None,
            asset_type=None,
            category=None,
            is_starred=None,
            is_primary=None,
            search=None,
            include_deleted=False,
            deleted_only=False,
            limit=100,
            offset=0,
            cursor=None,
            user=user,
            db=session,
        )

        items_by_id = {item.id: item for item in payload.list}
        assert items_by_id[str(invalid_asset_id)].episode_label is None
        assert items_by_id[str(valid_asset_id)].episode_label is None

    await engine.dispose()


@pytest.mark.anyio
async def test_get_asset_returns_episode_label_for_storyboard_video_asset():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    User.__table__,
                    Project.__table__,
                    Episode.__table__,
                    Storyboard.__table__,
                    Asset.__table__,
                ],
            )
        )

    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    episode_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()
    asset_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_200002",
            phone="13800000012",
            password_hash="hashed",
            nickname="tester",
        )
        project = Project(
            id=project_id,
            user_id=user_id,
            name="视频资产项目",
            visual_style="写实",
        )
        episode = Episode(
            id=episode_id,
            project_id=project_id,
            title="正式第二集",
            episode_number=2,
        )
        storyboard = Storyboard(
            id=storyboard_id,
            project_id=project_id,
            episode_id=episode_id,
            shot_number=8,
            content="镜头视频内容",
        )
        asset = Asset(
            id=asset_id,
            user_id=user_id,
            project_id=project_id,
            name="分镜视频 #8",
            asset_type="video",
            category="storyboard",
            file_url="https://example.com/storyboard-8.mp4",
            thumbnail_url="https://example.com/storyboard-8-poster.png",
            metadata_json={
                "storyboard_id": str(storyboard_id),
                "source": "storyboard_video_upload",
            },
            is_deleted=False,
            created_at=datetime(2026, 6, 17, 20, 0, 0),
        )
        session.add_all([user, project, episode, storyboard, asset])
        await session.commit()

        detail = await get_asset(
            asset_id=str(asset_id),
            user=user,
            db=session,
        )

        assert detail.episode_label == "第二集"
        assert detail.episodeLabel == "第二集"

    await engine.dispose()


@pytest.mark.anyio
async def test_storyboard_asset_metadata_includes_episode_fields():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[User.__table__, Project.__table__, Episode.__table__, Storyboard.__table__],
            )
        )

    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    episode_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()

    async with session_factory() as session:
        user = User(
            id=user_id,
            display_id="miioo_200003",
            phone="13800000013",
            password_hash="hashed",
            nickname="tester",
        )
        project = Project(
            id=project_id,
            user_id=user_id,
            name="metadata 项目",
            visual_style="写实",
        )
        episode = Episode(
            id=episode_id,
            project_id=project_id,
            title="正式第三集",
            episode_number=3,
        )
        storyboard = Storyboard(
            id=storyboard_id,
            project_id=project_id,
            episode_id=episode_id,
            shot_number=12,
            content="元数据镜头",
        )
        session.add_all([user, project, episode, storyboard])
        await session.commit()

        metadata = await _build_storyboard_asset_metadata(
            session,
            storyboard,
            extra={"source": "storyboard_generate_image"},
        )

        assert metadata["storyboard_id"] == str(storyboard_id)
        assert metadata["shot_number"] == 12
        assert metadata["episode_id"] == str(episode_id)
        assert metadata["episode_number"] == 3
        assert metadata["episode_title"] == "正式第三集"
        assert metadata["episode_label"] == "第三集"
        assert metadata["source"] == "storyboard_generate_image"

    await engine.dispose()
