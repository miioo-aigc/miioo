from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider
from app.models.user import User
from app.services.aiping_presets import AIPING_BASE_URL
from app.services.fal_presets import FAL_BASE_URL
from app.services.minimax_presets import MINIMAX_BASE_URL
from app.services.vidu_presets import VIDU_BASE_URL
from app.services.volcengine_presets import VOLCENGINE_ARK_BASE_URL, VOLCENGINE_VOICE_BASE_URL
from app.utils.encryption import decrypt_api_key
from app.utils.onelink_base_url import ONELINK_CANONICAL_BASE_URL, normalize_onelink_base_url

LEGACY_REQUESTED_MODEL_FALLBACKS: dict[str, set[str]] = {
    "voice": {"tts-1"},
}
SHARED_ADMIN_AIPING_MODEL_IDS = {"minimax-speech-2.8-hd"}


def _preferred_provider_types_for_model_id(model_id: str | None) -> tuple[str, ...]:
    normalized_model_id = (model_id or "").strip().lower()
    if not normalized_model_id:
        return ()
    if normalized_model_id.startswith("doubao-"):
        # doubao / seedream / seedance 已支持官方 Volcengine provider；
        # 当历史 OneLink 预置模型与官方模型共用同一 model_id 时，优先走官方凭证，
        # 避免命中旧聚合 key 导致 401。
        return ("volcengine", "onelink")
    return ()


def _preferred_provider_type_rank(provider_type: str | None, model_id: str | None) -> int:
    preferred_provider_types = _preferred_provider_types_for_model_id(model_id)
    if not preferred_provider_types:
        return len(preferred_provider_types)
    normalized_provider_type = (provider_type or "").strip().lower()
    try:
        return preferred_provider_types.index(normalized_provider_type)
    except ValueError:
        return len(preferred_provider_types)


async def get_user_onelink_provider(user_id: UUID, db: AsyncSession) -> ApiProvider | None:
    result = await db.execute(
        select(ApiProvider).where(
            and_(
                ApiProvider.user_id == user_id,
                ApiProvider.provider_type == "onelink",
                ApiProvider.is_enabled == True,
            )
        )
    )
    return result.scalar_one_or_none()


def _normalize_provider_base_url(provider: ApiProvider) -> str:
    raw_base_url = (provider.base_url or "").strip()
    if provider.provider_type == "onelink":
        return normalize_onelink_base_url(raw_base_url) or ONELINK_CANONICAL_BASE_URL
    if provider.provider_type == "aiping":
        return raw_base_url or AIPING_BASE_URL
    if provider.provider_type == "minimax":
        return raw_base_url or MINIMAX_BASE_URL
    if provider.provider_type == "vidu":
        return raw_base_url or VIDU_BASE_URL
    if provider.provider_type == "fal":
        return raw_base_url or FAL_BASE_URL
    if provider.provider_type == "volcengine":
        return raw_base_url or VOLCENGINE_ARK_BASE_URL
    return raw_base_url


def _normalize_provider_secondary_base_url(provider: ApiProvider) -> str | None:
    raw_secondary_base_url = (provider.secondary_base_url or "").strip()
    if provider.provider_type == "volcengine":
        return raw_secondary_base_url or VOLCENGINE_VOICE_BASE_URL
    return raw_secondary_base_url or None


def _resolve_provider_runtime_credentials(
    provider: ApiProvider,
    *,
    category: str,
) -> tuple[str, str] | None:
    normalized_category = (category or "").strip().lower()
    normalized_provider_type = (provider.provider_type or "").strip().lower()
    if normalized_provider_type == "volcengine" and normalized_category == "voice":
        encrypted_api_key = provider.secondary_api_key_encrypted
        if not encrypted_api_key:
            return None
        return (
            decrypt_api_key(encrypted_api_key),
            _normalize_provider_secondary_base_url(provider) or VOLCENGINE_VOICE_BASE_URL,
        )
    return (
        decrypt_api_key(provider.api_key_encrypted),
        _normalize_provider_base_url(provider),
    )


async def get_user_api_key(user_id: UUID, db: AsyncSession) -> tuple[str, str] | None:
    provider = await get_user_onelink_provider(user_id, db)
    if not provider:
        return None

    api_key = decrypt_api_key(provider.api_key_encrypted)
    base_url = _normalize_provider_base_url(provider)
    return api_key, base_url


def _allow_shared_admin_model_fallback(*, category: str, requested_model: str | None) -> bool:
    normalized_category = (category or "").strip().lower()
    normalized_model = (requested_model or "").strip().lower()
    if normalized_category != "voice":
        return False
    if not normalized_model:
        return True
    if normalized_model in SHARED_ADMIN_AIPING_MODEL_IDS:
        return True
    return normalized_model in LEGACY_REQUESTED_MODEL_FALLBACKS.get(normalized_category, set())


async def _get_shared_admin_model_provider_row(
    db: AsyncSession,
    *,
    category: str,
    requested_model: str | None = None,
):
    if not _allow_shared_admin_model_fallback(category=category, requested_model=requested_model):
        return None

    normalized_category = (category or "").strip().lower()
    normalized_model = (requested_model or "").strip().lower()
    legacy_requested_models = LEGACY_REQUESTED_MODEL_FALLBACKS.get(normalized_category, set())

    query = (
        select(ModelConfig, ApiProvider)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .join(User, User.id == ApiProvider.user_id)
        .where(
            and_(
                User.is_admin == True,
                ModelConfig.user_id == User.id,
                ModelConfig.category == normalized_category,
                ModelConfig.is_enabled == True,
                ApiProvider.user_id == User.id,
                ApiProvider.provider_type == "aiping",
                ApiProvider.is_enabled == True,
            )
        )
        .order_by(ModelConfig.is_default.desc(), ApiProvider.updated_at.desc(), ModelConfig.created_at.asc())
    )

    if normalized_model and normalized_model not in legacy_requested_models:
        query = query.where(ModelConfig.model_id == normalized_model)
    else:
        query = query.where(ModelConfig.model_id.in_(SHARED_ADMIN_AIPING_MODEL_IDS))

    result = await db.execute(query)
    return result.first()


async def get_user_onelink_watermark_defaults(user_id: UUID, db: AsyncSession) -> tuple[bool, bool]:
    provider = await get_user_onelink_provider(user_id, db)
    if not provider:
        return False, False

    return bool(provider.default_image_watermark), bool(provider.default_video_watermark)


async def _get_user_model_provider_row(
    user_id: UUID,
    db: AsyncSession,
    *,
    category: str,
    requested_model: str | None = None,
):
    normalized_model = (requested_model or "").strip() or None
    base_query = (
        select(ModelConfig, ApiProvider)
        .join(ApiProvider, ApiProvider.id == ModelConfig.provider_id)
        .where(
            and_(
                ModelConfig.user_id == user_id,
                ModelConfig.category == category,
                ModelConfig.is_enabled == True,
                ApiProvider.user_id == user_id,
                ApiProvider.is_enabled == True,
            )
        )
        .order_by(
            ModelConfig.is_default.desc(),
            ApiProvider.updated_at.desc(),
            ApiProvider.id.desc(),
            ModelConfig.created_at.asc(),
            ModelConfig.id.asc(),
        )
    )
    deprecated_models = LEGACY_REQUESTED_MODEL_FALLBACKS.get(category, set())
    if deprecated_models:
        base_query = base_query.where(~ModelConfig.model_id.in_(deprecated_models))

    query = base_query
    if normalized_model:
        query = query.where(ModelConfig.model_id == normalized_model)

    result = await db.execute(query)
    rows = result.all()
    if normalized_model and len(rows) > 1:
        rows = sorted(
            rows,
            key=lambda row: _preferred_provider_type_rank(row[1].provider_type, normalized_model),
        )
    row = rows[0] if rows else None
    if not row and normalized_model in LEGACY_REQUESTED_MODEL_FALLBACKS.get(category, set()):
        fallback_result = await db.execute(base_query)
        fallback_rows = fallback_result.all()
        row = fallback_rows[0] if fallback_rows else None
    if not row:
        row = await _get_shared_admin_model_provider_row(
            db,
            category=category,
            requested_model=normalized_model,
        )
    return row


async def _get_user_enabled_provider_by_types(
    user_id: UUID,
    db: AsyncSession,
    *,
    provider_types: tuple[str, ...],
) -> ApiProvider | None:
    if not provider_types:
        return None
    normalized_provider_types = tuple(
        provider_type.strip().lower()
        for provider_type in provider_types
        if str(provider_type or "").strip()
    )
    if not normalized_provider_types:
        return None

    result = await db.execute(
        select(ApiProvider).where(
            and_(
                ApiProvider.user_id == user_id,
                ApiProvider.is_enabled == True,
                ApiProvider.provider_type.in_(normalized_provider_types),
            )
        )
    )
    providers = result.scalars().all()
    if not providers:
        return None

    providers.sort(
        key=lambda provider: (
            normalized_provider_types.index((provider.provider_type or "").strip().lower())
            if (provider.provider_type or "").strip().lower() in normalized_provider_types
            else len(normalized_provider_types),
            -(provider.updated_at.timestamp() if provider.updated_at else 0.0),
            str(provider.id),
        )
    )
    return providers[0]


async def get_user_model_provider_runtime(
    user_id: UUID,
    db: AsyncSession,
    *,
    category: str,
    requested_model: str | None = None,
) -> tuple[str, str, str, str, bool, bool] | None:
    row = await _get_user_model_provider_row(
        user_id,
        db,
        category=category,
        requested_model=requested_model,
    )
    if not row:
        return None

    model_config, provider = row
    normalized_requested_model = (requested_model or "").strip() or None
    preferred_provider_types = _preferred_provider_types_for_model_id(normalized_requested_model)
    runtime_provider = provider
    runtime_model_id = model_config.model_id
    if normalized_requested_model and preferred_provider_types:
        current_rank = _preferred_provider_type_rank(
            provider.provider_type,
            normalized_requested_model,
        )
        if current_rank > 0:
            preferred_provider = await _get_user_enabled_provider_by_types(
                user_id,
                db,
                provider_types=preferred_provider_types,
            )
            if preferred_provider:
                runtime_provider = preferred_provider
                runtime_model_id = normalized_requested_model
    resolved_credentials = _resolve_provider_runtime_credentials(
        runtime_provider,
        category=category,
    )
    if not resolved_credentials:
        return None
    api_key, base_url = resolved_credentials
    return (
        api_key,
        base_url,
        runtime_provider.provider_type,
        runtime_model_id,
        bool(runtime_provider.default_image_watermark),
        bool(runtime_provider.default_video_watermark),
    )


async def get_user_model_provider_credentials(
    user_id: UUID,
    db: AsyncSession,
    *,
    category: str,
    requested_model: str | None = None,
) -> tuple[str, str, str, str] | None:
    runtime = await get_user_model_provider_runtime(
        user_id,
        db,
        category=category,
        requested_model=requested_model,
    )
    if not runtime:
        return None
    api_key, base_url, provider_type, model_id, _, _ = runtime
    return api_key, base_url, provider_type, model_id
