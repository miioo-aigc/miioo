from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.llm import llm_service
from app.services.user_api_key import get_user_api_key

router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    temperature: float = 0.7
    max_tokens: int | None = None


@router.post(
    "/chat",
    summary="执行非流式聊天补全",
    description="调用当前用户已配置的通用 LLM 服务，执行一次同步聊天补全。适合普通文本生成、问答和摘要等场景。",
    response_description="模型返回的聊天补全结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "messages": [
                            {"role": "system", "content": "你是编剧助手"},
                            {"role": "user", "content": "帮我写一个短剧开头"},
                        ],
                        "model": "gpt-4.1",
                        "temperature": 0.7,
                        "max_tokens": 2000,
                    }
                }
            }
        }
    },
)
async def chat_completion(req: ChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data

    try:
        result = await llm_service.chat_completion(
            messages=[m.model_dump() for m in req.messages],
            api_key=api_key,
            base_url=base_url,
            model=req.model,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"模型调用失败: {str(e)}")


@router.post(
    "/chat/stream",
    summary="执行流式聊天补全",
    description="调用当前用户已配置的通用 LLM 服务，按 SSE 流式返回聊天补全过程，适合编辑器实时增量展示。",
    response_description="SSE 数据流，按 chunk 持续返回模型输出。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "messages": [
                            {"role": "system", "content": "你是编剧助手"},
                            {"role": "user", "content": "继续扩写这段剧情"},
                        ],
                        "model": "gpt-4.1",
                        "temperature": 0.7,
                        "max_tokens": 2000,
                    }
                }
            }
        }
    },
)
async def chat_stream(req: ChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data

    async def event_generator():
        try:
            async for chunk in llm_service.stream_chat_completion(
                messages=[m.model_dump() for m in req.messages],
                api_key=api_key,
                base_url=base_url,
                model=req.model,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            ):
                yield chunk
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get(
    "/models",
    summary="获取当前 LLM 服务可用模型列表",
    description="读取当前用户已配置 LLM 服务对应的可用模型清单，便于前端模型选择器动态展示真实模型。",
    response_description="可用模型 ID 列表。",
    responses={
        200: {
            "description": "读取成功",
            "content": {
                "application/json": {
                    "example": {
                        "models": ["gpt-4.1", "gpt-4o", "deepseek-v4-pro"],
                    }
                }
            },
        }
    },
)
async def list_models(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data

    try:
        models = await llm_service.list_models(api_key=api_key, base_url=base_url)
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"获取模型列表失败: {str(e)}")
