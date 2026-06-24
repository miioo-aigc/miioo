import asyncio

import httpx
import pytest

from app.services.video_gen import VideoGenService


class _FakeAsyncClient:
    def __init__(self, *, head_status: int, get_status: int):
        self._head_status = head_status
        self._get_status = get_status

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def head(self, url: str):
        request = httpx.Request("HEAD", url)
        return httpx.Response(self._head_status, request=request)

    async def get(self, url: str, headers: dict[str, str] | None = None):
        request = httpx.Request("GET", url, headers=headers)
        return httpx.Response(self._get_status, request=request)


@pytest.fixture()
def video_gen_service() -> VideoGenService:
    return VideoGenService()


def test_seedance_upload_404_error_points_to_missing_upload_file(
    monkeypatch,
    video_gen_service: VideoGenService,
):
    monkeypatch.setattr(
        "app.services.video_gen.httpx.AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(head_status=404, get_status=404),
    )

    with pytest.raises(ValueError) as exc_info:
        asyncio.run(
            video_gen_service._assert_seedance_media_url_reachable(
                "https://www.miiooai.com/uploads/creation/sessions/demo/shots/demo/uploads/reference.mp4",
                "参考视频",
            )
        )

    message = str(exc_info.value)
    assert "HTTP 404" in message
    assert "该具体 `/uploads/...` 文件返回 404" in message
    assert "素材文件不存在" in message
    assert "PUBLIC_BASE_URL / 公共隧道" not in message


def test_seedance_non_404_error_keeps_generic_public_base_hint(
    monkeypatch,
    video_gen_service: VideoGenService,
):
    monkeypatch.setattr(
        "app.services.video_gen.httpx.AsyncClient",
        lambda *args, **kwargs: _FakeAsyncClient(head_status=502, get_status=502),
    )

    with pytest.raises(ValueError) as exc_info:
        asyncio.run(
            video_gen_service._assert_seedance_media_url_reachable(
                "https://www.miiooai.com/uploads/runtime/seedance-reference-video/demo.mp4",
                "参考视频",
            )
        )

    assert "PUBLIC_BASE_URL / 公共隧道" in str(exc_info.value)
