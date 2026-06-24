import ast
import json
import re

from app.services.llm import llm_service


DEFAULT_FRAMING = "中景"
DEFAULT_CAMERA_MOTION = "固定机位"
DEFAULT_DURATION = 4.0
STORYBOARD_LLM_TIMEOUT_SECONDS = 3000.0

LEGACY_SHOT_TYPE_VALUES = {"narration", "dialogue", "action", "transition"}

FRAMING_ALIASES = {
    "远景": "远景",
    "大全景": "远景",
    "wide": "远景",
    "wide shot": "远景",
    "long shot": "远景",
    "全景": "全景",
    "full shot": "全景",
    "full": "全景",
    "中景": "中景",
    "medium": "中景",
    "medium shot": "中景",
    "近景": "近景",
    "medium close up": "近景",
    "medium close-up": "近景",
    "close up": "近景",
    "close-up": "近景",
    "特写": "特写",
    "close": "特写",
    "extreme close up": "特写",
    "extreme close-up": "特写",
}

CAMERA_MOTION_ALIASES = {
    "固定机位": "固定机位",
    "固定": "固定机位",
    "静止": "固定机位",
    "static": "固定机位",
    "locked off": "固定机位",
    "跟拍": "跟拍",
    "tracking": "跟拍",
    "tracking shot": "跟拍",
    "follow": "跟拍",
    "环绕": "环绕",
    "orbit": "环绕",
    "arc": "环绕",
    "缓推": "缓推",
    "推镜": "缓推",
    "推进": "缓推",
    "dolly in": "缓推",
    "push in": "缓推",
    "缓拉": "缓拉",
    "拉镜": "缓拉",
    "拉远": "缓拉",
    "dolly out": "缓拉",
    "pull out": "缓拉",
    "左摇": "左摇",
    "pan left": "左摇",
    "摇向左侧": "左摇",
    "右摇": "右摇",
    "pan right": "右摇",
    "摇向右侧": "右摇",
    "左移": "左移",
    "truck left": "左移",
    "move left": "左移",
    "右移": "右移",
    "truck right": "右移",
    "move right": "右移",
    "上升": "上升",
    "升起": "上升",
    "crane up": "上升",
    "rise": "上升",
    "下降": "下降",
    "下沉": "下降",
    "crane down": "下降",
    "drop": "下降",
}

ANGLE_ALIASES = {
    "平视": "平视",
    "eye level": "平视",
    "eye-level": "平视",
    "俯视": "俯视",
    "high angle": "俯视",
    "high-angle": "俯视",
    "仰视": "仰视",
    "low angle": "仰视",
    "low-angle": "仰视",
    "侧视": "侧视",
    "side view": "侧视",
    "profile": "侧视",
    "背视": "背视",
    "back view": "背视",
    "rear view": "背视",
}

COMPOSITION_ALIASES = {
    "中心构图": "中心构图",
    "centered": "中心构图",
    "center": "中心构图",
    "三分线构图": "三分线构图",
    "rule of thirds": "三分线构图",
    "thirds": "三分线构图",
    "对角线构图": "对角线构图",
    "diagonal": "对角线构图",
    "引导线构图": "引导线构图",
    "leading lines": "引导线构图",
    "框架构图": "框架构图",
    "frame within frame": "框架构图",
    "framed": "框架构图",
}

STORYBOARD_SYSTEM_PROMPT = """你是一位专业影视分镜师和剧本拆解师。

你的任务不是自由发挥，而是把给定剧本拆解成覆盖完整剧情的镜头列表。

硬性要求：
1. 必须严格按照剧本推进顺序拆镜，不能跳过关键动作、转折、情绪变化和重要台词。
2. 必须优先使用给定主体库中的原名填写 `characters`、`scene`、`props`，不要改写、不要使用别名。
3. 每个镜头都要对应剧本中的具体情节，不要写空泛镜头。
4. 镜头数必须精确满足要求。
5. 只输出合法 JSON，不要输出 markdown，不要解释说明。

输出 JSON 对象格式：
{
  "shots": [
    {
      "content": "镜头内容，中文，必须写明：出场人物/主体名称、正在做的具体动作、情绪状态、所处空间位置，禁止使用笼统描述",
      "shot_type": "远景|全景|中景|近景|特写",
      "camera": "固定机位|跟拍|环绕|缓推|缓拉|左摇|左移|右移|右摇|上升|下降",
      "camera_angle": "平视|俯视|仰视|侧视|背视",
      "composition": "中心构图|三分线构图|对角线构图|引导线构图|框架构图",
      "duration": 4,
      "lighting": "中文，描述光影、光线来源和氛围",
      "ambient_sound": "中文，描述该镜头环境音或现场氛围声，没有可留空",
      "voiceover": "中文，旁白、画外音或关键台词摘要，没有可留空",
      "image_prompt": "English visual prompt. Must include: character appearance (hair, clothing, expression), specific action, spatial composition, shot type, camera movement, lighting quality and color, mood. No generic phrases like 'a person' or 'someone'.",
      "characters": ["角色原名1", "角色原名2"],
      "scene": "场景原名",
      "props": ["道具原名1"],
      "beat_refs": [1, 2]
    }
  ]
}"""

STORYBOARD_REPAIR_PROMPT = """你需要修复上一轮分镜拆解结果。

要求：
1. 保持剧情顺序和核心内容不变。
2. 返回 EXACTLY {target_count} 个镜头。
3. 每个镜头都必须尽量覆盖提供的剧情节拍。
4. 继续优先使用主体库原名。
5. 只输出合法 JSON 对象，格式仍为 {{"shots":[...]}}。

当前问题：
- 期望镜头数：{target_count}
- 实际镜头数：{actual_count}

上一轮结果：
{existing_result}
"""

STORYBOARD_JSON_NORMALIZE_PROMPT = """你是 JSON 修复器。

你的任务是把用户提供的内容整理为严格合法的 JSON 对象。

要求：
1. 只输出合法 JSON，不要输出 markdown，不要解释说明。
2. 如果内容本身已经是 JSON，只做最小必要修复，不要改写语义。
3. 如果内容是镜头数组而不是对象，请包装成 {"shots":[...]}。
4. 保留原有字段名与字段值，不要自行新增剧情内容。
5. 输出必须能被标准 JSON 解析器直接解析。
"""

STORYBOARD_JSON_ERROR_REPAIR_PROMPT = """你是严格的 JSON 语法修复器。

你的任务是根据解析器报错信息，修复用户提供的 JSON 内容，使其成为严格合法的 JSON。

要求：
1. 只输出合法 JSON，不要输出 markdown，不要解释说明。
2. 保留原有字段与语义，不要新增剧情内容。
3. 必须修复所有语法问题，尤其是缺失逗号、未转义双引号、非法换行、尾逗号。
4. 如果内容是镜头数组而不是对象，请包装成 {"shots":[...]}。
5. 输出必须能被标准 JSON 解析器直接解析。
"""

def _compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _normalize_choice(value: object, aliases: dict[str, str]) -> str | None:
    text = _compact_whitespace(str(value or ""))
    if not text:
        return None
    normalized_key = text.casefold().replace("_", " ").replace("-", " ")
    normalized_key = re.sub(r"\s+", " ", normalized_key).strip()
    if normalized_key in aliases:
        return aliases[normalized_key]
    if text in aliases:
        return aliases[text]
    return text


def _normalize_framing(value: object) -> str | None:
    return _normalize_choice(value, FRAMING_ALIASES)


def _normalize_camera_motion(value: object) -> str | None:
    return _normalize_choice(value, CAMERA_MOTION_ALIASES)


def _normalize_angle(value: object) -> str | None:
    return _normalize_choice(value, ANGLE_ALIASES)


def _normalize_composition(value: object) -> str | None:
    return _normalize_choice(value, COMPOSITION_ALIASES)


def _is_legacy_shot_type(value: object) -> bool:
    normalized = _compact_whitespace(str(value or "")).casefold()
    return normalized in LEGACY_SHOT_TYPE_VALUES


def _truncate(value: str, limit: int) -> str:
    text = _compact_whitespace(value)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _extract_json_content(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    if cleaned.startswith("[") and cleaned.endswith("]"):
        return cleaned
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    start_candidates = [idx for idx in (cleaned.find("["), cleaned.find("{")) if idx != -1]
    if not start_candidates:
        return cleaned

    start_index = min(start_candidates)
    end_bracket = cleaned.rfind("]")
    end_brace = cleaned.rfind("}")
    end_index = max(end_bracket, end_brace)
    if end_index >= start_index:
        return cleaned[start_index : end_index + 1]
    return cleaned


def _extract_balanced_json_segments(content: str) -> list[str]:
    segments: list[str] = []
    seen: set[str] = set()
    text = content.strip()

    for start_index, char in enumerate(text):
        if char not in "[{":
            continue

        stack = ["]" if char == "[" else "}"]
        in_string = False
        escape = False
        quote_char = '"'

        for end_index in range(start_index + 1, len(text)):
            current = text[end_index]
            if in_string:
                if escape:
                    escape = False
                    continue
                if current == "\\":
                    escape = True
                    continue
                if current == quote_char:
                    in_string = False
                continue

            if current in {'"', "'"}:
                in_string = True
                quote_char = current
                continue

            if current in "[{":
                stack.append("]" if current == "[" else "}")
                continue

            if current in "]}":
                if not stack or current != stack[-1]:
                    break
                stack.pop()
                if not stack:
                    candidate = text[start_index : end_index + 1].strip()
                    if candidate and candidate not in seen:
                        segments.append(candidate)
                        seen.add(candidate)
                    break

    return segments


def _extract_message_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
                continue
            if isinstance(item, dict):
                text_value = item.get("text") or item.get("content") or item.get("value")
                if isinstance(text_value, str):
                    parts.append(text_value)
                    continue
                if isinstance(text_value, list):
                    nested = _extract_message_content(text_value)
                    if nested:
                        parts.append(nested)
        return "\n".join(part for part in parts if part).strip()
    if isinstance(content, dict):
        for key in ("text", "content", "value"):
            value = content.get(key)
            if value is None:
                continue
            extracted = _extract_message_content(value)
            if extracted:
                return extracted
    return str(content or "").strip()


def _sanitize_json_candidate(candidate: str) -> str:
    sanitized = candidate.strip()
    sanitized = sanitized.replace("\ufeff", "")
    sanitized = sanitized.replace("“", '"').replace("”", '"')
    sanitized = sanitized.replace("‘", "'").replace("’", "'")
    sanitized = re.sub(r"^(?:json|JSON)\s*", "", sanitized, count=1)
    sanitized = re.sub(r",(\s*[}\]])", r"\1", sanitized)
    return sanitized


def _try_parse_python_literal(candidate: str) -> object | None:
    try:
        parsed = ast.literal_eval(candidate)
    except (SyntaxError, ValueError):
        return None
    if isinstance(parsed, (list, dict)):
        return parsed
    return None


def _build_json_error_context(content: str, exc: json.JSONDecodeError) -> str:
    start = max(exc.pos - 120, 0)
    end = min(exc.pos + 120, len(content))
    snippet = content[start:end]
    return (
        f"解析错误：{exc.msg}\n"
        f"line={exc.lineno}, column={exc.colno}, pos={exc.pos}\n"
        f"出错片段：\n{snippet}"
    )


def _parse_storyboard_payload(content: str) -> object:
    normalized_content = _extract_message_content(content)
    candidates: list[str] = []
    for candidate in (
        _extract_json_content(normalized_content),
        *_extract_balanced_json_segments(normalized_content),
        normalized_content,
    ):
        sanitized = _sanitize_json_candidate(candidate)
        if sanitized and sanitized not in candidates:
            candidates.append(sanitized)

    last_error: json.JSONDecodeError | None = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc

    for candidate in candidates:
        parsed_literal = _try_parse_python_literal(candidate)
        if parsed_literal is not None:
            return parsed_literal

    if last_error is not None:
        raise last_error
    raise json.JSONDecodeError("No JSON content found", normalized_content, 0)


def _extract_story_beats(script_content: str) -> list[str]:
    normalized = script_content.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    blocks = [block.strip(" \n\t-") for block in re.split(r"\n{2,}", normalized) if block.strip()]

    beats: list[str] = []
    for block in blocks:
        line = re.sub(r"^#{1,6}\s*", "", block).strip()
        line = re.sub(r"^[（(【\[]?(第?\d+[场幕集话章节回]|Scene\s*\d+|SCENE\s*\d+)[）)\]】:：.\s-]*", "", line).strip()
        line = re.sub(r"^\d+[.)、]\s*", "", line).strip()
        if not line:
            continue

        segments = [seg.strip() for seg in re.split(r"(?<=[。！？!?；;])\s*", line) if seg.strip()]
        if not segments:
            segments = [line]

        for segment in segments:
            compact = _compact_whitespace(segment)
            if not compact:
                continue
            if len(compact) > 90:
                sub_segments = [part.strip() for part in re.split(r"[，,、]", compact) if part.strip()]
                merged = ""
                for part in sub_segments:
                    if not merged:
                        merged = part
                        continue
                    if len(merged) + len(part) + 1 <= 90:
                        merged = f"{merged}，{part}"
                    else:
                        beats.append(merged)
                        merged = part
                if merged:
                    beats.append(merged)
            else:
                beats.append(compact)

    deduped: list[str] = []
    seen: set[str] = set()
    for beat in beats:
        if len(beat) < 4:
            continue
        if beat in seen:
            continue
        deduped.append(beat)
        seen.add(beat)

    if deduped:
        return deduped[:18]

    fallback = _compact_whitespace(script_content)
    return [_truncate(fallback, 180)] if fallback else []


def _estimate_target_shot_count(script_content: str, beats: list[str]) -> int:
    text = _compact_whitespace(script_content)
    beat_count = len(beats)
    char_based = max(4, round(len(text) / 180)) if text else 4
    beat_based = max(4, min(beat_count, 12))
    target = max(char_based, beat_based)
    return max(4, min(target, 12))


def _serialize_subjects(title: str, items: list[dict], fields: list[str]) -> str:
    if not items:
        return f"{title}: []"
    normalized_items = []
    for item in items:
        normalized = {field: _compact_whitespace(str(item.get(field) or "")) for field in fields}
        normalized_items.append({key: value for key, value in normalized.items() if value})
    return f"{title}: {json.dumps(normalized_items, ensure_ascii=False)}"


def _build_user_prompt(
    *,
    script_content: str,
    characters: list[dict],
    scenes: list[dict],
    props: list[dict],
    visual_style: str,
    episode_title: str | None,
    episode_number: int | None,
    story_beats: list[str],
    target_shot_count: int,
) -> str:
    style_guidance = [
        f"视觉风格：{visual_style or '保持项目默认电影感风格'}",
        "角色一致性：同一角色在所有镜头中的外貌、服装、发型、年龄感必须一致",
        "场景一致性：同一场景的时间、天气、空间关系、光线、道具布置必须前后连贯",
        "提取原则：优先提取具体剧情动作、冲突、情绪变化和关键台词，不要只做抽象总结",
    ]
    beat_lines = "\n".join([f"{idx}. {beat}" for idx, beat in enumerate(story_beats, start=1)])
    episode_label = []
    if episode_number is not None:
        episode_label.append(f"分集序号：第 {episode_number} 集")
    if episode_title:
        episode_label.append(f"分集标题：{episode_title}")

    return (
        "请根据以下信息拆解分镜：\n"
        f"{chr(10).join(episode_label) if episode_label else '分集信息：未提供标题'}\n"
        f"目标镜头数：{target_shot_count}（必须精确返回这个数量）\n"
        "单镜头建议时长：3-6 秒，必要时允许 2-8 秒\n\n"
        "项目要求：\n"
        f"{chr(10).join(style_guidance)}\n\n"
        "主体库：\n"
        f"{_serialize_subjects('角色', characters, ['name', 'role', 'description', 'appearance', 'personality'])}\n"
        f"{_serialize_subjects('场景', scenes, ['name', 'description', 'time_setting', 'atmosphere'])}\n"
        f"{_serialize_subjects('道具', props, ['name', 'description', 'importance'])}\n\n"
        "剧本关键节拍（请优先覆盖这些节拍，并保持顺序）：\n"
        f"{beat_lines}\n\n"
        "原始剧本：\n"
        f"{script_content}\n\n"
        "补充规则：\n"
        "1. 如果一个节拍信息量很大，可以拆成多个镜头。\n"
        "2. 如果多个连续节拍描述的是同一瞬间，也可以合并到一个镜头，但必须保证整体剧情没有缺失。\n"
        "3. `beat_refs` 填写该镜头对应的节拍编号，便于回查。\n"
        "4. `shot_type` 填景别，`camera` 填运镜，`image_prompt` 请用英文，必须包含：角色外貌（发型/服装/神情）、具体动作、空间构图、景别、运镜、光线质感与色调、整体氛围，禁止使用 'a person'/'someone' 等无指向表述。\n"
        "5. `camera_angle`、`composition`、`lighting`、`ambient_sound`、`voiceover` 尽量补齐，不能省略成笼统词。\n"
        "6. 如果主体库里没有完全匹配的名称，字段允许留空，但不要凭空编造不存在的主体。"
    )


def _normalize_name_list(value: object) -> list[str]:
    if isinstance(value, str):
        candidates = re.split(r"[，,、/|]", value)
    elif isinstance(value, list):
        candidates = [str(item) for item in value]
    else:
        candidates = []

    normalized: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        name = _compact_whitespace(candidate)
        if not name or name in seen:
            continue
        normalized.append(name)
        seen.add(name)
    return normalized


def _normalize_beat_refs(value: object) -> list[int]:
    if isinstance(value, int):
        return [value]
    if isinstance(value, str):
        parts = re.findall(r"\d+", value)
        return [int(part) for part in parts]
    if isinstance(value, list):
        refs: list[int] = []
        for item in value:
            if isinstance(item, int):
                refs.append(item)
            elif isinstance(item, str) and item.isdigit():
                refs.append(int(item))
        return refs
    return []


def _normalize_duration(value: object) -> float | None:
    if isinstance(value, (int, float)):
        duration = float(value)
    elif isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        duration = float(match.group()) if match else DEFAULT_DURATION
    else:
        return None

    if duration < 2:
        return 2.0
    if duration > 8:
        return 8.0
    return round(duration, 1)


def _infer_framing(content: str) -> str:
    if any(token in content for token in ("神情", "眼神", "表情", "细节", "泪", "手指", "特写")):
        return "特写"
    if any(token in content for token in ("对话", "交谈", "相视", "递给", "接过", "半身")):
        return "近景"
    if any(token in content for token in ("奔跑", "追逐", "打斗", "穿过", "进入", "走向", "中景")):
        return "中景"
    if any(token in content for token in ("房间", "街道", "院落", "大厅", "教室", "站在", "全景")):
        return "全景"
    return DEFAULT_FRAMING


def _fallback_image_prompt(
    *,
    content: str,
    scene_name: str | None,
    character_names: list[str],
    prop_names: list[str],
    visual_style: str,
    framing: str,
    camera_motion: str,
) -> str:
    parts = [
        "cinematic storyboard frame",
        framing.lower(),
        camera_motion.lower(),
        visual_style or "film style",
    ]
    if scene_name:
        parts.append(f"scene {scene_name}")
    if character_names:
        parts.append(f"characters {', '.join(character_names[:3])}")
    if prop_names:
        parts.append(f"props {', '.join(prop_names[:3])}")
    parts.append(f"action {content}")
    parts.append("coherent lighting, dramatic composition, detailed environment")
    return _truncate(", ".join(parts), 320)


def _normalize_optional_text(value: object) -> str | None:
    text = _compact_whitespace(str(value or ""))
    return text or None


def _match_subject_names(text: str, subject_names: list[str]) -> list[str]:
    matched: list[str] = []
    for name in subject_names:
        if name and name in text and name not in matched:
            matched.append(name)
    return matched


def _post_process_shots(
    *,
    shots: list[dict],
    story_beats: list[str],
    characters: list[dict],
    scenes: list[dict],
    props: list[dict],
    visual_style: str,
    target_shot_count: int,
) -> list[dict]:
    character_names = [item.get("name", "") for item in characters]
    scene_names = [item.get("name", "") for item in scenes]
    prop_names = [item.get("name", "") for item in props]

    processed: list[dict] = []
    for index, shot in enumerate(shots):
        beat_refs = [ref for ref in _normalize_beat_refs(shot.get("beat_refs")) if 1 <= ref <= len(story_beats)]
        fallback_beat = story_beats[min(index, len(story_beats) - 1)] if story_beats else ""
        content = _compact_whitespace(str(shot.get("content") or "")) or fallback_beat
        combined_text = " ".join(
            filter(
                None,
                [
                    content,
                    _compact_whitespace(str(shot.get("scene") or "")),
                    _compact_whitespace(str(shot.get("image_prompt") or "")),
                ],
            )
        )

        shot_characters = _normalize_name_list(shot.get("characters")) or _match_subject_names(combined_text, character_names)
        shot_props = _normalize_name_list(shot.get("props")) or _match_subject_names(combined_text, prop_names)

        scene_name = _compact_whitespace(str(shot.get("scene") or ""))
        if not scene_name:
            inferred_scenes = _match_subject_names(combined_text, scene_names)
            scene_name = inferred_scenes[0] if inferred_scenes else None

        raw_shot_type = (
            shot.get("shot_type")
            or shot.get("framing")
            or shot.get("shot_size")
            or shot.get("shotSize")
        )
        raw_camera = (
            shot.get("camera")
            or shot.get("camera_motion")
            or shot.get("cameraMotion")
            or shot.get("camera_movement")
            or shot.get("cameraMovement")
            or shot.get("movement")
            or shot.get("motion")
        )
        if _is_legacy_shot_type(raw_shot_type):
            framing = _normalize_framing(
                shot.get("framing")
                or shot.get("shot_size")
                or shot.get("shotSize")
                or shot.get("camera")
                or DEFAULT_FRAMING
            ) or DEFAULT_FRAMING
            camera_motion = _normalize_camera_motion(
                shot.get("camera_motion")
                or shot.get("cameraMotion")
                or shot.get("camera_movement")
                or shot.get("cameraMovement")
                or shot.get("movement")
                or shot.get("motion")
                or DEFAULT_CAMERA_MOTION
            ) or DEFAULT_CAMERA_MOTION
        else:
            framing = _normalize_framing(raw_shot_type) or _infer_framing(content)
            camera_motion = _normalize_camera_motion(raw_camera) or DEFAULT_CAMERA_MOTION

        camera_angle = _normalize_angle(
            shot.get("camera_angle")
            or shot.get("cameraAngle")
            or shot.get("angle")
        ) or "平视"
        composition = _normalize_composition(
            shot.get("composition")
            or shot.get("frame_composition")
            or shot.get("frameComposition")
        ) or "中心构图"
        lighting = _normalize_optional_text(
            shot.get("lighting")
            or shot.get("light")
            or shot.get("light_shadow")
            or shot.get("lightShadow")
        )
        ambient_sound = _normalize_optional_text(
            shot.get("ambient_sound")
            or shot.get("ambientSound")
            or shot.get("sound_effect")
            or shot.get("soundEffect")
        )
        voiceover = _normalize_optional_text(
            shot.get("voiceover")
            or shot.get("voice_over")
            or shot.get("narration")
            or shot.get("dialogue_summary")
            or shot.get("dialogueSummary")
        )
        image_prompt = _compact_whitespace(str(shot.get("image_prompt") or shot.get("prompt") or shot.get("visualPrompt") or ""))
        if not image_prompt:
            image_prompt = _fallback_image_prompt(
                content=content,
                scene_name=scene_name,
                character_names=shot_characters,
                prop_names=shot_props,
                visual_style=visual_style,
                framing=framing,
                camera_motion=camera_motion,
            )

        processed.append(
            {
                "content": content or None,
                "shot_type": framing,
                "camera": camera_motion,
                "camera_angle": camera_angle,
                "composition": composition,
                "duration": _normalize_duration(shot.get("duration")) or DEFAULT_DURATION,
                "lighting": lighting,
                "ambient_sound": ambient_sound,
                "voiceover": voiceover,
                "image_prompt": image_prompt,
                "characters": shot_characters,
                "scene": scene_name or None,
                "props": shot_props,
                "beat_refs": beat_refs,
            }
        )

    if len(processed) > target_shot_count:
        return processed[:target_shot_count]

    if len(processed) < target_shot_count:
        for idx in range(len(processed), target_shot_count):
            fallback_source = ""
            if story_beats:
                fallback_source = story_beats[min(idx, len(story_beats) - 1)]
            elif shots:
                fallback_source = _truncate(_compact_whitespace(str(shots[-1].get("content") or "")), 120)
            fallback_beat = fallback_source or f"补足镜头 {idx + 1}"
            inferred_characters = _match_subject_names(fallback_beat, character_names)
            inferred_props = _match_subject_names(fallback_beat, prop_names)
            inferred_scenes = _match_subject_names(fallback_beat, scene_names)
            processed.append(
                {
                    "content": fallback_beat,
                    "shot_type": _infer_framing(fallback_beat),
                    "camera": DEFAULT_CAMERA_MOTION,
                    "camera_angle": "平视",
                    "composition": "中心构图",
                    "duration": DEFAULT_DURATION,
                    "lighting": None,
                    "ambient_sound": None,
                    "voiceover": None,
                    "image_prompt": _fallback_image_prompt(
                        content=fallback_beat,
                        scene_name=inferred_scenes[0] if inferred_scenes else None,
                        character_names=inferred_characters,
                        prop_names=inferred_props,
                        visual_style=visual_style,
                        framing=_infer_framing(fallback_beat),
                        camera_motion=DEFAULT_CAMERA_MOTION,
                    ),
                    "characters": inferred_characters,
                    "scene": inferred_scenes[0] if inferred_scenes else None,
                    "props": inferred_props,
                    "beat_refs": [min(idx + 1, len(story_beats))] if story_beats else [],
                }
            )

    return processed


def _normalize_shots_payload(payload: object) -> list[dict]:
    if isinstance(payload, list):
        candidate_items = payload
    elif isinstance(payload, dict):
        candidate_items = payload.get("shots") or payload.get("storyboards") or payload.get("items") or []
    else:
        candidate_items = []

    if not isinstance(candidate_items, list):
        return []

    normalized_shots: list[dict] = []
    for item in candidate_items:
        if not isinstance(item, dict):
            continue

        content = _compact_whitespace(
            str(
                item.get("content")
                or item.get("description")
                or item.get("shot_description")
                or item.get("actionSummary")
                or item.get("dialogue")
                or ""
            )
        )
        image_prompt = _compact_whitespace(str(item.get("image_prompt") or item.get("prompt") or item.get("visualPrompt") or ""))
        if not content and not image_prompt:
            continue

        normalized_shots.append(
            {
                "content": content or None,
                "shot_type": item.get("shot_type") or item.get("framing") or item.get("shot_size") or item.get("shotSize") or item.get("type"),
                "camera": item.get("camera") or item.get("camera_motion") or item.get("cameraMotion") or item.get("camera_movement") or item.get("cameraMovement") or item.get("movement") or item.get("motion"),
                "camera_angle": item.get("camera_angle") or item.get("cameraAngle") or item.get("angle"),
                "composition": item.get("composition") or item.get("frame_composition") or item.get("frameComposition"),
                "duration": item.get("duration"),
                "lighting": item.get("lighting") or item.get("light") or item.get("light_shadow") or item.get("lightShadow"),
                "ambient_sound": item.get("ambient_sound") or item.get("ambientSound") or item.get("sound_effect") or item.get("soundEffect"),
                "voiceover": item.get("voiceover") or item.get("voice_over") or item.get("narration") or item.get("dialogue_summary") or item.get("dialogueSummary"),
                "image_prompt": image_prompt or None,
                "characters": _normalize_name_list(item.get("characters")),
                "scene": _compact_whitespace(str(item.get("scene") or item.get("scene_name") or item.get("sceneName") or item.get("location") or "")) or None,
                "props": _normalize_name_list(item.get("props")),
                "beat_refs": _normalize_beat_refs(item.get("beat_refs") or item.get("beatRefs")),
            }
        )

    return normalized_shots


async def _call_storyboard_llm(
    *,
    messages: list[dict],
    api_key: str,
    base_url: str,
    model: str | None,
    temperature: float,
    trace_id: str,
    phase: str,
) -> tuple[list[dict], str]:
    result = await llm_service.chat_completion(
        messages=messages,
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=temperature,
        max_tokens=4000,
        timeout=STORYBOARD_LLM_TIMEOUT_SECONDS,
        trace_id=f"{trace_id}:{phase}:main",
    )
    raw_content = _extract_message_content(result["choices"][0]["message"]["content"])
    try:
        payload = _parse_storyboard_payload(raw_content)
        return _normalize_shots_payload(payload), raw_content
    except json.JSONDecodeError as exc:
        normalize_result = await llm_service.chat_completion(
            messages=[
                {"role": "system", "content": STORYBOARD_JSON_NORMALIZE_PROMPT},
                {"role": "user", "content": raw_content},
            ],
            api_key=api_key,
            base_url=base_url,
            model=model,
            temperature=0.1,
            max_tokens=4000,
            timeout=STORYBOARD_LLM_TIMEOUT_SECONDS,
            trace_id=f"{trace_id}:{phase}:normalize",
        )
        normalized_content = _extract_message_content(
            normalize_result["choices"][0]["message"]["content"]
        )
        try:
            payload = _parse_storyboard_payload(normalized_content)
            return _normalize_shots_payload(payload), normalized_content
        except json.JSONDecodeError as exc:
            repair_result = await llm_service.chat_completion(
                messages=[
                    {"role": "system", "content": STORYBOARD_JSON_ERROR_REPAIR_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            "请根据下面的 JSON 解析错误修复内容，并只输出合法 JSON：\n\n"
                            f"{_build_json_error_context(normalized_content, exc)}\n\n"
                            "待修复内容：\n"
                            f"{normalized_content}"
                        ),
                    },
                ],
                api_key=api_key,
                base_url=base_url,
                model=model,
                temperature=0,
                max_tokens=4000,
                timeout=STORYBOARD_LLM_TIMEOUT_SECONDS,
                trace_id=f"{trace_id}:{phase}:syntax-repair",
            )
            repaired_content = _extract_message_content(
                repair_result["choices"][0]["message"]["content"]
            )
            payload = _parse_storyboard_payload(repaired_content)
            return _normalize_shots_payload(payload), repaired_content


async def generate_storyboard(
    script_content: str,
    characters: list[dict],
    scenes: list[dict],
    props: list[dict],
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    model: str | None = None,
    visual_style: str = "",
    episode_title: str | None = None,
    episode_number: int | None = None,
    return_metadata: bool = False,
) -> list[dict] | tuple[list[dict], dict]:
    story_beats = _extract_story_beats(script_content)
    target_shot_count = _estimate_target_shot_count(script_content, story_beats)
    trace_id = f"storyboard-{episode_number or 'na'}-{target_shot_count}"
    user_prompt = _build_user_prompt(
        script_content=script_content,
        characters=characters,
        scenes=scenes,
        props=props,
        visual_style=visual_style,
        episode_title=episode_title,
        episode_number=episode_number,
        story_beats=story_beats,
        target_shot_count=target_shot_count,
    )

    messages = [
        {"role": "system", "content": STORYBOARD_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": user_prompt,
        },
    ]

    shots, raw_content = await _call_storyboard_llm(
        messages=messages,
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.4,
        trace_id=trace_id,
        phase="main",
    )

    if len(shots) != target_shot_count:
        repair_prompt = STORYBOARD_REPAIR_PROMPT.format(
            target_count=target_shot_count,
            actual_count=len(shots),
            existing_result=_truncate(raw_content, 2200),
        )
        repair_messages = [
            {"role": "system", "content": STORYBOARD_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": user_prompt + "\n\n" + repair_prompt,
            },
        ]
        repaired_shots, _ = await _call_storyboard_llm(
            messages=repair_messages,
            api_key=api_key,
            base_url=base_url,
            model=model,
            temperature=0.2,
            trace_id=trace_id,
            phase="count-repair",
        )
        if repaired_shots:
            shots = repaired_shots

    processed_shots = _post_process_shots(
        shots=shots,
        story_beats=story_beats,
        characters=characters,
        scenes=scenes,
        props=props,
        visual_style=visual_style,
        target_shot_count=target_shot_count,
    )
    if not processed_shots:
        raise ValueError("AI 未返回有效分镜数据")
    if not return_metadata:
        return processed_shots
    return processed_shots, {
        "story_beat_count": len(story_beats),
        "target_shot_count": target_shot_count,
        "episode_number": episode_number,
        "episode_title": episode_title or "",
        "generation_source": "final_script_batch",
    }
