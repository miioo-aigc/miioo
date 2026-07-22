# 分镜脚本上传、解析与恢复接口需求

> 文档用途：提供给后端进行接口契约确认和联调。
>
> 当前前端页面已经支持分镜脚本模式：前三个模块展示解析后的真实结构，第四个模块展示只读的“分镜脚本”文件卡片。当前页面出现“未获取到分镜脚本文稿”，说明刷新或任务完成后没有拿到原始 `.xlsx` 文件的持久化元数据，前端无法仅凭结构化结果恢复原始文件。

## 一、业务目标

用户上传分镜脚本 `.xlsx` 后，需要完成以下流程：

1. 后端持久化保存原始 `.xlsx` 文件。
2. 后端创建异步导入任务，解析 Excel 并构建剧本工作区结构。
3. 后端继续执行现有流水线：结构化剧本、发布分集、提取主体、生成提示词、重建分镜。
4. 前端轮询任务状态，任务完成后读取真实结构数据。
5. 页面进入“分镜脚本”模式：
   - 展示真实的整体设定、剧本设计、角色、场景、道具数据；
   - 第四模块标题为“分镜脚本”；
   - 展示原始文件名和下载入口；
   - 不展示“分集剧情”、剧集标签、在线编辑、AI重新分集、AI重写本集、删除本集。
6. 页面刷新后，仍可恢复来源类型、解析结构、任务状态和原始文件下载信息。

## 二、当前问题与结论

当前页面显示：

```text
未获取到分镜脚本文稿
```

这通常表示以下任一情况：

- 历史上传时后端只把文件保存到了临时目录，没有持久化；
- 文件已经保存，但没有绑定到项目或剧本工作区；
- 上传响应返回过文件信息，但工作区、任务或结构接口没有继续返回；
- 返回了文件 ID，但没有返回可用下载地址，前端也没有按文件 ID 获取地址的接口；
- 前端读取的字段名与后端实际字段名不一致。

浏览器中的 `File` 对象只存在于当前页面内存，刷新页面后必然丢失。前端不能从结构化剧本重新生成原始 Excel，也不能猜测下载地址。因此必须由后端保存并持续返回文件元数据。

如果之前的上传记录没有持久化文件，旧文件无法由前端找回，只能让用户重新上传。请后端先确认历史数据是否存在。

## 三、分镜脚本上传接口

### 3.1 请求

```http
POST /api/projects/{project_id}/script-workspace/import-storyboard-xlsx
Content-Type: multipart/form-data
Authorization: Bearer <token>
Idempotency-Key: <uuid>
```

表单字段：

```text
file: .xlsx
```

要求：

- 只接受 Excel 分镜脚本文件；
- 校验文件扩展名和文件内容；
- 文件必须持久化，不得只保存在后台任务临时目录；
- 文件元数据必须绑定到当前项目和当前剧本工作区；
- 需要支持 `Idempotency-Key`，重复提交同一个 key 不应创建重复导入任务；
- 普通剧本上传接口 `/script-workspace/upload` 与分镜脚本上传接口必须保持业务区分。

### 3.2 返回

接口可以返回 `202 Accepted`，但必须返回可用于轮询和追踪的任务信息，以及已经创建的文件信息：

```json
{
  "operation_id": "327c60a0-70fa-44fb-86f0-9f938a10ac71",
  "task_id": "327c60a0-70fa-44fb-86f0-9f938a10ac71",
  "status": "accepted",
  "operation": "import_storyboard_xlsx",
  "source_type": "storyboard_import",
  "storyboard_file": {
    "file_id": "文件资源ID",
    "file_name": "分镜脚本名称.xlsx",
    "download_url": "/api/projects/{project_id}/script-workspace/storyboard-file/download"
  }
}
```

字段要求：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `task_id` | 是 | 前端轮询任务状态使用的 ID。不能只返回 `operation_id`。 |
| `operation_id` | 建议 | 用于幂等、日志和问题追踪。 |
| `operation` | 是 | 固定为 `import_storyboard_xlsx`。 |
| `source_type` | 是 | 建议固定为 `storyboard_import`，用于决定页面第四模块类型。 |
| `storyboard_file.file_id` | 是 | 持久化文件资源 ID。 |
| `storyboard_file.file_name` | 是 | 用户上传的真实文件名。 |
| `storyboard_file.download_url` | 是或提供等价接口 | 原始文件下载地址，不能是前端猜测的地址。 |

## 四、异步任务状态接口

### 4.1 请求

```http
GET /api/projects/{project_id}/script-workspace/tasks/{task_id}
```

### 4.2 处理中响应

```json
{
  "operation_id": "327c60a0-70fa-44fb-86f0-9f938a10ac71",
  "task_id": "327c60a0-70fa-44fb-86f0-9f938a10ac71",
  "type": "scriptStructure",
  "operation": "import_storyboard_xlsx",
  "source_type": "storyboard_import",
  "status": "running",
  "current_stage": "extracting_subjects",
  "stage_label": "提取主体",
  "status_message": "正在按分集提取角色、场景和道具",
  "source_revision": 1,
  "progress": {
    "subject_progress": {
      "total": 2,
      "completed": 1,
      "success_count": 0,
      "fail_count": 1,
      "completed_episode_ids": [],
      "completed_episode_numbers": [1],
      "failed_episode_numbers": [1]
    },
    "prompt_progress": {
      "total": 28,
      "completed": 0,
      "fallback_count": 0
    },
    "storyboard_progress": {
      "total": 2,
      "completed": 0,
      "created_count": 0
    }
  },
  "storyboard_file": {
    "file_id": "文件资源ID",
    "file_name": "分镜脚本名称.xlsx",
    "download_url": "/api/projects/{project_id}/script-workspace/storyboard-file/download"
  },
  "result": null,
  "error": null
}
```

### 4.3 状态口径

顶层 `status` 必须使用并明确以下状态：

```text
pending
running
completed
partial
failed
error
cancelled
```

重要约定：

- `subject_progress.fail_count > 0` 只表示某些分集主体抽取失败，不代表整个任务已经失败；
- 只有顶层 `status` 为 `failed`、`error` 或 `cancelled` 时，前端才把任务视为终止失败；
- `partial` 表示部分结果可用，必须同时返回可用结构和错误明细；
- 任务进入终态后仍必须返回 `storyboard_file`，不能因为任务完成就丢弃文件信息；
- `source_type` 和 `operation` 在任务全生命周期内保持稳定。

### 4.4 失败或部分成功响应

```json
{
  "status": "partial",
  "source_type": "storyboard_import",
  "storyboard_file": {
    "file_id": "文件资源ID",
    "file_name": "分镜脚本名称.xlsx",
    "download_url": "/api/projects/{project_id}/script-workspace/storyboard-file/download"
  },
  "result": {
    "structure_available": true
  },
  "error": {
    "code": "STORYBOARD_SUBJECT_EXTRACTION_PARTIAL",
    "message": "部分分集主体提取失败",
    "details": []
  }
}
```

## 五、工作区恢复接口

### 5.1 请求

```http
GET /api/projects/{project_id}/script-workspace
```

刷新页面时，该接口必须能恢复分镜脚本模式和文件信息：

```json
{
  "source_type": "storyboard_import",
  "active_task": null,
  "storyboard_file": {
    "file_id": "文件资源ID",
    "file_name": "分镜脚本名称.xlsx",
    "download_url": "/api/projects/{project_id}/script-workspace/storyboard-file/download"
  },
  "structure": {
    "revision": 1,
    "schema_version": "script_structure.v1",
    "payload": {
      "overall_settings": {},
      "script_design": {},
      "subjects": {
        "characters": [],
        "scenes": [],
        "props": []
      },
      "episodes": []
    }
  }
}
```

要求：

- `source_type` 必须持久化，不能只在上传响应中返回一次；
- `storyboard_file` 必须持久化，不能只存在 React 内存或任务临时对象中；
- 任务进行中返回 `active_task`，任务完成后可以返回 `null`；
- 页面刷新后必须仍能区分普通剧本和分镜脚本；
- 没有文件记录的历史项目应返回明确的空值或错误码，不要返回无法解释的虚构文件信息。

## 六、结构接口

### 6.1 请求

```http
GET /api/projects/{project_id}/script-workspace/structure
```

### 6.2 响应

```json
{
  "revision": 1,
  "schema_version": "script_structure.v1",
  "source_type": "storyboard_import",
  "operation": "import_storyboard_xlsx",
  "storyboard_file": {
    "file_id": "文件资源ID",
    "file_name": "分镜脚本名称.xlsx",
    "download_url": "/api/projects/{project_id}/script-workspace/storyboard-file/download"
  },
  "payload": {
    "overall_settings": {},
    "script_design": {},
    "subjects": {
      "characters": [],
      "scenes": [],
      "props": []
    },
    "episodes": []
  }
}
```

说明：

- `source_type` 是前端切换第四模块的关键字段；
- 即使 `payload.episodes` 存在，前端在分镜脚本模式下也不把它渲染成“分集剧情”；
- 前三个模块仍从该结构读取真实数据；
- 分镜模式第四模块只使用 `storyboard_file` 展示文件卡片，不支持在线编辑；
- `schema_version` 当前普通结构协议使用 `script_structure.v1`，如分镜导入需要单独协议，请明确声明兼容值。

## 七、文件下载接口

推荐提供稳定的项目工作区下载地址：

```http
GET /api/projects/{project_id}/script-workspace/storyboard-file/download
```

也可以采用资源 ID 方式：

```http
GET /api/files/{file_id}/download
```

要求：

- 必须鉴权并校验当前用户对项目的访问权限；
- 返回原始 `.xlsx` 文件流，而不是重新生成的结构化内容；
- `Content-Disposition` 使用真实文件名；
- 下载地址可以是稳定项目地址，也可以是短时签名地址；
- 如果是短时签名地址，工作区恢复接口必须返回最新有效地址，或必须提供按 `file_id` 获取/生成下载地址的接口；
- 前端只使用后端返回的 `download_url`，不会猜测 URL，也不会使用浏览器临时 `blob:` 地址替代后端文件地址。

## 八、统一错误响应

建议统一返回：

```json
{
  "detail": {
    "code": "STORYBOARD_FILE_NOT_FOUND",
    "message": "当前项目没有可下载的分镜脚本文件"
  }
}
```

至少需要覆盖以下错误码：

| 错误码 | 含义 |
| --- | --- |
| `STORYBOARD_FILE_NOT_FOUND` | 项目没有已持久化的分镜脚本文件 |
| `STORYBOARD_FILE_EXPIRED` | 文件已过期或存储对象不可用 |
| `STORYBOARD_IMPORT_FAILED` | 分镜脚本导入任务失败 |
| `STORYBOARD_TASK_NOT_FOUND` | 任务不存在或不属于当前项目 |
| `STORYBOARD_SCHEMA_INVALID` | Excel 结构不符合分镜模板 |
| `STORYBOARD_PROJECT_ACCESS_DENIED` | 当前用户无项目访问权限 |

## 九、请后端确认的问题

1. 之前上传的 `.xlsx` 文件是否已经持久化？
2. 如果已持久化，文件是否绑定到了项目和剧本工作区？
3. 文件名、文件 ID、下载地址保存在哪个资源对象或数据表中？
4. `GET /script-workspace` 是否会返回 `storyboard_file`？
5. `GET /script-workspace/structure` 是否会返回 `source_type`？
6. 任务完成后是否仍会保留 `storyboard_file`？
7. 下载地址是稳定地址、项目鉴权地址，还是短时签名地址？
8. 没有历史文件记录的项目是否需要用户重新上传？
9. `task_id` 和 `operation_id` 的用途是否不同？
10. 任务为 `partial` 时，原始 `.xlsx` 是否仍然保证可下载？
11. 分镜导入是否使用 `script_structure.v1`，还是需要另一个明确的 `schema_version`？

## 十、验收标准

后端完成后，前端按以下场景联调：

- 上传 `.xlsx` 返回 `task_id`、`source_type` 和文件元数据；
- 前端轮询任务时能看到阶段和进度；
- 主体抽取出现分集失败时，顶层任务仍按实际情况返回 `running` 或 `partial`，不会误报为已完成或已失败；
- 任务完成后前三个模块展示真实解析数据；
- 第四模块标题为“分镜脚本”，不出现“分集剧情”；
- 分镜模式不显示在线编辑和 AI 分集操作；
- 文件卡片显示后端返回的真实文件名；
- 点击“下载”获得原始 `.xlsx` 文件；
- 刷新页面后仍恢复分镜脚本模式、真实文件名和下载入口；
- 使用没有历史文件记录的旧项目时，页面显示明确错误或空态，不伪造成功；
- 普通剧本上传仍走普通剧本结构化接口，不受分镜脚本流程影响。

## 十一、前端当前接入边界

前端页面只通过 API 适配层调用以下接口：

- `apiImportStoryboardXlsx`
- `apiGetScriptTask`
- `apiGetScriptStructure`
- `apiGetScriptWorkspace`

前端不会：

- 把 `.xlsx` 发送到普通剧本 `/script-workspace/upload`；
- 把普通 `/storyboards` 增删改接口当作 Excel 文件上传接口；
- 根据项目 ID、文件名或其他规则猜测下载 URL；
- 用结构化剧本内容重新伪造原始 Excel；
- 在分镜脚本模式下提供在线编辑。

