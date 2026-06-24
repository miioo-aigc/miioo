from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.provider import ApiProvider
from app.schemas.provider import (
    CreateProviderRequest, UpdateProviderRequest, ProviderResponse,
    OneClickSetupRequest, OneClickSetupResponse, OneClickCleanupResponse, PresetModelInfo,
    MinimaxSetupRequest,
    VolcengineSetupRequest,
)
from app.services.aiping_presets import (
    AIPING_BASE_URL,
    AIPING_PRESET_MODELS,
    AIPING_PROVIDER_NAME,
    sync_aiping_preset_models,
)
from app.services.fal_presets import (
    FAL_BASE_URL,
    FAL_PRESET_MODELS,
    FAL_PROVIDER_NAME,
    sync_fal_preset_models,
)
from app.services.minimax_presets import (
    MINIMAX_BASE_URL,
    MINIMAX_PRESET_MODELS,
    MINIMAX_PROVIDER_NAME,
    sync_minimax_preset_models,
)
from app.services.onelink_presets import (
    ONECLICK_BASE_URL,
    ONECLICK_PRESET_MODELS,
    ONECLICK_PROVIDER_NAME,
    cleanup_onelink_legacy_models,
    sync_onelink_preset_models,
)
from app.services.vidu_presets import (
    VIDU_BASE_URL,
    VIDU_PRESET_MODELS,
    VIDU_PROVIDER_NAME,
    sync_vidu_preset_models,
)
from app.services.volcengine_presets import (
    VOLCENGINE_ARK_BASE_URL,
    VOLCENGINE_CREDENTIAL_MODE,
    VOLCENGINE_PRESET_MODELS,
    VOLCENGINE_PROVIDER_NAME,
    VOLCENGINE_VOICE_BASE_URL,
    sync_volcengine_preset_models,
)
from app.utils.encryption import encrypt_api_key, decrypt_api_key, mask_api_key
from app.utils.onelink_base_url import normalize_onelink_base_url
from app.utils.connection_tester import test_provider_connection
from app.utils.url_security import validate_outbound_url

router = APIRouter()


def _normalize_provider_base_url_value(
    provider_type: str,
    base_url: str | None,
    *,
    secondary: bool = False,
) -> str | None:
    normalized_provider_type = (provider_type or "").strip().lower()
    raw_base_url = (base_url or "").strip()
    if normalized_provider_type == "onelink":
        normalized = normalize_onelink_base_url(raw_base_url)
        return validate_outbound_url(normalized, label="服务商 Base URL") if normalized else None
    if normalized_provider_type == "aiping":
        return validate_outbound_url(raw_base_url or AIPING_BASE_URL, label="服务商 Base URL")
    if normalized_provider_type == "minimax":
        return validate_outbound_url(raw_base_url or MINIMAX_BASE_URL, label="MiniMax Base URL")
    if normalized_provider_type == "vidu":
        return validate_outbound_url(raw_base_url or VIDU_BASE_URL, label="服务商 Base URL")
    if normalized_provider_type == "fal":
        return validate_outbound_url(raw_base_url or FAL_BASE_URL, label="fal Platform Base URL")
    if normalized_provider_type == "volcengine":
        default_base_url = VOLCENGINE_VOICE_BASE_URL if secondary else VOLCENGINE_ARK_BASE_URL
        label = "Volcengine Voice Base URL" if secondary else "Volcengine Ark Base URL"
        return validate_outbound_url(raw_base_url or default_base_url, label=label)
    return validate_outbound_url(raw_base_url, label="服务商 Base URL") if raw_base_url else None


def _to_response(p: ApiProvider) -> ProviderResponse:
    masked = mask_api_key(decrypt_api_key(p.api_key_encrypted))
    secondary_masked = None
    if p.secondary_api_key_encrypted:
        secondary_masked = mask_api_key(decrypt_api_key(p.secondary_api_key_encrypted))
    base_url = _normalize_provider_base_url_value(p.provider_type, p.base_url)
    secondary_base_url = _normalize_provider_base_url_value(
        p.provider_type,
        p.secondary_base_url,
        secondary=True,
    ) if p.secondary_base_url or p.provider_type == "volcengine" else p.secondary_base_url
    return ProviderResponse(
        id=str(p.id),
        name=p.name,
        provider_type=p.provider_type,
        base_url=base_url,
        api_key_masked=masked,
        secondary_base_url=secondary_base_url,
        secondary_api_key_masked=secondary_masked,
        credential_mode=p.credential_mode,
        is_enabled=p.is_enabled,
        default_image_watermark=bool(p.default_image_watermark),
        default_video_watermark=bool(p.default_video_watermark),
        is_connected=p.is_connected,
        last_tested_at=p.last_tested_at.isoformat() if p.last_tested_at else None,
        created_at=p.created_at.isoformat(),
    )


def _resolve_provider_base_url(provider: ApiProvider) -> str:
    return _normalize_provider_base_url_value(provider.provider_type, provider.base_url) or ""


def _resolve_provider_secondary_base_url(provider: ApiProvider) -> str | None:
    normalized_provider_type = (provider.provider_type or "").strip().lower()
    if normalized_provider_type != "volcengine" and not provider.secondary_base_url:
        return None
    return _normalize_provider_base_url_value(
        provider.provider_type,
        provider.secondary_base_url,
        secondary=True,
    )


async def _get_provider_by_name(
    db: AsyncSession,
    user_id,
    provider_name: str,
) -> ApiProvider | None:
    result = await db.execute(
        select(ApiProvider).where(
            and_(ApiProvider.user_id == user_id, ApiProvider.name == provider_name)
        ).order_by(
            ApiProvider.is_enabled.desc(),
            ApiProvider.updated_at.desc(),
            ApiProvider.created_at.desc(),
            ApiProvider.id.desc(),
        )
    )
    return result.scalars().first()


@router.get(
    "",
    response_model=list[ProviderResponse],
    summary="获取服务商列表",
    description="返回当前登录用户已配置的全部服务商，包括基础连接信息、启用状态、水印默认值和最近一次连通性测试结果。",
    response_description="服务商配置列表。",
)
async def list_providers(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApiProvider)
        .where(ApiProvider.user_id == user.id)
        .order_by(ApiProvider.updated_at.desc(), ApiProvider.created_at.desc(), ApiProvider.id.desc())
    )
    return [_to_response(p) for p in result.scalars().all()]


@router.post(
    "",
    response_model=ProviderResponse,
    summary="创建自定义服务商",
    description="手动创建一条服务商配置，适合非内置 provider 或需要自定义 Base URL 的场景。",
    response_description="创建成功后的服务商配置。",
)
async def create_provider(req: CreateProviderRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    safe_base_url = _normalize_provider_base_url_value(req.provider_type, req.base_url)
    secondary_base_url = _normalize_provider_base_url_value(
        req.provider_type,
        req.secondary_base_url,
        secondary=True,
    ) if req.secondary_base_url else None
    provider = ApiProvider(
        user_id=user.id,
        name=req.name,
        provider_type=req.provider_type,
        base_url=safe_base_url,
        api_key_encrypted=encrypt_api_key(req.api_key),
        secondary_base_url=secondary_base_url,
        secondary_api_key_encrypted=encrypt_api_key(req.secondary_api_key) if req.secondary_api_key else None,
        credential_mode=req.credential_mode,
        default_image_watermark=False,
        default_video_watermark=False,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return _to_response(provider)


@router.patch(
    "/{provider_id}",
    response_model=ProviderResponse,
    summary="更新服务商配置",
    description="更新服务商名称、Base URL、API Key、启用状态和默认水印开关等配置。",
    response_description="更新后的服务商配置。",
)
async def update_provider(provider_id: str, req: UpdateProviderRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == UUID(provider_id), ApiProvider.user_id == user.id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")

    if req.name is not None:
        provider.name = req.name
    if req.base_url is not None:
        provider.base_url = _normalize_provider_base_url_value(
            provider.provider_type,
            req.base_url,
        )
    if req.api_key is not None:
        provider.api_key_encrypted = encrypt_api_key(req.api_key)
    if req.secondary_base_url is not None:
        provider.secondary_base_url = _normalize_provider_base_url_value(
            provider.provider_type,
            req.secondary_base_url,
            secondary=True,
        )
    if req.secondary_api_key is not None:
        provider.secondary_api_key_encrypted = encrypt_api_key(req.secondary_api_key)
    if req.credential_mode is not None:
        provider.credential_mode = req.credential_mode
    if req.is_enabled is not None:
        provider.is_enabled = req.is_enabled
    if req.default_image_watermark is not None:
        provider.default_image_watermark = req.default_image_watermark
    if req.default_video_watermark is not None:
        provider.default_video_watermark = req.default_video_watermark

    await db.commit()
    await db.refresh(provider)
    return _to_response(provider)


@router.delete(
    "/{provider_id}",
    summary="删除服务商配置",
    description="删除当前用户下的指定服务商配置。删除后其关联模型仍以数据库约束和后续同步逻辑为准。",
    response_description="删除结果。",
)
async def delete_provider(provider_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == UUID(provider_id), ApiProvider.user_id == user.id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")

    await db.delete(provider)
    await db.commit()
    return {"message": "已删除"}


@router.post(
    "/{provider_id}/test",
    summary="测试服务商连通性",
    description="对指定服务商执行一次实际连通性测试，并回写最近测试时间与结果。",
    response_description="测试结果。",
)
async def test_connection(provider_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ApiProvider).where(ApiProvider.id == UUID(provider_id), ApiProvider.user_id == user.id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")

    base_url = _resolve_provider_base_url(provider)
    if provider.base_url != base_url:
        provider.base_url = base_url
    secondary_base_url = _resolve_provider_secondary_base_url(provider)
    if secondary_base_url and provider.secondary_base_url != secondary_base_url:
        provider.secondary_base_url = secondary_base_url
    success, message = await test_provider_connection(
        base_url,
        provider.api_key_encrypted,
        provider_type=provider.provider_type,
        secondary_base_url=secondary_base_url,
        secondary_api_key_encrypted=provider.secondary_api_key_encrypted,
    )

    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()
    await db.commit()

    return {"success": success, "message": message}


@router.post(
    "/aiping-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 AI Ping",
    description="创建或更新内置 `AI Ping` provider，并自动同步其配音预置模型后执行连通性测试。",
    response_description="一键配置结果。",
)
async def aiping_setup(req: OneClickSetupRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    encrypted_key = encrypt_api_key(req.api_key)
    success, message = await test_provider_connection(
        AIPING_BASE_URL,
        encrypted_key,
        provider_type="aiping",
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)

    provider = await _get_provider_by_name(db, user.id, AIPING_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_key
        provider.base_url = AIPING_BASE_URL
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=AIPING_PROVIDER_NAME,
            provider_type="aiping",
            base_url=AIPING_BASE_URL,
            api_key_encrypted=encrypted_key,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()
    await sync_aiping_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in AIPING_PRESET_MODELS
    ]

    provider.is_connected = True
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/minimax-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 MiniMax 官方",
    description="创建或更新内置 `MiniMax` 官方 provider，自动同步官方语音预置模型并执行连通性测试。",
    response_description="一键配置结果。",
)
async def minimax_setup(
    req: MinimaxSetupRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    encrypted_key = encrypt_api_key(req.api_key)
    minimax_base_url = _normalize_provider_base_url_value("minimax", req.base_url)
    provider = await _get_provider_by_name(db, user.id, MINIMAX_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_key
        provider.base_url = minimax_base_url
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=MINIMAX_PROVIDER_NAME,
            provider_type="minimax",
            base_url=minimax_base_url,
            api_key_encrypted=encrypted_key,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()
    await sync_minimax_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in MINIMAX_PRESET_MODELS
    ]

    success, message = await test_provider_connection(
        minimax_base_url,
        encrypted_key,
        provider_type="minimax",
    )
    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/oneclick-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 OneLinkAI",
    description="创建或更新内置 `OneLinkAI` provider，自动同步预置模型并清理历史旧模型。",
    response_description="一键配置结果。",
)
async def oneclick_setup(req: OneClickSetupRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    encrypted_key = encrypt_api_key(req.api_key)
    provider = await _get_provider_by_name(db, user.id, ONECLICK_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_key
        provider.base_url = ONECLICK_BASE_URL
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=ONECLICK_PROVIDER_NAME,
            provider_type="onelink",
            base_url=ONECLICK_BASE_URL,
            api_key_encrypted=encrypted_key,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()

    await sync_onelink_preset_models(db, user.id, provider)
    await cleanup_onelink_legacy_models(db, user.id, provider)
    await sync_onelink_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in ONECLICK_PRESET_MODELS
    ]

    success, message = await test_provider_connection(
        ONECLICK_BASE_URL,
        encrypted_key,
        provider_type="onelink",
    )
    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/volcengine-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 Volcengine",
    description="创建或更新内置 `Volcengine` provider。该 provider 使用双凭证模式，分别承接 Ark 模型能力与语音能力。",
    response_description="一键配置结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "ark_api_key": "ark-xxx",
                        "voice_api_key": "volc-xxx",
                        "ark_base_url": "https://ark.cn-beijing.volces.com/api/v3",
                        "voice_base_url": "https://openspeech.bytedance.com",
                    }
                }
            }
        }
    },
)
async def volcengine_setup(
    req: VolcengineSetupRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    encrypted_ark_key = encrypt_api_key(req.ark_api_key)
    encrypted_voice_key = encrypt_api_key(req.voice_api_key)
    ark_base_url = _normalize_provider_base_url_value("volcengine", req.ark_base_url)
    voice_base_url = _normalize_provider_base_url_value(
        "volcengine",
        req.voice_base_url,
        secondary=True,
    )
    provider = await _get_provider_by_name(db, user.id, VOLCENGINE_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_ark_key
        provider.base_url = ark_base_url
        provider.secondary_api_key_encrypted = encrypted_voice_key
        provider.secondary_base_url = voice_base_url
        provider.credential_mode = VOLCENGINE_CREDENTIAL_MODE
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=VOLCENGINE_PROVIDER_NAME,
            provider_type="volcengine",
            base_url=ark_base_url,
            api_key_encrypted=encrypted_ark_key,
            secondary_base_url=voice_base_url,
            secondary_api_key_encrypted=encrypted_voice_key,
            credential_mode=VOLCENGINE_CREDENTIAL_MODE,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()
    await sync_volcengine_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in VOLCENGINE_PRESET_MODELS
    ]

    success, message = await test_provider_connection(
        ark_base_url,
        encrypted_ark_key,
        provider_type="volcengine",
        secondary_base_url=voice_base_url,
        secondary_api_key_encrypted=encrypted_voice_key,
    )
    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/vidu-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 Vidu 官方",
    description="创建或更新内置 `Vidu` provider，自动同步官方图片与视频预置模型并执行连通性测试。",
    response_description="一键配置结果。",
)
async def vidu_setup(req: OneClickSetupRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    encrypted_key = encrypt_api_key(req.api_key)
    provider = await _get_provider_by_name(db, user.id, VIDU_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_key
        provider.base_url = VIDU_BASE_URL
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=VIDU_PROVIDER_NAME,
            provider_type="vidu",
            base_url=VIDU_BASE_URL,
            api_key_encrypted=encrypted_key,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()
    await sync_vidu_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in VIDU_PRESET_MODELS
    ]

    success, message = await test_provider_connection(
        VIDU_BASE_URL,
        encrypted_key,
        provider_type="vidu",
    )
    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/fal-setup",
    response_model=OneClickSetupResponse,
    summary="一键配置 fal 官方",
    description="创建或更新内置 `fal` provider，自动同步当前收口的官方图片与视频预置模型并执行连通性测试。",
    response_description="一键配置结果。",
)
async def fal_setup(req: OneClickSetupRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    encrypted_key = encrypt_api_key(req.api_key)
    provider = await _get_provider_by_name(db, user.id, FAL_PROVIDER_NAME)

    if provider:
        provider.api_key_encrypted = encrypted_key
        provider.base_url = FAL_BASE_URL
        provider.is_enabled = True
    else:
        provider = ApiProvider(
            user_id=user.id,
            name=FAL_PROVIDER_NAME,
            provider_type="fal",
            base_url=FAL_BASE_URL,
            api_key_encrypted=encrypted_key,
            default_image_watermark=False,
            default_video_watermark=False,
        )
        db.add(provider)

    await db.flush()
    await sync_fal_preset_models(db, user.id, provider)

    created_models: list[PresetModelInfo] = [
        PresetModelInfo(
            name=preset["name"],
            model_id=preset["model_id"],
            category=preset["category"],
            description=preset["description"],
        )
        for preset in FAL_PRESET_MODELS
    ]

    success, message = await test_provider_connection(
        FAL_BASE_URL,
        encrypted_key,
        provider_type="fal",
    )
    provider.is_connected = success
    provider.last_tested_at = datetime.utcnow()

    await db.commit()
    await db.refresh(provider)

    return OneClickSetupResponse(
        provider=_to_response(provider),
        models=created_models,
        test_success=success,
        test_message=message,
    )


@router.post(
    "/oneclick-cleanup",
    response_model=OneClickCleanupResponse,
    summary="清理 OneLinkAI 历史旧模型",
    description="清理当前用户下 OneLinkAI provider 的历史旧模型和重复模型，并重新同步预置模型。",
    response_description="清理结果。",
)
async def oneclick_cleanup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    provider = await _get_provider_by_name(db, user.id, ONECLICK_PROVIDER_NAME)
    if not provider:
        raise HTTPException(status_code=404, detail="请先完成 OneLinkAI 一键配置")

    await sync_onelink_preset_models(db, user.id, provider)
    cleanup_result = await cleanup_onelink_legacy_models(db, user.id, provider)
    await sync_onelink_preset_models(db, user.id, provider)
    await db.commit()

    removed_count = cleanup_result["removed_count"]
    return OneClickCleanupResponse(
        removed_count=removed_count,
        removed_legacy_count=cleanup_result["removed_legacy_count"],
        removed_duplicate_count=cleanup_result["removed_duplicate_count"],
        remaining_preset_count=len(ONECLICK_PRESET_MODELS),
        message=(
            "未发现需要清理的旧模型"
            if removed_count == 0
            else f"已清理 {removed_count} 个 OneLinkAI 历史旧模型"
        ),
    )
