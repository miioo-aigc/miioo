import pytest

from app.services.image_gen import ImageGenService


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeKlingClient:
    def __init__(self):
        self.post_calls = []
        self.get_calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url, headers=None, json=None):
        self.post_calls.append(
            {
                "url": url,
                "headers": headers or {},
                "json": json or {},
            }
        )
        return _FakeResponse(
            {
                "data": {
                    "task_id": "kling-task-1",
                    "task_status": "submitted",
                }
            }
        )

    async def get(self, url, headers=None):
        self.get_calls.append(
            {
                "url": url,
                "headers": headers or {},
            }
        )
        return _FakeResponse(
            {
                "data": {
                    "task_status": "succeed",
                    "task_result": {
                        "images": [
                            {"url": "https://cdn.example.com/generated-1.png"},
                            {"url": "https://cdn.example.com/generated-2.png"},
                            {"url": "https://cdn.example.com/generated-3.png"},
                            {"url": "https://cdn.example.com/generated-4.png"},
                        ]
                    },
                }
            }
        )


@pytest.mark.anyio
async def test_kling_multi_image2image_forwards_requested_count(monkeypatch):
    client = _FakeKlingClient()

    def _fake_upstream_async_client(*args, **kwargs):
        return client

    async def _fake_sleep(*args, **kwargs):
        return None

    monkeypatch.setattr("app.services.image_gen.upstream_async_client", _fake_upstream_async_client)
    monkeypatch.setattr("app.services.image_gen.asyncio.sleep", _fake_sleep)

    service = ImageGenService()
    images = await service.generate(
        prompt="把角色和场景融合成四张不同构图的海报",
        api_key="test-key",
        base_url="https://api.onelinkai.cloud",
        model="image-kling-v3",
        aspect_ratio="16:9",
        reference_images=[
            "https://cdn.example.com/scene.png",
            "https://cdn.example.com/subject-a.png",
            "https://cdn.example.com/subject-b.png",
        ],
        n=4,
    )

    assert len(client.post_calls) == 1
    assert client.post_calls[0]["json"]["n"] == 4
    assert [item["subject_image"] for item in client.post_calls[0]["json"]["subject_image_list"]] == [
        "https://cdn.example.com/subject-a.png",
        "https://cdn.example.com/subject-b.png",
    ]
    assert images == [
        "https://cdn.example.com/generated-1.png",
        "https://cdn.example.com/generated-2.png",
        "https://cdn.example.com/generated-3.png",
        "https://cdn.example.com/generated-4.png",
    ]
