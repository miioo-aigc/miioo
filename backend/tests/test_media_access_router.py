import logging
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.dependencies import get_current_user
from app.routers.media_access import router
from app.services.media_download_signing import issue_download_token


def _build_client(*, user_id: str = "user-1") -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/media")

    async def _override_current_user():
        return SimpleNamespace(id=user_id)

    app.dependency_overrides[get_current_user] = _override_current_user
    return TestClient(app)


def test_media_access_router_redirects_to_local_upload():
    client = _build_client()
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="videos/source.mp4",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/videos/source.mp4",
    )

    response = client.get(f"/api/media/downloads/{token}", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/uploads/videos/source.mp4"


def test_media_access_router_logs_redirect_audit(caplog):
    client = _build_client()
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="videos/source.mp4",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/videos/source.mp4",
    )

    with caplog.at_level(logging.INFO, logger="app.media_download"):
        response = client.get(f"/api/media/downloads/{token}", follow_redirects=False)

    assert response.status_code == 302
    assert "event=controlled_download" in caplog.text
    assert "outcome=redirected" in caplog.text
    assert "resource_id=asset-1" in caplog.text


def test_media_access_router_rejects_other_user_token():
    client = _build_client(user_id="user-2")
    token = issue_download_token(
        user_id="user-1",
        project_id="project-1",
        resource_id="asset-1",
        storage_key="videos/source.mp4",
        access_level="controlled_download",
        storage_mode="managed_upload",
        download_url="/uploads/videos/source.mp4",
    )

    response = client.get(f"/api/media/downloads/{token}", follow_redirects=False)

    assert response.status_code == 403
