# 创作页视频历史接口优化诉求

## 背景

创作页的视频历史列表目前存在明显的首屏加载性能问题。用户切到视频 Tab 或刷新页面后，经常需要长时间 loading，无法达到“进入页面秒开”的体验目标。

前端已排查缓存、初始化逻辑、分页策略等因素，结论是：

- 当前问题不只是前端是否命中缓存
- 真正的瓶颈是视频列表接口返回体过重
- 只做前端分页缩小或本地缓存兜底，只能缓解，不能从根上解决

## 当前排查结论

### 1. 前端已有本地缓存，但无法稳定兜住视频列表

前端对创作历史有本地缓存机制，图片历史可以正常利用缓存首屏展示。

视频历史这边的问题是：列表返回体太大，完整响应无法稳定持久化到 `localStorage`，导致刷新页面后经常还是要重新请求后端。

因此现象上会看起来像“没有缓存”，但本质上是“缓存对象过重，无法可靠落地为持久缓存”。

### 2. 慢点不在请求发出，而在响应体解析

从线上日志看：

- `GET /api/creation/videos?page=1&page_size=18`
- 响应头返回耗时约 `1576ms`
- 但前端 `response.json()` 解析耗时约 `71874ms`
- 总耗时约 `73450ms`

这说明网络带宽只是部分因素，真正的大头是响应体过大，导致浏览器解析 JSON 极慢。

### 3. 根因字段已定位到 `asset_bindings`

进一步对视频列表返回数据做体积统计后，发现：

- 当前 9 条视频列表合计大小约 `57MB`
- 平均每条约 `6.4MB`
- 最重的单条记录约 `28MB`
- 最重字段是 `asset_bindings`

实际样例里，单条视频只包含 2 个 asset binding，但该字段体积就达到约 `14MB`。

也就是说，当前问题不是单纯“条数太多”，而是“列表项本身被塞进了详情级的大字段”。

## 当前接口契约现状

根据 `src/api/api文档.json`：

### 1. 视频列表接口

接口：`GET /api/creation/videos`

返回：`CreationVideoListResponse`

其中：

- `CreationVideoListResponse.list[]` 的类型是 `CreationVideoCard`

### 2. 视频卡片结构过重

`CreationVideoCard` 当前不仅包含列表展示需要的基础字段，还包含：

- `asset_bindings`
- `prompt_raw`
- `prompt_resolved`
- 以及一批偏详情态的数据

这会导致“列表接口”实际返回了“详情级对象”。

### 3. 没有现成的视频详情 GET 接口

当前文档里：

- `/api/creation/videos/{video_id}` 只有 `DELETE`
- 没有 `GET /api/creation/videos/{video_id}`

因此前端无法走“轻列表 + 单条详情懒加载”的标准方案，只能被迫依赖重列表接口。

### 4. 任务完成接口也复用了重模型

`CreationVideoTaskStatusResponse.result` 当前也是 `CreationVideoCard`。

这说明视频任务完成态返回与列表页返回都共用了同一套重对象，轻重职责没有分层。

## 对业务体验的实际影响

当前接口形态会直接导致以下问题：

1. 视频历史页首屏 loading 时间过长
2. 页面刷新后仍然频繁重新拉取视频列表
3. 本地持久缓存难以稳定生效
4. 在弱网或低性能设备上，体验会进一步恶化
5. 前端即使把首屏 `page_size` 从 18 降到 6，也只能缓解，无法根治

## 后端接口诉求

建议后端对视频历史接口做“列表轻量化 + 详情延迟加载”改造。

### 诉求 1：新增视频详情接口

建议新增：

`GET /api/creation/videos/{video_id}`

用途：

- 列表页只拿轻量卡片数据
- 用户点击某条视频进入详情、查看引用素材、做复用时，再单独拉该条完整详情

建议详情接口返回完整字段，包括但不限于：

- `id`
- `asset_id`
- `name`
- `video_url`
- `poster_url`
- `thumbnail_url`
- `prompt`
- `prompt_raw`
- `prompt_resolved`
- `model`
- `ratio`
- `duration`
- `resolution`
- `reference_mode`
- `reference_video_url`
- `reference_audio_url`
- `first_frame_url`
- `last_frame_url`
- `asset_bindings`
- `is_liked`
- `created_at`
- `preview_ready`

### 诉求 2：瘦身视频列表接口

接口：

`GET /api/creation/videos`

列表接口建议只返回首屏展示所需字段，不要再直接返回完整 `asset_bindings`。

建议保留字段：

- `id`
- `asset_id`
- `name`
- `video_url`
- `poster_url`
- `thumbnail_url`
- `prompt`
- `model`
- `ratio`
- `duration`
- `resolution`
- `reference_mode`
- `first_frame_url`
- `last_frame_url`
- `is_liked`
- `created_at`
- `preview_ready`

建议从列表中移除或替换为摘要字段：

- `asset_bindings`
- `prompt_raw`
- `prompt_resolved`
- 其他完整生成上下文或大对象字段

如果列表页业务上必须知道素材引用情况，建议改成摘要信息，而不是直接回完整绑定明细，例如：

- `asset_binding_count`
- `asset_binding_types`
- `has_reference_image`
- `has_reference_video`
- `has_reference_audio`

### 诉求 3：任务结果接口建议同步做轻重分层

当前 `CreationVideoTaskStatusResponse.result` 也复用了 `CreationVideoCard`，建议同步调整。

可选方案：

#### 方案 A

任务接口返回轻量结果，前端拿到 `video_id` 后，如需详情，再调用：

`GET /api/creation/videos/{video_id}`

#### 方案 B

如果任务完成后必须返回完整信息，也建议与列表页分开建模，避免前端在历史列表刷新场景继续拿到重对象。

## 推荐方案

如果只做一次最关键改造，推荐优先落地这两个动作：

1. 新增 `GET /api/creation/videos/{video_id}`
2. 将 `GET /api/creation/videos` 改为轻量列表返回，不再返回完整 `asset_bindings`

这是最符合前端历史页体验目标的方案，也是后续可维护性最好的接口分层方式。

## 前端配合方式

后端完成上述改造后，前端会按下面的方式接入：

1. 历史列表只缓存和展示轻量字段
2. 首屏先快速渲染
3. 若首屏未铺满，再按需自动分页补齐
4. 用户点开某条视频详情时，再请求单条详情接口
5. 本地持久缓存只保存轻量列表，避免再次触发缓存容量问题

## 一句话总结

当前 `GET /api/creation/videos` 把详情级重字段 `asset_bindings` 混进了列表返回，导致视频历史首屏慢、刷新后缓存不稳、弱网体验差。希望后端补充单条视频详情接口，并将视频列表接口瘦身为轻量卡片返回。
