import asyncio
import base64
import hashlib
import ipaddress
import json
import mimetypes
import re
import time
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.config import settings
from app.services.http_client import upstream_async_client
from app.services.model_capabilities import validate_asset_bindings
from app.services.fal_runtime import (
    FAL_STABLE_VIDEO_MODEL_ID,
    FAL_WAN_FLF2V_MODEL_ID,
    FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
    FAL_KLING_V3_STANDARD_MOTION_CONTROL_MODEL_ID,
    FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
    extract_fal_video_payload,
    is_fal_kling_motion_control_model,
    is_fal_video_model,
    run_fal_job,
)
from app.services.media_storage import (
    extract_managed_or_private_upload_url,
    get_media_fallback_extension,
    persist_remote_file,
    resolve_upload_path,
)
from app.services.reference_audio_proxy import (
    REFERENCE_AUDIO_MAX_DURATION_SECONDS,
    validate_seedance_reference_audio_duration,
)
from app.services.reference_video_proxy import prepare_local_reference_video_for_upstream


def _log(msg: str):
    print(f"[VIDEO_GEN] {msg}")


def _debug_secret_fingerprint(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def _emit_video_tail_frame_debug(
    *,
    hypothesis_id: str,
    location: str,
    msg: str,
    data: dict[str, Any] | None = None,
    trace_id: str | None = None,
) -> None:
    try:
        debug_url = "http://127.0.0.1:7777/event"
        debug_session = "video-tail-frame-401"
        try:
            with open(".dbg/video-tail-frame-401.env", "r", encoding="utf-8") as debug_file:
                for debug_line in debug_file.read().splitlines():
                    if debug_line.startswith("DEBUG_SERVER_URL="):
                        debug_url = debug_line.split("=", 1)[1] or debug_url
                    elif debug_line.startswith("DEBUG_SESSION_ID="):
                        debug_session = debug_line.split("=", 1)[1] or debug_session
        except Exception:
            pass
        payload = {
            "sessionId": debug_session,
            "runId": "pre-fix",
            "hypothesisId": hypothesis_id,
            "location": location,
            "msg": msg,
            "data": data or {},
        }
        if trace_id:
            payload["traceId"] = trace_id
        urllib.request.urlopen(
            urllib.request.Request(
                debug_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            ),
            timeout=1,
        ).read()
    except Exception:
        pass


class VideoGenService:
    def __init__(self):
        self.video_task_max_wait_seconds = max(int(settings.VIDEO_TASK_MAX_WAIT_SECONDS), 1)
        self.video_task_poll_interval_seconds = max(int(settings.VIDEO_TASK_POLL_INTERVAL_SECONDS), 1)

    def _resolve_polling_seconds(
        self,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> tuple[int, int]:
        resolved_max_wait = (
            self.video_task_max_wait_seconds if max_wait is None else max(int(max_wait), 1)
        )
        resolved_poll_interval = (
            self.video_task_poll_interval_seconds
            if poll_interval is None
            else max(int(poll_interval), 1)
        )
        return resolved_max_wait, resolved_poll_interval

    def _headers(self, api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _build_http_timeout(
        self,
        *,
        connect: float = 30.0,
        read: float = 180.0,
        write: float = 60.0,
        pool: float = 60.0,
    ) -> httpx.Timeout:
        return httpx.Timeout(connect=connect, read=read, write=write, pool=pool)

    def _is_seedance_retryable_submit_error(
        self,
        *,
        status_code: int | None = None,
        message: str | None = None,
    ) -> bool:
        normalized_message = str(message or "").strip().lower()
        if status_code in {408, 429, 500, 502, 503, 504}:
            return True
        return any(
            keyword in normalized_message
            for keyword in (
                "request timeout",
                "timeout awaiting response headers",
                "upstream",
                "gateway timeout",
                "timed out",
            )
        )

    def _contains_seedance_remote_media_references(
        self,
        attachments: list[dict] | None,
    ) -> bool:
        if not attachments:
            return False
        return any(
            attachment.get("asset_type") in {"video", "audio"}
            for attachment in attachments
        )

    def _extract_first_json_object(self, raw_text: str | None) -> str | None:
        text = str(raw_text or "").strip()
        start = text.find("{")
        if start < 0:
            return None

        depth = 0
        for index in range(start, len(text)):
            char = text[index]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return text[start : index + 1]
        return None

    def _parse_json_object(self, raw_text: str | None) -> dict | None:
        if raw_text is None:
            return None
        text = str(raw_text).strip()
        if not text:
            return None

        candidates = [text]
        first_json_object = self._extract_first_json_object(text)
        if first_json_object and first_json_object != text:
            candidates.append(first_json_object)

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed
        return None

    def _extract_seedance_upstream_error(
        self,
        response_text: str | None,
    ) -> tuple[dict | None, dict | None]:
        outer_payload = self._parse_json_object(response_text)
        inner_payload: dict | None = None
        if isinstance(outer_payload, dict):
            outer_error = outer_payload.get("error")
            if isinstance(outer_error, dict):
                inner_payload = self._parse_json_object(outer_error.get("message"))
        return outer_payload, inner_payload

    def _resolve_seedance_content_binding(
        self,
        param: str | None,
        asset_bindings: list[dict] | None,
    ) -> dict | None:
        if not param or not asset_bindings:
            return None
        matched = re.search(r"content\[(\d+)\]", str(param))
        if not matched:
            return None
        content_index = int(matched.group(1))
        asset_index = content_index - 1
        if asset_index < 0 or asset_index >= len(asset_bindings):
            return None
        binding = asset_bindings[asset_index]
        return binding if isinstance(binding, dict) else None

    def _describe_seedance_binding(self, binding: dict | None) -> str:
        if not binding:
            return "参考素材"
        media_label_map = {
            "image": "参考图片",
            "video": "参考视频",
            "audio": "参考音频",
            "speech": "台词与旁白",
        }
        media_label = media_label_map.get(str(binding.get("asset_type") or "").strip(), "参考素材")
        display_name = (
            str(binding.get("asset_name") or "").strip()
            or str(binding.get("resolved_token") or "").strip()
        )
        if display_name:
            return f"{media_label}「{display_name}」"
        return media_label

    def _format_seedance_submit_error(
        self,
        *,
        response_text: str | None,
        model: str,
        asset_bindings: list[dict] | None = None,
    ) -> str:
        outer_payload, inner_payload = self._extract_seedance_upstream_error(response_text)
        inner_error = inner_payload.get("error") if isinstance(inner_payload, dict) else None
        if not isinstance(inner_error, dict):
            return f"message={response_text}"

        upstream_message = str(inner_error.get("message") or "").strip()
        upstream_code = str(inner_error.get("code") or "").strip()
        param = str(inner_error.get("param") or "").strip() or None
        binding = self._resolve_seedance_content_binding(param, asset_bindings)
        binding_label = self._describe_seedance_binding(binding)
        request_id_match = re.search(r"Request id:\s*([A-Za-z0-9]+)", upstream_message)
        request_id = request_id_match.group(1) if request_id_match else None
        outer_req_id = None
        if isinstance(outer_payload, dict):
            outer_req_id = str(
                outer_payload.get("req_id")
                or outer_payload.get("request_id")
                or ""
            ).strip() or None
        trace_suffix_parts = []
        if param:
            trace_suffix_parts.append(f"参数位置：{param}")
        if request_id:
            trace_suffix_parts.append(f"Request id: {request_id}")
        elif outer_req_id:
            trace_suffix_parts.append(f"req_id: {outer_req_id}")
        trace_suffix = f"（{'；'.join(trace_suffix_parts)}）" if trace_suffix_parts else ""

        normalized_message = upstream_message.lower()
        normalized_code = upstream_code.lower()
        if (
            normalized_code == "inputimagesensitivecontentdetected.privacyinformation"
            or "may contain real person" in normalized_message
            or "real person" in normalized_message
        ):
            image_binding_label = (
                binding_label
                if binding and str(binding.get("asset_type") or "").strip() == "image"
                else "输入图片/参考图片"
            )
            return (
                f"{image_binding_label} 命中平台真人肖像/隐私风控，当前模型无法处理可能包含真人面部、"
                "自拍、证件照或他人真实肖像的图片素材。"
                "请改用动漫、插画、3D 虚拟人物、风景、静物等非真人图片重新生成；"
                "若必须保留当前构图，请先裁掉或彻底脱敏人脸区域后再试。"
                f"若确认素材并非真人，也可携带错误码 `{upstream_code or 'InputImageSensitiveContentDetected.PrivacyInformation'}`"
                " 与对应 Request id 联系服务商申诉复核。"
                f"{trace_suffix}"
            )

        if (
            "video pixel count specified in the request must be less than or equal to"
            in normalized_message
        ):
            limit_match = re.search(
                r"must be less than or equal to\s+(\d+)",
                upstream_message,
                re.IGNORECASE,
            )
            limit_value = limit_match.group(1) if limit_match else None
            limit_hint = (
                f"不超过 {limit_value} 像素（约等于 1920x1080）"
                if limit_value
                else "不超过上游允许的像素阈值"
            )
            model_hint = f"模型 `{model}` " if model else ""
            return (
                f"{binding_label} 像素过大，当前{model_hint}在该请求下要求参考视频总像素"
                f"{limit_hint}。输出分辨率选 720P/480P 并不会自动压低参考视频本身的像素，"
                "请先将参考视频压缩到 1080P 或更低后重试。"
                f"{trace_suffix}"
            )

        if (
            "audio duration (seconds) specified in the request must be less than or equal to"
            in normalized_message
        ):
            limit_match = re.search(
                r"must be less than or equal to\s+(\d+(?:\.\d+)?)",
                upstream_message,
                re.IGNORECASE,
            )
            limit_value = limit_match.group(1) if limit_match else f"{REFERENCE_AUDIO_MAX_DURATION_SECONDS:g}"
            return (
                f"{binding_label} 时长超过 Seedance 上限 {limit_value} 秒，请裁短到 15 秒内后重试。"
                f"{trace_suffix}"
            )

        if upstream_message:
            return f"{binding_label} 参数不合法：{upstream_message}{trace_suffix}"
        return f"message={response_text}"

    def _normalize_attachment_duration(self, duration: Any) -> float | None:
        try:
            parsed = float(duration)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    def _build_seedance_trace(
        self,
        *,
        speech_text: str | None,
        reference_audio_url: str | None,
        generate_audio: bool | None,
        asset_bindings: list[dict] | None,
    ) -> dict:
        return {
            "speech_text_present": bool(str(speech_text or "").strip()),
            "reference_audio_present": bool(str(reference_audio_url or "").strip()),
            "generate_audio": True if generate_audio is None else bool(generate_audio),
            "asset_binding_count": len(asset_bindings or []),
        }

    def _is_official_vidu_base_url(self, base_url: str) -> bool:
        hostname = (urlsplit(base_url).hostname or "").strip().lower()
        return hostname in {"api.vidu.cn", "www.api.vidu.cn"}

    def _vidu_headers(self, api_key: str, base_url: str) -> dict[str, str]:
        auth_scheme = "Token" if self._is_official_vidu_base_url(base_url) else "Bearer"
        return {
            "Authorization": f"{auth_scheme} {api_key}",
            "Content-Type": "application/json",
        }

    def _vidu_api_url(self, base_url: str, path: str) -> str:
        prefix = "" if self._is_official_vidu_base_url(base_url) else "/vidu"
        return f"{base_url.rstrip('/')}{prefix}{path}"

    def _normalize_kling_model(self, model: str) -> str:
        normalized = (model or "").strip().lower()
        if normalized in {"video-kling-v3", "video-kling-v3-omni"}:
            return normalized
        if normalized in {"kling-v2-6", "kling-v1", "kling-v1-6", "kling-v3"}:
            return "video-kling-v3"
        if normalized in {"kling-video-o1", "kling-v3-omni"}:
            return "video-kling-v3-omni"
        return normalized

    def _normalize_seedance_model(self, model: str) -> str:
        return (model or "").strip().lower()

    def _is_vidu_model(self, model: str) -> bool:
        normalized = str(model or "").strip().lower()
        return normalized.startswith("video-vidu") or normalized.startswith("vidu")

    def _is_seedance_model(self, model: str) -> bool:
        return self._normalize_seedance_model(model).startswith("doubao-seedance")

    def _is_happyhorse_model(self, model: str) -> bool:
        return model in {
            "happyhorse-1.0-t2v",
            "happyhorse-1.0-i2v",
            "happyhorse-1.0-r2v",
            "happyhorse-1.0-video-edit",
        }

    def _normalize_veo_model(self, model: str) -> str:
        return str(model or "").strip().lower()

    def _is_veo_model(self, model: str) -> bool:
        return self._normalize_veo_model(model) == "veo-3.1-generate-preview"

    def _is_fal_model(self, model: str) -> bool:
        return is_fal_video_model(str(model or "").strip().lower())

    def _get_kling_route_config(
        self,
        model: str,
        *,
        image_count: int = 0,
        has_reference_video: bool = False,
        reference_mode: str | None = None,
    ) -> dict[str, str] | None:
        normalized_model = self._normalize_kling_model(model)
        if normalized_model == "video-kling-v3-omni":
            return {
                "route": "omni-video",
                "model_name": "video-kling-v3-omni",
                "submit_path": "/kling/v1/videos/omni-video",
                "query_path": "/kling/v1/videos/omni-video/{task_id}",
                "default_mode": "pro",
                "task_label": "Kling omni-video",
            }
        if normalized_model == "video-kling-v3":
            normalized_reference_mode = str(reference_mode or "").strip()
            if has_reference_video or normalized_reference_mode == "video_ref":
                raise ValueError("video-kling-v3 不支持参考视频驱动；请改用 video-kling-v3-omni")
            if image_count >= 2:
                return {
                    "route": "multi-image2video",
                    "model_name": "video-kling-v3",
                    "submit_path": "/kling/v1/videos/multi-image2video",
                    "query_path": "/kling/v1/videos/multi-image2video/{task_id}",
                    "default_mode": "std",
                    "task_label": "Kling multi-image2video",
                }
            if image_count >= 1 or normalized_reference_mode == "first_frame":
                return {
                    "route": "image2video",
                    "model_name": "video-kling-v3",
                    "submit_path": "/kling/v1/videos/image2video",
                    "query_path": "/kling/v1/videos/image2video/{task_id}",
                    "default_mode": "std",
                    "task_label": "Kling image2video",
                }
            return {
                "route": "text2video",
                "model_name": "video-kling-v3",
                "submit_path": "/kling/v1/videos/text2video",
                "query_path": "/kling/v1/videos/text2video/{task_id}",
                "default_mode": "pro",
                "task_label": "Kling text2video",
            }
        return None

    def _is_kling_model(self, model: str) -> bool:
        return self._get_kling_route_config(model) is not None

    def _normalize_kling_mode(self, value: str | None, *, default: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"std", "pro"}:
            return normalized
        return default

    def _normalize_kling_duration(self, value: float | str | None, *, default: str = "5") -> str:
        if value is None:
            return default
        if isinstance(value, (int, float)):
            return str(int(value))
        normalized = str(value).strip()
        if not normalized or normalized == "auto":
            return default
        try:
            return str(int(float(normalized)))
        except ValueError:
            return default

    def _collect_kling_image_urls(
        self,
        *,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        attachments: list[dict] | None = None,
    ) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()

        def _push(url: str | None) -> None:
            normalized = str(url or "").strip()
            if not normalized or normalized in seen:
                return
            seen.add(normalized)
            urls.append(normalized)

        _push(image_url)
        _push(first_frame_url)
        _push(last_frame_url)
        for attachment in attachments or []:
            asset_type = str(
                attachment.get("asset_type") or attachment.get("assetType") or ""
            ).strip().lower()
            if asset_type != "image":
                continue
            _push(attachment.get("url"))

        return urls

    def _is_cos_signed_url(self, url: str) -> bool:
        if not url:
            return False
        return "X-Tos-Algorithm" in url or "X-Tos-Credential" in url

    def _is_absolute_url(self, url: str) -> bool:
        return url.startswith("http://") or url.startswith("https://")

    def _is_http_url(self, url: str) -> bool:
        parsed = self._split_url(url)
        return bool(parsed and parsed.scheme.lower() == "http")

    def _is_data_uri(self, url: str) -> bool:
        return url.startswith("data:")

    def _split_url(self, url: str):
        try:
            return urlsplit(url)
        except ValueError:
            return None

    def _is_private_hostname(self, hostname: str | None) -> bool:
        if not hostname:
            return False

        normalized = hostname.strip().strip("[]").lower()
        if normalized in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
            return True
        if normalized.endswith(".local"):
            return True

        try:
            ip = ipaddress.ip_address(normalized)
        except ValueError:
            return False

        return ip.is_private or ip.is_loopback or ip.is_link_local

    def _get_public_upload_base_url(self) -> str | None:
        public_base_url = settings.effective_public_base_url
        if not public_base_url:
            return None

        parsed = self._split_url(public_base_url)
        if parsed and self._is_private_hostname(parsed.hostname):
            return None
        return public_base_url.rstrip("/")

    def _is_https_required_for_upstream_media(self) -> bool:
        return bool(settings.UPSTREAM_MEDIA_REQUIRE_HTTPS)

    def _handle_http_only_upstream_media_url(
        self,
        url: str,
        media_label: str,
        *,
        source_label: str,
    ) -> None:
        if not self._is_absolute_url(url) or not self._is_http_url(url):
            return

        if self._is_https_required_for_upstream_media():
            raise ValueError(
                f"{media_label}当前仅有 HTTP 公网地址：{url}。"
                "当前已开启严格 HTTPS 模式，请先将 PUBLIC_BASE_URL 或素材外链升级为 HTTPS 后重试"
            )

        _log(
            f"{media_label} upstream URL is HTTP-only ({source_label}): {url}. "
            "Continuing in compatibility mode; HTTPS is strongly recommended for cloud deployments."
        )

    def _extract_local_upload_path(self, url: str) -> str | None:
        return extract_managed_or_private_upload_url(url)

    def _build_public_upload_url(self, url: str) -> str:
        public_base_url = self._get_public_upload_base_url()
        if not public_base_url:
            raise ValueError(
                "当前资源是本地 / 私网托管文件，但未配置外网可访问的 PUBLIC_BASE_URL，外部视频模型无法访问该资源"
            )
        return f"{public_base_url}{url}"

    def _build_data_uri(self, data: bytes, content_type: str) -> str:
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    def _decode_data_uri(self, value: str) -> tuple[bytes, str]:
        header, separator, data_part = value.partition(",")
        if not separator:
            raise ValueError("非法 data URI")
        metadata = header[5:]
        parts = [part.strip() for part in metadata.split(";") if part.strip()]
        content_type = next((part for part in parts if "/" in part), "application/octet-stream")
        encoded = base64.b64decode(data_part.strip()) if any(part.lower() == "base64" for part in parts) else data_part.encode("utf-8")
        return encoded, content_type

    def _resolve_local_upload_path(self, url: str) -> str:
        return str(resolve_upload_path(url))

    def _guess_image_content_type(self, path_or_url: str) -> str:
        guessed_type, _ = mimetypes.guess_type(path_or_url)
        return guessed_type or "image/jpeg"

    def _guess_content_type(self, path_or_url: str, default: str) -> str:
        guessed_type, _ = mimetypes.guess_type(path_or_url)
        return guessed_type or default

    def _describe_external_image(self, value: str) -> str:
        if self._is_data_uri(value):
            return "data-uri"
        return value

    async def _read_binary_from_media_url(
        self,
        url: str,
        client: httpx.AsyncClient,
        *,
        default_content_type: str,
    ) -> tuple[bytes, str]:
        if not url:
            raise ValueError("媒体地址不能为空")

        if self._is_data_uri(url):
            return self._decode_data_uri(url)

        local_upload_path = self._extract_local_upload_path(url)
        if local_upload_path:
            file_path = self._resolve_local_upload_path(local_upload_path)
            with open(file_path, "rb") as file:
                return file.read(), self._guess_content_type(file_path, default_content_type)

        if url.startswith("/uploads/"):
            file_path = self._resolve_local_upload_path(url)
            with open(file_path, "rb") as file:
                return file.read(), self._guess_content_type(file_path, default_content_type)

        if not self._is_absolute_url(url):
            raise ValueError(f"不支持的媒体地址格式: {url}")

        resp = await client.get(url)
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").split(";", 1)[0].strip()
        return resp.content, content_type or self._guess_content_type(url, default_content_type)

    async def _build_veo_inline_media_part(
        self,
        url: str,
        client: httpx.AsyncClient,
    ) -> dict[str, str]:
        content, content_type = await self._read_binary_from_media_url(
            url,
            client,
            default_content_type="image/jpeg",
        )
        return {
            "bytesBase64Encoded": base64.b64encode(content).decode("ascii"),
            "mimeType": content_type,
        }

    def _collect_veo_reference_image_urls(
        self,
        *,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        attachments: list[dict] | None = None,
        exclude_urls: set[str] | None = None,
    ) -> list[str]:
        urls: list[str] = []
        seen = set(exclude_urls or set())

        def _push(url: str | None) -> None:
            normalized = str(url or "").strip()
            if not normalized or normalized in seen:
                return
            seen.add(normalized)
            urls.append(normalized)

        _push(image_url)
        _push(first_frame_url)
        _push(last_frame_url)
        for attachment in attachments or []:
            asset_type = str(
                attachment.get("asset_type") or attachment.get("assetType") or ""
            ).strip().lower()
            if asset_type != "image":
                continue
            _push(attachment.get("url"))
        return urls

    def _normalize_veo_duration(self, duration: float | int | str | None) -> int:
        if duration is None:
            return 8
        if isinstance(duration, str):
            raw = duration.strip().lower()
            if not raw or raw == "auto":
                return 8
            return int(float(raw))
        return int(duration)

    def _normalize_veo_resolution(self, resolution: str | None) -> str:
        normalized = str(resolution or "").strip().upper()
        if normalized in {"720P", "1080P", "4K"}:
            return normalized
        return "720P"

    def _build_veo_operation_url(self, base_url: str, operation_name: str) -> str:
        normalized = str(operation_name or "").strip()
        if not normalized:
            raise ValueError("缺少 Veo operation name")
        if self._is_absolute_url(normalized):
            return normalized
        normalized = normalized.lstrip("/")
        if normalized.startswith("v1beta/"):
            return f"{base_url.rstrip('/')}/{normalized}"
        if normalized.startswith("operations/"):
            return f"{base_url.rstrip('/')}/v1beta/{normalized}"
        return f"{base_url.rstrip('/')}/v1beta/operations/{normalized}"

    def _extract_veo_operation_result(self, data: dict) -> dict[str, str | None]:
        video_uri = self._pick_nested_value(
            data,
            [
                "response.generateVideoResponse.generatedSamples.0.video.uri",
                "response.generateVideoResponse.generatedVideos.0.video.uri",
                "response.generated_videos.0.video.uri",
                "response.generatedVideos.0.video.uri",
                "response.generated_samples.0.video.uri",
                "response.generatedSamples.0.video.uri",
                "generateVideoResponse.generatedSamples.0.video.uri",
            ],
        )
        video_b64 = self._pick_nested_value(
            data,
            [
                "response.generateVideoResponse.generatedSamples.0.video.bytesBase64Encoded",
                "response.generateVideoResponse.generatedVideos.0.video.bytesBase64Encoded",
                "response.generated_videos.0.video.bytesBase64Encoded",
                "response.generatedVideos.0.video.bytesBase64Encoded",
                "response.generatedSamples.0.video.bytesBase64Encoded",
            ],
        )
        thumbnail_uri = self._pick_nested_value(
            data,
            [
                "response.generateVideoResponse.generatedSamples.0.poster.uri",
                "response.generateVideoResponse.generatedSamples.0.thumbnail.uri",
                "response.generateVideoResponse.generatedVideos.0.poster.uri",
                "response.generatedVideos.0.poster.uri",
                "response.generated_videos.0.poster.uri",
            ],
        )
        error = self._pick_nested_value(
            data,
            [
                "error.message",
                "error.details.0.message",
                "error",
            ],
        )
        if isinstance(error, dict):
            error = self._pick_nested_value(error, ["message", "detail"]) or str(error)
        return {
            "video_uri": str(video_uri).strip() if video_uri else None,
            "video_b64": str(video_b64).strip() if video_b64 else None,
            "thumbnail_uri": str(thumbnail_uri).strip() if thumbnail_uri else None,
            "error": str(error).strip() if error else None,
        }

    async def _download_protected_veo_video(
        self,
        video_uri: str,
        *,
        api_key: str,
        base_url: str,
        client: httpx.AsyncClient,
    ) -> str:
        parsed = self._split_url(video_uri)
        candidate_urls = [video_uri]
        if parsed and parsed.path.startswith("/v1beta/"):
            candidate_urls.append(f"{base_url.rstrip('/')}{parsed.path}" + (f"?{parsed.query}" if parsed.query else ""))
        elif not self._is_absolute_url(video_uri):
            candidate_urls.append(f"{base_url.rstrip('/')}/{video_uri.lstrip('/')}")

        last_error: Exception | None = None
        for candidate in dict.fromkeys(candidate_urls):
            try:
                resp = await client.get(
                    candidate,
                    headers={"Authorization": f"Bearer {api_key}"},
                    follow_redirects=True,
                )
                resp.raise_for_status()
                content_type = (resp.headers.get("content-type") or "").split(";", 1)[0].strip()
                return self._build_data_uri(
                    resp.content,
                    content_type or self._guess_content_type(candidate, "video/mp4"),
                )
            except Exception as exc:
                last_error = exc
        raise Exception(f"Veo 视频下载失败: {last_error}")

    def _normalize_happyhorse_duration(self, duration: float | str) -> int | float:
        if isinstance(duration, str):
            raw = duration.strip().lower()
            if not raw or raw == "auto":
                return 5
            return int(float(raw))
        return int(duration)

    def _normalize_vidu_duration(self, duration: float | int | str) -> int:
        if isinstance(duration, str):
            raw = duration.strip().lower()
            if not raw or raw == "auto":
                return 5
            return int(float(raw))
        return int(duration)

    def _normalize_fal_resolution(self, resolution: str | None) -> str | None:
        if resolution is None:
            return None
        raw = str(resolution).strip().lower()
        if raw in {"480p", "720p"}:
            return raw
        return None

    def _normalize_seedance_duration(self, duration: float | int | str) -> int:
        if isinstance(duration, str):
            raw = duration.strip().lower()
            if not raw or raw == "auto":
                return 5
            return int(float(raw))
        return int(duration)

    def _normalize_seedance_resolution(self, resolution: str | None) -> str | None:
        if resolution is None:
            return None
        raw = str(resolution).strip().lower()
        if not raw:
            return None
        resolution_map = {
            "480p": "480p",
            "720p": "720p",
            "1080p": "1080p",
        }
        return resolution_map.get(raw)

    def _resolve_seedance_generate_mode_for_api(
        self, generate_mode: str | None
    ) -> str | None:
        raw = str(generate_mode or "").strip()
        if not raw:
            return None
        # 当前项目里的基础模式主要用于本地 UI/素材路由判断，Seedance 官方多模态接口
        # 可以通过 content roles 自动推断，继续透传这些内部枚举会增加上游拒绝概率。
        if raw in {"full", "text_to_video", "first_frame", "start_end", "video_ref"}:
            return None
        return raw

    def _get_nested_value(self, data, path: str):
        current = data
        for part in path.split("."):
            if isinstance(current, list):
                if not part.isdigit():
                    return None
                index = int(part)
                if index >= len(current):
                    return None
                current = current[index]
                continue
            if not isinstance(current, dict):
                return None
            if part not in current:
                return None
            current = current[part]
        return current

    def _pick_nested_value(self, data, paths: list[str]):
        for path in paths:
            value = self._get_nested_value(data, path)
            if value not in (None, "", [], {}):
                return value
        return None

    def _normalize_task_status(self, status) -> str:
        return str(status or "").strip().lower()

    def _build_media_debug_summary(self, data, *, max_items: int = 8, max_chars: int = 180) -> str:
        items: list[str] = []
        if isinstance(data, dict):
            items.append(f"keys={list(data.keys())[:12]}")

        probe_paths = [
            "status",
            "task_status",
            "taskStatus",
            "video_url",
            "videoUrl",
            "url",
            "download_url",
            "downloadUrl",
            "file_url",
            "fileUrl",
            "thumbnail_url",
            "thumbnailUrl",
            "cover_url",
            "coverUrl",
            "video",
            "content",
            "result",
            "output",
            "data.video",
            "data.content",
            "data.result",
            "data.output",
        ]
        for path in probe_paths:
            value = self._get_nested_value(data, path)
            if value in (None, "", [], {}):
                continue
            if isinstance(value, (dict, list)):
                preview = json.dumps(value, ensure_ascii=False)
            else:
                preview = str(value)
            if len(preview) > max_chars:
                preview = preview[: max_chars - 3] + "..."
            items.append(f"{path}={preview}")
            if len(items) >= max_items:
                break
        return "; ".join(items) if items else "no obvious media fields"

    def _extract_url_like_value(self, value, candidate_keys: tuple[str, ...]) -> str | None:
        if isinstance(value, str):
            normalized = value.strip()
            if normalized.startswith(("http://", "https://")):
                return normalized
            return None

        if isinstance(value, list):
            for item in value:
                extracted = self._extract_url_like_value(item, candidate_keys)
                if extracted:
                    return extracted
            return None

        if isinstance(value, dict):
            for key in candidate_keys:
                if key in value:
                    extracted = self._extract_url_like_value(value.get(key), candidate_keys)
                    if extracted:
                        return extracted
            for nested_value in value.values():
                if not isinstance(nested_value, (dict, list)):
                    continue
                extracted = self._extract_url_like_value(nested_value, candidate_keys)
                if extracted:
                    return extracted
        return None

    def _coerce_media_url(self, primary_value, fallback_values: list) -> str | None:
        candidate_keys = (
            "video_url",
            "videoUrl",
            "url",
            "output_url",
            "outputUrl",
            "download_url",
            "downloadUrl",
            "file_url",
            "fileUrl",
            "media_url",
            "mediaUrl",
            "resource_url",
            "resourceUrl",
            "source_url",
            "sourceUrl",
            "src",
            "srcUrl",
            "play_url",
            "playUrl",
            "original_url",
            "originalUrl",
            "href",
        )
        extracted = self._extract_url_like_value(primary_value, candidate_keys)
        if extracted:
            return extracted
        for fallback in fallback_values:
            extracted = self._extract_url_like_value(fallback, candidate_keys)
            if extracted:
                return extracted
        return None

    def _coerce_thumbnail_url(self, primary_value, fallback_values: list) -> str | None:
        candidate_keys = (
            "thumbnail_url",
            "thumbnailUrl",
            "cover_url",
            "coverUrl",
            "cover_image_url",
            "coverImageUrl",
            "poster_url",
            "posterUrl",
            "poster",
            "snapshot_url",
            "snapshotUrl",
            "preview_image_url",
            "previewImageUrl",
            "frame_url",
            "frameUrl",
            "url",
        )
        extracted = self._extract_url_like_value(primary_value, candidate_keys)
        if extracted:
            return extracted
        for fallback in fallback_values:
            extracted = self._extract_url_like_value(fallback, candidate_keys)
            if extracted:
                return extracted
        return None

    def _coerce_named_media_url(
        self,
        primary_value,
        fallback_values: list,
        *,
        candidate_keys: tuple[str, ...],
    ) -> str | None:
        extracted = self._extract_url_like_value(primary_value, candidate_keys)
        if extracted:
            return extracted
        for fallback in fallback_values:
            extracted = self._extract_url_like_value(fallback, candidate_keys)
            if extracted:
                return extracted
        return None

    def _pick_nested_value_from_sources(
        self,
        sources: list[Any],
        paths: list[str],
    ) -> Any:
        for source in sources:
            if source in (None, "", [], {}):
                continue
            value = self._pick_nested_value(source, paths)
            if value not in (None, "", [], {}):
                return value
        return None

    def _normalize_available_qualities(self, value: Any) -> list[dict[str, Any]] | None:
        if not isinstance(value, list):
            return None

        normalized_items: list[dict[str, Any]] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            normalized_item = {
                str(key): item[key]
                for key in item
                if isinstance(key, str)
            }
            if normalized_item:
                normalized_items.append(normalized_item)
        return normalized_items or None

    def _extract_video_playback_fields(self, *sources: Any) -> dict[str, Any]:
        normalized_sources = [
            source
            for source in sources
            if source not in (None, "", [], {})
        ]
        preview_video_url = self._coerce_named_media_url(
            None,
            normalized_sources,
            candidate_keys=(
                "preview_video_url",
                "previewVideoUrl",
                "preview_url",
                "previewUrl",
                "preview_mp4_url",
                "previewMp4Url",
                "preview_file_url",
                "previewFileUrl",
                "playback_url",
                "playbackUrl",
            ),
        )
        hls_master_playlist = self._coerce_named_media_url(
            None,
            normalized_sources,
            candidate_keys=(
                "hls_master_playlist",
                "hlsMasterPlaylist",
                "master_playlist_url",
                "masterPlaylistUrl",
            ),
        )
        hls_url = self._coerce_named_media_url(
            None,
            normalized_sources,
            candidate_keys=(
                "hls_url",
                "hlsUrl",
                "m3u8_url",
                "m3u8Url",
                "playlist_url",
                "playlistUrl",
                "stream_playlist_url",
                "streamPlaylistUrl",
            ),
        ) or hls_master_playlist
        available_qualities = self._normalize_available_qualities(
            self._pick_nested_value_from_sources(
                normalized_sources,
                [
                    "output.available_qualities",
                    "output.availableQualities",
                    "data.output.available_qualities",
                    "data.output.availableQualities",
                    "data.available_qualities",
                    "data.availableQualities",
                    "result.available_qualities",
                    "result.availableQualities",
                    "data.result.available_qualities",
                    "data.result.availableQualities",
                    "task_result.available_qualities",
                    "task_result.availableQualities",
                    "data.task_result.available_qualities",
                    "data.task_result.availableQualities",
                    "output.task_result.available_qualities",
                    "output.task_result.availableQualities",
                    "output.video.available_qualities",
                    "output.video.availableQualities",
                    "data.output.video.available_qualities",
                    "data.output.video.availableQualities",
                    "result.video.available_qualities",
                    "result.video.availableQualities",
                    "data.result.video.available_qualities",
                    "data.result.video.availableQualities",
                    "content.available_qualities",
                    "content.availableQualities",
                    "content.video.available_qualities",
                    "content.video.availableQualities",
                    "content.0.available_qualities",
                    "content.0.availableQualities",
                    "data.content.available_qualities",
                    "data.content.availableQualities",
                    "data.content.video.available_qualities",
                    "data.content.video.availableQualities",
                    "data.content.0.available_qualities",
                    "data.content.0.availableQualities",
                    "output.result.videos.0.available_qualities",
                    "output.result.videos.0.availableQualities",
                    "data.output.result.videos.0.available_qualities",
                    "data.output.result.videos.0.availableQualities",
                    "data.result.videos.0.available_qualities",
                    "data.result.videos.0.availableQualities",
                    "result.videos.0.available_qualities",
                    "result.videos.0.availableQualities",
                    "available_qualities",
                    "availableQualities",
                ],
            )
        )

        playback_fields: dict[str, Any] = {}
        if preview_video_url:
            playback_fields["preview_video_url"] = preview_video_url
        if hls_url:
            playback_fields["hls_url"] = hls_url
        if hls_master_playlist:
            playback_fields["hls_master_playlist"] = hls_master_playlist
        if available_qualities:
            playback_fields["available_qualities"] = available_qualities
        return playback_fields

    def _build_video_generation_result(
        self,
        *,
        url: str | None,
        thumbnail_url: str | None = None,
        duration: Any = None,
        task_id: str | None = None,
        sources: list[Any] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "url": url or "",
            "thumbnail_url": thumbnail_url or "",
            "duration": duration,
            "task_id": task_id or "",
        }
        result.update(self._extract_video_playback_fields(*(sources or [])))
        if extra:
            result.update(extra)
        return result

    def _extract_video_task_payload(self, data) -> dict[str, Any]:
        url = self._pick_nested_value(
            data,
            [
                "output.video_url",
                "output.videoUrl",
                "output.url",
                "output.output_url",
                "output.outputUrl",
                "output.watermark_video_url",
                "output.video.url",
                "output.video.video_url",
                "output.video.videoUrl",
                "output.result.video_url",
                "output.result.videoUrl",
                "output.result.url",
                "output.result.output_url",
                "output.result.outputUrl",
                "data.output.video_url",
                "data.output.videoUrl",
                "data.output.url",
                "data.output.output_url",
                "data.output.outputUrl",
                "data.output.watermark_video_url",
                "data.output.video.url",
                "data.output.video.video_url",
                "data.output.video.videoUrl",
                "data.video_url",
                "data.videoUrl",
                "data.url",
                "data.output_url",
                "data.outputUrl",
                "data.video.url",
                "data.video.video_url",
                "data.video.videoUrl",
                "data.result.video_url",
                "data.result.videoUrl",
                "data.result.url",
                "data.result.output_url",
                "data.result.outputUrl",
                "data.result.video.url",
                "content.video_url",
                "content.videoUrl",
                "content.url",
                "content.video.url",
                "content.video.video_url",
                "content.video.videoUrl",
                "content.0.video_url",
                "content.0.videoUrl",
                "content.0.url",
                "data.content.video_url",
                "data.content.videoUrl",
                "data.content.url",
                "data.content.video.url",
                "data.content.video.video_url",
                "data.content.video.videoUrl",
                "data.content.0.video_url",
                "data.content.0.videoUrl",
                "data.content.0.url",
                "result.video_url",
                "result.videoUrl",
                "result.url",
                "result.output_url",
                "result.outputUrl",
                "result.video.url",
                "video.url",
                "video.video_url",
                "video.videoUrl",
                "video_url",
                "videoUrl",
                "url",
                "output_url",
                "outputUrl",
                "task_result.video_url",
                "task_result.videoUrl",
                "task_result.url",
                "task_result.output_url",
                "task_result.outputUrl",
                "data.task_result.video_url",
                "data.task_result.videoUrl",
                "data.task_result.url",
                "data.task_result.output_url",
                "data.task_result.outputUrl",
                "output.task_result.video_url",
                "output.task_result.videoUrl",
                "output.task_result.url",
                "output.task_result.output_url",
                "output.task_result.outputUrl",
                "output.result.videos.0.video_url",
                "output.result.videos.0.videoUrl",
                "output.result.videos.0.url",
                "data.output.result.videos.0.video_url",
                "data.output.result.videos.0.videoUrl",
                "data.output.result.videos.0.url",
                "data.result.videos.0.video_url",
                "data.result.videos.0.videoUrl",
                "data.result.videos.0.url",
                "result.videos.0.video_url",
                "result.videos.0.videoUrl",
                "result.videos.0.url",
                "output.video_urls.0",
                "output.videoUrls.0",
                "data.output.video_urls.0",
                "data.output.videoUrls.0",
                "data.video_urls.0",
                "data.videoUrls.0",
                "result.video_urls.0",
                "result.videoUrls.0",
                "video_urls.0",
                "videoUrls.0",
                "output.file_url",
                "output.fileUrl",
                "data.output.file_url",
                "data.output.fileUrl",
                "data.file_url",
                "data.fileUrl",
                "result.file_url",
                "result.fileUrl",
                "file_url",
                "fileUrl",
                "output.media_url",
                "output.mediaUrl",
                "data.output.media_url",
                "data.output.mediaUrl",
                "data.media_url",
                "data.mediaUrl",
                "result.media_url",
                "result.mediaUrl",
                "media_url",
                "mediaUrl",
                "creations.0.url",
                "creations.0.video_url",
                "creations.0.videoUrl",
                "data.0.url",
                "data.0.video_url",
                "data.0.videoUrl",
                "data.0.video.url",
                "outputs.0.video_url",
                "outputs.0.videoUrl",
                "outputs.0.url",
                "outputs.0.video.url",
                "outputs.0",
            ],
        )
        thumbnail_url = self._pick_nested_value(
            data,
            [
                "output.thumbnail_url",
                "output.thumbnailUrl",
                "output.cover_url",
                "output.coverUrl",
                "output.cover_image_url",
                "output.coverImageUrl",
                "output.video.thumbnail_url",
                "output.video.thumbnailUrl",
                "output.video.cover_url",
                "output.video.coverUrl",
                "data.output.thumbnail_url",
                "data.output.thumbnailUrl",
                "data.output.cover_url",
                "data.output.coverUrl",
                "data.thumbnail_url",
                "data.thumbnailUrl",
                "data.cover_url",
                "data.coverUrl",
                "data.result.thumbnail_url",
                "data.result.thumbnailUrl",
                "data.result.cover_url",
                "data.result.coverUrl",
                "data.result.video.thumbnail_url",
                "data.result.video.thumbnailUrl",
                "data.result.video.cover_url",
                "data.result.video.coverUrl",
                "content.thumbnail_url",
                "content.thumbnailUrl",
                "content.cover_url",
                "content.coverUrl",
                "content.video.thumbnail_url",
                "content.video.thumbnailUrl",
                "content.video.cover_url",
                "content.video.coverUrl",
                "content.0.thumbnail_url",
                "content.0.thumbnailUrl",
                "content.0.cover_url",
                "content.0.coverUrl",
                "data.content.thumbnail_url",
                "data.content.thumbnailUrl",
                "data.content.cover_url",
                "data.content.coverUrl",
                "data.content.video.thumbnail_url",
                "data.content.video.thumbnailUrl",
                "data.content.video.cover_url",
                "data.content.video.coverUrl",
                "data.content.0.thumbnail_url",
                "data.content.0.thumbnailUrl",
                "data.content.0.cover_url",
                "data.content.0.coverUrl",
                "result.thumbnail_url",
                "result.thumbnailUrl",
                "result.cover_url",
                "result.coverUrl",
                "result.video.thumbnail_url",
                "result.video.thumbnailUrl",
                "result.video.cover_url",
                "result.video.coverUrl",
                "video.thumbnail_url",
                "video.thumbnailUrl",
                "video.cover_url",
                "video.coverUrl",
                "task_result.thumbnail_url",
                "task_result.thumbnailUrl",
                "task_result.cover_url",
                "task_result.coverUrl",
                "data.task_result.thumbnail_url",
                "data.task_result.thumbnailUrl",
                "data.task_result.cover_url",
                "data.task_result.coverUrl",
                "output.task_result.thumbnail_url",
                "output.task_result.thumbnailUrl",
                "output.task_result.cover_url",
                "output.task_result.coverUrl",
                "output.result.videos.0.thumbnail_url",
                "output.result.videos.0.thumbnailUrl",
                "output.result.videos.0.cover_url",
                "output.result.videos.0.coverUrl",
                "data.output.result.videos.0.thumbnail_url",
                "data.output.result.videos.0.thumbnailUrl",
                "data.output.result.videos.0.cover_url",
                "data.output.result.videos.0.coverUrl",
                "data.result.videos.0.thumbnail_url",
                "data.result.videos.0.thumbnailUrl",
                "data.result.videos.0.cover_url",
                "data.result.videos.0.coverUrl",
                "result.videos.0.thumbnail_url",
                "result.videos.0.thumbnailUrl",
                "result.videos.0.cover_url",
                "result.videos.0.coverUrl",
                "thumbnail_url",
                "thumbnailUrl",
                "cover_url",
                "coverUrl",
                "creations.0.thumbnail_url",
                "creations.0.thumbnailUrl",
                "creations.0.cover_url",
                "creations.0.coverUrl",
                "data.0.thumbnail_url",
                "data.0.thumbnailUrl",
                "data.0.cover_url",
                "data.0.coverUrl",
            ],
        )
        duration = self._pick_nested_value(
            data,
            [
                "usage.output_video_duration",
                "usage.duration",
                "output.output_video_duration",
                "output.duration",
                "data.usage.output_video_duration",
                "data.usage.duration",
                "data.output.output_video_duration",
                "data.output.duration",
                "data.duration",
                "result.duration",
                "result.video.duration",
                "data.result.duration",
                "task_result.duration",
                "task_result.video_duration",
                "data.task_result.duration",
                "data.task_result.video_duration",
                "output.task_result.duration",
                "output.task_result.video_duration",
                "output.result.videos.0.duration",
                "data.output.result.videos.0.duration",
                "data.result.videos.0.duration",
                "result.videos.0.duration",
                "creations.0.duration",
                "data.0.duration",
                "duration",
            ],
        )
        task_id = self._pick_nested_value(
            data,
            [
                "output.task_id",
                "output.taskId",
                "data.output.task_id",
                "data.output.taskId",
                "data.task_id",
                "data.taskId",
                "task_id",
                "taskId",
                "output.id",
                "data.id",
                "id",
            ],
        )
        status = self._pick_nested_value(
            data,
            [
                "output.task_status",
                "output.taskStatus",
                "output.status",
                "data.output.task_status",
                "data.output.taskStatus",
                "data.output.status",
                "data.task_status",
                "data.taskStatus",
                "data.status",
                "task_status",
                "taskStatus",
                "status",
                "state",
                "task_result.status",
                "task_result.taskStatus",
                "data.task_result.status",
                "data.task_result.taskStatus",
                "output.task_result.status",
                "output.task_result.taskStatus",
            ],
        )
        error = self._pick_nested_value(
            data,
            [
                "output.message",
                "output.error.message",
                "output.error.detail",
                "output.error",
                "data.output.message",
                "data.output.error.message",
                "data.output.error.detail",
                "data.output.error",
                "data.message",
                "data.error.message",
                "data.error.detail",
                "data.error.raw_message",
                "data.error",
                "data.errorMessage",
                "task_result.message",
                "task_result.error.message",
                "task_result.error.detail",
                "task_result.error",
                "task_result.errorMessage",
                "data.task_result.message",
                "data.task_result.error.message",
                "data.task_result.error.detail",
                "data.task_result.error",
                "data.task_result.errorMessage",
                "output.task_result.message",
                "output.task_result.error.message",
                "output.task_result.error.detail",
                "output.task_result.error",
                "output.task_result.errorMessage",
                "message",
                "errorMessage",
                "error.message",
                "error.detail",
                "error.raw_message",
                "error",
                "err_msg",
            ],
        )
        if isinstance(error, dict):
            error = self._pick_nested_value(error, ["message", "detail", "raw_message"]) or str(error)
        url = self._coerce_media_url(
            url,
            [
                self._get_nested_value(data, "output"),
                self._get_nested_value(data, "data.output"),
                self._get_nested_value(data, "task_result"),
                self._get_nested_value(data, "data.task_result"),
                self._get_nested_value(data, "output.task_result"),
                self._get_nested_value(data, "result"),
                self._get_nested_value(data, "data.result"),
                self._get_nested_value(data, "outputs"),
                self._get_nested_value(data, "data"),
                data,
            ],
        )
        thumbnail_url = self._coerce_thumbnail_url(
            thumbnail_url,
            [
                self._get_nested_value(data, "output"),
                self._get_nested_value(data, "data.output"),
                self._get_nested_value(data, "task_result"),
                self._get_nested_value(data, "data.task_result"),
                self._get_nested_value(data, "output.task_result"),
                self._get_nested_value(data, "result"),
                self._get_nested_value(data, "data.result"),
                self._get_nested_value(data, "outputs"),
                self._get_nested_value(data, "data"),
                data,
            ],
        )
        if task_id is not None and not isinstance(task_id, str):
            task_id = str(task_id)
        if error is not None and not isinstance(error, str):
            error = str(error)
        playback_fields = self._extract_video_playback_fields(data)
        return {
            "url": url,
            "thumbnail_url": thumbnail_url,
            "duration": duration,
            "task_id": task_id,
            "status": self._normalize_task_status(status),
            "error": error,
            **playback_fields,
        }

    def _normalize_happyhorse_resolution(self, resolution: str | None) -> str:
        resolution_map = {
            "720p": "720P",
            "1080p": "1080P",
            "4k": "4K",
        }
        if not resolution:
            return "1080P"
        return resolution_map.get(resolution.lower(), resolution)

    def _happyhorse_headers(self, api_key: str) -> dict[str, str]:
        return {
            **self._headers(api_key),
            "X-DashScope-Async": "enable",
        }

    def _collect_happyhorse_reference_images(
        self,
        *,
        first_frame_url: str | None = None,
        attachments: list[dict] | None = None,
    ) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()

        def _push(url: str | None) -> None:
            normalized = str(url or "").strip()
            if not normalized or normalized in seen:
                return
            seen.add(normalized)
            urls.append(normalized)

        _push(first_frame_url)
        for attachment in attachments or []:
            asset_type = str(
                attachment.get("asset_type") or attachment.get("assetType") or ""
            ).strip().lower()
            role = str(attachment.get("role") or "").strip().lower()
            if asset_type != "image":
                continue
            if role and role not in {
                "first_frame",
                "reference_image",
                "reference",
                "character",
                "scene",
                "prop",
            }:
                continue
            _push(attachment.get("url"))

        return urls

    async def _post_happyhorse_task(
        self,
        client: httpx.AsyncClient,
        *,
        base_url: str,
        api_key: str,
        payload: dict,
        model: str,
    ) -> dict:
        endpoint = "/happyhorse/v1/services/aigc/video-generation/video-synthesis"
        try:
            resp = await client.post(
                f"{base_url.rstrip('/')}{endpoint}",
                headers=self._happyhorse_headers(api_key),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            raise Exception(
                f"{model} 请求失败: endpoint={endpoint}, message={exc.response.text}"
            ) from exc

    async def _post_video_generation_task(
        self,
        client: httpx.AsyncClient,
        *,
        base_url: str,
        api_key: str,
        payload: dict,
        model: str,
    ) -> dict:
        endpoints = [
            "/v1/video/generations",
            "/v1/videos/generations",
        ]
        headers = self._headers(api_key)
        last_probe_error: str | None = None

        for endpoint in endpoints:
            try:
                resp = await client.post(
                    f"{base_url.rstrip('/')}{endpoint}",
                    headers=headers,
                    json=payload,
                )
                if resp.status_code in {404, 405}:
                    last_probe_error = (
                        f"endpoint={endpoint}, status={resp.status_code}, body={resp.text}"
                    )
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as exc:
                raise Exception(
                    f"{model} 请求失败: endpoint={endpoint}, message={exc.response.text}"
                ) from exc

        raise Exception(
            f"{model} 请求失败: 所有视频生成端点均不可用，"
            f"tried={', '.join(endpoints)}, last_error={last_probe_error or 'unknown'}"
        )

    def _prepare_external_media_url(self, url: str, media_label: str) -> str:
        if not url:
            raise ValueError(f"{media_label}地址不能为空")

        local_upload_path = self._extract_local_upload_path(url)
        if local_upload_path:
            public_url = self._build_public_upload_url(local_upload_path)
            self._handle_http_only_upstream_media_url(
                public_url,
                media_label,
                source_label="PUBLIC_BASE_URL",
            )
            _log(f"Using PUBLIC_BASE_URL for local {media_label}: {public_url}")
            return public_url

        if self._is_absolute_url(url) or self._is_cos_signed_url(url):
            self._handle_http_only_upstream_media_url(
                url,
                media_label,
                source_label="external-source",
            )
            return url

        if url.startswith("/uploads/"):
            public_url = self._build_public_upload_url(url)
            self._handle_http_only_upstream_media_url(
                public_url,
                media_label,
                source_label="PUBLIC_BASE_URL",
            )
            return public_url

        raise ValueError(f"不支持的{media_label}地址格式: {url}")

    def _ensure_public_upload_url(
        self,
        upload_url: str,
        media_label: str,
    ) -> str:
        public_url = self._build_public_upload_url(upload_url)
        self._handle_http_only_upstream_media_url(
            public_url,
            media_label,
            source_label="PUBLIC_BASE_URL",
        )
        return public_url

    async def _prepare_external_video_url(self, url: str, media_label: str) -> str:
        # Strip PUBLIC_BASE_URL prefix so local files served through a
        # public tunnel are correctly recognized for probe/trim.
        video_url_for_prep = url
        public_base_url = self._get_public_upload_base_url()
        if public_base_url:
            prefix = public_base_url.rstrip("/")
            if url.startswith(prefix + "/uploads/"):
                video_url_for_prep = url[len(prefix):]

        prepared = await prepare_local_reference_video_for_upstream(video_url_for_prep)
        if prepared.compressed or prepared.trimmed:
            _log(
                f"Processed local {media_label} before upstream submit: "
                f"compressed={prepared.compressed}, trimmed={prepared.trimmed}, "
                f"{prepared.width}x{prepared.height}, duration={prepared.duration_seconds}s "
                f"-> {prepared.url}"
            )
        return self._prepare_external_media_url(prepared.url, media_label)

    async def _prepare_seedance_reference_media_url(
        self,
        url: str,
        media_label: str,
        *,
        media_type: str,
        known_duration_seconds: float | None = None,
    ) -> str:
        cleaned = str(url or "").strip()
        if not cleaned:
            raise ValueError(f"{media_label}地址不能为空")

        normalized_url = cleaned
        if media_type == "audio":
            await validate_seedance_reference_audio_duration(
                cleaned,
                known_duration_seconds=known_duration_seconds,
                media_label=media_label,
            )
        if media_type == "video":
            # Strip PUBLIC_BASE_URL prefix so local files served through a
            # public tunnel are correctly recognized for probe/trim.
            video_url_for_prep = cleaned
            public_base_url = self._get_public_upload_base_url()
            if public_base_url:
                prefix = public_base_url.rstrip("/")
                if cleaned.startswith(prefix + "/uploads/"):
                    video_url_for_prep = cleaned[len(prefix):]

            prepared = await prepare_local_reference_video_for_upstream(video_url_for_prep)
            normalized_url = prepared.url
            if prepared.compressed or prepared.trimmed:
                _log(
                    f"Processed local {media_label} before Seedance submit: "
                    f"compressed={prepared.compressed}, trimmed={prepared.trimmed}, "
                    f"{prepared.width}x{prepared.height}, duration={prepared.duration_seconds}s "
                    f"-> {prepared.url}"
                )

        local_upload_path = self._extract_local_upload_path(normalized_url)
        if local_upload_path:
            public_url = self._ensure_public_upload_url(local_upload_path, media_label)
            await self._assert_seedance_media_url_reachable(public_url, media_label)
            return public_url

        if normalized_url.startswith("/uploads/"):
            public_url = self._ensure_public_upload_url(normalized_url, media_label)
            await self._assert_seedance_media_url_reachable(public_url, media_label)
            return public_url

        if not (self._is_absolute_url(normalized_url) or self._is_cos_signed_url(normalized_url)):
            raise ValueError(f"不支持的{media_label}地址格式: {normalized_url}")

        public_base_url = self._get_public_upload_base_url()
        if public_base_url:
            try:
                proxied_url = await persist_remote_file(
                    normalized_url,
                    f"runtime/seedance-reference-{media_type}s",
                    fallback_extension=get_media_fallback_extension(media_type),
                )
            except Exception as exc:
                _log(
                    f"Failed to rehost {media_label} for Seedance, fallback to original URL: {exc}"
                )
            else:
                if proxied_url and proxied_url.startswith("/uploads/"):
                    # Validate duration and trim rehosted video if needed
                    if media_type == "video":
                        prepared = await prepare_local_reference_video_for_upstream(proxied_url)
                        proxied_url = prepared.url
                        if prepared.compressed or prepared.trimmed:
                            _log(
                                f"Processed rehosted {media_label} before Seedance submit: "
                                f"compressed={prepared.compressed}, trimmed={prepared.trimmed}, "
                                f"{prepared.width}x{prepared.height}, "
                                f"duration={prepared.duration_seconds}s -> {prepared.url}"
                            )
                    elif media_type == "audio":
                        await validate_seedance_reference_audio_duration(
                            proxied_url,
                            known_duration_seconds=known_duration_seconds,
                            media_label=media_label,
                        )
                    _log(
                        f"Rehosted {media_label} for Seedance upstream: "
                        f"{normalized_url[:120]} -> {proxied_url}"
                    )
                    public_url = self._ensure_public_upload_url(proxied_url, media_label)
                    await self._assert_seedance_media_url_reachable(public_url, media_label)
                    return public_url

        prepared_url = self._prepare_external_media_url(normalized_url, media_label)
        await self._assert_seedance_media_url_reachable(prepared_url, media_label)
        return prepared_url

    async def _assert_seedance_media_url_reachable(
        self,
        url: str,
        media_label: str,
    ) -> None:
        if not self._is_absolute_url(url):
            return

        timeout = self._build_http_timeout(connect=12.0, read=20.0, write=20.0)
        async with upstream_async_client(
            profile="media",
            timeout=timeout,
            follow_redirects=True,
        ) as client:
            last_error: Exception | None = None

            try:
                head_resp = await client.head(url)
                if head_resp.status_code < 400:
                    return
                last_error = httpx.HTTPStatusError(
                    f"HEAD {url} -> {head_resp.status_code}",
                    request=head_resp.request,
                    response=head_resp,
                )
            except Exception as exc:
                last_error = exc

            try:
                get_resp = await client.get(
                    url,
                    headers={"Range": "bytes=0-0"},
                )
                if get_resp.status_code < 400:
                    return
                last_error = httpx.HTTPStatusError(
                    f"GET {url} -> {get_resp.status_code}",
                    request=get_resp.request,
                    response=get_resp,
                )
            except Exception as exc:
                last_error = exc

        if isinstance(last_error, httpx.HTTPStatusError):
            status_code = last_error.response.status_code if last_error.response else "unknown"
            transport_hint = (
                " 当前地址仍是 HTTP，云端正式环境建议尽快切到 HTTPS。"
                if self._is_http_url(url)
                else ""
            )
            parsed_url = urlsplit(url)
            path = parsed_url.path or ""
            if status_code == 404 and path.startswith("/uploads/"):
                raise ValueError(
                    f"{media_label}公网地址当前不可访问（HTTP 404）：{url}。"
                    "当前后端域名已在线，但该具体 `/uploads/...` 文件返回 404；"
                    "这通常说明素材文件不存在、路径已失效，或云端 uploads 目录未持久化。"
                    "请优先核对服务器上的原文件是否仍在，并确认数据库里保存的地址仍是最新值。"
                    f"{transport_hint}"
                ) from last_error
            if status_code in {401, 403}:
                raise ValueError(
                    f"{media_label}公网地址当前不可访问（HTTP {status_code}）：{url}。"
                    "当前地址存在访问限制，外部视频模型无法匿名拉取该素材。"
                    "请改用无需鉴权即可直接访问的公网素材地址。"
                    f"{transport_hint}"
                ) from last_error
            raise ValueError(
                f"{media_label}公网地址当前不可访问（HTTP {status_code}）：{url}。"
                "请检查 PUBLIC_BASE_URL / 公共隧道是否在线，或更换为可直接公网访问的素材地址。"
                f"{transport_hint}"
            ) from last_error
        transport_hint = (
            " 当前地址仍是 HTTP，云端正式环境建议尽快切到 HTTPS。"
            if self._is_http_url(url)
            else ""
        )
        raise ValueError(
            f"{media_label}公网地址当前不可访问：{url}。"
            "请检查 PUBLIC_BASE_URL / 公共隧道是否在线，或更换为可直接公网访问的素材地址。"
            f"{transport_hint}"
        ) from last_error

    async def _download_image_as_data_uri(
        self,
        url: str,
        client: httpx.AsyncClient,
    ) -> str:
        _log(f"Processing image URL: {url[:100]}...")

        _log("Downloading image for external video provider...")
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            image_data = resp.content
            _log(f"Image downloaded successfully, size: {len(image_data)} bytes")
        except Exception as e:
            _log(f"Failed to download image: {e}")
            raise

        content_type = resp.headers.get("content-type") or self._guess_image_content_type(url)
        data_uri = self._build_data_uri(image_data, content_type)
        _log("Image converted to base64 data URI for external video provider")
        return data_uri

    def _read_local_image_as_data_uri(self, url: str) -> str:
        file_path = self._resolve_local_upload_path(url)
        if not Path(file_path).exists():
            raise ValueError(f"本地图片不存在，无法转换为外部可访问格式: {url}")

        with open(file_path, "rb") as file:
            image_data = file.read()

        content_type = self._guess_image_content_type(file_path)
        _log(f"Local image converted to base64 data URI: {url}")
        return self._build_data_uri(image_data, content_type)

    async def _prepare_external_image_url(
        self,
        url: str,
        client: httpx.AsyncClient,
        *,
        allow_local_data_uri_fallback: bool = True,
        force_data_uri: bool = False,
    ) -> str:
        if not url:
            raise ValueError("图片地址不能为空")

        if self._is_data_uri(url):
            return url

        local_upload_path = self._extract_local_upload_path(url)
        if local_upload_path:
            if force_data_uri:
                return self._read_local_image_as_data_uri(local_upload_path)
            public_base_url = self._get_public_upload_base_url()
            if public_base_url:
                public_url = f"{public_base_url}{local_upload_path}"
                if self._is_http_url(public_url):
                    _log(
                        "PUBLIC_BASE_URL is HTTP-only for local image; "
                        "using data URI fallback for external video provider"
                    )
                    return self._read_local_image_as_data_uri(local_upload_path)
                _log(f"Using PUBLIC_BASE_URL for local image: {public_url}")
                return public_url
            if allow_local_data_uri_fallback:
                return self._read_local_image_as_data_uri(local_upload_path)
            raise ValueError(
                "当前图片是本地 / 私网托管资源，且未配置外网可访问的 PUBLIC_BASE_URL，外部视频模型无法访问该图片"
            )

        if self._is_cos_signed_url(url):
            return await self._download_image_as_data_uri(url, client)

        if self._is_absolute_url(url):
            if force_data_uri:
                return await self._download_image_as_data_uri(url, client)
            if self._is_http_url(url):
                _log(
                    "Image URL is HTTP-only; downloading and converting to "
                    "data URI for external video provider"
                )
                return await self._download_image_as_data_uri(url, client)
            return url

        if url.startswith("/uploads/"):
            if force_data_uri:
                return self._read_local_image_as_data_uri(url)
            public_base_url = self._get_public_upload_base_url()
            if public_base_url:
                public_url = f"{public_base_url}{url}"
                if self._is_http_url(public_url):
                    _log(
                        "PUBLIC_BASE_URL is HTTP-only for local image; "
                        "using data URI fallback for external video provider"
                    )
                    return self._read_local_image_as_data_uri(url)
                _log(f"Using PUBLIC_BASE_URL for local image: {public_url}")
                return public_url
            if allow_local_data_uri_fallback:
                return self._read_local_image_as_data_uri(url)
            raise ValueError(
                "当前图片是本地 / 私网托管资源，且未配置外网可访问的 PUBLIC_BASE_URL，外部视频模型无法访问该图片"
            )

        raise ValueError(f"不支持的图片地址格式: {url}")

    async def _prepare_external_image_urls(
        self,
        client: httpx.AsyncClient,
        *urls: str | None,
        allow_local_data_uri_fallback: bool = True,
    ) -> list[str]:
        prepared_urls: list[str] = []
        for url in urls:
            if not url:
                continue
            prepared_urls.append(
                await self._prepare_external_image_url(
                    url,
                    client,
                    allow_local_data_uri_fallback=allow_local_data_uri_fallback,
                )
            )
        return prepared_urls

    def _normalize_seedance_attachment(self, attachment: dict | None) -> dict | None:
        if not isinstance(attachment, dict):
            return None
        url = str(attachment.get("url") or "").strip()
        asset_type = str(attachment.get("asset_type") or "").strip()
        if not url or asset_type not in {"image", "video", "audio"}:
            return None
        return {
            "asset_id": str(attachment.get("asset_id") or "").strip() or None,
            "asset_type": asset_type,
            "asset_name": str(attachment.get("asset_name") or "").strip() or None,
            "url": url,
            "duration": self._normalize_attachment_duration(attachment.get("duration")),
            "role": str(attachment.get("role") or "").strip() or None,
            "source": str(attachment.get("source") or "").strip() or None,
        }

    def _canonicalize_image_binding_role(self, role: str | None) -> str:
        normalized = str(role or "").strip().lower()
        if normalized in {"first_frame", "start_frame"}:
            return "first_frame"
        if normalized in {"last_frame", "end_frame"}:
            return "last_frame"
        return "reference_image"

    def _collect_binding_urls(
        self,
        refs: list[dict[str, Any]],
        *,
        roles: set[str] | None = None,
    ) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()
        normalized_roles = {str(role).strip().lower() for role in (roles or set()) if str(role).strip()}
        for ref in refs:
            url = str(ref.get("url") or "").strip()
            role = str(ref.get("role") or "").strip().lower()
            if not url or url in seen:
                continue
            if normalized_roles and role not in normalized_roles:
                continue
            seen.add(url)
            urls.append(url)
        return urls

    def _map_assets_to_model_params(
        self,
        model: str,
        validated_assets: dict[str, Any],
        *,
        generation_mode: str | None = None,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        reference_video_url: str | None = None,
        reference_audio_url: str | None = None,
        subjects: list[dict] | None = None,
        multiframe_segments: list[dict] | None = None,
    ) -> dict[str, Any]:
        image_refs = validated_assets.get("image_refs") or []
        video_refs = validated_assets.get("video_refs") or []
        audio_refs = validated_assets.get("audio_refs") or []
        normalized_generation_mode = str(generation_mode or "").strip() or None

        generic_image_urls = self._collect_binding_urls(
            image_refs,
            roles={"reference", "reference_image", "character", "scene", "prop", ""},
        )
        first_frame_candidate_urls = self._collect_binding_urls(image_refs, roles={"first_frame"})
        last_frame_candidate_urls = self._collect_binding_urls(image_refs, roles={"last_frame"})
        video_candidate_urls = self._collect_binding_urls(video_refs)
        audio_candidate_urls = self._collect_binding_urls(audio_refs)

        mapped_attachments: list[dict] = []
        for ref in image_refs:
            normalized_role = self._canonicalize_image_binding_role(ref.get("role"))
            self._append_unique_seedance_attachment(
                mapped_attachments,
                {
                    "asset_id": ref.get("asset_id"),
                    "asset_type": "image",
                    "asset_name": ref.get("asset_name"),
                    "url": ref.get("url"),
                    "role": normalized_role,
                    "source": ref.get("source"),
                },
            )
        for ref in video_refs:
            self._append_unique_seedance_attachment(
                mapped_attachments,
                {
                    "asset_id": ref.get("asset_id"),
                    "asset_type": "video",
                    "asset_name": ref.get("asset_name"),
                    "url": ref.get("url"),
                    "role": "reference_video",
                    "source": ref.get("source"),
                },
            )
        for ref in audio_refs:
            self._append_unique_seedance_attachment(
                mapped_attachments,
                {
                    "asset_id": ref.get("asset_id"),
                    "asset_type": "audio",
                    "asset_name": ref.get("asset_name"),
                    "url": ref.get("url"),
                    "role": "reference_audio",
                    "source": ref.get("source"),
                },
            )

        mapped_params: dict[str, Any] = {
            "attachments": mapped_attachments,
            "subjects": [item for item in (subjects or []) if isinstance(item, dict)],
            "multiframe_segments": [item for item in (multiframe_segments or []) if isinstance(item, dict)],
            "image_url": image_url or (generic_image_urls[0] if generic_image_urls else None),
            "first_frame_url": first_frame_url or (
                first_frame_candidate_urls[0] if first_frame_candidate_urls else None
            ),
            "last_frame_url": last_frame_url or (
                last_frame_candidate_urls[0] if last_frame_candidate_urls else None
            ),
            "reference_video_url": reference_video_url or (
                video_candidate_urls[0] if video_candidate_urls else None
            ),
            "reference_audio_url": reference_audio_url or (
                audio_candidate_urls[0] if audio_candidate_urls else None
            ),
        }

        if self._is_vidu_model(model):
            if normalized_generation_mode in {"first_frame", "start_end", "multiframe"} and not mapped_params["first_frame_url"]:
                mapped_params["first_frame_url"] = mapped_params["image_url"]
            if normalized_generation_mode == "start_end" and not mapped_params["last_frame_url"]:
                fallback_end_candidates = [
                    url
                    for url in generic_image_urls
                    if url != mapped_params["first_frame_url"]
                ]
                if fallback_end_candidates:
                    mapped_params["last_frame_url"] = fallback_end_candidates[0]

        if model == "happyhorse-1.0-i2v" and not mapped_params["first_frame_url"]:
            mapped_params["first_frame_url"] = mapped_params["image_url"]

        return mapped_params

    def _seedance_attachment_dedup_keys(self, attachment: dict) -> set[str]:
        keys: set[str] = set()
        asset_id = attachment.get("asset_id")
        if asset_id:
            keys.add(f"id:{asset_id}")
        url = attachment.get("url")
        asset_type = attachment.get("asset_type")
        if url and asset_type:
            keys.add(f"{asset_type}:{url}")
        return keys

    def _append_unique_seedance_attachment(
        self,
        target: list[dict],
        attachment: dict | None,
    ) -> None:
        normalized = self._normalize_seedance_attachment(attachment)
        if not normalized:
            return
        keys = self._seedance_attachment_dedup_keys(normalized)
        for index, current in enumerate(target):
            current_keys = self._seedance_attachment_dedup_keys(current)
            if keys.isdisjoint(current_keys):
                continue
            merged = dict(current)
            for merge_key, merge_value in normalized.items():
                if merge_value not in (None, ""):
                    merged[merge_key] = merge_value
            target[index] = merged
            return
        target.append(normalized)

    def _build_seedance_attachment_pool(
        self,
        *,
        attachments: list[dict] | None,
        reference_mode: str | None,
        image_url: str | None,
        first_frame_url: str | None,
        last_frame_url: str | None,
        reference_video_url: str | None,
        reference_audio_url: str | None,
        first_frame_asset_id: str | None = None,
        last_frame_asset_id: str | None = None,
        reference_video_asset_id: str | None = None,
        reference_audio_asset_id: str | None = None,
        reference_image_asset_ids: list[str] | None = None,
    ) -> list[dict]:
        pool: list[dict] = []
        for attachment in attachments or []:
            self._append_unique_seedance_attachment(pool, attachment)

        role_by_asset_id: dict[str, str] = {}
        if first_frame_asset_id:
            role_by_asset_id[str(first_frame_asset_id)] = "first_frame"
        if last_frame_asset_id:
            role_by_asset_id[str(last_frame_asset_id)] = "last_frame"
        if reference_video_asset_id:
            role_by_asset_id[str(reference_video_asset_id)] = "reference_video"
        if reference_audio_asset_id:
            role_by_asset_id[str(reference_audio_asset_id)] = "reference_audio"
        for asset_id in reference_image_asset_ids or []:
            normalized_asset_id = str(asset_id or "").strip()
            if normalized_asset_id and normalized_asset_id not in role_by_asset_id:
                role_by_asset_id[normalized_asset_id] = "reference_image"

        if role_by_asset_id:
            for index, attachment in enumerate(pool):
                asset_id = str(attachment.get("asset_id") or "").strip()
                forced_role = role_by_asset_id.get(asset_id)
                if not forced_role:
                    continue
                updated_attachment = dict(attachment)
                updated_attachment["role"] = forced_role
                pool[index] = updated_attachment

        normalized_reference_mode = (reference_mode or "full").strip() or "full"
        image_role_priority = {
            "first_frame": 0,
            "last_frame": 1,
            "reference_image": 2,
        }

        if normalized_reference_mode == "video_ref":
            legacy_image_candidates = [
                {"asset_type": "image", "url": first_frame_url or image_url, "role": "first_frame", "asset_name": "首帧参考"},
                {"asset_type": "image", "url": last_frame_url, "role": "last_frame", "asset_name": "尾帧参考"},
            ]
        elif normalized_reference_mode == "first_frame":
            legacy_image_candidates = [
                {"asset_type": "image", "url": first_frame_url or image_url, "role": "first_frame", "asset_name": "首帧参考"},
            ]
        elif normalized_reference_mode == "last_frame":
            legacy_image_candidates = [
                {"asset_type": "image", "url": last_frame_url, "role": "last_frame", "asset_name": "尾帧参考"},
            ]
        else:
            legacy_image_candidates = [
                {"asset_type": "image", "url": image_url, "role": "reference_image", "asset_name": "参考图片"},
                {"asset_type": "image", "url": first_frame_url, "role": "first_frame", "asset_name": "首帧参考"},
                {"asset_type": "image", "url": last_frame_url, "role": "last_frame", "asset_name": "尾帧参考"},
            ]

        for attachment in legacy_image_candidates:
            self._append_unique_seedance_attachment(pool, attachment)

        if normalized_reference_mode == "full":
            self._append_unique_seedance_attachment(
                pool,
                {
                    "asset_type": "video",
                    "url": reference_video_url,
                    "role": "reference_video",
                    "asset_name": "参考视频",
                },
            )
            self._append_unique_seedance_attachment(
                pool,
                {
                    "asset_type": "audio",
                    "url": reference_audio_url,
                    "role": "reference_audio",
                    "asset_name": "参考音频",
                },
            )

        images: list[dict] = []
        videos: list[dict] = []
        audios: list[dict] = []
        for attachment in pool:
            asset_type = attachment.get("asset_type")
            if asset_type == "image":
                images.append(attachment)
            elif asset_type == "video" and normalized_reference_mode == "full":
                videos.append(attachment)
            elif asset_type == "audio" and normalized_reference_mode == "full":
                audios.append(attachment)

        images.sort(key=lambda item: image_role_priority.get(item.get("role") or "", 99))
        return [*images, *videos, *audios]

    def _rewrite_prompt_mentions_to_seedance_tokens(
        self,
        prompt: str,
        mentions: list[dict] | None,
        token_by_asset_id: dict[str, str],
    ) -> str:
        if not mentions:
            return prompt

        normalized_mentions: list[dict] = []
        for mention in mentions:
            if not isinstance(mention, dict):
                continue
            display_text = str(mention.get("display_text") or "").strip()
            asset_id = str(mention.get("asset_id") or "").strip()
            token = token_by_asset_id.get(asset_id)
            if not display_text or not token:
                continue
            normalized_mentions.append(
                {
                    "display_text": display_text,
                    "token": token,
                    "start": mention.get("start"),
                    "end": mention.get("end"),
                }
            )

        ranged_mentions = [
            item for item in normalized_mentions
            if isinstance(item.get("start"), int) and isinstance(item.get("end"), int)
        ]
        if ranged_mentions:
            ranged_mentions.sort(key=lambda item: item["start"])
            parts: list[str] = []
            cursor = 0
            for item in ranged_mentions:
                start = max(int(item["start"]), 0)
                end = max(int(item["end"]), start)
                if start < cursor or start > len(prompt):
                    continue
                parts.append(prompt[cursor:start])
                parts.append(item["token"])
                cursor = min(end, len(prompt))
            parts.append(prompt[cursor:])
            return "".join(parts)

        resolved_prompt = prompt
        for item in sorted(normalized_mentions, key=lambda current: len(current["display_text"]), reverse=True):
            resolved_prompt = resolved_prompt.replace(item["display_text"], item["token"])
        return resolved_prompt

    def _build_seedance_prompt_and_content(
        self,
        *,
        prompt: str,
        speech_text: str | None,
        attachments: list[dict] | None,
        mentions: list[dict] | None,
        reference_mode: str | None,
        image_url: str | None,
        first_frame_url: str | None,
        last_frame_url: str | None,
        reference_video_url: str | None,
        reference_audio_url: str | None,
        first_frame_asset_id: str | None = None,
        last_frame_asset_id: str | None = None,
        reference_video_asset_id: str | None = None,
        reference_audio_asset_id: str | None = None,
        reference_image_asset_ids: list[str] | None = None,
    ) -> tuple[str, list[dict], list[dict]]:
        final_attachments = self._build_seedance_attachment_pool(
            attachments=attachments,
            reference_mode=reference_mode,
            image_url=image_url,
            first_frame_url=first_frame_url,
            last_frame_url=last_frame_url,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            first_frame_asset_id=first_frame_asset_id,
            last_frame_asset_id=last_frame_asset_id,
            reference_video_asset_id=reference_video_asset_id,
            reference_audio_asset_id=reference_audio_asset_id,
            reference_image_asset_ids=reference_image_asset_ids,
        )

        token_counters = {"image": 0, "video": 0, "audio": 0}
        token_prefix = {"image": "图片", "video": "视频", "audio": "音频"}
        token_by_asset_id: dict[str, str] = {}
        asset_bindings: list[dict] = []
        content: list[dict] = []

        for attachment in final_attachments:
            asset_type = attachment["asset_type"]
            token_counters[asset_type] += 1
            resolved_token = f"{token_prefix[asset_type]}{token_counters[asset_type]}"
            asset_id = attachment.get("asset_id")
            if asset_id:
                token_by_asset_id[asset_id] = resolved_token

            asset_bindings.append(
                {
                    "asset_id": asset_id,
                    "asset_type": asset_type,
                    "asset_name": attachment.get("asset_name"),
                    "url": attachment.get("url"),
                    "role": attachment.get("role"),
                    "source": attachment.get("source"),
                    "resolved_token": resolved_token,
                }
            )

        resolved_prompt = self._rewrite_prompt_mentions_to_seedance_tokens(
            prompt,
            mentions,
            token_by_asset_id,
        )
        content.append({"type": "text", "text": resolved_prompt})
        normalized_speech_text = str(speech_text or "").strip()
        if normalized_speech_text and normalized_speech_text not in resolved_prompt:
            asset_bindings.append(
                {
                    "asset_id": None,
                    "asset_type": "speech",
                    "asset_name": "台词与旁白",
                    "url": None,
                    "role": "speech_text",
                    "source": "storyboard_speech_text",
                    "resolved_token": "台词与旁白",
                }
            )
            content.append({"type": "text", "text": f"台词与旁白：\n{normalized_speech_text}"})

        for attachment in final_attachments:
            if attachment["asset_type"] == "image":
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": attachment["url"]},
                        "role": "reference_image",
                    }
                )
            elif attachment["asset_type"] == "video":
                content.append(
                    {
                        "type": "video_url",
                        "video_url": {"url": attachment["url"]},
                        "role": "reference_video",
                    }
                )
            elif attachment["asset_type"] == "audio":
                content.append(
                    {
                        "type": "audio_url",
                        "audio_url": {"url": attachment["url"]},
                        "role": "reference_audio",
                    }
                )

        return resolved_prompt, content, asset_bindings

    async def _poll_vidu_task(
        self,
        task_id: str,
        api_key: str,
        base_url: str,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> dict:
        """轮询 Vidu 任务直到完成或超时"""
        max_wait, poll_interval = self._resolve_polling_seconds(max_wait, poll_interval)
        _log(f"Starting to poll Vidu task: {task_id}")
        async with upstream_async_client(profile="model", timeout=180.0) as client:
            start_time = time.time()
            while time.time() - start_time < max_wait:
                resp = await client.get(
                    self._vidu_api_url(base_url, f"/ent/v2/tasks/{task_id}/creations"),
                    headers=self._vidu_headers(api_key, base_url),
                )
                resp.raise_for_status()
                data = resp.json()
                parsed = self._extract_video_task_payload(data)
                state = parsed["status"]
                _log(f"Vidu task {task_id} state: {state}")

                if state in {"success", "succeeded", "completed"} or (parsed["url"] and not state):
                    return self._build_video_generation_result(
                        url=parsed["url"],
                        thumbnail_url=parsed["thumbnail_url"],
                        duration=parsed["duration"],
                        sources=[parsed, data],
                    )

                if state in {"failed", "error", "canceled", "cancelled", "unknown"}:
                    error = parsed["error"] or "Vidu generation failed"
                    raise Exception(f"Vidu task failed: {error}")

                await asyncio.sleep(poll_interval)

            raise Exception(f"Vidu task timeout after {max_wait}s")

    async def _poll_seedance_task(
        self,
        task_id: str,
        api_key: str,
        base_url: str,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> dict:
        max_wait, poll_interval = self._resolve_polling_seconds(max_wait, poll_interval)
        _log(f"Starting to poll Seedance task: {task_id}")
        async with upstream_async_client(profile="model", timeout=180.0) as client:
            start_time = time.time()
            while time.time() - start_time < max_wait:
                poll_url = f"{base_url.rstrip('/')}/volc/api/v3/contents/generations/tasks/{task_id}"
                # #region debug-point A:seedance-poll-request
                _emit_video_tail_frame_debug(
                    hypothesis_id="A",
                    location="backend/app/services/video_gen.py:_poll_seedance_task:request",
                    msg="[DEBUG] seedance poll request",
                    trace_id=task_id,
                    data={
                        "taskId": task_id,
                        "baseUrl": base_url,
                        "pollUrl": poll_url,
                        "apiKeyFingerprint": _debug_secret_fingerprint(api_key),
                    },
                )
                # #endregion
                try:
                    resp = await client.get(
                        poll_url,
                        headers=self._headers(api_key),
                    )
                    resp.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    # #region debug-point D:seedance-poll-401
                    _emit_video_tail_frame_debug(
                        hypothesis_id="D",
                        location="backend/app/services/video_gen.py:_poll_seedance_task:http_error",
                        msg="[DEBUG] seedance poll http error",
                        trace_id=task_id,
                        data={
                            "taskId": task_id,
                            "baseUrl": base_url,
                            "pollUrl": poll_url,
                            "statusCode": exc.response.status_code if exc.response else None,
                            "responseBody": exc.response.text[:500] if exc.response else None,
                            "wwwAuthenticate": exc.response.headers.get("www-authenticate") if exc.response else None,
                            "apiKeyFingerprint": _debug_secret_fingerprint(api_key),
                        },
                    )
                    # #endregion
                    raise
                data = resp.json()
                parsed = self._extract_video_task_payload(data)
                task_data = data.get("data", data)
                if not isinstance(task_data, dict):
                    task_data = {}
                status = self._normalize_task_status(
                    parsed.get("status") or task_data.get("status")
                )
                _log(f"Seedance task {task_id} status: {status}")

                if status in {"succeeded", "success", "completed", "finished"}:
                    content = task_data.get("content")
                    video_url = parsed.get("url") or self._coerce_media_url(
                        content,
                        [task_data, data],
                    )
                    cover_url = parsed.get("thumbnail_url") or self._coerce_thumbnail_url(
                        content,
                        [task_data, data],
                    )
                    if not video_url:
                        debug_summary = self._build_media_debug_summary(data)
                        _log(
                            "Seedance task succeeded but no media url found: "
                            f"task_id={task_id}, debug={debug_summary}"
                        )
                        raise Exception(
                            "Seedance task succeeded but no media url found in response: "
                            f"{debug_summary}"
                        )
                    return self._build_video_generation_result(
                        url=video_url,
                        thumbnail_url=cover_url,
                        duration=parsed.get("duration") or task_data.get("duration"),
                        task_id=parsed.get("task_id") or task_id,
                        sources=[parsed, content, task_data, data],
                    )

                if status in {"failed", "error", "canceled", "cancelled"}:
                    error = parsed.get("error")
                    if not error:
                        error = (
                            task_data.get("message")
                            or task_data.get("error")
                            or task_data.get("err_msg")
                            or "Seedance generation failed"
                        )
                    raise Exception(f"Seedance task failed: {error}")

                await asyncio.sleep(poll_interval)

            raise Exception(f"Seedance task timeout after {max_wait}s")

    async def _poll_kling_task(
        self,
        task_id: str,
        api_key: str,
        base_url: str,
        *,
        query_path: str,
        task_label: str,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> dict:
        max_wait, poll_interval = self._resolve_polling_seconds(max_wait, poll_interval)
        _log(f"Starting to poll {task_label} task: {task_id}")
        async with upstream_async_client(profile="model", timeout=180.0) as client:
            start_time = time.time()
            while time.time() - start_time < max_wait:
                resp = await client.get(
                    f"{base_url.rstrip('/')}{query_path.format(task_id=task_id)}",
                    headers=self._headers(api_key),
                )
                resp.raise_for_status()
                data = resp.json()
                parsed = self._extract_video_task_payload(data)
                status = parsed["status"]
                _log(f"{task_label} task {task_id} status: {status}")

                if status in {"succeed", "succeeded", "success", "completed", "finished"} or (parsed["url"] and not status):
                    return self._build_video_generation_result(
                        url=parsed["url"],
                        thumbnail_url=parsed["thumbnail_url"],
                        duration=parsed["duration"],
                        sources=[parsed, data],
                    )

                if status in {"failed", "error", "cancelled", "canceled"}:
                    error_message = parsed["error"] or f"{task_label} generation failed"
                    raise Exception(f"{task_label} task failed: {error_message}")

                await asyncio.sleep(poll_interval)

            raise Exception(f"{task_label} task timeout after {max_wait}s")

    async def _poll_happyhorse_task(
        self,
        task_id: str,
        api_key: str,
        base_url: str,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> dict:
        max_wait, poll_interval = self._resolve_polling_seconds(max_wait, poll_interval)
        _log(f"Starting to poll HappyHorse task: {task_id}")
        endpoint = f"/happyhorse/v1/tasks/{task_id}"
        async with upstream_async_client(profile="model", timeout=180.0) as client:
            start_time = time.time()
            while time.time() - start_time < max_wait:
                try:
                    resp = await client.get(
                        f"{base_url.rstrip('/')}{endpoint}",
                        headers=self._headers(api_key),
                    )
                    resp.raise_for_status()
                    data = resp.json()
                except httpx.HTTPStatusError as exc:
                    raise Exception(
                        "HappyHorse 任务查询失败: "
                        f"task_id={task_id}, endpoint={endpoint}, message={exc.response.text}"
                    ) from exc

                parsed = self._extract_video_task_payload(data)
                status = parsed["status"]
                _log(f"HappyHorse task {task_id} status: {status}")

                if status in {"succeed", "succeeded", "success", "completed", "finished"} or (parsed["url"] and not status):
                    return self._build_video_generation_result(
                        url=parsed["url"],
                        thumbnail_url=parsed["thumbnail_url"],
                        duration=parsed["duration"],
                        task_id=parsed.get("task_id") or task_id,
                        sources=[parsed, data],
                    )

                if status in {"failed", "error", "cancelled", "canceled", "unknown"}:
                    error_message = parsed["error"] or "HappyHorse generation failed"
                    raise Exception(f"HappyHorse task failed: {error_message}")

                await asyncio.sleep(poll_interval)

            raise Exception(f"HappyHorse task timeout after {max_wait}s")

    async def _poll_veo_operation(
        self,
        operation_name: str,
        api_key: str,
        base_url: str,
        *,
        max_wait: int | None = None,
        poll_interval: int | None = None,
    ) -> dict:
        max_wait, poll_interval = self._resolve_polling_seconds(max_wait, poll_interval)
        operation_url = self._build_veo_operation_url(base_url, operation_name)
        _log(f"Starting to poll Veo operation: {operation_url}")
        async with upstream_async_client(profile="model", timeout=180.0) as client:
            start_time = time.time()
            while time.time() - start_time < max_wait:
                resp = await client.get(
                    operation_url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    follow_redirects=True,
                )
                resp.raise_for_status()
                data = resp.json()
                _log(f"Veo operation state: done={data.get('done')}")

                if data.get("done") is True:
                    parsed = self._extract_veo_operation_result(data)
                    if parsed["error"]:
                        raise Exception(parsed["error"])
                    if parsed["video_b64"]:
                        return self._build_video_generation_result(
                            url=f"data:video/mp4;base64,{parsed['video_b64']}",
                            thumbnail_url=parsed["thumbnail_uri"] or "",
                            sources=[parsed, data],
                        )
                    if parsed["video_uri"]:
                        protected_video = await self._download_protected_veo_video(
                            parsed["video_uri"],
                            api_key=api_key,
                            base_url=base_url,
                            client=client,
                        )
                        return self._build_video_generation_result(
                            url=protected_video,
                            thumbnail_url=parsed["thumbnail_uri"] or "",
                            sources=[parsed, data],
                        )
                    raise Exception("Veo operation 已完成，但未返回可下载视频")

                await asyncio.sleep(poll_interval)

        raise Exception(f"Veo operation timeout after {max_wait}s")

    async def generate(
        self,
        prompt: str,
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        image_url: str | None = None,
        model: str = "doubao-seedance-2.0",
        duration: float | str = 5.0,
        reference_mode: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        resolution: str | None = None,
        sound_effect: bool = False,
        seed: int | None = None,
        audio: bool = True,
        off_peak: bool = False,
        reference_video_url: str | None = None,
        reference_audio_url: str | None = None,
        ratio: str | None = None,
        generation_mode: str | None = None,
        generate_mode: str | None = None,
        generate_audio: bool | None = None,
        watermark: bool | None = None,
        audio_type: str | None = None,
        audio_setting: str | None = None,
        mentions: list[dict] | None = None,
        attachments: list[dict] | None = None,
        subjects: list[dict] | None = None,
        multiframe_segments: list[dict] | None = None,
        first_frame_asset_id: str | None = None,
        last_frame_asset_id: str | None = None,
        reference_video_asset_id: str | None = None,
        reference_audio_asset_id: str | None = None,
        reference_image_asset_ids: list[str] | None = None,
        speech_text: str | None = None,
    ) -> dict:
        normalized_reference_mode = (reference_mode or "").strip() or None
        validated_assets = validate_asset_bindings(
            model=model,
            attachments=attachments,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            first_frame_url=first_frame_url,
            last_frame_url=last_frame_url,
            reference_video_asset_id=reference_video_asset_id,
            reference_audio_asset_id=reference_audio_asset_id,
            first_frame_asset_id=first_frame_asset_id,
            last_frame_asset_id=last_frame_asset_id,
            reference_image_asset_ids=reference_image_asset_ids or [],
        )
        mapped_assets = self._map_assets_to_model_params(
            model,
            validated_assets,
            generation_mode=generation_mode,
            image_url=image_url,
            first_frame_url=first_frame_url,
            last_frame_url=last_frame_url,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            subjects=subjects,
            multiframe_segments=multiframe_segments,
        )
        normalized_image_url = mapped_assets.get("image_url")
        normalized_first_frame_url = mapped_assets.get("first_frame_url")
        normalized_last_frame_url = mapped_assets.get("last_frame_url")
        normalized_reference_video_url = mapped_assets.get("reference_video_url")
        normalized_reference_audio_url = mapped_assets.get("reference_audio_url")
        reference_audio_attachment = next(
            (
                attachment
                for attachment in (mapped_assets.get("attachments") or [])
                if str(attachment.get("asset_type") or "").strip() == "audio"
                and str(attachment.get("url") or "").strip() == str(normalized_reference_audio_url or "").strip()
            ),
            None,
        )
        normalized_reference_audio_duration = self._normalize_attachment_duration(
            (reference_audio_attachment or {}).get("duration")
        )
        normalized_attachments: list[dict] = []
        normalized_subjects = mapped_assets.get("subjects") or []
        normalized_multiframe_segments = mapped_assets.get("multiframe_segments") or []
        inline_image_references = self._is_seedance_model(model)

        async with upstream_async_client(profile="model", timeout=180.0) as client:
            if normalized_image_url:
                normalized_image_url = await self._prepare_external_image_url(
                    normalized_image_url,
                    client,
                    force_data_uri=inline_image_references,
                )
            if normalized_first_frame_url:
                normalized_first_frame_url = await self._prepare_external_image_url(
                    normalized_first_frame_url,
                    client,
                    force_data_uri=inline_image_references,
                )
            if normalized_last_frame_url:
                normalized_last_frame_url = await self._prepare_external_image_url(
                    normalized_last_frame_url,
                    client,
                    force_data_uri=inline_image_references,
                )
            if normalized_reference_video_url:
                if self._is_seedance_model(model):
                    normalized_reference_video_url = await self._prepare_seedance_reference_media_url(
                        normalized_reference_video_url,
                        "参考视频",
                        media_type="video",
                    )
                else:
                    normalized_reference_video_url = await self._prepare_external_video_url(
                        normalized_reference_video_url,
                        "参考视频",
                    )
            if normalized_reference_audio_url:
                if self._is_seedance_model(model):
                    normalized_reference_audio_url = await self._prepare_seedance_reference_media_url(
                        normalized_reference_audio_url,
                        "参考音频",
                        media_type="audio",
                        known_duration_seconds=normalized_reference_audio_duration,
                    )
                else:
                    normalized_reference_audio_url = self._prepare_external_media_url(
                        normalized_reference_audio_url,
                        "参考音频",
                    )
            for attachment in mapped_assets.get("attachments") or []:
                normalized_attachment = self._normalize_seedance_attachment(attachment)
                if not normalized_attachment:
                    continue
                if normalized_attachment["asset_type"] == "image":
                    normalized_attachment["url"] = await self._prepare_external_image_url(
                        normalized_attachment["url"],
                        client,
                        force_data_uri=inline_image_references,
                    )
                elif normalized_attachment["asset_type"] == "video":
                    if self._is_seedance_model(model):
                        normalized_attachment["url"] = await self._prepare_seedance_reference_media_url(
                            normalized_attachment["url"],
                            "参考视频",
                            media_type="video",
                        )
                    else:
                        normalized_attachment["url"] = await self._prepare_external_video_url(
                            normalized_attachment["url"],
                            "参考视频",
                        )
                else:
                    if self._is_seedance_model(model):
                        normalized_attachment["url"] = await self._prepare_seedance_reference_media_url(
                            normalized_attachment["url"],
                            "参考音频",
                            media_type="audio",
                            known_duration_seconds=normalized_attachment.get("duration"),
                        )
                    else:
                        normalized_attachment["url"] = self._prepare_external_media_url(
                            normalized_attachment["url"],
                            "参考素材",
                        )
                normalized_attachments.append(normalized_attachment)

        effective_image_url = normalized_image_url
        effective_first_frame_url = normalized_first_frame_url
        effective_last_frame_url = normalized_last_frame_url
        if normalized_reference_mode == "first_frame":
            effective_image_url = None
            effective_last_frame_url = None
            if not effective_first_frame_url:
                effective_first_frame_url = normalized_image_url
        elif normalized_reference_mode == "last_frame":
            effective_image_url = None
            effective_first_frame_url = None
        elif normalized_reference_mode == "video_ref":
            effective_image_url = None
            if not effective_first_frame_url:
                effective_first_frame_url = normalized_image_url

        if self._is_vidu_model(model):
            return await self._generate_vidu(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                image_url=effective_image_url,
                first_frame_url=effective_first_frame_url,
                last_frame_url=effective_last_frame_url,
                model=model,
                duration=duration,
                resolution=resolution,
                ratio=ratio,
                generation_mode=generation_mode,
                seed=seed,
                audio=audio,
                audio_type=audio_type,
                off_peak=off_peak,
                watermark=watermark,
                attachments=normalized_attachments,
                subjects=normalized_subjects,
                multiframe_segments=normalized_multiframe_segments,
            )
        elif self._is_fal_model(model):
            return await self._generate_fal(
                prompt=prompt,
                api_key=api_key,
                model=model,
                image_url=effective_image_url,
                first_frame_url=effective_first_frame_url,
                last_frame_url=effective_last_frame_url,
                reference_video_url=normalized_reference_video_url,
                duration=duration,
                resolution=resolution,
                ratio=ratio,
                reference_mode=normalized_reference_mode,
                generate_mode=generate_mode,
                generate_audio=generate_audio,
                attachments=normalized_attachments,
            )
        elif self._is_seedance_model(model):
            return await self._generate_seedance(
                prompt=prompt,
                speech_text=speech_text,
                api_key=api_key,
                base_url=base_url,
                image_url=effective_image_url,
                first_frame_url=effective_first_frame_url,
                last_frame_url=effective_last_frame_url,
                reference_mode=normalized_reference_mode,
                model=model,
                duration=duration,
                resolution=resolution,
                reference_video_url=normalized_reference_video_url,
                reference_audio_url=normalized_reference_audio_url,
                ratio=ratio,
                generate_mode=generate_mode,
                generate_audio=generate_audio,
                watermark=watermark,
                mentions=mentions,
                attachments=normalized_attachments,
                first_frame_asset_id=first_frame_asset_id,
                last_frame_asset_id=last_frame_asset_id,
                reference_video_asset_id=reference_video_asset_id,
                reference_audio_asset_id=reference_audio_asset_id,
                reference_image_asset_ids=reference_image_asset_ids or [],
            )
        elif self._is_happyhorse_model(model):
            return await self._generate_happyhorse(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                duration=duration,
                resolution=resolution,
                ratio=ratio,
                generate_mode=generate_mode,
                first_frame_url=effective_first_frame_url,
                reference_video_url=normalized_reference_video_url,
                audio_setting=audio_setting,
                attachments=normalized_attachments,
            )
        elif self._is_veo_model(model):
            return await self._generate_veo(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                image_url=effective_image_url,
                first_frame_url=effective_first_frame_url,
                last_frame_url=effective_last_frame_url,
                model=model,
                duration=duration,
                resolution=resolution,
                ratio=ratio,
                generation_mode=generation_mode,
                attachments=normalized_attachments,
            )
        elif self._is_kling_model(model):
            return await self._generate_kling(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                image_url=effective_image_url,
                first_frame_url=effective_first_frame_url,
                last_frame_url=effective_last_frame_url,
                model=model,
                duration=duration,
                ratio=ratio,
                reference_video_url=normalized_reference_video_url,
                reference_mode=normalized_reference_mode,
                generate_mode=generate_mode,
                generate_audio=generate_audio,
                attachments=normalized_attachments,
            )

        resolved_image_url = effective_image_url or effective_first_frame_url
        resolved_first_frame_url = effective_first_frame_url or effective_image_url

        payload: dict = {
            "model": model,
            "prompt": prompt,
        }
        if isinstance(duration, str) and duration == "auto":
            payload["duration"] = 5.0
        elif isinstance(duration, (int, float)):
            payload["duration"] = duration
        else:
            payload["duration"] = 5.0

        if resolved_image_url:
            payload["image_url"] = resolved_image_url
        if resolved_first_frame_url:
            payload["first_frame_url"] = resolved_first_frame_url
        if effective_last_frame_url:
            payload["last_frame_url"] = effective_last_frame_url
        if resolution:
            payload["resolution"] = resolution
        if sound_effect:
            payload["sound_effect"] = True
        if generate_mode:
            payload["generate_mode"] = generate_mode

        async with upstream_async_client(profile="model", timeout=180.0) as client:
            data = await self._post_video_generation_task(
                client,
                base_url=base_url,
                api_key=api_key,
                payload=payload,
                model=model,
            )

            video_data = data.get("data", [{}])[0] if data.get("data") else {}
            return self._build_video_generation_result(
                url=video_data.get("url", ""),
                duration=video_data.get("duration", payload.get("duration", 5.0)),
                thumbnail_url=video_data.get("thumbnail_url", ""),
                task_id=data.get("id", ""),
                sources=[video_data, data],
            )

    async def _generate_vidu(
        self,
        prompt: str,
        api_key: str,
        base_url: str,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        model: str = "video-viduq3-pro",
        duration: float | str = 5.0,
        resolution: str | None = None,
        ratio: str | None = None,
        generation_mode: str | None = None,
        seed: int | None = None,
        audio: bool = True,
        audio_type: str | None = None,
        off_peak: bool = False,
        watermark: bool | None = None,
        attachments: list[dict] | None = None,
        subjects: list[dict] | None = None,
        multiframe_segments: list[dict] | None = None,
    ) -> dict:
        normalized_duration = self._normalize_vidu_duration(duration)
        normalized_generation_mode = (generation_mode or "").strip() or None

        if not normalized_generation_mode:
            if first_frame_url and last_frame_url:
                normalized_generation_mode = "start_end"
            elif first_frame_url or image_url:
                normalized_generation_mode = "first_frame"
            else:
                normalized_generation_mode = "text_to_video"

        def _collect_reference_image_urls() -> list[str]:
            urls: list[str] = []
            seen: set[str] = set()

            def _push(url: str | None) -> None:
                normalized = str(url or "").strip()
                if not normalized or normalized in seen:
                    return
                seen.add(normalized)
                urls.append(normalized)

            for attachment in attachments or []:
                asset_type = str(
                    attachment.get("asset_type") or attachment.get("assetType") or ""
                ).strip().lower()
                role = str(attachment.get("role") or "").strip().lower()
                if asset_type != "image":
                    continue
            if role in {
                "reference_image",
                "reference",
                "character",
                "scene",
                "prop",
                "first_frame",
                "last_frame",
                "",
            }:
                    _push(attachment.get("url"))
            return urls

        async with upstream_async_client(profile="model", timeout=180.0) as client:
            endpoint = "/vidu/ent/v2/text2video"
            vidu_payload: dict[str, object] = {
                "model": model,
                "prompt": prompt,
                "duration": normalized_duration,
                "seed": seed if seed is not None else 0,
            }

            if resolution:
                vidu_payload["resolution"] = resolution.lower()
            if ratio and normalized_generation_mode in {"text_to_video", "reference_subjects"}:
                vidu_payload["aspect_ratio"] = ratio
            if normalized_generation_mode in {
                "text_to_video",
                "first_frame",
                "start_end",
                "reference_subjects",
            }:
                vidu_payload["audio"] = audio
                vidu_payload["off_peak"] = off_peak
            if audio_type:
                vidu_payload["audio_type"] = audio_type
            if watermark is not None:
                vidu_payload["watermark"] = watermark

            if normalized_generation_mode == "text_to_video":
                endpoint = "/vidu/ent/v2/text2video"
            elif normalized_generation_mode in {"first_frame", "start_end"}:
                start_frame_url = first_frame_url or image_url
                if not start_frame_url:
                    raise ValueError("Vidu 生成需要至少一张首帧图片")
                endpoint = "/vidu/ent/v2/img2video"
                expected_image_count = 1
                if normalized_generation_mode == "start_end":
                    endpoint = "/vidu/ent/v2/start-end2video"
                    expected_image_count = 2
                images = await self._prepare_external_image_urls(
                    client,
                    start_frame_url,
                    last_frame_url,
                )
                if len(images) != expected_image_count:
                    raise ValueError(
                        f"Vidu 图片参数不合法：当前模式需要 {expected_image_count} 张图片，实际得到 {len(images)} 张"
                    )
                vidu_payload["images"] = images
            elif normalized_generation_mode == "reference_subjects":
                endpoint = "/vidu/ent/v2/reference2video"
                if subjects:
                    normalized_subjects: list[dict[str, object]] = []
                    for subject in subjects:
                        if not isinstance(subject, dict):
                            continue
                        subject_name = str(subject.get("name") or "").strip()
                        if not subject_name:
                            continue
                        subject_images = await self._prepare_external_image_urls(
                            client,
                            *(subject.get("images") or []),
                        )
                        if not subject_images:
                            continue
                        normalized_subjects.append(
                            {
                                "name": subject_name,
                                "images": subject_images[:3],
                            }
                        )
                    if not normalized_subjects:
                        raise ValueError("Vidu 参考主体模式至少需要 1 个有效主体")
                    vidu_payload["subjects"] = normalized_subjects
                else:
                    reference_images = await self._prepare_external_image_urls(
                        client,
                        *_collect_reference_image_urls(),
                    )
                    if not reference_images:
                        raise ValueError("Vidu 参考主体模式至少需要 1 张参考图")
                    vidu_payload["images"] = reference_images[:7]
            elif normalized_generation_mode == "multiframe":
                endpoint = "/vidu/ent/v2/multiframe"
                start_frame_url = first_frame_url or image_url
                if not start_frame_url:
                    raise ValueError("Vidu 智能多帧需要起始图")
                start_image = await self._prepare_external_image_url(start_frame_url, client)
                segment_inputs = [
                    item for item in (multiframe_segments or []) if isinstance(item, dict)
                ]
                if not segment_inputs:
                    segment_inputs = [
                        {"key_image": url, "prompt": prompt, "duration": normalized_duration}
                        for url in _collect_reference_image_urls()
                    ]
                if len(segment_inputs) < 2:
                    raise ValueError("Vidu 智能多帧至少需要 2 个关键帧")

                image_settings: list[dict[str, object]] = []
                for segment in segment_inputs[:9]:
                    key_image_url = (
                        segment.get("key_image")
                        or segment.get("keyImage")
                        or segment.get("url")
                    )
                    prepared_key_image = await self._prepare_external_image_url(
                        str(key_image_url or "").strip(),
                        client,
                    )
                    image_settings.append(
                        {
                            "prompt": str(segment.get("prompt") or prompt or "").strip(),
                            "key_image": prepared_key_image,
                            "duration": self._normalize_vidu_duration(
                                segment.get("duration") or normalized_duration
                            ),
                        }
                    )
                vidu_payload = {
                    "model": model,
                    "start_image": start_image,
                    "image_settings": image_settings,
                    "resolution": (resolution or "720p").lower(),
                }
                if watermark is not None:
                    vidu_payload["watermark"] = watermark
            else:
                raise ValueError(f"未支持的 Vidu 生成模式: {normalized_generation_mode}")

            payload_for_log = {
                **vidu_payload,
                "images": [
                    self._describe_external_image(image)
                    for image in (vidu_payload.get("images") or [])
                ],
                "start_image": self._describe_external_image(
                    str(vidu_payload.get("start_image") or "")
                )
                if vidu_payload.get("start_image")
                else None,
                "image_settings": [
                    {
                        **item,
                        "key_image": self._describe_external_image(
                            str(item.get("key_image") or "")
                        ),
                    }
                    for item in (vidu_payload.get("image_settings") or [])
                    if isinstance(item, dict)
                ],
            }
            _log(f"Vidu API payload: {payload_for_log}")

            try:
                resp = await client.post(
                    self._vidu_api_url(base_url, endpoint),
                    headers=self._vidu_headers(api_key, base_url),
                    json=vidu_payload,
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                response_text = exc.response.text
                image_count = len(vidu_payload.get("images") or [])
                if not image_count and vidu_payload.get("start_image"):
                    image_count = 1
                raise Exception(
                    f"Vidu 请求失败: endpoint={endpoint}, generation_mode={normalized_generation_mode}, images_count={image_count}, "
                    f"message={response_text}"
                ) from exc

            _log(f"Vidu API response: {data}")
            parsed = self._extract_video_task_payload(data)
            if parsed["url"]:
                return self._build_video_generation_result(
                    url=parsed["url"],
                    duration=parsed["duration"] or vidu_payload.get("duration", 5.0),
                    thumbnail_url=parsed["thumbnail_url"],
                    task_id=parsed["task_id"] or "",
                    sources=[parsed, data],
                )

            task_id = parsed["task_id"] or ""
            if not task_id:
                raise Exception(f"No task_id in Vidu response: {data}")

            _log(f"Vidu task_id: {task_id}, waiting for video generation...")

            result = await self._poll_vidu_task(task_id, api_key, base_url)

            _log(f"Vidu extracted video_url: {result.get('url')}")

            return self._build_video_generation_result(
                url=result.get("url", ""),
                duration=result.get("duration") or vidu_payload.get("duration", 5.0),
                thumbnail_url=result.get("thumbnail_url", ""),
                task_id=task_id,
                sources=[result],
            )

    async def _generate_seedance(
        self,
        prompt: str,
        speech_text: str | None,
        api_key: str,
        base_url: str,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        reference_mode: str | None = None,
        model: str = "doubao-seedance-2.0",
        duration: float | str = 5.0,
        resolution: str | None = None,
        reference_video_url: str | None = None,
        reference_audio_url: str | None = None,
        ratio: str | None = None,
        generate_mode: str | None = None,
        generate_audio: bool | None = None,
        watermark: bool | None = None,
        mentions: list[dict] | None = None,
        attachments: list[dict] | None = None,
        first_frame_asset_id: str | None = None,
        last_frame_asset_id: str | None = None,
        reference_video_asset_id: str | None = None,
        reference_audio_asset_id: str | None = None,
        reference_image_asset_ids: list[str] | None = None,
    ) -> dict:
        normalized_model = self._normalize_seedance_model(model)
        normalized_duration = self._normalize_seedance_duration(duration)
        normalized_resolution = self._normalize_seedance_resolution(resolution)
        normalized_reference_mode = (reference_mode or "full").strip() or "full"
        api_generate_mode = self._resolve_seedance_generate_mode_for_api(generate_mode)
        resolved_prompt, content, asset_bindings = self._build_seedance_prompt_and_content(
            prompt=prompt,
            speech_text=speech_text,
            attachments=attachments,
            mentions=mentions,
            reference_mode=normalized_reference_mode,
            image_url=image_url,
            first_frame_url=first_frame_url,
            last_frame_url=last_frame_url,
            reference_video_url=reference_video_url,
            reference_audio_url=reference_audio_url,
            first_frame_asset_id=first_frame_asset_id,
            last_frame_asset_id=last_frame_asset_id,
            reference_video_asset_id=reference_video_asset_id,
            reference_audio_asset_id=reference_audio_asset_id,
            reference_image_asset_ids=reference_image_asset_ids,
        )

        payload: dict = {
            "model": normalized_model,
            "content": content,
            "generate_audio": True if generate_audio is None else generate_audio,
            "ratio": ratio or "16:9",
            "duration": normalized_duration,
        }
        if watermark is not None:
            payload["watermark"] = watermark
        if normalized_resolution:
            payload["resolution"] = normalized_resolution
        if api_generate_mode:
            payload["generate_mode"] = api_generate_mode

        submit_url = f"{base_url.rstrip('/')}/volc/api/v3/contents/generations/tasks"
        submit_attempts = 3 if self._contains_seedance_remote_media_references(asset_bindings) else 2
        public_base_url = self._get_public_upload_base_url()
        guidance_suffix = (
            "；若本次带了本地上传的参考视频/音频，请确认 `PUBLIC_BASE_URL` 对外可访问"
            + (
                "，当前该地址仍为 HTTP，云端正式环境建议尽快切到 HTTPS 后再重试"
                if public_base_url and self._is_http_url(public_base_url)
                else "，本地临时联调时再额外确认公共隧道在线"
            )
            if self._contains_seedance_remote_media_references(asset_bindings)
            else ""
        )
        async with upstream_async_client(
            profile="model",
            timeout=self._build_http_timeout(read=420.0),
            follow_redirects=True,
        ) as client:
            data = None
            last_http_error: Exception | None = None
            for attempt in range(1, submit_attempts + 1):
                # #region debug-point A:seedance-submit-request
                _emit_video_tail_frame_debug(
                    hypothesis_id="A",
                    location="backend/app/services/video_gen.py:_generate_seedance:submit",
                    msg="[DEBUG] seedance submit request",
                    data={
                        "baseUrl": base_url,
                        "submitUrl": submit_url,
                        "model": normalized_model,
                        "apiKeyFingerprint": _debug_secret_fingerprint(api_key),
                        "attempt": attempt,
                        "referenceMode": normalized_reference_mode,
                        "generateMode": api_generate_mode,
                        "ratio": payload.get("ratio"),
                        "duration": payload.get("duration"),
                        "resolution": payload.get("resolution"),
                        "hasFirstFrame": bool(first_frame_url),
                        "hasLastFrame": bool(last_frame_url),
                        "hasReferenceVideo": bool(reference_video_url),
                        "hasReferenceAudio": bool(reference_audio_url),
                        "attachmentCount": len(attachments or []),
                        "assetBindingCount": len(asset_bindings or []),
                    },
                )
                # #endregion
                try:
                    resp = await client.post(
                        submit_url,
                        headers=self._headers(api_key),
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    break
                except httpx.TimeoutException as exc:
                    last_http_error = exc
                    if attempt < submit_attempts:
                        _log(
                            "Seedance submit timeout, retrying "
                            f"({attempt}/{submit_attempts}): {exc}"
                        )
                        await asyncio.sleep(min(attempt * 2, 6))
                        continue
                    raise Exception(
                        f"Seedance 请求超时，请稍后重试{guidance_suffix}"
                    ) from exc
                except httpx.HTTPStatusError as exc:
                    response_text = exc.response.text
                    last_http_error = exc
                    if (
                        attempt < submit_attempts
                        and self._is_seedance_retryable_submit_error(
                            status_code=exc.response.status_code,
                            message=response_text,
                        )
                    ):
                        _log(
                            "Seedance submit got retryable upstream error, retrying "
                            f"({attempt}/{submit_attempts}): status={exc.response.status_code}, "
                            f"body={response_text[:200]}"
                        )
                        await asyncio.sleep(min(attempt * 2, 6))
                        continue
                    formatted_message = self._format_seedance_submit_error(
                        response_text=response_text,
                        model=normalized_model,
                        asset_bindings=asset_bindings,
                    )
                    trace = self._build_seedance_trace(
                        speech_text=speech_text,
                        reference_audio_url=reference_audio_url,
                        generate_audio=generate_audio,
                        asset_bindings=asset_bindings,
                    )
                    raise Exception(
                        "Seedance 请求失败: "
                        f"{formatted_message}。"
                        f"当前编排：speech_text_present={trace['speech_text_present']}, "
                        f"reference_audio_present={trace['reference_audio_present']}, "
                        f"generate_audio={trace['generate_audio']}"
                        f"{guidance_suffix}"
                    ) from exc

            if data is None:
                raise Exception(
                    f"Seedance 请求失败: 未拿到有效响应{guidance_suffix}"
                ) from last_http_error

            task_id = (
                data.get("data", {}).get("task_id")
                or data.get("data", {}).get("id")
                or data.get("task_id")
                or data.get("id")
            )
            if not task_id:
                raise Exception(f"No task_id in Seedance response: {data}")

            # #region debug-point C:seedance-submit-response
            _emit_video_tail_frame_debug(
                hypothesis_id="C",
                location="backend/app/services/video_gen.py:_generate_seedance:task_id",
                msg="[DEBUG] seedance submit response resolved task id",
                trace_id=str(task_id),
                data={
                    "taskId": str(task_id),
                    "baseUrl": base_url,
                    "model": normalized_model,
                    "apiKeyFingerprint": _debug_secret_fingerprint(api_key),
                    "responseKeys": list(data.keys())[:12] if isinstance(data, dict) else [],
                },
            )
            # #endregion
            result = await self._poll_seedance_task(task_id, api_key, base_url)
            return self._build_video_generation_result(
                url=result.get("url", ""),
                duration=result.get("duration") or payload.get("duration", 5),
                thumbnail_url=result.get("thumbnail_url", ""),
                task_id=task_id,
                sources=[result],
                extra={
                    "prompt_raw": prompt,
                    "prompt_resolved": resolved_prompt,
                    "asset_bindings": asset_bindings,
                    "seedance_trace": self._build_seedance_trace(
                        speech_text=speech_text,
                        reference_audio_url=reference_audio_url,
                        generate_audio=generate_audio,
                        asset_bindings=asset_bindings,
                    ),
                },
            )

    async def _generate_happyhorse(
        self,
        prompt: str,
        api_key: str,
        base_url: str,
        model: str = "happyhorse-1.0-t2v",
        duration: float | str = 5.0,
        resolution: str | None = None,
        ratio: str | None = None,
        generate_mode: str | None = None,
        first_frame_url: str | None = None,
        reference_video_url: str | None = None,
        audio_setting: str | None = None,
        attachments: list[dict] | None = None,
    ) -> dict:
        normalized_duration = self._normalize_happyhorse_duration(duration)
        normalized_resolution = self._normalize_happyhorse_resolution(resolution)
        normalized_ratio = ratio or "16:9"
        normalized_audio_setting = str(audio_setting or "").strip().lower() or None
        payload: dict = {
            "model": model,
            "input": {
                "prompt": prompt,
            },
            "parameters": {
                "resolution": normalized_resolution,
            },
        }

        if model == "happyhorse-1.0-t2v":
            payload["parameters"]["ratio"] = normalized_ratio
            payload["parameters"]["duration"] = normalized_duration
        elif model == "happyhorse-1.0-i2v":
            if not first_frame_url:
                raise ValueError("HappyHorse 图生视频需要首帧图片")
            payload["input"]["media"] = [
                {
                    "type": "first_frame",
                    "url": first_frame_url,
                }
            ]
            payload["parameters"]["duration"] = normalized_duration
        elif model == "happyhorse-1.0-r2v":
            reference_images = self._collect_happyhorse_reference_images(
                attachments=attachments,
            )
            if not reference_images:
                raise ValueError("HappyHorse 参考生视频至少需要 1 张参考图")
            payload["input"]["media"] = [
                {
                    "type": "reference_image",
                    "url": url,
                }
                for url in reference_images[:9]
            ]
            payload["parameters"]["ratio"] = normalized_ratio
            payload["parameters"]["duration"] = normalized_duration
        elif model == "happyhorse-1.0-video-edit":
            if not reference_video_url:
                raise ValueError("HappyHorse 视频编辑需要待编辑视频")
            reference_images = self._collect_happyhorse_reference_images(
                attachments=attachments,
            )
            payload["input"]["media"] = [
                {
                    "type": "video",
                    "url": reference_video_url,
                },
                *[
                    {
                        "type": "reference_image",
                        "url": url,
                    }
                    for url in reference_images[:5]
                ],
            ]
            if normalized_audio_setting:
                payload["parameters"]["audio_setting"] = normalized_audio_setting
        else:
            raise ValueError(f"未支持的 HappyHorse 模型: {model}")

        if generate_mode:
            payload["parameters"]["generate_mode"] = generate_mode

        async with upstream_async_client(profile="model", timeout=180.0) as client:
            data = await self._post_happyhorse_task(
                client,
                base_url=base_url,
                api_key=api_key,
                payload=payload,
                model=model,
            )
            parsed = self._extract_video_task_payload(data)

            if parsed["url"]:
                return self._build_video_generation_result(
                    url=parsed["url"],
                    duration=parsed["duration"] or normalized_duration,
                    thumbnail_url=parsed["thumbnail_url"],
                    task_id=parsed["task_id"] or "",
                    sources=[parsed, data],
                )

            task_id = parsed["task_id"] or ""
            if not task_id:
                raise Exception(f"No task_id in HappyHorse response: {data}")

            result = await self._poll_happyhorse_task(task_id, api_key, base_url)
            return self._build_video_generation_result(
                url=result.get("url", ""),
                duration=result.get("duration") or normalized_duration,
                thumbnail_url=result.get("thumbnail_url", ""),
                task_id=task_id,
                sources=[result],
            )

    async def _generate_kling(
        self,
        prompt: str,
        api_key: str,
        base_url: str,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        reference_video_url: str | None = None,
        attachments: list[dict] | None = None,
        model: str = "video-kling-v3",
        duration: float | str = 5.0,
        ratio: str | None = None,
        reference_mode: str | None = None,
        generate_mode: str | None = None,
        generate_audio: bool | None = None,
    ) -> dict:
        image_urls = self._collect_kling_image_urls(
            image_url=image_url,
            first_frame_url=first_frame_url,
            last_frame_url=last_frame_url,
            attachments=attachments,
        )
        route_config = self._get_kling_route_config(
            model,
            image_count=len(image_urls),
            has_reference_video=bool(reference_video_url),
            reference_mode=reference_mode,
        )
        if not route_config:
            raise ValueError(f"未识别的 Kling 模型: {model}")

        route = route_config["route"]
        normalized_duration = self._normalize_kling_duration(duration)
        normalized_mode = self._normalize_kling_mode(
            generate_mode,
            default=route_config["default_mode"],
        )
        model_name = route_config["model_name"]
        task_label = route_config["task_label"]
        payload: dict[str, Any] = {
            "model_name": model_name,
            "prompt": prompt,
            "duration": normalized_duration,
            "callback_url": "",
            "external_task_id": "",
        }

        if route == "text2video":
            payload["negative_prompt"] = ""
            payload["mode"] = normalized_mode
            payload["sound"] = "off" if generate_audio is False else "on"
            if ratio:
                payload["aspect_ratio"] = ratio
        elif route == "image2video":
            if not image_urls:
                raise ValueError("Kling 图生视频需要至少 1 张参考图")
            payload["image"] = image_urls[0]
            payload["mode"] = normalized_mode
            if ratio:
                payload["aspect_ratio"] = ratio
        elif route == "multi-image2video":
            if len(image_urls) < 2:
                raise ValueError("Kling 多图参考生视频需要至少 2 张参考图")
            payload["image_list"] = [{"image": url} for url in image_urls[:4]]
            payload["mode"] = normalized_mode
            if ratio:
                payload["aspect_ratio"] = ratio
        elif route == "omni-video":
            if not reference_video_url:
                raise ValueError("Kling 视频 Omni 需要提供参考视频")
            payload["video_url"] = reference_video_url
            payload["mode"] = normalized_mode
        else:
            raise ValueError(f"未支持的 Kling 路由类型: {route}")

        async with upstream_async_client(profile="model", timeout=180.0) as client:
            try:
                resp = await client.post(
                    f"{base_url.rstrip('/')}{route_config['submit_path']}",
                    headers=self._headers(api_key),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                raise Exception(
                    f"{task_label} 请求失败: message={exc.response.text}"
                ) from exc

            parsed = self._extract_video_task_payload(data)
            if parsed["url"]:
                return self._build_video_generation_result(
                    url=parsed["url"],
                    duration=parsed["duration"] or duration,
                    thumbnail_url=parsed["thumbnail_url"],
                    task_id=parsed["task_id"] or "",
                    sources=[parsed, data],
                )

            task_id = parsed["task_id"]
            if not task_id:
                raise Exception(f"No task_id in {task_label} response: {data}")

            result = await self._poll_kling_task(
                task_id,
                api_key,
                base_url,
                query_path=route_config["query_path"],
                task_label=task_label,
            )
            return self._build_video_generation_result(
                url=result.get("url", ""),
                duration=result.get("duration") or duration,
                thumbnail_url=result.get("thumbnail_url", ""),
                task_id=task_id,
                sources=[result],
            )

    async def _generate_veo(
        self,
        prompt: str,
        api_key: str,
        base_url: str,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        model: str = "veo-3.1-generate-preview",
        duration: float | str = 8.0,
        resolution: str | None = None,
        ratio: str | None = None,
        generation_mode: str | None = None,
        attachments: list[dict] | None = None,
    ) -> dict:
        normalized_generation_mode = (generation_mode or "").strip() or None
        normalized_duration = self._normalize_veo_duration(duration)
        normalized_resolution = self._normalize_veo_resolution(resolution)
        normalized_ratio = str(ratio or "16:9").strip() or "16:9"

        if not normalized_generation_mode:
            if first_frame_url and last_frame_url:
                normalized_generation_mode = "start_end"
            elif first_frame_url or image_url:
                normalized_generation_mode = "first_frame"
            elif attachments:
                normalized_generation_mode = "reference_subjects"
            else:
                normalized_generation_mode = "text_to_video"

        payload: dict[str, object] = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "aspectRatio": normalized_ratio,
                "durationSeconds": normalized_duration,
                "resolution": normalized_resolution.lower(),
                "sampleCount": 1,
            },
        }
        instance = payload["instances"][0]

        async with upstream_async_client(profile="model", timeout=300.0) as client:
            if normalized_generation_mode == "text_to_video":
                pass
            elif normalized_generation_mode == "first_frame":
                source_url = first_frame_url or image_url
                if not source_url:
                    raise ValueError("Veo 图生视频需要首帧图片")
                instance["image"] = await self._build_veo_inline_media_part(source_url, client)
            elif normalized_generation_mode == "start_end":
                source_url = first_frame_url or image_url
                if not source_url or not last_frame_url:
                    raise ValueError("Veo 首尾帧模式需要同时提供首帧和尾帧")
                instance["image"] = await self._build_veo_inline_media_part(source_url, client)
                instance["lastFrame"] = await self._build_veo_inline_media_part(last_frame_url, client)
            elif normalized_generation_mode == "reference_subjects":
                source_url = first_frame_url or image_url
                exclude_urls = {source_url} if source_url else set()
                reference_urls = self._collect_veo_reference_image_urls(
                    image_url=image_url,
                    first_frame_url=first_frame_url,
                    last_frame_url=last_frame_url,
                    attachments=attachments,
                    exclude_urls=exclude_urls,
                )
                if source_url:
                    instance["image"] = await self._build_veo_inline_media_part(source_url, client)
                if not reference_urls and not source_url:
                    raise ValueError("Veo 多参考图模式至少需要 1 张图片")
                inline_reference_images = []
                for reference_url in reference_urls[:3]:
                    inline_reference_images.append(
                        {
                            "image": await self._build_veo_inline_media_part(reference_url, client),
                            "referenceType": "asset",
                        }
                    )
                if inline_reference_images:
                    instance["referenceImages"] = inline_reference_images
            else:
                raise ValueError(f"未支持的 Veo 生成模式: {normalized_generation_mode}")

            try:
                resp = await client.post(
                    f"{base_url.rstrip('/')}/v1beta/models/{model}:predictLongRunning",
                    headers=self._headers(api_key),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                raise Exception(f"Veo 请求失败: message={exc.response.text}") from exc

        operation_name = str(data.get("name") or data.get("operation") or "").strip()
        if not operation_name:
            parsed = self._extract_veo_operation_result(data)
            if parsed["video_b64"]:
                return self._build_video_generation_result(
                    url=f"data:video/mp4;base64,{parsed['video_b64']}",
                    duration=normalized_duration,
                    thumbnail_url=parsed["thumbnail_uri"] or "",
                    task_id="",
                    sources=[parsed, data],
                )
            if parsed["video_uri"]:
                async with upstream_async_client(profile="model", timeout=180.0) as client:
                    protected_video = await self._download_protected_veo_video(
                        parsed["video_uri"],
                        api_key=api_key,
                        base_url=base_url,
                        client=client,
                    )
                return self._build_video_generation_result(
                    url=protected_video,
                    duration=normalized_duration,
                    thumbnail_url=parsed["thumbnail_uri"] or "",
                    task_id="",
                    sources=[parsed, data],
                )
            raise Exception(f"No operation name in Veo response: {data}")

        result = await self._poll_veo_operation(operation_name, api_key, base_url)
        return self._build_video_generation_result(
            url=result.get("url", ""),
            duration=normalized_duration,
            thumbnail_url=result.get("thumbnail_url", ""),
            task_id=operation_name,
            sources=[result],
        )

    async def _generate_fal(
        self,
        *,
        prompt: str,
        api_key: str,
        model: str,
        image_url: str | None = None,
        first_frame_url: str | None = None,
        last_frame_url: str | None = None,
        reference_video_url: str | None = None,
        duration: float | str | None = None,
        resolution: str | None = None,
        ratio: str | None = None,
        reference_mode: str | None = None,
        generate_mode: str | None = None,
        generate_audio: bool | None = None,
        attachments: list[dict] | None = None,
    ) -> dict:
        normalized_model = str(model or "").strip().lower()
        source_image_url = str(first_frame_url or image_url or "").strip()
        normalized_duration = self._normalize_kling_duration(duration)
        normalized_ratio = str(ratio or "").strip() or "16:9"
        normalized_generate_audio = True if generate_audio is None else bool(generate_audio)
        arguments: dict[str, Any] = {}
        if normalized_model == FAL_WAN_FLF2V_MODEL_ID:
            start_image_url = source_image_url
            end_image_url = str(last_frame_url or "").strip()
            if not start_image_url or not end_image_url:
                raise ValueError("fal WAN FLF2V 需要同时提供首帧和尾帧图片")
            arguments = {
                "prompt": prompt,
                "start_image_url": start_image_url,
                "end_image_url": end_image_url,
            }
            normalized_resolution = self._normalize_fal_resolution(resolution)
            if normalized_resolution:
                arguments["resolution"] = normalized_resolution
            normalized_ratio = str(ratio or "").strip()
            if normalized_ratio in {"16:9", "9:16", "1:1", "auto"}:
                arguments["aspect_ratio"] = normalized_ratio
        elif normalized_model in {
            FAL_KLING_V3_STANDARD_TEXT_TO_VIDEO_MODEL_ID,
            FAL_KLING_V3_PRO_TEXT_TO_VIDEO_MODEL_ID,
        }:
            arguments = {
                "prompt": prompt,
                "duration": normalized_duration,
                "generate_audio": normalized_generate_audio,
                "shot_type": "customize",
                "aspect_ratio": normalized_ratio,
                "negative_prompt": "blur, distort, and low quality",
                "cfg_scale": 0.5,
            }
        elif normalized_model in {
            FAL_KLING_V3_STANDARD_IMAGE_TO_VIDEO_MODEL_ID,
            FAL_KLING_V3_PRO_IMAGE_TO_VIDEO_MODEL_ID,
        }:
            if not source_image_url:
                raise ValueError("fal Kling V3 图生视频需要至少 1 张首帧图片")
            arguments = {
                "prompt": prompt,
                "start_image_url": source_image_url,
                "duration": normalized_duration,
                "generate_audio": normalized_generate_audio,
                "shot_type": "customize",
                "aspect_ratio": normalized_ratio,
                "negative_prompt": "blur, distort, and low quality",
                "cfg_scale": 0.5,
            }
            end_image_url = str(last_frame_url or "").strip()
            if end_image_url:
                arguments["end_image_url"] = end_image_url
        elif is_fal_kling_motion_control_model(normalized_model):
            if not source_image_url:
                raise ValueError("fal Kling V3 运动控制需要提供参考图片")
            if not reference_video_url:
                raise ValueError("fal Kling V3 运动控制需要提供参考视频")
            arguments = {
                "prompt": prompt,
                "image_url": source_image_url,
                "video_url": reference_video_url,
                "keep_original_sound": True,
                "character_orientation": "video",
            }
        else:
            source_image_url = str(first_frame_url or image_url or "").strip()
            if not source_image_url:
                raise ValueError("fal Stable Video 需要至少 1 张首帧图片")
            arguments = {"image_url": source_image_url}

        result, request_id = await run_fal_job(
            model_id=normalized_model or FAL_STABLE_VIDEO_MODEL_ID,
            arguments=arguments,
            api_key=api_key,
        )
        payload = extract_fal_video_payload(result)
        if not payload.get("url"):
            raise ValueError(f"{model} 未返回可用视频数据")
        return self._build_video_generation_result(
            url=payload.get("url", ""),
            thumbnail_url=payload.get("thumbnail_url", ""),
            duration=duration,
            task_id=request_id,
            sources=[payload, result],
        )


video_gen_service = VideoGenService()
