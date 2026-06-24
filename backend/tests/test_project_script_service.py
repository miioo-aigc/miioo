from types import SimpleNamespace
import uuid

import pytest

from app.services import project_script_service
from app.services.project_script_service import (
    _get_max_episode_number_from_script,
    _is_continuation_request,
    _merge_continuation_script,
    _renumber_continuation_episode_headings,
    chat_with_project_script,
)


class _FakeAsyncSession:
    async def flush(self):
        return None

    async def commit(self):
        return None

    async def refresh(self, _obj):
        return None


def test_is_continuation_request_distinguishes_continuation_and_rewrite():
    assert _is_continuation_request("请继续续写后面两集")
    assert _is_continuation_request("接着写后续剧情，再来 2 集")
    assert not _is_continuation_request("请重写前三集的节奏和台词")


def test_merge_continuation_script_avoids_duplicate_when_model_returns_full_script():
    existing = "## 第1集\n旧内容"
    incoming = "## 第1集\n旧内容\n\n## 第2集\n新内容"

    merged = _merge_continuation_script(existing, incoming)

    assert merged == incoming


def test_renumber_continuation_episode_headings_appends_after_existing_max_episode():
    continuation = "## 第1集：新的冲突\n内容A\n\n## 第2集：新的反转\n内容B"

    renumbered = _renumber_continuation_episode_headings(continuation, 4)

    assert "## 第4集：新的冲突" in renumbered
    assert "## 第5集：新的反转" in renumbered
    assert "## 第1集" not in renumbered
    assert "## 第2集" not in renumbered


def test_get_max_episode_number_from_script_reads_existing_outline():
    script = "\n".join(
        [
            "## 第1集：开端",
            "内容1",
            "## 第2集：转折",
            "内容2",
            "## 第3集：结局",
            "内容3",
        ]
    )

    assert _get_max_episode_number_from_script(script) == 3


@pytest.mark.anyio
async def test_chat_with_project_script_appends_continuation_and_renumbers(monkeypatch):
    captured_history_details: list[str | None] = []

    async def _fake_resolve_chat_model_runtime(_user_id, _db, _model):
        return "api-key", "https://example.com", "mock-model"

    async def _fake_chat_completion(**_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": "## 第1集：新的冲突\n新内容A\n\n## 第2集：新的反转\n新内容B"
                    }
                }
            ]
        }

    async def _fake_list_messages(_project_script_id, _db):
        return []

    async def _fake_append_message(project_script_id, role, content, message_type, _db):
        return SimpleNamespace(
            id=uuid.uuid4(),
            project_script_id=project_script_id,
            role=role,
            content=content,
            message_type=message_type,
        )

    async def _fake_create_history(_script, _source_type, source_detail, _db, **_kwargs):
        captured_history_details.append(source_detail)
        return SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(
        project_script_service,
        "_resolve_chat_model_runtime",
        _fake_resolve_chat_model_runtime,
    )
    monkeypatch.setattr(
        project_script_service.llm_service,
        "chat_completion",
        _fake_chat_completion,
    )
    monkeypatch.setattr(
        project_script_service,
        "list_project_script_messages",
        _fake_list_messages,
    )
    monkeypatch.setattr(
        project_script_service,
        "append_project_script_message",
        _fake_append_message,
    )
    monkeypatch.setattr(
        project_script_service,
        "create_script_history",
        _fake_create_history,
    )

    project = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="测试项目",
        language="中文",
        visual_style="电影感",
    )
    project_script = SimpleNamespace(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        content="## 第1集：旧开端\n旧内容1\n\n## 第2集：旧转折\n旧内容2\n\n## 第3集：旧高潮\n旧内容3",
        parsed_content=None,
        source_type="manual",
        status="parsed",
    )

    updated_script, _user_msg, assistant_msg = await chat_with_project_script(
        project=project,
        project_script=project_script,
        user_message="请继续续写后面两集",
        episode_count=2,
        model="mock-model",
        apply_to_script=True,
        db=_FakeAsyncSession(),
    )

    assert assistant_msg.content.startswith("## 第1集：新的冲突")
    assert "## 第3集：旧高潮" in updated_script.content
    assert "## 第4集：新的冲突" in updated_script.content
    assert "## 第5集：新的反转" in updated_script.content
    assert captured_history_details == ["AI 续写追加"]


@pytest.mark.anyio
async def test_chat_with_project_script_keeps_overwrite_semantics_for_rewrite(monkeypatch):
    captured_history_details: list[str | None] = []

    async def _fake_resolve_chat_model_runtime(_user_id, _db, _model):
        return "api-key", "https://example.com", "mock-model"

    async def _fake_chat_completion(**_kwargs):
        return {
            "choices": [
                {
                    "message": {
                        "content": "## 第1集：重写版本\n全新内容"
                    }
                }
            ]
        }

    async def _fake_list_messages(_project_script_id, _db):
        return []

    async def _fake_append_message(project_script_id, role, content, message_type, _db):
        return SimpleNamespace(
            id=uuid.uuid4(),
            project_script_id=project_script_id,
            role=role,
            content=content,
            message_type=message_type,
        )

    async def _fake_create_history(_script, _source_type, source_detail, _db, **_kwargs):
        captured_history_details.append(source_detail)
        return SimpleNamespace(id=uuid.uuid4())

    monkeypatch.setattr(
        project_script_service,
        "_resolve_chat_model_runtime",
        _fake_resolve_chat_model_runtime,
    )
    monkeypatch.setattr(
        project_script_service.llm_service,
        "chat_completion",
        _fake_chat_completion,
    )
    monkeypatch.setattr(
        project_script_service,
        "list_project_script_messages",
        _fake_list_messages,
    )
    monkeypatch.setattr(
        project_script_service,
        "append_project_script_message",
        _fake_append_message,
    )
    monkeypatch.setattr(
        project_script_service,
        "create_script_history",
        _fake_create_history,
    )

    project = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="测试项目",
        language="中文",
        visual_style="电影感",
    )
    project_script = SimpleNamespace(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        content="## 第1集：旧版本\n旧内容",
        parsed_content=None,
        source_type="manual",
        status="parsed",
    )

    updated_script, _user_msg, _assistant_msg = await chat_with_project_script(
        project=project,
        project_script=project_script,
        user_message="请重写前三集的剧情结构",
        episode_count=3,
        model="mock-model",
        apply_to_script=True,
        db=_FakeAsyncSession(),
    )

    assert updated_script.content == "## 第1集：重写版本\n全新内容"
    assert captured_history_details == ["AI 对话修改"]
