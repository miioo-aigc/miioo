# 创作页视频历史接口 —— 前端排查结论与后端接口优化诉求

## 1. 背景

创作页的视频历史列表目前存在明显的首屏加载性能问题。用户切到视频 Tab 或刷新页面后，经常需要长时间 loading，无法达到"进入页面秒开"的体验目标。

前端已排查缓存、初始化逻辑、分页策略等因素，结论是：

- 当前问题不只是前端是否命中缓存
- 真正的瓶颈是视频列表接口返回体过重
- 只做前端分页缩小或本地缓存兜底，只能缓解，不能从根上解决

## 2. 前端排查结论

### 2.1 后端实现确认：列表统一返回完整 `CreationVideoCard`

根据后端《创作-视频生成后端实现介绍》`creation.py` 已确认：

- `list_creation_videos` 负责分页查询历史视频
- 列表遍历 `Asset`，统一调 `_asset_to_video_card()` 构造完整的 `CreationVideoCard`
- `_asset_to_video_card` 会从 `metadata_json` 中还原 `asset_bindings`、`prompt_raw`、`prompt_resolved` 等完整字段
- 列表与详情目前共用一个构造函数，没有"轻量列表"与"完整详情"的区分

### 2.2 前端已有本地缓存，但无法稳定兜住视频列表

前端对创作历史有本地缓存机制，图片历史可以正常利用缓存首屏展示。

视频历史这边的问题是：列表返回体太大，完整响应无法稳定持久化到 `localStorage`，导致刷新页面后经常还是要重新请求后端。

因此现象上会看起来像"没有缓存"，但本质上是"缓存对象过重，无法可靠落地为持久缓存"。

### 2.3 慢点不在请求发出，而在响应体解析

从线上日志看：

- `GET /api/creation/videos?page=1&page_size=18`
- 响应头返回耗时约 `1576ms`
- 但前端 `response.json()` 解析耗时约 `71874ms`
- 总耗时约 `73450ms`

这说明网络带宽只是部分因素，真正的大头是响应体过大，导致浏览器解析 JSON 极慢。

### 2.4 根因字段已定位到 `asset_bindings`

进一步对视频列表返回数据做体积统计后，发现：

- 当前 9 条视频列表合计大小约 `57MB`
- 平均每条约 `6.4MB`
- 最重的单条记录约 `28MB`
- 最重字段是 `asset_bindings`

实际样例里，单条视频只包含 2 个 asset binding，但该字段体积就达到约 `14MB`。

也就是说，当前问题不是单纯"条数太多"，而是"列表项本身被塞进了详情级的大字段"。

### 2.5 关键功能约束：重新编辑不能绕开 `asset_bindings` 和首尾帧信息

前端视频卡片有一个"重新编辑"按钮，点击后需要把之前生成视频时的参数回填到创作输入框，包括：

| 回填项 | 当前数据来源 | 来源字段 |
|---|---|---|
| 提示词 | `item.prompt` | 轻量字段 ✅ |
| 参考图列表 | `asset_bindings` 中 `asset_type === 'image'` 的条目 | **重字段** ❌ |
| 参考视频列表 | `asset_bindings` 中 `asset_type === 'video'` 的条目 | **重字段** ❌ |
| 参考音频 | `asset_bindings` 中 `asset_type === 'audio'` 的条目 | **重字段** ❌ |
| 参考模式 | `item.reference_mode` | 轻量字段 ✅ |
| 首帧 URL | `item.first_frame_url` | 轻量字段 ✅ |
| 尾帧 URL | `item.last_frame_url` | 轻量字段 ✅ |
| 分辨率 | `item.resolution` | 轻量字段 ✅ |
| 时长 | `item.duration` | 轻量字段 ✅ |

这意味着：
- 如果列表接口完全去掉 `asset_bindings` 且不提供替代信息，"重新编辑"按钮将无法获取参考图/视频/音频
- 但完整返 `asset_bindings` 又会让列表接口持续受到超大体积拖累

因此最优解不是"列表完全不返回素材信息"，而是：

1. 列表接口返回**摘要级素材信息**（素材 ID、类型、预览缩略图 URL、名称），不需要完整 `asset_bindings` 明细
2. 用户点击"重新编辑"时，如果需要完整素材引用（如图生视频的高清参考图），再通过新增的详情接口按需加载

## 3. 当前接口契约与后端实现对照

根据 `src/api/api文档.json` 和后端《创作-视频生成后端实现介绍》：

### 3.1 视频列表接口

接口：`GET /api/creation/videos`

返回：`CreationVideoListResponse`

实现：`list_creation_videos` → 遍历 `Asset` → `_asset_to_video_card()` → 完整 `CreationVideoCard`

### 3.2 视频卡片结构过重

`CreationVideoCard` 当前不仅包含列表展示需要的基础字段，还通过 `_asset_to_video_card` 从 `metadata_json` 中还原了：

- `asset_bindings`
- `prompt_raw`
- `prompt_resolved`
- 以及一批偏详情态的数据

这会导致"列表接口"实际返回了"详情级对象"。

### 3.3 没有现成的视频详情 GET 接口

当前文档里：

- `/api/creation/videos/{video_id}` 只有 `DELETE`
- 没有 `GET /api/creation/videos/{video_id}`

因此前端无法走"轻列表 + 单条详情懒加载"的标准方案，只能被迫依赖重列表接口。

### 3.4 任务完成接口也复用了重模型

`CreationVideoTaskStatusResponse.result` 当前也是 `CreationVideoCard`。

这说明视频任务完成态返回与列表页返回都共用了同一套重对象，轻重职责没有分层。

## 4. 对业务体验的实际影响

当前接口形态会直接导致以下问题：

1. 视频历史页首屏 loading 时间过长
2. 页面刷新后仍然频繁重新拉取视频列表
3. 本地持久缓存难以稳定生效
4. 在弱网或低性能设备上，体验会进一步恶化
5. 前端即使把首屏 `page_size` 从 18 降到 6，也只能缓解，无法根治

## 5. 后端接口诉求

建议后端对视频历史接口做"列表轻量化 + 详情延迟加载"改造。

### 5.1 诉求 1：新增视频详情 GET 接口 ✅ 最高优先级

建议新增：

`GET /api/creation/videos/{video_id}`

用途：

- 列表页只拿轻量卡片数据
- 用户点击某条视频进入详情、查看完整引用素材（`asset_bindings`）、做复用时，再单独拉该条完整详情
- 前端"重新编辑"功能在需要完整素材引用时可走此接口按需加载

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

### 5.2 诉求 2：瘦身视频列表接口 ✅ 最高优先级

接口：

`GET /api/creation/videos`

列表接口建议只返回首屏展示所需字段。**考虑到前端"重新编辑"功能的素材回填需求，列表需要保留摘要级素材信息，而不是直接完整返回 `asset_bindings`。**

#### 进度一：轻量列表保留字段

| 字段 | 用途 | 备注 |
|---|---|---|
| `id` | 卡片标识 + 详情入口 | 必须 |
| `asset_id` | 资产关联 | 必须 |
| `name` | 卡片标题 | 可选 |
| `video_url` | 视频播放 | 必须 |
| `poster_url` | 封面展示 | 必须 |
| `thumbnail_url` | 缩略图备用 | 建议保留 |
| `prompt` | 卡片展示 + 重新编辑回填 | 必须 |
| `model` | 卡片展示 | 必须 |
| `ratio` | 卡片展示 | 必须 |
| `duration` | 卡片展示 + 重新编辑回填 | 必须 |
| `resolution` | 卡片展示 + 重新编辑回填 | 必须 |
| `reference_mode` | 重新编辑回填（frame / all / multi） | 必须 |
| `first_frame_url` | 首尾帧模式下重新编辑回填 | 必须 |
| `last_frame_url` | 首尾帧模式下重新编辑回填 | 必须 |
| `is_liked` | 收藏状态 | 必须 |
| `created_at` | 时间展示 | 必须 |
| `preview_ready` | 预览就绪标记 | 建议保留 |

#### 进度二：素材引用摘要（替代完整 `asset_bindings`）

列表不再返回完整 `asset_bindings`，改为返回摘要级素材引用信息。下面给出两种方案，建议任选其一或组合使用：

**方案 A — 最小摘要（仅计数 + 标记）**

```json
{
  "asset_summary": {
    "reference_image_count": 2,
    "reference_video_count": 1,
    "reference_audio_count": 0,
    "has_reference_image": true,
    "has_reference_video": true,
    "has_reference_audio": false
  }
}
```

此方案体积最小，列表完全无法做参考图预览，但足够判断"是否有素材引用"。重新编辑时如果需要完整素材引用，通过详情接口按需加载。

**方案 B — 带预览的轻量素材列表（推荐，覆盖重新编辑场景）**

```json
{
  "reference_assets": [
    {
      "asset_id": "xxx",
      "asset_type": "image",
      "asset_name": "角色参考图.png",
      "preview_url": "/uploads/xxx_thumb.jpg"
    },
    {
      "asset_id": "yyy",
      "asset_type": "video",
      "asset_name": "动作参考.mp4",
      "preview_url": "/uploads/yyy_thumb.jpg"
    }
  ]
}
```

此方案在前端列表页可做：
- 参考图缩略图预览（卡片上的小圆点/缩略图）
- 重新编辑时按素材类型分组回填（图片→参考图列表、视频→参考视频、音频→参考音频）
- 点击某条卡片时按需请求详情接口获取完整 `asset_bindings`

不返回的字段（留给详情接口）：
- `binding_type`（首帧/尾帧/参考图等绑定语义）
- 高清图 URL / 原始分辨率信息
- 素材元数据

#### 进度三：从列表中完全移除的字段

- `prompt_raw`
- `prompt_resolved`
- 其他完整生成上下文 / 大对象字段

### 5.3 诉求 3：任务结果接口建议同步做轻重分层（可排在第二步）

当前 `CreationVideoTaskStatusResponse.result` 也复用了 `CreationVideoCard`，建议同步调整。

可选方案：

#### 方案 A

任务接口返回轻量结果，前端拿到 `video_id` 后，如需详情，再调用：

`GET /api/creation/videos/{video_id}`

#### 方案 B

如果任务完成后必须返回完整信息，也建议与列表页分开建模，避免前端在历史列表刷新场景继续拿到重对象。

## 6. 推荐方案

如果只做一次最关键改造，推荐优先落地这两个动作：

1. 新增 `GET /api/creation/videos/{video_id}`
2. 将 `GET /api/creation/videos` 改为轻量列表返回，使用方案 B 的摘要素材列表替代完整 `asset_bindings`

这是最符合前端历史页体验目标的方案，也是后续可维护性最好的接口分层方式。

## 7. 前端配合方式

后端完成上述改造后，前端会按下面的方式接入：

1. 历史列表只缓存和展示轻量字段 + 摘要素材信息
2. 首屏先快速渲染
3. 若首屏未铺满，再按需自动分页补齐
4. 视频卡片上显示参考素材缩略图（来自摘要素材列表）
5. 用户点击卡片触发详情查看时，请求详情接口获取完整 `asset_bindings`
6. "重新编辑"按钮利用列表已有的摘要素材信息直接回填（提示词、参考模式、首尾帧 URL、分辨率、时长），需要完整素材引用时按需请求详情接口
7. 本地持久缓存只保存轻量列表 + 摘要素材信息，避免再次触发缓存容量问题

## 8. 一句话总结

当前 `GET /api/creation/videos` 通过 `_asset_to_video_card()` 把详情级重字段 `asset_bindings` 混进了列表返回，导致视频历史首屏慢、刷新后缓存不稳、弱网体验差。希望后端补充单条视频详情 GET 接口，并将视频列表接口瘦身为轻量卡片返回，素材引用信息改为摘要级（带预览 URL）替代完整 `asset_bindings` 明细。
