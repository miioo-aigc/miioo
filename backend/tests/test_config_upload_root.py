from pathlib import Path

import pytest

from app.config import Settings


class _TestSettings(Settings):
    @property
    def backend_dir(self) -> Path:
        return self._backend_dir_override


def _build_settings(tmp_path: Path, **kwargs) -> _TestSettings:
    settings = _TestSettings(
        _env_file=None,
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test",
        SECRET_KEY="test-secret",
        ENCRYPTION_KEY="0123456789abcdef0123456789abcdef",
        **kwargs,
    )
    settings._backend_dir_override = tmp_path
    return settings


def test_upload_root_falls_back_to_local_uploads_in_non_production(monkeypatch, tmp_path):
    monkeypatch.delenv("APP_ENV", raising=False)
    original_mkdir = Path.mkdir

    def _fake_mkdir(self, *args, **kwargs):
        if str(self).startswith("/www/"):
            raise OSError(30, "Read-only file system")
        return original_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", _fake_mkdir)
    settings = _build_settings(tmp_path, UPLOAD_DIR="/www/wwwroot/miiooaib.com/backend/uploads")

    upload_root = settings.upload_root

    assert upload_root == (tmp_path / "uploads").resolve()
    assert upload_root.exists()


def test_upload_root_raises_in_production_when_configured_dir_is_unwritable(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "production")
    original_mkdir = Path.mkdir

    def _fake_mkdir(self, *args, **kwargs):
        if str(self).startswith("/www/"):
            raise OSError(30, "Read-only file system")
        return original_mkdir(self, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", _fake_mkdir)
    settings = _build_settings(tmp_path, UPLOAD_DIR="/www/wwwroot/miiooaib.com/backend/uploads")

    with pytest.raises(RuntimeError, match="UPLOAD_DIR"):
        _ = settings.upload_root


def test_effective_public_base_url_prefers_active_runtime_tunnel_file(monkeypatch, tmp_path):
    settings = _build_settings(
        tmp_path,
        PUBLIC_BASE_URL="https://mapping-investigated-knowledgestorm-ethics.trycloudflare.com",
    )
    runtime_dir = tmp_path / ".runtime"
    runtime_dir.mkdir()
    (runtime_dir / "cloudflared_public_url").write_text(
        "https://accessories-outlined-trying-advertisers.trycloudflare.com\n",
        encoding="utf-8",
    )
    (runtime_dir / "cloudflared.pid").write_text("12345\n", encoding="utf-8")

    monkeypatch.setattr("app.config.os.kill", lambda pid, sig: None)

    assert (
        settings.effective_public_base_url
        == "https://accessories-outlined-trying-advertisers.trycloudflare.com"
    )


def test_effective_public_base_url_falls_back_to_env_when_runtime_pid_is_stale(
    monkeypatch,
    tmp_path,
):
    settings = _build_settings(
        tmp_path,
        PUBLIC_BASE_URL="https://mapping-investigated-knowledgestorm-ethics.trycloudflare.com",
    )
    runtime_dir = tmp_path / ".runtime"
    runtime_dir.mkdir()
    (runtime_dir / "cloudflared_public_url").write_text(
        "https://accessories-outlined-trying-advertisers.trycloudflare.com\n",
        encoding="utf-8",
    )
    (runtime_dir / "cloudflared.pid").write_text("12345\n", encoding="utf-8")

    def _raise_process_lookup_error(_pid, _sig):
        raise ProcessLookupError

    monkeypatch.setattr("app.config.os.kill", _raise_process_lookup_error)

    assert (
        settings.effective_public_base_url
        == "https://mapping-investigated-knowledgestorm-ethics.trycloudflare.com"
    )
