import asyncio

from app.services import background_runtime


def test_schedule_background_job_cleans_registry_after_completion():
    background_runtime._scheduled_tasks.clear()

    async def _run():
        await asyncio.sleep(0)
        return "done"

    async def _exercise():
        task = background_runtime.schedule_background_job(
            "job-1",
            _run(),
            name="test-job-1",
        )
        return await task

    result = asyncio.run(_exercise())

    assert result == "done"
    assert "job-1" not in background_runtime._scheduled_tasks


def test_cancel_background_job_marks_task_cancelled():
    background_runtime._scheduled_tasks.clear()

    started = asyncio.Event()

    async def _run():
        started.set()
        await asyncio.sleep(10)

    async def _exercise():
        task = background_runtime.schedule_background_job(
            "job-2",
            _run(),
            name="test-job-2",
        )
        await started.wait()
        assert await background_runtime.cancel_background_job("job-2") is True
        try:
            await task
        except asyncio.CancelledError:
            return "cancelled"
        return "unexpected"

    outcome = asyncio.run(_exercise())

    assert outcome == "cancelled"
    assert "job-2" not in background_runtime._scheduled_tasks


def test_build_storyboard_background_job_key_is_granular():
    key = background_runtime.build_storyboard_background_job_key(
        "project-1",
        ["episode-2", "episode-1"],
        "task-9",
    )
    assert key == "storyboard-bg:project-1:episode-1,episode-2:task-9"
