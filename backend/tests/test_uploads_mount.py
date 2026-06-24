from fastapi.routing import Mount

from app.main import create_app, settings


def _has_upload_mount(app) -> bool:
    return any(isinstance(route, Mount) and route.path == "/uploads" for route in app.routes)


def test_create_app_mounts_uploads_in_non_production(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setattr(settings, "SERVE_UPLOADS_VIA_APP", False)

    app = create_app()

    assert _has_upload_mount(app) is True


def test_create_app_skips_upload_mount_in_production_when_disabled(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(settings, "SERVE_UPLOADS_VIA_APP", False)

    app = create_app()

    assert _has_upload_mount(app) is False
