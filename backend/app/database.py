import logging
from time import perf_counter

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings
from app.observability import coerce_log_level, get_request_id, truncate_for_log

sql_logger = logging.getLogger("app.sql")
_QUERY_START_TIME_KEY = "query_start_time"

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_pre_ping=settings.DATABASE_POOL_PRE_PING,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _pop_query_start_time(conn) -> float | None:
    start_times = conn.info.get(_QUERY_START_TIME_KEY)
    if not start_times:
        return None
    return start_times.pop() if start_times else None


def _format_sql_log_payload(statement, parameters, duration_ms: float) -> tuple[str, int]:
    is_slow = duration_ms >= settings.SQL_SLOW_THRESHOLD_MS
    should_log = settings.SQL_LOG_ALL_QUERIES or is_slow
    if not should_log:
        return "", logging.NOTSET

    statement_text = truncate_for_log(statement)
    params_text = truncate_for_log(parameters)
    level = logging.WARNING if is_slow else coerce_log_level(settings.SQL_LOG_LEVEL)
    message = (
        "slow sql duration_ms=%.2f statement=%s params=%s"
        if is_slow
        else "sql duration_ms=%.2f statement=%s params=%s"
    )
    return message % (duration_ms, statement_text, params_text), level


@event.listens_for(engine.sync_engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    conn.info.setdefault(_QUERY_START_TIME_KEY, []).append(perf_counter())


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    start_time = _pop_query_start_time(conn)
    if start_time is None:
        return

    duration_ms = round((perf_counter() - start_time) * 1000, 2)
    payload, level = _format_sql_log_payload(statement, parameters, duration_ms)
    if not payload:
        return

    sql_logger.log(level, "%s request_id=%s", payload, get_request_id())


@event.listens_for(engine.sync_engine, "handle_error")
def handle_sql_error(exception_context) -> None:
    start_time = _pop_query_start_time(exception_context.connection)
    duration_ms = round((perf_counter() - start_time) * 1000, 2) if start_time is not None else -1.0
    sql_logger.exception(
        "sql failed duration_ms=%.2f statement=%s params=%s request_id=%s",
        duration_ms,
        truncate_for_log(exception_context.statement),
        truncate_for_log(exception_context.parameters),
        get_request_id(),
    )


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def ensure_runtime_schema_compatibility() -> None:
    """Patch known schema drift in local dev databases before requests hit the app."""
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name IN ('project_script_histories', 'api_providers', 'voices', 'projects', 'users', 'api_config_banners', 'api_config_card_visibility', 'community_qr_configs', 'reference_audio_library_items')
                """
            )
        )
        table_columns: dict[str, set[str]] = {}
        for table_name, column_name in result:
            table_columns.setdefault(table_name, set()).add(column_name)

        history_columns = table_columns.get("project_script_histories", set())
        if "snapshot_type" not in history_columns and history_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE project_script_histories
                    ADD COLUMN snapshot_type VARCHAR(30) NOT NULL DEFAULT 'script_content'
                    """
                )
            )

        if "snapshot_payload" not in history_columns and history_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE project_script_histories
                    ADD COLUMN snapshot_payload JSON NULL
                    """
                )
            )

        provider_columns = table_columns.get("api_providers", set())
        if "secondary_base_url" not in provider_columns and provider_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ADD COLUMN secondary_base_url VARCHAR(500) NULL
                    """
                )
            )

        if "secondary_api_key_encrypted" not in provider_columns and provider_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ADD COLUMN secondary_api_key_encrypted TEXT NULL
                    """
                )
            )

        if "credential_mode" not in provider_columns and provider_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ADD COLUMN credential_mode VARCHAR(50) NULL
                    """
                )
            )

        if "default_image_watermark" not in provider_columns and provider_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ADD COLUMN default_image_watermark BOOLEAN NOT NULL DEFAULT FALSE
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ALTER COLUMN default_image_watermark DROP DEFAULT
                    """
                )
            )

        if "default_video_watermark" not in provider_columns and provider_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE api_providers
                    ADD COLUMN default_video_watermark BOOLEAN NOT NULL DEFAULT FALSE
                    """
                )
            )

        project_columns = table_columns.get("projects", set())
        if "cover_thumbnail_url" not in project_columns and project_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE projects
                    ADD COLUMN cover_thumbnail_url VARCHAR(500) NULL
                    """
                )
            )

        user_columns = table_columns.get("users", set())
        if "is_admin" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ALTER COLUMN is_admin DROP DEFAULT
                    """
                )
            )
        if "is_phone_bound" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN is_phone_bound BOOLEAN NOT NULL DEFAULT TRUE
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ALTER COLUMN is_phone_bound DROP DEFAULT
                    """
                )
            )
        if "registered_phone" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN registered_phone VARCHAR(20) NULL
                    """
                )
            )
        if "last_login_phone" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN last_login_phone VARCHAR(20) NULL
                    """
                )
            )
        if "last_login_at" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN last_login_at TIMESTAMP NULL
                    """
                )
            )
        if "wechat_openid" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN wechat_openid VARCHAR(100) NULL
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wechat_openid
                    ON users (wechat_openid)
                    WHERE wechat_openid IS NOT NULL
                    """
                )
            )
        if "wechat_nickname" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN wechat_nickname VARCHAR(50) NULL
                    """
                )
            )
        if "wechat_avatar_url" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN wechat_avatar_url VARCHAR(500) NULL
                    """
                )
            )
        if "wechat_bound_at" not in user_columns and user_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN wechat_bound_at TIMESTAMP NULL
                    """
                )
            )

        banner_columns = table_columns.get("api_config_banners", set())
        if not banner_columns and "api_config_banners" not in table_columns:
            await conn.execute(
                text(
                    """
                    CREATE TABLE api_config_banners (
                        id UUID PRIMARY KEY,
                        image_url VARCHAR(500) NULL,
                        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                        created_by UUID NULL,
                        updated_by UUID NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

        card_visibility_columns = table_columns.get("api_config_card_visibility", set())
        if not card_visibility_columns and "api_config_card_visibility" not in table_columns:
            await conn.execute(
                text(
                    """
                    CREATE TABLE api_config_card_visibility (
                        id UUID PRIMARY KEY,
                        card_key VARCHAR(50) NOT NULL UNIQUE,
                        is_visible BOOLEAN NOT NULL DEFAULT TRUE,
                        created_by UUID NULL,
                        updated_by UUID NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

        community_qr_columns = table_columns.get("community_qr_configs", set())
        if not community_qr_columns and "community_qr_configs" not in table_columns:
            await conn.execute(
                text(
                    """
                    CREATE TABLE community_qr_configs (
                        id UUID PRIMARY KEY,
                        image_url VARCHAR(500) NULL,
                        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                        created_by UUID NULL,
                        updated_by UUID NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )

        voice_columns = table_columns.get("voices", set())
        if "provider_voice_id" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN provider_voice_id VARCHAR(100) NULL
                    """
                )
            )
        if "clone_status" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN clone_status VARCHAR(20) NULL
                    """
                )
            )
        if "source_audio_url" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN source_audio_url VARCHAR(500) NULL
                    """
                )
            )
        if "provider_file_id" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN provider_file_id VARCHAR(200) NULL
                    """
                )
            )
        if "provider_task_id" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN provider_task_id VARCHAR(200) NULL
                    """
                )
            )
        if "expires_at" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN expires_at TIMESTAMP NULL
                    """
                )
            )
        if "metadata_json" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN metadata_json JSON NULL
                    """
                )
            )
        if "is_enabled" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ALTER COLUMN is_enabled DROP DEFAULT
                    """
                )
            )
        if "sort_order" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ALTER COLUMN sort_order DROP DEFAULT
                    """
                )
            )
        if "created_by" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN created_by UUID NULL
                    """
                )
            )
        if "updated_by" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN updated_by UUID NULL
                    """
                )
            )
        if "updated_at" not in voice_columns and voice_columns:
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE voices
                    ALTER COLUMN updated_at DROP DEFAULT
                    """
                )
            )

        reference_audio_columns = table_columns.get("reference_audio_library_items", set())
        if not reference_audio_columns and "reference_audio_library_items" not in table_columns:
            await conn.execute(
                text(
                    """
                    CREATE TABLE reference_audio_library_items (
                        id UUID PRIMARY KEY,
                        name VARCHAR(120) NOT NULL,
                        description TEXT NULL,
                        audio_url VARCHAR(500) NOT NULL,
                        preview_url VARCHAR(500) NULL,
                        gender VARCHAR(20) NULL,
                        age_group VARCHAR(30) NULL,
                        language VARCHAR(20) NULL,
                        emotion VARCHAR(50) NULL,
                        tags_json JSON NULL,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                        created_by UUID NULL,
                        updated_by UUID NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
