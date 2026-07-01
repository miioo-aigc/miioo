# Miioo 后端压测脚本

本目录提供一套面向 `miioo/backend` 的 `k6` 压测脚本，优先覆盖低风险、高频的后端接口场景：

- 基础读接口：`projects / models / episodes / storyboards`
- 任务轮询接口：`/api/tasks/{task_id}` 或任意自定义任务状态路径
- 可选写接口：`POST /api/projects`

当前脚本刻意不默认压真实 AI 生成入口，避免：

- 打到第三方模型产生额外成本
- 把上游限流误判成我们自己服务的瓶颈
- 直接把测试数据灌进真实业务环境

## 1. 前置条件

1. 安装 `k6`

```bash
brew install k6
```

2. 启动后端时不要使用 `--reload`

推荐单独起一个压测专用进程：

```bash
cd "/Users/xingyi/Desktop/打通前后端 2/miioo/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

3. 准备测试环境数据

- 一个可用的 `access_token`
- 一个测试项目 `PROJECT_ID`
- 如果要测任务轮询，再准备一个现成任务状态路径或 `TASK_ID`

## 2. 文件说明

- `miioo_api_load.js`：主压测脚本
- `.env.example`：环境变量示例

## 3. 推荐使用方式

先复制一份本地配置：

```bash
cd "/Users/xingyi/Desktop/打通前后端 2/miioo/backend/loadtest"
cp .env.example .env.local
```

然后把 `.env.local` 里的 `TOKEN / PROJECT_ID / TASK_ID` 或 `TASK_STATUS_PATH` 填好。

### 3.1 只压安全读接口

```bash
cd "/Users/xingyi/Desktop/打通前后端 2/miioo/backend/loadtest"
set -a
source .env.local
set +a
k6 run miioo_api_load.js
```

### 3.2 加上任务轮询压测

`.env.local` 里至少满足以下一种：

- `TASK_ID=<task_id>`
- `TASK_STATUS_PATH=/api/creation/tasks/<task_id>`

并开启：

```bash
ENABLE_TASK_POLL=true
```

然后执行：

```bash
cd "/Users/xingyi/Desktop/打通前后端 2/miioo/backend/loadtest"
set -a
source .env.local
set +a
k6 run miioo_api_load.js
```

### 3.3 小流量写入压测

仅建议在测试库或可清理环境中开启：

```bash
ENABLE_PROJECT_CREATE=true
WRITE_RATE=1
WRITE_DURATION=30s
```

脚本会调用：

- `POST /api/projects`

并自动创建带 `WRITE_PROJECT_PREFIX` 前缀的测试项目名。

## 4. 环境变量说明

核心变量：

- `BASE_URL`：后端地址，默认 `http://127.0.0.1:8000`
- `TOKEN`：测试账号 `access_token`
- `PROJECT_ID`：项目级读取接口使用
- `TASK_ID`：通用任务轮询使用
- `TASK_STATUS_PATH`：自定义任务状态路径，优先级高于 `TASK_ID` 组合路径

场景开关：

- `ENABLE_PROJECT_READS`
- `ENABLE_EPISODE_READS`
- `ENABLE_STORYBOARD_READS`
- `ENABLE_TASK_POLL`
- `ENABLE_PROJECT_CREATE`

压测强度：

- 读场景：`READ_STAGE*`、`READ_SLEEP_SECONDS`
- 轮询场景：`TASK_POLL_*`
- 写场景：`WRITE_*`

## 5. 当前脚本行为

### 5.1 读接口场景

默认会压：

- `GET /api/projects`
- `GET /api/models?category=image`
- `GET /api/models?category=video`

如果提供了 `PROJECT_ID`，还会继续压：

- `GET /api/projects/{project_id}/episodes`
- `GET /api/projects/{project_id}/storyboards`

### 5.2 任务轮询场景

默认不启用。开启后会持续请求：

- `TASK_STATUS_PATH`

适合：

- `/api/tasks/{task_id}`
- `/api/creation/tasks/{task_id}`
- `/api/creation/videos/tasks/{task_id}`
- `/api/projects/{project_id}/workbench/tasks/{task_id}`

### 5.3 写入场景

默认不启用。开启后会低速创建测试项目，适合观察：

- 数据库写入延迟
- 高并发下 4xx / 5xx 错误率
- 应用层与数据库连接池承压情况

## 6. 判读建议

优先看这些指标：

- `http_req_failed`
- `http_req_duration`
- `unexpected_status_rate`
- 各接口 `p(95)` 与 `p(99)`

同时结合本机或服务器观察：

```bash
top -o cpu
```

```bash
psql "$DATABASE_URL" -c "select state, count(*) from pg_stat_activity group by state;"
```

## 7. 风险边界

- 不建议对 `auth/send-code` 做压测，会触发验证码限流和短信逻辑
- 不建议一开始直接对真实 AI 生成接口做高并发压测，先把“任务创建”和“任务轮询”压稳
- 不建议在 `uvicorn --reload` 模式下做压测，结果会被热重载严重干扰
- 如果使用写入场景，压测后请手动清理测试项目数据
