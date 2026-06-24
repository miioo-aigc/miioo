from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import ensure_runtime_schema_compatibility
from app.middleware import RequestContextMiddleware
from app.observability import initialize_logging
from app.services.background_runtime import ensure_background_runtime_ready, shutdown_background_jobs
from app.services.runtime_state import ensure_runtime_state_ready
from app.routers import auth, users, providers, models, projects, llm, episodes, subjects, upload, assets, storyboards, tasks, voices, audio_clips, video_clips, compositions, notifications, exports, images, user_styles, workbench, creation, project_scripts, minimax, api_config_banner, api_config_card_visibility, community_qr_config, reference_audio_library, project_templates, media_access
from app.utils.cors import build_allowed_origins

initialize_logging()

OPENAPI_DESCRIPTION = """
Miioo 后端 OpenAPI 契约文档。

适用对象：

- 另一版前端接入同学
- 当前仓库联调同学
- 后端补接口同学

使用约定：

- 所有业务接口统一前缀为 `/api`
- 绝大多数业务接口需要 `Authorization: Bearer <access_token>`
- 静态媒体通常返回 `/uploads/...` 相对路径，前端需要拼接服务域名访问
- 任务类接口请以前端轮询 `status` 终态为准，不要自行推断完成态

文档分工：

- `/docs` 与 `/openapi.json` 提供可调试、可生成 SDK 的接口契约
- `backend/BACKEND_API_DOC.md` 继续承接更完整的联调背景、页面闭环与注意事项
""".strip()

OPENAPI_TAGS = [
    {"name": "auth", "description": "登录、验证码登录、微信扫码登录、刷新 token、退出登录、获取当前用户。"},
    {"name": "users", "description": "个人资料维护，包括昵称头像更新、手机号换绑、微信绑定解绑与账号注销。"},
    {"name": "api-config-banner", "description": "API 配置弹窗推荐图区主图配置，普通用户可读、管理员可维护。"},
    {"name": "api-config-card-visibility", "description": "API 配置页内置服务商卡片展示开关，仅影响前端展示，不影响 provider 实际可用性。"},
    {"name": "community-qr-config", "description": "首页社群二维码配置，匿名可读，管理员可替换上传后的二维码图。"},
    {"name": "providers", "description": "服务商配置与内置一键 setup 能力，供 API 配置弹窗和模型能力初始化使用。"},
    {"name": "models", "description": "模型列表、启停、默认模型管理。前端通常按 `category` 读取可用模型。"},
    {"name": "project-templates", "description": "首页未登录项目模板只读展示接口，不进入真实项目工作流。"},
    {"name": "projects", "description": "项目列表、创建、详情、更新、概览与项目资产打包下载。"},
    {"name": "episodes", "description": "正式分集 CRUD 与分集级剧本生成。适用于剧本页已有正式分集后的链路。"},
    {"name": "project-script", "description": "主剧本工作区。用于整稿编辑、上传、AI 对话生成、拆分预览、定稿和历史版本恢复。"},
    {"name": "subjects", "description": "主体提取与主体 CRUD，包含角色、场景、道具及其参考图、生成图。"},
    {"name": "upload", "description": "正式分集剧本文档上传入口，用于把 txt/doc/docx 等文件解析写入对应分集内容。"},
    {"name": "assets", "description": "统一资产中心，覆盖资产列表、详情、创建、下载、批量删除与视频提帧/补缩略图。"},
    {"name": "storyboards", "description": "分镜 CRUD、排序、AI 生成、分镜图 / 分镜视频上传与生成。"},
    {"name": "tasks", "description": "通用任务中心，适用于任务列表、详情、取消、重试和视频任务状态查询。"},
    {"name": "reference-audio-library", "description": "系统参考音频库。用于沉淀可复用的参考音频素材，不等同于用户生成结果。"},
    {"name": "voices", "description": "音色列表、收藏、自定义音色与官方音色入口。"},
    {"name": "minimax", "description": "MiniMax 官方语音能力代理，包括同步/异步配音、文件上传、音色复刻与音色查询。"},
    {"name": "audio-clips", "description": "项目内配音片段接口，服务于分镜/剪辑阶段的项目级音频生成与管理。"},
    {"name": "video-clips", "description": "项目内视频片段接口，服务于分镜/剪辑阶段的视频生成与管理。"},
    {"name": "workbench", "description": "项目工作台图片能力，覆盖生成、上传、列表、收藏、删除、下载与任务轮询。"},
    {"name": "compositions", "description": "剪辑成片工程接口，覆盖工程列表、保存草稿、更新时间线与提交渲染。"},
    {"name": "notifications", "description": "消息中心接口，覆盖通知列表、未读数、单条已读、全部已读与删除。"},
    {"name": "exports", "description": "导出准备接口，可按显式资产列表或过滤条件生成导出文件清单。"},
    {"name": "llm", "description": "通用 LLM 中转入口，提供同步聊天、流式聊天和模型列表。"},
    {"name": "images", "description": "通用图片上传入口，常用于项目封面、二维码或其它非业务专属图片上传。"},
    {"name": "user-styles", "description": "用户视觉风格接口，覆盖内置风格选项聚合和自定义风格 CRUD。"},
    {"name": "creation", "description": "创作页统一入口，覆盖图片、视频、音频生成及其任务查询。"},
    {"name": "media-access", "description": "统一媒体受控下载入口，校验短时 token 后跳转到真实媒体地址。"},
]


def create_app() -> FastAPI:
    app = FastAPI(
        title="Miioo API",
        version="0.1.0",
        description=OPENAPI_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
    )
    allow_origins = build_allowed_origins(settings.CORS_ORIGINS)

    @app.on_event("startup")
    async def _ensure_runtime_schema_compatibility() -> None:
        import os
        if os.getenv("APP_ENV") != "production":
            await ensure_runtime_schema_compatibility()
        require_redis = settings.is_production and settings.REQUIRE_REDIS_IN_PRODUCTION
        await ensure_runtime_state_ready(require_redis=require_redis)
        await ensure_background_runtime_ready()

    @app.on_event("shutdown")
    async def _shutdown_background_runtime() -> None:
        await shutdown_background_jobs()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/users", tags=["users"])
    app.include_router(api_config_banner.router, prefix="/api/api-config/banner", tags=["api-config-banner"])
    app.include_router(api_config_card_visibility.router, prefix="/api/api-config/card-visibility", tags=["api-config-card-visibility"])
    app.include_router(community_qr_config.router, prefix="/api/community/qr-config", tags=["community-qr-config"])
    app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
    app.include_router(models.router, prefix="/api/models", tags=["models"])
    app.include_router(project_templates.router, prefix="/api/project-templates", tags=["project-templates"])
    app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    app.include_router(episodes.router, prefix="/api/projects/{project_id}/episodes", tags=["episodes"])
    app.include_router(project_scripts.router, prefix="/api/projects/{project_id}/script-workspace", tags=["project-script"])
    app.include_router(subjects.router, prefix="/api/projects/{project_id}/subjects", tags=["subjects"])
    app.include_router(upload.router, prefix="/api/projects/{project_id}/episodes", tags=["upload"])
    app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
    app.include_router(storyboards.router, prefix="/api/projects/{project_id}/storyboards", tags=["storyboards"])
    app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
    app.include_router(voices.router, prefix="/api/voices", tags=["voices"])
    app.include_router(reference_audio_library.router, prefix="/api/reference-audio-library", tags=["reference-audio-library"])
    app.include_router(minimax.router, prefix="/api/minimax", tags=["minimax"])
    app.include_router(audio_clips.router, prefix="/api/projects/{project_id}/audio-clips", tags=["audio-clips"])
    app.include_router(video_clips.router, prefix="/api/projects/{project_id}/video-clips", tags=["video-clips"])
    app.include_router(workbench.router, prefix="/api/projects/{project_id}/workbench", tags=["workbench"])
    app.include_router(compositions.router, prefix="/api/projects/{project_id}/compositions", tags=["compositions"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
    app.include_router(exports.router, prefix="/api/exports", tags=["exports"])
    app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
    app.include_router(images.router, prefix="/api/images", tags=["images"])
    app.include_router(user_styles.router, prefix="/api/user-styles", tags=["user-styles"])
    app.include_router(creation.router, prefix="/api/creation", tags=["creation"])
    app.include_router(media_access.router, prefix="/api/media", tags=["media-access"])

    # Production should keep `/uploads` on Nginx, but local dev still needs an
    # application-level fallback when developers reuse production-like env files.
    if settings.SERVE_UPLOADS_VIA_APP or not settings.is_production:
        app.mount("/uploads", StaticFiles(directory=str(settings.upload_root)), name="uploads")

    return app


app = create_app()
