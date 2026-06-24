import base64
import binascii
import re
import uuid

from app.services.http_client import upstream_async_client
from app.services.minimax_voice_runtime import extract_minimax_tts_result
from app.services.volcengine_voice_runtime import (
    VOLCENGINE_VOICE_DEFAULT_ENCODING,
    build_volcengine_voice_headers,
    build_volcengine_voice_payload,
    parse_volcengine_voice_runtime,
    resolve_volcengine_voice_request_url,
    validate_volcengine_voice_credentials,
)
from app.utils.onelink_base_url import get_onelink_openai_compat_base_url


class TTSService:
    def __init__(self):
        pass

    def _normalize_provider_type(self, provider_type: str | None) -> str:
        return (provider_type or "onelink").strip().lower()

    def _headers(self, api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _resolve_aiping_request_url(self, base_url: str | None) -> str:
        cleaned = (base_url or "").strip() or "https://aiping.cn/api"
        trimmed = cleaned.rstrip("/")
        if trimmed.endswith("/api/v1") or trimmed.endswith("/v1"):
            return f"{trimmed}/audio/speech"
        if trimmed.endswith("/api"):
            return f"{trimmed}/v1/audio/speech"
        return f"{trimmed}/api/v1/audio/speech"

    def _aiping_audio_content_type(self, audio_format: str | None) -> str:
        normalized_format = (audio_format or "mp3").strip().lower()
        return {
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "ogg": "audio/ogg",
            "opus": "audio/ogg",
            "flac": "audio/flac",
            "pcm": "audio/L16",
            "pcmu_raw": "audio/basic",
            "pcmu_wav": "audio/wav",
        }.get(normalized_format, "audio/mpeg")

    def _standard_audio_content_type(self, audio_format: str | None) -> str:
        normalized_format = (audio_format or VOLCENGINE_VOICE_DEFAULT_ENCODING).strip().lower()
        return {
            "mp3": "audio/mpeg",
            "mpeg": "audio/mpeg",
            "wav": "audio/wav",
            "pcm": "audio/L16",
            "ogg": "audio/ogg",
            "ogg_opus": "audio/ogg",
            "opus": "audio/ogg",
            "flac": "audio/flac",
        }.get(normalized_format, "audio/mpeg")

    def _build_aiping_audio_data_uri(self, encoded_audio: str, audio_format: str | None) -> str:
        normalized_audio = (encoded_audio or "").strip()
        if not normalized_audio:
            raise ValueError("AI Ping 配音接口未返回音频数据")
        if normalized_audio.startswith(("data:", "http://", "https://", "/uploads/")):
            return normalized_audio

        content_type = self._aiping_audio_content_type(audio_format)
        compact_audio = re.sub(r"\s+", "", normalized_audio)

        if len(compact_audio) % 2 == 0:
            try:
                audio_bytes = bytes.fromhex(compact_audio)
                if audio_bytes:
                    return (
                        f"data:{content_type};base64,"
                        f"{base64.b64encode(audio_bytes).decode('ascii')}"
                    )
            except ValueError:
                pass

        try:
            base64.b64decode(compact_audio, validate=True)
        except binascii.Error as exc:
            raise ValueError("AI Ping 配音接口返回的音频既不是合法 hex，也不是合法 base64") from exc
        return f"data:{content_type};base64,{compact_audio}"

    def _build_standard_audio_data_uri(self, encoded_audio: str, audio_format: str | None) -> str:
        normalized_audio = (encoded_audio or "").strip()
        if not normalized_audio:
            raise ValueError("语音接口未返回音频数据")
        if normalized_audio.startswith(("data:", "http://", "https://", "/uploads/")):
            return normalized_audio

        compact_audio = re.sub(r"\s+", "", normalized_audio)
        try:
            base64.b64decode(compact_audio, validate=True)
        except binascii.Error as exc:
            raise ValueError("语音接口返回的音频不是合法 base64") from exc
        content_type = self._standard_audio_content_type(audio_format)
        return f"data:{content_type};base64,{compact_audio}"

    def _parse_aiping_response(self, data: dict, text: str) -> dict:
        base_resp = data.get("base_resp") or {}
        status_code = base_resp.get("status_code", 0)
        if status_code not in (0, "0", None):
            raise ValueError(base_resp.get("status_msg") or "AI Ping 配音接口返回失败")

        payload = data.get("data") or {}
        audio_base64 = payload.get("audio") or ""
        if not str(audio_base64).strip():
            raise ValueError("AI Ping 配音接口未返回音频数据")

        extra_info = data.get("extra_info") or {}
        audio_length = extra_info.get("audio_length")
        duration = len(text) * 0.3
        if isinstance(audio_length, (int, float)) and audio_length > 0:
            duration = float(audio_length) / 1000.0

        return {
            "url": self._build_aiping_audio_data_uri(audio_base64, extra_info.get("audio_format")),
            "duration": duration,
            "metadata": {
                "subtitle_file": payload.get("subtitle_file"),
                "trace_id": data.get("trace_id"),
                "status": payload.get("status"),
                "base_resp": base_resp,
                "extra_info": extra_info,
                "provider": data.get("provider"),
                "model": data.get("model"),
            },
        }

    def _parse_volcengine_response(self, data: dict, text: str, encoding: str) -> dict:
        code = data.get("code")
        if code not in (0, "0", 3000, "3000", None):
            raise ValueError(data.get("message") or data.get("msg") or "Volcengine 配音接口返回失败")

        audio_base64 = data.get("data") or ""
        if not str(audio_base64).strip():
            raise ValueError("Volcengine 配音接口未返回音频数据")

        addition = data.get("addition") or {}
        duration_ms = (
            addition.get("duration")
            or addition.get("audio_length")
            or addition.get("duration_ms")
        )
        duration = len(text) * 0.3
        if isinstance(duration_ms, (int, float)) and duration_ms > 0:
            duration = float(duration_ms) / 1000.0

        return {
            "url": self._build_standard_audio_data_uri(audio_base64, encoding),
            "duration": duration,
            "metadata": {
                "request_id": addition.get("reqid") or data.get("request_id"),
                "trace_id": data.get("trace_id"),
                "code": code,
                "message": data.get("message") or data.get("msg"),
                "addition": addition,
            },
        }

    def _parse_minimax_response(self, data: dict, text: str) -> dict:
        normalized = extract_minimax_tts_result(data, text)
        return {
            "url": normalized["url"],
            "duration": normalized["duration"],
            "metadata": normalized.get("metadata"),
        }

    async def generate(
        self,
        text: str,
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        voice: str = "zh-CN-XiaoxiaoNeural",
        speed: float = 1.0,
        model: str | None = None,
        provider_type: str = "onelink",
        provider_options: dict | None = None,
    ) -> dict:
        normalized_provider_type = self._normalize_provider_type(provider_type)
        normalized_options = provider_options or {}
        request_url = f"{get_onelink_openai_compat_base_url(base_url).rstrip('/')}/v1/audio/speech"
        payload = {
            "model": model or "",
            "input": text,
            "voice": voice,
            "speed": speed,
        }
        if normalized_provider_type == "aiping":
            if normalized_options.get("stream") is True:
                raise ValueError("当前中转同步配音接口暂不支持 AI Ping 流式输出")

            request_url = self._resolve_aiping_request_url(base_url)
            voice_setting = dict(normalized_options.get("voice_setting") or {})
            audio_setting = normalized_options.get("audio_setting") or None
            pronunciation_dict = normalized_options.get("pronunciation_dict") or None
            timbre_weights = normalized_options.get("timbre_weights") or None
            language_boost = normalized_options.get("language_boost")
            voice_modify = normalized_options.get("voice_modify") or None
            subtitle_enable = normalized_options.get("subtitle_enable")
            subtitle_type = normalized_options.get("subtitle_type")
            output_format = normalized_options.get("output_format")
            aigc_watermark = normalized_options.get("aigc_watermark")

            if not voice_setting.get("voice_id"):
                voice_setting["voice_id"] = voice
            if voice_setting.get("speed") is None:
                voice_setting["speed"] = speed

            payload = {
                "model": model or "",
                "text": text,
                "stream": False,
                "voice_setting": {
                    "vol": 1,
                    "pitch": 0,
                    **voice_setting,
                },
            }
            if audio_setting:
                payload["audio_setting"] = audio_setting
            if pronunciation_dict:
                payload["pronunciation_dict"] = pronunciation_dict
            if timbre_weights:
                payload["timbre_weights"] = timbre_weights
            if language_boost:
                payload["language_boost"] = language_boost
            if voice_modify:
                payload["voice_modify"] = voice_modify
            if subtitle_enable is not None:
                payload["subtitle_enable"] = subtitle_enable
            if subtitle_type:
                payload["subtitle_type"] = subtitle_type
            if output_format:
                payload["output_format"] = output_format
            if aigc_watermark is not None:
                payload["aigc_watermark"] = aigc_watermark
        elif normalized_provider_type == "minimax":
            if normalized_options.get("stream") is True:
                raise ValueError("当前同步配音接口暂不支持 MiniMax 流式输出")

            request_url = f"{base_url.rstrip('/')}/v1/t2a_v2"
            voice_setting = dict(normalized_options.get("voice_setting") or {})
            audio_setting = normalized_options.get("audio_setting") or None
            pronunciation_dict = normalized_options.get("pronunciation_dict") or None
            timbre_weights = normalized_options.get("timbre_weights") or None
            language_boost = normalized_options.get("language_boost")
            voice_modify = normalized_options.get("voice_modify") or None
            subtitle_enable = normalized_options.get("subtitle_enable")
            subtitle_type = normalized_options.get("subtitle_type")
            output_format = normalized_options.get("output_format")
            aigc_watermark = normalized_options.get("aigc_watermark")

            if not voice_setting.get("voice_id"):
                voice_setting["voice_id"] = voice
            if voice_setting.get("speed") is None:
                voice_setting["speed"] = speed

            payload = {
                "model": model or "",
                "text": text,
                "stream": False,
                "voice_setting": {
                    "vol": 1,
                    "pitch": 0,
                    **voice_setting,
                },
            }
            if audio_setting:
                payload["audio_setting"] = audio_setting
            if pronunciation_dict:
                payload["pronunciation_dict"] = pronunciation_dict
            if timbre_weights:
                payload["timbre_weights"] = timbre_weights
            if language_boost:
                payload["language_boost"] = language_boost
            if voice_modify:
                payload["voice_modify"] = voice_modify
            if subtitle_enable is not None:
                payload["subtitle_enable"] = subtitle_enable
            if subtitle_type:
                payload["subtitle_type"] = subtitle_type
            if output_format:
                payload["output_format"] = output_format
            if aigc_watermark is not None:
                payload["aigc_watermark"] = aigc_watermark
        elif normalized_provider_type == "volcengine":
            if normalized_options.get("stream") is True:
                raise ValueError("当前同步配音接口暂不支持 Volcengine 流式输出")

            credentials, sanitized_base_url = parse_volcengine_voice_runtime(
                api_key,
                base_url,
                default_voice_type=voice,
            )
            validate_volcengine_voice_credentials(credentials)

            voice_setting = dict(normalized_options.get("voice_setting") or {})
            audio_setting = normalized_options.get("audio_setting") or {}
            output_format = normalized_options.get("output_format") or audio_setting.get("format")
            encoding = str(output_format or VOLCENGINE_VOICE_DEFAULT_ENCODING).strip().lower()
            volume_ratio = float(voice_setting.get("vol") or 1.0)
            pitch_value = float(voice_setting.get("pitch") or 0)
            pitch_ratio = 1.0 + (pitch_value / 12.0)

            request_url = resolve_volcengine_voice_request_url(sanitized_base_url)
            payload = build_volcengine_voice_payload(
                text=text,
                appid=credentials.appid or "",
                token=credentials.token,
                cluster=credentials.cluster,
                voice_type=voice_setting.get("voice_id") or credentials.voice_type or voice,
                speed_ratio=float(voice_setting.get("speed") or speed or 1.0),
                volume_ratio=volume_ratio,
                pitch_ratio=pitch_ratio,
                encoding=encoding,
                uid=str(uuid.uuid4()),
                reqid=str(uuid.uuid4()),
            )

        async with upstream_async_client(profile="provider", timeout=60.0) as client:
            resp = await client.post(
                request_url,
                headers=(
                    build_volcengine_voice_headers(credentials)
                    if normalized_provider_type == "volcengine"
                    else self._headers(api_key)
                ),
                json=payload,
            )
            resp.raise_for_status()

            content_type = resp.headers.get("content-type", "")
            if "json" in content_type:
                data = resp.json()
                if normalized_provider_type == "aiping":
                    return self._parse_aiping_response(data, text)
                if normalized_provider_type == "minimax":
                    return self._parse_minimax_response(data, text)
                if normalized_provider_type == "volcengine":
                    return self._parse_volcengine_response(
                        data,
                        text,
                        encoding,
                    )
                return {
                    "url": data.get("url") or data.get("audio_url", ""),
                    "duration": data.get("duration", len(text) * 0.3),
                }
            else:
                return {
                    "url": f"{request_url}?text={text[:20]}",
                    "duration": len(text) * 0.3,
                }


tts_service = TTSService()
