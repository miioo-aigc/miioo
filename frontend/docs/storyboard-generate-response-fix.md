# 分镜 generate 接口无反应问题修复记录

## 1. 文档目的

本文记录分镜页面调用 `POST /api/projects/{project_id}/storyboards/generate` 后，接口看起来已经执行但页面没有显示结果的问题。

内容包括：

- 修复前的接口契约与前端处理方式；
- 问题出现的具体原因；
- 修复后的请求、响应和轮询处理链路；
- 涉及的文件和关键代码职责；
- 已验证的场景和后续联调注意事项。

本文只记录本次 `generate` 响应处理修复。分镜列表分页、候选媒体和其他分镜页面改版属于同一工作区内的其他变更，不在本文重新定义。

## 2. 涉及的接口

### 2.1 按单集生成分镜

接口：

```text
POST /api/projects/{project_id}/storyboards/generate
```

用途：根据指定正式分集剧本生成当前分集的分镜。

OpenAPI 中的请求体模型是 `GenerateStoryboardRequest`：

```json
{
  "episode_id": "分集 UUID",
  "model": null,
  "overwrite_existing": true
}
```

其中 `episode_id` 必填，`model` 可以为字符串或 `null`，`overwrite_existing` 为布尔值，默认值为 `true`。

OpenAPI 当前声明该接口成功响应是**直接返回分镜数组**：

```json
[
  {
    "id": "storyboard UUID",
    "project_id": "project UUID",
    "episode_id": "episode UUID",
    "shot_number": 1,
    "content": "...",
    "duration": 5,
    "image_url": null,
    "video_url": null
  }
]
```

因此，这个接口和“主剧本首次抽取”接口的契约不同，不能默认按照任务接口处理。

### 2.2 主剧本首次抽取

接口：

```text
POST /api/projects/{project_id}/storyboards/generate-from-final-script
```

用途：从主剧本定稿启动分镜生成任务。

该接口在 OpenAPI 中明确返回任务对象，前端需要拿任务 ID 后轮询：

```json
{
  "id": "task UUID",
  "task_type": "storyboard_generate",
  "status": "pending",
  "params": {
    "first_episode_only": true
  },
  "results": []
}
```

首次抽取仍使用：

```json
{
  "model": null,
  "episode_count": null,
  "split_mode": "rule_first",
  "continue_in_background": true,
  "first_episode_only": true
}
```

这条接口由主体页面 `Home.jsx` 发起，不应和按集 `generate` 的同步数组响应混用。

## 3. 修复前的实现

### 3.1 API 层没有明确区分响应契约

修复前，`apiGenerateStoryboardsFromEpisode` 的主要逻辑是：

```js
const res = await authFetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ episode_id, model }),
});

invalidateStoryboards(projectId);
return res.json();
```

它直接把 JSON 原样交给页面，没有在 API 层明确处理：

- OpenAPI 声明的直接数组响应；
- `{ data: ... }`、`{ result: ... }`、`{ payload: ... }` 等统一包装；
- `{ storyboards: [...] }`、`{ list: [...] }`、`{ items: [...] }` 等数组包装。

当后端返回 HTTP 错误时，旧逻辑也没有统一读取 `detail`、`message`、`error` 或 `status_message`，页面难以展示后端的真实原因。

### 3.2 页面把响应过度按异步任务处理

修复前，`StoryboardPage.jsx` 在按集生成和重新分镜时，拿到响应后主要按照下面的顺序处理：

1. 如果响应是数组，认为生成已经完成；
2. 如果不是数组，读取 `task_id`、`taskId` 或 `id`；
3. 如果没有任务 ID，就要求响应状态必须是 `completed/success/succeeded/done`；
4. 其他情况直接抛出“未返回任务 ID”。

问题在于：

- OpenAPI 对 `generate` 的正常成功响应本来就是数组，页面的主逻辑却仍然把“任务 ID”当成核心成功条件；
- 如果后端实际返回统一包装，例如 `{ data: [...] }`，页面看到的是对象，不是数组；
- 如果后端实际返回异步任务，例如 `{ data: { id, status } }`，页面也无法从外层包装对象中取出 `id`；
- 如果响应状态是大写，例如 `COMPLETED`，旧判断不会识别；
- 如果后端任务状态是 `queued`、`created`、`processing` 或 `in_progress`，旧轮询适配器会把它们误认为非进行中状态，提前停止轮询。

### 3.3 造成的页面表现

这会出现几种表面上类似的现象：

- Network 中 `generate` 返回 200，但页面提示“未返回任务 ID”；
- `generate` 返回数组或包装数组，但页面没有把结果写入分镜列表；
- 异步任务刚创建就被当成完成任务，页面立即读取分镜列表，此时数据库还没有结果，于是页面保持空状态；
- 后端真实返回错误时，页面只显示“生成失败”，看不到后端具体原因。

## 4. 修复后的实现

### 4.1 API 层先按 OpenAPI 解包

现在 `apiGenerateStoryboardsFromEpisode` 会先检查 HTTP 状态，再解析响应：

```js
const data = await res.json();
const payload = data?.data ?? data?.result ?? data?.payload ?? data;

if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.storyboards)) return payload.storyboards;
if (Array.isArray(payload?.list)) return payload.list;
if (Array.isArray(payload?.items)) return payload.items;
return payload;
```

API 层现在兼容以下响应：

```json
[
  { "id": "shot-1", "episode_id": "episode-1" }
]
```

```json
{
  "data": [
    { "id": "shot-1", "episode_id": "episode-1" }
  ]
}
```

```json
{
  "data": {
    "storyboards": [
      { "id": "shot-1", "episode_id": "episode-1" }
    ]
  }
}
```

```json
{
  "data": {
    "id": "task-1",
    "status": "pending"
  }
}
```

页面不需要知道后端是否使用了统一响应包装，拿到的始终是实际业务 payload。

### 4.2 API 层统一处理 HTTP 错误

现在接口在 `res.ok === false` 时会：

1. 优先解析 JSON 响应；
2. 按顺序读取 `detail`、`message`、`error`、`status_message`；
3. JSON 解析失败时读取纯文本或网关 HTML，并清理 HTML 标签；
4. 将 HTTP 状态写入 `error.status`；
5. 抛出带具体原因的错误。

这样可以区分 422 请求体错误、502 网关或后端服务异常，以及其他由后端返回具体原因的错误。

### 4.3 页面同时兼容同步数组和异步任务

按集生成和重新分镜现在采用以下处理顺序：

```text
响应是数组
  -> 直接作为当前分集分镜结果

响应是任务对象
  -> 读取 task_id / taskId / id
  -> 轮询 /api/tasks/{task_id}
  -> 任务完成后读取结果或重新请求当前分集分镜

响应既不是数组也没有任务 ID
  -> 只有明确终态成功状态才继续
  -> 否则展示“未返回分镜结果或任务 ID”
```

轮询终态成功状态兼容：`completed`、`success`、`succeeded`、`done`。

轮询失败状态兼容：`failed`、`error`、`cancelled`、`canceled`。

所有状态都会先转成小写再比较，因此 `COMPLETED`、`Failed` 等形式也可以识别。

### 4.4 任务进行中状态补全

`src/utils/storyboardTaskAdapter.js` 中的 `isStoryboardTaskInProgress` 现在识别：

```text
pending
queued
created
running
processing
in_progress
in-progress
```

只有这些状态会继续轮询。这样后端任务处于排队、创建中或处理中时，不会被前端提前当成完成。

### 4.5 生成完成后的数据刷新

异步任务完成后，页面按以下优先级读取数据：

1. 任务响应中的 `storyboards` 数组；
2. 任务响应中的 `results`，且确认结果项具备分镜特征字段，例如 `episode_id` 或 `shot_number`；
3. 重新请求当前分集的分镜列表第一页：

```text
GET /api/projects/{project_id}/storyboards
  ?episode_id={episode_id}
  &limit=10
  &offset=0
```

重新读取后，页面会标准化分镜字段、更新当前分集列表、更新分页状态，并重新加载候选媒体和定稿状态。

## 5. 修复后的文件职责

### `src/api/storyboard.js`

负责调用按集生成接口，发送 `episode_id`、`model`、`overwrite_existing`，处理 HTTP 错误，解开统一响应包装，并将数组、包装数组和任务对象转换成页面可处理的业务 payload。

### `src/pages/StoryboardPage.jsx`

负责触发按集生成和重新分镜，判断同步数组还是异步任务，启动任务轮询，处理任务成功、失败和超时，生成完成后刷新当前分集第一页，并将结果写入页面分镜列表。

### `src/utils/storyboardTaskAdapter.js`

负责读取任务状态、判断任务是否仍在进行，以及识别图片和视频任务结果。该工具不调用接口、不操作 React 状态，也不负责页面提示。

## 6. 修复前后对比

| 项目 | 修复前 | 修复后 |
| --- | --- | --- |
| `generate` 正常数组响应 | 页面只在部分路径下直接使用 | API 层明确优先识别并返回数组 |
| `{ data: ... }` 包装 | 可能被页面当成普通对象 | API 层统一解包 |
| `{ result: ... }` / `{ payload: ... }` 包装 | 不支持 | 支持 |
| `storyboards/list/items` 包装数组 | 不完整 | 支持 |
| 异步任务响应 | 只兼容扁平任务对象 | 兼容解包后的任务对象 |
| 任务状态 | 只稳定识别 `pending/running` | 增加排队、创建、处理中状态 |
| 状态大小写 | 严格匹配 | 统一转小写匹配 |
| HTTP 错误 | 错误原因不稳定 | 读取后端详细错误并保留 HTTP 状态 |
| 任务完成后的刷新 | 可能在结果写入前读取空列表 | 优先消费任务结果，必要时重新请求当前分集第一页 |
| 分页 | 可能回退到整集旧缓存 | 完成后按 `limit=10, offset=0` 刷新 |

## 7. 当前完整调用链

### 7.1 从分镜页面点击“开始智能分镜”

```text
点击按钮
  -> StoryboardPage.handleStartEpisodeGeneration()
  -> apiGenerateStoryboardsFromEpisode(projectId, payload)
  -> POST /api/projects/{project_id}/storyboards/generate
  -> 解析数组或任务 payload
  -> 必要时 GET /api/tasks/{task_id} 轮询
  -> 读取 storyboards/results 或重新 GET 当前分集分镜
  -> normalizeStoryboardList()
  -> setShots()
  -> 页面展示分镜列表
```

### 7.2 从分镜页面点击“重新分镜”

```text
点击“重新分镜”
  -> 打开 AI 重新分镜弹窗
  -> 提交要求
  -> StoryboardPage.handleRegenerate()
  -> 清空当前分集旧列表并进入加载态
  -> apiGenerateStoryboardsFromEpisode(projectId, payload)
  -> payload 中包含 overwrite_existing: true
  -> 解析同步数组或异步任务
  -> 必要时轮询
  -> 刷新当前分集分镜第一页
  -> 关闭加载态并展示新结果
```

当前弹窗里的 `instruction` 仍然保留在前端表单中，但由于 OpenAPI 的 `GenerateStoryboardRequest` 没有声明该字段，现阶段不会发送到 `generate` 请求体中。若后端需要支持“按要求重新分镜”，应先在 OpenAPI 中补充字段，再同步修改 API 适配。

## 8. 验证结果

本次修复已执行：

```bash
npx eslint src/api/storyboard.js src/pages/StoryboardPage.jsx src/utils/storyboardTaskAdapter.js
npm run build
git diff --check
```

结果：

- 定向 ESLint 通过；
- Vite 构建通过；
- `git diff --check` 通过；
- 构建输出仍有既有的大体积 chunk 警告，但不影响构建成功。

## 9. 联调检查清单

后续如果再次出现“点击按钮后无反应”，建议按以下顺序检查浏览器 Network：

1. 确认请求方法是 `POST`；
2. 确认路径是 `/api/projects/{project_id}/storyboards/generate`；
3. 确认请求体至少包含正确的 `episode_id`；
4. 确认 HTTP 状态码；
5. 如果是 200，查看响应是否为数组、`data` 包装、任务对象或错误信息；
6. 如果返回任务对象，确认 `id` 或 `task_id` 存在；
7. 确认后续是否请求了 `/api/tasks/{task_id}`；
8. 确认任务状态没有停留在 `queued/processing` 却被页面提前当成完成；
9. 确认任务完成后是否请求了当前 `episode_id` 的分镜列表；
10. 确认分镜列表请求的返回数据确实属于当前分集，而不是上一集或旧缓存。

## 10. 相关代码入口

- [分镜生成 API](/Users/suzylee/Desktop/miioo/frontend/src/api/storyboard.js)
- [分镜页面生成流程](/Users/suzylee/Desktop/miioo/frontend/src/pages/StoryboardPage.jsx)
- [分镜任务状态适配](/Users/suzylee/Desktop/miioo/frontend/src/utils/storyboardTaskAdapter.js)
- [OpenAPI 文档](/Users/suzylee/Desktop/miioo/frontend/src/api/openapi.json)
