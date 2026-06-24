SCRIPT_SYSTEM_PROMPT = """你是一位专业的影视编剧助手。根据用户的创意描述，生成结构化的剧本内容。

输出格式要求：
- 使用 Markdown 格式
- 包含集数标题、本集梗概、主要人物、场景列表
- 正文中用 **【场景X】** 标记场景切换
- 用 **角色名：** 标记对话
- 用 *（旁白）* 标记旁白
- 用 `[镜头提示]` 标记镜头建议

根据项目设定与视觉风格调整整体表达。"""

SCRIPT_LLM_TIMEOUT_SECONDS = 500.0


async def generate_script(
    prompt: str,
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    project_name: str = "",
    visual_style: str = "",
    episode_title: str = "",
    episode_number: int = 1,
    model: str | None = None,
) -> str:
    from app.services.llm import llm_service

    context = f"""项目：{project_name}
视觉风格提示：{visual_style}
当前集数：第{episode_number}集 - {episode_title}"""

    messages = [
        {"role": "system", "content": SCRIPT_SYSTEM_PROMPT},
        {"role": "user", "content": f"{context}\n\n用户创意：{prompt}"},
    ]

    result = await llm_service.chat_completion(
        messages=messages,
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.8,
        timeout=SCRIPT_LLM_TIMEOUT_SECONDS,
    )
    return result["choices"][0]["message"]["content"]


async def stream_generate_script(
    prompt: str,
    api_key: str,
    base_url: str = "https://api.onelinkai.cloud",
    project_name: str = "",
    visual_style: str = "",
    episode_title: str = "",
    episode_number: int = 1,
    model: str | None = None,
):
    from app.services.llm import llm_service

    context = f"""项目：{project_name}
视觉风格提示：{visual_style}
当前集数：第{episode_number}集 - {episode_title}"""

    messages = [
        {"role": "system", "content": SCRIPT_SYSTEM_PROMPT},
        {"role": "user", "content": f"{context}\n\n用户创意：{prompt}"},
    ]

    async for chunk in llm_service.stream_chat_completion(
        messages=messages,
        api_key=api_key,
        base_url=base_url,
        model=model,
        temperature=0.8,
        timeout=SCRIPT_LLM_TIMEOUT_SECONDS,
    ):
        yield chunk
