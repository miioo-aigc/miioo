# 分镜台词分配音色交接契约

## 1. 需求范围

项目 → 分镜 → 台词分配弹窗已移除语速、音量字段及其保存逻辑，新增“选择音色”字段。

- 未选择音色：显示“请选择音色”和“选择”。
- 已选择音色：显示耳机图标、音色名称和“重选”。
- 点击“选择/重选”复用主体页角色 Tab 的选择音色弹窗。
- 二级弹窗确认后立即保存该角色的全局默认音色。
- 台词分配弹窗底部只保留“取消”和“确定”。“确定”保存当前分镜的角色、音色和台词；“取消”不保存本次台词编辑。
- 固定角色“旁白”不是主体，但必须可以设置项目级全局默认音色。

## 2. 普通角色接口

已有接口继续使用：

```http
PATCH /api/projects/{project_id}/subjects/{subject_id}
Content-Type: application/json
```

请求体至少支持：

```json
{
  "voice_id": "voice-id"
}
```

清空音色时必须允许：

```json
{
  "voice_id": null
}
```

主体列表和主体详情读取时，角色主体需要返回以下字段。`voice_name` 和 `voice_preview_url` 没有值时可以为 `null`：

```json
{
  "id": "subject-id",
  "name": "虎大",
  "voice_id": "voice-id",
  "voice_name": "新闻女声",
  "voice_preview_url": "/uploads/voices/news.mp3"
}
```

其中 `voice_id` 是持久化和后续配音调用的唯一音色标识，名称和试听地址用于前端展示与回显。

## 3. 旁白项目级接口

旁白不属于 `subjects`，不要创建虚拟 subject，也不要调用主体 PATCH。建议新增以下接口：

### 3.1 读取项目音色设置

```http
GET /api/projects/{project_id}/voice-settings
```

建议响应：

```json
{
  "narrator_voice_id": "voice-id",
  "narrator_voice_name": "温柔旁白",
  "narrator_voice_preview_url": "/uploads/voices/narrator.mp3"
}
```

没有设置时返回 200，并将三个字段返回为 `null`，不要因为没有设置返回 404：

```json
{
  "narrator_voice_id": null,
  "narrator_voice_name": null,
  "narrator_voice_preview_url": null
}
```

### 3.2 更新项目音色设置

```http
PATCH /api/projects/{project_id}/voice-settings
Content-Type: application/json
```

请求体：

```json
{
  "narrator_voice_id": "voice-id"
}
```

清空旁白默认音色时：

```json
{
  "narrator_voice_id": null
}
```

响应建议直接返回更新后的完整设置：

```json
{
  "narrator_voice_id": "voice-id",
  "narrator_voice_name": "温柔旁白",
  "narrator_voice_preview_url": "/uploads/voices/narrator.mp3"
}
```

后端可在保存时根据 `narrator_voice_id` 查询音色名称和试听地址，前端只提交 ID，不依赖前端提交的名称作为权威数据。

## 4. 分镜台词结构化字段

分镜接口的 `dialogues_json` 需要允许保存数组，每一项支持：

```json
{
  "role": "虎大",
  "role_type": "subject",
  "subject_id": "subject-id",
  "voice_id": "voice-id",
  "voice_name": "新闻女声",
  "voice_preview_url": "/uploads/voices/news.mp3",
  "lines": "大家好，欢迎来到森林。"
}
```

旁白示例：

```json
{
  "role": "旁白",
  "role_type": "narrator",
  "subject_id": null,
  "voice_id": "voice-id",
  "voice_name": "温柔旁白",
  "voice_preview_url": "/uploads/voices/narrator.mp3",
  "lines": "清晨，森林里起了薄雾。"
}
```

字段约定：

| 字段 | 类型 | 是否允许 null | 说明 |
| --- | --- | --- | --- |
| `role` | string | 否 | 当前台词角色名称 |
| `role_type` | string | 否，旧数据可缺省 | `subject` 或 `narrator` |
| `subject_id` | string | 是 | 普通角色对应主体 ID；旁白必须为 `null` |
| `voice_id` | string | 是 | 当前分镜台词使用的音色 ID；未选择时为 `null` |
| `voice_name` | string | 是 | 音色展示名称快照 |
| `voice_preview_url` | string | 是 | 音色试听地址快照 |
| `lines` | string | 否 | 台词文本 |

`voice_name`、`voice_preview_url` 是展示快照，权威关联仍是 `voice_id`。如果后端不希望存快照，也至少要在读取 `dialogues_json` 时根据 `voice_id` 补齐这两个返回字段。

## 5. 保存与读取规则

1. 台词分配弹窗二级音色弹窗确认成功后，前端立即调用全局音色接口；接口失败时不会更新前端全局默认值，并提示保存失败。
2. 普通角色全局默认音色来源是主体的 `voice_id`；旁白全局默认音色来源是项目的 `narrator_voice_id`。
3. 新增台词记录默认带入当前角色的全局默认音色，但记录保存后保留自己的音色字段。
4. 编辑已有台词记录时，优先使用该条记录自己的 `voice_id`；旧记录没有音色字段时，回退到当前角色全局默认音色。
5. 同一角色后续修改全局默认音色，不应静默改写历史台词记录中已经保存的 `voice_id`。
6. 台词确定保存时，分镜 PATCH 需要同时更新 `dialogues_json` 和兼容字段 `gen_params.narration_segments`。
7. 旧的 `voiceover` 文本仍可保留为兼容字段，格式为每行“角色：台词”；不要把音色 ID 拼入 `voiceover` 文本。
8. 旧分镜没有音色字段时必须正常读取，前端显示“请选择音色”。
9. 不再使用 `speed`、`volume`；后端不应要求这两个字段才能保存台词，也不应从旧默认值覆盖新数据。

## 6. 错误响应建议

建议使用标准 HTTP 状态码，并返回可读的 `detail` 或 `message`：

```json
{
  "detail": "音色不存在或当前用户无权使用"
}
```

- `401`：登录态失效。
- `403`：无权访问项目或主体。
- `404`：项目、主体或音色不存在。
- `422`：请求字段格式错误。
- `409`：项目音色设置冲突时使用。

更新成功必须返回 2xx。尤其是 `voice_id: null` 的清空操作，成功后应返回明确的 `null`，避免前端继续显示旧音色。

## 7. 后端验收清单

- [ ] 主体 PATCH 接受并持久化 `voice_id`，支持 `null` 清空。
- [ ] 主体列表/详情返回 `voice_id`、`voice_name`、`voice_preview_url`。
- [ ] 新增项目级旁白音色读取接口。
- [ ] 新增项目级旁白音色更新接口，支持 `null` 清空。
- [ ] `dialogues_json` 支持上述七个字段并原样保存数组。
- [ ] `role_type=narrator` 时不要求 `subject_id`，且不会按主体外键校验。
- [ ] `role_type=subject` 时可校验 `subject_id` 属于当前项目。
- [ ] 旧台词数据无音色字段时仍可返回并保存。
- [ ] 分镜 PATCH 允许 `dialogues_json` 为空数组，用于删除全部台词。
- [ ] 后端不再依赖台词中的 `speed`、`volume` 字段。
- [ ] OpenAPI 文档同步新增旁白接口和上述请求/响应字段。
