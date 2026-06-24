import logging

from app.services.media_download_audit import audit_media_download


def test_audit_media_download_logs_success_context(caplog):
    with caplog.at_level(logging.INFO, logger="app.media_download"):
        audit_media_download(
            event="controlled_download",
            outcome="redirected",
            user_id="user-1",
            payload={
                "project_id": "project-1",
                "resource_id": "asset-1",
                "access_level": "controlled_download",
                "storage_mode": "managed_upload",
                "storage_key": "videos/source.mp4",
            },
            download_url="/api/media/downloads/demo-token",
            resolved_target="/uploads/videos/source.mp4",
            context={"delivery_mode": "redirect", "controlled": True},
        )

    assert "event=controlled_download" in caplog.text
    assert "outcome=redirected" in caplog.text
    assert "user_id=user-1" in caplog.text
    assert "project_id=project-1" in caplog.text
    assert "storage_key=videos/source.mp4" in caplog.text
    assert "delivery_mode=redirect" in caplog.text


def test_audit_media_download_logs_warning_for_forbidden(caplog):
    with caplog.at_level(logging.WARNING, logger="app.media_download"):
        audit_media_download(
            event="download_target_resolve",
            outcome="forbidden",
            user_id="user-2",
            payload={"resource_id": "asset-1"},
            download_url="/api/media/downloads/demo-token",
            detail="当前用户无权访问该下载资源",
            context={"delivery_mode": "internal_resolve", "controlled": True},
        )

    assert "outcome=forbidden" in caplog.text
    assert "resource_id=asset-1" in caplog.text
    assert "当前用户无权访问该下载资源" in caplog.text
