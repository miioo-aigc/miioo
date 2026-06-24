import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from app.models.gen_task import GenTask
from app.routers.storyboards import (
    GenerateImageRequest,
    GenerateVideoRequest,
    generate_storyboard_image,
    generate_storyboard_video,
)


class _FakeExecuteResult:
    def __init__(self, payload):
        self._payload = payload

    def scalar_one_or_none(self):
        return self._payload


class _FakeAsyncSession:
    def __init__(self, storyboard):
        self.storyboard = storyboard
        self.task = None

    def add(self, obj):
        if isinstance(obj, GenTask):
            self.task = obj

    async def commit(self):
        return None

    async def refresh(self, obj):
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = datetime.now(timezone.utc)
        return None

    async def execute(self, _query):
        return _FakeExecuteResult(self.storyboard)


def test_generate_storyboard_image_defaults_to_project_aspect_ratio(monkeypatch):
    project_id = uuid.uuid4()
    storyboard = SimpleNamespace(
        id=uuid.uuid4(),
        project_id=project_id,
        episode_id=None,
        reference_image_urls=[],
    )
    project = SimpleNamespace(
        id=project_id,
        aspect_ratio="9:16",
        visual_style="电影感",
    )
    user = SimpleNamespace(id=uuid.uuid4())
    db = _FakeAsyncSession(storyboard)
    captured = {}

    async def fake_get_project(project_id_arg, user_arg, db_arg):
        assert project_id_arg == str(project_id)
        assert user_arg is user
        assert db_arg is db
        return project

    async def fake_append_visual_styles(prompt, styles, user_id, db_arg):
        assert styles == [project.visual_style]
        assert user_id == user.id
        assert db_arg is db
        return prompt

    async def fake_resolve_user_model(**_kwargs):
        return "image-model"

    async def fake_get_user_model_provider_runtime(*_args, **_kwargs):
        return ("api-key", "https://example.com", None, "image-model", None, None)

    def fake_validate_image_request(*, model, size, aspect_ratio, resolution, count, reference_images):
        captured["aspect_ratio"] = aspect_ratio
        return {
            "size": size,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "count": count,
            "reference_images": reference_images,
        }

    async def fake_dispatch_background_job(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.routers.storyboards._get_project", fake_get_project)
    monkeypatch.setattr("app.routers.storyboards._resolve_storyboard_generation_prompt", lambda _sb, prompt: prompt)
    monkeypatch.setattr("app.routers.storyboards.append_visual_styles", fake_append_visual_styles)
    monkeypatch.setattr("app.routers.storyboards.resolve_user_model", fake_resolve_user_model)
    monkeypatch.setattr(
        "app.routers.storyboards.get_user_model_provider_runtime",
        fake_get_user_model_provider_runtime,
    )
    monkeypatch.setattr("app.routers.storyboards.validate_image_request", fake_validate_image_request)
    monkeypatch.setattr("app.routers.storyboards.dispatch_background_job", fake_dispatch_background_job)

    response = asyncio.run(
        generate_storyboard_image(
            str(project_id),
            str(storyboard.id),
            GenerateImageRequest(prompt="测试分镜图"),
            user=user,
            db=db,
        )
    )

    assert captured["aspect_ratio"] == "9:16"
    assert response.params["aspect_ratio"] == "9:16"


def test_generate_storyboard_video_defaults_to_project_aspect_ratio(monkeypatch):
    project_id = uuid.uuid4()
    storyboard = SimpleNamespace(
        id=uuid.uuid4(),
        project_id=project_id,
        episode_id=None,
        gen_params={},
        reference_image_urls=[],
        image_url=None,
    )
    project = SimpleNamespace(
        id=project_id,
        aspect_ratio="9:16",
    )
    user = SimpleNamespace(id=uuid.uuid4())
    db = _FakeAsyncSession(storyboard)
    captured = {}

    async def fake_get_project(project_id_arg, user_arg, db_arg):
        assert project_id_arg == str(project_id)
        assert user_arg is user
        assert db_arg is db
        return project

    async def fake_resolve_user_model(**_kwargs):
        return "video-model"

    async def fake_get_default_video_model(user_id_arg, db_arg):
        assert user_id_arg == user.id
        assert db_arg is db
        return "video-model"

    async def fake_get_user_model_provider_runtime(*_args, **_kwargs):
        return ("api-key", "https://example.com", None, "video-model", None, False)

    def fake_resolve_video_resolution(*, model, requested_resolution, stored_gen_params):
        assert model == "video-model"
        assert stored_gen_params == {}
        return requested_resolution or "720P"

    def fake_resolve_optional_model_toggle(**kwargs):
        return kwargs.get("requested_value")

    def fake_validate_video_request(*, model, prompt, ratio, resolution, duration, **_kwargs):
        captured["ratio"] = ratio
        return {
            "ratio": ratio,
            "resolution": resolution,
            "reference_mode": "text",
            "audio_setting": None,
        }

    async def fake_dispatch_background_job(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.routers.storyboards._get_project", fake_get_project)
    monkeypatch.setattr("app.routers.storyboards._resolve_storyboard_generation_prompt", lambda _sb, prompt: prompt)
    monkeypatch.setattr("app.routers.storyboards._get_default_video_model", fake_get_default_video_model)
    monkeypatch.setattr("app.routers.storyboards.resolve_user_model", fake_resolve_user_model)
    monkeypatch.setattr(
        "app.routers.storyboards.get_user_model_provider_runtime",
        fake_get_user_model_provider_runtime,
    )
    monkeypatch.setattr(
        "app.routers.storyboards._resolve_storyboard_video_resolution",
        fake_resolve_video_resolution,
    )
    monkeypatch.setattr("app.routers.storyboards.resolve_optional_model_toggle", fake_resolve_optional_model_toggle)
    monkeypatch.setattr("app.routers.storyboards.infer_video_reference_mode", lambda *_args, **_kwargs: "text")
    monkeypatch.setattr("app.routers.storyboards.validate_video_request", fake_validate_video_request)
    monkeypatch.setattr("app.routers.storyboards.dispatch_background_job", fake_dispatch_background_job)

    request = GenerateVideoRequest(prompt="测试分镜视频")
    object.__setattr__(request, "referenceImages", None)

    response = asyncio.run(
        generate_storyboard_video(
            str(project_id),
            str(storyboard.id),
            request,
            user=user,
            db=db,
        )
    )

    assert captured["ratio"] == "9:16"
    assert response.params["ratio"] == "9:16"
