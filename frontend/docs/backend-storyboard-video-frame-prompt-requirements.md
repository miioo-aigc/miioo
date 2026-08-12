# 分镜视频提示词双模式独立存储需求

## 背景

分镜页「创作面板 → 视频创作」支持两种参考模式：

- **全能参考**：提示词支持 `@主体` 标签绑定参考主体，绑定关系保存在 `video_prompt`（含标签文本）与 `video_prompt_mentions`。
- **首尾帧**：提示词为纯文本，界面隐藏标签绑定。

当前分镜只提供一个 `video_prompt` 字段。前端在首尾帧模式编辑提示词时，会把纯文本写入同一个字段，导致全能参考模式的 `@主体` 标签被覆盖丢失；切回全能参考模式时标签绑定失效。

## 需求目标

两个模式的提示词**各自独立存储、独立恢复、互不覆盖**：

- `video_prompt`：固定保存全能参考模式提示词（含 `@主体` 标签）。
- `video_frame_prompt`（新增）：保存首尾帧模式纯文本提示词。

## 接口改动

```text
PATCH /api/projects/{project_id}/storyboards/{storyboard_id}
```

### 字段定义

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `video_prompt` | `string \| null` | 否 | 全能参考模式提示词，可含 `@主体` 标签，语义保持不变 |
| `video_frame_prompt` | `string \| null` | 否 | 首尾帧模式纯文本提示词，新增字段 |

### Schema 改动

- `StoryboardUpdate`：增加 `video_frame_prompt: string | null`（允许传入）。
- `StoryboardResponse`：增加 `video_frame_prompt: string | null`（列表与详情都要返回）。
- `StoryboardCreate`：建议同步增加 `video_frame_prompt: string | null`，兼容复制分镜、批量创建链路。

## 行为约定

- 保存时 `video_frame_prompt` 与 `video_prompt` **独立存储**，互不覆盖、互不推导。
- 前端提交空字符串或省略该字段时，置为 `null`，不要回退保留旧值（用户可能主动清空提示词）。
- 更新 `video_frame_prompt` 时**不得修改** `video_prompt`、`video_prompt_mentions` 的现有行为。
- 列表 / 详情响应必须原样返回 `video_frame_prompt`，刷新页面后不依赖前端缓存即可恢复。

## 接口示例

请求：

```json
{
  "video_prompt": "一个@主角 在街道上行走，夕阳西下",
  "video_frame_prompt": "一个男人在街道上行走，夕阳西下",
  "video_prompt_mentions": [
    { "subject_id": "subject-id", "subject_type": "character", "display_text": "@主角" }
  ]
}
```

响应（节选）：

```json
{
  "id": "storyboard-id",
  "video_prompt": "一个@主角 在街道上行走，夕阳西下",
  "video_frame_prompt": "一个男人在街道上行走，夕阳西下",
  "video_prompt_mentions": [
    { "subject_id": "subject-id", "subject_type": "character", "display_text": "@主角" }
  ]
}
```

## 验收标准

1. 前端在首尾帧模式修改提示词并保存后，后端返回的 `video_frame_prompt` 为新值，`video_prompt` 保持带标签文本不变。
2. 前端在全能参考模式修改提示词后，`video_frame_prompt` 不被连带修改。
3. 刷新页面后，前端全能参考模式显示带 `@主体` 标签的提示词，首尾帧模式显示纯文本提示词，两者互不串扰。

## 前端现状（已完成，供联调确认）

- 前端已在 `PATCH /api/projects/{project_id}/storyboards/{storyboard_id}` 请求中提交顶层 `video_frame_prompt`，并在分镜数据解析时优先读取该字段、兼容旧的 `gen_params.creation_form.video.frame_prompt` 内嵌形态。
- 后端尚未支持该字段时，未知字段会被忽略，不影响现有保存；后端上线该字段后前端无需再次改动即可生效。
- 后端完成后请同步更新 `openapi.json`，确保字段名与契约一致。
