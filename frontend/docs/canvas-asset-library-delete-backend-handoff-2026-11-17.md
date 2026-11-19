# 画布资产库普通素材删除异常：后端交接

> 日期：2026-11-17
> 状态：前端已完成误跳转防护；普通素材删除失败的服务端根因待后端修复和联调。
> 涉及模块：资产库 → 画布资产 → 素材删除
> 后端接口：`POST /api/canvas-asset-library/deletions/preview`、`POST /api/canvas-asset-library/deletions/commit`

## 一、问题现象

复现步骤：

1. 同一项目中存在画布 1 和画布 2。
2. 进入资产库的「画布资产」页签，选择画布 1。
3. 删除画布 1 中的一个普通媒体素材，在二次确认弹窗中点击确认。
4. 页面从画布 1 切到画布 2，画布 1 短暂从左侧列表消失。
5. 数秒后画布 1 重新出现在列表中。
6. 手动切回画布 1，待删除素材仍然存在。

控制台中的接口响应为：

```json
{
  "detail": {
    "code": "COLLECTION_NOT_FOUND",
    "message": "资产集合不存在或已被删除"
  }
}
```

从现象和响应可以确定两件事：

1. 这是普通素材删除请求，不是集合删除请求，但服务端返回了集合级 `COLLECTION_NOT_FOUND`。
2. 素材没有真正删除。当前问题不能只靠前端刷新或切换列表解决。

## 二、当前前端请求与处理

### 2.1 删除预检

前端根据用户选中的普通素材提交：

```json
{
  "selection": [
    {
      "type": "entry",
      "id": "<entry_id>",
      "base_revision": 1
    }
  ]
}
```

请求地址：

```http
POST /api/canvas-asset-library/deletions/preview
```

预检成功后，服务端返回 `preview_token`。

### 2.2 删除提交

前端提交预检凭证和本次幂等键：

```json
{
  "preview_token": "<preview_token>",
  "idempotency_key": "<uuid>"
}
```

请求地址：

```http
POST /api/canvas-asset-library/deletions/commit
```

本次异常发生在这个提交阶段。前端没有把 `type: "collection"` 发给普通素材删除接口。

### 2.3 前端已实施的防护

前端已在 [CanvasLibraryContents.jsx](../src/components/assets/CanvasLibraryContents.jsx) 和
[CanvasLibraryItems.js](../src/components/assets/CanvasLibraryItems.js) 增加范围感知处理：

- 只有原删除选择中包含 `type: "collection"` 时，`COLLECTION_NOT_FOUND` 才允许移除当前画布集合。
- 普通 `entry` 或 `folder` 删除返回 `COLLECTION_NOT_FOUND` 时，不再切到同项目的其他画布。
- 普通删除失败时保留当前画布和当前目录，只刷新内容。

因此前端现在可以防止“画布 1 消失并跳到画布 2”，但无法修复服务端没有执行素材删除的问题。

前端不会把画布资产条目的删除兜底改成 `DELETE /api/assets/{asset_id}`。该接口表达的是通用资产删除或回收站语义，不能替代画布资产库对 `entry`、目录树、引用关系和画布媒体绑定的完整清理，否则会产生跨模块状态不一致。

## 三、后端需要达到的目标行为

普通素材删除端到端必须满足以下结果：

1. `preview` 根据明确的 `entry_id` 冻结目标素材、所属目录和所属集合。
2. `commit` 按预检时的不可变选择快照执行，不能再根据错误编号或当前页面状态重新推断对象。
3. 原生素材删除后，该素材从资产库读取结果中消失。
4. 需要失效的收藏、目录条目、画布媒体绑定、预览地址和生成参考按既有产品规则在同一业务操作中处理。
5. 普通素材删除不得移除整个资产集合，也不得返回集合级 `COLLECTION_NOT_FOUND`。
6. 前端刷新、重新聚焦、切换页签或等待后台对账后，已删除素材不能重新出现。
7. 重复提交同一个幂等键时，应回放同一结果，不重复执行删除或产生第二次副作用。

## 四、后端必须修改或确认的点

### 4.1 修正 `commit` 的对象解析和错误码

后端需要检查 `deletions/commit` 的调用链是否存在以下问题：

- 把 `entry_id` 当成 `collection_id` 使用。
- 从预检记录中丢失了 `selection[i].type`，只保留了 `id`。
- 用素材所属目录、当前打开画布或其他上下文错误反查集合。
- 集合关联已变化后，把“找不到集合”错误传播成了普通素材删除失败。
- 预检凭证解析成功后，又读取了会变化或已失效的集合指针。

`commit` 应先从 `preview_token` 恢复不可变选择快照，再按 `type` 分派：

| 选择类型 | 执行对象 | 成功后的最低要求 |
| --- | --- | --- |
| `entry` | 指定 `entry_id` | 删除或失效该条目；原生素材按产品删除矩阵处理 |
| `folder` | 指定 `folder_id` | 递归处理该目录及范围内条目 |
| `collection` | 指定 `collection_id` | 删除集合入口并在 `removed_collection_ids` 中返回编号 |

所属集合应从已经校验过归属关系的对象或预检快照中派生。不能把条目编号、目录编号和集合编号视为可互换的同一字段。

推荐错误码语义：

| 场景 | 推荐状态码 | 推荐错误码 |
| --- | ---: | --- |
| 预检凭证过期 | 409 | `DELETE_PREVIEW_EXPIRED` |
| 预检后条目、目录或影响范围变化 | 409 | `DELETE_SCOPE_CHANGED` |
| 版本不一致 | 409 | `REVISION_CONFLICT` |
| 用户无权限 | 403 | `PERMISSION_DENIED` |
| 所属集合确实已不存在 | 404 | `COLLECTION_NOT_FOUND` |
| 集合仍存在，但普通条目或目录找不到 | 不返回 `COLLECTION_NOT_FOUND` | 优先复用 `DELETE_SCOPE_CHANGED`，或补充对象级错误码 |
| 服务端写入失败 | 5xx | 保留可用于定位的服务端错误码 |

普通素材删除只有在“其所属集合本身确实不存在”时才允许返回 `COLLECTION_NOT_FOUND`。如果集合仍存在，只是 `entry_id` 无效、已删除或关联关系异常，应返回范围变化或对象级错误，前端才能展示准确反馈。

### 4.2 统一错误响应结构

当前 OpenAPI 的 `ErrorResponse` 定义是：

```json
{
  "code": "COLLECTION_NOT_FOUND",
  "message": "资产集合不存在或已被删除",
  "detail": null
}
```

本次实际响应把业务错误放进了 `detail`：

```json
{
  "detail": {
    "code": "COLLECTION_NOT_FOUND",
    "message": "资产集合不存在或已被删除"
  }
}
```

请后端统一为 OpenAPI 已声明的顶层 `code`、`message`、`detail` 结构。若要兼容旧客户端，可在迁移期同时返回顶层字段，但不要把嵌套 `detail` 作为新契约。

同时请在 `deletions/preview` 和 `deletions/commit` 的 OpenAPI 响应中补充实际会返回的 `404`、`409` 及业务错误码。当前接口文档只列出 `401`、`403`、`422`、`500`，无法从契约看出集合或范围失效的处理方式。

### 4.3 让删除执行具备原子性

`commit` 应围绕预检快照执行一个完整的业务操作，并明确事务边界：

1. 校验当前用户、预检凭证、过期时间和幂等键。
2. 重新验证集合、目录或条目仍存在，且仍在预检时的所属关系内。
3. 检查版本和删除范围是否变化。范围变化时拒绝执行并要求重新预检。
4. 执行目录条目、原生资产、仅引用条目及画布媒体绑定的删除或失效。
5. 写入操作记录、删除墓碑或等效失效状态。
6. 提交事务后再清理缓存并发布变更事件。

如果在事务中途失败，不能返回成功，也不能让列表读取到部分删除状态。异步删除也必须让 `GET /api/canvas-asset-library/operations/{operation_id}` 明确返回 `failed` 或最终 `completed`，且失败时不得伪造“已删除”结果。

### 4.4 保证幂等和重试语义

- 同一 `idempotency_key`、同一 `preview_token` 的重试必须返回第一次提交的结果。
- 提交已经开始但客户端断开时，重试不能再次删除或再次清理画布引用。
- 同一 `preview_token` 被执行后，不能让后续 `commit` 因“对象已不存在”返回一个看似相反的 404。
- 过期或范围变化必须使用稳定的业务错误码，不能退化为泛化 404。
- 幂等记录和删除结果需存活到预检凭证的完整重试窗口结束以后。

### 4.5 防止删除后重新出现

请检查以下读侧和后台任务：

- 画布资产列表的缓存与历史补录。
- 画布节点引用的自动入库或 reconcile。
- 上传、生成、编辑任务成功回调的重复消费。
- 前端重新聚焦、可见性变化触发的刷新。
- 集合列表发现逻辑是否会把已删除集合重新创建或重新返回。

删除成功后，相关条目、原生资产和集合必须有可靠的失效或墓碑状态。任何补录、对账或缓存重建都不能把已删除记录重新发布为可用资产。

### 4.6 删除响应只报告真实发生的对象

`DeletionCommitOut.removed_collection_ids` 只能包含本次真实删除的集合编号。普通素材删除成功时，该字段应为空数组。

如果同步完成，建议返回：

```json
{
  "operation_id": "<operation_id>",
  "status": "completed",
  "impact": {
    "folder_count": 0,
    "native_asset_count": 1,
    "reference_only_count": 0,
    "affected_project_count": 1,
    "affected_canvas_count": 1,
    "affected_node_count": 1
  },
  "removed_collection_ids": []
}
```

实际计数按删除矩阵和引用关系计算；上述示例只说明字段语义。

如果异步执行，首次响应返回 `pending` 或 `processing`，随后通过 operation 接口报告终态。无论同步还是异步，都不应在失败时返回 `removed_collection_ids` 或暗示条目已经删除。

## 五、需要后端提供的诊断信息

请后端针对测试环境复现一次，并提供以下信息：

1. 前端请求对应的 request ID、时间戳和部署版本。
2. `deletions/preview` 收到的原始 `selection`，确认其中只有 `type: "entry"`。
3. 预检记录中保存的对象类型、`entry_id`、`folder_id`、`collection_id`、`base_revision`。
4. `deletions/commit` 从 `preview_token` 解析出的选择快照。
5. 抛出 `COLLECTION_NOT_FOUND` 的具体文件、函数和查询条件。
6. commit 事务是否开始、是否回滚，以及素材、entry、asset binding 的最终状态。
7. 修复后的请求/响应样例和对应服务端测试结果。

日志中不要输出完整访问令牌或可直接复用的原始 `preview_token`；记录脱敏后的 token 标识或哈希即可。

## 六、联调验收清单

### 6.1 主场景

| 编号 | 操作 | 验收结果 |
| --- | --- | --- |
| 1 | 项目内有画布 1、画布 2；在画布 1 删除一个普通素材并确认 | commit 成功；当前仍停留在画布 1 |
| 2 | 删除后立即读取画布 1 列表 | 待删除素材不再出现 |
| 3 | 刷新页面、切换画布 2 再返回画布 1 | 素材仍保持删除 |
| 4 | 页面失焦再聚焦，等待列表自动刷新和对账完成 | 画布 1 不消失，素材不重新出现 |
| 5 | 等待至少一个后台对账周期后重新登录 | 删除状态持久化 |
| 6 | 查看画布 1 和画布 2 的集合入口 | 两个画布集合均正常保留，不发生误切换 |

### 6.2 错误与幂等场景

| 编号 | 操作 | 验收结果 |
| --- | --- | --- |
| 7 | 重复提交同一幂等键 | 返回同一结果，不重复删除副作用 |
| 8 | 使用过期 preview token | 返回 `DELETE_PREVIEW_EXPIRED` |
| 9 | 预检后修改目标条目或影响范围再提交 | 返回 `DELETE_SCOPE_CHANGED`，要求重新预检 |
| 10 | 普通 entry 已不存在，但集合仍存在 | 不返回 `COLLECTION_NOT_FOUND` |
| 11 | 删除普通 entry | 成功响应的 `removed_collection_ids` 为空 |
| 12 | 删除整个 collection | 集合入口移除，`removed_collection_ids` 包含该集合 |

### 6.3 目录和画布联动

| 编号 | 操作 | 验收结果 |
| --- | --- | --- |
| 13 | 删除包含原生素材的目录 | 目录树、素材和规定范围内的引用按删除矩阵处理 |
| 14 | 删除仅包含引用条目的目录 | 外部原件及其他位置引用保留 |
| 15 | 删除被画布节点使用的原生素材 | 节点及连线保留，相关媒体内容和失效引用被清理 |
| 16 | 删除被多处使用的素材 | 所有规定位置和缓存均失效，不出现局部可用状态 |

## 七、交付标准

后端完成修复后，请同时提供：

- 根因说明和修改文件/迁移记录。
- 修正后的错误码与 HTTP 状态码对照。
- 更新后的 `openapi.json`。
- 单元测试、集成测试或事务回滚测试结果。
- 测试环境按第六节主场景完成的请求/响应样例。
- 明确告知是否需要前端再次调整错误处理或字段适配。

验收标准是：前端无需再次依赖“把普通素材 404 当集合删除”这种猜测逻辑，服务端返回明确错误；普通素材可以真正删除，画布 1 不再消失，也不会自动切换到画布 2。
