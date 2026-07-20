# Miioo 后端 API 索引

本页用于回答两个问题：

- 先去哪里看接口
- 当前业务应该优先读哪个模块

它不替代 `BACKEND_API_DOC.md`、`/docs` 或 `/redoc`，而是把三者的职责拆清楚，作为后端接口文档的业务分组入口。

## 1. 三个入口怎么用

| 入口 | 用途 | 适用场景 |
|------|------|----------|
| `/docs` | 调试表单、在线试调用、查看实时请求模型 | 联调、排查请求参数、快速试接口 |
| `/redoc` | 查阅 OpenAPI 契约、按 tag 浏览模块 | 阅读接口、给接入同学过一遍接口结构 |
| `BACKEND_API_DOC.md` | 查看业务口径、前后置约束、字段兼容、任务制说明 | 需要理解“为什么这样接”时 |

推荐顺序：

1. 先在本页按业务域找到模块
2. 再到 `/redoc` 看该模块完整接口列表
3. 需要调试时去 `/docs`
4. 需要补充业务语义、任务制规则、字段兼容时回到 `BACKEND_API_DOC.md`

## 2. 阅读导航

- 总体约定、鉴权、分页、上传下载、错误格式：
  [BACKEND_API_DOC.md 基础信息与通用约定](./BACKEND_API_DOC.md#基础信息)
- 任务制接口、同步制接口、轮询规则：
  [BACKEND_API_DOC.md 任务制与同步制](./BACKEND_API_DOC.md#任务制与同步制)
- 字段兼容、媒体 URL、任务状态口径：
  [BACKEND_API_DOC.md 字段兼容字典](./BACKEND_API_DOC.md#字段兼容字典)
- 全量模块事实主文档：
  [BACKEND_API_DOC.md](./BACKEND_API_DOC.md)

## 3. 我现在要做什么

### A. 前端接入最小闭环

1. 登录与拿用户信息：
   `auth` -> `users`
2. 确认模型和服务商可用：
   `providers` -> `models`
3. 创建项目并读取项目详情：
   `projects`
4. 进入剧本主链路：
   `project-script` -> `upload` -> `episodes`
5. 进入主体与分镜链路：
   `subjects` -> `storyboards`
6. 进入下载、导出、任务恢复：
   `media-access` / `exports` / `tasks`

### B. 常见任务导航

- 我想做登录、验证码、微信扫码：
  `auth`
- 我想做项目新建、项目概览、打包下载：
  `projects`
- 我想做主剧本对话、结构化、发布正式分集：
  `project-script`
- 我想做正式分集 CRUD 或分集生成：
  `episodes`
- 我想做主体提取、参考图、主体图生成：
  `subjects`
- 我想做分镜生成、上传、排序、资源包下载：
  `storyboards`
- 我想做统一任务轮询或失败任务处理：
  `tasks`
- 我想做图片/视频/音频创作：
  `creation`
- 我想做工作台图片列表、收藏、删除、下载：
  `workbench`
- 我想做音色、参考音频、配音能力：
  `voices` / `reference-audio-library` / `minimax`
- 我想做导出、通知、模板、风格：
  `exports` / `notifications` / `project-templates` / `user-styles`
- 我想做媒体安全下载：
  `media-access`
- 我想做真人素材认证与素材资产：
  `live-materials`

### C. 前端页面接入提醒

- 页面层不要直接请求后端，统一经 `frontend_new/src/api/`
- 不要在页面组件里猜 snake_case / camelCase 兼容，统一放到适配层
- 不要把任务创建响应当最终结果，默认都要回读任务终态或业务详情
- 不要混用预览地址、缩略图地址、原文件地址、下载地址

## 4. 业务分组入口

### A. 接入必读

- 认证与账号：
  `auth`、`users`、`user-storage`
- 系统通用约定：
  鉴权、错误格式、分页、上传、下载、轮询、任务状态、字段兼容
- 建议先读：
  [认证与 Token 规则](./BACKEND_API_DOC.md#认证与-token-规则)、
  [通用约定](./BACKEND_API_DOC.md#通用约定)、
  [分页、上传、下载、轮询规则](./BACKEND_API_DOC.md#分页上传下载轮询规则)

### B. 项目与剧本主链路

- 项目域：
  `projects`、`episodes`
- 剧本域：
  `project-script`、`upload`
- 适用场景：
  新建项目、主剧本编辑、结构化、分集拆分、发布正式分集
- 建议先读：
  [项目模块 `projects`](./BACKEND_API_DOC.md#项目模块-projects)、
  [分集模块 `episodes`](./BACKEND_API_DOC.md#分集模块-episodes)、
  [主剧本工作区模块 `project_scripts`](./BACKEND_API_DOC.md#主剧本工作区模块-project_scripts)

### C. 主体、分镜与资产

- 主体域：
  `subjects`
- 分镜域：
  `storyboards`
- 资产域：
  `assets`、`media-access`
- 适用场景：
  主体提取、参考图、主体图生成、分镜生成、媒体下载、缩略图与资源包
- 建议先读：
  [主体模块 `subjects`](./BACKEND_API_DOC.md#主体模块-subjects)、
  [分镜模块 `storyboards`](./BACKEND_API_DOC.md#分镜模块-storyboards)、
  [资产模块 `assets`](./BACKEND_API_DOC.md#资产模块-assets)

### D. 创作与工作台

- 创作域：
  `creation`
- 工作台域：
  `workbench`
- 辅助域：
  `images`、`user-styles`
- 适用场景：
  图片/视频/音频生成，工作台图片流转，通用图片上传，风格选择
- 建议先读：
  [项目工作台模块 `workbench`](./BACKEND_API_DOC.md#项目工作台模块-workbench)、
  [全局创作模块 `creation`](./BACKEND_API_DOC.md#全局创作模块-creation)、
  [用户风格模块 `user_styles`](./BACKEND_API_DOC.md#用户风格模块-user_styles)

### E. 音频、音色与成片

- 音色域：
  `voices`、`reference-audio-library`、`minimax`
- 项目音视频域：
  `audio-clips`、`video-clips`、`compositions`
- 适用场景：
  选音色、参考音频、配音、生成片段、合成成片
- 建议先读：
  [音色模块 `voices`](./BACKEND_API_DOC.md#音色模块-voices)、
  [参考音频库模块 `reference-audio-library`](./BACKEND_API_DOC.md#参考音频库模块-reference-audio-library)、
  [合成成片模块 `compositions`](./BACKEND_API_DOC.md#合成成片模块-compositions)

### F. 配置、模型与系统运营

- 配置域：
  `providers`、`models`
- 运营域：
  `api-config-banner`、`api-config-card-visibility`、`community-qr-config`、`project-templates`
- 平台域：
  `notifications`、`exports`、`tasks`、`llm`
- 建议先读：
  [服务商模块 `providers`](./BACKEND_API_DOC.md#服务商模块-providers)、
  [模型配置模块 `models`](./BACKEND_API_DOC.md#模型配置模块-models)、
  [通用任务模块 `tasks`](./BACKEND_API_DOC.md#通用任务模块-tasks)

### G. 真人素材专项

- 素材域：
  `live-materials`
- 适用场景：
  真人认证会话、素材组管理、素材状态刷新、Seedance 真人素材链路
- 建议先读：
  [真人素材](./BACKEND_API_DOC.md#真人素材)

## 5. 路由前缀目录

| Tag | 路由前缀 | Router 文件 | 主要职责 |
|-----|----------|-------------|----------|
| `auth` | `/api/auth` | `backend/app/routers/auth.py` | 登录、验证码、微信扫码、Token |
| `users` | `/api/users` | `backend/app/routers/users.py` | 资料维护、手机号换绑、微信绑定、账号管理 |
| `user-storage` | `/api/users` | `backend/app/routers/user_storage.py` | 用户存储用量、提醒确认 |
| `api-config-banner` | `/api/api-config/banner` | `backend/app/routers/api_config_banner.py` | API 配置推荐图区 |
| `api-config-card-visibility` | `/api/api-config/card-visibility` | `backend/app/routers/api_config_card_visibility.py` | API 配置卡片展示开关 |
| `admin-model-visibility` | `/api/admin/model-visibility` | `backend/app/routers/admin_model_visibility.py` | 管理员模型开放控制 |
| `community-qr-config` | `/api/community/qr-config` | `backend/app/routers/community_qr_config.py` | 首页社群二维码配置 |
| `providers` | `/api/providers` | `backend/app/routers/providers.py` | 服务商配置与一键 setup |
| `models` | `/api/models` | `backend/app/routers/models.py` | 模型列表、默认模型、能力绑定 |
| `project-templates` | `/api/project-templates` | `backend/app/routers/project_templates.py` | 未登录模板只读展示 |
| `projects` | `/api/projects` | `backend/app/routers/projects.py` | 项目列表、详情、概览、打包下载 |
| `episodes` | `/api/projects/{project_id}/episodes` | `backend/app/routers/episodes.py` | 正式分集 CRUD 与分集剧本生成 |
| `project-script` | `/api/projects/{project_id}/script-workspace` | `backend/app/routers/project_scripts.py` | 主剧本工作区、结构化、发布、历史版本 |
| `upload` | `/api/projects/{project_id}/episodes` | `backend/app/routers/upload.py` | 正式分集剧本文档上传 |
| `subjects` | `/api/projects/{project_id}/subjects` | `backend/app/routers/subjects.py` | 主体提取、主体 CRUD、参考图、主体图 |
| `storyboards` | `/api/projects/{project_id}/storyboards` | `backend/app/routers/storyboards.py` | 分镜 CRUD、生成、上传、下载 |
| `assets` | `/api/assets` | `backend/app/routers/assets.py` | 统一资产中心 |
| `media-access` | `/api/media` | `backend/app/routers/media_access.py` | 受控媒体下载入口 |
| `workbench` | `/api/projects/{project_id}/workbench` | `backend/app/routers/workbench.py` | 项目工作台图片能力 |
| `creation` | `/api/creation` | `backend/app/routers/creation.py` | 创作页统一图片/视频/音频能力 |
| `voices` | `/api/voices` | `backend/app/routers/voices.py` | 音色库、收藏、自定义音色 |
| `reference-audio-library` | `/api/reference-audio-library` | `backend/app/routers/reference_audio_library.py` | 系统参考音频库 |
| `minimax` | `/api/minimax` | `backend/app/routers/minimax.py` | MiniMax 官方语音能力代理 |
| `audio-clips` | `/api/projects/{project_id}/audio-clips` | `backend/app/routers/audio_clips.py` | 项目内配音片段 |
| `video-clips` | `/api/projects/{project_id}/video-clips` | `backend/app/routers/video_clips.py` | 项目内视频片段 |
| `compositions` | `/api/projects/{project_id}/compositions` | `backend/app/routers/compositions.py` | 合成成片工程 |
| `notifications` | `/api/notifications` | `backend/app/routers/notifications.py` | 通知中心 |
| `exports` | `/api/exports` | `backend/app/routers/exports.py` | 导出准备 |
| `llm` | `/api/llm` | `backend/app/routers/llm.py` | LLM 中转入口 |
| `images` | `/api/images` | `backend/app/routers/images.py` | 通用图片上传 |
| `user-styles` | `/api/user-styles` | `backend/app/routers/user_styles.py` | 用户风格 CRUD |
| `tasks` | `/api/tasks` | `backend/app/routers/tasks.py` | 通用任务中心 |
| `live-materials` | `/api/live-materials` | `backend/app/routers/live_materials.py` | 真人素材认证与资产 |

## 6. Tag 到文档章节映射

| Tag | BACKEND_API_DOC 章节 |
|-----|----------------------|
| `auth` | [鉴权模块 `auth`](./BACKEND_API_DOC.md#鉴权模块-auth) |
| `users` | [用户模块 `users`](./BACKEND_API_DOC.md#用户模块-users) |
| `providers` | [服务商模块 `providers`](./BACKEND_API_DOC.md#服务商模块-providers) |
| `models` | [模型配置模块 `models`](./BACKEND_API_DOC.md#模型配置模块-models) |
| `projects` | [项目模块 `projects`](./BACKEND_API_DOC.md#项目模块-projects) |
| `episodes` | [分集模块 `episodes`](./BACKEND_API_DOC.md#分集模块-episodes) |
| `project-script` | [主剧本工作区模块 `project_scripts`](./BACKEND_API_DOC.md#主剧本工作区模块-project_scripts) |
| `subjects` | [主体模块 `subjects`](./BACKEND_API_DOC.md#主体模块-subjects) |
| `assets` | [资产模块 `assets`](./BACKEND_API_DOC.md#资产模块-assets) |
| `storyboards` | [分镜模块 `storyboards`](./BACKEND_API_DOC.md#分镜模块-storyboards) |
| `workbench` | [项目工作台模块 `workbench`](./BACKEND_API_DOC.md#项目工作台模块-workbench) |
| `voices` | [音色模块 `voices`](./BACKEND_API_DOC.md#音色模块-voices) |
| `reference-audio-library` | [参考音频库模块 `reference-audio-library`](./BACKEND_API_DOC.md#参考音频库模块-reference-audio-library) |
| `minimax` | [MiniMax 官方能力模块 `minimax`](./BACKEND_API_DOC.md#minimax-官方能力模块-minimax) |
| `audio-clips` | [配音片段模块 `audio_clips`](./BACKEND_API_DOC.md#配音片段模块-audio_clips) |
| `video-clips` | [视频片段模块 `video_clips`](./BACKEND_API_DOC.md#视频片段模块-video_clips) |
| `compositions` | [合成成片模块 `compositions`](./BACKEND_API_DOC.md#合成成片模块-compositions) |
| `notifications` | [通知模块 `notifications`](./BACKEND_API_DOC.md#通知模块-notifications) |
| `exports` | [导出模块 `exports`](./BACKEND_API_DOC.md#导出模块-exports) |
| `llm` | [LLM 中转模块 `llm`](./BACKEND_API_DOC.md#llm-中转模块-llm) |
| `images` | [图片上传模块 `images`](./BACKEND_API_DOC.md#图片上传模块-images) |
| `user-styles` | [用户风格模块 `user_styles`](./BACKEND_API_DOC.md#用户风格模块-user_styles) |
| `tasks` | [通用任务模块 `tasks`](./BACKEND_API_DOC.md#通用任务模块-tasks) |
| `creation` | [全局创作模块 `creation`](./BACKEND_API_DOC.md#全局创作模块-creation) |
| `live-materials` | [真人素材](./BACKEND_API_DOC.md#真人素材) |

## 7. 接入建议

- 页面层不要直接猜后端字段语义，统一经前端 `src/api/` 适配层归一
- 任务制接口默认按“提交任务 -> 轮询 -> 终态后回读业务详情”接入
- 媒体展示前先区分缩略图、预览地址、原文件地址和下载地址，不混用一个宽泛 `url`
- 若 `/docs`、`/redoc` 与正文说明看起来不一致，以已注册路由和实际响应模型为准，并同步回写文档

## 8. 维护规则

- 新增模块时，先在 `backend/app/main.py` 注册 router tag，再补本页业务分组入口
- 若新增高频业务链路，同步补“我现在要做什么”与“常见任务导航”
- 若新增 router，补“路由前缀目录”与“Tag 到文档章节映射”
- 若接口契约变化影响接入方式，继续同步更新 `BACKEND_API_DOC.md`
- 若只是补索引、重排阅读顺序，可优先更新本页和主文档顶部导航
