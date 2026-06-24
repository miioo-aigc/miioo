import logging
import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger("app.config")


class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 1800
    DATABASE_POOL_PRE_PING: bool = True
    LOG_LEVEL: str = "INFO"
    REQUEST_LOG_LEVEL: str = "INFO"
    SLOW_REQUEST_THRESHOLD_MS: int = 1000
    SQL_LOG_ALL_QUERIES: bool = False
    SQL_LOG_LEVEL: str = "DEBUG"
    SQL_SLOW_THRESHOLD_MS: int = 300
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://chengxvblog.top,https://chengxvblog.top,https://www.chengxvblog.top"
    )
    CORS_ORIGIN_REGEX: str = (
        r"^https?://"
        r"(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|([\w-]+\.)*local)"
        r"(:\d+)?$"
    )
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str = ""

    ONELINKAI_API_KEY: str = ""
    ONELINKAI_BASE_URL: str = "https://api.onelinkai.cloud"
    DEFAULT_CHAT_MODEL: str = "gpt-4o"
    VIDEO_TASK_MAX_WAIT_SECONDS: int = 1800
    VIDEO_TASK_POLL_INTERVAL_SECONDS: int = 5
    UPSTREAM_MEDIA_REQUIRE_HTTPS: bool = False

    UPLOAD_DIR: str = "uploads"
    SERVE_UPLOADS_VIA_APP: bool = True
    PUBLIC_BASE_URL: str = ""
    PUBLIC_BASE_URL_FILE: str = ""
    MEDIA_STORAGE_MODE: str = "local"
    MEDIA_PUBLIC_BASE_URL: str = ""
    MEDIA_CDN_BASE_URL: str = ""
    MEDIA_OBJECT_STORAGE_PROVIDER: str = "tencent_cos"
    MEDIA_OBJECT_STORAGE_REGION: str = ""
    MEDIA_OBJECT_STORAGE_SECRET_ID: str = ""
    MEDIA_OBJECT_STORAGE_SECRET_KEY: str = ""
    MEDIA_OBJECT_STORAGE_BUCKET_RAW: str = ""
    MEDIA_OBJECT_STORAGE_BUCKET_PREVIEW: str = ""
    MEDIA_OBJECT_STORAGE_BUCKET_DERIVED: str = ""
    MEDIA_OBJECT_STORAGE_BUCKET_HLS: str = ""
    MEDIA_OBJECT_STORAGE_BUCKET_PRIVATE_DOWNLOAD: str = ""
    MEDIA_OBJECT_STORAGE_KEY_PREFIX_RAW: str = ""
    MEDIA_OBJECT_STORAGE_KEY_PREFIX_PREVIEW: str = ""
    MEDIA_OBJECT_STORAGE_KEY_PREFIX_DERIVED: str = ""
    MEDIA_OBJECT_STORAGE_KEY_PREFIX_HLS: str = ""
    MEDIA_OBJECT_STORAGE_KEY_PREFIX_PRIVATE_DOWNLOAD: str = ""
    MEDIA_ENABLE_SIGNED_DOWNLOAD: bool = True
    MEDIA_ENABLE_OBJECT_STORAGE_PREVIEW: bool = True
    MEDIA_ENABLE_IMAGE_LARGE_VARIANT: bool = True
    MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE: bool = True
    MEDIA_ENABLE_VIDEO_HLS: bool = True
    MEDIA_DOWNLOAD_TOKEN_SECRET: str = ""
    MEDIA_DOWNLOAD_TOKEN_EXPIRE_SECONDS: int = 300
    MIIOO_VOICE_LIBRARY_SOURCE_DIR: str = ""

    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    REQUIRE_REDIS_IN_PRODUCTION: bool = True
    BACKGROUND_JOB_EXECUTION_MODE: str = "inline"
    BACKGROUND_JOB_QUEUE_NAME: str = "miioo:background-jobs"
    BACKGROUND_JOB_DEQUEUE_TIMEOUT_SECONDS: int = 5
    BACKGROUND_JOB_CANCEL_POLL_SECONDS: float = 1.0
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60
    AUTH_SEND_CODE_RATE_LIMIT: int = 5
    AUTH_QR_POLL_RATE_LIMIT: int = 60
    TASK_MUTATION_RATE_LIMIT_WINDOW_SECONDS: int = 60
    TASK_MUTATION_RATE_LIMIT: int = 30
    UPSTREAM_HTTP_MAX_CONNECTIONS: int = 100
    UPSTREAM_HTTP_MAX_KEEPALIVE_CONNECTIONS: int = 20
    UPSTREAM_HTTP_KEEPALIVE_EXPIRY_SECONDS: int = 30
    UPSTREAM_PROVIDER_MAX_CONCURRENCY: int = 12
    UPSTREAM_MODEL_MAX_CONCURRENCY: int = 8
    UPSTREAM_MEDIA_MAX_CONCURRENCY: int = 16
    AUTH_CODE_EXPIRE_SECONDS: int = 300
    AUTH_CODE_RESEND_SECONDS: int = 60
    AUTH_CODE_DAILY_LIMIT: int = 10
    AUTH_CODE_MAX_VERIFY_ERRORS: int = 5
    AUTH_ADMIN_PHONES: str = "15689881587,10987654321"
    AUTH_ADMIN_STATIC_CODE: str = "666666"
    AUTH_DEV_SMS_BYPASS_ENABLED: bool = False
    AUTH_DEV_SMS_BYPASS_CODE: str = "666666"

    TENCENT_SMS_SECRET_ID: str = ""
    TENCENT_SMS_SECRET_KEY: str = ""
    TENCENT_SMS_SDK_APP_ID: str = ""
    TENCENT_SMS_SIGN_NAME: str = ""
    TENCENT_SMS_LOGIN_TEMPLATE_ID: str = ""
    TENCENT_SMS_REGION: str = "ap-guangzhou"

    WECHAT_LOGIN_ENABLED: bool = False
    WECHAT_OPEN_APP_ID: str = ""
    WECHAT_OPEN_APP_SECRET: str = ""
    WECHAT_OPEN_REDIRECT_URI: str = ""
    AUTH_DEBUG_CODE_ENABLED: bool = False
    AUTH_DEV_WECHAT_CONFIRM_ENABLED: bool = False
    ALLOW_PRIVATE_OUTBOUND_URLS: bool = False

    @property
    def auth_admin_phone_set(self) -> set[str]:
        return {
            phone.strip()
            for phone in self.AUTH_ADMIN_PHONES.split(",")
            if phone.strip()
        }

    @property
    def backend_dir(self) -> Path:
        return Path(__file__).resolve().parents[1]

    @property
    def upload_root(self) -> Path:
        upload_dir = Path(self.UPLOAD_DIR).expanduser()
        if not upload_dir.is_absolute():
            upload_dir = self.backend_dir / upload_dir
        try:
            upload_dir.mkdir(parents=True, exist_ok=True)
            return upload_dir.resolve()
        except OSError as exc:
            if self.is_production:
                raise RuntimeError(
                    f"生产环境上传目录不可写，请检查 UPLOAD_DIR 配置: {upload_dir}"
                ) from exc

            fallback_dir = (self.backend_dir / "uploads").resolve()
            if fallback_dir == upload_dir.resolve():
                raise
            fallback_dir.mkdir(parents=True, exist_ok=True)
            logger.warning(
                "UPLOAD_DIR=%s 不可写，开发环境自动回退到 %s",
                upload_dir,
                fallback_dir,
            )
            return fallback_dir

    @property
    def runtime_dir(self) -> Path:
        return (self.backend_dir / ".runtime").resolve()

    def _resolve_optional_backend_path(self, path_value: str) -> Path | None:
        cleaned = path_value.strip()
        if not cleaned:
            return None
        path = Path(cleaned).expanduser()
        if not path.is_absolute():
            path = self.backend_dir / path
        return path.resolve()

    def _is_runtime_pid_alive(self, pid_file: Path) -> bool:
        try:
            pid = int(pid_file.read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            return False
        if pid <= 0:
            return False
        try:
            os.kill(pid, 0)
        except OSError:
            return False
        return True

    @property
    def effective_public_base_url(self) -> str:
        env_public_base_url = self.PUBLIC_BASE_URL.strip()
        runtime_candidates: list[tuple[Path, Path | None]] = []

        configured_public_base_url_file = self._resolve_optional_backend_path(
            self.PUBLIC_BASE_URL_FILE
        )
        if configured_public_base_url_file is not None:
            runtime_candidates.append((configured_public_base_url_file, None))

        runtime_candidates.extend(
            [
                (
                    self.runtime_dir / "cloudflared_public_url",
                    self.runtime_dir / "cloudflared.pid",
                ),
                (
                    self.runtime_dir / "localtunnel_public_url",
                    self.runtime_dir / "localtunnel.pid",
                ),
            ]
        )

        for public_url_file, pid_file in runtime_candidates:
            if not public_url_file.exists():
                continue
            if pid_file is not None and not self._is_runtime_pid_alive(pid_file):
                continue
            try:
                runtime_public_base_url = public_url_file.read_text(
                    encoding="utf-8"
                ).strip()
            except OSError:
                continue
            if runtime_public_base_url:
                return runtime_public_base_url.rstrip("/")

        return env_public_base_url.rstrip("/")

    @property
    def media_download_token_secret(self) -> str:
        secret = self.MEDIA_DOWNLOAD_TOKEN_SECRET.strip()
        return secret or self.SECRET_KEY

    @property
    def effective_media_public_base_url(self) -> str:
        media_public_base_url = self.MEDIA_PUBLIC_BASE_URL.strip()
        if media_public_base_url:
            return media_public_base_url.rstrip("/")
        return self.effective_public_base_url

    @property
    def effective_media_cdn_base_url(self) -> str:
        media_cdn_base_url = self.MEDIA_CDN_BASE_URL.strip()
        if media_cdn_base_url:
            return media_cdn_base_url.rstrip("/")
        return self.effective_media_public_base_url

    @property
    def is_production(self) -> bool:
        return os.getenv("APP_ENV", "").strip().lower() == "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
