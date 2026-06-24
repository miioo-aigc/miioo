import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse, urlunparse


VOLCENGINE_VOICE_DEFAULT_CLUSTER = "volcano_tts"
VOLCENGINE_VOICE_DEFAULT_ENCODING = "mp3"
VOLCENGINE_VOICE_DEFAULT_FRONTEND_TYPE = "unitTson"
VOLCENGINE_VOICE_DEFAULT_AUTH_STYLE = "bearer_semicolon"
VOLCENGINE_VOICE_REQUEST_PATH = "/api/v1/tts"


@dataclass
class VolcengineVoiceCredentials:
    token: str
    appid: str | None
    cluster: str
    voice_type: str | None = None
    auth_style: str = VOLCENGINE_VOICE_DEFAULT_AUTH_STYLE


def _coerce_mapping(raw_value: str) -> dict[str, str] | None:
    text = (raw_value or "").strip()
    if not text:
        return None

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None

    if isinstance(parsed, dict):
        return {str(key).strip().lower(): str(value).strip() for key, value in parsed.items()}

    if "=" not in text:
        return None

    result: dict[str, str] = {}
    for segment in text.replace("\n", ";").split(";"):
        item = segment.strip()
        if not item or "=" not in item:
            continue
        key, value = item.split("=", 1)
        cleaned_key = key.strip().lower()
        cleaned_value = value.strip()
        if cleaned_key and cleaned_value:
            result[cleaned_key] = cleaned_value
    return result or None


def _pick_value(mapping: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        value = mapping.get(key)
        if value:
            return value
    return None


def parse_volcengine_voice_runtime(
    api_key: str,
    base_url: str | None,
    *,
    default_voice_type: str | None = None,
) -> tuple[VolcengineVoiceCredentials, str]:
    raw_base_url = (base_url or "").strip()
    parsed_url = urlparse(raw_base_url)
    query_params = parse_qs(parsed_url.query, keep_blank_values=False)
    normalized_query = {
        key.strip().lower(): values[-1].strip()
        for key, values in query_params.items()
        if key and values and str(values[-1]).strip()
    }
    key_mapping = _coerce_mapping(api_key) or {}

    token = (
        _pick_value(
            key_mapping,
            "token",
            "access_token",
            "api_key",
            "voice_api_key",
            "accesskey",
            "access_key",
        )
        or api_key.strip()
    )
    appid = _pick_value(key_mapping, "appid", "app_id", "api_app_id") or normalized_query.get("appid")
    cluster = (
        _pick_value(key_mapping, "cluster", "resource_id")
        or normalized_query.get("cluster")
        or normalized_query.get("resource_id")
        or VOLCENGINE_VOICE_DEFAULT_CLUSTER
    )
    voice_type = (
        _pick_value(key_mapping, "voice_type", "speaker", "speaker_id")
        or normalized_query.get("voice_type")
        or default_voice_type
    )
    auth_style = (
        _pick_value(key_mapping, "auth_style", "authorization_style")
        or normalized_query.get("auth")
        or normalized_query.get("auth_style")
        or VOLCENGINE_VOICE_DEFAULT_AUTH_STYLE
    ).strip().lower()

    sanitized_base_url = urlunparse(parsed_url._replace(query="", fragment="")) if raw_base_url else raw_base_url
    credentials = VolcengineVoiceCredentials(
        token=token,
        appid=appid,
        cluster=cluster,
        voice_type=voice_type,
        auth_style=auth_style,
    )
    return credentials, sanitized_base_url


def validate_volcengine_voice_credentials(credentials: VolcengineVoiceCredentials) -> None:
    if not credentials.token:
        raise ValueError("Volcengine Voice API Key 不能为空")
    if "*" in credentials.token:
        raise ValueError("Volcengine Voice API Key 是脱敏值，请重新输入真实凭证")
    if not credentials.appid:
        raise ValueError(
            "Volcengine 语音当前需要 appid；可在 Voice API Key 中填写 JSON，"
            "例如 {\"appid\":\"...\",\"token\":\"...\"}"
        )


def resolve_volcengine_voice_request_url(base_url: str | None) -> str:
    cleaned = (base_url or "").strip().rstrip("/")
    if cleaned.endswith(VOLCENGINE_VOICE_REQUEST_PATH):
        return cleaned
    return f"{cleaned}{VOLCENGINE_VOICE_REQUEST_PATH}"


def build_volcengine_voice_headers(credentials: VolcengineVoiceCredentials) -> dict[str, str]:
    auth_style = (credentials.auth_style or VOLCENGINE_VOICE_DEFAULT_AUTH_STYLE).strip().lower()
    if auth_style in {"x-api-access-key", "x_api_access_key"}:
        return {
            "X-Api-Access-Key": credentials.token,
            "Content-Type": "application/json",
        }
    if auth_style == "bearer":
        return {
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json",
        }
    return {
        "Authorization": f"Bearer;{credentials.token}",
        "Content-Type": "application/json",
    }


def build_volcengine_voice_payload(
    *,
    text: str,
    appid: str,
    token: str,
    cluster: str,
    voice_type: str,
    speed_ratio: float,
    volume_ratio: float,
    pitch_ratio: float,
    encoding: str = VOLCENGINE_VOICE_DEFAULT_ENCODING,
    uid: str,
    reqid: str,
) -> dict[str, Any]:
    return {
        "app": {
            "appid": appid,
            "token": token,
            "cluster": cluster,
        },
        "user": {
            "uid": uid,
        },
        "audio": {
            "voice_type": voice_type,
            "encoding": encoding,
            "speed_ratio": speed_ratio,
            "volume_ratio": volume_ratio,
            "pitch_ratio": pitch_ratio,
        },
        "request": {
            "reqid": reqid,
            "text": text,
            "text_type": "plain",
            "operation": "query",
            "with_frontend": 1,
            "frontend_type": VOLCENGINE_VOICE_DEFAULT_FRONTEND_TYPE,
        },
    }
