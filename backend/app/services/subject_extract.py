import json
import re

from app.services.llm import llm_service


OUTPUT_SCHEMA = """{
  "characters": [
    {
      "name": "角色名",
      "role": "主角/配角/反派/群像角色",
      "description": "该角色在当前剧本中的功能与状态描述",
      "appearance": "可视化外貌与服化特征",
      "personality": "性格、气质、情绪底色",
      "age": "年龄段，可留空",
      "gender": "性别，可留空",
      "background": "身份、关系、来历或当前处境，可留空",
      "prompt": "结合剧本内容生成的角色详细中文提示词，可直接用于主体图片生成"
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "description": "空间样貌、关键陈设、叙事功能",
      "time": "清晨/白天/黄昏/夜晚等",
      "atmosphere": "情绪氛围、声音环境、光线气质",
      "scene_type": "室内/室外/自然空间/公共空间/私人空间等",
      "prompt": "结合剧本内容生成的场景详细中文提示词，可直接用于主体图片生成"
    }
  ],
  "props": [
    {
      "name": "道具名",
      "description": "造型特征与剧情用途",
      "owner": "所属角色或主要关联场景，可留空",
      "importance": "高/中/低",
      "prompt": "结合剧本内容生成的道具详细中文提示词，可直接用于主体图片生成"
    }
  ]
}"""


SUBJECT_SKILLS_LAYER = """你必须按“剧本拆解主体 skills 层”执行，不可只做浅层关键词提取：

1. 剧情分段 skill
- 先识别剧本中的场景切换、时间变化、人物出入场、关键动作和情绪转折。
- 每一段都要判断谁在场、发生在哪里、哪些物件真正参与剧情。

2. 角色识别 skill
- 优先提取有姓名、称谓或稳定身份的角色。
- 若角色未写姓名，但在本段中承担明确叙事功能且具有稳定身份，也允许提取为“医生/母亲/店员”这类剧本原文口径。
- 角色描述不要只写“年轻女性/男人”，要写其在当前剧情里的身份、目标、状态和视觉特征。

3. 场景识别 skill
- 场景不是简单地点名词，而是“可直接用于美术/镜头理解的叙事空间”。
- 需要尽量提取空间类型、时间、氛围、关键陈设和叙事功能。
- 同一场景重复出现时要合并，不要因为一句话里写法不同就拆成多条。

4. 道具识别 skill
- 只提取推动剧情、塑造角色、形成视觉记忆点或后续镜头会继续使用的道具。
- 不要把桌椅、门窗、路灯这类无叙事意义的背景杂项大量列入。
- 要说明道具的用途、象征意义或和谁强关联。

5. 细化描述 skill
- `description` 强调“它是什么 + 在这段戏里起什么作用”。
- `appearance` 强调可视化外观、服装、材质、年龄感、发型、体态等。
- `personality` 强调稳定气质与当前情绪底色，不要只写单一形容词。
- `atmosphere` 强调空间情绪、声音环境、压迫感/静谧感/危险感等。
- `prompt` 必须是可直接给生图模型使用的详细中文提示词，且必须以剧本事实为依据，不可脱离剧情随意发挥。
- 对角色 `prompt`，必须明确单人主体、纯白色背景、不要环境布景、不要额外人物，重点表现角色设定本身。
- 对场景 `prompt`，要写出空间主体、关键陈设、时间光线、氛围粒度、镜头感和画面质感，保证拿去生成时能看出该场景；同时必须明确“场景内不生成人物、不出现角色、不出现人形剪影或群演”。
- 对道具 `prompt`，必须尽量拆解到“只有道具物品本身”，不要手持、不要人物、不要复杂环境；默认按单个道具主视图/主角度来组织描述，突出材质、结构、比例和关键细节。

6. 去重归并 skill
- 同名角色、场景、道具只能保留一条，综合多处信息后输出更完整版本。
- 不要创建剧本里不存在的新主体，不要把同一主体拆成多个别名。

7. 输出约束 skill
- 只输出严格合法 JSON，不要输出 markdown，不要解释说明。
- 如果某个字段没有足够依据，可留空字符串，但不能编造。"""


EXTRACT_SYSTEM_PROMPT = f"""你是一位专业的影视剧本分析师。从给定的剧本内容中提取所有主体（角色、场景、道具）。

{SUBJECT_SKILLS_LAYER}

输出严格的 JSON 格式，不要包含任何其他文字：
{OUTPUT_SCHEMA}

规则：
- 只提取剧本中明确出现或暗示的主体
- 角色名使用剧本中的原名
- 场景名简洁概括（如"咖啡店内"、"街道"）
- 道具只提取有剧情意义的物品
- 如果某个类别没有内容，返回空数组"""

GLOBAL_EXTRACT_SYSTEM_PROMPT = f"""你是一位专业的影视剧本分析师。请从整部剧本中提取项目级主体（角色、场景、道具）。

{SUBJECT_SKILLS_LAYER}

输出严格的 JSON 格式，不要包含任何其他文字：
{OUTPUT_SCHEMA}

规则：
- 提取整部剧本中反复出现或具有视觉意义的主体
- 优先保留项目全局可复用的角色、场景、道具
- 如果同名主体多次出现，只保留一条综合描述
- 如果某个类别没有内容，返回空数组"""

CHARACTER_FIELD_OUTPUT_SCHEMA = """{
  "role": "角色定位，未提及则为空字符串",
  "appearance": "外貌、服装、气质等可视化信息，未提及则为空字符串",
  "personality": "性格与行为倾向，未提及则为空字符串",
  "age": "年龄或年龄阶段，未提及则为空字符串",
  "gender": "明确提及时填写，未提及则为空字符串",
  "background": "身份、经历、背景设定，未提及则为空字符串",
  "prompt": "可直接用于主体生图的详细中文提示词，需贴合剧本事实，未提及则为空字符串"
}"""

SCENE_FIELD_OUTPUT_SCHEMA = """{
  "scene_type": "室内/室外/自然空间/公共空间/私人空间等，未提及则为空字符串",
  "time_setting": "清晨/白天/黄昏/夜晚/雨夜等时间设定，未提及则为空字符串",
  "atmosphere": "空间氛围、声音环境、光线气质等，未提及则为空字符串",
  "prompt": "可直接用于主体生图的详细中文提示词，需贴合剧本事实，未提及则为空字符串"
}"""

PROP_FIELD_OUTPUT_SCHEMA = """{
  "importance": "高/中/低 或关键线索/普通道具等重要性描述，未提及则为空字符串",
  "prompt": "可直接用于主体生图的详细中文提示词，需贴合剧本事实，未提及则为空字符串"
}"""

SCENE_SUMMARY_OUTPUT_SCHEMA = """{
  "description": "1-3句中文场景梗概，突出空间样貌、关键陈设、剧情作用与可视化氛围",
  "time_setting": "清晨/白天/黄昏/夜晚/雨夜等时间设定，未提及则为空字符串",
  "atmosphere": "空间情绪、环境音、光线气质等，未提及则为空字符串",
  "scene_type": "室内/室外/自然空间/公共空间/私人空间等，未提及则为空字符串"
}"""

CHARACTER_FIELD_EXTRACT_PROMPT = f"""你是一位影视角色设定整理助手。请根据角色名称和角色描述性梗概，提取适合主体编辑页展示与修改的结构化信息。

输出严格的 JSON 格式，不要包含任何其他文字：
{CHARACTER_FIELD_OUTPUT_SCHEMA}

规则：
- 只基于给定信息提取，不要编造
- 输出尽量精炼，便于前端继续人工编辑
- `prompt` 必须更像给生图模型的中文提示词，而不是复述字段名
- `prompt` 必须明确为单个角色主体图，使用纯白色背景，不要场景环境、不要其他人物、不要多余道具干扰
- 若信息不明确，对应字段返回空字符串"""

SCENE_FIELD_EXTRACT_PROMPT = f"""你是一位影视场景设定整理助手。请根据场景名称和场景描述性梗概，提取适合主体编辑页展示与修改的结构化信息。

输出严格的 JSON 格式，不要包含任何其他文字：
{SCENE_FIELD_OUTPUT_SCHEMA}

规则：
- 只基于给定信息提取，不要编造
- 输出尽量精炼，便于前端继续人工编辑
- `prompt` 必须更像给生图模型的中文提示词，而不是复述字段名
- `prompt` 必须明确这是纯场景图，不要生成人物、不要角色入镜、不要人形剪影或群演，只保留场景空间与陈设
- 若信息不明确，对应字段返回空字符串"""

PROP_FIELD_EXTRACT_PROMPT = f"""你是一位影视道具设定整理助手。请根据道具名称和道具描述性梗概，提取适合主体编辑页展示与修改的结构化信息。

输出严格的 JSON 格式，不要包含任何其他文字：
{PROP_FIELD_OUTPUT_SCHEMA}

规则：
- 只基于给定信息提取，不要编造
- 输出尽量精炼，便于前端继续人工编辑
- `prompt` 必须更像给生图模型的中文提示词，而不是复述字段名
- `prompt` 必须尽量只保留单个道具物品本身，按主视图/主角度描述，不要人物、不手持、不出现复杂环境或其他杂物
- 若信息不明确，对应字段返回空字符串"""

SCENE_SUMMARY_EXTRACT_PROMPT = f"""你是一位影视场景拆解助手。请从剧本中只抽取“目标场景”的描述性梗概信息，用于主体页场景卡片的描述框。

输出严格的 JSON 格式，不要包含任何其他文字：
{SCENE_SUMMARY_OUTPUT_SCHEMA}

规则：
- 只围绕目标场景输出，不要总结整集剧情
- `description` 必须是 1-3 句中文，可直接给美术、分镜或提示词编辑继续使用
- `description` 重点写清：空间样貌、关键陈设、该场景在这段戏里的叙事作用、可感知氛围
- 若剧本只间接提到该场景，也只能基于已有信息谨慎概括，不能编造不存在的细节
- `time_setting` / `atmosphere` / `scene_type` 尽量提取，没有依据就返回空字符串
- 不要输出 markdown，不要解释说明"""


def _compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _extract_json_content(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()

    if cleaned.startswith("{") and cleaned.endswith("}"):
        return cleaned

    start_index = cleaned.find("{")
    end_index = cleaned.rfind("}")
    if start_index != -1 and end_index != -1 and end_index > start_index:
        return cleaned[start_index : end_index + 1]
    return cleaned


def _normalize_optional_text(value: object) -> str | None:
    text = _compact_whitespace(str(value or ""))
    return text or None


def _truncate_text(value: str | None, limit: int) -> str | None:
    text = _normalize_optional_text(value)
    if not text:
        return None
    return text if len(text) <= limit else text[:limit].rstrip()


def _join_prompt_parts(parts: list[str]) -> str | None:
    deduped: list[str] = []
    seen: set[str] = set()
    for part in parts:
        normalized = _compact_whitespace(part)
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)
    return "，".join(deduped) or None


def _build_character_prompt(item: dict) -> str | None:
    return _join_prompt_parts(
        [
            item.get("name"),
            item.get("role"),
            item.get("description"),
            item.get("appearance"),
            item.get("personality"),
            item.get("age"),
            item.get("gender"),
            item.get("background"),
            "影视角色设定图",
            "单人主体",
            "人物主体明确",
            "细节清晰",
            "纯白色背景",
            "无场景环境",
            "无其他人物",
        ]
    )


def _build_scene_prompt(item: dict) -> str | None:
    return _join_prompt_parts(
        [
            item.get("time"),
            item.get("scene_type"),
            item.get("name"),
            item.get("description"),
            item.get("atmosphere"),
            "影视化场景概念图",
            "纯场景空间",
            "空间层次清晰",
            "环境细节丰富",
            "光影明确",
            "场景内不出现人物",
            "无人空镜",
        ]
    )


def _build_prop_prompt(item: dict) -> str | None:
    owner = item.get("owner")
    importance = item.get("importance")
    return _join_prompt_parts(
        [
            item.get("name"),
            item.get("description"),
            f"关联主体{owner}" if owner else "",
            f"重要度{importance}" if importance else "",
            "影视道具设定图",
            "单个道具主体",
            "主视图",
            "主体居中",
            "材质细节清晰",
            "纯白色背景",
            "仅保留道具物品",
            "无人物无手持",
        ]
    )


def _normalize_subject_items(items: object, fields: list[str]) -> list[dict]:
    if not isinstance(items, list):
        return []

    normalized: list[dict] = []
    seen_names: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        name = _normalize_optional_text(item.get("name"))
        if not name:
            continue
        normalized_key = name.strip().lower()
        if normalized_key in seen_names:
            continue
        seen_names.add(normalized_key)

        record = {"name": name}
        for field in fields:
            if field == "name":
                continue
            record[field] = _normalize_optional_text(item.get(field))
        normalized.append(record)
    return normalized


def _normalize_extracted_subjects(payload: object) -> dict:
    if not isinstance(payload, dict):
        return {"characters": [], "scenes": [], "props": []}

    characters = _normalize_subject_items(
        payload.get("characters"),
        ["name", "role", "description", "appearance", "personality", "age", "gender", "background", "prompt"],
    )
    scenes = _normalize_subject_items(
        payload.get("scenes"),
        ["name", "description", "time", "atmosphere", "scene_type", "prompt"],
    )
    props = _normalize_subject_items(
        payload.get("props"),
        ["name", "description", "owner", "importance", "prompt"],
    )

    for item in characters:
        item["prompt"] = item.get("prompt") or _build_character_prompt(item)
    for item in scenes:
        item["prompt"] = item.get("prompt") or _build_scene_prompt(item)
    for item in props:
        item["prompt"] = item.get("prompt") or _build_prop_prompt(item)

    return {
        "characters": characters,
        "scenes": scenes,
        "props": props,
    }


def _normalize_subject_field_payload(subject_type: str, payload: object) -> dict:
    if not isinstance(payload, dict):
        payload = {}

    if subject_type == "character":
        fields = ["role", "appearance", "personality", "age", "gender", "background", "prompt"]
    elif subject_type == "scene":
        fields = ["scene_type", "time_setting", "atmosphere", "prompt"]
    elif subject_type == "prop":
        fields = ["importance", "prompt"]
    else:
        fields = []

    normalized = {}
    for field in fields:
        normalized[field] = _normalize_optional_text(payload.get(field))
    return normalized


def _normalize_scene_summary_payload(payload: object) -> dict:
    if not isinstance(payload, dict):
        return {}

    return {
        "description": _truncate_text(payload.get("description"), 300),
        "time_setting": _normalize_optional_text(payload.get("time_setting") or payload.get("time")),
        "atmosphere": _normalize_optional_text(payload.get("atmosphere")),
        "scene_type": _normalize_optional_text(payload.get("scene_type") or payload.get("sceneType")),
    }


def _build_extract_user_prompt(script_content: str, mode: str) -> str:
    mode_guidance = (
        "当前任务：分集级主体拆解。请更关注这一集里真实出场、真实发生、真实被使用的主体。"
        if mode != "global"
        else "当前任务：项目级主体拆解。请综合整部剧本，保留可长期复用的核心主体，不要被一次性路人和临时背景干扰。"
    )
    return (
        f"{mode_guidance}\n"
        "请严格依据上面的 skills 层规则执行，先做剧情分段，再抽取角色、场景、道具，并输出完整 JSON。\n\n"
        "待拆解剧本：\n"
        f"{script_content}"
    )


async def extract_subjects(
    script_content: str,
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    model: str | None = None,
    mode: str = "episode",
) -> dict:
    if not script_content or not script_content.strip():
        return {"characters": [], "scenes": [], "props": []}

    system_prompt = GLOBAL_EXTRACT_SYSTEM_PROMPT if mode == "global" else EXTRACT_SYSTEM_PROMPT
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": _build_extract_user_prompt(script_content, mode)},
    ]

    result = await llm_service.chat_completion(
        messages=messages,
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.3,
    )
    content = result["choices"][0]["message"]["content"]
    payload = json.loads(_extract_json_content(content))
    return _normalize_extracted_subjects(payload)


async def extract_subject_fields(
    *,
    subject_type: str,
    name: str | None,
    description: str,
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    model: str | None = None,
) -> dict:
    cleaned_description = _compact_whitespace(description)
    if not cleaned_description:
        return {}

    if subject_type == "character":
        system_prompt = CHARACTER_FIELD_EXTRACT_PROMPT
    elif subject_type == "scene":
        system_prompt = SCENE_FIELD_EXTRACT_PROMPT
    elif subject_type == "prop":
        system_prompt = PROP_FIELD_EXTRACT_PROMPT
    else:
        raise ValueError(f"不支持的主体类型: {subject_type}")

    user_prompt = (
        f"主体类型：{subject_type}\n"
        f"主体名称：{_compact_whitespace(name or '') or '未命名主体'}\n"
        "请基于以下描述性梗概提取结构化字段，不要编造没有依据的信息：\n"
        f"{cleaned_description}"
    )

    result = await llm_service.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.2,
        max_tokens=600,
    )
    content = result["choices"][0]["message"]["content"]
    payload = json.loads(_extract_json_content(content))
    normalized = _normalize_subject_field_payload(subject_type, payload)

    # When the model omits prompt, fall back to a deterministic prompt built
    # from the extracted fields so the frontend prompt box still receives a
    # script-aligned value instead of dropping back to the short description.
    item = {
        "name": _normalize_optional_text(name),
        "description": cleaned_description,
        **normalized,
    }
    if subject_type == "character":
        normalized["prompt"] = normalized.get("prompt") or _build_character_prompt(item)
    elif subject_type == "scene":
        item["time"] = normalized.get("time_setting")
        normalized["prompt"] = normalized.get("prompt") or _build_scene_prompt(item)
    elif subject_type == "prop":
        normalized["prompt"] = normalized.get("prompt") or _build_prop_prompt(item)

    return normalized


async def extract_scene_summary_from_script(
    *,
    scene_name: str | None,
    script_content: str,
    existing_description: str | None = None,
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    model: str | None = None,
) -> dict:
    cleaned_script = _compact_whitespace(script_content)
    if not cleaned_script:
        return {}

    user_prompt = (
        "请从以下剧本中，针对目标场景抽取描述性梗概。\n"
        f"目标场景名称：{_compact_whitespace(scene_name or '') or '未命名场景'}\n"
        f"当前已有描述：{_compact_whitespace(existing_description or '') or '无'}\n\n"
        "请重点关注该场景在剧本中的出现片段、空间特征、时间氛围和剧情作用。\n"
        "如果剧本里没有明确对应信息，请尽量保守概括，不要补充剧本中不存在的设定。\n\n"
        "剧本内容：\n"
        f"{script_content}"
    )

    result = await llm_service.chat_completion(
        messages=[
            {"role": "system", "content": SCENE_SUMMARY_EXTRACT_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.2,
        max_tokens=800,
    )
    content = result["choices"][0]["message"]["content"]
    payload = json.loads(_extract_json_content(content))
    return _normalize_scene_summary_payload(payload)
