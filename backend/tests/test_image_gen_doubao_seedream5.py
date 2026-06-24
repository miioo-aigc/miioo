import httpx
import pytest

from app.services.image_gen import ImageGenService


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


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
        base_url="https://api.onelinkai.cloud",
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
    assert body["sequential_image_generation"] == "auto"
    assert body["sequential_image_generation_options"] == {"max_images": 8}
    assert body["watermark"] is False


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
    assert "tools" not in body
    assert "optimize_prompt_options" not in body


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
    client = _FallbackDoubaoClient(
        {
            "data": [
                {"url": "https://cdn.example.com/1.png"},
                {"url": "https://cdn.example.com/2.png"},
                {"url": "https://cdn.example.com/3.png"},
            ]
        }
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

    assert len(client.stream_calls) == 0
    assert len(client.post_calls) == 1
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
