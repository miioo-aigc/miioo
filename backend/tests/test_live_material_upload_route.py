import uuid
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.dependencies import get_current_user
from app.models.live_material_asset import LiveMaterialAsset
from app.models.live_material_group import LiveMaterialGroup
from app.routers import live_materials
from app.routers.live_materials import router
from app.services.live_material_runtime import LIVE_MATERIAL_GROUP_TYPE


def _build_client(*, user_id=None) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/live-materials")

    async def _override_get_current_user():
        return SimpleNamespace(id=user_id or uuid.uuid4())

    async def _override_get_db():
        yield object()

    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def test_live_material_upload_route_returns_public_url(monkeypatch):
    user_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=uuid.uuid4(),
        user_id=user_id,
        upstream_group_id="group-upstream-upload",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )
    asset = LiveMaterialAsset(
        id=uuid.uuid4(),
        user_id=user_id,
        group_id=group.id,
        upstream_asset_id="asset-upstream-upload",
        asset_type="image",
        name="真人主图",
        status="Processing",
        source_url="https://cdn.example.com/raw/live-materials/demo.png",
        preview_url="https://cdn.example.com/raw/live-materials/demo.png",
    )

    async def _fake_get_group_or_404(group_id, *, user_id, db):
        return group

    async def _fake_create_live_material_asset(**kwargs):
        return asset

    async def _fake_persist_uploaded_file(*args, **kwargs):
        return "/uploads/live-materials/demo.png"

    monkeypatch.setattr(live_materials, "_get_group_or_404", _fake_get_group_or_404)
    monkeypatch.setattr(live_materials, "object_storage_write_enabled", lambda: True)
    monkeypatch.setattr(live_materials, "persist_uploaded_file", _fake_persist_uploaded_file)
    monkeypatch.setattr(
        live_materials,
        "upload_managed_file_to_object_storage",
        lambda *args, **kwargs: SimpleNamespace(
            bucket="miioob-1302811912",
            key="raw/live-materials/demo.png",
            public_url="https://cdn.example.com/raw/live-materials/demo.png",
        ),
    )
    monkeypatch.setattr(live_materials, "create_live_material_asset", _fake_create_live_material_asset)

    client = _build_client(user_id=user_id)
    response = client.post(
        f"/api/live-materials/groups/{group.id}/assets/upload",
        data={"asset_type": "image", "name": "真人主图"},
        files={"file": ("demo.png", b"fake-png", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source_url"] == "https://cdn.example.com/raw/live-materials/demo.png"
    assert body["preview_url"] == "https://cdn.example.com/raw/live-materials/demo.png"
    assert body["asset_type"] == "image"


def test_live_material_upload_route_rejects_when_object_storage_disabled(monkeypatch):
    user_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=uuid.uuid4(),
        user_id=user_id,
        upstream_group_id="group-upstream-disabled",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )

    async def _fake_get_group_or_404(group_id, *, user_id, db):
        return group

    monkeypatch.setattr(live_materials, "_get_group_or_404", _fake_get_group_or_404)
    monkeypatch.setattr(live_materials, "object_storage_write_enabled", lambda: False)

    client = _build_client(user_id=user_id)
    response = client.post(
        f"/api/live-materials/groups/{group.id}/assets/upload",
        data={"asset_type": "image"},
        files={"file": ("demo.png", b"fake-png", "image/png")},
    )

    assert response.status_code == 500
    assert "对象存储写入" in response.json()["detail"]


def test_live_material_upload_route_rejects_invalid_asset_type(monkeypatch):
    user_id = uuid.uuid4()
    group = LiveMaterialGroup(
        id=uuid.uuid4(),
        user_id=user_id,
        upstream_group_id="group-upstream-invalid-type",
        provider_type="onelink",
        group_type=LIVE_MATERIAL_GROUP_TYPE,
        auth_status="verified",
    )

    async def _fake_get_group_or_404(group_id, *, user_id, db):
        return group

    monkeypatch.setattr(live_materials, "_get_group_or_404", _fake_get_group_or_404)

    client = _build_client(user_id=user_id)
    response = client.post(
        f"/api/live-materials/groups/{group.id}/assets/upload",
        data={"asset_type": "audio"},
        files={"file": ("demo.mp3", b"fake-audio", "audio/mpeg")},
    )

    assert response.status_code == 400
    assert "image / video" in response.json()["detail"]
