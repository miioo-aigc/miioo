import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

from app.models.gen_task import GenTask
from app.models.episode import Episode
from app.models.project import Project
from app.models.storyboard import Storyboard
from app.models.user import User
from app.routers.storyboards import (
    GenerateStoryboardsFromFinalScriptRequest,
    _continue_generate_storyboards_from_final_script,
    _generate_storyboards_for_episode,
    generate_storyboards_from_final_script,
)


class _FakeScalarResult:
    def __init__(self, item):
        self._item = item

    def scalar_one_or_none(self):
        return self._item


class _FakeScalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return list(self._items)


class _FakeExecuteResult:
    def __init__(self, payload, *, many=False):
        self._payload = payload
        self._many = many

    def scalar_one_or_none(self):
        if self._many:
            raise AssertionError("scalar_one_or_none should not be used for multi results")
        return self._payload

    def scalars(self):
        if self._many:
            return _FakeScalars(self._payload)
        return _FakeScalars([self._payload] if self._payload is not None else [])


class _FakeAsyncSession:
    def __init__(self, *, task=None, project=None, user=None, episodes=None):
        self.task = task
        self.project = project
        self.user = user
        self.episodes = episodes or []
        self.storyboards = []
        self.added = []
        self.commit_count = 0
        self.rollback_count = 0

    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, GenTask):
            self.task = obj
        if isinstance(obj, Storyboard):
            self.storyboards.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        if getattr(_obj, "created_at", None) is None:
            _obj.created_at = datetime.now(timezone.utc)
        if getattr(_obj, "updated_at", None) is None:
            _obj.updated_at = datetime.now(timezone.utc)
        return None

    async def rollback(self):
        self.rollback_count += 1

    async def flush(self):
        return None

    async def execute(self, query):
        entity = query.column_descriptions[0].get("entity")
        if entity is GenTask:
            return _FakeExecuteResult(self.task)
        if entity is Project:
            return _FakeExecuteResult(self.project)
        if entity is User:
            return _FakeExecuteResult(self.user)
        if entity is Episode:
            return _FakeExecuteResult(self.episodes, many=True)
        if entity is Storyboard:
            return _FakeExecuteResult(self.storyboards, many=True)
        raise AssertionError(f"Unexpected entity lookup: {entity}")


class _FakeSessionContext:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_generate_storyboards_from_final_script_returns_task_immediately(monkeypatch):
    user_id = uuid.uuid4()
    project_id = uuid.uuid4()
    user = SimpleNamespace(id=user_id)
    project = SimpleNamespace(id=project_id, user_id=user_id)
    db = _FakeAsyncSession()
    dispatched = {}

    async def fake_get_project(project_id_arg, user_arg, db_arg):
        assert project_id_arg == str(project_id)
        assert user_arg is user
        assert db_arg is db
        return project

    async def fake_get_or_create_project_script(project_id_arg, db_arg):
        assert project_id_arg == str(project_id)
        assert db_arg is db
        return SimpleNamespace(content="定稿主剧本", parsed_content=None, status="finalized")

    async def fake_dispatch_background_job(job_key, *, handler_path, kwargs, name):
        dispatched["job_key"] = job_key
        dispatched["handler_path"] = handler_path
        dispatched["kwargs"] = kwargs
        dispatched["name"] = name
        return None

    monkeypatch.setattr("app.routers.storyboards._get_project", fake_get_project)
    monkeypatch.setattr("app.routers.storyboards.get_or_create_project_script", fake_get_or_create_project_script)
    monkeypatch.setattr("app.routers.storyboards.dispatch_background_job", fake_dispatch_background_job)

    response = asyncio.run(
        generate_storyboards_from_final_script(
            str(project_id),
            GenerateStoryboardsFromFinalScriptRequest(model="gpt-4.1"),
            user=user,
            db=db,
        )
    )

    assert response.task_type == "storyboard_generate"
    assert response.status == "pending"
    assert response.params["source"] == "storyboard_generate_from_final_script"
    assert response.params["stage_label"] == "等待执行"
    assert response.params["status_message"] == "已创建智能分镜任务，等待开始执行"
    assert response.params["overwrite_existing"] is True
    assert dispatched["handler_path"] == "app.routers.storyboards:_continue_generate_storyboards_from_final_script"
    assert dispatched["kwargs"]["task_id"] == db.task.id


def test_continue_generate_storyboards_from_final_script_marks_task_completed(monkeypatch):
    task = GenTask(
        user_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        task_type="storyboard_generate",
        status="pending",
        total_count=0,
        success_count=0,
        fail_count=0,
        params={"source": "storyboard_generate_from_final_script", "current_stage": "queued"},
        results=[],
    )
    project = SimpleNamespace(id=task.project_id, user_id=task.user_id, visual_style="东方电影感")
    user = SimpleNamespace(id=task.user_id)
    episodes = [
        SimpleNamespace(id=uuid.uuid4(), episode_number=1, title="第1集", content="集一"),
        SimpleNamespace(id=uuid.uuid4(), episode_number=2, title="第2集", content="集二"),
    ]
    db = _FakeAsyncSession(task=task, project=project, user=user, episodes=episodes)
    project_script = SimpleNamespace(content="主剧本", parsed_content=None, status="draft")

    async def fake_get_or_create_project_script(_project_id, _db):
        return project_script

    async def fake_finalize_project_script(**_kwargs):
        project_script.status = "finalized"

    async def fake_resolve_visual_style_text(*_args, **_kwargs):
        return "东方电影感"

    async def fake_load_storyboard_subject_context(*_args, **_kwargs):
        return ([], [], [], [], [], [], [])

    async def fake_generate_storyboards_for_episode(**kwargs):
        episode = kwargs["episode"]
        return [SimpleNamespace(id=uuid.uuid4()) for _ in range(episode.episode_number)]

    monkeypatch.setattr("app.routers.storyboards.async_session", lambda: _FakeSessionContext(db))
    monkeypatch.setattr("app.routers.storyboards.get_or_create_project_script", fake_get_or_create_project_script)
    monkeypatch.setattr("app.routers.storyboards.finalize_project_script", fake_finalize_project_script)
    monkeypatch.setattr("app.routers.storyboards.resolve_visual_style_text", fake_resolve_visual_style_text)
    monkeypatch.setattr("app.routers.storyboards._load_storyboard_subject_context", fake_load_storyboard_subject_context)
    monkeypatch.setattr("app.routers.storyboards._generate_storyboards_for_episode", fake_generate_storyboards_for_episode)

    asyncio.run(
        _continue_generate_storyboards_from_final_script(
            task_id=task.id,
            project_id=str(task.project_id),
            user_id=task.user_id,
            episode_count=None,
            model="gpt-4.1",
            split_mode="rule_first",
        )
    )

    assert task.status == "completed"
    assert task.total_count == 2
    assert task.success_count == 2
    assert task.fail_count == 0
    assert task.params["script_status"] == "finalized"
    assert task.params["first_episode_id"] == str(episodes[0].id)
    assert task.params["total_storyboard_count"] == 3
    assert task.params["completed_episode_numbers"] == [1, 2]
    assert task.params["failed_episode_numbers"] == []
    assert task.params["stage_label"] == "已完成"
    assert task.params["warning_messages"] == ["当前主体库为空，本次将仅按剧本内容抽镜"]
    assert len(task.results) == 2
    assert all(item["status"] == "completed" for item in task.results)


def test_continue_generate_storyboards_from_final_script_marks_task_partial(monkeypatch):
    task = GenTask(
        user_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        task_type="storyboard_generate",
        status="pending",
        total_count=0,
        success_count=0,
        fail_count=0,
        params={"source": "storyboard_generate_from_final_script", "current_stage": "queued"},
        results=[],
    )
    project = SimpleNamespace(id=task.project_id, user_id=task.user_id, visual_style="东方电影感")
    user = SimpleNamespace(id=task.user_id)
    episodes = [
        SimpleNamespace(id=uuid.uuid4(), episode_number=1, title="第1集", content="集一"),
        SimpleNamespace(id=uuid.uuid4(), episode_number=2, title="第2集", content="集二"),
    ]
    db = _FakeAsyncSession(task=task, project=project, user=user, episodes=episodes)
    project_script = SimpleNamespace(content="主剧本", parsed_content=None, status="draft")

    async def fake_get_or_create_project_script(_project_id, _db):
        return project_script

    async def fake_finalize_project_script(**_kwargs):
        project_script.status = "finalized"

    async def fake_resolve_visual_style_text(*_args, **_kwargs):
        return "东方电影感"

    async def fake_load_storyboard_subject_context(*_args, **_kwargs):
        return ([], [], [], [], [], [], [])

    async def fake_generate_storyboards_for_episode(**kwargs):
        episode = kwargs["episode"]
        if episode.episode_number == 2:
            raise HTTPException(status_code=502, detail="第 2 集 AI 分镜生成失败")
        return [SimpleNamespace(id=uuid.uuid4())]

    monkeypatch.setattr("app.routers.storyboards.async_session", lambda: _FakeSessionContext(db))
    monkeypatch.setattr("app.routers.storyboards.get_or_create_project_script", fake_get_or_create_project_script)
    monkeypatch.setattr("app.routers.storyboards.finalize_project_script", fake_finalize_project_script)
    monkeypatch.setattr("app.routers.storyboards.resolve_visual_style_text", fake_resolve_visual_style_text)
    monkeypatch.setattr("app.routers.storyboards._load_storyboard_subject_context", fake_load_storyboard_subject_context)
    monkeypatch.setattr("app.routers.storyboards._generate_storyboards_for_episode", fake_generate_storyboards_for_episode)

    asyncio.run(
        _continue_generate_storyboards_from_final_script(
            task_id=task.id,
            project_id=str(task.project_id),
            user_id=task.user_id,
            episode_count=None,
            model="gpt-4.1",
            split_mode="rule_first",
        )
    )

    assert task.status == "partial"
    assert task.total_count == 2
    assert task.success_count == 1
    assert task.fail_count == 1
    assert len(task.results) == 2
    assert task.results[0]["status"] == "completed"
    assert task.results[1]["status"] == "failed"
    assert "第 2 集 AI 分镜生成失败" in task.results[1]["error"]
    assert task.params["completed_episode_numbers"] == [1]
    assert task.params["failed_episode_numbers"] == [2]
    assert task.params["stage_label"] == "部分完成"
    assert task.params["warning_messages"] == ["当前主体库为空，本次将仅按剧本内容抽镜"]


def test_continue_generate_storyboards_from_final_script_marks_task_failed(monkeypatch):
    task = GenTask(
        user_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        task_type="storyboard_generate",
        status="pending",
        total_count=0,
        success_count=0,
        fail_count=0,
        params={"source": "storyboard_generate_from_final_script", "current_stage": "queued"},
        results=[],
    )
    project = SimpleNamespace(id=task.project_id, user_id=task.user_id, visual_style="东方电影感")
    user = SimpleNamespace(id=task.user_id)
    episodes = [
        SimpleNamespace(id=uuid.uuid4(), episode_number=1, title="第1集", content="集一"),
        SimpleNamespace(id=uuid.uuid4(), episode_number=2, title="第2集", content="集二"),
    ]
    db = _FakeAsyncSession(task=task, project=project, user=user, episodes=episodes)
    project_script = SimpleNamespace(content="主剧本", parsed_content=None, status="draft")

    async def fake_get_or_create_project_script(_project_id, _db):
        return project_script

    async def fake_finalize_project_script(**_kwargs):
        project_script.status = "finalized"

    async def fake_resolve_visual_style_text(*_args, **_kwargs):
        return "东方电影感"

    async def fake_load_storyboard_subject_context(*_args, **_kwargs):
        return ([], [], [], [], [], [], [])

    async def fake_generate_storyboards_for_episode(**kwargs):
        episode = kwargs["episode"]
        raise HTTPException(status_code=502, detail=f"第 {episode.episode_number} 集 AI 分镜生成失败")

    monkeypatch.setattr("app.routers.storyboards.async_session", lambda: _FakeSessionContext(db))
    monkeypatch.setattr("app.routers.storyboards.get_or_create_project_script", fake_get_or_create_project_script)
    monkeypatch.setattr("app.routers.storyboards.finalize_project_script", fake_finalize_project_script)
    monkeypatch.setattr("app.routers.storyboards.resolve_visual_style_text", fake_resolve_visual_style_text)
    monkeypatch.setattr("app.routers.storyboards._load_storyboard_subject_context", fake_load_storyboard_subject_context)
    monkeypatch.setattr("app.routers.storyboards._generate_storyboards_for_episode", fake_generate_storyboards_for_episode)

    asyncio.run(
        _continue_generate_storyboards_from_final_script(
            task_id=task.id,
            project_id=str(task.project_id),
            user_id=task.user_id,
            episode_count=None,
            model="gpt-4.1",
            split_mode="rule_first",
        )
    )

    assert task.status == "failed"
    assert task.total_count == 2
    assert task.success_count == 0
    assert task.fail_count == 2
    assert task.params["completed_episode_numbers"] == []
    assert task.params["failed_episode_numbers"] == [1, 2]
    assert task.params["stage_label"] == "执行失败"
    assert len(task.results) == 2
    assert all(item["status"] == "failed" for item in task.results)


def test_generate_storyboards_for_episode_persists_generation_metadata(monkeypatch):
    project_id = uuid.uuid4()
    user = SimpleNamespace(id=uuid.uuid4())
    episode = SimpleNamespace(
        id=uuid.uuid4(),
        episode_number=1,
        title="第一集",
        content="主角推门进入房间，环顾四周后缓缓开口。",
        status="draft",
    )
    db = _FakeAsyncSession()

    async def fake_get_user_model_provider_credentials(*_args, **_kwargs):
        return ("test-key", "https://example.com", "openai", "gpt-4.1")

    async def fake_generate_storyboard(*_args, **_kwargs):
        return (
            [
                {
                    "content": "主角推门进入房间，停在门口观察环境。",
                    "shot_type": "中景",
                    "camera": "固定机位",
                    "camera_angle": "平视",
                    "composition": "中心构图",
                    "duration": 4.0,
                    "lighting": "室内暖光",
                    "ambient_sound": "门轴轻响",
                    "voiceover": "她低声说：到了。",
                    "image_prompt": "cinematic interior, heroine at doorway",
                    "characters": ["主角"],
                    "scene": "室内",
                    "props": ["木门"],
                    "beat_refs": [1, 2],
                }
            ],
            {
                "story_beat_count": 6,
                "target_shot_count": 8,
                "episode_number": 1,
                "episode_title": "第一集",
                "generation_source": "final_script_batch",
            },
        )

    def fake_build_storyboard_composed_prompt(*_args, **_kwargs):
        return ("自动拼装提示词", 3)

    monkeypatch.setattr(
        "app.routers.storyboards.get_user_model_provider_credentials",
        fake_get_user_model_provider_credentials,
    )
    monkeypatch.setattr("app.routers.storyboards.generate_storyboard", fake_generate_storyboard)
    monkeypatch.setattr(
        "app.routers.storyboards._build_storyboard_composed_prompt",
        fake_build_storyboard_composed_prompt,
    )

    created = asyncio.run(
        _generate_storyboards_for_episode(
            project_id=str(project_id),
            episode=episode,
            model="gpt-4.1",
            subjects=[],
            user=user,
            db=db,
            visual_style="东方电影感",
            replace_existing=False,
        )
    )

    assert len(created) == 1
    storyboard = created[0]
    assert storyboard.gen_params["beat_refs"] == [1, 2]
    assert storyboard.gen_params["story_beat_count"] == 6
    assert storyboard.gen_params["target_shot_count"] == 8
    assert storyboard.gen_params["episode_number"] == 1
    assert storyboard.gen_params["episode_title"] == "第一集"
    assert storyboard.gen_params["generation_source"] == "final_script_batch"
    assert storyboard.gen_params["composed_prompt_auto"] == "自动拼装提示词"
    assert storyboard.gen_params["composed_prompt_source_version"] == 3
    assert episode.status == "storyboarded"
