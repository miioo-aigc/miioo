import httpx

from app.services.fal_runtime import FAL_BASE_URL
from app.services.http_client import log_upstream_failure, upstream_async_client
from app.services.minimax_presets import MINIMAX_BASE_URL
from app.services.volcengine_presets import VOLCENGINE_ARK_BASE_URL, VOLCENGINE_VOICE_BASE_URL
from app.services.volcengine_voice_runtime import (
    build_volcengine_voice_headers,
    build_volcengine_voice_payload,
    parse_volcengine_voice_runtime,
    resolve_volcengine_voice_request_url,
    validate_volcengine_voice_credentials,
)
from app.services.vidu_presets import VIDU_BASE_URL
from app.utils.encryption import decrypt_api_key
from app.utils.onelink_base_url import (
    get_onelink_openai_compat_base_url,
    normalize_onelink_base_url,
)
from app.utils.url_security import validate_outbound_url

AIPING_DEFAULT_BASE_URL = "https://aiping.cn/api"
AIPING_TEST_MODEL = "MiniMax-Speech-2.8-hd"
AIPING_TEST_VOICE_ID = "male-qn-qingse"
MINIMAX_TEST_MODEL = "speech-2.8-hd"
MINIMAX_TEST_VOICE_ID = "male-qn-qingse"
VOLCENGINE_TEST_MODEL = "doubao-seed-2-0-lite-260215"
VOLCENGINE_TEST_VOICE_ID = "zh_female_tianmeixiaoyuan_moon_bigtts"


def _resolve_aiping_test_url(base_url: str | None) -> str:
    cleaned = (base_url or "").strip() or AIPING_DEFAULT_BASE_URL
    trimmed = cleaned.rstrip("/")
    if trimmed.endswith("/api/v1") or trimmed.endswith("/v1"):
        return f"{trimmed}/audio/speech"
    if trimmed.endswith("/api"):
        return f"{trimmed}/v1/audio/speech"
    return f"{trimmed}/api/v1/audio/speech"


def _get_valid_api_key(api_key_encrypted: str) -> str:
    api_key = decrypt_api_key(api_key_encrypted)
    if not api_key.strip():
        raise ValueError("未配置有效 API Key")
    if "*" in api_key:
        raise ValueError("数据库中保存的是脱敏 API Key，请重新输入真实 API Key 后再测试")
    return api_key


async def _test_openai_compatible_connection(
    base_url: str,
    api_key: str,
) -> tuple[bool, str]:
    normalized_base_url = get_onelink_openai_compat_base_url(
        normalize_onelink_base_url(base_url)
    )
    safe_base_url = validate_outbound_url(
        normalized_base_url,
        label="服务商 Base URL",
    )
    url = f"{safe_base_url.rstrip('/')}/v1/models"
    async with upstream_async_client(profile="provider", timeout=10.0) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
        if resp.status_code == 200:
            return True, "连接成功"
        return False, f"服务商返回错误: {resp.status_code}"


async def _test_aiping_connection(base_url: str, api_key: str) -> tuple[bool, str]:
    safe_base_url = validate_outbound_url(
        (base_url or "").strip() or AIPING_DEFAULT_BASE_URL,
        label="服务商 Base URL",
    )
    url = _resolve_aiping_test_url(safe_base_url)
    payload = {
        "model": AIPING_TEST_MODEL,
        "text": "连接测试",
        "stream": False,
        "voice_setting": {
            "voice_id": AIPING_TEST_VOICE_ID,
            "speed": 1,
            "vol": 1,
            "pitch": 0,
        },
    }
    async with upstream_async_client(profile="provider", timeout=20.0) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            return False, f"服务商返回错误: {resp.status_code}"

        data = resp.json()
        base_resp = data.get("base_resp") or {}
        status_code = base_resp.get("status_code", 0)
        if status_code in (0, "0", None):
            return True, "连接成功"
        return False, base_resp.get("status_msg") or "AI Ping 连接失败"


async def _test_minimax_connection(base_url: str, api_key: str) -> tuple[bool, str]:
    safe_base_url = validate_outbound_url(
        (base_url or "").strip() or MINIMAX_BASE_URL,
        label="MiniMax Base URL",
    )
    url = f"{safe_base_url.rstrip('/')}/v1/t2a_v2"
    payload = {
        "model": MINIMAX_TEST_MODEL,
        "text": "连接测试",
        "stream": False,
        "voice_setting": {
            "voice_id": MINIMAX_TEST_VOICE_ID,
            "speed": 1,
            "vol": 1,
            "pitch": 0,
        },
    }
    async with upstream_async_client(profile="provider", timeout=20.0) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            if resp.status_code in {401, 403}:
                return False, "MiniMax API Key 无效或无权限"
            return False, f"MiniMax 返回错误: {resp.status_code}"

        data = resp.json()
        base_resp = data.get("base_resp") or {}
        status_code = base_resp.get("status_code", 0)
        if status_code in (0, "0", None):
            return True, "MiniMax 连接成功"
        return False, base_resp.get("status_msg") or "MiniMax 连接失败"


async def _test_vidu_connection(base_url: str, api_key: str) -> tuple[bool, str]:
    safe_base_url = validate_outbound_url(
        (base_url or "").strip() or VIDU_BASE_URL,
        label="服务商 Base URL",
    )
    url = f"{safe_base_url.rstrip('/')}/ent/v2/tasks/connection-test/creations"
    async with upstream_async_client(profile="provider", timeout=10.0) as client:
        resp = await client.get(
            url,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code in {200, 400, 404}:
            return True, "连接成功"
        if resp.status_code in {401, 403}:
            return False, "Vidu API Key 无效或无权限"
        return False, f"服务商返回错误: {resp.status_code}"


async def _test_fal_connection(base_url: str, api_key: str) -> tuple[bool, str]:
    safe_base_url = validate_outbound_url(
        (base_url or "").strip() or FAL_BASE_URL,
        label="fal Platform Base URL",
    )
    url = f"{safe_base_url.rstrip('/')}/v1/models?limit=1"
    async with upstream_async_client(profile="provider", timeout=10.0) as client:
        resp = await client.get(
            url,
            headers={
                "Authorization": f"Key {api_key}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code == 200:
            return True, "fal 连接成功"
        if resp.status_code in {401, 403}:
            return False, "fal API Key 无效或无权限"
        return False, f"fal 返回错误: {resp.status_code}"


async def _test_volcengine_ark_connection(base_url: str, api_key: str) -> tuple[bool, str]:
    safe_base_url = validate_outbound_url(
        (base_url or "").strip() or VOLCENGINE_ARK_BASE_URL,
        label="Volcengine Ark Base URL",
    )
    url = f"{safe_base_url.rstrip('/')}/v1/models"
    async with upstream_async_client(profile="provider", timeout=10.0) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
        if resp.status_code == 200:
            return True, "Ark 连接成功"
        if resp.status_code in {401, 403}:
            return False, "Ark API Key 无效或无权限"
        return False, f"Ark 返回错误: {resp.status_code}"


async def _test_volcengine_voice_connection(base_url: str | None, api_key: str) -> tuple[bool, str]:
    credentials, sanitized_base_url = parse_volcengine_voice_runtime(
        api_key,
        base_url or VOLCENGINE_VOICE_BASE_URL,
        default_voice_type=VOLCENGINE_TEST_VOICE_ID,
    )
    validate_volcengine_voice_credentials(credentials)
    safe_base_url = validate_outbound_url(
        (sanitized_base_url or "").strip() or VOLCENGINE_VOICE_BASE_URL,
        label="Volcengine Voice Base URL",
    )
    request_url = resolve_volcengine_voice_request_url(safe_base_url)
    payload = build_volcengine_voice_payload(
        text="连接测试",
        appid=credentials.appid or "",
        token=credentials.token,
        cluster=credentials.cluster,
        voice_type=credentials.voice_type or VOLCENGINE_TEST_VOICE_ID,
        speed_ratio=1.0,
        volume_ratio=1.0,
        pitch_ratio=1.0,
        uid="connection-test",
        reqid="connection-test",
    )
    async with upstream_async_client(profile="provider", timeout=20.0) as client:
        resp = await client.post(
            request_url,
            headers=build_volcengine_voice_headers(credentials),
            json=payload,
        )
        if resp.status_code != 200:
            if resp.status_code in {401, 403}:
                return False, "Voice API Key 无效或无权限"
            return False, f"Voice 返回错误: {resp.status_code}"

        data = resp.json()
        code = data.get("code")
        if code in {3000, "3000", 0, "0", None} and data.get("data"):
            return True, "Voice 连接成功"
        return False, data.get("message") or data.get("msg") or "Voice 连接失败"


async def test_provider_connection(
    base_url: str,
    api_key_encrypted: str,
    *,
    provider_type: str | None = None,
    secondary_base_url: str | None = None,
    secondary_api_key_encrypted: str | None = None,
) -> tuple[bool, str]:
    normalized_provider_type = (provider_type or "").strip().lower() or "openai_compatible"
    try:
        api_key = _get_valid_api_key(api_key_encrypted)
        if normalized_provider_type == "aiping":
            return await _test_aiping_connection(base_url, api_key)
        if normalized_provider_type == "minimax":
            return await _test_minimax_connection(base_url, api_key)
        if normalized_provider_type == "vidu":
            return await _test_vidu_connection(base_url, api_key)
        if normalized_provider_type == "fal":
            return await _test_fal_connection(base_url, api_key)
        if normalized_provider_type == "volcengine":
            ark_success, ark_message = await _test_volcengine_ark_connection(base_url, api_key)
            if not secondary_api_key_encrypted:
                if ark_success:
                    return False, "Ark 已连通，但缺少 Voice API Key"
                return False, ark_message
            secondary_api_key = _get_valid_api_key(secondary_api_key_encrypted)
            voice_success, voice_message = await _test_volcengine_voice_connection(
                secondary_base_url,
                secondary_api_key,
            )
            if ark_success and voice_success:
                return True, "Ark / Voice 双端连接成功"
            if not ark_success and not voice_success:
                return False, f"{ark_message}；{voice_message}"
            if not ark_success:
                return False, f"{ark_message}；{voice_message}"
            return False, f"{ark_message}；{voice_message}"
        return await _test_openai_compatible_connection(base_url, api_key)
    except httpx.TimeoutException as exc:
        log_upstream_failure(
            profile="provider",
            operation="provider_connection_test",
            exc=exc,
            context={
                "provider_type": normalized_provider_type,
                "base_url": base_url,
                "secondary_base_url": secondary_base_url,
            },
        )
        return False, "连接超时，请检查 Base URL"
    except ValueError as exc:
        return False, str(exc)
    except Exception as exc:
        detail = log_upstream_failure(
            profile="provider",
            operation="provider_connection_test",
            exc=exc,
            context={
                "provider_type": normalized_provider_type,
                "base_url": base_url,
                "secondary_base_url": secondary_base_url,
            },
        )
        status_code = detail.get("status_code")
        if status_code is not None:
            return False, f"连接失败(category={detail['category']}, status={status_code})"
        return False, f"连接失败(category={detail['category']})"
