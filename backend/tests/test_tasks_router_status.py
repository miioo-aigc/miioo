import asyncio
from datetime import datetime
from types import SimpleNamespace
from uuid import uuid4

from app.models.gen_task import GenTask
from app.routers.tasks import _to_response, get_video_task_status


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


def test_to_response_lifts_current_stage_and_partial_ready():
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
            "current_stage": "metadata_committing",
            "partial_ready": True,
        },
        results=[],
    )
    task.created_at = datetime(2026, 6, 19, 12, 0, 0)
    task.updated_at = datetime(2026, 6, 19, 12, 5, 0)

    response = _to_response(task)

    assert response.current_stage == "metadata_committing"
    assert response.currentStage == "metadata_committing"
    assert response.partial_ready is True
    assert response.partialReady is True


def test_get_video_task_status_exposes_runtime_stage_fields():
    task = GenTask(
        user_id=uuid4(),
        project_id=None,
        task_type="creation_video",
        status="completed",
        total_count=1,
        success_count=1,
        fail_count=0,
        model="doubao-seedance-2.0",
        size="720P",
        params={
            "current_stage": "completed",
            "partial_ready": True,
        },
        results=[
            {
                "url": "/uploads/creation/global/videos/final.mp4",
                "thumbnail_url": "/uploads/creation/global/video-thumbnails/final.png",
            }
        ],
    )
    task.id = uuid4()
    db = _FakeAsyncSession(task)
    user = SimpleNamespace(id=task.user_id)

    response = asyncio.run(
        get_video_task_status(
            str(task.id),
            user=user,
            db=db,
        )
    )

    assert response.status == "done"
    assert response.progress == 100
    assert response.current_stage == "completed"
    assert response.currentStage == "completed"
    assert response.partial_ready is True
    assert response.partialReady is True
    assert response.video_url == "/uploads/creation/global/videos/final.mp4"
    assert response.thumbnail_url == "/uploads/creation/global/video-thumbnails/final.png"
