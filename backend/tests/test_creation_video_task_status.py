import asyncio
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.routers.creation import (
    CreationVideoTaskStatusResponse,
    _asset_to_video_card,
    _build_creation_video_task_result,
    _build_video_card_from_task_results,
    _task_to_response,
    _task_result_to_video_card,
    poll_creation_video_task,
)
from app.models.asset import Asset
from app.models.gen_task import GenTask


class _FakeExecuteResult:
    def __init__(self, task):
        self._task = task

    def scalar_one_or_none(self):
        return self._task


class _FakeAsyncSession:
    def __init__(self, task):
        self.task = task

    async def execute(self, _query):
        return _FakeExecuteResult(self.task)


class _NoDbCall:
    """资产绑定无 asset_id 时不会触发 db.execute；命中即视为测试假设被破坏。"""

    async def execute(self, *args, **kwargs):
        raise AssertionError("bindings without asset_id should not query the database")


def test_asset_to_video_card_exposes_both_snake_and_camel_case_fields():
    created_at = datetime(2026, 6, 15, 12, 0, 0)
    asset_id = uuid4()
    asset = Asset(
        id=asset_id,
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="创作视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/demo.mp4",
        thumbnail_url="/uploads/creation/global/video-thumbnails/demo.png",
        prompt="角色奔跑",
        model="doubao-seedance-2.0",
        size="720P",
        metadata_json={
            "duration": 5,
            "ratio": "16:9",
            "resolution": "720P",
            "generation_mode": "text_to_video",
            "reference_mode": "full",
            "first_frame_url": "/uploads/images/first.png",
            "last_frame_url": "/uploads/images/last.png",
            "prompt_raw": "角色奔跑",
            "prompt_resolved": "角色向前奔跑",
            "asset_bindings": [{"asset_type": "image", "url": "/uploads/images/ref.png"}],
        },
        is_starred=True,
        reference_image_urls=None,
        is_deleted=False,
    )
    asset.created_at = created_at

    card = asyncio.run(_asset_to_video_card(asset, _NoDbCall()))

    assert card.video_url == "/uploads/creation/global/videos/demo.mp4"
    assert card.videoUrl == "/uploads/creation/global/videos/demo.mp4"
    assert card.asset_id == str(asset_id)
    assert card.assetId == str(asset_id)
    assert card.thumbnail_url == "/uploads/creation/global/video-thumbnails/demo.png"
    assert card.thumbnailUrl == "/uploads/creation/global/video-thumbnails/demo.png"
    assert card.asset_bindings[0].url == "/uploads/images/ref.png"
    assert card.assetBindings[0].url == "/uploads/images/ref.png"
    assert card.is_liked is True
    assert card.isLiked is True


def test_task_result_to_video_card_falls_back_to_task_result_urls():
    task_id = uuid4()
    task = SimpleNamespace(
        id=task_id,
        user_id=uuid4(),
        model="doubao-seedance-2.0",
        updated_at=datetime(2026, 6, 15, 12, 30, 0),
        params={
            "prompt": "角色奔跑",
            "prompt_raw": "角色奔跑",
            "prompt_resolved": "角色向前奔跑",
            "duration": 5,
            "ratio": "16:9",
            "resolution": "720P",
            "generation_mode": "text_to_video",
            "reference_mode": "full",
            "first_frame_url": "/uploads/images/first.png",
            "last_frame_url": "/uploads/images/last.png",
            "attachments": [{"asset_type": "image", "url": "/uploads/images/ref.png"}],
        },
    )

    card = asyncio.run(
        _task_result_to_video_card(
            task,
            {
                "success": True,
                "asset_id": "asset-123",
                "video_url": "/uploads/creation/global/videos/fallback.mp4",
                "thumbnail_url": "/uploads/creation/global/video-thumbnails/fallback.png",
            },
            _NoDbCall(),
        )
    )

    assert card is not None
    assert card.video_url == "/uploads/creation/global/videos/fallback.mp4"
    assert card.videoUrl == "/uploads/creation/global/videos/fallback.mp4"
    assert card.asset_id == "asset-123"
    assert card.assetId == "asset-123"
    assert card.thumbnail_url == "/uploads/creation/global/video-thumbnails/fallback.png"
    assert card.first_frame_url == "/uploads/images/first.png"
    assert card.last_frame_url == "/uploads/images/last.png"
    assert card.asset_bindings[0].url == "/uploads/images/ref.png"


def test_video_task_status_response_exposes_camel_case_aliases():
    payload = CreationVideoTaskStatusResponse(
        task_id="task-123",
        taskId="task-123",
        status="partial",
        progress=100,
        current_stage="metadata_committing",
        currentStage="metadata_committing",
        partial_ready=True,
        partialReady=True,
        result=None,
        error_msg=None,
        errorMsg=None,
    ).model_dump()

    assert payload["taskId"] == "task-123"
    assert "errorMsg" in payload
    assert payload["currentStage"] == "metadata_committing"
    assert payload["partialReady"] is True


def test_build_creation_video_task_result_exposes_playable_url_before_asset_exists():
    result = _build_creation_video_task_result(
        video_url="/uploads/creation/global/videos/partial.mp4",
        duration=5,
        warning="封面稍后补齐",
    )

    assert result["success"] is True
    assert result["video_url"] == "/uploads/creation/global/videos/partial.mp4"
    assert result["videoUrl"] == "/uploads/creation/global/videos/partial.mp4"
    assert result["thumbnail_url"] is None
    assert result["thumbnailUrl"] is None
    assert result["duration"] == 5
    assert result["warning"] == "封面稍后补齐"


def test_build_creation_video_task_result_exposes_runtime_stage_fields():
    result = _build_creation_video_task_result(
        video_url="/uploads/creation/global/videos/partial.mp4",
        duration=5,
        metadata={
            "preview_video_url": "/uploads/creation/global/videos/preview.mp4",
            "video_pipeline_stage": "metadata_committing",
            "partial_ready": True,
        },
    )

    assert result["current_stage"] == "metadata_committing"
    assert result["currentStage"] == "metadata_committing"
    assert result["partial_ready"] is True
    assert result["partialReady"] is True


def test_task_to_response_lifts_runtime_stage_fields_from_params():
    task = GenTask(
        user_id=uuid4(),
        project_id=None,
        task_type="creation_video",
        status="partial",
        total_count=1,
        success_count=1,
        fail_count=0,
        model="doubao-seedance-2.0",
        size="720P",
        params={
            "session_id": str(uuid4()),
            "shot_id": str(uuid4()),
            "current_stage": "metadata_committing",
            "partial_ready": True,
        },
        results=[],
    )
    task.created_at = datetime(2026, 6, 19, 12, 0, 0)
    task.updated_at = datetime(2026, 6, 19, 12, 5, 0)

    response = _task_to_response(task)

    assert response.current_stage == "metadata_committing"
    assert response.currentStage == "metadata_committing"
    assert response.partial_ready is True
    assert response.partialReady is True
    assert response.session_id == task.params["session_id"]
    assert response.shot_id == task.params["shot_id"]


def test_poll_creation_video_task_exposes_runtime_stage_fields():
    task = GenTask(
        user_id=uuid4(),
        project_id=None,
        task_type="creation_video",
        status="partial",
        total_count=1,
        success_count=1,
        fail_count=0,
        model="doubao-seedance-2.0",
        size="720P",
        params={
            "prompt": "角色奔跑",
            "duration": 5,
            "ratio": "16:9",
            "resolution": "720P",
            "current_stage": "metadata_committing",
            "partial_ready": True,
        },
        results=[
            {
                "success": True,
                "video_url": "/uploads/creation/global/videos/partial.mp4",
                "preview_video_url": "/uploads/creation/global/videos/preview.mp4",
            }
        ],
    )
    task.id = uuid4()
    task.updated_at = datetime(2026, 6, 19, 12, 10, 0)
    db = _FakeAsyncSession(task)
    user = SimpleNamespace(id=task.user_id)

    response = asyncio.run(
        poll_creation_video_task(
            str(task.id),
            user=user,
            db=db,
        )
    )

    assert response.status == "partial"
    assert response.progress == 100
    assert response.current_stage == "metadata_committing"
    assert response.currentStage == "metadata_committing"
    assert response.partial_ready is True
    assert response.partialReady is True
    assert response.result is not None
    assert response.result.video_url == "/uploads/creation/global/videos/partial.mp4"


def test_build_video_card_from_task_results_falls_back_when_asset_lookup_is_unavailable():
    task_id = uuid4()
    task = SimpleNamespace(
        id=task_id,
        user_id=uuid4(),
        model="doubao-seedance-2.0",
        updated_at=datetime(2026, 6, 15, 12, 30, 0),
        results=[
            {"success": False, "error": "temporary failure"},
            {
                "success": True,
                "asset_id": "not-a-uuid",
                "video_url": "/uploads/creation/global/videos/partial.mp4",
                "thumbnail_url": "/uploads/creation/global/video-thumbnails/partial.png",
            },
        ],
        params={
            "prompt": "角色奔跑",
            "duration": 5,
            "ratio": "16:9",
            "resolution": "720P",
        },
    )

    class NoDbCall:
        async def execute(self, *args, **kwargs):
            raise AssertionError("invalid asset id should use task result fallback")

    card = asyncio.run(_build_video_card_from_task_results(task, NoDbCall()))

    assert card is not None
    assert card.video_url == "/uploads/creation/global/videos/partial.mp4"
    assert card.videoUrl == "/uploads/creation/global/videos/partial.mp4"
    assert card.thumbnail_url == "/uploads/creation/global/video-thumbnails/partial.png"
