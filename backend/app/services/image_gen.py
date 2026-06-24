import asyncio
import base64
import binascii
import json
import logging
import mimetypes
import time
from collections.abc import AsyncIterator
from pathlib import Path
from urllib.parse import urlsplit
from urllib.parse import unquote_to_bytes

import httpx

from app.services.fal_runtime import (
    extract_fal_image_urls,
    is_fal_image_model,
    resolve_flux_image_size,
    run_fal_job,
)
from app.services.http_client import upstream_async_client
from app.utils.onelink_base_url import get_onelink_openai_compat_base_url
from app.services.media_storage import resolve_upload_path


logger = logging.getLogger("app.services.image_gen")


class ImageGenService:
    def __init__(self):
        pass

    def _normalize_model(self, model: str) -> str:
        normalized_model = (model or "").strip().lower()
        if normalized_model in {"image-kling-v3", "image-kling-v3-omni"}:
            return normalized_model
        if normalized_model in {"kling-v2-1", "kling-v2", "kling-v3-image"}:
            return "image-kling-v3"
        if normalized_model in {"kling-image-o1", "kling-v3-omni-image"}:
            return "image-kling-v3-omni"
        if normalized_model == "image-vidu-q2":
            return normalized_model
        if normalized_model == "vidu-q2-turbo":
            return "image-vidu-q2"
        if normalized_model.startswith("image-vidu") and normalized_model.endswith("q2"):
            return "image-vidu-q2"
        if normalized_model.startswith("vidu" "q2"):
            return "image-vidu-q2"
        return normalized_model

    def _doubao_generation_url(self, base_url: str) -> str:
        return f"{base_url.rstrip('/')}/volc/api/v3/images/generations"

    def _build_doubao_payload(
        self,
        *,
        resolved_model: str,
        prompt: str,
        size: str,
        request_count: int,
        normalized_reference_images: list[str],
        watermark: bool | None,
        output_format: str | None,
        response_format: str | None,
        web_search: bool,
        optimize_prompt_mode: str | None,
        sequential_image_generation: str | None,
        stream: bool = False,
    ) -> dict:
        """构造 Seedream（doubao）官方 /images/generations 请求体，供流式与非流式共用。

        参数取值依据 doubao 官方图片生成文档；新参数仅在 doubao-seedream-5.0-lite 上透传。
        """
        is_lite = resolved_model == "doubao-seedream-5.0-lite"
        # sequential_image_generation：显式入参优先，否则按「请求数量 > 1 则 auto」推断。
        if sequential_image_generation in ("auto", "disabled"):
            sequential_mode = sequential_image_generation
        else:
            sequential_mode = "auto" if request_count > 1 else "disabled"

        payload: dict = {
            "model": resolved_model,
            "prompt": prompt,
            "response_format": (response_format or "url"),
            "size": self._normalize_doubao_size(size),
            "sequential_image_generation": sequential_mode,
        }
        if normalized_reference_images:
            payload["image"] = (
                normalized_reference_images[0]
                if len(normalized_reference_images) == 1
                else normalized_reference_images
            )
        if sequential_mode == "auto":
            # 仅在开启组图时透传 max_images；取用户请求数量（已由 validate_image_request 限制 <= 15）。
            payload["sequential_image_generation_options"] = {
                "max_images": max(1, request_count),
            }
        if watermark is not None:
            payload["watermark"] = watermark
        # output_format 仅 doubao-seedream-5.0-lite 支持；默认沿用产品现状 png。
        if is_lite:
            payload["output_format"] = (output_format or "png")
        # 联网搜索 tools / 提示词优化 optimize_prompt_options 仅 5.0-lite 支持。
        if is_lite and web_search:
            payload["tools"] = [{"type": "web_search"}]
        if optimize_prompt_mode:
            payload["optimize_prompt_options"] = {"mode": optimize_prompt_mode}
        if stream:
            payload["stream"] = True
        return payload

    def _gemini_generation_url(self, base_url: str, model: str) -> str:
        return f"{base_url.rstrip('/')}/v1beta/models/{model}:generateContent"

    def _vidu_generation_url(self, base_url: str) -> str:
        prefix = "" if self._is_official_vidu_base_url(base_url) else "/vidu"
        return f"{base_url.rstrip('/')}{prefix}/ent/v2/reference2image"

    def _is_doubao_image_model(self, model: str) -> bool:
        return self._normalize_model(model).startswith("doubao-")

    def _is_gemini_image_model(self, model: str) -> bool:
        normalized_model = self._normalize_model(model)
        if normalized_model.startswith("gemini-") and "image" in normalized_model:
            return True
        return normalized_model.startswith("nano-banana-")

    def _is_gpt_image_2_model(self, model: str) -> bool:
        return self._normalize_model(model) == "gpt-image-2"

    def _is_vidu_image_model(self, model: str) -> bool:
        normalized_model = self._normalize_model(model)
        return (
            normalized_model == "image-vidu-q2"
            or (
                normalized_model.startswith("vidu")
                and not normalized_model.startswith("video-")
            )
        )

    def _is_fal_image_model(self, model: str) -> bool:
        return is_fal_image_model(self._normalize_model(model))

    def _get_kling_image_route_config(
        self,
        model: str,
        *,
        reference_image_count: int = 0,
    ) -> dict[str, str] | None:
        normalized_model = self._normalize_model(model)
        if normalized_model == "image-kling-v3-omni":
            return {
                "route": "omni-image",
                "model_name": "image-kling-v3-omni",
                "submit_path": "/kling/v1/images/omni-image",
                "query_path": "/kling/v1/images/omni-image/{task_id}",
                "task_label": "Kling omni-image",
            }
        if normalized_model == "image-kling-v3":
            if reference_image_count == 1:
                raise ValueError("image-kling-v3 仅支持 0 或 2-4 张参考图；单图参考请改用 image-kling-v3-omni")
            if reference_image_count >= 2:
                return {
                    "route": "multi-image2image",
                    "model_name": "image-kling-v3",
                    "submit_path": "/kling/v1/images/multi-image2image",
                    "query_path": "/kling/v1/images/multi-image2image/{task_id}",
                    "task_label": "Kling multi-image2image",
                }
            return {
                "route": "generations",
                "model_name": "image-kling-v3",
                "submit_path": "/kling/v1/images/generations",
                "query_path": "/kling/v1/images/generations/{task_id}",
                "task_label": "Kling image generations",
            }
        return None

    def _is_kling_image_model(self, model: str) -> bool:
        return self._get_kling_image_route_config(model) is not None

    def _normalize_doubao_size(self, size: str) -> str:
        size_map = {
            "1024x1024": "1K",
            "1792x1024": "2K",
            "1024x1792": "2K",
            "2k": "2K",
            "4k": "4K",
        }
        return size_map.get(size.lower(), size)

    def _normalize_gemini_image_size(
        self,
        resolution: str | None,
        size: str | None,
    ) -> str | None:
        resolution_map = {
            "1k": "1K",
            "2k": "2K",
            "4k": "4K",
        }
        size_map = {
            "1024x1024": "1K",
            "1536x1024": "2K",
            "1024x1536": "2K",
            "1792x1024": "2K",
            "1024x1792": "2K",
            "1k": "1K",
            "2k": "2K",
            "4k": "4K",
        }
        normalized_resolution = (resolution or "").strip().lower()
        if normalized_resolution:
            return resolution_map.get(normalized_resolution, normalized_resolution.upper())

        normalized_size = (size or "").strip().lower()
        if not normalized_size:
            return None
        return size_map.get(normalized_size)

    def _normalize_gpt_image_2_resolution(
        self,
        resolution: str | None,
        size: str | None,
    ) -> str | None:
        resolution_map = {
            "1k": "1K",
            "2k": "2K",
            "4k": "4K",
        }
        normalized_resolution = (resolution or "").strip().lower()
        if normalized_resolution:
            return resolution_map.get(normalized_resolution, normalized_resolution.upper())

        normalized_size = (size or "").strip().lower()
        if normalized_size in resolution_map:
            return resolution_map[normalized_size]
        return None

    def _normalize_gpt_image_2_size(
        self,
        aspect_ratio: str | None,
        resolution: str | None,
        size: str | None,
    ) -> str | None:
        normalized_size = (size or "").strip().lower()
        if "x" in normalized_size:
            return normalized_size

        normalized_ratio = (aspect_ratio or "").strip().replace(" ", "")
        normalized_resolution = self._normalize_gpt_image_2_resolution(resolution, size)
        if not normalized_ratio or not normalized_resolution:
            return None

        size_map = {
            ("1:1", "1K"): "1024x1024",
            ("1:1", "2K"): "1024x1024",
            ("2:3", "2K"): "1024x1536",
            ("3:2", "2K"): "1536x1024",
            ("9:16", "2K"): "1024x1792",
            ("16:9", "2K"): "1792x1024",
        }
        return size_map.get((normalized_ratio, normalized_resolution))

    def _normalize_vidu_aspect_ratio(
        self,
        aspect_ratio: str | None,
        size: str | None,
        *,
        has_reference_images: bool,
    ) -> str:
        supported_ratios = {"16:9", "9:16", "1:1", "3:4", "4:3", "21:9", "2:3", "3:2", "auto"}
        normalized_ratio = (aspect_ratio or "").strip().replace(" ", "")
        if normalized_ratio in supported_ratios:
            return normalized_ratio

        size_ratio_map = {
            "1024x1024": "1:1",
            "1792x1024": "16:9",
            "1024x1792": "9:16",
            "1536x1024": "3:2",
            "1024x1536": "2:3",
            "1k": "1:1",
            "2k": "16:9",
            "4k": "16:9",
            "1080p": "16:9",
        }
        normalized_size = (size or "").strip().lower()
        inferred_ratio = size_ratio_map.get(normalized_size)
        if inferred_ratio:
            return inferred_ratio

        return "auto" if has_reference_images else "16:9"

    def _normalize_vidu_resolution(
        self,
        resolution: str | None,
        size: str | None,
    ) -> str:
        resolution_map = {
            "1080p": "1080p",
            "1k": "1080p",
            "2k": "2K",
            "4k": "4K",
        }
        normalized_resolution = (resolution or "").strip().lower()
        if normalized_resolution in resolution_map:
            return resolution_map[normalized_resolution]

        size_map = {
            "1024x1024": "1080p",
            "1792x1024": "2K",
            "1024x1792": "2K",
            "1536x1024": "2K",
            "1024x1536": "2K",
            "1080p": "1080p",
            "1k": "1080p",
            "2k": "2K",
            "4k": "4K",
        }
        normalized_size = (size or "").strip().lower()
        return size_map.get(normalized_size, "1080p")

    def _headers(self, api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
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

    def _client_timeout(self, model: str) -> httpx.Timeout:
        normalized_model = self._normalize_model(model)
        if normalized_model == "gpt-image-2":
            # GPT-Image 2 在 OneLinkAI 网关上响应明显更慢，默认 120s 会频繁超时。
            return httpx.Timeout(connect=30.0, read=600.0, write=120.0, pool=120.0)
        return httpx.Timeout(120.0)

    def _describe_http_error(self, exc: httpx.HTTPStatusError) -> str:
        response = exc.response
        body = ""
        try:
            body = response.text.strip()
        except Exception:  # pragma: no cover - defensive fallback
            body = ""
        if body:
            return f"HTTP request failed with status {response.status_code}: {body}"
        return f"HTTP request failed with status {response.status_code}"

    def _should_fallback_stream_to_generate(self, exc: httpx.HTTPStatusError) -> bool:
        return exc.response.status_code in {400, 404, 405}

    def _resolve_primary_reference_image(self, reference_images: list[str]) -> str | None:
        if not reference_images:
            return None
        primary = reference_images[0].strip()
        return primary or None

    def _build_data_uri(self, data: bytes, content_type: str) -> str:
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    def _normalize_base64_payload(self, encoded: str) -> str:
        cleaned = (encoded or "").strip()
        if not cleaned:
            raise ValueError("图片 base64 数据为空")

        if cleaned.startswith("data:") and "," in cleaned:
            _, cleaned = cleaned.split(",", 1)

        normalized = "".join(cleaned.split()).replace("-", "+").replace("_", "/")
        if not normalized:
            raise ValueError("图片 base64 数据为空")

        # 部分网关会返回缺失 padding 或 URL-safe 变体的 base64，这里统一修正。
        remainder = len(normalized) % 4
        if remainder:
            normalized += "=" * (4 - remainder)
        return normalized

    def _decode_base64_payload(self, encoded: str) -> bytes:
        normalized = self._normalize_base64_payload(encoded)
        try:
            return base64.b64decode(normalized)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("图片 base64 数据解码失败") from exc

    def _guess_binary_image_content_type(self, data: bytes) -> str:
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if data.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if data.startswith((b"GIF87a", b"GIF89a")):
            return "image/gif"
        if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            return "image/webp"
        return "image/png"

    def _build_image_data_uri_from_base64(self, encoded: str) -> str:
        image_data = self._decode_base64_payload(encoded)
        content_type = self._guess_binary_image_content_type(image_data)
        return self._build_data_uri(image_data, content_type)

    def _build_image_data_uri(self, encoded: str, content_type: str | None) -> str:
        normalized_content_type = (content_type or "").strip() or "image/png"
        return self._build_data_uri(self._decode_base64_payload(encoded), normalized_content_type)

    def _extract_image_urls_from_any(self, payload: object) -> list[str]:
        images: list[str] = []
        seen: set[str] = set()

        def _push(value: object) -> None:
            normalized = str(value or "").strip()
            if (
                not normalized
                or normalized in seen
                or normalized.startswith("data:video/")
                or normalized.startswith("data:audio/")
            ):
                return
            if not (
                normalized.startswith("http://")
                or normalized.startswith("https://")
                or normalized.startswith("data:image/")
                or normalized.startswith("/uploads/")
            ):
                return
            seen.add(normalized)
            images.append(normalized)

        def _push_base64(value: object, content_type: object | None = None) -> None:
            if not isinstance(value, str) or not value.strip():
                return
            try:
                if content_type:
                    _push(self._build_image_data_uri(value, str(content_type)))
                else:
                    _push(self._build_image_data_uri_from_base64(value))
            except ValueError:
                return

        def _walk(node: object) -> None:
            if isinstance(node, dict):
                inline_data = node.get("inlineData") or node.get("inline_data")
                if isinstance(inline_data, dict):
                    _push_base64(
                        inline_data.get("data"),
                        inline_data.get("mimeType") or inline_data.get("mime_type"),
                    )

                b64_value = (
                    node.get("b64_json")
                    or node.get("base64")
                    or node.get("image_base64")
                    or node.get("image")
                )
                if isinstance(b64_value, str) and not b64_value.startswith(("http://", "https://", "data:")):
                    _push_base64(b64_value, node.get("mime_type") or node.get("mimeType"))

                for key in (
                    "url",
                    "image",
                    "image_url",
                    "imageUrl",
                    "file_url",
                    "fileUrl",
                    "output_url",
                    "outputUrl",
                    "cover_url",
                    "thumbnail_url",
                ):
                    _push(node.get(key))

                for key in (
                    "data",
                    "images",
                    "image_urls",
                    "urls",
                    "items",
                    "results",
                    "result",
                    "output",
                    "outputs",
                    "artifacts",
                    "creations",
                    "task_result",
                    "taskResult",
                ):
                    if key in node:
                        _walk(node.get(key))
                return

            if isinstance(node, list):
                for item in node:
                    _walk(item)

        _walk(payload)
        return images

    def _extract_generated_images(self, data: dict) -> list[str]:
        generic_images = self._extract_image_urls_from_any(data)
        if generic_images:
            return generic_images

        images: list[str] = []
        raw_items = data.get("data", [])
        if isinstance(raw_items, dict):
            raw_items = [raw_items]
        if not isinstance(raw_items, list):
            raw_items = []

        for item in raw_items:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            if url:
                images.append(url)
                continue
            b64_json = item.get("b64_json") or item.get("base64") or item.get("image_base64")
            if isinstance(b64_json, str) and b64_json.strip():
                images.append(self._build_image_data_uri_from_base64(b64_json))

        if images:
            return images

        top_level_b64 = data.get("b64_json") or data.get("base64") or data.get("image_base64")
        if isinstance(top_level_b64, str) and top_level_b64.strip():
            images.append(self._build_image_data_uri_from_base64(top_level_b64))
        return images

    def _extract_kling_image_urls(self, payload: object) -> list[str]:
        return self._extract_image_urls_from_any(payload)

    def _extract_kling_task_id(self, data: dict) -> str:
        candidates = [
            data.get("task_id"),
            data.get("id"),
            data.get("data", {}).get("task_id") if isinstance(data.get("data"), dict) else None,
        ]
        for candidate in candidates:
            normalized = str(candidate or "").strip()
            if normalized:
                return normalized
        return ""

    def _extract_kling_task_status(self, data: dict) -> str:
        if isinstance(data.get("data"), dict):
            payload = data["data"]
            for key in ("task_status", "status", "state"):
                normalized = str(payload.get(key) or "").strip().lower()
                if normalized:
                    return normalized
        for key in ("task_status", "status", "state"):
            normalized = str(data.get(key) or "").strip().lower()
            if normalized:
                return normalized
        return ""

    def _extract_kling_error(self, data: dict) -> str:
        candidates = [
            data.get("message"),
            data.get("detail"),
            data.get("error"),
            data.get("data", {}).get("task_status_msg") if isinstance(data.get("data"), dict) else None,
        ]
        for candidate in candidates:
            normalized = str(candidate or "").strip()
            if normalized:
                return normalized
        return ""

    def _extract_gemini_generated_images(self, data: dict) -> list[str]:
        generic_images = self._extract_image_urls_from_any(data)
        if generic_images:
            return generic_images

        images: list[str] = []
        for candidate in data.get("candidates", []):
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content")
            if not isinstance(content, dict):
                continue
            for part in content.get("parts", []):
                if not isinstance(part, dict):
                    continue
                inline_data = part.get("inlineData") or part.get("inline_data")
                if not isinstance(inline_data, dict):
                    continue
                encoded = str(inline_data.get("data") or "").strip()
                if not encoded:
                    continue
                mime_type = inline_data.get("mimeType") or inline_data.get("mime_type")
                images.append(self._build_image_data_uri(encoded, mime_type))
        return images

    def _extract_vidu_generated_images(self, data: dict) -> list[str]:
        images: list[str] = []
        creations = data.get("creations") or data.get("data") or []
        if isinstance(creations, dict):
            creations = [creations]
        if not isinstance(creations, list):
            creations = []

        generic_images = self._extract_image_urls_from_any(creations)
        if generic_images:
            return generic_images

        for item in creations:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            if url:
                images.append(url)
                continue
            cover_url = str(item.get("cover_url") or item.get("thumbnail_url") or "").strip()
            if cover_url:
                images.append(cover_url)

        return images

    def _resolve_local_upload_path(self, url: str) -> Path:
        return resolve_upload_path(url)

    def _guess_image_content_type(self, path_or_url: str) -> str:
        guessed_type, _ = mimetypes.guess_type(path_or_url)
        return guessed_type or "image/jpeg"

    def _prepare_reference_image_url(self, url: str) -> str:
        cleaned = (url or "").strip()
        if not cleaned:
            return ""
        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            return cleaned
        if cleaned.startswith("/uploads/"):
            file_path = self._resolve_local_upload_path(cleaned)
            if not file_path.exists() or not file_path.is_file():
                raise ValueError(f"reference_images 本地文件不存在: {cleaned}")
            image_data = file_path.read_bytes()
            content_type = self._guess_image_content_type(str(file_path))
            return self._build_data_uri(image_data, content_type)
        return cleaned

    def _parse_data_uri(self, value: str) -> tuple[str, str] | None:
        cleaned = (value or "").strip()
        if not cleaned.startswith("data:") or "," not in cleaned:
            return None

        header, encoded = cleaned.split(",", 1)
        if ";base64" not in header:
            return None

        mime_type = header[5:].split(";", 1)[0].strip() or "image/png"
        return mime_type, encoded.strip()

    async def _build_gemini_reference_part(
        self,
        client: httpx.AsyncClient,
        image: str,
    ) -> dict[str, dict[str, str]]:
        cleaned = (image or "").strip()
        data_uri = self._parse_data_uri(cleaned)
        if data_uri:
            mime_type, encoded = data_uri
            return {"inlineData": {"mimeType": mime_type, "data": encoded}}

        if cleaned.startswith("http://") or cleaned.startswith("https://"):
            response = await client.get(cleaned)
            response.raise_for_status()
            mime_type = (
                response.headers.get("content-type", "").split(";", 1)[0].strip()
                or self._guess_binary_image_content_type(response.content)
            )
            encoded = base64.b64encode(response.content).decode("ascii")
            return {"inlineData": {"mimeType": mime_type, "data": encoded}}

        try:
            decoded_bytes = unquote_to_bytes(cleaned)
            encoded = base64.b64encode(decoded_bytes).decode("ascii")
            mime_type = self._guess_binary_image_content_type(decoded_bytes)
            return {"inlineData": {"mimeType": mime_type, "data": encoded}}
        except Exception as exc:  # pragma: no cover - defensive fallback
            raise ValueError("Gemini 参考图仅支持 data URI、本地上传或可访问的图片 URL") from exc

    async def _poll_vidu_image_task(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        api_key: str,
        base_url: str,
        max_wait: int = 300,
        poll_interval: int = 5,
    ) -> list[str]:
        start_time = time.time()
        while time.time() - start_time < max_wait:
            resp = await client.get(
                self._vidu_generation_url(base_url).replace("/reference2image", f"/tasks/{task_id}/creations"),
                headers=self._vidu_headers(api_key, base_url),
            )
            resp.raise_for_status()
            data = resp.json()

            state = str(data.get("state") or data.get("status") or "").strip().lower()
            if state in {"success", "succeeded", "completed"}:
                images = self._extract_vidu_generated_images(data)
                if images:
                    return images
                raise ValueError("Vidu 图片任务已完成，但未返回可用图片链接")

            if state in {"failed", "error"}:
                error = (
                    data.get("err_msg")
                    or data.get("err_code")
                    or data.get("error")
                    or "Vidu 图片生成失败"
                )
                raise ValueError(str(error))

            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"Vidu 图片任务超时（>{max_wait}s）")

    async def _poll_kling_image_task(
        self,
        client: httpx.AsyncClient,
        *,
        task_id: str,
        api_key: str,
        base_url: str,
        query_path: str,
        task_label: str,
        max_wait: int = 300,
        poll_interval: int = 5,
    ) -> list[str]:
        start_time = time.time()
        while time.time() - start_time < max_wait:
            resp = await client.get(
                f"{base_url.rstrip('/')}{query_path.format(task_id=task_id)}",
                headers=self._headers(api_key),
            )
            resp.raise_for_status()
            data = resp.json()
            status = self._extract_kling_task_status(data)
            images = self._extract_kling_image_urls(data)
            if status in {"succeed", "succeeded", "success", "completed", "finished"}:
                if images:
                    return images
                raise ValueError(f"{task_label} 已完成，但未返回可用图片结果")
            if images and not status:
                return images
            if status in {"failed", "error", "cancelled", "canceled"}:
                error_message = self._extract_kling_error(data) or f"{task_label} 失败"
                raise ValueError(error_message)
            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"{task_label} 超时（>{max_wait}s）")

    async def generate(
        self,
        prompt: str,
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        model: str = "dall-e-3",
        size: str = "1024x1024",
        aspect_ratio: str | None = None,
        resolution: str | None = None,
        reference_images: list[str] | None = None,
        n: int = 1,
        watermark: bool | None = None,
        output_format: str | None = None,
        response_format: str | None = None,
        web_search: bool = False,
        optimize_prompt_mode: str | None = None,
        sequential_image_generation: str | None = None,
    ) -> list[str]:
        resolved_model = self._normalize_model(model)
        request_count = max(1, int(n or 1))
        normalized_reference_images = [
            self._prepare_reference_image_url(str(item))
            for item in (reference_images or [])
            if str(item).strip()
        ]
        primary_reference_image = self._resolve_primary_reference_image(normalized_reference_images)
        try:
            if self._is_fal_image_model(resolved_model):
                arguments = {
                    "prompt": prompt,
                    "image_size": resolve_flux_image_size(
                        aspect_ratio=aspect_ratio,
                        size=size,
                    ),
                    "num_images": request_count,
                    "output_format": "jpeg",
                }
                result, _ = await run_fal_job(
                    model_id=resolved_model,
                    arguments=arguments,
                    api_key=api_key,
                )
                images = extract_fal_image_urls(result)
                if not images:
                    raise ValueError(f"{resolved_model} 未返回可用图片数据")
                return images[:request_count]

            async with upstream_async_client(
                profile="model",
                timeout=self._client_timeout(resolved_model),
            ) as client:
                if self._is_kling_image_model(resolved_model):
                    route_config = self._get_kling_image_route_config(
                        resolved_model,
                        reference_image_count=len(normalized_reference_images),
                    )
                    if not route_config:
                        raise ValueError(f"未识别的 Kling 图像模型: {model}")

                    route = route_config["route"]
                    payload = {
                        "model_name": route_config["model_name"],
                        "prompt": prompt,
                        "callback_url": "",
                        "external_task_id": "",
                    }

                    if route == "generations":
                        payload["negative_prompt"] = ""
                        payload["n"] = request_count
                        if aspect_ratio:
                            payload["aspect_ratio"] = aspect_ratio
                    elif route == "omni-image":
                        if not primary_reference_image:
                            raise ValueError("Kling 图像 Omni 需要至少 1 张参考图")
                        payload["image"] = primary_reference_image
                        payload["n"] = 1
                        if aspect_ratio:
                            payload["aspect_ratio"] = aspect_ratio
                    elif route == "multi-image2image":
                        if len(normalized_reference_images) < 2:
                            raise ValueError("Kling 多图参考生图至少需要 2 张参考图")
                        payload["scene_image"] = normalized_reference_images[0]
                        payload["subject_image_list"] = [
                            {"subject_image": image}
                            for image in normalized_reference_images[1:5]
                        ]
                        payload["n"] = request_count
                        if aspect_ratio:
                            payload["aspect_ratio"] = aspect_ratio
                    else:
                        raise ValueError(f"未支持的 Kling 图像路由类型: {route}")

                    resp = await client.post(
                        f"{base_url.rstrip('/')}{route_config['submit_path']}",
                        headers=self._headers(api_key),
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    images = self._extract_kling_image_urls(data)
                    if images:
                        return images[:request_count]

                    task_id = self._extract_kling_task_id(data)
                    if not task_id:
                        raise ValueError(f"{route_config['task_label']} 未返回 task_id 或图片结果")

                    images = await self._poll_kling_image_task(
                        client,
                        task_id=task_id,
                        api_key=api_key,
                        base_url=base_url,
                        query_path=route_config["query_path"],
                        task_label=route_config["task_label"],
                    )
                    return images[:request_count]

                if self._is_vidu_image_model(resolved_model):
                    images: list[str] = []

                    for _ in range(request_count):
                        payload = {
                            "model": resolved_model,
                            "prompt": prompt,
                            "aspect_ratio": self._normalize_vidu_aspect_ratio(
                                aspect_ratio,
                                size,
                                has_reference_images=bool(normalized_reference_images),
                            ),
                            "resolution": self._normalize_vidu_resolution(resolution, size),
                        }
                        if normalized_reference_images:
                            payload["images"] = normalized_reference_images

                        resp = await client.post(
                            self._vidu_generation_url(base_url),
                            headers=self._vidu_headers(api_key, base_url),
                            json=payload,
                        )
                        resp.raise_for_status()
                        data = resp.json()

                        direct_images = self._extract_vidu_generated_images(data)
                        if direct_images:
                            images.extend(direct_images)
                            continue

                        task_id = str(data.get("task_id") or data.get("id") or "").strip()
                        if not task_id:
                            raise ValueError(f"{model} 未返回 task_id 或图片结果")

                        images.extend(
                            await self._poll_vidu_image_task(
                                client,
                                task_id,
                                api_key,
                                base_url,
                            )
                        )
                        if len(images) >= request_count:
                            break

                    return images[:request_count]
                if self._is_gemini_image_model(resolved_model):
                    aspect_ratio_value = (aspect_ratio or "").strip() or "1:1"
                    image_size_value = self._normalize_gemini_image_size(resolution, size)
                    images: list[str] = []

                    for _ in range(request_count):
                        parts: list[dict] = [{"text": prompt}]
                        for image in normalized_reference_images:
                            parts.append(await self._build_gemini_reference_part(client, image))

                        image_config: dict[str, str] = {"aspectRatio": aspect_ratio_value}
                        if image_size_value:
                            image_config["imageSize"] = image_size_value

                        payload = {
                            "contents": [{"parts": parts}],
                            "generationConfig": {
                                "responseModalities": ["TEXT", "IMAGE"],
                                "imageConfig": image_config,
                            },
                        }
                        resp = await client.post(
                            self._gemini_generation_url(base_url, resolved_model),
                            headers=self._headers(api_key),
                            json=payload,
                        )
                        resp.raise_for_status()
                        images.extend(self._extract_gemini_generated_images(resp.json()))
                        if len(images) >= request_count:
                            break

                    return images[:request_count]
                if self._is_doubao_image_model(resolved_model):
                    payload = self._build_doubao_payload(
                        resolved_model=resolved_model,
                        prompt=prompt,
                        size=size,
                        request_count=request_count,
                        normalized_reference_images=normalized_reference_images,
                        watermark=watermark,
                        output_format=output_format,
                        response_format=response_format,
                        web_search=web_search,
                        optimize_prompt_mode=optimize_prompt_mode,
                        sequential_image_generation=sequential_image_generation,
                    )
                    resp = await client.post(
                        self._doubao_generation_url(base_url),
                        headers=self._headers(api_key),
                        json=payload,
                    )
                else:
                    payload = {
                        "model": resolved_model,
                        "prompt": prompt,
                        "n": request_count,
                    }
                    if self._is_gpt_image_2_model(resolved_model):
                        normalized_gpt_size = self._normalize_gpt_image_2_size(
                            aspect_ratio,
                            resolution,
                            size,
                        )
                        normalized_gpt_resolution = self._normalize_gpt_image_2_resolution(
                            resolution,
                            size,
                        )
                        payload["response_format"] = "b64_json"
                        if normalized_gpt_size:
                            payload["size"] = normalized_gpt_size
                        elif size and "x" in size.lower():
                            payload["size"] = size
                        if normalized_gpt_resolution:
                            payload["resolution"] = normalized_gpt_resolution
                        if normalized_reference_images:
                            payload["image_urls"] = normalized_reference_images
                    else:
                        payload["size"] = size
                        if normalized_reference_images:
                            payload["reference_images"] = normalized_reference_images
                    if aspect_ratio:
                        payload["aspect_ratio"] = aspect_ratio
                    if resolution and "resolution" not in payload:
                        payload["resolution"] = resolution
                    request_base_url = get_onelink_openai_compat_base_url(base_url)
                    resp = await client.post(
                        f"{request_base_url.rstrip('/')}/v1/images/generations",
                        headers=self._headers(api_key),
                        json=payload,
                    )
                resp.raise_for_status()
                data = resp.json()
                images = self._extract_generated_images(data)
                if not images:
                    raise ValueError(f"{resolved_model} 未返回可用图片数据")
                return images
        except httpx.TimeoutException as exc:
            raise ValueError(f"{resolved_model} 响应超时，请稍后重试") from exc
        except httpx.HTTPStatusError as exc:
            raise ValueError(self._describe_http_error(exc)) from exc

    def supports_stream(self, model: str) -> bool:
        """是否支持流式输出。当前仅 doubao seedream 系列透传 stream=true。"""
        return self._is_doubao_image_model(self._normalize_model(model))

    async def generate_stream(
        self,
        prompt: str,
        api_key: str,
        base_url: str = "https://api.onelinkai.cloud",
        model: str = "doubao-seedream-5.0-lite",
        size: str = "2K",
        aspect_ratio: str | None = None,
        resolution: str | None = None,
        reference_images: list[str] | None = None,
        n: int = 1,
        watermark: bool | None = None,
        output_format: str | None = None,
        response_format: str | None = None,
        web_search: bool = False,
        optimize_prompt_mode: str | None = None,
        sequential_image_generation: str | None = None,
    ) -> AsyncIterator[dict]:
        """流式生成（仅 doubao seedream）。逐张 yield 事件 dict：

        - {"type": "image", "index": int, "url": str, "size": str | None}
        - {"type": "completed", "usage": dict | None}

        解析官方 SSE 事件（image_generation.partial_succeeded /
        image_generation.completed / data:[DONE]），仿 llm.stream_chat_completion。
        """
        resolved_model = self._normalize_model(model)
        if not self._is_doubao_image_model(resolved_model):
            raise ValueError(f"{resolved_model} 不支持流式图片生成")

        request_count = max(1, int(n or 1))
        normalized_reference_images = [
            self._prepare_reference_image_url(str(item))
            for item in (reference_images or [])
            if str(item).strip()
        ]
        if request_count > 1:
            logger.info(
                "doubao image stream bypassed for multi-image request model=%s base_url=%s size=%s n=%s refs=%s",
                resolved_model,
                base_url,
                size,
                request_count,
                len(normalized_reference_images),
            )
            images = await self.generate(
                prompt=prompt,
                api_key=api_key,
                base_url=base_url,
                model=resolved_model,
                size=size,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                reference_images=normalized_reference_images,
                n=request_count,
                watermark=watermark,
                output_format=output_format,
                response_format=response_format,
                web_search=web_search,
                optimize_prompt_mode=optimize_prompt_mode,
                sequential_image_generation=sequential_image_generation,
            )
            for index, url in enumerate(images):
                yield {
                    "type": "image",
                    "index": index,
                    "url": url,
                    "size": size,
                }
            yield {"type": "completed", "usage": None}
            return
        payload = self._build_doubao_payload(
            resolved_model=resolved_model,
            prompt=prompt,
            size=size,
            request_count=request_count,
            normalized_reference_images=normalized_reference_images,
            watermark=watermark,
            output_format=output_format,
            response_format=response_format,
            web_search=web_search,
            optimize_prompt_mode=optimize_prompt_mode,
            sequential_image_generation=sequential_image_generation,
            stream=True,
        )

        try:
            async with upstream_async_client(
                profile="model",
                timeout=self._client_timeout(resolved_model),
            ) as client:
                async with client.stream(
                    "POST",
                    self._doubao_generation_url(base_url),
                    headers=self._headers(api_key),
                    json=payload,
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[len("data:"):].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            event = json.loads(data_str)
                        except (ValueError, TypeError):
                            continue
                        if not isinstance(event, dict):
                            continue
                        event_type = event.get("type") or ""
                        if event_type == "image_generation.partial_succeeded":
                            url = str(event.get("url") or "").strip()
                            if url:
                                yield {
                                    "type": "image",
                                    "index": event.get("image_index"),
                                    "url": url,
                                    "size": event.get("size"),
                                }
                        elif event_type == "image_generation.completed":
                            yield {"type": "completed", "usage": event.get("usage")}
                        elif event_type in ("image_generation.partial_failed", "error") or event.get("error"):
                            err = event.get("error") or event
                            message = ""
                            if isinstance(err, dict):
                                message = str(err.get("message") or err.get("code") or "").strip()
                            yield {"type": "error", "index": event.get("image_index"), "error": message or "图片生成失败"}
        except httpx.TimeoutException as exc:
            raise ValueError(f"{resolved_model} 响应超时，请稍后重试") from exc
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "doubao image stream request failed, fallback candidate=%s model=%s base_url=%s size=%s n=%s refs=%s status=%s detail=%s",
                self._should_fallback_stream_to_generate(exc),
                resolved_model,
                base_url,
                size,
                request_count,
                len(normalized_reference_images),
                exc.response.status_code,
                self._describe_http_error(exc),
            )
            if self._should_fallback_stream_to_generate(exc):
                images = await self.generate(
                    prompt=prompt,
                    api_key=api_key,
                    base_url=base_url,
                    model=resolved_model,
                    size=size,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    reference_images=reference_images,
                    n=n,
                    watermark=watermark,
                    output_format=output_format,
                    response_format=response_format,
                    web_search=web_search,
                    optimize_prompt_mode=optimize_prompt_mode,
                    sequential_image_generation=sequential_image_generation,
                )
                for index, url in enumerate(images):
                    yield {
                        "type": "image",
                        "index": index,
                        "url": url,
                        "size": size,
                    }
                yield {"type": "completed", "usage": None}
                return
            raise ValueError(self._describe_http_error(exc)) from exc


image_gen_service = ImageGenService()
