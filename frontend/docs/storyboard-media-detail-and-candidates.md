# 分镜候选媒体与统一详情弹窗记录

> 记录日期：2026-07-29
> 适用范围：分镜页面候选媒体、创作弹窗、详情查看、定稿和混合上传

## 1. 背景与修复前问题

分镜模型原有的 `image_url` 和 `video_url` 只能表达图片、视频各一个地址，无法完整表达同一镜头下的多个创作结果、用户上传结果、资产库素材以及唯一的定稿状态。页面早期还分别使用图片详情和视频详情展示，导致详情结构、候选来源、定稿状态和下载行为不一致。

本轮工作的核心目标是让以下三个位置完全共享当前镜头的候选数据：

- 分镜列表的“分镜”内容列；
- 创作分镜弹窗右侧候选列表；
- 媒体详情弹窗左侧下方候选列表。

## 2. 修复后能力

### 2.1 统一详情弹窗

新增 `src/components/storyboard/StoryboardMediaDetailModal.jsx`，统一处理图片和视频：

- 左侧上方查看当前图片或视频；
- 左侧下方展示当前镜头的图片/视频混合候选；
- 点击候选缩略图直接切换详情；
- 右侧展示是否定稿、分镜编号、内容类型、来源、提示词和生成时间；
- 支持真实切换定稿状态；
- 支持受控下载接口，失败时回退到媒体下载地址；
- 使用 Portal 渲染，避免被内容区的滚动和裁剪规则截断。

弹窗由 `StoryboardPage` 统一打开。页面传入当前 `shot`、`media`、`candidates`、`onFinalizeChange`、`onDownload` 和 `onClose`，组件本身不直接调用业务 API。

### 2.2 候选列表一致性

页面级 `candidateMediaMap` 以 `storyboardId` 为键保存候选数组。分镜列、创作弹窗和详情弹窗都读取同一个数组，避免“创作弹窗有两个，分镜列只有一个”的数据分叉。

候选写入和刷新遵循以下规则：

- 初始化从后端读取完整候选列表；
- 生成、上传、资产库选择成功后，创建候选并合并后端返回值；
- 合并按媒体 ID 或媒体地址去重；
- 已有候选保持原顺序，新候选追加到末尾；
- 定稿状态变化只更新对应对象，不对数组排序；
- 切换分镜详情、创作弹窗或分集时，仍使用当前镜头对应的数组。

## 3. 后端接口与前端适配

前端接口封装全部位于 `src/api/storyboard.js`：

```text
GET    /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates
POST   /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates
PATCH  /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates/{media_id}
DELETE /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates/{media_id}
GET    /api/projects/{project_id}/storyboards/{storyboard_id}/media-candidates/{media_id}/download
```

前端通过 `normalizeStoryboardMediaCandidate` 同时兼容以下字段形式：

- `media_type` / `mediaType`；
- `thumbnail_url` / `thumbnailUrl`；
- `poster_url` / `posterUrl`；
- `download_url` / `downloadUrl`；
- `is_finalized` / `isFinalized`；
- `created_at` / `createdAt`；
- `storyboard_id` / `storyboardId`。

同一镜头只允许一个媒体定稿。前端提交 `is_finalized` 状态，唯一性和图片/视频互斥由后端作为最终约束；页面刷新时重新读取后端结果，不以 React 状态作为唯一数据源。

## 4. 图片/视频混合上传

创作弹窗右侧候选区的本地上传入口现在使用：

```html
accept="image/*,video/*"
```

前端依据文件 MIME 类型调用对应的图片或视频上传接口，然后创建候选媒体记录。资产库选择器新增 `media` 类型，可同时筛选分镜图片和分镜视频。无论来源是 AI、本地上传还是资产库选择，默认都只进入候选列表，不自动定稿。

## 5. 定稿、查看和下载数据流

1. 用户点击分镜列或创作弹窗中的候选卡片。
2. 页面调用候选媒体 `PATCH` 接口设置或取消定稿。
3. 后端返回最新候选对象后，页面更新 `candidateMediaMap` 和兼容的分镜封面字段。
4. 分镜列和创作弹窗立即显示同一个 Checkbox 定稿状态，时间轴同步显示当前定稿媒体。
5. 用户点击放大后进入统一详情弹窗，详情弹窗从同一候选数组中选择当前媒体。
6. 用户点击下载时优先使用候选媒体受控下载接口，失败后回退到 `downloadUrl`、`url` 或兼容字段。

## 6. 验收记录与风险

已完成：

- 目标分镜组件定向 ESLint；
- `npm run build`；
- `git diff --check`；
- 统一详情弹窗的页面接线和候选数据来源静态核对；
- 图片/视频混合本地上传和资产库选择入口静态核对。

当前已知事项：

- `npm run check:architecture` 仍会报告项目已有的 `src/components/assets/seedanceUploadValidation.js` 文件名规则问题和历史规模告警，本轮没有新增阻断。
- 生产环境仍需使用真实后端数据验证媒体上传、资产库选择、定稿互斥、受控下载和失效媒体地址处理。
- `image_url` / `video_url` 仍保留作为旧批量下载和兼容展示字段；候选列表和详情弹窗的唯一可信状态应以候选媒体接口返回为准。
