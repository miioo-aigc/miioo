from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.minimax import (
    MinimaxAsyncTaskCreateResponse,
    MinimaxAsyncTaskQueryResponse,
    MinimaxAsyncT2ARequest,
    MinimaxFileUploadResponse,
    MinimaxT2ARequest,
    MinimaxT2AResponse,
    MinimaxVoiceCloneRequest,
    MinimaxVoiceCloneResponse,
    MinimaxVoiceDesignRequest,
    MinimaxVoiceDesignResponse,
    MinimaxVoiceQueryRequest,
    MinimaxVoiceQueryResponse,
)
from app.services.minimax_voice_runtime import (
    clone_minimax_voice,
    create_minimax_async_tts_task,
    design_minimax_voice,
    extract_minimax_async_audio_result,
    extract_minimax_clone_result,
    extract_minimax_tts_result,
    extract_minimax_voice_design_result,
    generate_minimax_tts,
    get_minimax_provider_runtime,
    normalize_minimax_voice_query_result,
    query_minimax_async_tts_task,
    query_minimax_voices,
    upload_minimax_file,
)

router = APIRouter()


async def _get_runtime(user: User, db: AsyncSession):
    try:
        runtime = await get_minimax_provider_runtime(user.id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not runtime:
        raise HTTPException(status_code=400, detail="当前未启用 MiniMax 官方服务商，请先在 API 配置中完成配置")
    return runtime


def _extract_uploaded_file_id(payload: dict) -> str:
    file_obj = payload.get("file") or {}
    file_id = file_obj.get("file_id") or payload.get("file_id") or (payload.get("data") or {}).get("file_id")
    if not file_id:
        raise HTTPException(status_code=502, detail="MiniMax 文件上传成功但未返回 file_id")
    return str(file_id)


@router.post(
    "/t2a",
    response_model=MinimaxT2AResponse,
    summary="执行 MiniMax 官方同步配音",
    description="通过当前登录用户已配置的 MiniMax 官方 provider 执行一次同步文本转语音，适合短文本即时生成场景。",
    response_description="同步配音结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "model": "speech-2.8-hd",
                        "text": "欢迎来到 miioo 创作工作台。",
                        "voice_setting": {
                            "voice_id": "male-qn-qingse",
                            "speed": 1.0,
                            "emotion": "happy",
                        },
                        "audio_setting": {
                            "sample_rate": 32000,
                            "format": "mp3",
                        },
                    }
                }
            }
        }
    },
)
async def minimax_t2a(
    req: MinimaxT2ARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    payload = req.model_dump(exclude_none=True)
    try:
        result = await generate_minimax_tts(runtime, payload)
        return MinimaxT2AResponse(**extract_minimax_tts_result(result, req.text))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 同步配音失败: {str(exc)}") from exc


@router.post(
    "/t2a/async",
    response_model=MinimaxAsyncTaskCreateResponse,
    summary="创建 MiniMax 官方异步配音任务",
    description="通过 MiniMax 官方异步配音接口创建长文本任务，适合较长文案或需要离线轮询结果的场景。",
    response_description="异步配音任务创建结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "model": "speech-2.8-hd",
                        "text": "这是一段需要异步生成的长文本内容。",
                        "voice_setting": {
                            "voice_id": "male-qn-qingse",
                            "speed": 1.0,
                        },
                    }
                }
            }
        }
    },
)
async def minimax_t2a_async(
    req: MinimaxAsyncT2ARequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    payload = req.model_dump(exclude_none=True)
    try:
        result = await create_minimax_async_tts_task(runtime, payload)
        return MinimaxAsyncTaskCreateResponse(
            task_id=str(result.get("task_id") or ""),
            task_token=result.get("task_token"),
            file_id=str(result.get("file_id")) if result.get("file_id") is not None else None,
            raw_payload=result,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 异步配音任务创建失败: {str(exc)}") from exc


@router.get(
    "/t2a/async/{task_id}",
    response_model=MinimaxAsyncTaskQueryResponse,
    summary="查询 MiniMax 官方异步配音任务",
    description="根据任务 ID 查询 MiniMax 官方异步配音任务的当前状态，并在完成后返回音频地址与文件信息。",
    response_description="异步配音任务状态。",
)
async def minimax_t2a_async_query(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    try:
        result = await query_minimax_async_tts_task(runtime, task_id)
        return MinimaxAsyncTaskQueryResponse(**extract_minimax_async_audio_result(result))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 异步配音任务查询失败: {str(exc)}") from exc


@router.post(
    "/files/upload",
    response_model=MinimaxFileUploadResponse,
    summary="上传 MiniMax 官方文件",
    description="上传文本或音频文件到 MiniMax 官方文件服务，供异步配音、音色复刻等场景继续引用。",
    response_description="上传后的文件 ID。",
)
async def minimax_upload_file(
    file: UploadFile = File(...),
    purpose: str = Form("voice_clone"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    try:
        payload = await upload_minimax_file(
            runtime,
            file_name=file.filename or "upload.bin",
            file_bytes=await file.read(),
            purpose=purpose,
            content_type=file.content_type or "application/octet-stream",
        )
        return MinimaxFileUploadResponse(
            file_id=_extract_uploaded_file_id(payload),
            raw_payload=payload,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 文件上传失败: {str(exc)}") from exc


@router.post(
    "/voices/clone",
    response_model=MinimaxVoiceCloneResponse,
    summary="执行 MiniMax 官方音色复刻",
    description="基于已上传的参考音频文件发起 MiniMax 官方音色复刻，并返回新音色 ID、试听地址和过期时间等信息。",
    response_description="音色复刻结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "file_id": "file_1234567890",
                        "voice_id": "voice_demo_001",
                        "text": "请用这个音色生成一段示例语音。",
                        "model": "speech-2.8-hd",
                        "language_boost": "Chinese",
                    }
                }
            }
        }
    },
)
async def minimax_clone_voice(
    req: MinimaxVoiceCloneRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    try:
        result = await clone_minimax_voice(
            runtime,
            source_file_id=str(req.file_id),
            target_voice_id=req.voice_id,
            prompt_file_id=str(req.clone_prompt.prompt_audio) if req.clone_prompt else None,
            prompt_text=req.clone_prompt.prompt_text if req.clone_prompt else None,
            text=req.text,
            model=req.model,
            language_boost=req.language_boost,
            need_noise_reduction=req.need_noise_reduction,
            need_volume_normalization=req.need_volume_normalization,
            aigc_watermark=req.aigc_watermark,
        )
        normalized = extract_minimax_clone_result(result, req.voice_id)
        return MinimaxVoiceCloneResponse(
            voice_id=normalized["voice_id"],
            preview_url=normalized["preview_url"],
            expires_at=normalized["expires_at"].isoformat() if normalized.get("expires_at") else None,
            trace_id=normalized.get("trace_id"),
            raw_payload=normalized["raw_payload"],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 音色复刻失败: {str(exc)}") from exc


@router.post(
    "/voices/design",
    response_model=MinimaxVoiceDesignResponse,
    summary="执行 MiniMax 官方音色设计",
    description="根据文字描述生成一个新的 MiniMax 官方设计音色，并返回预览信息，适合快速创建风格化声音。",
    response_description="音色设计结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "prompt": "温柔知性的中文女声，适合故事旁白",
                        "preview_text": "今天的故事，从这里开始。",
                        "voice_id": "voice_design_demo",
                    }
                }
            }
        }
    },
)
async def minimax_design_voice(
    req: MinimaxVoiceDesignRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    try:
        result = await design_minimax_voice(
            runtime,
            prompt=req.prompt,
            preview_text=req.preview_text,
            voice_id=req.voice_id,
            aigc_watermark=req.aigc_watermark,
        )
        return MinimaxVoiceDesignResponse(**extract_minimax_voice_design_result(result))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 音色设计失败: {str(exc)}") from exc


@router.post(
    "/voices/query",
    response_model=MinimaxVoiceQueryResponse,
    summary="查询 MiniMax 官方音色列表",
    description="查询当前账号在 MiniMax 官方侧可用的系统音色、复刻音色和文生音色，供前端音色弹窗选择。",
    response_description="音色列表查询结果。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "voice_type": "all",
                    }
                }
            }
        }
    },
)
async def minimax_query_voices(
    req: MinimaxVoiceQueryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runtime = await _get_runtime(user, db)
    try:
        result = await query_minimax_voices(runtime, voice_type=req.voice_type)
        return MinimaxVoiceQueryResponse(
            voices=normalize_minimax_voice_query_result(result),
            raw_payload=result,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MiniMax 音色查询失败: {str(exc)}") from exc
