import logging

import pytest

from app.services import media_delivery_urls
from app.services.media_download_runtime import (
    MediaDownloadAccessError,
    is_controlled_download_url,
    resolve_verified_download_target_from_url,
)
from app.services.media_download_signing import issue_download_token


def test_is_controlled_download_url_detects_media_route():
    assert is_controlled_download_url("/api/media/downloads/demo-token") is True
    assert is_controlled_download_url("/uploads/images/demo.png") is False


def test_resolve_verified_download_target_from_url_returns_passthrough_for_raw_url():
    assert (
        resolve_verified_download_target_from_url(
            "/uploads/images/demo.png",
            expected_user_id="user-1",
        )
        == "/uploads/images/demo.png"
    )


def test_resolve_verified_download_target_from_url_resolves_controlled_token():
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="images/demo.png",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/images/demo.png",
    )

    target = resolve_verified_download_target_from_url(
        f"/api/media/downloads/{token}",
        expected_user_id="user-1",
    )

    assert target == "/uploads/images/demo.png"


def test_resolve_verified_download_target_from_url_resolves_object_storage_token(monkeypatch):
    monkeypatch.setattr(
        media_delivery_urls.settings,
        "MEDIA_PUBLIC_BASE_URL",
        "https://www.miiooai.com/media/origin",
        raising=False,
    )

    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="private/videos/demo.mov",
        access_level="controlled_download",
        storage_mode="object_storage",
        storage_bucket="media-private",
        download_url=None,
    )

    target = resolve_verified_download_target_from_url(
        f"/api/media/downloads/{token}",
        expected_user_id="user-1",
    )

    assert target == "https://www.miiooai.com/media/origin/media-private/private/videos/demo.mov"


def test_resolve_verified_download_target_from_url_logs_success_audit(caplog):
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="images/demo.png",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/images/demo.png",
    )

    with caplog.at_level(logging.INFO, logger="app.media_download"):
        target = resolve_verified_download_target_from_url(
            f"/api/media/downloads/{token}",
            expected_user_id="user-1",
        )

    assert target == "/uploads/images/demo.png"
    assert "event=download_target_resolve" in caplog.text
    assert "outcome=resolved" in caplog.text
    assert "resource_id=asset-1" in caplog.text


def test_resolve_verified_download_target_from_url_rejects_user_mismatch():
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="images/demo.png",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/images/demo.png",
    )

    with pytest.raises(MediaDownloadAccessError, match="无权访问"):
        resolve_verified_download_target_from_url(
            f"/api/media/downloads/{token}",
            expected_user_id="user-2",
        )


def test_resolve_verified_download_target_from_url_logs_passthrough_for_raw_url(caplog):
    with caplog.at_level(logging.INFO, logger="app.media_download"):
        target = resolve_verified_download_target_from_url(
            "/uploads/images/demo.png",
            expected_user_id="user-1",
        )

    assert target == "/uploads/images/demo.png"
    assert "outcome=passthrough" in caplog.text
    assert "delivery_mode=legacy_direct" in caplog.text
