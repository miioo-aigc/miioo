from collections import defaultdict
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_config import ModelConfig
from app.models.provider import ApiProvider

ONECLICK_PROVIDER_NAME = "OneLinkAI"
ONECLICK_BASE_URL = "https://api.onelinkai.cloud"
ONECLICK_SEEDANCE_15_PRO_MODEL_ID = "doubao-seedance-1.5-pro"
ONECLICK_SEEDANCE_2_MODEL_ID = "doubao-seedance-2.0"
ONECLICK_SEEDANCE_2_FAST_MODEL_ID = "doubao-seedance-2-0-fast"
ONECLICK_LEGACY_COMPAT_MODEL_IDS = {
    "tts-1",
    "doubao-seedance-2.0-260128",
    "doubao-seedance-2.0-fast",
    "doubao-seedance-2.0-fast-v1",
    "doubao-seedance-2.0-fast-260128",
}
ONECLICK_PRESET_MODELS = [
    # 恢复 OneLinkAI chat 预置；图片/视频仍按当前收口策略仅保留指定入口。
    {"name": "GPT-4o 全能对话", "model_id": "gpt-4o", "category": "chat", "description": "剧本生成 / 主体提取 / 分镜拆分", "is_default": True},
    {"name": "DeepSeek-V4-Pro 深度推理", "model_id": "deepseek-v4-pro", "category": "chat", "description": "文本生成 / 长内容推理", "is_default": False},
    {"name": "DeepSeek-V4-Flash 快速对话", "model_id": "deepseek-v4-flash", "category": "chat", "description": "文本生成 / 低延迟快速响应", "is_default": False},
    {"name": "GLM-5.1 通用对话", "model_id": "GLM-5.1", "category": "chat", "description": "文本生成 / 通用对话与创作", "is_default": False},
    {"name": "MIMO-V2-Pro 创作推理", "model_id": "mimo-v2-pro", "category": "chat", "description": "文本生成 / 创意写作与推理", "is_default": False},
    {"name": "MiniMax-M2.7 长文模型", "model_id": "minimax-m2.7", "category": "chat", "description": "文本生成 / 长上下文与综合问答", "is_default": False},
    {"name": "MiniMax-M3 文本模型", "model_id": "minimax-m3", "category": "chat", "description": "文本生成 / OneLinkAI OpenAI 兼容 chat completions / 适合长文创作与综合推理", "is_default": False},
    {"name": "Gemini-3.5-Flash 快速对话", "model_id": "gemini-3.5-flash", "category": "chat", "description": "文本生成 / OneLinkAI OpenAI 兼容 chat completions / 适合快速问答与流式输出", "is_default": False},
    {"name": "Step-3.5-Flash 轻量对话", "model_id": "step-3.5-flash", "category": "chat", "description": "文本生成 / 轻量快速对话", "is_default": False},
    {"name": "豆包 Seed 2.0 Lite", "model_id": "doubao-seed-2.0-lite-260215", "category": "chat", "description": "文本生成 / 豆包轻量文本模型", "is_default": False},
    {"name": "豆包 Seed 2.0 Pro", "model_id": "doubao-seed-2.0-pro-260215", "category": "chat", "description": "文本生成 / 豆包高质量文本模型", "is_default": False},
    {"name": "Qwen 3.7 Max 旗舰对话", "model_id": "qwen3.7-max", "category": "chat", "description": "文本生成 / OneLinkAI OpenAI 兼容 chat completions / 适合通用对话与创作推理", "is_default": False},
    {"name": "Qwen 3.7 Plus 通用对话", "model_id": "qwen3.7-plus", "category": "chat", "description": "文本生成 / OneLinkAI OpenAI 兼容 chat completions / 适合通用问答、创作与流式输出", "is_default": False},
    {"name": "Qwen Long 长文本", "model_id": "qwen-long", "category": "chat", "description": "文本生成 / 长上下文处理", "is_default": False},
    {"name": "Kimi K2 Thinking 思维链", "model_id": "kimi-k2-thinking", "category": "chat", "description": "文本生成 / 深度思考与复杂推理", "is_default": False},
    {"name": "豆包·Seedream 5.0", "model_id": "doubao-seedream-5.0-lite", "category": "image", "description": "图像生成 / 文生图、单图/多图参考生图、文生/参考组图 / 最多 14 张参考图且参考图+生成图<=15 / 推荐默认", "is_default": True},
    # 临时注释其余图片模型，仅保留 Seedream 5.0。
    # {"name": "豆包·Seedream 4.5", "model_id": "doubao-seedream-4.5", "category": "image", "description": "图像生成 / 文生图、单图/多图参考生图、文生/参考组图 / 最多 14 张参考图且参考图+生成图<=15 / 高画质细节", "is_default": False},
    # {"name": "豆包·Seedream 4.0", "model_id": "doubao-seedream-4.0", "category": "image", "description": "图像生成 / 文生图、单图/多图参考生图、文生/参考组图 / 最多 14 张参考图且参考图+生成图<=15 / 基础版", "is_default": False},
    # {"name": "GPT-Image 2 生图", "model_id": "gpt-image-2", "category": "image", "description": "图像生成 / 通过新版兼容接口透传 image_urls / 多图参考上限待联调核实", "is_default": False},
    # {"name": "Gemini 3.1 Flash 生图", "model_id": "gemini-3.1-flash-image-preview", "category": "image", "description": "图像生成 / 走 Gemini generateContent / 参考图转 inlineData / 上限待联调核实", "is_default": False},
    # {"name": "Nano Banana 2 Pro 生图", "model_id": "nano-banana-2-pro", "category": "image", "description": "图像生成 / 已接入 Gemini generateContent 链路 / 参考图转 inlineData / 上限待联调核实", "is_default": False},
    # {"name": "Nano Banana 2 生图", "model_id": "nano-banana-2", "category": "image", "description": "图像生成 / 已接入 Gemini generateContent 链路 / 参考图转 inlineData / 上限待联调核实", "is_default": False},
    # {"name": "Kling V3 图像生成", "model_id": "image-kling-v3", "category": "image", "description": "图像生成 / 文生图、多图参考生图共用同一真实模型名 / 当前页面按能力收敛输入", "is_default": False},
    # {"name": "Kling V3 图像 Omni", "model_id": "image-kling-v3-omni", "category": "image", "description": "图像生成 / 对接 OneLinkAI Kling 图像 Omni 接口 / 单图参考改写", "is_default": False},
    # {"name": "Vidu Q2图像生成", "model_id": "image-vidu-q2", "category": "image", "description": "图像生成 / prompt-only 与参考图模式共用 reference2image 入口 / 参考图上限待联调核实", "is_default": False},
    # 临时注释其余视频模型，仅保留 Seedance 2.0 / Fast 两个入口。
    # {"name": "豆包·Seedance 1.5 Pro", "model_id": ONECLICK_SEEDANCE_15_PRO_MODEL_ID, "category": "video", "description": "视频生成 / Seedance 1.5 Pro / 文生、图生、首尾帧 / 原生音视频同步 / 4-12 秒", "is_default": False},
    {"name": "豆包·Seedance 2.0", "model_id": ONECLICK_SEEDANCE_2_MODEL_ID, "category": "video", "description": "视频生成 / 官方 2.0 系列主模型 / 文生、首帧、首尾帧、多模态参考、视频编辑、延长视频 / 4-15 秒", "is_default": True},
    {"name": "豆包·Seedance 2.0 Fast", "model_id": ONECLICK_SEEDANCE_2_FAST_MODEL_ID, "category": "video", "description": "视频生成 / 官方 2.0 Fast / 能力类型与 2.0 一致 / 更快更省 / Fast 版分辨率上限 720P", "is_default": False},
    # {"name": "Kling V3 视频生成", "model_id": "video-kling-v3", "category": "video", "description": "视频生成 / 文生、图生、多图参考共用同一真实模型名 / 当前页面按能力收敛输入", "is_default": False},
    # {"name": "Kling V3 视频 Omni", "model_id": "video-kling-v3-omni", "category": "video", "description": "视频生成 / 对接 OneLinkAI Kling 视频 Omni 接口 / 参考视频驱动", "is_default": False},
    # {"name": "Vidu Q3 Pro 生视频", "model_id": "video-viduq3-pro", "category": "video", "description": "视频生成 / 文生、图生、首尾帧 / Q3 主力模型 / 1-16 秒", "is_default": False},
    # {"name": "Vidu Q2 Turbo 多帧视频", "model_id": "vidu-q2-turbo", "category": "video", "description": "视频生成 / 智能多帧 / Q2 Turbo", "is_default": False},
    # {"name": "Vidu Q2 多帧视频", "model_id": "video-vidu-q2", "category": "video", "description": "视频生成 / 智能多帧 / Q2 基础版", "is_default": False},
    # 临时隐藏 Veo 模型入口；保留注释便于后续随时恢复。
    # {"name": "Veo 3.1 生视频", "model_id": "veo-3.1-generate-preview", "category": "video", "description": "视频生成 / OneLinkAI Gemini 兼容 / 文生、图生、首尾帧、多参考图 / 4-8 秒", "is_default": False},
    # {"name": "HappyHorse 文生视频", "model_id": "happyhorse-1.0-t2v", "category": "video", "description": "视频生成 / HappyHorse 文生视频 / 3-15 秒", "is_default": False},
    # {"name": "HappyHorse 图生视频", "model_id": "happyhorse-1.0-i2v", "category": "video", "description": "视频生成 / HappyHorse 首帧图生视频 / 3-15 秒", "is_default": False},
    # {"name": "HappyHorse 参考生视频", "model_id": "happyhorse-1.0-r2v", "category": "video", "description": "视频生成 / HappyHorse 多图参考生视频 / 3-15 秒", "is_default": False},
    # {"name": "HappyHorse 视频编辑", "model_id": "happyhorse-1.0-video-edit", "category": "video", "description": "视频生成 / HappyHorse 视频编辑 / 输入视频 + 可选参考图", "is_default": False},
]


def _model_sort_key(model: ModelConfig, preset_keys: set[tuple[str, str]]) -> tuple[int, int, int, datetime]:
    return (
        1 if (model.category, model.model_id) in preset_keys else 0,
        1 if model.is_default else 0,
        1 if model.is_enabled else 0,
        model.created_at or datetime.min,
    )


async def sync_onelink_preset_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> list[ModelConfig]:
    synced_models: list[ModelConfig] = []
    unsupported_model_ids: set[str] = set()
    existing_categories: set[str] = set()

    existing_models_result = await db.execute(
        select(ModelConfig).where(
            and_(
                ModelConfig.user_id == user_id,
                ModelConfig.provider_id == provider.id,
            )
        )
    )
    existing_provider_models = existing_models_result.scalars().all()
    for existing_model in existing_provider_models:
        existing_categories.add(existing_model.category)

    for preset in ONECLICK_PRESET_MODELS:
        stmt = (
            select(ModelConfig)
            .where(
                and_(
                    ModelConfig.user_id == user_id,
                    ModelConfig.provider_id == provider.id,
                    ModelConfig.category == preset["category"],
                    ModelConfig.model_id == preset["model_id"],
                )
            )
            .limit(1)
        )
        existing = await db.execute(stmt)
        model = existing.scalar_one_or_none()

        if model:
            model.name = preset["name"]
            model.description = preset["description"]
        else:
            model = ModelConfig(
                provider_id=provider.id,
                user_id=user_id,
                name=preset["name"],
                model_id=preset["model_id"],
                category=preset["category"],
                description=preset["description"],
                is_enabled=True,
                is_default=False,
            )
            db.add(model)

        synced_models.append(model)

    default_model_ids = {
        preset["category"]: preset["model_id"]
        for preset in ONECLICK_PRESET_MODELS
        if preset.get("is_default")
    }

    for category, model_id in default_model_ids.items():
        result = await db.execute(
            select(ModelConfig).where(
                and_(
                    ModelConfig.user_id == user_id,
                    ModelConfig.category == category,
                    ModelConfig.is_default == True,
                )
            )
        )
        current_defaults = result.scalars().all()
        if current_defaults:
            continue
        if category in existing_categories:
            continue

        for model in synced_models:
            if model.category == category and model.model_id == model_id:
                model.is_default = True
                model.is_enabled = True
                break

    unsupported_result = await db.execute(
        select(ModelConfig).where(
            and_(
                ModelConfig.user_id == user_id,
                ModelConfig.provider_id == provider.id,
                ModelConfig.model_id.in_(unsupported_model_ids),
            )
        )
    )
    for unsupported_model in unsupported_result.scalars().all():
        unsupported_model.is_enabled = False
        unsupported_model.is_default = False

    await disable_onelink_legacy_compat_models(db, user_id, provider)
    return synced_models


async def disable_onelink_legacy_compat_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> dict[str, int]:
    result = await db.execute(
        select(ModelConfig).where(
            and_(
                ModelConfig.user_id == user_id,
                ModelConfig.provider_id == provider.id,
                ModelConfig.model_id.in_(ONECLICK_LEGACY_COMPAT_MODEL_IDS),
            )
        )
    )
    legacy_models = result.scalars().all()

    disabled_count = 0
    for model in legacy_models:
        changed = False
        if model.is_enabled:
            model.is_enabled = False
            changed = True
        if model.is_default:
            model.is_default = False
            changed = True
        if changed:
            disabled_count += 1

    return {
        "disabled_count": disabled_count,
        "matched_count": len(legacy_models),
    }


async def cleanup_onelink_legacy_models(
    db: AsyncSession,
    user_id: UUID,
    provider: ApiProvider,
) -> dict[str, int]:
    preset_keys = {
        (preset["category"], preset["model_id"])
        for preset in ONECLICK_PRESET_MODELS
    }
    result = await db.execute(
        select(ModelConfig).where(
            and_(
                ModelConfig.user_id == user_id,
                ModelConfig.provider_id == provider.id,
            )
        )
    )
    provider_models = result.scalars().all()

    grouped_models: dict[tuple[str, str], list[ModelConfig]] = defaultdict(list)
    for model in provider_models:
        grouped_models[(model.category, model.model_id)].append(model)

    removed_legacy_count = 0
    removed_duplicate_count = 0

    for key, models in grouped_models.items():
        if key not in preset_keys:
            for model in models:
                await db.delete(model)
                removed_legacy_count += 1
            continue

        if len(models) <= 1:
            continue

        keeper = max(models, key=lambda model: _model_sort_key(model, preset_keys))
        keeper.is_enabled = any(model.is_enabled for model in models)
        keeper.is_default = any(model.is_default for model in models)
        keeper.description = keeper.description or next(
            (model.description for model in models if model.description),
            None,
        )

        for model in models:
            if model.id == keeper.id:
                continue
            await db.delete(model)
            removed_duplicate_count += 1

    return {
        "removed_count": removed_legacy_count + removed_duplicate_count,
        "removed_legacy_count": removed_legacy_count,
        "removed_duplicate_count": removed_duplicate_count,
    }
