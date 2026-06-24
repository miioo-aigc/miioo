import asyncio
import io
import uuid
from types import SimpleNamespace

from fastapi import UploadFile

from app.models.asset import Asset
from app.models.storyboard import Storyboard
from app.routers.storyboards import _run_storyboard_video_generation_job, upload_storyboard_video


class _FakeExecuteResult:
    def __init__(self, payload):
        self._payload = payload

    def scalar_one_or_none(self):
        return self._payload


class _FakeAsyncSession:
    def __init__(self, storyboard):
        self.storyboard = storyboard
        self.added = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, _query):
        return _FakeExecuteResult(self.storyboard)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        for obj in self.added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()
        return None

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        return None


def test_run_storyboard_video_generation_job_succeeds_before_asset_created(monkeypatch):
    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()
    storyboard = Storyboard(
        id=storyboard_id,
        project_id=project_id,
        shot_number=3,
        image_url="/uploads/storyboards/source-image.png",
        video_url=None,
        gen_params={},
        reference_image_urls=[],
        sort_order=0,
    )
    fake_session = _FakeAsyncSession(storyboard)

    def fake_async_session():
        return fake_session

    async def fake_get_user_model_provider_runtime(*_args, **_kwargs):
        return ("api-key", "https://example.com", None, "video-model", None, False)

    async def fake_generate(**_kwargs):
        return {
            "url": "https://example.com/generated.mp4",
            "thumbnail_url": "https://example.com/generated.png",
            "duration": 4,
        }

    async def fake_persist_if_external(url, _subdir, **_kwargs):
        if url.endswith(".mp4"):
            return "/uploads/storyboards/demo/generated.mp4"
        if url.endswith(".png"):
            return "/uploads/storyboards/demo/generated.png"
        return url

    async def fake_build_video_poster_bundle(**_kwargs):
        return {
            "poster_url": "/uploads/storyboards/demo/generated-poster.png",
            "metadata_updates": {},
        }

    async def fake_persist_many_if_external(urls, _subdir, **_kwargs):
        return list(urls)

    async def fake_build_storyboard_asset_metadata(_db, sb):
        return {
            "storyboard_id": str(sb.id),
            "shot_number": sb.shot_number,
        }

    monkeypatch.setattr("app.routers.storyboards.async_session", fake_async_session)
    monkeypatch.setattr(
        "app.routers.storyboards.get_user_model_provider_runtime",
        fake_get_user_model_provider_runtime,
    )
    monkeypatch.setattr(
        "app.routers.storyboards.video_gen_service",
        SimpleNamespace(generate=fake_generate),
    )
    monkeypatch.setattr("app.routers.storyboards.persist_if_external", fake_persist_if_external)
    monkeypatch.setattr(
        "app.routers.storyboards.build_video_poster_bundle",
        fake_build_video_poster_bundle,
    )
    monkeypatch.setattr(
        "app.routers.storyboards.persist_many_if_external",
        fake_persist_many_if_external,
    )
    monkeypatch.setattr(
        "app.routers.storyboards._build_storyboard_asset_metadata",
        fake_build_storyboard_asset_metadata,
    )

    asset_id = asyncio.run(
        _run_storyboard_video_generation_job(
            user_id=user_id,
            project_id=project_id,
            storyboard_id=storyboard_id,
            prompt="测试分镜视频",
            model="doubao-seedance-2-0-fast",
            duration=4,
            reference_mode="text",
            effective_image_url=storyboard.image_url,
            effective_first_frame=None,
            effective_last_frame=None,
            resolution="480P",
            sound_effect=False,
            reference_video_url=None,
            reference_audio_url=None,
            ratio="16:9",
            generate_mode=None,
            generate_audio=False,
            audio_setting=None,
            watermark=False,
            mentions=[],
            attachments=[],
            first_frame_asset_id=None,
            last_frame_asset_id=None,
            reference_video_asset_id=None,
            reference_audio_asset_id=None,
            reference_image_asset_ids=[],
            request_reference_images=[],
            speech_text=None,
            seedance_voice_video_trace=None,
        )
    )

    assert asset_id
    assert storyboard.video_url == "/uploads/storyboards/demo/generated.mp4"
    assert storyboard.gen_params["preview_video_url"] == "/uploads/storyboards/demo/generated.mp4"
    assert fake_session.added
    added_asset = fake_session.added[0]
    assert isinstance(added_asset, Asset)
    assert added_asset.asset_type == "video"
    assert added_asset.metadata_json["preview_video_url"] == "/uploads/storyboards/demo/generated.mp4"


def test_upload_storyboard_video_succeeds_before_asset_created(monkeypatch):
    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    storyboard_id = uuid.uuid4()
    storyboard = Storyboard(
        id=storyboard_id,
        project_id=project_id,
        shot_number=5,
        image_url="/uploads/storyboards/source-image.png",
        video_url=None,
        gen_params={},
        reference_image_urls=[],
        sort_order=0,
    )
    fake_session = _FakeAsyncSession(storyboard)
    fake_user = SimpleNamespace(id=user_id)

    async def fake_get_project(*_args, **_kwargs):
        return SimpleNamespace(id=project_id)

    async def fake_persist_uploaded_file(_file, _subdir, **_kwargs):
        return "/uploads/storyboards/demo/uploaded.mp4"

    async def fake_build_video_poster_bundle(**_kwargs):
        return {
            "poster_url": "/uploads/storyboards/demo/uploaded-poster.png",
            "metadata_updates": {"poster_source": "derived"},
        }

    async def fake_build_storyboard_asset_metadata(_db, sb, extra=None):
        return {
            "storyboard_id": str(sb.id),
            **(extra or {}),
        }

    def fake_to_response(sb, *, video_asset=None, **_kwargs):
        return {
            "storyboard_id": str(sb.id),
            "video_asset_id": str(video_asset.id) if video_asset else None,
            "preview_video_url": sb.gen_params["preview_video_url"],
            "download_url": sb.gen_params["download_url"],
        }

    monkeypatch.setattr("app.routers.storyboards._get_project", fake_get_project)
    monkeypatch.setattr("app.routers.storyboards.persist_uploaded_file", fake_persist_uploaded_file)
    monkeypatch.setattr(
        "app.routers.storyboards.build_video_poster_bundle",
        fake_build_video_poster_bundle,
    )
    monkeypatch.setattr(
        "app.routers.storyboards._build_storyboard_asset_metadata",
        fake_build_storyboard_asset_metadata,
    )
    monkeypatch.setattr("app.routers.storyboards._to_response", fake_to_response)

    result = asyncio.run(
        upload_storyboard_video(
            project_id=str(project_id),
            storyboard_id=str(storyboard_id),
            file=UploadFile(filename="storyboard.mp4", file=io.BytesIO(b"fake-video")),
            user=fake_user,
            db=fake_session,
        )
    )

    assert result["video_asset_id"]
    assert result["preview_video_url"] == "/uploads/storyboards/demo/uploaded.mp4"
    assert result["download_url"] == "/uploads/storyboards/demo/uploaded.mp4"
    assert storyboard.video_url == "/uploads/storyboards/demo/uploaded.mp4"
    assert storyboard.gen_params["poster_url"] == "/uploads/storyboards/demo/uploaded-poster.png"
    assert fake_session.added
    added_asset = fake_session.added[0]
    assert isinstance(added_asset, Asset)
    assert added_asset.metadata_json["preview_video_url"] == "/uploads/storyboards/demo/uploaded.mp4"
