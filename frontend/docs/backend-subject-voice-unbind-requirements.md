# 主体卡片直接取消音色后端修复需求

## 1. 需求背景

主体页面的角色卡片支持在卡片封面直接取消已添加的音色。前端取消动作会调用主体更新接口，将当前主体的 `voice_id` 显式设置为 `null`：

```http
PATCH /api/projects/{project_id}/subjects/{subject_id}
Content-Type: application/json
```

请求体：

```json
{
  "voice_id": null
}
```

当前现象是：

1. 前端点击取消后，卡片可能暂时显示为“未选择”。
2. 主体更新接口返回 2xx，但随后主体详情或主体列表仍返回旧的 `voice_id`。
3. 刷新浏览器后，旧音色重新出现在角色卡片上。
4. 前端因此会提示“音色取消未保存成功，请稍后重试”。

这说明 `voice_id: null` 没有稳定地写入主体数据，或者写入后的读取链路仍返回旧数据。

## 2. 接口契约

OpenAPI 中 `SubjectUpdate.voice_id` 的定义允许以下两种状态：

```text
voice_id: string | null
```

因此以下请求必须被区分处理：

| 请求体 | 语义 |
|---|---|
| 未包含 `voice_id` | 不修改当前主体的音色绑定 |
| `{ "voice_id": "xxx" }` | 将主体绑定到指定音色 |
| `{ "voice_id": null }` | 明确解除主体当前的音色绑定 |

后端实现必须遵循 Pydantic `exclude_unset` 语义：不能因为字段值为 `null` 就把它当成“未传入”。

## 3. 需要修复的接口

### 3.1 更新主体

```http
PATCH /api/projects/{project_id}/subjects/{subject_id}
```

后端要求：

1. 校验当前用户拥有或有权限操作该项目和主体。
2. 当请求体包含 `voice_id: null` 时，将主体表对应字段更新为数据库 `NULL`。
3. 不删除音色库中的音色记录。
4. 不删除主体的其他字段、候选图、参考图、资产绑定或定稿图。
5. 返回更新后的完整主体对象，且返回对象中的 `voice_id` 必须为 `null`。
6. 如果接口使用响应包装，必须保证主体对象位于稳定字段中，例如 `subject` 或 `data`，并在接口文档中明确说明。

推荐响应：

```json
{
  "id": "主体 ID",
  "project_id": "项目 ID",
  "type": "character",
  "name": "角色名称",
  "voice_id": null,
  "voice_name": null,
  "voice_preview_url": null,
  "updated_at": "2026-07-31T12:00:00Z"
}
```

如果后端保留 `voice_name` 或 `voice_preview_url` 这类冗余字段，也必须在解绑时同步清空，不能返回旧音色的名称或试听地址。

### 3.2 获取主体详情

```http
GET /api/projects/{project_id}/subjects/{subject_id}
```

当解绑 PATCH 成功后，该接口必须返回：

```json
{
  "voice_id": null,
  "voice_name": null,
  "voice_preview_url": null
}
```

不允许因为关联查询、缓存或序列化逻辑继续返回解绑前的音色。

### 3.3 获取主体列表

```http
GET /api/projects/{project_id}/subjects?type=character&limit=200
```

当主体已经解绑后，列表中的对应主体必须返回 `voice_id: null`。列表接口和详情接口必须读取同一份最新持久化数据。

## 4. 重点排查项

### 4.1 `null` 被当成未传入

错误示例：

```python
if payload.voice_id:
    subject.voice_id = payload.voice_id
```

这种写法会忽略 `None`，导致旧音色无法清除。

应改为判断字段是否被显式设置，例如：

```python
updates = payload.model_dump(exclude_unset=True)
if "voice_id" in updates:
    subject.voice_id = updates["voice_id"]
```

### 4.2 ORM 更新没有提交事务

确认设置 `voice_id = None` 后确实执行 `flush` / `commit`，并且接口返回对象是在 commit 后重新读取或刷新得到的，而不是使用提交前的旧 ORM 对象。

### 4.3 关联音色查询覆盖了主体字段

如果响应组装逻辑通过音色表反查 `voice_name` 或 `voice_preview_url`，必须先判断 `subject.voice_id` 是否为空。`voice_id` 为空时，名称和试听地址也必须返回 `null`，不能从历史关联或缓存中补回旧音色。

### 4.4 缓存未失效

如果主体详情、主体列表或项目概览使用 Redis、进程内缓存或其他缓存层，解绑成功后必须失效对应项目和主体的缓存。缓存刷新不能晚于接口响应，不能让 PATCH 成功后连续数秒继续返回旧绑定。

### 4.5 主体与音色关系表仍存在旧绑定

如果系统除主体表 `voice_id` 外还维护主体与音色的关系表，解绑时必须同步删除或停用对应关系；读取接口不得优先从关系表恢复旧 `voice_id`。

## 5. 验收用例

请使用一个当前已绑定音色的角色主体进行验证。

### 用例 A：正常取消

1. 请求主体 PATCH，发送 `{ "voice_id": null }`。
2. PATCH 返回 2xx。
3. PATCH 响应中的 `voice_id` 为 `null`。
4. 立即请求主体详情，`voice_id` 为 `null`。
5. 请求主体列表，目标主体的 `voice_id` 为 `null`。
6. 主体其他字段和候选图数据保持不变。

### 用例 B：刷新恢复

1. 完成用例 A。
2. 重新建立登录态或刷新浏览器。
3. 再次请求主体列表和主体详情。
4. 目标主体仍为 `voice_id: null`，不能恢复旧音色。

### 用例 C：重新绑定

1. 发送 `{ "voice_id": "新的音色 ID" }`。
2. PATCH、详情和列表均返回新的 `voice_id`。
3. 再发送 `{ "voice_id": null }`。
4. 确认可以再次解绑，不能只支持绑定而不支持清除。

### 用例 D：部分更新不误清除

1. 先绑定音色 A。
2. 发送只包含 `{ "prompt": "新的提示词" }` 的主体 PATCH。
3. 确认 `voice_id` 仍为音色 A。
4. 只有显式发送 `{ "voice_id": null }` 时才清除音色。

## 6. 交付要求

后端修复完成后，请提供：

- PATCH 接口的实际响应示例；
- 详情接口和列表接口的实际响应示例；
- 数据库或 ORM 层确认 `voice_id` 已更新为 `NULL` 的说明；
- 至少覆盖“绑定、解绑、部分更新不误清除、刷新后仍保持解绑”的自动化测试；
- 如存在缓存或主体音色关系表，请说明对应失效和同步处理。

## 7. 安全说明

联调时请使用本地登录态或测试账号，文档、日志和截图中不要粘贴真实访问令牌、Cookie、密码或其他敏感信息。
