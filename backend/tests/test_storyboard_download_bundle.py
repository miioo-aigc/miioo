import asyncio
import io
import json
import uuid
import zipfile
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.asset import Asset
from app.routers.storyboards import _build_storyboard_bundle_zip_response


class _FakeScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _FakeExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _FakeScalarResult(self._items)


class _FakeAsyncSession:
    def __init__(self, items):
        self._items = items

    async def execute(self, _query):
        return _FakeExecuteResult(self._items)


async def _collect_streaming_response_bytes(response):
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk)
    return b"".join(chunks)


def test_build_storyboard_bundle_zip_response_groups_files_by_storyboard(monkeypatch):
    project_id = uuid.uuid4()
    user_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()
    shot = SimpleNamespace(
        id=storyboard_id,
        project_id=project_id,
        shot_number=1,
        sort_order=0,
        created_at=datetime(2026, 6, 12, tzinfo=timezone.utc),
        image_url="/uploads/storyboards/demo-image.png",
        video_url="/uploads/storyboards/demo-video.mp4",
        gen_params=None,
    )
    image_asset = Asset(
        user_id=user_id,
        project_id=project_id,
        name="封面分镜图",
        asset_type="image",
        category="storyboard",
        file_url=shot.image_url,
        metadata_json={"storyboard_id": str(storyboard_id)},
    )
    video_asset = Asset(
        user_id=user_id,
        project_id=project_id,
        name="预览分镜视频",
        asset_type="video",
        category="storyboard",
        file_url=shot.video_url,
        metadata_json={"storyboard_id": str(storyboard_id)},
    )
    project = SimpleNamespace(id=project_id, name="测试项目")
    db = _FakeAsyncSession([video_asset, image_asset])

    async def fake_read_media_bytes(url: str, timeout: float) -> bytes:
        return f"payload:{url}:{timeout}".encode("utf-8")

    monkeypatch.setattr("app.routers.storyboards._read_media_bytes", fake_read_media_bytes)

    response = asyncio.run(
        _build_storyboard_bundle_zip_response(
            shots=[shot],
            project=project,
            user_id=user_id,
            db=db,
        )
    )
    archive_bytes = asyncio.run(_collect_streaming_response_bytes(response))
    archive = zipfile.ZipFile(io.BytesIO(archive_bytes))

    expected_image_path = "测试项目/镜头_01/images/镜头_01_分镜图.png"
    expected_video_path = "测试项目/镜头_01/videos/镜头_01_分镜视频.mp4"
    assert expected_image_path in archive.namelist()
    assert expected_video_path in archive.namelist()
    assert "测试项目/manifest.json" in archive.namelist()

    manifest = json.loads(archive.read("测试项目/manifest.json").decode("utf-8"))
    assert manifest["project_name"] == "测试项目"
    assert manifest["selected_storyboard_count"] == 1
    assert manifest["storyboard_count"] == 1
    assert manifest["items"][0]["archive_folder"] == "镜头_01"

    assets_by_role = {
        item["asset_role"]: item
        for item in manifest["items"][0]["assets"]
    }
    assert assets_by_role["storyboard_image"]["display_name"] == "封面分镜图"
    assert assets_by_role["storyboard_image"]["archive_path"] == expected_image_path
    assert assets_by_role["storyboard_video"]["display_name"] == "预览分镜视频"
    assert assets_by_role["storyboard_video"]["archive_path"] == expected_video_path


def test_build_storyboard_bundle_zip_response_raises_when_no_assets(monkeypatch):
    project_id = uuid.uuid4()
    user_id = uuid.uuid4()
    shot = SimpleNamespace(
        id=uuid.uuid4(),
        project_id=project_id,
        shot_number=1,
        sort_order=0,
        created_at=datetime(2026, 6, 12, tzinfo=timezone.utc),
        image_url=None,
        video_url=None,
        gen_params=None,
    )
    project = SimpleNamespace(id=project_id, name="空项目")
    db = _FakeAsyncSession([])

    async def fake_read_media_bytes(url: str, timeout: float) -> bytes:
        return b"unused"

    monkeypatch.setattr("app.routers.storyboards._read_media_bytes", fake_read_media_bytes)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            _build_storyboard_bundle_zip_response(
                shots=[shot],
                project=project,
                user_id=user_id,
                db=db,
            )
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "所选分镜没有可下载的资源"
