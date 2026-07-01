import asyncio
import uuid

import pytest
from sqlalchemy import select

from app.models.live_material_asset import LiveMaterialAsset
from app.models.live_material_group import LiveMaterialGroup
from app.services.live_material_runtime import (
    LIVE_MATERIAL_GROUP_TYPE,
    create_live_material_asset,
    normalize_live_material_provider_params,
    refresh_live_material_asset_status,
    resolve_live_material_attachments,
)


class _FakeExecuteResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeAsyncSession:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _query):
        return _FakeExecuteResult(self._rows)


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeMutationSession:
    def __init__(self, existing_asset=None):
        self.existing_asset = existing_asset
        self.added = []
        self.commits = 0
        self.refreshed = []

    async def execute(self, _query):
        return _FakeScalarResult(self.existing_asset)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1

    async def refresh(self, obj):
        self.refreshed.append(obj)


class _FakeHttpResponse:
    def __init__(self, payload):
        self._payload = payload
        self.text = str(payload)

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeUpstreamClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return _FakeHttpResponse(self.payload)


def test_normalize_live_material_provider_params_returns_clean_payload():
    group_id = str(uuid.uuid4())
    asset_a = str(uuid.uuid4())
    asset_b = str(uuid.uuid4())

    normalized = normalize_live_material_provider_params(
        {
            "live_material": {
                "group_id": f" {group_id} ",
                "asset_ids": ["", f" {asset_a} ", None, asset_b],
                "group_type": "",
            }
        }
    )

    assert normalized == {
        "group_id": group_id,
        "asset_ids": [asset_a, asset_b],
        "group_type": LIVE_MATERIAL_GROUP_TYPE,
    }


def test_resolve_live_material_attachments_builds_seedance_asset_refs():
    user_id = uuid.uuid4()
    group_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=group_id,
        user_id=user_id,
        upstream_group_id="group-upstream-001",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )
    asset = LiveMaterialAsset(
        id=asset_id,
        user_id=user_id,
        group_id=group_id,
        upstream_asset_id="asset-upstream-001",
        asset_type="image",
        name="真人主图",
        status="Active",
    )
    db = _FakeAsyncSession([(asset, group)])

    resolved_meta, attachments = asyncio.run(
        resolve_live_material_attachments(
            user_id=user_id,
            db=db,
            provider_params={
                "live_material": {
                    "group_id": str(group_id),
                    "asset_ids": [str(asset_id)],
                    "group_type": LIVE_MATERIAL_GROUP_TYPE,
                }
            },
        )
    )

    assert resolved_meta == {
        "group_id": str(group_id),
        "asset_ids": [str(asset_id)],
        "group_type": LIVE_MATERIAL_GROUP_TYPE,
    }
    assert attachments == [
        {
            "asset_id": str(asset_id),
            "asset_type": "image",
            "asset_name": "真人主图",
            "url": "asset://asset-upstream-001",
            "role": "reference_image",
            "source": "live_material",
        }
    ]


def test_resolve_live_material_attachments_rejects_non_active_assets():
    user_id = uuid.uuid4()
    group_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=group_id,
        user_id=user_id,
        upstream_group_id="group-upstream-002",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )
    asset = LiveMaterialAsset(
        id=asset_id,
        user_id=user_id,
        group_id=group_id,
        upstream_asset_id="asset-upstream-002",
        asset_type="video",
        name="真人视频",
        status="Processing",
    )
    db = _FakeAsyncSession([(asset, group)])

    with pytest.raises(ValueError, match="Active"):
        asyncio.run(
            resolve_live_material_attachments(
                user_id=user_id,
                db=db,
                provider_params={
                    "live_material": {
                        "group_id": str(group_id),
                        "asset_ids": [str(asset_id)],
                    }
                },
            )
        )


def test_resolve_live_material_attachments_rejects_group_mismatch():
    user_id = uuid.uuid4()
    real_group_id = uuid.uuid4()
    requested_group_id = uuid.uuid4()
    asset_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=real_group_id,
        user_id=user_id,
        upstream_group_id="group-upstream-003",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )
    asset = LiveMaterialAsset(
        id=asset_id,
        user_id=user_id,
        group_id=real_group_id,
        upstream_asset_id="asset-upstream-003",
        asset_type="audio",
        name="真人音频",
        status="Active",
    )
    db = _FakeAsyncSession([(asset, group)])

    with pytest.raises(ValueError, match="真人素材组不一致"):
        asyncio.run(
            resolve_live_material_attachments(
                user_id=user_id,
                db=db,
                provider_params={
                    "live_material": {
                        "group_id": str(requested_group_id),
                        "asset_ids": [str(asset_id)],
                    }
                },
            )
        )


def test_create_live_material_asset_merges_upload_metadata(monkeypatch):
    user_id = uuid.uuid4()
    group_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=group_id,
        user_id=user_id,
        upstream_group_id="group-upstream-merge",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )
    fake_client = _FakeUpstreamClient({"Result": {"AssetId": "asset-upstream-merge"}})
    db = _FakeMutationSession()

    async def _fake_credentials(*_args, **_kwargs):
        return "api-key", "https://onelink.example.com"

    monkeypatch.setattr("app.services.live_material_runtime._resolve_onelink_credentials", _fake_credentials)
    monkeypatch.setattr(
        "app.services.live_material_runtime.upstream_async_client",
        lambda **_kwargs: fake_client,
    )

    asset = asyncio.run(
        create_live_material_asset(
            user_id=user_id,
            db=db,
            group=group,
            url="https://cdn.example.com/raw/live-materials/demo.png",
            asset_type="image",
            name="真人主图",
            extra_metadata={
                "upload": {
                    "uploaded_via": "live_material_upload",
                    "managed_url": "/uploads/live-materials/demo.png",
                    "object_storage": {
                        "bucket": "miioob-1302811912",
                        "key": "raw/live-materials/demo.png",
                        "public_url": "https://cdn.example.com/raw/live-materials/demo.png",
                    },
                }
            },
        )
    )

    assert db.commits == 1
    assert asset in db.added
    assert asset.source_url == "https://cdn.example.com/raw/live-materials/demo.png"
    assert asset.metadata_json["upload"]["managed_url"] == "/uploads/live-materials/demo.png"
    assert asset.metadata_json["upload"]["object_storage"]["key"] == "raw/live-materials/demo.png"
    assert asset.metadata_json["create_asset_result"]["AssetId"] == "asset-upstream-merge"


def test_refresh_live_material_asset_status_preserves_existing_upload_metadata(monkeypatch):
    user_id = uuid.uuid4()
    asset = LiveMaterialAsset(
        id=uuid.uuid4(),
        user_id=user_id,
        group_id=uuid.uuid4(),
        upstream_asset_id="asset-upstream-refresh",
        asset_type="video",
        name="真人视频",
        status="Processing",
        source_url="https://cdn.example.com/raw/live-materials/demo.mov",
        preview_url="https://cdn.example.com/raw/live-materials/demo.mov",
        metadata_json={
            "upload": {
                "uploaded_via": "live_material_upload",
                "managed_url": "/uploads/live-materials/demo.mov",
                "object_storage": {
                    "bucket": "miioob-1302811912",
                    "key": "raw/live-materials/demo.mov",
                    "public_url": "https://cdn.example.com/raw/live-materials/demo.mov",
                },
            }
        },
    )
    fake_client = _FakeUpstreamClient(
        {
            "Result": {
                "Status": "Active",
                "PreviewURL": "https://cdn.example.com/preview/live-materials/demo.mov",
            }
        }
    )
    db = _FakeMutationSession(existing_asset=asset)

    async def _fake_credentials(*_args, **_kwargs):
        return "api-key", "https://onelink.example.com"

    monkeypatch.setattr("app.services.live_material_runtime._resolve_onelink_credentials", _fake_credentials)
    monkeypatch.setattr(
        "app.services.live_material_runtime.upstream_async_client",
        lambda **_kwargs: fake_client,
    )

    refreshed_asset = asyncio.run(
        refresh_live_material_asset_status(
            user_id=user_id,
            db=db,
            asset=asset,
        )
    )

    assert db.commits == 1
    assert refreshed_asset.status == "Active"
    assert refreshed_asset.preview_url == "https://cdn.example.com/preview/live-materials/demo.mov"
    assert refreshed_asset.metadata_json["upload"]["managed_url"] == "/uploads/live-materials/demo.mov"
    assert refreshed_asset.metadata_json["get_asset_result"]["Status"] == "Active"
