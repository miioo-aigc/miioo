from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.live_material_asset import LiveMaterialAsset
from app.models.live_material_group import LiveMaterialGroup
from app.services.http_client import log_upstream_failure, upstream_async_client
from app.services.user_api_key import get_user_api_key

VOLC_OPENAPI_VERSION = "2024-01-01"
LIVE_MATERIAL_GROUP_TYPE = "LivenessFace"


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _safe_iso(dt: datetime | None) -> str | None:
    return dt.astimezone(timezone.utc).isoformat() if dt else None


def _normalize_asset_type(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"image", "video", "audio"}:
        return normalized
    raise ValueError("真人素材类型仅支持 image / video / audio")


def _asset_ref_url(upstream_asset_id: str) -> str:
    return f"asset://{upstream_asset_id}"


def _merge_live_material_metadata(
    existing: dict[str, Any] | None,
    patch: dict[str, Any] | None,
) -> dict[str, Any]:
    merged = dict(existing) if isinstance(existing, dict) else {}
    if not isinstance(patch, dict):
        return merged
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {
                **merged[key],
                **value,
            }
        else:
            merged[key] = value
    return merged


def _coerce_payload(response: httpx.Response) -> dict[str, Any]:
    try:
        payload = response.json()
    except Exception as exc:
        raise ValueError(f"上游返回了不可解析的响应：{response.text[:200]}") from exc
    if not isinstance(payload, dict):
        raise ValueError("上游返回格式非法")
    return payload


def _extract_result(payload: dict[str, Any]) -> dict[str, Any]:
    result = payload.get("Result")
    if isinstance(result, dict):
        return result
    result = payload.get("result")
    if isinstance(result, dict):
        return result
    data = payload.get("data")
    if isinstance(data, dict):
        return data
    return {}


def _build_frontend_callback_url(
    *,
    session_id: str,
    source: str | None,
    project_id: str | None,
    storyboard_id: str | None,
    return_path: str | None,
) -> str:
    base = settings.effective_public_base_url.rstrip("/")
    if not base:
        raise ValueError("未配置 PUBLIC_BASE_URL，无法创建真人认证回调地址")
    query = urlencode(
        {
            "session_id": session_id,
            "source": source or "",
            "project_id": project_id or "",
            "storyboard_id": storyboard_id or "",
            "return_path": return_path or "/",
        }
    )
    return f"{base}/live-material-auth/callback?{query}"


async def _resolve_onelink_credentials(user_id: UUID, db: AsyncSession) -> tuple[str, str]:
    credentials = await get_user_api_key(user_id, db)
    if not credentials:
        raise ValueError("未配置 OneLinkAI 服务商，请先在设置中配置")
    api_key, base_url = credentials
    if not api_key or not base_url:
        raise ValueError("OneLinkAI 凭证不完整，请先在设置中补齐")
    return api_key, base_url.rstrip("/")


def serialize_live_material_group(
    group: LiveMaterialGroup,
    *,
    asset_count: int = 0,
) -> dict[str, Any]:
    return {
        "id": str(group.id),
        "upstream_group_id": group.upstream_group_id,
        "provider_type": group.provider_type,
        "group_type": group.group_type,
        "name": group.name,
        "description": group.description,
        "auth_status": group.auth_status,
        "last_result_code": group.last_result_code,
        "asset_count": int(asset_count),
        "created_at": _safe_iso(group.created_at),
        "updated_at": _safe_iso(group.updated_at),
    }


def serialize_live_material_asset(asset: LiveMaterialAsset) -> dict[str, Any]:
    return {
        "id": str(asset.id),
        "group_id": str(asset.group_id),
        "upstream_asset_id": asset.upstream_asset_id,
        "asset_ref_url": _asset_ref_url(asset.upstream_asset_id),
        "asset_type": asset.asset_type,
        "name": asset.name,
        "status": asset.status,
        "source_url": asset.source_url,
        "preview_url": asset.preview_url or asset.source_url,
        "error_message": asset.error_message,
        "created_at": _safe_iso(asset.created_at),
        "updated_at": _safe_iso(asset.updated_at),
    }


def normalize_live_material_provider_params(provider_params: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(provider_params, dict):
        return None
    raw = provider_params.get("live_material")
    if not isinstance(raw, dict):
        return None
    asset_ids = []
    for item in raw.get("asset_ids") or []:
        cleaned = str(item or "").strip()
        if cleaned:
            asset_ids.append(cleaned)
    group_id = str(raw.get("group_id") or "").strip() or None
    if not asset_ids and not group_id:
        return None
    return {
        "group_id": group_id,
        "asset_ids": asset_ids,
        "group_type": str(raw.get("group_type") or LIVE_MATERIAL_GROUP_TYPE).strip() or LIVE_MATERIAL_GROUP_TYPE,
    }


async def create_live_material_auth_session(
    *,
    user_id: UUID,
    db: AsyncSession,
    session_id: str,
    source: str | None,
    project_id: str | None,
    storyboard_id: str | None,
    return_path: str | None,
) -> dict[str, Any]:
    api_key, base_url = await _resolve_onelink_credentials(user_id, db)
    callback_url = _build_frontend_callback_url(
        session_id=session_id,
        source=source,
        project_id=project_id,
        storyboard_id=storyboard_id,
        return_path=return_path,
    )
    request_url = (
        f"{base_url}/volc/openapi"
        f"?Action=CreateVisualValidateSession&Version={VOLC_OPENAPI_VERSION}"
    )
    payload = {"CallbackURL": callback_url}
    async with upstream_async_client(profile="provider", timeout=60.0, follow_redirects=True) as client:
        try:
            response = await client.post(request_url, headers=_headers(api_key), json=payload)
            response.raise_for_status()
        except Exception as exc:
            log_upstream_failure(
                profile="provider",
                operation="live-material-create-auth-session",
                exc=exc,
                context={"user_id": str(user_id)},
            )
            raise
    data = _coerce_payload(response)
    result = _extract_result(data)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=120)
    return {
        "session_id": session_id,
        "h5_link": str(result.get("H5Link") or "").strip(),
        "callback_url": str(result.get("CallbackURL") or callback_url).strip(),
        "expires_at": expires_at.isoformat(),
        "byted_token": str(result.get("BytedToken") or "").strip() or None,
    }


async def complete_live_material_auth_session(
    *,
    user_id: UUID,
    db: AsyncSession,
    result_code: str | None,
    byted_token: str | None,
    query_params: dict[str, str] | None,
) -> dict[str, Any]:
    normalized_result_code = str(result_code or "").strip()
    normalized_byted_token = str(byted_token or "").strip()
    if normalized_result_code != "10000":
        raise ValueError("真人认证未成功，请完成认证后重试")
    if not normalized_byted_token:
        raise ValueError("缺少 bytedToken，无法换取真人素材组")

    api_key, base_url = await _resolve_onelink_credentials(user_id, db)
    request_url = f"{base_url}/volc/openapi?Action=GetVisualValidateResult&Version={VOLC_OPENAPI_VERSION}"
    payload = {"BytedToken": normalized_byted_token}
    async with upstream_async_client(profile="provider", timeout=60.0, follow_redirects=True) as client:
        try:
            response = await client.post(request_url, headers=_headers(api_key), json=payload)
            response.raise_for_status()
        except Exception as exc:
            log_upstream_failure(
                profile="provider",
                operation="live-material-complete-auth-session",
                exc=exc,
                context={"user_id": str(user_id)},
            )
            raise

    data = _coerce_payload(response)
    result = _extract_result(data)
    upstream_group_id = str(result.get("GroupId") or "").strip()
    if not upstream_group_id:
        raise ValueError("上游未返回 GroupId，无法完成真人素材认证")

    group_result = await db.execute(
        select(LiveMaterialGroup).where(
            LiveMaterialGroup.user_id == user_id,
            LiveMaterialGroup.upstream_group_id == upstream_group_id,
        )
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        group = LiveMaterialGroup(
            user_id=user_id,
            upstream_group_id=upstream_group_id,
            provider_type="onelink",
            group_type=LIVE_MATERIAL_GROUP_TYPE,
            auth_status="verified",
            last_result_code=normalized_result_code,
            metadata_json={"query_params": query_params or {}, "result": result},
        )
        db.add(group)
    else:
        group.auth_status = "verified"
        group.last_result_code = normalized_result_code
        group.metadata_json = {"query_params": query_params or {}, "result": result}

    await db.commit()
    await db.refresh(group)
    return {
        "group": serialize_live_material_group(group, asset_count=0),
        "redirect_path": str((query_params or {}).get("return_path") or "/").strip() or "/",
    }


async def create_live_material_asset(
    *,
    user_id: UUID,
    db: AsyncSession,
    group: LiveMaterialGroup,
    url: str,
    asset_type: str,
    name: str | None,
    extra_metadata: dict[str, Any] | None = None,
) -> LiveMaterialAsset:
    api_key, base_url = await _resolve_onelink_credentials(user_id, db)
    normalized_asset_type = _normalize_asset_type(asset_type)
    request_url = f"{base_url}/volc/openapi?Action=CreateAsset&Version={VOLC_OPENAPI_VERSION}"
    payload = {
        "GroupId": group.upstream_group_id,
        "URL": str(url).strip(),
        "AssetType": normalized_asset_type.capitalize(),
    }
    if name:
        payload["Name"] = str(name).strip()[:120]
    async with upstream_async_client(profile="provider", timeout=90.0, follow_redirects=True) as client:
        try:
            response = await client.post(request_url, headers=_headers(api_key), json=payload)
            response.raise_for_status()
        except Exception as exc:
            log_upstream_failure(
                profile="provider",
                operation="live-material-create-asset",
                exc=exc,
                context={"user_id": str(user_id), "group_id": str(group.id)},
            )
            raise
    data = _coerce_payload(response)
    result = _extract_result(data)
    upstream_asset_id = str(result.get("Id") or result.get("AssetId") or "").strip()
    if not upstream_asset_id:
        raise ValueError("上游未返回 AssetId，无法创建真人素材")

    existing_result = await db.execute(
        select(LiveMaterialAsset).where(
            LiveMaterialAsset.user_id == user_id,
            LiveMaterialAsset.upstream_asset_id == upstream_asset_id,
        )
    )
    asset = existing_result.scalar_one_or_none()
    if asset is None:
        asset = LiveMaterialAsset(
            user_id=user_id,
            group_id=group.id,
            upstream_asset_id=upstream_asset_id,
            asset_type=normalized_asset_type,
            name=(name or "").strip() or None,
            status="Processing",
            source_url=str(url).strip(),
            preview_url=str(url).strip(),
            metadata_json=_merge_live_material_metadata(
                extra_metadata,
                {"create_asset_result": result},
            ),
        )
        db.add(asset)
    else:
        asset.group_id = group.id
        asset.asset_type = normalized_asset_type
        asset.name = (name or "").strip() or asset.name
        asset.status = "Processing"
        asset.source_url = str(url).strip()
        asset.preview_url = str(url).strip()
        asset.metadata_json = _merge_live_material_metadata(
            _merge_live_material_metadata(asset.metadata_json, extra_metadata),
            {"create_asset_result": result},
        )
        asset.error_message = None
    await db.commit()
    await db.refresh(asset)
    return asset


async def refresh_live_material_asset_status(
    *,
    user_id: UUID,
    db: AsyncSession,
    asset: LiveMaterialAsset,
) -> LiveMaterialAsset:
    api_key, base_url = await _resolve_onelink_credentials(user_id, db)
    request_url = f"{base_url}/volc/openapi?Action=GetAsset&Version={VOLC_OPENAPI_VERSION}"
    payload = {"AssetId": asset.upstream_asset_id}
    async with upstream_async_client(profile="provider", timeout=60.0, follow_redirects=True) as client:
        try:
            response = await client.post(request_url, headers=_headers(api_key), json=payload)
            response.raise_for_status()
        except Exception as exc:
            log_upstream_failure(
                profile="provider",
                operation="live-material-get-asset",
                exc=exc,
                context={"user_id": str(user_id), "asset_id": str(asset.id)},
            )
            raise
    data = _coerce_payload(response)
    result = _extract_result(data)
    asset.status = str(result.get("Status") or result.get("status") or asset.status or "Processing").strip() or "Processing"
    asset.error_message = str(result.get("Message") or result.get("message") or "").strip() or None
    asset.preview_url = (
        str(result.get("PreviewURL") or result.get("PreviewUrl") or result.get("URL") or result.get("Url") or asset.preview_url or "").strip()
        or asset.preview_url
    )
    asset.metadata_json = _merge_live_material_metadata(
        asset.metadata_json,
        {"get_asset_result": result},
    )
    await db.commit()
    await db.refresh(asset)
    return asset


async def resolve_live_material_attachments(
    *,
    user_id: UUID,
    db: AsyncSession,
    provider_params: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    normalized = normalize_live_material_provider_params(provider_params)
    if not normalized:
        return None, []

    asset_ids = normalized["asset_ids"]
    if not asset_ids:
        raise ValueError("已选择真人素材能力，但未提供素材 ID")

    asset_uuids: list[UUID] = []
    for item in asset_ids:
        try:
            asset_uuids.append(UUID(item))
        except Exception as exc:
            raise ValueError("真人素材 ID 非法") from exc

    result = await db.execute(
        select(LiveMaterialAsset, LiveMaterialGroup)
        .join(LiveMaterialGroup, LiveMaterialGroup.id == LiveMaterialAsset.group_id)
        .where(
            LiveMaterialAsset.user_id == user_id,
            LiveMaterialAsset.id.in_(asset_uuids),
            LiveMaterialGroup.user_id == user_id,
        )
    )
    rows = result.all()
    if len(rows) != len(asset_uuids):
        raise ValueError("存在不属于当前用户的真人素材，无法提交生成")

    expected_group_id = normalized.get("group_id")
    resolved_group_id: str | None = None
    attachments: list[dict[str, Any]] = []
    resolved_asset_ids: list[str] = []
    for asset, group in rows:
        if expected_group_id and str(group.id) != expected_group_id:
            raise ValueError("所选真人素材与指定真人素材组不一致")
        if str(asset.status or "").strip().lower() != "active":
            raise ValueError("所选真人素材尚未就绪，请等待素材状态变为 Active 后重试")
        resolved_group_id = str(group.id)
        resolved_asset_ids.append(str(asset.id))
        attachments.append(
            {
                "asset_id": str(asset.id),
                "asset_type": asset.asset_type,
                "asset_name": asset.name,
                "url": _asset_ref_url(asset.upstream_asset_id),
                "role": (
                    "reference_image"
                    if asset.asset_type == "image"
                    else "reference_video"
                    if asset.asset_type == "video"
                    else "reference_audio"
                ),
                "source": "live_material",
            }
        )

    resolved_meta = {
        "group_id": resolved_group_id,
        "asset_ids": resolved_asset_ids,
        "group_type": normalized.get("group_type") or LIVE_MATERIAL_GROUP_TYPE,
    }
    return resolved_meta, attachments
