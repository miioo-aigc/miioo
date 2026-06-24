# Miioo 后端 API 接入文档

本文档面向“另一版本前端”的接入同学，基于当前 `backend/app` 实际代码整理，覆盖认证、通用约定、上传下载、任务轮询，以及全部已注册 API 模块。

## 文档使用方式

- 本文档是当前后端接口的主事实源，以 `backend/app/main.py` 已注册路由和各 router / schema 实现为准。
- 面向对象包括：另一版前端接入同学、当前仓库联调同学、后端补接口同学。
- 建议配合以下材料一起使用：
  - `/docs` 或 `/openapi.json`：查看实时 schema 与调试表单
- `HARNESS_DOC_INDEX.md`：查看当前文档体系入口、阅读顺序与回写要求
  - `HARNESS_PAGE_API_MAPPING.md`：查看页面闭环如何消费这些接口
  - `HARNESS_P0_BACKLOG.md`：查看当前主链路联调进度和阻塞项
  - `CLOUD_PUBLIC_TUNNEL_PM2_GUIDE.md`：查看云端 `start_public_tunnel.sh`、`PUBLIC_BASE_URL` 与 `pm2` 托管的操作经验
- 若主文档与页面代码、历史口头约定冲突，以“已注册路由 + 实际请求/响应结构”为准，再同步回写映射表与 backlog。

## 模块索引

### P0 最小闭环

- `auth`：登录、刷新、退出登录、获取当前用户
- `providers` + `models`：确认是否已有可用模型与供应商
- `projects`：项目列表、创建、详情、更新
- `episodes` + `script-workspace` + `upload`：分集、主剧本工作区、整稿上传与拆分
- `subjects`：主体提取、CRUD、参考图、主体图
- `storyboards`：分镜 CRUD、图片/视频生成、下载

### 扩展模块

- `assets` / `workbench` / `creation`：统一资产与创作链路
- `media-access`：统一媒体受控下载入口
- `voices` / `reference-audio-library` / `minimax`：音色、参考音频、官方语音能力
- `tasks` / `notifications` / `exports`：任务中心、通知与导出
- `project-templates` / `user-styles` / `images`：模板、风格与通用上传能力

### 任务制与同步制

- 典型任务制：`tasks`、`workbench/images/generate`、`creation/images/generate`、`creation/videos/generate`、`POST /api/projects/{project_id}/storyboards/{storyboard_id}/generate-image`、`POST /api/projects/{project_id}/storyboards/{storyboard_id}/generate-video`
- 典型同步制：`auth`、`projects`、`episodes CRUD`、`subjects CRUD`、`images/upload`、多数配置类接口
- 接入建议：前端页面不要直接散落字段兼容逻辑，应在 `src/api/` 适配层统一处理命名映射、媒体 URL 拼接和轮询封装；任务制接口默认遵循“提交任务 -> 轮询 `/api/tasks/{task_id}` -> 终态后再读取业务详情”的模式。

## 基础信息

- 服务基地址：本地开发默认 `http://localhost:8000`
- 当前线上后端域名：`https://www.miiooai.com`
- API 统一前缀：`/api`
- 静态文件前缀：`/uploads`
- 在线调试文档：`/docs`
- OpenAPI JSON：`/openapi.json`
- 鉴权方式：`Authorization: Bearer <access_token>`
- 默认 CORS 放行：`http://localhost:3000`、`http://127.0.0.1:3000`、`http://miiooai.com`、`https://miiooai.com`、`https://www.miiooai.com`、`http://chengxvblog.top`、`https://chengxvblog.top`、`https://www.chengxvblog.top`、`http://10.20.100.21:5173`、`http://10.20.100.35`、`http://10.20.100.35:5173`
- 当前 `CORS_ORIGIN_REGEX` 额外允许常见局域网来源：`10.x.x.x`、`192.168.x.x`、`172.16-31.x.x`、`localhost`、`127.0.0.1`、`*.local`，并允许携带端口
- 若需新增精确来源，请同步更新后端 `.env` 中的 `CORS_ORIGINS`；当前应用启动时也会对这份精确白名单做最小归一化，自动补齐同协议下的 `apex <-> www` 域名变体并去掉尾部 `/`

## 认证与 Token 规则

### Token 机制

- 采用 JWT
- `token_type` 固定为 `bearer`
- 同时存在两类 token：
  - `access_token`：业务接口鉴权
  - `refresh_token`：刷新登录态

### 需要鉴权的接口

除 `auth` 登录注册相关、`/api/images/upload` 以外，绝大多数业务接口都要求登录。

### Header 示例

```http
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

## 通用约定

### 响应风格

- 列表接口通常返回数组，或 `list + total + page + has_more`
- 删除、标记已读、取消任务等动作接口通常返回：

```json
{
  "message": "操作成功"
}
```

- 任务类接口通常返回：

```json
{
  "id": "uuid",
  "status": "pending",
  "total_count": 4,
  "success_count": 0,
  "fail_count": 0
}
```

### 错误格式

FastAPI 默认错误响应，前端重点读取 `detail`：

```json
{
  "detail": "项目不存在"
}
```

常见状态码：

- `400` 参数错误、业务校验失败
- `401` 未登录或 token 无效
- `403` 资源不可操作
- `404` 资源不存在
- `422` 请求体校验失败
- `500` 服务内部错误
- `502` 上游模型服务异常

### 请求追踪与慢日志

- 后端当前已统一补齐应用启动日志初始化、请求级 `request_id` 中间件和 SQLAlchemy 慢 SQL 观测。
- 每个 HTTP 请求都会生成或透传 `X-Request-ID`，并在响应头回写同名字段；若前端或网关已有链路追踪 ID，可直接透传该头部，便于把请求日志和 SQL 日志串起来。
- 请求日志默认记录 `request_id / method / path / status_code / duration_ms`；当请求耗时超过 `SLOW_REQUEST_THRESHOLD_MS` 时，会自动升级为慢请求告警日志。
- SQL 日志默认只对超过 `SQL_SLOW_THRESHOLD_MS` 的慢 SQL 输出 `warning`；若需要观察全部 SQL，可设置 `SQL_LOG_ALL_QUERIES=true`，并用 `SQL_LOG_LEVEL` 控制非慢 SQL 的日志级别。
- 当前相关环境变量包括：`LOG_LEVEL`、`REQUEST_LOG_LEVEL`、`SLOW_REQUEST_THRESHOLD_MS`、`SQL_LOG_ALL_QUERIES`、`SQL_LOG_LEVEL`、`SQL_SLOW_THRESHOLD_MS`。

### 时间与 ID

- 主键基本都是 UUID 字符串
- 时间字段基本为 ISO 字符串，如：

```json
"created_at": "2026-05-17T10:20:30.123456"
```

### 命名兼容

部分工作台与创作接口同时返回 `snake_case` 和 `camelCase`，用于兼容不同前端实现，例如：

- `page_size` / `pageSize`
- `has_more` / `hasMore`
- `is_liked` / `isLiked`

### 上传文件访问

- 上传或生成后的媒体，一般会返回 `file_url` 或 `url`
- 若值形如 `/uploads/images/xxx.png`，前端应拼接服务域名访问：
  - `http://localhost:8000/uploads/images/xxx.png`
- 当前媒体字段语义补充：
  - `file_url` / `url` / `cover_url`：原始资源，供图片详情、视频播放、下载等场景使用
  - `thumbnail_url` / `cover_thumbnail_url`：前端卡片展示用缩略图，当前后端默认收口为 AVIF 卡片图
  - `large_url` / `largeUrl`：图片大图预览地址，仅在图片 metadata 已存在 `large_url` 且 `MEDIA_ENABLE_IMAGE_LARGE_VARIANT=true` 时返回
  - 视频资产本体当前不生成低清播放文件；仅对视频封面图做卡片缩略图派生
- 云端图生视频补充说明：
  - 若首帧图、尾帧图或参考图是本地 `/uploads/...`，建议显式配置后端 `PUBLIC_BASE_URL` 为外网可访问的后端域名；当前线上环境固定口径为 `https://www.miiooai.com`
  - 当前后端会优先读取运行时活跃隧道地址：若 `backend/.runtime/cloudflared_public_url` 或 `backend/.runtime/localtunnel_public_url` 对应 pid 仍存活，则会优先覆盖 `.env` 中的 `PUBLIC_BASE_URL`；只有在运行时隧道不存在或 pid 已失效时，才回退到 `.env` 固定值
  - 当前仓库内置的 `backend/tunnel.sh` 已升级为本地联调入口：脚本会启动 `cloudflared`、自动抓取 `https://*.trycloudflare.com` 临时域名，并回写 `backend/.env` 中的 `PUBLIC_BASE_URL` 与 `SERVE_UPLOADS_VIA_APP=true`；视频生成链路会优先读取 `.runtime` 中的活跃隧道地址，因此重开隧道后通常不再要求为了参考视频地址手工重启一次后端
  - 若要切回云端固定域名启动，可执行 `bash backend/脚本/start_cloud.sh web` 或仓库根目录 `./start_backend.sh cloud`；脚本会先关闭本地公网隧道、清理 `.runtime` 临时公网地址文件，并以 `PUBLIC_BASE_URL_FILE=""`、`SERVE_UPLOADS_VIA_APP=false` 的云端口径启动
  - 若你已有稳定公网域名，仍优先直接在 `.env` 中配置固定 `PUBLIC_BASE_URL`，不要长期依赖临时隧道
  - 若需要把这套临时隧道方案放到云服务器上持续运行，可参考 `backend/CLOUD_PUBLIC_TUNNEL_PM2_GUIDE.md` 中的 `nohup`、日志核验与 `pm2` 托管步骤；但正式环境仍建议切回固定域名 + HTTPS
  - 当前后端已对图片参考做兜底：`Seedance` 链路会统一先转成 `data URI` 再提交，其他外部视频模型遇到 `HTTP-only` 图片时也会优先转成 `data URI`，减少云端拉取图片失败的问题
  - `Seedance` 的视频/音频参考目前不走 `data URI`；后端会优先把本地上传视频按既有规则压缩到上游尺寸范围内，并在存在 `PUBLIC_BASE_URL` 时尝试把外部视频/音频重托管到本地 `/uploads/runtime/seedance-reference-*` 后再提交，减少第三方临时直链、飞书导出地址或 `HTTP-only` 链接被上游回源失败的问题
  - 当前默认仍允许“公网 HTTP 域名”作为过渡态继续试跑，但后端会统一打印 warning，并在提交前主动探活最终视频/音频地址
  - 若希望在 HTTPS 切好后把这条链路收得更严，可在后端配置 `UPSTREAM_MEDIA_REQUIRE_HTTPS=true`；开启后，HTTP-only 的 `PUBLIC_BASE_URL` 或素材外链会在提交前直接被拒绝
  - 若参考视频/音频最终仍需依赖本地托管地址，则正式环境仍建议把 `PUBLIC_BASE_URL` 切到外网可访问的 `HTTPS` 地址；若仍为 `HTTP` 或公共隧道离线，后端会提前返回更明确的错误提示，而不是继续把不可访问 URL 交给上游
- 若后端域名本身在线，但某个 `/uploads/...` 地址返回 `404`，说明问题通常已收敛到“该素材文件不存在、路径失效或云端 `uploads` 未持久化”，而不是 `PUBLIC_BASE_URL` 整体离线；当前后端也会在 `Seedance` 探活失败时优先按这个方向报错。这类场景应优先核对素材是否仍在服务器上、数据库里保存的 URL 是否还是最新值

### 任务状态字典

- 通用任务终态通常为：`completed / failed / cancelled / partial`
- 处理中状态常见为：`pending / generating / processing`
- 前端轮询建议以接口返回的 `status` 为唯一终止条件，不要自行根据进度条文案推断完成态。

### 字段兼容字典

- 常见分页兼容：`page_size / pageSize`、`has_more / hasMore`
- 常见收藏兼容：`is_liked / isLiked`、请求体 `liked`
- 常见媒体字段：
  - `file_url` / `url` / `cover_url`：原始资源
  - `thumbnail_url` / `cover_thumbnail_url`：卡片缩略图
  - `large_url` / `largeUrl`：图片大图预览字段，建议按 `largeUrl -> previewUrl` 顺序消费
- 常见模型归属字段：`provider_type`、`provider_name`
- 前端若维持产品侧 camelCase，可在适配层统一归一，不建议页面直接混用两套命名。

## 常用枚举与业务口径

### 画幅比例

- `16:9`
- `9:16`
- `1:1`
- `4:3`

### 模型分类

- `chat`
- `image`
- `video`
- `voice`

### 主体类型

- `character`
- `scene`
- `prop`

### 资产类型

- `image`
- `video`
- `audio`
- `document`

### 常见资产分类

当前代码中常见分类包括：

- `character`
- `scene`
- `prop`
- `storyboard`
- `reference`

### 项目设定枚举

- `dialogue_density`: `low | medium | high`
- `shot_rhythm`: `slow | medium | fast`

## 分页、上传、下载、轮询规则

### 分页

常见分页参数：

- `page`：页码，从 `1` 开始
- `page_size`：每页数量，通常最大 `100`

常见返回：

```json
{
  "list": [],
  "total": 0,
  "page": 1,
  "page_size": 20,
  "has_more": false,
  "pageSize": 20,
  "hasMore": false
}
```

### 文件上传

常见上传方式：

- `multipart/form-data`
- 字段名通常为 `file`

常见限制：

- 图片：`jpg/jpeg/png/gif/webp`
- 全局图片上传接口限制约 `5MB`
- 创作/工作台图片上传限制约 `20MB`
- 文档上传支持：`txt/md/markdown/doc/docx`

### 下载

下载类接口有两种形式：

- 返回文件流 / ZIP
- 返回重定向到真实 `file_url`
- 返回受控下载入口 `302`

前端对接建议：

- 浏览器环境：直接 `window.open(url)` 或 `a.download`
- 若接口要求鉴权：使用带 token 的请求拿到 blob 下载

统一受控下载补充：

- 路由：
  - `GET /api/media/downloads/{token}`
- 当前用途：
  - 作为媒体字段里的 `downloadUrl` 统一受控入口
  - 先校验短时 token 和当前登录用户
  - 再 `302` 跳转到实际下载地址
  - 记录首版下载审计日志
- 当前首版校验语义：
  - token 无效或过期：`401`
  - token 用户与当前登录用户不一致：`403`
  - 目标资源不存在：`404`
- 当前设计边界：
  - 首版重点是把列表/详情返回的 `downloadUrl` 逐步切到受控入口
  - 既有 `assets / creation / subjects / storyboards` 的老下载流接口仍保留
  - 前端字段名不变，仍继续消费 `downloadUrl`
  - 既有单资源下载接口当前会逐步复用同一套受控目标解析逻辑，但返回形态仍保持附件流，便于兼容原有文件名语义
  - 当前下载审计为应用日志级实现：统一入口与共享受控目标解析层会记录 `event / outcome / user_id / project_id / resource_id / storage_key / resolved_target` 等字段，便于后续接入更完整的观测与告警

### 任务轮询

项目中存在三类常见轮询：

- 通用任务：`/api/tasks/{task_id}`
- 项目工作台图片任务：`/api/projects/{project_id}/workbench/tasks/{task_id}`
- 创作模块图片/视频任务：
  - `/api/creation/tasks/{task_id}`
  - `/api/creation/videos/tasks/{task_id}`

推荐策略：

- 生成后立即开始轮询
- 轮询间隔 `2~3s`
- 遇到终态停止：`completed / failed / cancelled / partial`
- 创作视频任务会在视频本体落盘后先写入 `partial + result.video_url/result.videoUrl`；缩略图、参考图、首帧派生和资产卡片创建属于后处理，不应阻塞前端先展示可播放视频

补充说明：

- 创作页图片 / 视频任务，以及分镜页图片 / 视频生成链路，后端已补“脱离前端页面生命周期继续执行”能力
- 前端若在任务提交成功后切换页面，后端仍会继续完成上游调用、文件托管与数据库回写；用户回到页面后刷新列表即可看到最终结果

### 公开模板接口

- 用途：给未登录首页的 `项目` Tab 提供只读模板案例展示
- 当前接口为静态目录驱动，不依赖用户登录，也不进入真实项目工作流

#### `GET /api/project-templates`

- 方法：`GET`
- 路径：`/api/project-templates`
- 鉴权：否

返回示例：

```json
[
  {
    "id": "template-cinematic-suspense",
    "name": "悬疑短剧模板",
    "description": "适合悬疑、反转、追查类项目，强调夜景氛围与情绪推进。",
    "aspect_ratio": "16:9",
    "visual_style": "suspense-anime",
    "visual_style_label": "2D悬疑动漫",
    "cover_key": "suspense_anime",
    "tags": ["悬疑", "短剧", "反转"],
    "sort_order": 10
  }
]
```

字段说明：

- `cover_key`：前端本地封面映射 key，本轮匿名模板展示不直接下发真实图片 URL
- `tags`：模板标签，仅用于展示
- `sort_order`：前端卡片排序依据
- 该接口仅用于匿名浏览模板案例，点击模板卡片不会直接进入真实项目工作流

## 鉴权模块 `auth`

路由前缀：`/api/auth`

### 注册

- 方法：`POST`
- 路径：`/api/auth/register`
- 鉴权：否

请求体：

```json
{
  "phone": "13800000000",
  "password": "123456",
  "nickname": "阿星"
}
```

补充说明：

- `nickname` 为可选字段
- 若未传 `nickname`，后端会默认把当前手机号写入用户名
- 若传了空字符串，后端也会回退为手机号，避免落库成空昵称
- 注册成功后会同步把本次手机号写入账号审计字段：`registered_phone / last_login_phone / last_login_at`

返回：

```json
{
  "access_token": "xxx",
  "refresh_token": "xxx",
  "token_type": "bearer"
}
```

### 账号密码登录

- 方法：`POST`
- 路径：`/api/auth/login`
- 鉴权：否

请求体：

```json
{
  "phone": "13800000000",
  "password": "123456"
}
```

补充说明：

- 登录成功后，后端会把本次手机号写入 `last_login_phone`，并更新 `last_login_at`

### 发送验证码

- 方法：`POST`
- 路径：`/api/auth/send-code`
- 鉴权：否
- 说明：后端会生成 6 位验证码；普通账号默认走腾讯云短信真实发送，管理员账号 `15689881587`、`10987654321` 会直接写入静态验证码 `666666`；若本地开发环境开启 `AUTH_DEV_SMS_BYPASS_ENABLED=true`，普通手机号也会跳过真实短信发送并直接写入调试验证码；60 秒内不可重复发送

请求体：

```json
{
  "phone": "13800000000"
}
```

返回重点：

- `message`：发送结果提示
- `expires_in`：验证码有效期（秒）
- `debug_code`：仅开发态开启时返回，便于本地联调；正式环境不返回

补充说明：

- 静态验证码 `666666` 仅对管理员手机号 `15689881587`、`10987654321` 生效
- 管理员手机号发送验证码时不会依赖真实短信下发，便于本地联调与受控环境登录
- 若本地开发环境开启 `AUTH_DEV_SMS_BYPASS_ENABLED=true`，普通手机号会直接使用 `AUTH_DEV_SMS_BYPASS_CODE`，不触发真实腾讯云短信发送
- 推荐本地联调时同时开启 `AUTH_DEBUG_CODE_ENABLED=true`，前端可直接看到本次调试验证码

### 验证码登录

- 方法：`POST`
- 路径：`/api/auth/verify-code-login`
- 鉴权：否

请求体：

```json
{
  "phone": "13800000000",
  "code": "123456"
}
```

补充说明：

- 管理员手机号 `15689881587`、`10987654321` 可使用静态验证码 `666666` 登录
- 若本地开发环境开启 `AUTH_DEV_SMS_BYPASS_ENABLED=true`，普通手机号也可使用当前 `AUTH_DEV_SMS_BYPASS_CODE` 完成验证码登录
- 首次通过验证码登录创建账号时，若手机号在管理员白名单内，会自动写入 `is_admin=true`
- 首次通过验证码登录自动创建账号时，默认用户名同样使用当前手机号
- 验证码登录成功后，后端会同步写入 `last_login_phone / last_login_at`；若该账号此前没有 `registered_phone`，也会在首次创建时补齐

### 创建微信扫码登录会话

- 方法：`GET`
- 路径：`/api/auth/wechat/qrcode`
- 鉴权：否

返回重点：

- `session_id`
- `qr_code_value`：当前真实口径下为微信开放平台授权 URL，前端会自行渲染成二维码
- `expires_in`
- `status`

说明：

- 当 `WECHAT_LOGIN_ENABLED=true` 且微信开放平台配置完整时，该接口会返回真实微信开放平台扫码登录 URL
- 若真实微信未开启但 `AUTH_DEV_WECHAT_CONFIRM_ENABLED=true`，仍回退到原开发态扫码占位二维码
- 当前真实生产链路使用 `state=session_id` 承接扫码会话，扫码后由前端首页或兼容回调页继续调用后端完成授权处理；默认生产回调地址建议固定为 `https://miiooai.com/`

### 轮询扫码状态

- 方法：`GET`
- 路径：`/api/auth/wechat/poll/{session_id}`
- 鉴权：否

状态值常见：

- `pending`
- `scanned`
- `need_bind_mobile`
- `confirmed`
- `expired`
- `error`

返回补充：

- 当 `status=confirmed` 时会返回 token
- 当 `status=need_bind_mobile` 时会返回 `bind_token`
- 当 `status=error` 时会返回 `message`

### 确认扫码登录

- 方法：`POST`
- 路径：`/api/auth/wechat/confirm`
- 鉴权：否

请求体：

```json
{
  "session_id": "xxx",
  "phone": "13800000000",
  "sms_code": "666666",
  "nickname": "微信用户"
}
```

说明：

- 当前真实微信扫码登录中，若扫码微信尚未绑定账号，会先进入 `need_bind_mobile`，再由该接口承接手机号验证码校验与账号绑定
- 兼容旧调用方时，也可传 `code` 字段；前端当前统一使用 `sms_code`
- 绑定成功后会把真实微信 `openid / nickname / avatar` 写入用户资料，同时更新 `last_login_phone / last_login_at`
- 若当前环境仅开启开发态扫码占位，该接口仍兼容原开发态确认流程

### 完成微信扫码回调

- 方法：`POST`
- 路径：`/api/auth/wechat/callback/complete`
- 鉴权：否

请求体：

```json
{
  "code": "wechat-code",
  "state": "session_id"
}
```

说明：

- 供前端首页或兼容回调页调用，用于把微信开放平台回调的 `code / state` 交回后端处理；默认生产回调地址建议固定为 `https://miiooai.com/`
- 若扫码微信已绑定账号，会直接把扫码会话更新为 `confirmed`
- 若扫码微信尚未绑定账号，会把扫码会话更新为 `need_bind_mobile`
- 若当前二维码属于资料页绑定场景，则会直接完成当前登录账号与真实微信身份的绑定，并把资料页轮询状态更新为 `confirmed`

### 刷新 Token

- 方法：`POST`
- 路径：`/api/auth/refresh`
- 鉴权：否

请求体：

```json
{
  "refresh_token": "xxx"
}
```

### 退出登录

- 方法：`POST`
- 路径：`/api/auth/logout`
- 鉴权：否（带登录态调用更符合前端语义）

返回：

```json
{
  "message": "已退出登录"
}
```

说明：

- 当前实现会清理服务端设置的鉴权 cookie。
- 若前端自行持久化了 `access_token / refresh_token`，仍需要在前端本地一并清除。

### 获取当前用户信息

- 方法：`GET`
- 路径：`/api/auth/me`
- 鉴权：是

返回重点：

- `id`
- `display_id`：个人信息页 / 账户菜单展示 ID，当前口径为 `miioo_` + 6 位随机数字，由后端生成并保证唯一，不替代真实用户 UUID
- `phone`：脱敏手机号
- `phone_bound`
- `nickname`
- `avatar_url`
- `wechat`
- `wechat_bound`
- `has_api_configured`
- `is_admin`

## 用户模块 `users`

路由前缀：`/api/users`

### 更新个人资料

- `PATCH /api/users/me`

- 鉴权：是

请求体字段：

- `nickname?`
- `avatar_url?`

校验说明：

- `nickname` 为空会返回 `400`
- `nickname` 最长 `50` 个字符
- 当前会校验敏感词，并限制为中文、英文、数字、空格、下划线、中划线、点和中点

返回重点：

- 与 `GET /api/auth/me` 同口径，返回最新 `display_id / phone / phone_bound / nickname / avatar_url / wechat / wechat_bound`

### 发送换绑手机号验证码

- `POST /api/users/me/phone/rebind/send-code`
- 鉴权：是

请求体：

```json
{
  "phone": "13900001111"
}
```

说明：

- 仅当当前账号当前仍绑定手机号时允许发起换绑
- 需要传入新的 11 位手机号；若与当前手机号一致，或已绑定到其他账号，会直接返回错误
- 复用当前验证码限流、每日上限和开发态调试验证码能力
- 验证码下发到新手机号，返回 `message / expires_in / debug_code`

### 管理员读取账号列表

- `GET /api/users/admin/accounts`
- 鉴权：是，且仅管理员可调用

查询参数：

- `page`：页码，从 `1` 开始，默认 `1`
- `page_size`：每页数量，默认 `20`，最大 `100`
- `keyword?`：按昵称、展示号、当前手机号、注册手机号或最近登录手机号模糊搜索
- `is_active?`：按账号启用状态筛选，传 `true/false`
- `is_admin?`：按管理员身份筛选，传 `true/false`

返回重点：

- `list[]`
  - `id`
  - `display_id`
  - `nickname`
  - `current_phone`
  - `registered_phone`
  - `last_login_phone`
  - `last_login_at`
  - `is_admin`
  - `is_active`
  - `created_at`
  - `updated_at`
- `total`
- `page`
- `page_size`
- `has_more`

说明：

- 这是管理员控制台里的“账号管理”专用接口，普通用户无入口也无权限调用
- `registered_phone` 用于记录账号注册或首次验证码建号时的手机号，不会因后续换绑而自动覆盖
- `last_login_phone / last_login_at` 用于记录最近一次成功登录时的手机号与时间

### 管理员更新账号信息

- `PATCH /api/users/admin/accounts/{user_id}`
- 鉴权：是，且仅管理员可调用

请求体：

```json
{
  "nickname": "内容运营A",
  "phone": "13900001111",
  "is_admin": true,
  "is_active": true
}
```

请求说明：

- `nickname?`：可选，最大 `50` 个字符；沿用现有用户名敏感词与字符校验规则
- `phone?`：可选，必须为 `11` 位手机号，且不能与其它账号重复
- `is_admin?`：可选，切换目标账号管理员身份
- `is_active?`：可选，切换目标账号启用状态

返回重点：

- 返回更新后的管理员账号对象，字段结构与 `GET /api/users/admin/accounts` 的单项 `list[]` 保持一致

错误边界：

- 目标账号不存在时返回 `404`
- 手机号格式不正确时返回 `400`
- 手机号已绑定其他账号时返回 `400`
- 若当前操作会移除最后一个“启用中的管理员账号”，返回 `400`

说明：

- 该接口仅用于管理员控制台账号管理，不影响普通用户 `/api/users/me` 资料更新入口
- 若更新了 `phone`，后端会同步将 `is_phone_bound` 置为 `true`
- 管理员可在一次提交里同时修改昵称、手机号、启用状态和管理员状态

### 确认换绑手机号

- `POST /api/users/me/phone/rebind`
- 鉴权：是

请求体：

```json
{
  "phone": "13900001111",
  "code": "123456"
}
```

说明：

- 仅校验新手机号与验证码，不再要求先绑定微信
- 校验通过后会直接更新用户手机号，但 `display_id` 保持不变
- 换绑成功后返回最新用户资料；`phone_bound=true`

### 创建资料页微信绑定二维码

- `GET /api/users/me/wechat/qrcode`
- 鉴权：是

返回重点：

- `ticket`
- `qr_code_value`
- `expires_in`
- `status`

说明：

- 该接口是资料页真实微信绑定主链路，会返回真实微信开放平台授权 URL
- 前端资料页会将 `qr_code_value` 渲染为二维码，并轮询绑定状态

### 轮询资料页微信绑定状态

- `GET /api/users/me/wechat/poll/{ticket}`
- 鉴权：是

状态值常见：

- `pending`
- `scanned`
- `confirmed`
- `expired`
- `error`

说明：

- 当 `status=confirmed` 时，会返回 `wechat_nickname`
- 当 `status=error` 或 `status=expired` 时，会返回 `message`

### 绑定微信号（兼容保留）

- `POST /api/users/me/wechat/bind`
- 鉴权：是

请求体：

```json
{
  "wechat_id": "miioo_wechat",
  "wechat_nickname": "微信昵称",
  "wechat_avatar_url": "/uploads/images/wechat-avatar.png"
}
```

说明：

- 当前接口保留为兼容手工绑定入口；资料页真实绑定主链路已切到 `GET /api/users/me/wechat/qrcode` + `GET /api/users/me/wechat/poll/{ticket}`
- `wechat_id` 最长 `50` 个字符，且不可与其它账号已绑定的微信号重复
- 绑定成功后返回最新用户资料；`wechat` 优先返回 `wechat_nickname`，否则回退 `wechat_id`

### 解绑微信号

- `DELETE /api/users/me/wechat`
- 鉴权：是

说明：

- 解绑成功后返回最新用户资料；`wechat=null`，`wechat_bound=false`

### 注销账号

- `DELETE /api/users/me`

说明：

- 为软删除语义
- 注销后账户不可继续登录

## API 配置推荐图区 `api-config/banner`

路由前缀：`/api/api-config/banner`

### 获取推荐图区图片

- `GET /api/api-config/banner`
- 鉴权：已登录

返回字段重点：

- `id`
- `image_url`
- `is_enabled`
- `created_at`
- `updated_at`

说明：

- 当前收口为单张推荐主图，不是多图轮播
- 若管理员尚未配置图片，`image_url` 为空，前端展示占位态

### 保存或替换推荐图区图片

- `PUT /api/api-config/banner`
- 鉴权：管理员

请求体：

```json
{
  "image_url": "/uploads/images/banner.png",
  "is_enabled": true
}
```

说明：

- 普通登录用户调用会返回 `403`
- 前端当前约定为先调用 `POST /api/images/upload` 上传图片，再把返回的 `url` 写入这里

### 删除推荐图区图片

- `DELETE /api/api-config/banner/image`
- 鉴权：管理员

说明：

- 删除后会将 `image_url` 清空，并把 `is_enabled` 置为 `false`

## 首页社群二维码配置 `community/qr-config`

路由前缀：`/api/community/qr-config`

### 获取首页社群二维码

- `GET /api/community/qr-config`
- 鉴权：无需登录

返回字段重点：

- `id`
- `image_url`
- `is_enabled`
- `created_at`
- `updated_at`

说明：

- 供首页左下角“应用”按钮弹窗读取社群二维码
- 若管理员尚未配置图片，`image_url` 为空，前端可回退到默认二维码占位
- 该读取接口刻意放开匿名访问，避免未登录用户打开首页时看不到社群入口

### 保存或替换首页社群二维码

- `PUT /api/community/qr-config`
- 鉴权：管理员

请求体：

```json
{
  "image_url": "/uploads/images/community-qr.png",
  "is_enabled": true
}
```

说明：

- 普通用户调用会返回 `403`
- 前端当前约定为先调用 `POST /api/images/upload` 上传二维码图片，再把返回的 `url` 写入这里
- 当前收口为单张二维码配置；重复保存时覆盖原记录，不做历史版本管理

### API 配置内置卡片展示开关

路由前缀：`/api/api-config/card-visibility`

- 当前支持的 `card_key`：`onelink`、`minimax`、`aiping`、`volcengine`、`vidu`、`fal`
- 该配置只影响 API 配置弹窗里“是否对普通用户展示这张内置服务商卡片”
- 不影响 provider 本身的 `is_enabled`、模型列表、默认模型和已有生成链路

#### 获取卡片展示配置

- `GET /api/api-config/card-visibility`
- 鉴权：已登录

返回示例：

```json
[
  {
    "card_key": "onelink",
    "is_visible": true,
    "updated_at": "2026-06-04T10:30:00"
  },
  {
    "card_key": "fal",
    "is_visible": false,
    "updated_at": "2026-06-04T10:35:00"
  }
]
```

补充说明：

- 若某个 `card_key` 尚未写入数据库，前端应按 `is_visible=true` 处理

#### 更新单张卡片展示状态

- `PUT /api/api-config/card-visibility/{card_key}`
- 鉴权：管理员

请求体：

```json
{
  "is_visible": false
}
```

返回示例：

```json
{
  "card_key": "fal",
  "is_visible": false,
  "updated_at": "2026-06-04T10:35:00"
}
```

## 服务商模块 `providers`

路由前缀：`/api/providers`

### 获取服务商列表

- `GET /api/providers`

返回字段重点：

- `id`
- `name`
- `provider_type`
- `base_url`
- `api_key_masked`
- `is_enabled`
- `default_image_watermark`
- `default_video_watermark`
- `is_connected`
- `last_tested_at`

说明：

- `default_image_watermark` / `default_video_watermark` 为服务商级默认 AI 水印开关
- 当前默认值均为 `false`
- 图片/视频生成接口在未显式传 `watermark` 时，会自动继承对应 provider 默认值
- 图片/视频生成链路会按“当前所选模型 -> provider”反查对应服务商凭证，不再默认固定绑到 `OneLinkAI`

### 新建服务商

- `POST /api/providers`

请求体：

```json
{
  "name": "OneLinkAI",
  "provider_type": "onelinkai",
  "base_url": "https://api.onelinkai.com/v1",
  "api_key": "sk-xxx"
}
```

### 更新服务商

- `PATCH /api/providers/{provider_id}`

可更新字段：

- `name`
- `base_url`
- `api_key`
- `is_enabled`
- `default_image_watermark`
- `default_video_watermark`

补充说明：

- `base_url / secondary_base_url` 默认只允许公网 `http/https` 地址，后端会拦截 `localhost`、`127.0.0.1`、`10.x.x.x`、`192.168.x.x`、`172.16-31.x.x` 等内网或本机地址，并返回 `Base URL 不允许指向内网或本机地址`
- 这里校验的是“服务商出站地址”，不是前端页面访问地址；前端本身跑在 `10.20.100.21:5173` 这类局域网地址不影响页面访问，也不应被填入服务商 `Base URL`
- 若联调阶段确实需要把服务商代理指向内网中转服务，可在后端环境变量中显式设置 `ALLOW_PRIVATE_OUTBOUND_URLS=true`；默认保持 `false`，避免 SSRF 风险

### 删除服务商

- `DELETE /api/providers/{provider_id}`

### 测试连通性

- `POST /api/providers/{provider_id}/test`

### 一键配置默认服务商与模型

- `POST /api/providers/oneclick-setup`

请求体：

```json
{
  "api_key": "sk-xxx"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 保存后会自动创建或更新 `OneLinkAI` provider，并同步当前内置预置模型集合
- 当前 OneLinkAI 预置对话模型已包含 `gpt-4o`、`deepseek-v4-pro`、`minimax-m2.7`、`minimax-m3`、`qwen3.7-max`、`qwen3.7-plus` 等文本模型，供剧本页、分镜拆解等 chat 场景直接复用
- OneLinkAI 连通性测试仍走 OpenAI 兼容 `GET /v1/models`，文本调用可直接使用 `chat.completions`

### AI Ping 一键配置配音模型

- `POST /api/providers/aiping-setup`

请求体：

```json
{
  "api_key": "sk-xxx"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 保存后会自动创建或更新 `AI Ping` provider，并启用该 provider
- 当前会自动同步并启用预置配音模型 `MiniMax-Speech-2.8-hd`
- 连通性测试会按 AI Ping 真实 TTS 协议调用 `/api/v1/audio/speech`，而不是走 OpenAI `/v1/models`

### MiniMax 官方一键配置配音模型

- `POST /api/providers/minimax-setup`

请求体：

```json
{
  "api_key": "sk-xxx",
  "base_url": "https://api.minimaxi.com"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 保存后会自动创建或更新官方 `MiniMax` provider，并启用该 provider
- 当前会自动同步官方预置语音模型 `speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo`
- 连通性测试会按 MiniMax 官方 `POST /v1/t2a_v2` 协议执行，而不是走 OpenAI `/v1/models`

### Volcengine 一键配置模型与语音能力

- `POST /api/providers/volcengine-setup`

请求体：

```json
{
  "ark_api_key": "ark-xxx",
  "voice_api_key": "volc-xxx",
  "ark_base_url": "https://ark.cn-beijing.volces.com/api/v3",
  "voice_base_url": "https://openspeech.bytedance.com"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 当前使用双凭证模式：`ark_api_key` 用于模型能力，`voice_api_key` 用于语音能力。
- `ark_base_url`、`voice_base_url` 均可省略，后端会回退到当前预置的火山引擎默认地址。
- 保存后会自动创建或更新 `Volcengine` provider，并同步预置模型。
- 连通性测试会同时校验主凭证与语音凭证可用性。

### Vidu 官方一键配置图片/视频模型

- `POST /api/providers/vidu-setup`

请求体：

```json
{
  "api_key": "sk-xxx"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 保存后会自动创建或更新官方 `Vidu` provider，并启用该 provider
- 当前会自动同步官方预置模型到 `image` / `video` 分类，供创作页、主体页、分镜页、工作台等多个入口复用
- 一个 `Vidu API Key` 可复用多个官方 Vidu 模型，不需要为每个模型单独建 provider
- 连通性测试会按 Vidu 官方协议发送 `Authorization: Token {api_key}`，并走官方 `/ent/v2/...` 路径，而不是 OpenAI `/v1/models`

### fal 官方一键配置图片/视频模型

- `POST /api/providers/fal-setup`

请求体：

```json
{
  "api_key": "fal-xxx"
}
```

返回重点：

- `provider`
- `models`
- `test_success`
- `test_message`

说明：

- 保存后会自动创建或更新官方 `fal` provider，并启用该 provider
- 当前会自动同步第二阶段预置模型：图片 `fal-ai/flux/dev`、`fal-ai/flux/schnell`，视频 `fal-ai/stable-video`、`fal-ai/wan-flf2v`，Kling V3 Standard / Pro 的文生、图生、运动控制端点，以及 Seedance 2.0 系列 `bytedance/seedance-2.0/text-to-video`、`bytedance/seedance-2.0/fast/text-to-video`、`bytedance/seedance-2.0/image-to-video`、`bytedance/seedance-2.0/fast/image-to-video`、`bytedance/seedance-2.0/reference-to-video`、`bytedance/seedance-2.0/fast/reference-to-video`
- 上述 `fal` 预置模型当前统一按“默认关闭、默认不设为该分类默认模型”落库；后续是否启用、是否设默认，交由 API 配置页手动控制
- provider `base_url` 当前固定使用官方 `https://api.fal.ai`
- 连通性测试会按 fal Platform API 协议发送 `Authorization: Key {api_key}`，并探测 `/v1/models?limit=1`
- 当前能力收口：
  - `fal-ai/flux/dev` 支持纯文生图，允许 `1-4` 张输出
  - `fal-ai/flux/schnell` 当前保守按单张文生图接入
  - `fal-ai/stable-video` 当前走首帧图生视频
  - `fal-ai/wan-flf2v` 当前走首尾帧视频生成，要求同时提供 `start_image_url` 与 `end_image_url`
  - `fal-ai/kling-video/v3/standard/*` 与 `fal-ai/kling-video/v3/pro/*` 当前按文生、图生、运动控制三条视频链路收口；其中文生 / 图生保留 `generate_audio`、`aspect_ratio` 与 `duration`，运动控制当前按 `image_url + video_url` 接入并固定 `character_orientation=video`
  - Seedance 2.0 系列当前收口为文生视频、图生视频、参考生视频三条标准 / Fast 视频链路；标准版支持 `1080P`，Fast 版收敛到 `720P`

## 模型配置模块 `models`

路由前缀：`/api/models`

### 获取模型列表

- `GET /api/models`

常用查询参数：

- `category?`

补充说明：

- 若当前用户已配置 `OneLinkAI`、`AI Ping`、官方 `MiniMax`、官方 `Vidu` 或官方 `fal` provider，后端会在读取模型列表前自动补齐对应预置模型
- `AI Ping` 当前会自动补齐 `MiniMax-Speech-2.8-hd` 到 `voice` 分类
- 官方 `MiniMax` 当前会自动补齐 `speech-2.8-hd / speech-2.8-turbo / speech-2.6-hd / speech-2.6-turbo` 到 `voice` 分类
- 官方 `Vidu` 当前会自动补齐图片模型 `image-vidu-q2`，以及视频模型 `viduq3-pro / viduq3-turbo / viduq3-pro-fast / viduq3-mix / viduq2-pro / viduq2-turbo`
- 官方 `fal` 当前会自动补齐图片模型 `fal-ai/flux/dev / fal-ai/flux/schnell`，以及视频模型 `fal-ai/stable-video / fal-ai/wan-flf2v / fal-ai/kling-video/v3/* / bytedance/seedance-2.0/*`
- `fal` 预置模型补齐后默认均为 `is_enabled=false`、`is_default=false`
- `OneLinkAI` 当前对话模型已扩展为 `gpt-4o / deepseek-v4-pro / deepseek-v4-flash / GLM-5.1 / mimo-v2-pro / minimax-m2.7 / minimax-m3 / step-3.5-flash / doubao-seed-2.0-lite-260215 / doubao-seed-2.0-pro-260215 / qwen3.7-max / qwen3.7-plus / qwen-long / kimi-k2-thinking`
- 若 OneLinkAI Base URL 按 OpenAI SDK 示例填写为 `https://api.onelinkai.cloud/v1`，后端会自动规整到稳定基地址，避免内部再次拼接 `/v1` 后出现重复路径
- `OneLinkAI` 当前保留的豆包视频模型为 `doubao-seedance-1.5-pro / doubao-seedance-2.0 / doubao-seedance-2-0-fast`；豆包图片模型 `doubao-seedream-5.0-lite / doubao-seedream-4.5 / doubao-seedream-4.0` 继续保留
- `OneLinkAI` 下的 `doubao-seedream-5.0-lite / 4.5 / 4.0` 已按豆包官方图片生成文档收口：支持文生图、单图/多图参考生图，以及文生/单图/多图参考组图；参考图最多 `14` 张，且参考图数量 + 生成数量总和最多 `15`
- 当前后端继续沿用 `OneLinkAI` provider 已保存的默认 Base URL 与 API Key，不会强改成豆包官方地址；仅在请求体层按官方参数补齐为 `image=string|array` 与 `sequential_image_generation=auto|disabled`，以适配 OneLinkAI 透传官网能力的场景
- 2026-06-22：`doubao-seedream-5.0-lite / 4.5 / 4.0` 已补全官方可选参数透传（详见 `docs/plans/seedream5.0-image-capabilities-completion.md`）：组图上限由 4 放开到 15；新增 `output_format`(png/jpeg，仅 5.0-lite)、`response_format`(url/b64_json)、`web_search`(仅 5.0-lite，透传 `tools:[{type:web_search}]`)、`optimize_prompt`(standard/fast)、`stream` 流式输出；新增流式路由 `POST /api/creation/images/generate/stream`（SSE：`event: task/image/done/error`）。模型 ID 仍为 `doubao-seedream-5.0-lite`（官方原生 `doubao-seedream-5-0-260128` 由 OneLinkAI 映射）
- `doubao-seedance-2.0 / doubao-seedance-2-0-fast` 的能力事实源已按《Doubao Seedance 2.0 系列教程》收口：两者能力类型一致，均支持文生、首帧、首尾帧、多模态参考、视频编辑、延长视频、联网搜索、样片模式、返回尾帧与离线推理；其中标准版支持 `480P / 720P / 1080P`，Fast 版支持 `480P / 720P`
- 多模态参考当前按官方口径限制为：图片最多 `9` 张、视频最多 `3` 个、音频最多 `3` 个，参考素材总数最多 `15`；同时不支持“文本+音频”或纯音频输入
- `doubao-seedance-2-0-fast` 在带参考视频的场景下，若参考视频像素总量超过上游阈值（当前错误文案常见为 `<= 2086876`，约等于 `1920x1080`），上游会返回 `content[n] InvalidParameter`
- 当前后端会在把本地 / 私网托管的参考视频提交给上游前，先探测分辨率；若超过 `1080P` 级别，会自动压缩并转成新的托管 MP4 后再上传给上游，减少 `reference_video` 因像素过大直接失败
- 若运行环境未安装 `ffprobe / ffmpeg`，当前后端会降级为继续沿用原参考视频地址，而不是直接因“无法自动压缩”中断整条生成链路；此时仅失去自动压缩优化，若原视频确实超过上游像素阈值，最终仍会由上游返回“参考视频像素过大”的明确错误
- 若参考视频本身已是公网 URL，当前仍沿用原地址直传；这类外部视频若本身超过上游像素阈值，后端仍会继续翻译成“参考视频像素过大”的明确错误
- `OneLinkAI` 当前已新增 Veo 单模型 `veo-3.1-generate-preview`，供创作页与分镜页继续复用现有视频生成接口调用
- `GET /api/models` 读取 OneLinkAI 模型前，会先同步预置模型并自动清理旧的 Seedance 历史别名，不再把旧别名继续返回给前端
- `OneLinkAI` 不再同步 `TTS-1`；旧库里若仍有 `tts-1` 记录，会在读取模型列表时自动禁用，避免继续暴露到前端
- 兼容旧请求：若历史前端仍传 `model=tts-1`，后端会优先回退到当前已启用的 `voice` 默认模型，而不是直接把旧模型继续暴露出来
- `GET /api/models` 返回中已补 `provider_type / provider_name`，供前端按模型真实归属做 provider-aware 判断
- `GET /api/models` 与 `GET /api/models/defaults` 当前会继续返回轻量 `capabilities` 运行时能力字段，供创作页、主体、分镜与批量生成入口动态渲染分辨率、比例、时长等参数；该字段不再用于 API 配置弹窗里的“能力表”展示
- `POST /api/models` 与 `PATCH /api/models/{model_id}` 仍只返回模型配置本身，不额外承担能力表 UI 语义

### 新建模型

- `POST /api/models`

请求体：

```json
{
  "provider_id": "uuid",
  "name": "GPT-4.1",
  "model_id": "gpt-4.1",
  "category": "chat",
  "description": "对话模型",
  "is_enabled": true,
  "is_default": false
}
```

### 更新模型

- `PATCH /api/models/{model_id}`

可更新字段：

- `is_enabled`
- `is_default`
- `name`
- `description`

补充说明：

- 当 `is_default=true` 时，后端会自动清理同分类下其它默认模型，并确保当前模型处于启用状态
- 当禁用当前默认模型，或显式传 `is_default=false` 时，会同步清掉该模型的默认标记，避免“默认模型已停用”这种失真状态

### 删除模型

- `DELETE /api/models/{model_id}`

### 获取默认模型集合

- `GET /api/models/defaults`

### 获取模型资产绑定能力

- `GET /api/models/{model_id}/asset-capabilities`
- 鉴权：是

说明：

- 用于给创作页、分镜视频面板等前端入口动态查询当前模型支持的参考素材类型与数量限制
- 仅返回当前登录用户有权限访问的模型；若模型不存在或不属于当前用户，返回 `404`
- 当前返回结构基于 `backend/app/services/model_capabilities.py` 的统一模型能力事实源生成，不依赖额外数据库表

返回示例：

```json
{
  "model": "doubao-seedance-2.0",
  "model_name": "Seedance 2.0",
  "category": "video",
  "asset_capabilities": {
    "reference_video": {
      "enabled": true,
      "max_count": 3,
      "max_duration_seconds": null,
      "supported_formats": ["mp4", "mov"],
      "notes": "支持参考视频动作迁移"
    },
    "reference_audio": {
      "enabled": true,
      "max_count": 3,
      "max_duration_seconds": null,
      "supported_formats": ["mp3", "wav"],
      "notes": "支持参考音频驱动"
    },
    "reference_image": {
      "enabled": true,
      "max_count": 9,
      "roles": ["character", "scene", "prop", "reference"],
      "notes": null
    },
    "first_last_frame": {
      "enabled": true,
      "notes": "支持首尾帧图片控制"
    },
    "subjects": {
      "enabled": false,
      "max_subjects": 0,
      "max_images_per_subject": 0,
      "notes": "支持多主体参考图片"
    },
    "multiframe": {
      "enabled": false,
      "max_segments": 0,
      "notes": "支持多帧分段控制"
    },
    "total_attachments": {
      "max_count": 15,
      "notes": "所有类型资产总数限制"
    }
  }
}
```

前端使用建议：

- 用 `reference_video.enabled / reference_audio.enabled / reference_image.enabled` 控制对应上传入口是否展示
- 用 `max_count` 和 `total_attachments.max_count` 在前端做即时数量提示，但最终仍以后端校验为准
- 若要兼容历史参数与新 `attachments[]` 协议，可继续共用现有视频生成请求体，后端会统一归并和校验

## 项目模块 `projects`

路由前缀：`/api/projects`

### 获取项目列表

- `GET /api/projects`

常用查询参数：

- `search?`

说明：

- 当前代码层正式支持的是 `search`
- 若前端产品层内部仍保留 `keyword` 搜索态，建议在 `src/api/project.js` 适配层统一翻译成 `search`

返回重点：

- 项目基本信息
- 封面：
  - `cover_url`：原始封面图
  - `cover_thumbnail_url`：项目列表等卡片展示用缩略图
- 画幅比例
- 风格
- 时间字段

### 新建项目

- `POST /api/projects`

请求体：

```json
{
  "name": "短剧项目 A",
  "description": "项目描述",
  "aspect_ratio": "16:9",
  "visual_style": "电影感",
  "project_type": "video",
  "cover_url": "/uploads/images/demo.png"
}
```

说明：

- `visual_style` 支持三种值：
  - 内置风格 ID，例如 `xianxia-3d`
  - 用户自定义风格值，例如 `custom:{style_id}`
  - 兼容旧数据的自由文本
- 项目相关返回会额外携带 `visual_style_label`，用于前端直接展示风格名称
- 若本次创建带封面，后端会在保存原始 `cover_url` 的同时，自动生成卡片展示用 `cover_thumbnail_url`

### 获取项目详情

- `GET /api/projects/{project_id}`

### 更新项目

- `PATCH /api/projects/{project_id}`

可更新字段：

- `name`
- `description`
- `cover_url`
- `aspect_ratio`
- `visual_style`
- `project_type`
- `language`
- `notes`
- `status`

### 删除项目

- `DELETE /api/projects/{project_id}`

### 获取项目概览

- `GET /api/projects/{project_id}/overview`

适合首页/项目总览页使用，返回重点：

- `asset_counts`
- `storyboard_thumbnails`
- `episode_progress`

### 打包下载项目资产

- `POST /api/projects/{project_id}/assets/download`

说明：

- 返回 ZIP 文件流
- 会按资产类别打包
- 当前打包前会先按资产类型统一生成媒体 `download_url`，若该地址已切到受控 token 路由，则会先在服务端完成用户校验与真实下载目标解析，再读取实际文件内容
- 适合项目归档/整包下载

## 分集模块 `episodes`

路由前缀：`/api/projects/{project_id}/episodes`

### 获取分集列表

- `GET /api/projects/{project_id}/episodes`

### 新建分集

- `POST /api/projects/{project_id}/episodes`

请求体：

```json
{
  "title": "第1集",
  "episode_number": 1,
  "content": "",
  "summary": ""
}
```

### 更新分集

- `PATCH /api/projects/{project_id}/episodes/{episode_id}`

可更新字段：

- `title`
- `content`
- `summary`
- `status`

常见状态：

- `draft`
- `scripted`
- `extracted`
- `storyboarded`

### 删除分集

- `DELETE /api/projects/{project_id}/episodes/{episode_id}`

### AI 生成分集剧本

- `POST /api/projects/{project_id}/episodes/{episode_id}/generate`

请求体重点：

- `prompt`
- `model?`

### 流式生成分集剧本

- `POST /api/projects/{project_id}/episodes/{episode_id}/generate/stream`

说明：

- 流式返回
- 适合编辑器增量展示

## 剧本上传模块 `upload`

路由前缀：`/api/projects/{project_id}/episodes`

### 上传剧本文档

- `POST /api/projects/{project_id}/episodes/{episode_id}/upload`
- Content-Type：`multipart/form-data`

表单字段：

- `file`

支持格式：

- `txt`
- `md`
- `markdown`
- `doc`
- `docx`

效果：

- 解析文件内容
- 写入对应分集 `content`

## 主剧本工作区模块 `project_scripts`

路由前缀：`/api/projects/{project_id}/script-workspace`

用途说明：

- 这组接口服务的是“整稿工作区”，不是普通单分集 CRUD。
- 适合承接：项目主剧本编辑、上传整稿、AI 对话生成整稿、拆分预览、正式拆分、整稿历史版本恢复。
- 与 `episodes` 的职责边界：
  - `episodes` 负责正式分集数据
  - `script-workspace` 负责“主剧本草稿/整稿工作区”及其拆分编排

### 获取主剧本工作区

- `GET /api/projects/{project_id}/script-workspace`

返回重点：

- `script`
- `messages`

其中 `script` 常见字段：

- `id`
- `project_id`
- `source_type`
- `title`
- `content`
- `parsed_content`
- `status`
- `last_uploaded_filename`
- `last_uploaded_file_type`
- `created_at`
- `updated_at`

### 上传主剧本文档

- `POST /api/projects/{project_id}/script-workspace/upload`
- `multipart/form-data`

表单字段：

- `file`

说明：

- 当前支持 `txt / md / markdown / doc / docx / pdf`
- 上传后会写入主剧本工作区，而不是直接覆盖正式分集
- 成功后会自动创建一条脚本历史记录

### 更新主剧本内容

- `PATCH /api/projects/{project_id}/script-workspace`

请求体示例：

```json
{
  "title": "项目主剧本",
  "content": "第一集
......"
}
```

说明：

- 当前主要用于手动编辑整稿
- 若 `content` 非空，后端会把 `status` 置为 `parsed`
- 成功保存后会新增一条 `manual` 历史版本

### 与主剧本对话生成

- `POST /api/projects/{project_id}/script-workspace/chat`

请求体示例：

```json
{
  "message": "请基于当前项目生成 3 集短剧整稿",
  "episode_count": 3,
  "model": "gpt-4.1",
  "apply_to_script": true
}
```

返回重点：

- `script`
- `messages`

说明：

- `messages` 为整稿工作区的对话消息记录
- `apply_to_script=true` 时，AI 结果会回写到当前主剧本工作区
- 当用户指令语义明确属于“续写 / 接着写 / 继续写 / 新增分集”时，后端会将新增内容追加到当前整稿末尾，而不是直接覆盖旧整稿
- 若续写结果中的分集标题仍从 `第1集 / 第2集` 起号，后端会按当前整稿已存在的最大集数自动顺延编号，再写回工作区
- 当用户指令语义属于“重写 / 改写 / 优化整稿”等整稿替换场景时，仍保持覆盖当前主剧本工作区的既有语义
- `episode_count` 为可选目标集数；传入后后端会把该数字作为 chat 阶段的整稿生成约束带入模型上下文，尽量按对应集数输出 `第1集 / 第2集 / ...`

### 获取拆分预览

- `POST /api/projects/{project_id}/script-workspace/split-preview`

请求体示例：

```json
{
  "episode_count": 3,
  "model": "gpt-4.1",
  "split_mode": "rule_first"
}
```

返回重点：

- `items`
  - `episode_number`
  - `title`
  - `summary`
  - `content`
- `split_source`

说明：

- `split_source` 常见为 `rule` 或 `ai`
- 该接口只做预览，不直接写正式分集

### 按预览结果应用拆分

- `POST /api/projects/{project_id}/script-workspace/apply-split`

请求体：

```json
{
  "items": [
    {
      "episode_number": 1,
      "title": "第1集",
      "summary": "冲突建立",
      "content": "......"
    }
  ]
}
```

说明：

- 当前独立视频创建响应仍是任务对象，前端必须按 `taskId -> 轮询 -> 刷新真实历史列表/详情` 承接，不把提交响应误当最终结果
- 创作页刷新恢复时，应优先读取真实 `GET /api/creation/videos` 历史结果；本地 pending task 仅承担刷新前后的过渡恢复

返回重点：

- `replaced_count`
- `created_count`
- `script_status`

### 正式定稿并拆分分集

- `POST /api/projects/{project_id}/script-workspace/finalize`

请求体示例：

```json
{
  "episode_count": 3,
  "model": "gpt-4.1",
  "split_mode": "rule_first",
  "auto_extract_subjects": true
}
```

返回重点：

- `replaced_count`
- `created_count`
- `script_status`
- `selected_episode_number`
- `backup_history_id`
- `items`
- `split_source`
- `extracted_episode_count`
- `subject_created_count`
- `subject_updated_count`
- `failed_episode_numbers`

说明：

- 该接口会把主剧本正式拆成 `episodes`，并可按配置自动触发主体提取
- `backup_history_id` 可用于后续回滚或追查定稿前版本

### 从主剧本提取全局主体

- `POST /api/projects/{project_id}/script-workspace/extract-subjects`

返回重点：

- `created`
- `updated`

说明：

- 该接口偏向“项目级主体抽取”，不是针对单个正式分集的 `subjects/extract?episode_id=` 替代品

### 获取主剧本历史版本列表

- `GET /api/projects/{project_id}/script-workspace/history`

### 获取单条历史版本详情

- `GET /api/projects/{project_id}/script-workspace/history/{history_id}`

返回重点：

- `id`
- `version_number`
- `source_type`
- `source_detail`
- `history_kind`
- `content`
- `episode_count`
- `snapshot_payload`
- `created_at`

### 恢复历史版本

- `POST /api/projects/{project_id}/script-workspace/history/{history_id}/restore`

返回重点：

- `script`
- `messages`

## 主体模块 `subjects`

路由前缀：`/api/projects/{project_id}/subjects`

### 获取主体列表

- `GET /api/projects/{project_id}/subjects`

常用筛选参数：

- `type?`
- `episode_id?`
- `keyword?`

### 获取主体详情

- `GET /api/projects/{project_id}/subjects/{subject_id}`

返回重点：

- `subject`
- `primary_image`
- `candidate_images`
- `reference_images`
- `latest_generate_config`

其中 `latest_generate_config` 当前约定：

- `input_prompt`：用户最近一次提交的原始提示词，前端输入框回显优先使用它
- `prompt`：兼容字段，当前同样返回原始输入提示词；实际增强后的生图 prompt 不再直接用于输入框回显

其中 `primary_image` 与 `candidate_images[*]` 当前还会附带历史图详情字段，供前端“生图历史记录”回看使用：

- `input_prompt`：生成该张图片时记录的原始提示词
- `prompt`：生成该张图片的提示词字段
- `model`
- `size`
- `ratio`
- `resolution`
- `generation_mode`
- `reference_mode`
- `reference_images`：该张图片记录到的参考图快照列表；若历史数据未保存，则返回空数组，不做伪造补全
- `created_at`

图片媒体字段当前已统一按“卡片预览 / 详情预览 / 原图下载”三层语义返回：

- `thumbnail_url`：主体卡片与右侧历史图区优先使用的轻量缩略图
- `preview_url`：详情查看优先使用的高质量预览图；若当前没有独立预览图，会回退原图
- `download_url`：下载原图优先使用的原始文件地址
- `preview_ready`：当前是否已有可用于回显的预览资源

### 新建主体

- `POST /api/projects/{project_id}/subjects`

主体通用字段很多，最常用的是：

```json
{
  "type": "character",
  "name": "主角",
  "role": "主角",
  "description": "高中生，热血",
  "appearance": "黑发，校服",
  "personality": "冲动，正义感强",
  "prompt": "二次元热血少年",
  "episode_id": "uuid",
  "is_global": true,
  "voice_id": "uuid"
}
```

按类型扩展字段：

- 角色：`age` `gender` `background`
- 场景：`scene_type` `time_setting` `atmosphere`
- 道具：`importance` `owner_subject_id`

### 更新主体

- `PATCH /api/projects/{project_id}/subjects/{subject_id}`

支持大部分字段按需更新。

### 删除主体

- `DELETE /api/projects/{project_id}/subjects/{subject_id}`

### 从分集剧本提取主体

- `POST /api/projects/{project_id}/subjects/extract`

用途：

- 从某一集剧本中提取角色/场景/道具
- 当前主体提取已按“剧本拆解主体 skills 层”执行：会先做剧情分段，再提取角色、场景、道具，并做去重归并与重要度筛选
- 当前返回/落库重点字段包括：
  - 角色：`name / role / description / appearance / personality / age / gender / background / prompt`
  - 场景：`name / description / scene_type / time / atmosphere / prompt`
  - 道具：`name / description / owner / importance / prompt`
- 其中 `prompt` 现已收口为“结合剧本事实自动生成的详细中文提示词”，主体页右侧编辑面板会优先展示该字段，不再只回退 `description`

### 基于主体描述梗概提取结构化字段

- `POST /api/projects/{project_id}/subjects/{subject_id}/extract-fields`

用途：

- 基于主体页右侧“描述”输入框中的梗概文本，补充该主体的结构化信息
- 适合用户先写一段角色 / 场景 / 道具梗概，再让 AI 自动整理成可继续编辑的字段

请求体示例：

```json
{
  "name": "林秋",
  "description": "本作核心角色，首次出现在晨光中的小镇与静谧房间中，似乎肩负某种未知使命。"
}
```

### 基于当前分集剧本抽取目标场景梗概

- `POST /api/projects/{project_id}/subjects/{subject_id}/extract-scene-summary`

用途：

- 针对单个 `scene` 主体，从其所属正式分集剧本中自动抽取“目标场景”的描述性梗概
- 适合主体页场景编辑面板在描述为空时，自动补齐描述框，而不是让用户先手动写一版梗概

使用约束：

- 仅 `type=scene` 的主体可调用
- 该场景必须已绑定 `episode_id`
- 对应分集必须已有正式 `content`

返回重点：

- `description`：1-3 句中文场景梗概，突出空间样貌、关键陈设、剧情作用与可视化氛围
- `time_setting`
- `atmosphere`
- `scene_type`

返回字段重点：

- 通用：`type`
- 角色：`role / appearance / personality / age / gender / background`
- 场景：`scene_type / time_setting / atmosphere`
- 道具：`importance`

说明：

- 该接口只返回结构化提取结果，不会直接改库
- 前端当前口径为：先调用本接口展示提取结果，再由用户继续修改，最终仍通过 `PATCH /subjects/{subject_id}` 保存
- 若 `description` 为空，接口返回 `400`

### 上传主体参考图

- `POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/upload`
- Content-Type：`multipart/form-data`

### 绑定已有资产为参考图

- `POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind`

请求体：

```json
{
  "asset_ids": ["uuid1", "uuid2"],
  "primary_asset_id": "uuid1"
}
```

### 生成主体图片

- `POST /api/projects/{project_id}/subjects/{subject_id}/generate-image`
- 后端默认约定：当主体类型为 `character / prop` 时，若请求提示词里未显式包含“纯白背景”语义，后端会在最终生成提示词末尾自动补充 `纯白色背景 / pure white background` 约束，尽量统一输出纯白底主体图
- 角色多视图仍继续兼容 `generation_mode=three_view`；但当前后端对该枚举的实际编排语义已升级为“四视图角色参考板”，会明确要求模型输出：
  - 面部特写
  - 正面全身
  - 侧面全身
  - 背面全身
- 上述四个视图会被要求保持同一角色身份、服装材质和配饰一致，并继续强约束 `pure white background`，避免角色参考板落到灰底或场景底
- `input_prompt` 仍用于保存和回显用户原始输入；后端增强后的四视图最终 prompt 不直接暴露到前端输入框

请求体示例：

```json
{
  "input_prompt": "电影感女性角色立绘",
  "prompt": "电影感女性角色立绘",
  "model": "gpt-image-2",
  "size": "1024x1024",
  "watermark": false,
  "ratio": "1:1",
  "resolution": "1K",
  "generation_mode": "single",
  "reference_mode": "subject"
}
```

### 获取主体图片列表

- `GET /api/projects/{project_id}/subjects/{subject_id}/images`

返回的每一项主体图片对象当前与 `SubjectImageResponse` 对齐，重点字段包括：

- `id`
- `subject_id`
- `image_url`
- `asset_id`
- `is_primary`
- `input_prompt`
- `prompt`
- `model`
- `size`
- `ratio`
- `resolution`
- `generation_mode`
- `reference_mode`
- `reference_images`
- `thumbnail_url`
- `preview_url`
- `download_url`
- `preview_ready`
- `created_at`

### 设置主体定版图

- `PATCH /api/projects/{project_id}/subjects/{subject_id}/images/{image_id}/set-primary`

### 删除主体图片

- `DELETE /api/projects/{project_id}/subjects/{subject_id}/images/{image_id}`

### 下载主体图片

- `GET /api/projects/{project_id}/subjects/{subject_id}/images/{image_id}/download`

### 批量生成主体图

- `POST /api/projects/{project_id}/subjects/batch-generate`
- 与单图生成保持同一提示词收口规则：`character / prop` 会默认补纯白背景约束，`scene` 不会自动追加该限制

请求体重点：

- `subject_ids`
- `prompt?`
- `model?`
- `size?`
- `watermark?`

### 复制主体

- `POST /api/projects/{project_id}/subjects/{subject_id}/duplicate`

请求体：

```json
{
  "target_episode_id": "uuid",
  "as_global": false
}
```

## 资产模块 `assets`

路由前缀：`/api/assets`

### 获取资产列表

- `GET /api/assets`

常用查询参数：

- `project_id?`
- `scope?`：`project | creation`
- `asset_type?`
- `category?`
- `is_starred?`
- `is_primary?`
- `search?`
- `include_deleted?`
- `deleted_only?`
- `limit?`：默认 `100`，最大 `200`
- `offset?`：默认 `0`

说明：

- 当前资产列表接口已支持 `limit/offset` 的数据库层真实分页；为兼容既有前端，返回结构仍保持“数组列表”而不是额外分页对象
- `search` 是当前正式关键词参数；若前端历史状态仍保留 `keyword`，建议在 `src/api/` 适配层统一翻译
- `scope=project` 仅返回项目域资产，`scope=creation` 仅返回创作域资产
- `include_deleted / deleted_only` 主要用于回收站或后台排障场景，普通前端页面通常不需要传
- 列表默认响应已收口为轻量口径：`metadata_json` 只保留卡片首屏所需的时长、缩略图、分辨率、比例等轻量字段，`reference_image_urls` 默认不再随列表返回；若需要完整元数据，请改读资产详情接口

### 获取资产详情

- `GET /api/assets/{asset_id}`

### 下载资产文件

- `GET /api/assets/{asset_id}/download`

常用查询参数：

- `prefer_origin?`：默认 `true`

说明：

- 当前默认先按统一媒体解析后的 `download_url` 尝试读取；当该地址已切到受控 token 路由时，接口会先在服务端完成用户校验与真实下载目标解析，再继续读取实际文件内容
- `prefer_origin=true` 时，会优先尝试原始下载链路，再回退到当前托管文件地址；`prefer_origin=false` 时，会优先尝试当前托管文件地址，再回退到原始下载链路
- 适合资产库、创作结果区、项目归档等需要稳定下载入口的场景
- 若资产已被软删除，当前接口仍会尝试在 `include_deleted=true` 范围内查找，便于兜底下载历史文件

### 新建资产记录

- `POST /api/assets`

请求体示例：

```json
{
  "project_id": "uuid",
  "subject_id": "uuid",
  "name": "角色定版图",
  "asset_type": "image",
  "category": "character",
  "file_url": "/uploads/images/demo.png",
  "thumbnail_url": "/uploads/images/demo-thumb.png",
  "prompt": "电影感角色立绘",
  "model": "gpt-image-2",
  "size": "1024x1024",
  "is_primary": true,
  "is_starred": false,
  "metadata_json": {
    "source": "manual"
  },
  "description": "角色主视觉"
}
```

### 更新资产

- `PATCH /api/assets/{asset_id}`

可更新字段：

- `name`
- `is_primary`
- `is_starred`
- `category`
- `metadata_json`
- `subject_id`
- `description`
- `reference_image_urls`

### 删除资产

- `DELETE /api/assets/{asset_id}`

### 批量删除资产

- `POST /api/assets/batch-delete`

请求体：

```json
{
  "asset_ids": ["uuid1", "uuid2"]
}
```

### 提取视频首帧/尾帧

- `POST /api/assets/{asset_id}/extract-frame`
- 鉴权：是

请求体：

```json
{
  "position": "first"
}
```

字段说明：

- `position`：仅支持 `first | last`

行为说明：

- 仅支持 `asset_type = video` 的资产
- 后端会基于托管视频文件真实提取首帧或尾帧
- 提取结果会新建一条 `image` 资产并返回该图片资产信息
- 若源视频属于创作来源，提取后的图片会进入创作图片列表；否则按原资产归属进入对应资产域

常见错误：

- `400`：不是视频资产，或 `position` 非法
- `404`：资产不存在，或底层托管视频文件不存在
- `500`：FFmpeg/FFprobe 缺失，或提帧过程失败

### 确保视频缩略图

- `POST /api/assets/{asset_id}/ensure-thumbnail`
- 鉴权：是

行为说明：

- 仅支持 `asset_type = video` 的资产
- 当视频资产已有 `thumbnail_url` 时，接口直接返回当前资产，不会重复生成
- 当视频资产缺少 `thumbnail_url` 时，后端会按首帧自动生成封面，并把生成结果回写到原视频资产的 `thumbnail_url`
- 适合前端视频卡片在发现“有视频、无封面”时做自动补图

常见错误：

- `400`：不是视频资产，或当前视频资产缺少文件地址
- `404`：资产不存在，或底层托管视频文件不存在
- `500`：FFmpeg/FFprobe 缺失，或自动补封面失败

## 分镜模块 `storyboards`

路由前缀：`/api/projects/{project_id}/storyboards`

### 获取分镜列表

- `GET /api/projects/{project_id}/storyboards`

常用参数：

- `episode_id?`
- `limit?`：默认 `100`，最大 `200`
- `offset?`：默认 `0`
- `include_gen_params?`：默认 `false`

说明：

- 当前分镜列表接口已支持 `limit/offset` 的数据库层真实分页；为兼容既有前端，返回结构仍保持“数组列表”
- 默认列表口径不再返回完整 `gen_params`，而是返回 `gen_params=null`；若确实需要完整提示词层或其他扩展生成参数，可显式传 `include_gen_params=true`，或在拿到单条分镜 ID 后继续请求详情接口

### 新建分镜

- `POST /api/projects/{project_id}/storyboards`

请求体通常包含镜头基础信息，例如：

- `episode_id`
- `shot_number`
- `title`
- `description`
- `dialogue`
- `camera_movement`
- `duration`
- `sort_order`

### 更新分镜

- `PATCH /api/projects/{project_id}/storyboards/{storyboard_id}`

支持大部分镜头字段更新。

### 删除分镜

- `DELETE /api/projects/{project_id}/storyboards/{storyboard_id}`

### 调整分镜顺序

- `POST /api/projects/{project_id}/storyboards/reorder`

请求体：

```json
{
  "ordered_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### 从分集一键生成分镜

- `POST /api/projects/{project_id}/storyboards/generate`

请求体：

```json
{
  "episode_id": "uuid",
  "model": "gpt-4.1"
}
```

说明：

- 当前接口是“当前分集最小闭环”入口
- 若该分集已有分镜，接口会直接返回当前分镜列表，不再重复追加同一集分镜
- 首次成功生成后，后端会把对应分集状态推进到 `storyboarded`

### 从主剧本批量生成分镜

- `POST /api/projects/{project_id}/storyboards/generate-from-final-script`

请求体：

```json
{
  "model": "gpt-4.1",
  "episode_count": 3,
  "split_mode": "rule_first",
  "continue_in_background": true
}
```

返回值示例：

```json
{
  "id": "task-uuid",
  "task_type": "storyboard_generate",
  "status": "pending",
  "total_count": 0,
  "success_count": 0,
  "fail_count": 0,
  "params": {
    "source": "storyboard_generate_from_final_script",
    "current_stage": "queued",
    "stage_label": "等待执行",
    "status_message": "已创建智能分镜任务，等待开始执行",
    "overwrite_existing": true,
    "target_episode_ids": [],
    "queued_episode_numbers": [],
    "completed_episode_numbers": [],
    "failed_episode_numbers": [],
    "warning_messages": []
  },
  "results": []
}
```

返回重点：

- `id`
- `task_type`
- `status`
- `total_count`
- `success_count`
- `fail_count`
- `params.source`
- `params.current_stage`
- `params.stage_label`
- `params.status_message`
- `params.overwrite_existing`
- `params.target_episode_ids`
- `params.queued_episode_numbers`
- `params.completed_episode_numbers`
- `params.failed_episode_numbers`
- `params.current_episode_id`
- `params.current_episode_number`
- `params.current_episode_title`
- `params.last_completed_episode_id`
- `params.last_completed_episode_number`
- `params.last_completed_episode_title`
- `params.total_storyboard_count`
- `params.warning_messages`
- `results[].episode_id`
- `results[].episode_number`
- `results[].title`
- `results[].storyboard_count`
- `results[].status`
- `results[].error`

说明：

- 当前接口是“开始智能分镜”的真实主入口，语义为“基于定稿主剧本批量生成全部正式分集分镜”
- 接口会立即返回任务对象，后续由后台长任务继续执行
- 页面侧必须按 `taskId -> 轮询 -> 刷新分镜/分集` 承接，不把创建响应误当最终结果
- 若当前主体库为空，任务不会直接失败，而会在 `params.warning_messages` 中记录提示
- 每集分镜写入时还会把 `beat_refs / story_beat_count / target_shot_count / generation_source` 等抽镜元信息沉到分镜 `gen_params`，用于回查 story beat 与目标镜头数口径
- 终态可能为：
  - `completed`：全部分集成功
  - `partial`：部分成功、部分失败
  - `failed`：当前批量任务未产出可展示结果

### 生成分镜图片

- `POST /api/projects/{project_id}/storyboards/{storyboard_id}/generate-image`

返回值示例：

```json
{
  "id": "task-uuid",
  "task_type": "sb_image",
  "status": "pending",
  "project_id": "project-uuid",
  "params": {
    "storyboard_id": "storyboard-uuid",
    "generation_mode": "image_to_image",
    "count": 2
  },
  "results": []
}
```

请求体：

```json
{
  "prompt": "电影感雨夜追逐镜头",
  "model": "gpt-image-2",
  "size": "1792x1024",
  "reference_images": [
    "/uploads/storyboards/project-uuid/ref-1.png",
    "https://example.com/reference-2.png"
  ]
}
```

- `reference_images` / `referenceImages` 可选
- 若本次请求未显式传入参考图，则后端会回退到当前 storyboard 已保存的 `reference_image_urls`
- 若本次请求未显式传入 `aspect_ratio / aspectRatio`，后端会回退到当前项目的 `aspect_ratio`
- 当前接口已切为真正任务制：请求会立即返回 `task_id`
- 前端应轮询 `GET /api/tasks/{task_id}`；当 `status` 进入 `completed / partial / failed / cancelled` 时停止轮询
- 任务完成后，建议再调用 `GET /api/projects/{project_id}/storyboards/{storyboard_id}` 或刷新当前分镜列表读取最新图片结果
- 若前端在请求发出后切换页面，后端仍会继续执行生成与落库；重新进入分镜页刷新后可看到最新结果
- 当前分镜图片在终态详情与列表里会统一返回：
  - `thumbnail_url`：卡片轻量缩略图
  - `preview_url`：详情查看优先使用的预览图
  - `download_url`：下载原图地址
  - `preview_ready`：是否已有可直接回显的图片预览

### 上传分镜图片

- `POST /api/projects/{project_id}/storyboards/{storyboard_id}/upload-image`
- `multipart/form-data`

### 上传分镜视频

- `POST /api/projects/{project_id}/storyboards/{storyboard_id}/upload-video`
- `multipart/form-data`
- 文件字段：`file`
- 当前支持：`mp4 / webm / mov`
- 当前限制：最大 `100MB`

### 生成分镜视频

- `POST /api/projects/{project_id}/storyboards/{storyboard_id}/generate-video`

返回值示例：

```json
{
  "id": "task-uuid",
  "task_type": "sb_video",
  "status": "pending",
  "project_id": "project-uuid",
  "params": {
    "storyboard_id": "storyboard-uuid",
    "reference_mode": "full",
    "ratio": "16:9",
    "resolution": "1080p"
  },
  "results": []
}
```

请求体重点：

- `mode`
- `prompt`
- `model`
- `reference_mode`
- `mentions`
- `attachments`
- `first_frame_url`
- `last_frame_url`
- `first_frame_asset_id`
- `last_frame_asset_id`
- `duration`
- `resolution`
- `sound_effect`
- `reference_video_url`
- `reference_audio_url`
- `reference_video_asset_id`
- `reference_audio_asset_id`
- `reference_image_asset_ids`
- `ratio`
- `generate_mode`
- `generate_audio`
- `watermark`
- `mentioned_subjects`
- 若本次请求未显式传入 `ratio`，后端会优先回退当前 storyboard 已保存的 `gen_params.ratio`，再回退当前项目 `aspect_ratio`
- 当前接口已切为真正任务制：请求会立即返回 `task_id`
- 前端应轮询 `GET /api/tasks/{task_id}`；任务完成后再读取分镜详情或当前分镜列表，获取最新 `video_url / video_asset_id / video_thumbnail_url`
- 当前分镜视频在终态详情与列表里会统一返回：
  - `poster_url`：视频卡片静态海报图
  - `preview_video_url`：卡片 hover 播放与轻量预览优先使用的视频地址；当 `MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE=true` 且运行环境可用 `ffmpeg / ffprobe` 时，后端会优先写回托管后的轻量 mp4 预览产物，否则回退到原始视频地址
  - `hls_url`：HLS 主播放地址；当 `MEDIA_ENABLE_VIDEO_HLS=true` 且运行环境可用 `ffmpeg / ffprobe` 时，后端会在视频落盘阶段优先生成单码率 HLS 主播放列表并写回该字段，否则继续回退到 `preview_video_url`
  - `available_qualities`：当前 HLS 可用清晰度列表；首版为单码率 HLS，默认写回 1 条质量信息，若 HLS 打包失败或关闭则为空
  - `download_url`：下载原始视频地址
  - `preview_ready`：是否已有可直接回显的视频预览

### 获取单个分镜

- `GET /api/projects/{project_id}/storyboards/{storyboard_id}`
- 适用于任务轮询完成后刷新单条分镜详情，返回结构与分镜列表中的单项一致

说明：

- 分镜视频生成现已支持与创作页一致的数字资产编排字段：`mentions / attachments / *_asset_id`
- 前端可以在提示词中 `@` 当前参考素材，后端会在调用 Seedance 前重写成 `图片1 / 视频1 / 音频1`
- `asset_id` 仅作为内部绑定标识，不会直接作为提示词发送给模型
- 若前端在请求发出后切换页面，后端仍会继续执行生成、托管与分镜回写；重新进入分镜页刷新后可看到最终视频
- 当前若模型为 `veo-3.1-generate-preview`，运行时会改走 OneLinkAI Gemini 兼容 `predictLongRunning + operations` 链路，不直接请求 Google 官方域名
- Veo 当前能力口径收口为 `文生 / 图生 / 首尾帧 / 多参考图引导`；其中图生、首尾帧、多参考图模式统一只支持 `8` 秒，仍通过本接口现有 `model / first_frame_url / last_frame_url / attachments / duration / resolution / ratio` 字段承接，无需新增协议字段
- 当前分镜详情与列表响应对象 `StoryboardResponse` 已同时保留兼容字段和正式媒体分层字段：
  - 图片：`image_url + thumbnail_url + preview_url + download_url + preview_ready`
  - 视频：`video_url + video_thumbnail_url + poster_url + preview_video_url + hls_url + available_qualities + download_url + preview_ready`

### 批量下载分镜图片

- `POST /api/projects/{project_id}/storyboards/download/images`

说明：

- 返回 ZIP 文件流
- 当前会优先按统一媒体解析后的 `download_url` 读取分镜图；若该地址已切到受控 token 路由，则先在服务端完成用户校验与真实下载目标解析
- ZIP 内文件名仍按镜头号与图片后缀生成，不改变既有下载结构

### 批量下载分镜视频

- `POST /api/projects/{project_id}/storyboards/download/videos`

请求体：

```json
{
  "storyboard_ids": ["uuid1", "uuid2"]
}
```

说明：

- 返回 ZIP 文件流
- 当前会优先按统一媒体解析后的 `download_url` 读取分镜视频；若该地址已切到受控 token 路由，则先在服务端完成用户校验与真实下载目标解析
- ZIP 内文件名仍按镜头号与视频后缀生成，不改变既有下载结构

### 批量下载分镜资源包

- `POST /api/projects/{project_id}/storyboards/download/bundle`

请求体：

```json
{
  "storyboard_ids": ["uuid1", "uuid2"]
}
```

说明：

- 返回 ZIP 文件流，并附带 `manifest.json`
- 当前会分别对分镜图和分镜视频优先按统一媒体解析后的 `download_url` 读取；若该地址已切到受控 token 路由，则先在服务端完成用户校验与真实下载目标解析
- ZIP 目录结构、文件命名和 `manifest.json` 中的 `source_url` 语义保持不变，仅内部真实读取目标切到统一受控解析链

说明：

- 返回单个 `application/zip` 压缩包。
- 压缩包按分镜创建目录，目录下按 `images/`、`videos/` 收纳当前分镜已绑定的分镜图、分镜视频。
- 根目录会额外附带 `manifest.json`，记录分镜 ID、镜头号、归档路径、资产类型、资产显示名与来源地址，便于本地整理数字资产。

## 项目工作台模块 `workbench`

路由前缀：`/api/projects/{project_id}/workbench`

这是“项目内图片创作 / 项目工作台”的核心接口组，适合项目上下文中的图片生成、上传、详情、收藏、批量下载等操作。

### 生成工作台图片

- `POST /api/projects/{project_id}/workbench/images/generate`

请求体示例：

```json
{
  "prompt": "赛博朋克城市雨夜街景",
  "model": "gpt-image-2",
  "size": "1792x1024",
  "aspect_ratio": "16:9",
  "resolution": "2K",
  "reference_images": [
    "/uploads/images/ref1.png"
  ],
  "count": 4,
  "asset_name": "城市概念图",
  "category": "scene",
  "save_to_assets": true,
  "inherit_project_style": true
}
```

返回：

- 一个任务对象，不是最终图片
- 需继续轮询任务状态

### 查询工作台图片列表

- `GET /api/projects/{project_id}/workbench/images`

常用参数：

- `page`
- `page_size`
- `keyword?`
- `category?`
- `liked?`

返回重点：

- `list`
- `total`
- `has_more / hasMore`
- 图片卡片中包含：
  - `id`
  - `file_url`
  - `thumbnail_url`
  - `prompt`
  - `model`
  - `ratio`
  - `resolution`
  - `is_liked / isLiked`
  - `metadata_json`

补充说明：

- `file_url` 为原图
- `thumbnail_url` 为工作台图片卡片展示缩略图，当前后端会优先生成轻量卡片图
- 下载与详情查看仍应使用原始 `file_url`

### 上传工作台图片

- `POST /api/projects/{project_id}/workbench/images/upload`
- `multipart/form-data`

表单字段：

- `file`

返回重点：

- `asset_id`
- `file_id / fileId`
- `uploaded_url / uploadedUrl`
- `image`

### 查询图片生成任务状态

- `GET /api/projects/{project_id}/workbench/tasks/{task_id}`
- 可选查询参数：`include_images?=true|false`

返回重点：

- `status`
- `raw_status`
- `progress`
- `completed_count`
- `total_count`
- `images`：默认返回空数组；仅在显式传 `include_images=true` 且任务已进入终态时返回完整图片结果卡片
- `partial`
- `error`

状态说明：

- `pending`
- `generating`
- `completed`
- `failed`

### 批量删除工作台图片

- `POST /api/projects/{project_id}/workbench/images/batch-delete`

请求体：

```json
{
  "asset_ids": ["uuid1", "uuid2"]
}
```

### 批量下载工作台图片

- `POST /api/projects/{project_id}/workbench/images/batch-download`

请求体：

```json
{
  "asset_ids": ["uuid1", "uuid2"]
}
```

说明：

- 返回 ZIP 文件流
- 当前会优先按统一媒体解析后的 `download_url` 读取图片；若命中受控 token 路由，则先在服务端完成用户校验与真实下载目标解析
- 仍只打包当前项目下、可见且属于工作台域的图片资产

### 收藏 / 取消收藏工作台图片

- `POST /api/projects/{project_id}/workbench/images/{image_id}/favorite`
- `POST /api/projects/{project_id}/workbench/images/{image_id}/like`

两个接口作用相同，都是兼容不同前端命名。

请求体：

```json
{
  "liked": true
}
```

### 获取工作台图片详情

- `GET /api/projects/{project_id}/workbench/images/{image_id}`

### 下载工作台图片

- `GET /api/projects/{project_id}/workbench/images/{image_id}/download`

### 删除工作台图片

- `DELETE /api/projects/{project_id}/workbench/images/{image_id}`

### 获取工作台聚合结果

- `GET /api/projects/{project_id}/workbench/results`

用途：

- 聚合返回项目内图片 / 音频 / 视频结果
- 适合工作台总览页
- 当前会按 `media_types` 只查询实际请求到的辅助媒体表，避免在纯图片场景额外扫描音频 / 视频辅助表

## 音色模块 `voices`

路由前缀：`/api/voices`

### 获取音色列表

- `GET /api/voices`

说明：

- 当前接口仍以 `voices` 表为主，主要承接历史系统音色、自定义音色、收藏与管理能力。

返回重点：

- `id`
- `voice_id`
- `name`
- `gender`
- `age_group`
- `language`
- `style`
- `emotions`
- `preview_url`
- `provider`
- `is_custom`
- `is_favorite`
- `source_label`
- `supports_favorite`
- `language_boost`

### 获取 miioo 音色库

- `GET /api/voices/library`

说明：

- 当前接口服务的是后台维护的 `miioo音色库`，和官方 `GET /api/voices/official` 不同
- 普通登录用户默认只会拿到启用中的系统音色；管理员可配合 `include_disabled=true` 查看停用项
- 当前音色库既支持管理员在前端弹窗中单条上传试听音频，也支持把本地 `语音库文件/` 目录批量同步进库
- 可选查询参数 `provider=miioo`：仅返回 `miioo` 提供方的系统音色；当前前端默认音色库入口会显式透传该参数，避免把其它系统 provider 混进默认 `miioo音色库`

### 新建 miioo 音色

- `POST /api/voices/library`

请求方式：

- `multipart/form-data`
- 字段：
  - `name`
  - 可选：`gender / age_group / language / style / emotions / sort_order / is_enabled`
  - 可选：`preview_file`

说明：

- 仅管理员可调用
- 未显式传 `provider` 时，后端默认按 `miioo` 写入系统音色
- 上传的试听音频会托管到 `/uploads/voice-library/system/...`

### 更新 miioo 音色

- `PATCH /api/voices/library/{voice_id}`

说明：

- 仅管理员可调用
- 支持更新名称、标签、排序、启用状态与试听音频文件

### 停用 miioo 音色

- `DELETE /api/voices/library/{voice_id}`

说明：

- 仅管理员可调用
- 当前为软停用，不做物理删除

### 同步本地 miioo 音色库

- `POST /api/voices/library/sync-local`

说明：

- 仅管理员可调用
- 后端会扫描本地 `语音库文件/` 目录，自动把 `mp3 / wav / m4a` 批量导入为 `miioo音色库`
- 当前默认目录可通过后端环境变量 `MIIOO_VOICE_LIBRARY_SOURCE_DIR` 覆盖；未配置时会回退到工作区根目录下的 `语音库文件/`
- 同步接口会按文件名生成稳定 `voice_id`，重复同步只更新已有条目，不会无限新增
- 可选查询参数 `disable_missing=true`：把本地目录中已不存在的已导入条目标记为停用

### 获取 MiniMax 官方系统音色列表

- `GET /api/voices/official`

说明：

- 当前后端会固定抓取 `https://platform.minimax.io/docs/faq/system-voice-id.md`，解析 MiniMax 官方公开的系统音色清单，并在服务端做 1 小时缓存。
- 当请求参数 `provider=minimax` 且当前登录用户已配置官方 `MiniMax` provider 时，后端会优先调用官方 `POST /v1/get_voice` 查询当前账号可用音色；失败或未配置时再回退公开 system catalog。
- 因此该接口当前既可返回公开 system voices，也可承接当前账号下的 `voice_cloning / voice_generation` 私有音色。
- 创作页在模型为 `MiniMax-Speech-2.8-hd` 时，音色弹窗会优先使用该接口返回结果，而不是继续依赖本地 `voices` 表里的旧预置音色。
- 因官方公开清单未提供收藏主键与试听地址，当前这批官方音色会返回 `supports_favorite=false`、`preview_url=null`。
- 粤语音色会额外返回 `language_boost=Chinese,Yue`，前端提交配音时可直接透传。

### 收藏音色

- `POST /api/voices/{voice_id}/favorite`

说明：

- 路径参数 `voice_id` 实际传的是 `voices.id`（数据库主键 UUID），不是 `voice_id` 文本字段

### 新建自定义音色

- `POST /api/voices/custom`

请求方式：

- `multipart/form-data`
- 字段：
  - `name`
  - `file`
  - 可选：`gender / age_group / language / style / emotions`

说明：

- 上传后会真实写入 `voices` 表，`is_custom=true`
- 预览音频会托管保存到上传目录
- 当前这一步只解决“音色落库 / 收藏 / 展示 / 管理”，不代表已经接通真实声纹克隆 TTS

### 更新自定义音色

- `PATCH /api/voices/{voice_id}`

说明：

- 仅允许当前用户更新自己创建的自定义音色
- 当前主要用于重命名及补充基础标签字段

### 删除自定义音色

- `DELETE /api/voices/{voice_id}`

说明：

- 仅允许当前用户删除自己创建的自定义音色
- 删除后会同时清理关联收藏记录与托管预览音频

### 取消收藏音色

- `DELETE /api/voices/{voice_id}/favorite`

## 参考音频库模块 `reference-audio-library`

路由前缀：`/api/reference-audio-library`

用途说明：

- 这是一套“系统参考音频库”接口，主要承接创作/配音链路中可复用的参考音频素材。
- 与 `voices` 的区别：
  - `voices` 更偏“音色/说话人”
  - `reference-audio-library` 更偏“可复用参考音频素材本身”
- 与 `creation/audios` 的区别：
  - `creation/audios` 是用户生成结果
  - `reference-audio-library` 是供后续生成引用的静态素材库

### 获取参考音频列表

- `GET /api/reference-audio-library`

常用查询参数：

- `gender?`
- `age_group?`
- `language?`
- `emotion?`
- `keyword?`
- `include_disabled?`

返回重点：

- `id`
- `name`
- `description`
- `audio_url`
- `preview_url`
- `gender`
- `age_group`
- `language`
- `emotion`
- `tags`
- `is_enabled`
- `sort_order`
- `created_at`
- `updated_at`

说明：

- 普通登录用户默认只会拿到 `is_enabled=true` 的记录
- 管理员可通过 `include_disabled=true` 查看被停用的素材

### 新建参考音频

- `POST /api/reference-audio-library`
- `multipart/form-data`
- 鉴权：管理员

表单字段：

- `name`
- `description?`
- `gender?`
- `age_group?`
- `language?`
- `emotion?`
- `tags?`
- `sort_order?`
- `is_enabled?`
- `audio_file`

说明：

- 当前支持音频类型：`mp3 / wav / m4a`
- 当前大小限制约 `30MB`
- `preview_url` 当前默认等于上传后的 `audio_url`

### 更新参考音频

- `PATCH /api/reference-audio-library/{item_id}`
- `multipart/form-data`
- 鉴权：管理员

说明：

- 可更新名称、描述、标签、排序、启用状态
- 也可重新上传 `audio_file` 替换音频本体
- 若替换成功，旧托管音频会被清理

### 删除参考音频

- `DELETE /api/reference-audio-library/{item_id}`
- 鉴权：管理员

说明：

- 当前行为是软停用，不做物理删除
- 删除后会返回该参考音频对象，并将 `is_enabled` 置为 `false`
- 若后续需要彻底清理托管文件，应单独补物理删除能力，而不是依赖当前接口

## MiniMax 官方能力模块 `minimax`

路由前缀：`/api/minimax`

### 同步配音

- `POST /api/minimax/t2a`

说明：

- 通过当前登录用户已配置的官方 `MiniMax` provider 调用 `POST /v1/t2a_v2`
- 支持透传 `voice_setting / audio_setting / pronunciation_dict / timbre_weights / language_boost / voice_modify / subtitle_* / aigc_watermark`

### 异步配音任务创建

- `POST /api/minimax/t2a/async`

说明：

- 对应官方 `POST /v1/t2a_async_v2`
- 支持 `text` 或 `text_file_id` 作为输入源

### 异步配音任务查询

- `GET /api/minimax/t2a/async/{task_id}`

说明：

- 对应官方 `GET /v1/query/t2a_async_query_v2`
- 返回统一后的 `status / audio_url / file_id / task_token / trace_id`

### 文件上传

- `POST /api/minimax/files/upload`

说明：

- 对应官方 `POST /v1/files/upload`
- 当前用于长文本异步配音文本文件上传、音色复刻音频上传等场景

### 音色复刻

- `POST /api/minimax/voices/clone`

说明：

- 对应官方 `POST /v1/voice_clone`
- 支持 `file_id / voice_id / clone_prompt / text / model / language_boost / need_noise_reduction / need_volume_normalization / aigc_watermark`

### 音色设计

- `POST /api/minimax/voices/design`

说明：

- 对应官方 `POST /v1/voice_design`
- 支持 `prompt / preview_text / voice_id / aigc_watermark`

### 音色查询

- `POST /api/minimax/voices/query`

说明：

- 对应官方 `POST /v1/get_voice`
- 支持 `voice_type=system|voice_cloning|voice_generation|all`

## 配音片段模块 `audio_clips`

路由前缀：`/api/projects/{project_id}/audio-clips`

### 获取音频片段列表

- `GET /api/projects/{project_id}/audio-clips`

### 生成音频片段

- `POST /api/projects/{project_id}/audio-clips`

请求体示例：

```json
{
  "text": "这是旁白内容",
  "voice_id": "uuid",
  "storyboard_id": "uuid",
  "speed": 1.0,
  "emotion": "calm",
  "model": "MiniMax-Speech-2.8-hd"
}
```

补充说明：

- `model` 可选；未传时会优先使用当前用户已启用的默认 `voice` 分类模型。
- 配音链路会按 `voice` 分类模型反查所属 provider，不再固定写死 OneLinkAI。
- 当前已兼容 AI Ping 这类使用 `/api/v1/audio/speech` 且返回 base64 音频数据的 TTS 供应商。
- 保持当前中转供应商路由不变，不直接切到 MiniMax 官方地址；若底层 provider 是 AI Ping，则仍走现有代理地址。
- 现已额外支持对齐 `MiniMax-Speech-2.8-hd` 官方文档的可选字段：
  - `voice_setting`：可覆盖 `voice_id / speed / vol / pitch / emotion / text_normalization / latex_read`
  - `audio_setting`：可传 `sample_rate / bitrate / format / channel / force_cbr`
  - `pronunciation_dict`、`timbre_weights`、`language_boost`、`voice_modify`
  - `subtitle_enable`、`subtitle_type`、`output_format`、`aigc_watermark`
- 当前这组项目内配音接口仍是“同步非流式”语义；若传 `stream=true`，后端会直接报错提示暂不支持流式输出。

### 删除音频片段

- `DELETE /api/projects/{project_id}/audio-clips/{clip_id}`

## 视频片段模块 `video_clips`

路由前缀：`/api/projects/{project_id}/video-clips`

### 获取视频片段列表

- `GET /api/projects/{project_id}/video-clips`

### 生成视频片段

- `POST /api/projects/{project_id}/video-clips`

请求体重点：

- `storyboard_id`
- `model`
- `duration`
- `first_frame_url`
- `last_frame_url`
- `reference_video_url`
- `reference_audio_url`
- `ratio`
- `generate_audio`
- `watermark`

### 删除视频片段

- `DELETE /api/projects/{project_id}/video-clips/{clip_id}`

## 合成成片模块 `compositions`

路由前缀：`/api/projects/{project_id}/compositions`

### 获取合成工程列表

- `GET /api/projects/{project_id}/compositions`

### 新建合成工程

- `POST /api/projects/{project_id}/compositions`

请求体示例：

```json
{
  "name": "第一版剪辑",
  "timeline": [],
  "resolution": "1080p",
  "aspect_ratio": "16:9"
}
```

### 更新合成工程

- `PATCH /api/projects/{project_id}/compositions/{comp_id}`

可更新字段：

- `name`
- `timeline`
- `subtitle_style`
- `resolution`
- `aspect_ratio`

### 渲染成片

- `POST /api/projects/{project_id}/compositions/{comp_id}/render`

### 删除合成工程

- `DELETE /api/projects/{project_id}/compositions/{comp_id}`

## 通知模块 `notifications`

路由前缀：`/api/notifications`

### 获取通知列表

- `GET /api/notifications`

常用参数：

- `is_read?`
- `type?`：可按通知分类精确过滤，当前主口径为 `system_notice / creation_log / team_collab`
- `limit?`

通知 `type` 当前建议口径：

- `system_notice`：系统通知、配置提醒、账号相关消息
- `creation_log`：图片 / 视频 / 配音 / 工作台 / 分镜 / 成片导出等创作过程日志
- `team_collab`：评论、提及、审批、协作分工等团队消息

兼容说明：

- 历史库里若仍有 `task_* / creation_* / workbench_* / team*` 等旧值，前端消息中心已做兼容归类
- 当前后端新产生的创作类通知已统一收口到 `creation_log`

### 获取未读数量

- `GET /api/notifications/unread-count`

### 标记单条为已读

- `PATCH /api/notifications/{notification_id}/read`

### 全部标记已读

- `POST /api/notifications/read-all`

### 删除通知

- `DELETE /api/notifications/{notification_id}`

## 导出模块 `exports`

路由前缀：`/api/exports`

### 准备导出

- `POST /api/exports/prepare`

请求体支持两种方式：

1. 指定 `asset_ids`
2. 用 `filters` 过滤

示例：

```json
{
  "asset_ids": ["uuid1", "uuid2"]
}
```

或：

```json
{
  "filters": {
    "project_id": "uuid",
    "category": "storyboard",
    "only_primary": true
  }
}
```

返回重点：

- `files`
- `total_count`

## LLM 中转模块 `llm`

路由前缀：`/api/llm`

### 聊天补全

- `POST /api/llm/chat`

请求体：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是编剧助手"
    },
    {
      "role": "user",
      "content": "帮我写一个短剧开头"
    }
  ],
  "model": "gpt-4.1",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

### 流式聊天补全

- `POST /api/llm/chat/stream`

说明：

- SSE / 流式返回
- 适合流式文本展示

### 获取可用模型

- `GET /api/llm/models`

## 图片上传模块 `images`

路由前缀：`/api/images`

### 上传图片

- `POST /api/images/upload`
- 鉴权：否
- `multipart/form-data`

表单字段：

- `file`

返回：

```json
{
  "url": "/uploads/images/xxxx.png"
}
```

适用场景：

- 项目封面上传
- 通用图片上传

## 用户风格模块 `user_styles`

路由前缀：`/api/user-styles`

### 获取视觉风格选项

- `GET /api/user-styles/options`

返回重点：

- 内置风格 + 当前用户自定义风格的聚合列表
- `value`：创建/更新项目时写入 `visual_style` 的真实值
- `label`：前端展示文案
- `prompt`：对应风格提示词
- `is_builtin`
- `is_custom`

### 获取用户风格列表

- `GET /api/user-styles`

### 新建用户风格

- `POST /api/user-styles`

请求体：

```json
{
  "name": "暗黑电影风",
  "prompt": "dark cinematic, dramatic light",
  "color": "#111111"
}
```

### 更新用户风格

- `PATCH /api/user-styles/{style_id}`

### 删除用户风格

- `DELETE /api/user-styles/{style_id}`

## 通用任务模块 `tasks`

路由前缀：`/api/tasks`

该模块偏“任务中心”，而不是某一个具体业务页面。

### 获取任务列表

- `GET /api/tasks`

常用参数：

- `project_id?`
- `status?`
- `limit?`

### 获取任务详情

- `GET /api/tasks/{task_id}`

返回重点：

- `task_type`
- `status`
- `total_count`
- `success_count`
- `fail_count`
- `model`
- `size`
- `current_stage / currentStage`
- `partial_ready / partialReady`
- `params`
- `results`

补充说明：

- 当前 `GET /api/tasks` 与 `GET /api/tasks/{task_id}` 会直接把 `params.current_stage` 与 `params.partial_ready` 抬升为顶层响应字段，避免调用方必须深入解析 `params`
- 对视频类任务，`current_stage` 当前会承接 `queued / preview_transcoding / poster_extracting / hls_packaging / metadata_committing / completed` 等阶段语义
- `partial_ready=true` 表示当前任务已达到“可部分回显”状态，前端可优先展示已就绪的预览结果，不必等最终 metadata 全量收口

### 创建任务

- `POST /api/tasks`

请求体示例：

```json
{
  "project_id": "uuid",
  "task_type": "storyboard",
  "storyboard_ids": ["uuid1", "uuid2"],
  "model": "gpt-image-2",
  "size": "1792x1024",
  "params": {
    "watermark": false
  }
}
```

### 取消任务

- `POST /api/tasks/{task_id}/cancel`

### 重试任务

- `POST /api/tasks/{task_id}/retry`

### 查询视频任务状态

- `GET /api/tasks/video/{task_id}`

返回重点：

- `status`
- `progress`
- `current_stage / currentStage`
- `partial_ready / partialReady`
- `video_url`
- `thumbnail_url`
- `error`

补充说明：

- 该兼容接口当前也会直接回传任务运行阶段，老轮询调用方无需再自行下钻 `params.current_stage`
- 当任务已进入可部分回显窗口时，`partial_ready` 会直接置为 `true`

## 全局创作模块 `creation`

路由前缀：`/api/creation`

这是当前最复杂的一组接口，覆盖：

- 创作会话
- 创作镜头
- 全局图片创作
- 镜头级图片/配音/视频生成
- 独立视频创作
- 独立音频创作
- 批量收藏、删除、下载

---

### 创作会话

#### 获取会话列表

- `GET /api/creation/sessions`

常用参数：

- `project_id?`
- `status?`

#### 新建会话

- `POST /api/creation/sessions`

请求体通常包含：

- `title`
- `description`
- `project_id?`
- `aspect_ratio?`
- `resolution?`

#### 获取会话详情

- `GET /api/creation/sessions/{session_id}`

#### 更新会话

- `PATCH /api/creation/sessions/{session_id}`

#### 删除会话

- `DELETE /api/creation/sessions/{session_id}`

---

### 创作镜头

#### 获取会话下镜头列表

- `GET /api/creation/sessions/{session_id}/shots`

#### 新建镜头

- `POST /api/creation/sessions/{session_id}/shots`

常用字段：

- `title`
- `description`
- `shot_number`
- `sort_order`
- `camera_movement`
- `duration`
- `project_id?`

#### 获取镜头详情

- `GET /api/creation/shots/{shot_id}`

#### 更新镜头

- `PATCH /api/creation/shots/{shot_id}`

#### 重排镜头

- `POST /api/creation/sessions/{session_id}/shots/reorder`

#### 删除镜头

- `DELETE /api/creation/shots/{shot_id}`

---

### 创作图片库

#### 获取图片列表

- `GET /api/creation/images`

常用参数：

- `page`
- `page_size`
- `session_id?`
- `shot_id?`
- `project_id?`
- `keyword?`
- `category?`
- `liked?`
- `sources?`

说明：

- 默认只返回创作生成结果与创作镜头结果，不再把用户通过创作页上传的参考图混入创作结果区
- 若需要显式拉取上传参考图，可传 `sources=uploaded` 或 `sources=creation_upload`
- `sources` 当前支持：`generated | shot | uploaded`
- 当前图片列表与详情已统一返回：
  - `thumbnail_url`：卡片轻量缩略图
  - `preview_url`：详情查看优先使用的预览图
  - `download_url`：下载原图地址
  - `preview_ready`：是否已有可直接回显的图片预览
- 当前列表中的 `thumbnail_url` 用于卡片展示，详情查看与下载应优先消费 `preview_url / download_url`，而不是继续把同一个宽泛 `file_url` 混用到所有场景

#### 上传创作图片

- `POST /api/creation/images/upload`
- `multipart/form-data`

#### 上传创作参考视频

- `POST /api/creation/videos/upload`
- `multipart/form-data`

说明：

- 当前仅支持 `category=reference`
- 可选绑定 `session_id / shot_id / project_id`
- 适合创作页把本地参考视频先托管到资产库，再参与视频生成

#### 上传创作参考音频

- `POST /api/creation/audios/upload`
- `multipart/form-data`

说明：

- 当前仅支持 `category=reference`
- 可选绑定 `session_id / shot_id / project_id`
- 适合创作页把本地参考音频先托管到资产库，再参与视频生成或后续引用

#### 生成创作图片

- `POST /api/creation/images/generate`

请求体示例：

```json
{
  "prompt": "未来城市清晨天台镜头",
  "model": "gpt-image-2",
  "size": "1792x1024",
  "aspect_ratio": "16:9",
  "resolution": "2K",
  "reference_images": [
    "/uploads/images/ref1.png"
  ],
  "count": 4,
  "asset_name": "未来城市组图",
  "category": "scene",
  "save_to_assets": true,
  "inherit_project_style": true,
  "session_id": "uuid",
  "shot_id": "uuid",
  "project_id": "uuid"
}
```

说明：

- 可独立生成，也可关联 `session_id / shot_id / project_id`
- 返回任务对象，需要轮询
- 任务创建成功后，后端会继续后台执行；前端切页不会中断已创建任务
- 新生成图片会继续保留原始 `file_url`，同时尽量生成卡片用 `thumbnail_url` 和详情预览用 `preview_url`
- `count / image_count / imageCount` 上限为 15（实际受模型 `max_output_images` 与「参考图数量+生成数量≤15」约束兜底）
- 豆包 Seedream 5.0/4.5/4.0（OneLinkAI 透传）新增可选参数，按官方文档透传到 `/volc/api/v3/images/generations`：
  - `output_format`：`png` / `jpeg`（仅 `doubao-seedream-5.0-lite` 支持；默认 `png`）
  - `response_format`：`url` / `b64_json`（默认 `url`）
  - `web_search`：`true` 开启联网搜索（仅 `doubao-seedream-5.0-lite`，会透传 `tools:[{type:"web_search"}]`）
  - `optimize_prompt`：`standard` / `fast` 提示词优化模式
  - `sequential_image_generation`：`auto` / `disabled` 显式组图开关（缺省按「count>1 则 auto」推断）

#### 流式创建创作图片生成任务（SSE）

- `POST /api/creation/images/generate/stream`
- 请求体与 `POST /api/creation/images/generate` 完全一致
- 仅对支持流式的模型（豆包 Seedream 系列）有效；其它模型返回 `400`
- 响应 `Content-Type: text/event-stream`，事件类型：
  - `event: task` → `{ "task_id", "model", "total_count" }`（任务已创建）
  - `event: image` → `{ "index", "url", "asset_id", "size" }`（单张就绪，已落库）
  - `event: done` → `{ "task_id", "status", "success_count", "fail_count", "usage" }`（整体完成）
  - `event: error` → `{ "error", "index" }`（单张或整体失败）
- `GenTask` 仍同步落库，前端断流后可回退 `GET /api/creation/tasks/{task_id}` 轮询


#### 获取创作任务列表

- `GET /api/creation/tasks`

#### 轮询创作图片任务

- `GET /api/creation/tasks/{task_id}`
- 当任务类型为视频生成且上游返回 `hls_url / available_qualities` 时，任务结果中的 `result` 也会同步返回 `hls_url / hlsUrl / available_qualities / availableQualities`，与最终视频列表详情保持一致
- 当前 `video_gen.py` 已继续统一解析上游视频服务返回的 `preview_video_url / previewVideoUrl / hls_url / hlsUrl / hls_master_playlist / available_qualities / availableQualities`；若 provider 原始响应或任务轮询结果中已经带回这组字段，后续创作任务结果、资产 metadata 与分镜写回会继续保留，不再在服务层中途丢失

#### 批量删除创作图片

- `POST /api/creation/images/batch-delete`

#### 批量下载创作图片

- `POST /api/creation/images/batch-download`

#### 批量收藏创作图片

- `POST /api/creation/images/batch-favorite`

#### 收藏 / 取消收藏单张图片

- `POST /api/creation/images/{image_id}/favorite`
- `POST /api/creation/images/{image_id}/like`

请求体：

```json
{
  "liked": true
}
```

#### 获取图片详情

- `GET /api/creation/images/{image_id}`

#### 下载图片

- `GET /api/creation/images/{image_id}/download`

#### 删除图片

- `DELETE /api/creation/images/{image_id}`

---

### 镜头级图片、音频、视频生成

#### 为镜头生成图片

- `POST /api/creation/shots/{shot_id}/generate-image`

#### 为镜头生成配音

- `POST /api/creation/shots/{shot_id}/generate-audio`

请求体示例：

```json
{
  "text": "镜头旁白内容",
  "voice_id": "uuid",
  "speed": 1.0,
  "emotion": "calm",
  "model": "MiniMax-Speech-2.8-hd"
}
```

#### 为镜头生成视频

- `POST /api/creation/shots/{shot_id}/generate-video`

请求体重点：

- `prompt`
- `model`
- `duration`
- `first_frame_url`
- `last_frame_url`
- `resolution`
- `sound_effect`
- `reference_video_url`
- `reference_audio_url`
- `ratio`
- `generate_mode`
- `generate_audio`
- `watermark`

---

### 独立视频创作

#### 获取视频列表

- `GET /api/creation/videos`

常用参数：

- `page?`
- `page_size?`
- `keyword?`
- `liked?`

当前视频列表与详情已统一返回：

- `poster_url` / `thumbnail_url`：视频卡片静态海报图
- `preview_video_url`：卡片 hover 播放与轻量预览优先使用的视频地址；当 `MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE=true` 且运行环境可用 `ffmpeg / ffprobe` 时，后端会优先写回托管后的轻量 mp4 预览产物，否则回退到原始视频地址
- `hls_url` / `hlsUrl`：HLS 主播放地址；当 `MEDIA_ENABLE_VIDEO_HLS=true` 且运行环境可用 `ffmpeg / ffprobe` 时，后端会在视频落盘阶段优先生成单码率 HLS 主播放列表并写回该字段，否则继续回退到 `preview_video_url`
- `available_qualities` / `availableQualities`：当前 HLS 可用清晰度列表；首版为单码率 HLS，默认写回 1 条质量信息，若 HLS 打包失败或关闭则为空
- `download_url`：下载原始视频地址
- `preview_ready`：是否已有可直接回显的视频预览
- 当前创作视频、主体图片与分镜图片/视频的压缩回显派生已统一收口到共享服务 `backend/app/services/media_derivative_pipeline.py`；前端页面层应继续按“卡片优先 `poster_url / thumbnail_url`、详情播放优先 `hls_url -> preview_video_url`、下载优先 `download_url`”消费，不要回退到宽泛 `url`
- 当前视频轻量预览首版已新增真实 feature flag：`MEDIA_ENABLE_VIDEO_PREVIEW_TRANSCODE`。开启时，独立创作视频、创作镜头视频与分镜上传/生成视频会在落盘阶段尝试生成托管的轻量 mp4 预览，并补齐 `preview_codec / preview_bitrate / preview_duration / transcode_profile / preview_transcode_status` 等 metadata；若二进制缺失或转码失败，则继续回退原视频并记录失败状态
- 当前视频 HLS 首版已接到真实代码层：`MEDIA_ENABLE_VIDEO_HLS` 开启时，独立创作视频、创作镜头视频、分镜生成视频与分镜上传视频会在落盘阶段尝试生成单码率 HLS 主播放列表，并补齐 `hls_master_playlist / available_qualities / hls_variant_count / default_quality / hls_packaging_status` 等 metadata；若二进制缺失或打包失败，则继续回退到 `preview_video_url`，不阻断主链路
- 当前视频运行时状态已开始统一写回到 metadata：共享派生层会补齐 `partial_ready / video_pipeline_stage / metadata_commit_status`，用于区分“仅 source 已落盘”“poster + preview 已就绪可安全回显”“metadata 已提交完成”等阶段；当前最终 asset / gen_params 写回阶段会落为 `completed + metadata_commit_status=ready`，而独立视频任务 partial 结果则仍可能保留 `poster_extracting / metadata_committing` 一类中间语义
- 当前独立创作视频与分镜视频生成链路，若上游在生成结果中已返回 `hls_url / available_qualities`，后端会在落盘写库时继续把这组字段沉到 asset metadata、任务结果与分镜 `gen_params`，避免只在瞬时上游响应里短暂存在

#### 生成独立视频

- `POST /api/creation/videos/generate`

请求体示例：

```json
{
  "prompt": "以@女主海报作为首帧，镜头运动参考@骑行第一视角视频，背景音乐使用@海风BGM",
  "model": "doubao-seedance-2.0",
  "reference_mode": "full",
  "ratio": "16:9",
  "resolution": "720P",
  "duration": 5,
  "with_audio": true,
  "mentions": [
    {
      "asset_id": "ast_img_001",
      "asset_type": "image",
      "asset_name": "女主海报",
      "display_text": "@女主海报",
      "intended_role": "first_frame"
    },
    {
      "asset_id": "ast_vid_001",
      "asset_type": "video",
      "asset_name": "骑行第一视角视频",
      "display_text": "@骑行第一视角视频",
      "intended_role": "reference_video"
    }
  ],
  "attachments": [
    {
      "asset_id": "ast_img_001",
      "asset_type": "image",
      "asset_name": "女主海报",
      "url": "https://example.com/uploads/ref-image.png",
      "role": "first_frame",
      "source": "user_upload"
    },
    {
      "asset_id": "ast_vid_001",
      "asset_type": "video",
      "asset_name": "骑行第一视角视频",
      "url": "https://example.com/uploads/ref-video.mp4",
      "role": "reference_video",
      "source": "project_asset"
    },
    {
      "asset_id": "ast_aud_001",
      "asset_type": "audio",
      "asset_name": "海风BGM",
      "url": "https://example.com/uploads/ref-audio.mp3",
      "role": "reference_audio",
      "source": "project_asset"
    }
  ],
  "first_frame_asset_id": "ast_img_001",
  "reference_video_asset_id": "ast_vid_001",
  "reference_audio_asset_id": "ast_aud_001",
  "reference_image_asset_ids": ["ast_img_002"],
  "first_frame_url": "https://example.com/uploads/ref-image.png",
  "last_frame_url": null,
  "reference_video_url": "https://example.com/uploads/ref-video.mp4",
  "reference_audio_url": "https://example.com/uploads/ref-audio.mp3"
}
```

说明：

- 返回任务对象
- 通过视频任务状态接口轮询
- 任务创建成功后，后端会继续后台执行；前端切页不会中断已创建任务
- `mentions` 用于记录产品层 `@素材` 引用关系
- `attachments` 用于声明本次请求实际入模的素材池，后端会结合既有 URL 字段统一编排
- `first_frame_asset_id / reference_*_asset_id / reference_image_asset_ids` 为强语义绑定字段，优先级高于自然语言推断
- `asset_id` 不会直接发给豆包模型，后端会根据最终入模顺序把提示词重写为 `图片1 / 视频1 / 音频1`
- 当前若模型为 `veo-3.1-generate-preview`，运行时会通过 OneLinkAI Gemini 兼容 `POST /v1beta/models/{model}:predictLongRunning` 创建任务，并轮询 `operations` 终态
- Veo 当前能力口径收口为 `文生 / 图生 / 首尾帧 / 多参考图引导`；图生、首尾帧、多参考图模式统一只支持 `8` 秒，创作页继续复用本接口现有 `generation_mode / attachments / 首尾帧 / ratio / resolution / duration` 字段即可承接

#### 轮询视频任务

- `GET /api/creation/videos/tasks/{task_id}`
- 返回字段包含 `task_id / taskId / status / progress / current_stage / currentStage / partial_ready / partialReady / result / error_msg / errorMsg`
- 当状态为 `completed` 或 `partial` 且 `task.results` 中存在成功视频时，`result` 会返回 `CreationVideoCard`，其中详情/轻量播放应优先使用 `preview_video_url / previewVideoUrl`，原始视频仍保留在 `video_url / videoUrl`，卡片封面优先使用 `poster_url / posterUrl`
- 若状态仍为 `running` 但 `task.results` 已存在成功视频，接口也会返回 `result`，用于兼容视频已落盘但后处理尚未结束的窗口
- 若任务已生成视频并落盘，但资产回查暂时不可用，后端会回退使用 `task.results` 中的 `video_url / videoUrl / url` 构造 `result`，避免前端收到终态却拿不到视频地址
- `current_stage` 与 `partial_ready` 当前直接继承视频派生 metadata 的运行时事实，不再要求调用方自行从 `params` 或 `result.metadata` 猜测阶段

#### 收藏 / 取消收藏视频

- `POST /api/creation/videos/{video_id}/favorite`

说明：

- 当前为“切换型”接口，不接收请求体
- 每次调用都会对当前创作视频的收藏态做取反，并返回最新 `is_liked`
- 与创作图片的“显式传 `liked`”接口语义不同，前端适配层不要直接复用同一套提交逻辑

#### 删除视频

- `DELETE /api/creation/videos/{video_id}`

#### 下载视频

- `GET /api/creation/videos/{video_id}/download`

#### 批量删除视频

- `POST /api/creation/videos/batch-delete`

#### 批量下载视频

- `POST /api/creation/videos/batch-download`

说明：

- 返回 ZIP 文件流
- 当前会优先尝试统一媒体解析后的 `download_url`，再回退旧的 `download_url -> origin_url -> file_url` 候选链
- 若首选地址已切到受控 token 路由，则会先在服务端完成用户校验与真实下载目标解析，再读取实际文件内容

---

### 独立音频创作

#### 生成独立音频

- `POST /api/creation/audios/generate`

请求体示例：

```json
{
  "text": "一段独立旁白",
  "prompt_raw": "请朗读这段旁白，参考 @女声样音 和 @角色立绘",
  "prompt_resolved": "请朗读这段旁白\n重点参考资产：\n1. 女声样音（audio），请优先参考其内容与语义特征\n2. 角色立绘（image），请优先参考其主体、动作、构图或风格特征",
  "voice_id": "uuid",
  "speed": 1.0,
  "emotion": "warm",
  "model": "MiniMax-Speech-2.8-hd",
  "project_id": "uuid",
  "reference_audio_url": "https://example.com/reference-audio.mp3",
  "mentions": [
    {
      "asset_id": "aud_001",
      "asset_type": "audio",
      "asset_name": "女声样音",
      "display_text": "@女声样音",
      "start": 11,
      "end": 16,
      "intended_role": "reference"
    },
    {
      "asset_id": "img_001",
      "asset_type": "image",
      "asset_name": "角色立绘",
      "display_text": "@角色立绘",
      "start": 19,
      "end": 24,
      "intended_role": "reference"
    }
  ],
  "attachments": [
    {
      "asset_id": "aud_001",
      "asset_type": "audio",
      "asset_name": "女声样音",
      "url": "https://example.com/reference-audio.mp3",
      "role": "mentioned_reference",
      "source": "project_asset"
    },
    {
      "asset_id": "img_001",
      "asset_type": "image",
      "asset_name": "角色立绘",
      "url": "https://example.com/reference-image.png",
      "role": "mentioned_reference",
      "source": "project_asset"
    }
  ]
}
```

补充说明：

- 若底层命中 `AI Ping` + `MiniMax-Speech-2.8-hd`，可额外传与官方文档一致的 `voice_setting / audio_setting / pronunciation_dict / timbre_weights / language_boost / voice_modify / subtitle_* / output_format / aigc_watermark`
- 现已支持附带 `project_id`，创作页在选中项目后生成的独立配音会同时写入 `audio_clips.project_id` 与 `assets.project_id`，从而进入项目资产域
- 路由内部也预留了 `session_id / shot_id` 口径，用于后续继续对齐创作会话/镜头级上下文
- 当前独立配音已正式承接创作页 `@` 数字资产绑定字段：`prompt_raw / prompt_resolved / mentions / attachments`
- 配音链路中的 `@资产` 仅作参考绑定，不会进入最终送给 TTS 的 `text`
- `reference_audio_url` 的优先级为：显式传入 > 被 `@` 的音频资产 > 其它音频附件
- `@图片 / @视频` 会作为绑定事实写入音频资产 `metadata_json`，用于历史回显与排障，但不会伪装成多模态 TTS 输入
- 路由地址保持当前项目的创作接口与供应商代理地址不变，不直接暴露或切换为 MiniMax 官方 URL
- 当前创作音频接口同样只支持同步非流式输出
- 若上游返回的是 `data:` / base64 内联音频，后端会先落为托管文件再写入创作音频记录与资产，前端最终拿到的是可稳定回显和下载的媒体 URL

#### 获取音频列表

- `GET /api/creation/audios`

#### 获取音频详情

- `GET /api/creation/audios/{audio_id}`

#### 下载音频

- `GET /api/creation/audios/{audio_id}/download`

#### 删除音频

- `DELETE /api/creation/audios/{audio_id}`

#### 收藏 / 取消收藏音频

- `POST /api/creation/audios/{audio_id}/favorite`

说明：

- 当前为“切换型”接口，不接收请求体
- 每次调用都会切换当前创作配音的收藏状态，并返回最新 `is_favorite`
- 后端会同时同步 `audio_clips.is_favorite` 与关联资产的 `is_starred`

#### 批量删除音频

- `POST /api/creation/audios/batch-delete`

#### 批量下载音频

- `POST /api/creation/audios/batch-download`

说明：

- 返回 ZIP 文件流
- 当前若配音已绑定资产，会优先尝试统一媒体解析后的 `download_url`；否则回退到音频记录自身的 `audio_url`
- 若首选地址已切到受控 token 路由，则会先在服务端完成用户校验与真实下载目标解析，再读取实际文件内容

## 前端接入建议

### 推荐先接入的最小闭环

如果你要快速完成另一版本前端接入，建议优先按下面顺序联调：

1. `auth`：登录、刷新、获取当前用户
2. `providers` + `models`：确认用户已有模型配置
3. `projects`：项目列表、创建、详情
4. `episodes`：分集 CRUD、剧本生成/上传
5. `subjects`：主体提取、主体详情、主体图片
6. `storyboards`：分镜列表、生成图片/视频
7. `assets`：统一资产列表与详情
8. `creation` / `workbench`：新版本前端的创作页与项目工作台
9. `tasks` + `notifications`：轮询与消息中心

### 前端数据层建议

- 封装统一 `request()`，自动注入 `Authorization`
- 统一处理 `401`：
  - 先尝试 `refresh`
  - 失败后跳登录
- 对 `/uploads/...` 做统一媒体 URL 拼接
- 对任务接口做通用 poller
- 对 `liked`、`page_size/pageSize` 这类兼容字段做一层 adapter

### 媒体访问建议

- 图片展示：直接用返回的 `file_url` / `thumbnail_url`
- 下载动作：优先调用后端 download 接口，不直接猜测原始资源地址
- 带鉴权的下载：使用 `fetch -> blob -> download`

## 常用联调示例

### 登录

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "13800000000",
    "password": "123456"
  }'
```

### 获取当前用户

```bash
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### 创建项目

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新项目",
    "description": "测试项目",
    "aspect_ratio": "16:9",
    "visual_style": "电影感"
  }'
```

### 创作页生成图片

```bash
curl -X POST http://localhost:8000/api/creation/images/generate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "未来城市夜景",
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "count": 4,
    "category": "scene",
    "save_to_assets": true
  }'
```

### 轮询创作图片任务

```bash
curl http://localhost:8000/api/creation/tasks/<task_id> \
  -H "Authorization: Bearer <access_token>"
```

### 工作台生成图片并轮询

```bash
curl -X POST http://localhost:8000/api/projects/<project_id>/workbench/images/generate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "电影感角色海报",
    "category": "character",
    "count": 2
  }'
```

```bash
curl http://localhost:8000/api/projects/<project_id>/workbench/tasks/<task_id> \
  -H "Authorization: Bearer <access_token>"
```

## 压测脚本

- 当前仓库已新增 `miioo/backend/loadtest/` 目录，提供面向本后端的 `k6` 压测脚本与环境变量示例
- 入口文件：
  - `miioo/backend/loadtest/miioo_api_load.js`
  - `miioo/backend/loadtest/.env.example`
  - `miioo/backend/loadtest/README.md`
- 当前默认覆盖的低风险场景：
  - `GET /api/projects`
  - `GET /api/models?category=image`
  - `GET /api/models?category=video`
  - 若提供 `PROJECT_ID`，额外覆盖 `GET /api/projects/{project_id}/episodes` 与 `GET /api/projects/{project_id}/storyboards`
  - 若提供 `TASK_ID` 或 `TASK_STATUS_PATH`，可额外覆盖任务状态轮询接口
- 当前脚本默认不压真实 AI 生成入口，只保留“安全读接口 + 可选任务轮询 + 可选低速创建项目”三类场景，避免把第三方模型限流、上游成本和测试脏数据混进基础性能结论
- 推荐压测前以非 `--reload` 模式单独启动后端，例如：

```bash
cd "/Users/xingyi/Desktop/打通前后端 2/miioo/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 备注

- 本文档基于当前代码实现整理，不是产品需求稿
- 某些接口的实际返回字段会比本文档列出的“重点字段”更多
- 若你准备做前端类型定义，建议再结合 `/openapi.json` 自动生成一份 TS 类型
- 若你愿意，我下一步可以继续帮你输出一份“给另一版本前端直接用的 TypeScript API 类型定义 + 请求封装示例”
