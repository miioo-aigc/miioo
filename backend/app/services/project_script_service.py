import json
import re
from typing import Any, AsyncGenerator
from uuid import UUID

from fastapi import HTTPException
import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.episode import Episode
from app.models.project import Project
from app.models.project_script import ProjectScript
from app.models.project_script_history import ProjectScriptHistory
from app.models.project_script_message import ProjectScriptMessage
from app.models.subject import Subject
from app.schemas.project_script import ProjectScriptSplitPreviewItem
from app.services.llm import llm_service
from app.services.subject_extract import extract_subjects
from app.services.user_api_key import get_user_model_provider_credentials
from app.services.visual_styles import resolve_visual_style_text


PROJECT_SCRIPT_CHAT_SYSTEM_PROMPT = """你是一位专业的影视编剧协作助手。

你的任务：
1. 基于项目设定、当前主剧本和历史对话，帮助用户完善整部剧本。
2. 回复应直接给出可用于剧本创作的内容和修改建议。
3. 如果用户要求改写剧本，请输出完整、可直接替换到主剧本编辑器中的 Markdown 文本。
4. 不要输出 JSON。"""


PROJECT_SCRIPT_SPLIT_SYSTEM_PROMPT = """你是一位专业的剧集策划与拆分编辑。

请把用户提供的整稿剧本拆解为多集预览，输出严格 JSON，不要包含任何额外文字：
{
  "episodes": [
    {
      "episode_number": 1,
      "title": "第1集标题",
      "summary": "本集梗概",
      "content": "该集完整 Markdown 剧本正文"
    }
  ]
}

要求：
- 按剧情自然段落拆分，保证每集独立可读。
- `episode_number` 从 1 递增。
- `title` 简洁明确。
- `summary` 1-3 句即可。
- `content` 必须是完整的 Markdown 剧本正文。
- 如果用户给了目标集数，尽量接近该集数，但以剧情合理为先。"""

SCRIPT_HISTORY_KIND = "script_content"
EPISODE_SNAPSHOT_KIND = "episode_snapshot"
CHINESE_EPISODE_DIGITS = {
    "零": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}
EPISODE_HEADING_RE = re.compile(
    r"^\s{0,3}(?:#{1,6}\s*)?(?:【|《|\[|\()?\s*第\s*([0-9]+|[零一二两三四五六七八九十]+)\s*集(?:[：:：\-—]\s*(.*))?\s*(?:】|》|\]|\))?\s*$"
)
EPISODE_HEADING_CAPTURE_RE = re.compile(
    r"^(\s{0,3}(?:#{1,6}\s*)?(?:【|《|\[|\()?\s*)第\s*([0-9]+|[零一二两三四五六七八九十]+)\s*集(?:([：:：\-—]\s*)(.*?))?\s*((?:】|》|\]|\))?)\s*$"
)
CONTINUATION_KEYWORDS = (
    "续写",
    "接着写",
    "继续写",
    "继续往后",
    "往后写",
    "后续剧情",
    "新增分集",
    "再写",
)
REWRITE_KEYWORDS = (
    "重写",
    "改写",
    "重构",
    "重新生成",
    "全部重来",
    "整体改",
    "优化整稿",
    "重做",
)
PROJECT_SCRIPT_LLM_TIMEOUT_SECONDS = 500.0


def _clean_json_content(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    return cleaned


def _parse_episode_number(raw_value: str | None) -> int | None:
    if not raw_value:
        return None
    raw_value = raw_value.strip()
    if not raw_value:
        return None
    if raw_value.isdigit():
        return int(raw_value)

    if raw_value == "十":
        return 10
    if raw_value.startswith("十"):
        tail = CHINESE_EPISODE_DIGITS.get(raw_value[1:], 0)
        return 10 + tail
    if raw_value.endswith("十"):
        head = CHINESE_EPISODE_DIGITS.get(raw_value[0], 1)
        return head * 10
    if "十" in raw_value:
        head_raw, tail_raw = raw_value.split("十", 1)
        head = CHINESE_EPISODE_DIGITS.get(head_raw, 1)
        tail = CHINESE_EPISODE_DIGITS.get(tail_raw, 0)
        return head * 10 + tail
    return CHINESE_EPISODE_DIGITS.get(raw_value)


def _extract_rule_based_split_items(script_content: str) -> list[ProjectScriptSplitPreviewItem]:
    lines = script_content.splitlines()
    boundaries: list[tuple[int, int, str, str | None]] = []

    for index, raw_line in enumerate(lines):
        matched = EPISODE_HEADING_RE.match(raw_line.strip())
        if not matched:
            continue
        episode_number = _parse_episode_number(matched.group(1))
        if not episode_number:
            continue
        subtitle = (matched.group(2) or "").strip() or None
        title = f"第{episode_number}集"
        if subtitle:
            title = f"{title}：{subtitle}"
        boundaries.append((index, episode_number, title, subtitle))

    if not boundaries:
        return []

    preview_items: list[ProjectScriptSplitPreviewItem] = []
    for index, (start_line, episode_number, title, _) in enumerate(boundaries):
        end_line = boundaries[index + 1][0] if index + 1 < len(boundaries) else len(lines)
        content_lines = lines[start_line:end_line]
        episode_content = "\n".join(content_lines).strip()
        if not episode_content:
            continue
        preview_items.append(
            ProjectScriptSplitPreviewItem(
                episode_number=episode_number,
                title=title,
                summary=None,
                content=episode_content,
            )
        )

    preview_items.sort(key=lambda item: item.episode_number)
    return preview_items


def _is_continuation_request(user_message: str) -> bool:
    message = (user_message or "").strip()
    if not message:
        return False

    if any(keyword in message for keyword in REWRITE_KEYWORDS):
        return False

    if any(keyword in message for keyword in CONTINUATION_KEYWORDS):
        return True

    return bool(
        re.search(r"(后面|后续).{0,8}(再|继续).{0,8}(\d+\s*集|几集)", message)
        or re.search(r"(继续|再).{0,8}(\d+\s*集|几集)", message)
    )


def _get_max_episode_number_from_script(script_content: str) -> int:
    preview_items = _extract_rule_based_split_items(script_content or "")
    return max((item.episode_number for item in preview_items), default=0)


def _renumber_continuation_episode_headings(content: str, start_episode_number: int) -> str:
    if not content.strip():
        return content

    lines = content.splitlines()
    next_episode_number = start_episode_number
    matched_any_heading = False
    rewritten_lines: list[str] = []

    for line in lines:
        matched = EPISODE_HEADING_CAPTURE_RE.match(line)
        if not matched:
            rewritten_lines.append(line)
            continue

        matched_any_heading = True
        prefix = matched.group(1) or ""
        subtitle = (matched.group(4) or "").strip()
        suffix = matched.group(5) or ""
        rewritten_heading = f"{prefix}第{next_episode_number}集"
        if subtitle:
            rewritten_heading += f"：{subtitle}"
        if suffix:
            rewritten_heading += suffix
        rewritten_lines.append(rewritten_heading)
        next_episode_number += 1

    if not matched_any_heading:
        return content

    return "\n".join(rewritten_lines)


def _merge_continuation_script(existing_script: str, assistant_content: str) -> str:
    existing = (existing_script or "").strip()
    incoming = (assistant_content or "").strip()
    if not existing:
        return incoming
    if not incoming:
        return existing
    if incoming == existing or incoming in existing:
        return existing
    if existing in incoming:
        return incoming
    return f"{existing.rstrip()}\n\n{incoming.lstrip()}"


def _serialize_episode_snapshot_item(
    episode_number: int,
    title: str,
    content: str,
    summary: str | None = None,
) -> dict[str, Any]:
    return {
        "episode_number": int(episode_number),
        "title": title.strip() or f"第{episode_number}集",
        "summary": summary.strip() if isinstance(summary, str) and summary.strip() else None,
        "content": content.strip(),
    }


def _parse_episode_snapshot_payload(snapshot_payload: dict[str, Any] | None) -> list[ProjectScriptSplitPreviewItem]:
    items = (snapshot_payload or {}).get("items") or []
    parsed_items: list[ProjectScriptSplitPreviewItem] = []
    for index, item in enumerate(items, start=1):
        episode_number = item.get("episode_number") or index
        title = (item.get("title") or "").strip() or f"第{episode_number}集"
        content = (item.get("content") or "").strip()
        if not content:
            continue
        parsed_items.append(
            ProjectScriptSplitPreviewItem(
                episode_number=int(episode_number),
                title=title,
                summary=(item.get("summary") or "").strip() or None,
                content=content,
            )
        )
    parsed_items.sort(key=lambda item: item.episode_number)
    return parsed_items


async def get_or_create_project_script(project_id: str, db: AsyncSession) -> ProjectScript:
    result = await db.execute(
        select(ProjectScript).where(ProjectScript.project_id == UUID(project_id))
    )
    script = result.scalar_one_or_none()
    if script:
        return script

    script = ProjectScript(project_id=UUID(project_id))
    db.add(script)
    await db.commit()
    await db.refresh(script)
    return script


async def list_project_script_messages(project_script_id: UUID, db: AsyncSession) -> list[ProjectScriptMessage]:
    result = await db.execute(
        select(ProjectScriptMessage)
        .where(ProjectScriptMessage.project_script_id == project_script_id)
        .order_by(ProjectScriptMessage.created_at, ProjectScriptMessage.id)
    )
    return result.scalars().all()


async def append_project_script_message(
    project_script_id: UUID,
    role: str,
    content: str,
    message_type: str,
    db: AsyncSession,
) -> ProjectScriptMessage:
    message = ProjectScriptMessage(
        project_script_id=project_script_id,
        role=role,
        content=content,
        message_type=message_type,
    )
    db.add(message)
    await db.flush()
    return message


async def build_chat_messages(
    project: Project,
    project_script: ProjectScript,
    history: list[ProjectScriptMessage],
    user_message: str,
    episode_count: int | None,
    db: AsyncSession,
) -> list[dict]:
    visual_style = await resolve_visual_style_text(project.visual_style, project.user_id, db)
    current_script = (project_script.content or project_script.parsed_content or "").strip()
    settings_hint = (
        f"项目名称：{project.name}\n"
        f"语言：{project.language}\n"
        f"视觉风格：{visual_style}\n"
        f"目标集数：{episode_count if episode_count else '自动适应'}"
    )
    generation_constraint = (
        "若已明确指定目标集数，你必须按该集数规划完整整稿，避免明显缺集、合并过多或超出太多。"
        " 输出时每集都必须使用“第1集 / 第2集 / ...”这种明确标题依次展开。"
        if episode_count
        else "若未指定目标集数，请根据故事体量自动规划合理集数，并使用“第1集 / 第2集 / ...”这种明确标题依次展开。"
    )

    messages: list[dict] = [
        {
            "role": "system",
            "content": f"{PROJECT_SCRIPT_CHAT_SYSTEM_PROMPT}\n\n{settings_hint}\n{generation_constraint}",
        }
    ]
    if current_script:
        messages.append(
            {
                "role": "system",
                "content": f"当前主剧本如下，若用户要求改写或优化，请基于此文本继续修改：\n\n{current_script}",
            }
        )

    for message in history[-20:]:
        messages.append({"role": message.role, "content": message.content})
    messages.append({"role": "user", "content": user_message})
    return messages


def _extract_error_message(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.strip()
    if isinstance(payload, dict):
        for key in ("detail", "message", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = _extract_error_message(value)
                if nested:
                    return nested
        try:
            return json.dumps(payload, ensure_ascii=False)
        except TypeError:
            return str(payload).strip()
    if isinstance(payload, list):
        for item in payload:
            nested = _extract_error_message(item)
            if nested:
                return nested
        try:
            return json.dumps(payload, ensure_ascii=False)
        except TypeError:
            return str(payload).strip()
    return str(payload).strip() if payload else ""


def _http_error_detail(exc: httpx.HTTPStatusError) -> str:
    response = exc.response
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if payload is not None:
        detail = _extract_error_message(payload)
        if detail:
            return detail
    try:
        text = response.text.strip()
    except Exception:  # pragma: no cover - defensive fallback
        text = ""
    return text


def _raise_model_call_error(action_label: str, exc: Exception) -> None:
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, httpx.TimeoutException):
        raise HTTPException(status_code=502, detail=f"{action_label}失败: 模型服务响应超时") from exc
    if isinstance(exc, httpx.HTTPStatusError):
        detail = _http_error_detail(exc)
        message = f"{action_label}失败: 上游模型服务返回 {exc.response.status_code}"
        if detail:
            message = f"{message}，{detail}"
        raise HTTPException(status_code=502, detail=message) from exc
    raise HTTPException(status_code=502, detail=f"{action_label}失败: {str(exc)}") from exc


def _extract_llm_content(result: dict, action_label: str) -> str:
    try:
        content = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"{action_label}失败: 模型返回格式异常") from exc
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail=f"{action_label}失败: 模型未返回有效内容")
    return content.strip()


async def _resolve_chat_model_runtime(
    user_id: UUID,
    db: AsyncSession,
    model: str | None,
) -> tuple[str, str, str]:
    key_data = await get_user_model_provider_credentials(
        user_id,
        db,
        category="chat",
        requested_model=model,
    )
    if not key_data:
        detail = "当前没有可用的对话模型，请先在 API 配置中启用一个 chat 模型"
        if model:
            detail = f"未找到可用的对话模型 {model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)

    api_key, base_url, _, model_id = key_data
    return api_key, base_url, model_id


async def chat_with_project_script(
    project: Project,
    project_script: ProjectScript,
    user_message: str,
    episode_count: int | None,
    model: str | None,
    apply_to_script: bool,
    db: AsyncSession,
) -> tuple[ProjectScript, ProjectScriptMessage, ProjectScriptMessage]:
    api_key, base_url, resolved_model_id = await _resolve_chat_model_runtime(project.user_id, db, model)
    history = await list_project_script_messages(project_script.id, db)
    messages = await build_chat_messages(project, project_script, history, user_message, episode_count, db)
    try:
        result = await llm_service.chat_completion(
            messages=messages,
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
            temperature=0.7,
            timeout=PROJECT_SCRIPT_LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _raise_model_call_error("剧本对话生成", exc)
    assistant_content = _extract_llm_content(result, "剧本对话生成")
    return await _persist_project_script_chat_result(
        project_script=project_script,
        user_message=user_message,
        assistant_content=assistant_content,
        apply_to_script=apply_to_script,
        db=db,
    )


def _extract_stream_payload(event: str) -> str | None:
    line = (event or "").strip()
    if not line.startswith("data: "):
        return None
    return line[6:].strip()


def _extract_stream_chunk_text(payload: str) -> str:
    if not payload or payload == "[DONE]":
        return ""
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return payload
    return (
        parsed.get("choices", [{}])[0].get("delta", {}).get("content")
        or parsed.get("delta")
        or parsed.get("content")
        or parsed.get("chunk")
        or ""
    )


async def _persist_project_script_chat_result(
    project_script: ProjectScript,
    user_message: str,
    assistant_content: str,
    apply_to_script: bool,
    db: AsyncSession,
) -> tuple[ProjectScript, ProjectScriptMessage, ProjectScriptMessage]:
    is_continuation = _is_continuation_request(user_message)

    user_msg = await append_project_script_message(project_script.id, "user", user_message, "chat", db)
    assistant_msg = await append_project_script_message(
        project_script.id, "assistant", assistant_content, "chat", db
    )
    project_script.source_type = "chat"
    if apply_to_script:
        next_content = assistant_content
        history_detail = "AI 对话修改"
        if is_continuation:
            existing_script = (project_script.content or project_script.parsed_content or "").strip()
            if existing_script and existing_script not in assistant_content:
                next_episode_number = _get_max_episode_number_from_script(existing_script) + 1
                next_content = _renumber_continuation_episode_headings(
                    assistant_content,
                    next_episode_number,
                )
            next_content = _merge_continuation_script(existing_script, next_content)
            history_detail = "AI 续写追加"

        project_script.content = next_content
        project_script.status = "parsed" if next_content else project_script.status
        await db.flush()
        await create_script_history(project_script, "chat", history_detail, db)
    await db.commit()
    await db.refresh(project_script)
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)
    return project_script, user_msg, assistant_msg


async def stream_chat_with_project_script(
    project: Project,
    project_script: ProjectScript,
    user_message: str,
    episode_count: int | None,
    model: str | None,
    apply_to_script: bool,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    api_key, base_url, resolved_model_id = await _resolve_chat_model_runtime(project.user_id, db, model)
    history = await list_project_script_messages(project_script.id, db)
    messages = await build_chat_messages(project, project_script, history, user_message, episode_count, db)
    chunks: list[str] = []

    try:
        async for event in llm_service.stream_chat_completion(
            messages=messages,
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
            temperature=0.7,
            timeout=PROJECT_SCRIPT_LLM_TIMEOUT_SECONDS,
        ):
            payload = _extract_stream_payload(event)
            if payload is None:
                continue
            if payload == "[DONE]":
                break
            chunk_text = _extract_stream_chunk_text(payload)
            if chunk_text:
                chunks.append(chunk_text)
            yield event
    except Exception as exc:
        _raise_model_call_error("剧本对话生成", exc)

    assistant_content = "".join(chunks).strip()
    if not assistant_content:
        raise HTTPException(status_code=502, detail="剧本对话生成失败: 模型未返回有效内容")

    await _persist_project_script_chat_result(
        project_script=project_script,
        user_message=user_message,
        assistant_content=assistant_content,
        apply_to_script=apply_to_script,
        db=db,
    )
    yield "data: [DONE]\n\n"


async def split_project_script_preview(
    project: Project,
    project_script: ProjectScript,
    episode_count: int | None,
    model: str | None,
    split_mode: str,
    db: AsyncSession,
) -> tuple[list[ProjectScriptSplitPreviewItem], str]:
    script_content = (project_script.content or project_script.parsed_content or "").strip()
    if not script_content:
        raise HTTPException(status_code=400, detail="主剧本为空，请先上传、编辑或与模型对话")

    if split_mode != "ai_only":
        rule_items = _extract_rule_based_split_items(script_content)
        if rule_items:
            project_script.status = "split_ready"
            await append_project_script_message(
                project_script.id,
                "assistant",
                f"已按显式分集标题识别出 {len(rule_items)} 集拆分预览，可继续逐集确认后再覆盖正式分集。",
                "split_summary",
                db,
            )
            await db.commit()
            await db.refresh(project_script)
            return rule_items, "rule"

    api_key, base_url, resolved_model_id = await _resolve_chat_model_runtime(project.user_id, db, model)
    visual_style = await resolve_visual_style_text(project.visual_style, project.user_id, db)
    user_content = (
        f"项目名称：{project.name}\n"
        f"语言：{project.language}\n"
        f"视觉风格：{visual_style}\n"
        f"目标集数：{episode_count if episode_count else '未指定'}\n\n"
        f"整稿剧本如下：\n\n{script_content}"
    )
    try:
        result = await llm_service.chat_completion(
            messages=[
                {"role": "system", "content": PROJECT_SCRIPT_SPLIT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
            temperature=0.4,
            timeout=PROJECT_SCRIPT_LLM_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        _raise_model_call_error("剧本拆分预览", exc)
    content = _clean_json_content(_extract_llm_content(result, "剧本拆分预览"))
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI 拆分结果格式无效") from exc

    items = payload.get("episodes") or []
    preview_items: list[ProjectScriptSplitPreviewItem] = []
    for index, item in enumerate(items, start=1):
        episode_number = item.get("episode_number") or index
        title = (item.get("title") or "").strip() or f"第{episode_number}集"
        episode_content = (item.get("content") or "").strip()
        if not episode_content:
            continue
        preview_items.append(
            ProjectScriptSplitPreviewItem(
                episode_number=int(episode_number),
                title=title,
                summary=(item.get("summary") or "").strip() or None,
                content=episode_content,
            )
        )

    if not preview_items:
        raise HTTPException(status_code=502, detail="AI 未返回有效的分集拆分结果")

    preview_items.sort(key=lambda item: item.episode_number)
    project_script.status = "split_ready"
    await append_project_script_message(
        project_script.id,
        "assistant",
        f"已生成 {len(preview_items)} 集拆分预览，可继续逐集修改后再确认应用。",
        "split_summary",
        db,
    )
    await db.commit()
    await db.refresh(project_script)
    return preview_items, "ai"


async def apply_split_to_episodes(
    project_script: ProjectScript,
    items: list[ProjectScriptSplitPreviewItem],
    db: AsyncSession,
) -> tuple[int, int, int | None]:
    project_uuid = project_script.project_id
    existing_result = await db.execute(
        select(func.count(Episode.id)).where(Episode.project_id == project_uuid)
    )
    replaced_count = existing_result.scalar() or 0

    existing_items = await db.execute(
        select(Episode).where(Episode.project_id == project_uuid)
    )
    for episode in existing_items.scalars().all():
        await db.delete(episode)
    await db.flush()

    created_count = 0
    for item in items:
        episode = Episode(
            project_id=project_uuid,
            title=item.title,
            episode_number=item.episode_number,
            content=item.content,
            summary=item.summary,
            status="scripted",
        )
        db.add(episode)
        created_count += 1

    project_script.status = "split_applied"
    await append_project_script_message(
        project_script.id,
        "assistant",
        f"已将拆分结果应用为 {created_count} 个正式分集，覆盖原有 {replaced_count} 个分集。",
        "split_summary",
        db,
    )
    await db.commit()
    await db.refresh(project_script)
    return replaced_count, created_count, items[0].episode_number if items else None


async def create_episode_snapshot_history(
    script: ProjectScript,
    episodes: list[Episode],
    db: AsyncSession,
    source_detail: str | None = None,
) -> ProjectScriptHistory | None:
    snapshot_items = [
        _serialize_episode_snapshot_item(
            episode_number=episode.episode_number,
            title=episode.title,
            summary=episode.summary,
            content=episode.content or "",
        )
        for episode in sorted(episodes, key=lambda item: item.episode_number)
        if (episode.content or "").strip()
    ]
    if not snapshot_items:
        return None

    return await create_script_history(
        script=script,
        source_type=EPISODE_SNAPSHOT_KIND,
        source_detail=source_detail or f"覆盖前备份 {len(snapshot_items)} 个正式分集",
        db=db,
        snapshot_type=EPISODE_SNAPSHOT_KIND,
        snapshot_payload={"items": snapshot_items},
        content_override=script.content or script.parsed_content or "",
    )


async def finalize_project_script_workspace(
    project_script: ProjectScript,
    db: AsyncSession,
    *,
    source_detail: str = "剧本定稿",
) -> None:
    script_content = (project_script.content or project_script.parsed_content or "").strip()
    if not script_content:
        raise HTTPException(status_code=400, detail="主剧本为空，请先上传、编辑或与模型对话")

    project_script.status = "finalized"
    await db.flush()
    await create_script_history(project_script, "finalize", source_detail, db)


async def finalize_project_script(
    project: Project,
    project_script: ProjectScript,
    episode_count: int | None,
    model: str | None,
    split_mode: str,
    db: AsyncSession,
) -> tuple[list[ProjectScriptSplitPreviewItem], int, int, int | None, ProjectScriptHistory | None, str]:
    existing_result = await db.execute(
        select(Episode)
        .where(Episode.project_id == project_script.project_id)
        .order_by(Episode.episode_number)
    )
    existing_episodes = existing_result.scalars().all()

    await finalize_project_script_workspace(project_script, db)

    backup_history = await create_episode_snapshot_history(
        project_script,
        existing_episodes,
        db,
        source_detail=f"定稿覆盖前备份 {len(existing_episodes)} 个正式分集" if existing_episodes else None,
    )

    preview_items, split_source = await split_project_script_preview(
        project=project,
        project_script=project_script,
        episode_count=episode_count,
        model=model,
        split_mode=split_mode,
        db=db,
    )
    replaced_count, created_count, selected_episode_number = await apply_split_to_episodes(
        project_script,
        preview_items,
        db,
    )
    await append_project_script_message(
        project_script.id,
        "assistant",
        f"已完成定稿，并自动拆解为 {created_count} 个正式分集。"
        + (f" 原有 {replaced_count} 个分集已备份到历史版本。" if replaced_count else ""),
        "split_summary",
        db,
    )
    await db.commit()
    await db.refresh(project_script)
    return preview_items, replaced_count, created_count, selected_episode_number, backup_history, split_source


async def _persist_episode_subjects(
    *,
    project_id: UUID,
    episode: Episode,
    extracted: dict[str, Any],
    db: AsyncSession,
) -> int:
    created_count = 0
    for char in extracted.get("characters", []):
        db.add(
            Subject(
                project_id=project_id,
                episode_id=episode.id,
                type="character",
                name=char["name"],
                role=char.get("role"),
                description=char.get("description"),
                appearance=char.get("appearance"),
                personality=char.get("personality"),
                age=char.get("age"),
                gender=char.get("gender"),
                background=char.get("background"),
                prompt=char.get("prompt"),
            )
        )
        created_count += 1

    for scene in extracted.get("scenes", []):
        db.add(
            Subject(
                project_id=project_id,
                episode_id=episode.id,
                type="scene",
                name=scene["name"],
                description=scene.get("description"),
                scene_type=scene.get("scene_type"),
                time_setting=scene.get("time"),
                atmosphere=scene.get("atmosphere"),
                prompt=scene.get("prompt"),
            )
        )
        created_count += 1

    for prop in extracted.get("props", []):
        db.add(
            Subject(
                project_id=project_id,
                episode_id=episode.id,
                type="prop",
                name=prop["name"],
                description=prop.get("description"),
                importance=prop.get("importance"),
                prompt=prop.get("prompt"),
            )
        )
        created_count += 1

    episode.status = "extracted"
    await db.flush()
    return created_count


async def extract_subjects_for_episodes(
    *,
    project: Project,
    episodes: list[Episode],
    model: str | None,
    db: AsyncSession,
) -> tuple[int, int, int, list[int]]:
    target_episodes = [episode for episode in episodes if (episode.content or "").strip()]
    if not target_episodes:
        return 0, 0, 0, []

    api_key, base_url, resolved_model_id = await _resolve_chat_model_runtime(project.user_id, db, model)
    extracted_episode_count = 0
    subject_created_count = 0
    failed_episode_numbers: list[int] = []

    for episode in target_episodes:
        try:
            extracted = await extract_subjects(
                episode.content or "",
                api_key=api_key,
                base_url=base_url,
                model=resolved_model_id,
            )
            created_count = await _persist_episode_subjects(
                project_id=project.id,
                episode=episode,
                extracted=extracted,
                db=db,
            )
            extracted_episode_count += 1
            subject_created_count += created_count
        except Exception:
            failed_episode_numbers.append(episode.episode_number)

    await db.commit()
    return extracted_episode_count, subject_created_count, 0, failed_episode_numbers


async def finalize_project_script_and_extract_subjects(
    project: Project,
    project_script: ProjectScript,
    episode_count: int | None,
    model: str | None,
    split_mode: str,
    auto_extract_subjects: bool,
    db: AsyncSession,
) -> tuple[
    list[ProjectScriptSplitPreviewItem],
    int,
    int,
    int | None,
    ProjectScriptHistory | None,
    str,
    int,
    int,
    int,
    list[int],
]:
    (
        preview_items,
        replaced_count,
        created_count,
        selected_episode_number,
        backup_history,
        split_source,
    ) = await finalize_project_script(
        project=project,
        project_script=project_script,
        episode_count=episode_count,
        model=model,
        split_mode=split_mode,
        db=db,
    )

    if not auto_extract_subjects:
        return (
            preview_items,
            replaced_count,
            created_count,
            selected_episode_number,
            backup_history,
            split_source,
            0,
            0,
            0,
            [],
        )

    episode_result = await db.execute(
        select(Episode)
        .where(Episode.project_id == project.id)
        .order_by(Episode.episode_number)
    )
    episodes = episode_result.scalars().all()
    (
        extracted_episode_count,
        subject_created_count,
        subject_updated_count,
        failed_episode_numbers,
    ) = await extract_subjects_for_episodes(
        project=project,
        episodes=episodes,
        model=model,
        db=db,
    )

    await append_project_script_message(
        project_script.id,
        "assistant",
        (
            f"已对 {extracted_episode_count} 个分集完成主体提取，新增 {subject_created_count} 个主体。"
            + (
                f" 以下集数提取失败：{', '.join(str(item) for item in failed_episode_numbers)}。"
                if failed_episode_numbers
                else ""
            )
        ),
        "split_summary",
        db,
    )
    await db.commit()
    await db.refresh(project_script)
    return (
        preview_items,
        replaced_count,
        created_count,
        selected_episode_number,
        backup_history,
        split_source,
        extracted_episode_count,
        subject_created_count,
        subject_updated_count,
        failed_episode_numbers,
    )


async def extract_global_subjects_from_script(
    project: Project,
    project_script: ProjectScript,
    db: AsyncSession,
) -> tuple[list[Subject], list[Subject]]:
    script_content = (project_script.content or project_script.parsed_content or "").strip()
    if not script_content:
        raise HTTPException(status_code=400, detail="主剧本为空，请先上传、编辑或与模型对话")

    api_key, base_url, resolved_model_id = await _resolve_chat_model_runtime(project.user_id, db, None)
    try:
        extracted = await extract_subjects(
            script_content,
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
            mode="global",
        )
    except Exception as exc:
        _raise_model_call_error("主剧本全局主体提取", exc)

    existing_result = await db.execute(
        select(Subject).where(Subject.project_id == project.id)
    )
    existing_subjects = existing_result.scalars().all()
    existing_map = {
        (subject.type, subject.name.strip().lower()): subject
        for subject in existing_subjects
    }

    created: list[Subject] = []
    updated: list[Subject] = []
    for item in extracted.get("characters", []):
        key = ("character", item["name"].strip().lower())
        subject = existing_map.get(key)
        if subject:
            subject.role = item.get("role")
            subject.description = item.get("description")
            subject.appearance = item.get("appearance")
            subject.personality = item.get("personality")
            subject.age = item.get("age")
            subject.gender = item.get("gender")
            subject.background = item.get("background")
            subject.prompt = item.get("prompt")
            subject.is_global = True
            subject.episode_id = None
            updated.append(subject)
        else:
            subject = Subject(
                project_id=project.id,
                episode_id=None,
                type="character",
                name=item["name"],
                role=item.get("role"),
                description=item.get("description"),
                appearance=item.get("appearance"),
                personality=item.get("personality"),
                age=item.get("age"),
                gender=item.get("gender"),
                background=item.get("background"),
                prompt=item.get("prompt"),
                is_global=True,
            )
            db.add(subject)
            created.append(subject)
            existing_map[key] = subject

    for item in extracted.get("scenes", []):
        key = ("scene", item["name"].strip().lower())
        subject = existing_map.get(key)
        if subject:
            subject.description = item.get("description")
            subject.scene_type = item.get("scene_type")
            subject.time_setting = item.get("time")
            subject.atmosphere = item.get("atmosphere")
            subject.prompt = item.get("prompt")
            subject.is_global = True
            subject.episode_id = None
            updated.append(subject)
        else:
            subject = Subject(
                project_id=project.id,
                episode_id=None,
                type="scene",
                name=item["name"],
                description=item.get("description"),
                scene_type=item.get("scene_type"),
                time_setting=item.get("time"),
                atmosphere=item.get("atmosphere"),
                prompt=item.get("prompt"),
                is_global=True,
            )
            db.add(subject)
            created.append(subject)
            existing_map[key] = subject

    for item in extracted.get("props", []):
        key = ("prop", item["name"].strip().lower())
        subject = existing_map.get(key)
        if subject:
            subject.description = item.get("description")
            subject.importance = item.get("importance")
            subject.prompt = item.get("prompt")
            subject.is_global = True
            subject.episode_id = None
            updated.append(subject)
        else:
            subject = Subject(
                project_id=project.id,
                episode_id=None,
                type="prop",
                name=item["name"],
                description=item.get("description"),
                importance=item.get("importance"),
                prompt=item.get("prompt"),
                is_global=True,
            )
            db.add(subject)
            created.append(subject)
            existing_map[key] = subject

    project_script.status = "subjects_extracted"
    await db.commit()
    for subject in created + updated:
        await db.refresh(subject)
    await db.refresh(project_script)
    return created, updated


async def create_script_history(
    script: ProjectScript,
    source_type: str,
    source_detail: str | None,
    db: AsyncSession,
    snapshot_type: str = SCRIPT_HISTORY_KIND,
    snapshot_payload: dict[str, Any] | None = None,
    content_override: str | None = None,
) -> ProjectScriptHistory | None:
    content = content_override if content_override is not None else (script.content or script.parsed_content or "")
    if not content.strip():
        return None

    result = await db.execute(
        select(func.coalesce(func.max(ProjectScriptHistory.version_number), 0))
        .where(ProjectScriptHistory.project_script_id == script.id)
    )
    max_version = result.scalar() or 0

    history = ProjectScriptHistory(
        project_script_id=script.id,
        version_number=max_version + 1,
        content=content,
        source_type=source_type,
        source_detail=source_detail,
        snapshot_type=snapshot_type,
        snapshot_payload=snapshot_payload,
    )
    db.add(history)
    await db.flush()
    return history


async def list_script_histories(
    project_script_id: UUID,
    db: AsyncSession,
) -> list[ProjectScriptHistory]:
    result = await db.execute(
        select(ProjectScriptHistory)
        .where(ProjectScriptHistory.project_script_id == project_script_id)
        .order_by(ProjectScriptHistory.version_number.desc())
    )
    return result.scalars().all()


async def get_script_history(
    history_id: str,
    project_script_id: UUID,
    db: AsyncSession,
) -> ProjectScriptHistory | None:
    result = await db.execute(
        select(ProjectScriptHistory).where(
            ProjectScriptHistory.id == UUID(history_id),
            ProjectScriptHistory.project_script_id == project_script_id,
        )
    )
    return result.scalar_one_or_none()


async def restore_script_history(
    script: ProjectScript,
    history_id: str,
    db: AsyncSession,
) -> ProjectScript:
    history = await get_script_history(history_id, script.id, db)
    if not history:
        raise HTTPException(status_code=404, detail="历史版本不存在")

    if history.snapshot_type == EPISODE_SNAPSHOT_KIND:
        await restore_episode_snapshot_history(script, history, db)
        return script

    script.content = history.content
    script.status = "parsed"
    script.source_type = "manual"
    await db.flush()

    await create_script_history(script, "manual", f"恢复到版本 {history.version_number}", db)
    await db.commit()
    await db.refresh(script)
    return script


async def restore_episode_snapshot_history(
    script: ProjectScript,
    history: ProjectScriptHistory,
    db: AsyncSession,
) -> ProjectScript:
    snapshot_items = _parse_episode_snapshot_payload(history.snapshot_payload)
    if not snapshot_items:
        raise HTTPException(status_code=400, detail="该历史版本不包含可恢复的分集快照")

    existing_result = await db.execute(
        select(Episode).where(Episode.project_id == script.project_id)
    )
    for episode in existing_result.scalars().all():
        await db.delete(episode)
    await db.flush()

    for item in snapshot_items:
        db.add(
            Episode(
                project_id=script.project_id,
                title=item.title,
                episode_number=item.episode_number,
                content=item.content,
                summary=item.summary,
                status="scripted",
            )
        )

    script.status = "split_applied"
    await db.flush()
    await create_script_history(script, "manual", f"恢复分集快照版本 {history.version_number}", db)
    await db.commit()
    await db.refresh(script)
    return script
