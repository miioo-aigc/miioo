# 分镜候选媒体与定稿接口交接

## 背景

分镜页面需要在一个镜头下同时展示 AI 创作和用户上传的图片、视频，并允许用户选择一个媒体作为该镜头的定稿结果。现有分镜模型的 `image_url` 和 `video_url` 只能表达两个最终地址，无法表达候选历史和图片/视频互斥定稿关系。

## 接口

建议新增以下接口：

```text
GET    /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates
POST   /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates
PATCH  /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates/{media_id}
DELETE /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates/{media_id}
```

## 媒体结构

列表和写入成功响应统一返回：

```json
{
  "id": "media-id",
  "storyboard_id": "storyboard-id",
  "media_type": "image",
  "url": "/uploads/storyboards/image.png",
  "thumbnail_url": "/uploads/storyboards/image-thumb.png",
  "poster_url": null,
  "download_url": "/api/projects/project-id/storyboards/storyboard-id/media-candidates/media-id/download",
  "is_finalized": false,
  "source": "ai-generated",
  "created_at": "2026-07-23T12:00:00Z",
  "metadata": {}
}
```

`media_type` 只允许 `image` 或 `video`；视频应提供可用的 `poster_url` 或 `thumbnail_url`。`source` 建议支持 `ai-generated`、`local-upload`、`asset-library` 和 `storyboard-existing`。

## 行为约定

- `POST` 创建候选，默认 `is_finalized=false`，重复的同一媒体地址应幂等返回已有记录。
- `PATCH` 接收 `{ "is_finalized": true }` 或 `{ "is_finalized": false }`。
- 同一个 `storyboard_id` 最多一个 `is_finalized=true` 的候选。设置新定稿时，后端必须在同一事务中取消旧定稿。
- 定稿成功后同步更新分镜兼容字段：图片写入 `image_url`，视频写入 `video_url`；另一种媒体字段是否清空需以后端产品规则为准，但响应中的候选定稿必须是唯一可信来源。
- 删除定稿媒体应返回 `409`；应先取消定稿再删除。删除普通候选成功返回 `204`。
- 不存在的项目、分镜或媒体返回 `404`；请求字段不合法返回 `422`；无权限返回 `403`。
- 空列表返回 `[]` 或 `{ "items": [] }`，不能返回纯文本异常页。
- 列表结果必须包含最新定稿状态，刷新页面后不依赖前端缓存恢复。
- 上传媒体的候选记录应保存原图/原视频 URL、缩略图或视频首帧地址和下载地址。

## 前端联调要求

前端会在页面加载时按当前分镜逐个读取列表；生成和上传成功后创建候选；点击候选卡片时只调用 PATCH 切换定稿状态。后端完成后请同步更新 `openapi.json`，并确保上述路径与字段名称一致。
