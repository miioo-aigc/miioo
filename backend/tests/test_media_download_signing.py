import pytest

from app.services import media_download_signing
from app.services.media_download_signing import (
    MediaDownloadTokenError,
    issue_download_token,
    verify_download_token,
)


def test_issue_and_verify_download_token(monkeypatch):
    monkeypatch.setattr(media_download_signing.settings, "MEDIA_DOWNLOAD_TOKEN_SECRET", "media-secret")
    monkeypatch.setattr(media_download_signing.settings, "MEDIA_DOWNLOAD_TOKEN_EXPIRE_SECONDS", 300)

    token = issue_download_token(
        user_id="u-1",
        project_id="p-1",
        resource_id="asset-1",
        storage_key="raw/videos/source.mov",
        access_level="controlled_download",
    )

    payload = verify_download_token(token)

    assert payload["user_id"] == "u-1"
    assert payload["project_id"] == "p-1"
    assert payload["resource_id"] == "asset-1"
    assert payload["storage_key"] == "raw/videos/source.mov"
    assert payload["access_level"] == "controlled_download"
    assert payload["expires_at"] > payload["issued_at"]


def test_verify_download_token_rejects_expired_token(monkeypatch):
    monkeypatch.setattr(media_download_signing.settings, "MEDIA_DOWNLOAD_TOKEN_SECRET", "media-secret")
    monkeypatch.setattr(media_download_signing.settings, "MEDIA_DOWNLOAD_TOKEN_EXPIRE_SECONDS", 1)

    token = issue_download_token(
        user_id="u-1",
        project_id=None,
        resource_id="asset-1",
        storage_key="raw/videos/source.mov",
        access_level="controlled_download",
        expires_in=1,
    )

    original_time = media_download_signing.time.time
    monkeypatch.setattr(media_download_signing.time, "time", lambda: original_time() + 5)

    with pytest.raises(MediaDownloadTokenError, match="已过期"):
        verify_download_token(token)
