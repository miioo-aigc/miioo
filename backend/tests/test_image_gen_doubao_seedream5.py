import httpx
import pytest
from fastapi import HTTPException
from types import SimpleNamespace

from app.routers.creation import CreationImageGenerateRequest, generate_creation_images_stream
from app.services.image_gen import ImageGenService


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeBinaryResponse:
    def __init__(self, content: bytes, content_type: str = "image/png"):
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        return None


class _FakeDoubaoClient:
    def __init__(self, payload):
        self.post_calls = []
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.post_calls.append({"url": url, "headers": headers or {}, "json": json or {}})
        return _FakeResponse(self._payload)


class _SequentialFakeDoubaoClient:
    def __init__(self, payloads):
        self.post_calls = []
        self._payloads = list(payloads)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.post_calls.append({"url": url, "headers": headers or {}, "json": json or {}})
        if not self._payloads:
            raise AssertionError("unexpected extra doubao post")
        return _FakeResponse(self._payloads.pop(0))


class _FakeMultipartClient:
    def __init__(self, payload):
        self.post_calls = []
        self.get_calls = []
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None, data=None, files=None):
        self.post_calls.append(
            {
                "url": url,
                "headers": headers or {},
                "json": json,
                "data": data or {},
                "files": files or [],
            }
        )
        return _FakeResponse(self._payload)

    async def get(self, url):
        self.get_calls.append(url)
        return _FakeBinaryResponse(
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01"
            b"\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )


class _TimeoutThenSuccessMultipartClient(_FakeMultipartClient):
    def __init__(self, payload):
        super().__init__(payload)
        self._attempt = 0

    async def post(self, url, headers=None, json=None, data=None, files=None):
        self.post_calls.append(
            {
                "url": url,
                "headers": headers or {},
                "json": json,
                "data": data or {},
                "files": files or [],
            }
        )
        self._attempt += 1
        if self._attempt == 1:
            raise httpx.ReadTimeout("timeout awaiting response headers")
        return _FakeResponse(self._payload)


def _patch_client(monkeypatch, client):
    def _fake_upstream_async_client(*args, **kwargs):
        return client

    monkeypatch.setattr("app.services.image_gen.upstream_async_client", _fake_upstream_async_client)


@pytest.mark.anyio
async def test_doubao_passes_new_optional_params(monkeypatch):
    client = _FakeDoubaoClient({"data": [{"url": "https://cdn.example.com/a.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    images = await service.generate(
        prompt="时尚编辑肖像",
        api_key="k",
        base_url="https://ark.example.com",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=8,
        watermark=False,
        output_format="jpeg",
        response_format="b64_json",
        web_search=True,
        optimize_prompt_mode="standard",
    )

    assert images == ["https://cdn.example.com/a.png"]
    body = client.post_calls[0]["json"]
    assert client.post_calls[0]["url"].endswith("/volc/api/v3/images/generations")
    assert body["output_format"] == "jpeg"
    assert body["response_format"] == "b64_json"
    assert body["tools"] == [{"type": "web_search"}]
    assert body["optimize_prompt_options"] == {"mode": "standard"}
    assert body["n"] == 8
    assert body["sequential_image_generation"] == "auto"
    assert body["sequential_image_generation_options"] == {"max_images": 8}
    assert body["watermark"] is False


@pytest.mark.anyio
async def test_doubao_multi_image_with_references_passes_image_urls(monkeypatch):
    client = _FakeDoubaoClient({"data": [{"url": "https://cdn.example.com/a.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    await service.generate(
        prompt="参考图生成组三张",
        api_key="k",
        base_url="https://ark.example.com",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=3,
        reference_images=[
            "https://cdn.example.com/ref-1.png",
            "https://cdn.example.com/ref-2.png",
        ],
    )

    body = client.post_calls[0]["json"]
    assert body["n"] == 3
    assert body["image"] == [
        "https://cdn.example.com/ref-1.png",
        "https://cdn.example.com/ref-2.png",
    ]
    assert body["image_urls"] == [
        "https://cdn.example.com/ref-1.png",
        "https://cdn.example.com/ref-2.png",
    ]
    assert body["sequential_image_generation"] == "auto"
    assert body["sequential_image_generation_options"] == {"max_images": 3}


@pytest.mark.anyio
async def test_onelink_doubao_reference_multi_request_splits_into_single_calls(monkeypatch):
    client = _SequentialFakeDoubaoClient(
        [
            {"data": [{"url": "https://cdn.example.com/1.png"}]},
            {"data": [{"url": "https://cdn.example.com/2.png"}]},
            {"data": [{"url": "https://cdn.example.com/3.png"}]},
        ]
    )
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    images = await service.generate(
        prompt="参考图组三张",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=3,
        reference_images=["https://cdn.example.com/ref-1.png"],
    )

    assert images == [
        "https://cdn.example.com/1.png",
        "https://cdn.example.com/2.png",
        "https://cdn.example.com/3.png",
    ]
    assert len(client.post_calls) == 3
    for call in client.post_calls:
        body = call["json"]
        assert body["n"] == 1
        assert body["sequential_image_generation"] == "disabled"
        assert "sequential_image_generation_options" not in body
        assert body["image"] == "https://cdn.example.com/ref-1.png"


@pytest.mark.anyio
async def test_onelink_doubao_text_to_image_multi_request_also_splits_into_single_calls(monkeypatch):
    client = _SequentialFakeDoubaoClient(
        [
            {"data": [{"url": "https://cdn.example.com/1.png"}]},
            {"data": [{"url": "https://cdn.example.com/2.png"}]},
            {"data": [{"url": "https://cdn.example.com/3.png"}]},
        ]
    )
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    images = await service.generate(
        prompt="生成猫咪在书桌上写字的图片",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=3,
        reference_images=[],
    )

    assert images == [
        "https://cdn.example.com/1.png",
        "https://cdn.example.com/2.png",
        "https://cdn.example.com/3.png",
    ]
    assert len(client.post_calls) == 3
    for call in client.post_calls:
        body = call["json"]
        assert body["n"] == 1
        assert body["sequential_image_generation"] == "disabled"
        assert "sequential_image_generation_options" not in body
        assert "image" not in body
        assert "image_urls" not in body


def test_prepare_reference_image_url_prefers_public_upload_url(monkeypatch):
    monkeypatch.setattr(
        "app.services.image_gen.settings",
        SimpleNamespace(effective_public_base_url="https://media.example.com"),
    )

    service = ImageGenService()
    assert service._prepare_reference_image_url("/uploads/demo/ref.png") == (
        "https://media.example.com/uploads/demo/ref.png"
    )


@pytest.mark.anyio
async def test_doubao_non_lite_omits_lite_only_params(monkeypatch):
    client = _FakeDoubaoClient({"data": [{"url": "https://cdn.example.com/a.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    await service.generate(
        prompt="x",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-4.5",
        size="2K",
        n=1,
        output_format="jpeg",
        web_search=True,
    )

    body = client.post_calls[0]["json"]
    # output_format / tools 仅 5.0-lite 支持，非 lite 不应出现。
    assert "output_format" not in body
    assert "tools" not in body
    assert body["n"] == 1
    assert body["sequential_image_generation"] == "disabled"


@pytest.mark.anyio
async def test_doubao_defaults_keep_png_url_when_unset(monkeypatch):
    client = _FakeDoubaoClient({"data": [{"url": "https://cdn.example.com/a.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    await service.generate(
        prompt="x",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=1,
    )

    body = client.post_calls[0]["json"]
    assert body["output_format"] == "png"
    assert body["response_format"] == "url"
    assert body["n"] == 1
    assert "tools" not in body
    assert "optimize_prompt_options" not in body


@pytest.mark.anyio
async def test_gpt_image_with_reference_uses_edits_endpoint(monkeypatch):
    client = _FakeMultipartClient({"data": [{"url": "https://cdn.example.com/edited.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    images = await service.generate(
        prompt="帮我去掉眼罩",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="gpt-image-2",
        size="2K",
        aspect_ratio="16:9",
        resolution="2K",
        reference_images=["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAA"],
    )

    assert images == ["https://cdn.example.com/edited.png"]
    assert len(client.post_calls) == 1
    call = client.post_calls[0]
    assert call["url"].endswith("/v1/images/edits")
    assert call["json"] is None
    assert call["data"]["model"] == "gpt-image-2"
    assert call["data"]["prompt"] == "帮我去掉眼罩"
    assert call["data"]["size"] == "1792x1024"
    assert call["data"]["response_format"] == "b64_json"
    assert len(call["files"]) == 1
    assert call["files"][0][0] == "image"


@pytest.mark.anyio
async def test_gpt_image_with_reference_retries_once_after_timeout(monkeypatch):
    client = _TimeoutThenSuccessMultipartClient({"data": [{"url": "https://cdn.example.com/edited.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    images = await service.generate(
        prompt="帮我去掉眼罩",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="sp-gpt-image-2",
        size="1K",
        aspect_ratio="1:1",
        resolution="1K",
        reference_images=["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAA"],
    )

    assert images == ["https://cdn.example.com/edited.png"]
    assert len(client.post_calls) == 2
    assert client.post_calls[0]["url"].endswith("/v1/images/edits")
    assert client.post_calls[1]["url"].endswith("/v1/images/edits")


class _FakeStreamResponse:
    def __init__(self, lines):
        self._lines = lines

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for line in self._lines:
            yield line

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeStreamClient:
    def __init__(self, lines):
        self.stream_calls = []
        self._lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def stream(self, method, url, headers=None, json=None):
        self.stream_calls.append({"method": method, "url": url, "json": json or {}})
        return _FakeStreamResponse(self._lines)


class _FailingStreamResponse:
    def __init__(self, status_code=400, text="stream unsupported"):
        self._status_code = status_code
        self._text = text

    def raise_for_status(self):
        request = httpx.Request("POST", "https://api.onelinkai.cloud/volc/api/v3/images/generations")
        response = httpx.Response(self._status_code, request=request, text=self._text)
        raise httpx.HTTPStatusError("stream failed", request=request, response=response)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FallbackDoubaoClient:
    def __init__(self, payload):
        self.stream_calls = []
        self.post_calls = []
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def stream(self, method, url, headers=None, json=None):
        self.stream_calls.append({"method": method, "url": url, "json": json or {}})
        return _FailingStreamResponse()

    async def post(self, url, headers=None, json=None):
        self.post_calls.append({"url": url, "headers": headers or {}, "json": json or {}})
        return _FakeResponse(self._payload)


@pytest.mark.anyio
async def test_doubao_generate_stream_yields_images_and_completed(monkeypatch):
    lines = [
        'data: {"type": "image_generation.partial_succeeded", "image_index": 0, "url": "https://cdn.example.com/1.png", "size": "2496x1664"}',
        "",
        'data: {"type": "image_generation.completed", "usage": {"generated_images": 1, "total_tokens": 100}}',
        "",
        "data: [DONE]",
    ]
    client = _FakeStreamClient(lines)
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    events = []
    async for event in service.generate_stream(
        prompt="参考图生成组图",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=1,
    ):
        events.append(event)

    assert client.stream_calls[0]["json"]["stream"] is True
    assert client.stream_calls[0]["url"].endswith("/volc/api/v3/images/generations")
    image_events = [e for e in events if e["type"] == "image"]
    assert [e["url"] for e in image_events] == ["https://cdn.example.com/1.png"]
    completed = [e for e in events if e["type"] == "completed"]
    assert len(completed) == 1
    assert completed[0]["usage"]["generated_images"] == 1


@pytest.mark.anyio
async def test_doubao_generate_stream_falls_back_to_non_stream_on_http_400(monkeypatch):
    client = _FallbackDoubaoClient({"data": [{"url": "https://cdn.example.com/fallback.png"}]})
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    events = []
    async for event in service.generate_stream(
        prompt="x",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=1,
    ):
        events.append(event)

    assert len(client.stream_calls) == 1
    assert len(client.post_calls) == 1
    assert events == [
        {
            "type": "image",
            "index": 0,
            "url": "https://cdn.example.com/fallback.png",
            "size": "2K",
        },
        {"type": "completed", "usage": None},
    ]


@pytest.mark.anyio
async def test_doubao_generate_stream_bypasses_upstream_stream_for_multi_image(monkeypatch):
    client = _SequentialFakeDoubaoClient(
        [
            {"data": [{"url": "https://cdn.example.com/1.png"}]},
            {"data": [{"url": "https://cdn.example.com/2.png"}]},
            {"data": [{"url": "https://cdn.example.com/3.png"}]},
        ]
    )
    _patch_client(monkeypatch, client)

    service = ImageGenService()
    events = []
    async for event in service.generate_stream(
        prompt="x",
        api_key="k",
        base_url="https://api.onelinkai.cloud",
        model="doubao-seedream-5.0-lite",
        size="2K",
        n=3,
    ):
        events.append(event)

    assert len(client.post_calls) == 3
    assert [event["url"] for event in events if event["type"] == "image"] == [
        "https://cdn.example.com/1.png",
        "https://cdn.example.com/2.png",
        "https://cdn.example.com/3.png",
    ]
    assert events[-1] == {"type": "completed", "usage": None}


@pytest.mark.anyio
async def test_supports_stream_only_for_doubao():
    service = ImageGenService()
    assert service.supports_stream("doubao-seedream-5.0-lite") is True
    assert service.supports_stream("gpt-image-2") is False
    assert service.supports_stream("sp-gpt-image-2") is False


@pytest.mark.anyio
async def test_creation_stream_route_rejects_onelink_doubao_before_task_creation(monkeypatch):
    async def fake_resolve_scope(**_kwargs):
        return None, None, None

    async def fake_resolve_user_model(**_kwargs):
        return "doubao-seedream-5.0-lite"

    async def fake_get_provider_runtime(*_args, **_kwargs):
        return (
            "k",
            "https://api.onelinkai.cloud",
            "onelink",
            "doubao-seedream-5.0-lite",
            False,
            False,
        )

    create_task_called = False

    async def fake_resolve_and_create_image_task(**_kwargs):
        nonlocal create_task_called
        create_task_called = True
        raise AssertionError("should not create stream task for onelink doubao")

    monkeypatch.setattr("app.routers.creation._resolve_creation_scope", fake_resolve_scope)
    monkeypatch.setattr("app.routers.creation.resolve_user_model", fake_resolve_user_model)
    monkeypatch.setattr(
        "app.routers.creation.get_user_model_provider_runtime",
        fake_get_provider_runtime,
    )
    monkeypatch.setattr(
        "app.routers.creation._resolve_and_create_image_task",
        fake_resolve_and_create_image_task,
    )

    req = CreationImageGenerateRequest(
        prompt="测试非流式",
        model="doubao-seedream-5.0-lite",
        session_id=None,
        shot_id=None,
        project_id=None,
    )
    user = SimpleNamespace(id="user-1")
    db = object()

    with pytest.raises(HTTPException) as exc_info:
        await generate_creation_images_stream(req, user=user, db=db)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "OneLinkAI 当前不支持该接口的流式响应，请按非流式方式调用。"
    assert create_task_called is False
