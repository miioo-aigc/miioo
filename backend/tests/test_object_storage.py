from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest

from app.config import settings
from app.routers.creation import _persist_one_creation_image
from app.services.object_storage import (
    object_storage_write_enabled,
    sync_managed_image_bundle_to_object_storage,
    upload_managed_file_to_object_storage,
)


class _FakeCosClient:
    def __init__(self):
        self.calls = []

    def put_object(self, **kwargs):
        body = kwargs["Body"].read()
        self.calls.append(
            {
                "Bucket": kwargs["Bucket"],
                "Key": kwargs["Key"],
                "ContentType": kwargs["ContentType"],
                "Body": body,
            }
        )


class _FakeAsyncSession:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        return None


def _configure_object_storage(monkeypatch, tmp_path: Path):
    upload_root = tmp_path / "uploads"
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_root))
    monkeypatch.setattr(settings, "MEDIA_STORAGE_MODE", "hybrid")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_PROVIDER", "tencent_cos")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_REGION", "ap-beijing")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_ID", "sid")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_KEY", "skey")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_RAW", "miioob-1302811912")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW", "miioob-1302811912")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_BUCKET_DERIVED", "miioob-1302811912")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW", "raw")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW", "preview")
    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED", "derived")
    return upload_root


def test_object_storage_write_enabled_requires_runtime_settings(monkeypatch, tmp_path):
    _configure_object_storage(monkeypatch, tmp_path)
    assert object_storage_write_enabled() is True

    monkeypatch.setattr(settings, "MEDIA_OBJECT_STORAGE_SECRET_KEY", "")
    assert object_storage_write_enabled() is False


def test_upload_managed_file_to_object_storage_uses_bucket_and_prefix(monkeypatch, tmp_path):
    upload_root = _configure_object_storage(monkeypatch, tmp_path)
    source_path = upload_root / "creation" / "global" / "images" / "demo.png"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    source_path.write_bytes(b"png-bytes")

    fake_client = _FakeCosClient()
    monkeypatch.setattr("app.services.object_storage._build_client", lambda: fake_client)

    uploaded = upload_managed_file_to_object_storage(
        "/uploads/creation/global/images/demo.png",
        kind="raw",
    )

    assert uploaded.bucket == "miioob-1302811912"
    assert uploaded.key == "raw/creation/global/images/demo.png"
    assert uploaded.public_url == "https://miioob-1302811912.cos.ap-beijing.myqcloud.com/raw/creation/global/images/demo.png"
    assert fake_client.calls == [
        {
            "Bucket": "miioob-1302811912",
            "Key": "raw/creation/global/images/demo.png",
            "ContentType": "image/png",
            "Body": b"png-bytes",
        }
    ]


def test_sync_managed_image_bundle_to_object_storage_returns_nested_metadata(monkeypatch, tmp_path):
    upload_root = _configure_object_storage(monkeypatch, tmp_path)
    for relative_path, content in {
        "creation/global/images/origin.png": b"origin",
        "derived/assets/preview/preview.avif": b"preview",
        "derived/assets/card_square/thumb.avif": b"thumb",
    }.items():
        file_path = upload_root / relative_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(content)

    fake_client = _FakeCosClient()
    monkeypatch.setattr("app.services.object_storage._build_client", lambda: fake_client)

    metadata = sync_managed_image_bundle_to_object_storage(
        source_url="/uploads/creation/global/images/origin.png",
        preview_url="/uploads/derived/assets/preview/preview.avif",
        thumbnail_url="/uploads/derived/assets/card_square/thumb.avif",
    )

    sync_payload = metadata["object_storage_sync"]
    assert sync_payload["provider"] == "tencent_cos"
    assert set(sync_payload["objects"]) == {"origin", "preview", "thumbnail"}
    assert sync_payload["objects"]["preview"]["key"] == "preview/derived/assets/preview/preview.avif"
    assert sync_payload["objects"]["thumbnail"]["key"] == "derived/derived/assets/card_square/thumb.avif"
    assert len(fake_client.calls) == 3


@pytest.mark.anyio
async def test_persist_one_creation_image_includes_object_storage_sync_metadata(monkeypatch):
    async def _fake_persist_remote_file(url, subdir, fallback_extension=".png"):
        return "/uploads/creation/global/images/persisted.png"

    monkeypatch.setattr("app.routers.creation.persist_remote_file", _fake_persist_remote_file)
    monkeypatch.setattr(
        "app.routers.creation._derive_asset_thumbnail",
        lambda url, asset_type="image": (
            "/uploads/derived/assets/card_square/thumb.avif",
            {"thumbnail_variant": "card_square"},
        ),
    )
    monkeypatch.setattr(
        "app.routers.creation._derive_asset_preview",
        lambda url: (
            "/uploads/derived/assets/preview/preview.avif",
            {"preview_variant": "preview_contain"},
        ),
    )
    monkeypatch.setattr(
        "app.routers.creation.sync_managed_image_bundle_to_object_storage",
        lambda **kwargs: {
            "object_storage_sync": {
                "provider": "tencent_cos",
                "objects": {
                    "origin": {
                        "bucket": "miioob-1302811912",
                        "key": "raw/creation/global/images/persisted.png",
                        "url": "https://example.com/raw/creation/global/images/persisted.png",
                    }
                },
            }
        },
    )

    fake_db = _FakeAsyncSession()
    result = await _persist_one_creation_image(
        db=fake_db,
        url="https://cdn.example.com/result.png",
        index=1,
        user_id=uuid4(),
        project_id=None,
        session_id=None,
        shot_id=None,
        shot=None,
        final_prompt="最终提示词",
        prompt="原始提示词",
        prompt_raw="原始提示词",
        model="doubao-seedream-5.0-lite",
        size="2K",
        aspect_ratio="1:1",
        resolution="2K",
        reference_images=[],
        mentions=[],
        attachments=[],
        watermark=False,
        inherit_project_style=False,
        save_to_assets=True,
        asset_name="测试图片",
        category="reference",
        source="creation_image",
        task_id=uuid4(),
        count=1,
    )

    assert result["success"] is True
    assert len(fake_db.added) == 1
    asset = fake_db.added[0]
    assert asset.metadata_json["object_storage_sync"]["provider"] == "tencent_cos"
    assert asset.metadata_json["object_storage_sync"]["objects"]["origin"]["key"] == "raw/creation/global/images/persisted.png"
