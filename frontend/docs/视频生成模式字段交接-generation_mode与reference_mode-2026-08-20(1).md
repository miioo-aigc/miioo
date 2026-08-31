# 视频创作接口字段交接文档：supported_generation_modes / reference_modes / generation_mode / reference_mode

> 交接日期：2026-08-20
> 交接范围：后端返回的视频模型 capabilities 两字段（`supported_generation_modes`、`reference_modes`）与前端请求 `api/creation/videos/generate` 的两参数（`generation_mode`、`reference_mode`）之间的契约关系
> 事实来源：`backend/app/services/model_capabilities.py`、`backend/app/routers/creation.py`、`frontend_new/src/api/creation.js`、`frontend_new/src/utils/modelAdapter.js`、`frontend_new/src/pages/CreationPage.jsx`

---

## 1. 一句话结论

- 后端 `capabilities` 里 **`supported_generation_modes` = 这个模型能做什么任务**（任务类型），**`reference_modes` = 参考素材以什么角色参与生成**（参考绑定方式），两个字段正交。
- 前端请求 `api/creation/videos/generate` 时：**`reference_mode` 几乎总是显式传值**（由 UI 档位翻译而来）；**`generation_mode` 只在「专属能力模型」和「全能参考 + 有素材」两种场景显式传值**，其余交给后端按素材自动推断。
- **命名坑**：请求 JSON 字段名是 `generation_mode`，不是 `generate_mode`。`generate_mode` 是后端内部透传给上游（Seedance API）时的概念。

---

## 2. 后端返回字段说明

### 2.1 supported_generation_modes（生成模式 / 任务类型）

| 项目 | 说明 |
|---|---|
| 定义位置 | `backend/app/services/model_capabilities.py` → `_build_video_capability()`（默认 `["full"]`）、`_build_image_capability()`（默认 `["reference_image"]`） |
| 语义 | 该模型能执行的**生成任务类型清单**——"用这个模型能做什么" |
| 视频枚举值 | `text_to_video`（文生）/ `first_frame`（首帧图生）/ `start_end`（首尾帧）/ `full`（多模态全能）/ `video_ref`（视频参考）/ `reference_subjects`（多图参考）/ `video_edit`（视频编辑）/ `multiframe`（智能多帧）/ `multi_shot`（多镜头） |
| 图片枚举值 | `text_to_image` / `reference_image` / `outpainting`（扩图）/ `subject_completion`（主体补全） |
| 后端消费 | ① 校验请求 `generation_mode ∈ supported_generation_modes`，否则 400「模型 {model} 不支持 {mode} 模式」；② 未显式传时按素材推断（顺序：`video_edit` → `multiframe`(vidu) → `reference_subjects` → `full` → `start_end` → `first_frame` → `text_to_video`） |
| 前端消费 | `modelAdapter.js`：过滤 Vidu Q3 可用能力（`getViduQ3VideoAbilities`）；推导 UI「全能参考/首尾帧」两档；推导 `supportsMultishot` / `supportsReferenceSubjects` 等开关 |

### 2.2 reference_modes（参考模式 / 参考绑定方式）

| 项目 | 说明 |
|---|---|
| 定义位置 | `_build_video_capability()`（默认 `["full"]`）；**图片模型无此字段** |
| 语义 | 该模型支持的**参考素材组织/绑定方式**——参考图、参考视频以什么角色参与 |
| 枚举值 | `full`（全能参考，多模态可选）/ `video_ref`（视频参考、首尾帧）/ `first_frame`（首帧）/ `last_frame`（尾帧） |
| 后端消费 | ① 校验请求 `reference_mode ∈ reference_modes`，否则 400「模型 {model} 不支持 {mode} 参考模式」；② `_normalize_video_reference_mode_for_generation()` 对 Vidu 帧模型归一化：`text_to_video → None`、`first_frame → first_frame`、`start_end → video_ref`、`full` 且无参考素材 → `None` |
| 前端消费 | `modelAdapter.js`：把后端枚举折叠为 UI 两档「全能参考 all / 首尾帧 frame」；计算提交时实际后端值 `actualAllRefMode` / `actualFrameRefMode` |

### 2.3 区别对照

| 维度 | supported_generation_modes | reference_modes |
|---|---|---|
| 回答的问题 | 做什么任务 | 参考素材怎么组织 |
| 性质 | 任务类型（决定生成管线） | 参考输入绑定方式 |
| 是否含文生 | 含 `text_to_video` | 不含（纯文生无参考） |
| 典型值 | `full` / `text_to_video` / `first_frame` / `start_end` / `video_ref` / `reference_subjects` / `video_edit` | `full` / `video_ref` / `first_frame` / `last_frame` |

**耦合点**：两个字段不是完全独立——后端推断 `generation_mode` 时会参考 `reference_mode` 与参考素材；前端有参考素材且 UI 为「全能参考」时会把 `generation_mode` 显式落为 `full`，避免被"文生视频不支持参考素材"逻辑误拦截。

---

## 3. 前端请求参数

请求体在 `frontend_new/src/api/creation.js:1212-1244` 组装，关键两行：

```js
reference_mode: params.refMode || undefined,   // 第 1219 行
generation_mode: effectiveGenerationMode,      // 第 1220 行
```

### 3.1 reference_mode

| 项目 | 说明 |
|---|---|
| 来源 | `CreationPage.jsx:2567` 的 `refMode` state（默认 `''`）；UI 选项来自 `modelAdapter` 推导的 `refModes`（后端 `reference_modes` 折叠为「全能参考 all / 首尾帧 frame」）或专属能力 `abilities` |
| 提交翻译 | `CreationPage.jsx:3304-3329`：专属能力模式 → `selectedAbility.referenceMode`（能力表写死的后端枚举）；UI「all」→ `actualAllRefMode \|\| 'full'`；UI「frame」→ `actualFrameRefMode \|\| 'first_frame'` |
| 期望值 | 该模型 `reference_modes` 枚举内：`full` / `first_frame` / `video_ref` / `last_frame`（Vidu 首尾帧实际落 `video_ref`） |
| 缺省行为 | 不传时后端 Pydantic 默认 `"full"`（`creation.py:2012`） |

### 3.2 generation_mode（注意：不是 generate_mode）

| 项目 | 说明 |
|---|---|
| 来源 | `resolveVideoGenerationMode()`（`creation.js:26-42`），优先级：① 显式 `params.generation_mode`；② 无参考素材 → `undefined`；③ 有素材 + refMode 归一化为 `full` 且模型支持 `full` → `"full"`；④ 其余 → `undefined`（后端推断） |
| 显式传值的场景 | ① 专属能力模型（HappyHorse / Vidu Q3）：`selectedAbility.generationMode`，如 `text_to_video` / `first_frame` / `start_end` / `reference_subjects` / `video_edit`；② 全能参考 + 有素材：`full` |
| 期望值 | 该模型 `supported_generation_modes` 枚举内：`text_to_video` / `first_frame` / `start_end` / `full` / `video_ref` / `reference_subjects` / `video_edit` / `multiframe` / `multi_shot` |
| 设计意图 | 前端大多数场景（all/frame 两档）**刻意不传**，由后端按 `reference_mode` + 素材推断，避免双端口径不一致 |

### 3.3 命名澄清（容易踩的坑）

| 名称 | 位置 | 含义 |
|---|---|---|
| `generation_mode` | 前端请求 JSON 字段（`creation.js:1220`）；后端 `CreationVideoGenerateRequest`（`creation.py:2011`） | 项目统一的"任务类型"契约字段，**前端应传这个** |
| `generate_mode` | 后端 `video_gen.py:3424-3447`（`effective_generation_mode = generation_mode or generate_mode`） | 后端内部透传上游 Seedance API 的参数，非前端请求契约 |
| `generationMode` / `referenceMode`（驼峰） | 部分后端模型同时兼容驼峰别名（`creation.py:2110-2112`） | 兼容历史调用方，新代码统一用蛇形 |

---

## 4. 双端校验规则（400 拦截点）

| 规则 | 位置 | 触发 |
|---|---|---|
| `generation_mode` 不在 `supported_generation_modes` | `model_capabilities.py:1543-1545`（图片）、`1753-1784`（视频） | 400「模型 {model} 不支持 {mode} 模式」 |
| `reference_mode` 不在 `reference_modes` | `model_capabilities.py:1793-1795` | 400「模型 {model} 不支持 {mode} 参考模式」 |
| 参考素材超上限 | `max_reference_images` / `max_reference_videos` / `max_reference_audios` / `max_total_attachments` | 400 各类数量上限提示 |
| 不支持参考视频/音频但传了 | `model_capabilities.py:1809-1816` | 400「模型 {model} 不支持参考视频/音频」 |
| 需要首帧但未传 | `requires_first_frame`（`1797-1802`） | 400「模型 {model} 需要首帧参考图」 |

---

## 5. 典型模型能力对（generation × reference）

| 模型 | supported_generation_modes | reference_modes |
|---|---|---|
| Seedance 2.0 / 2.0 Fast | `[full, text_to_video, first_frame, start_end, video_ref]` | `[full, video_ref, first_frame, last_frame]` |
| Seedance 1.5 Pro | `[text_to_video, first_frame, start_end]` | `[full, video_ref, first_frame, last_frame]` |
| Seedance 2.5 | `[full, text_to_video, first_frame, start_end, video_ref]` | `[full, video_ref, first_frame, last_frame]` |
| Kling V3 文生 / 首帧 | `[text_to_video]` / `[first_frame]` | `[]` / `[first_frame]` |
| HappyHorse t2v / i2v / r2v / video-edit | `[text_to_video]` / `[first_frame]` / `[reference_subjects]` / `[video_edit]` | `[full]` / `[first_frame]` / `[full]` / `[video_ref]` |
| Vidu Q3 Pro / Turbo | `[text_to_video, first_frame, start_end]`（pro-fast 无文生） | 首尾帧实际落 `video_ref` |
| Vidu Q2 系 | `[first_frame, start_end]`（帧系） | `[first_frame, last_frame]` |

---

## 6. 关键代码索引

| 关注点 | 文件:行 |
|---|---|
| capabilities 构造（视频） | `backend/app/services/model_capabilities.py:92-131` |
| capabilities 构造（图片） | `backend/app/services/model_capabilities.py:35-89` |
| 常量（Seedance 系列） | `model_capabilities.py:564-576` |
| generation_mode 校验 + 推断（视频） | `model_capabilities.py:1753-1784` |
| reference_mode 归一化（Vidu 帧模型） | `model_capabilities.py:1302-1323` |
| reference_mode 校验 | `model_capabilities.py:1793-1795` |
| 参考模式推断（无显式时） | `model_capabilities.py:1345-1374`（`infer_video_reference_mode`） |
| 请求体模型 | `backend/app/routers/creation.py:2007-2012`（`generation_mode` 可选、`reference_mode` 默认 `full`） |
| 前端请求体组装 | `frontend_new/src/api/creation.js:1212-1244` |
| generation_mode 推导 | `creation.js:26-42`（`resolveVideoGenerationMode`） |
| 后端枚举 → 前端能力映射 | `frontend_new/src/utils/modelAdapter.js`（`adaptModels` 612-624、`getVideoModelParamsFromCap` 963-1077） |
| UI 档位 → 后端枚举翻译 | `frontend_new/src/pages/CreationPage.jsx:3304-3329` |
| 参考模式中文文案 | `frontend_new/src/utils/referenceMode.js` |

---

## 7. 踩坑清单

1. **字段名别写错**：请求体是 `generation_mode`（蛇形），`generate_mode` 只在后端内部/上游使用；驼峰 `generationMode` 仅兼容历史。
2. **`reference_mode` 有默认值 `full`**：后端 `CreationVideoGenerateRequest.reference_mode = "full"`，前端不传时按全能参考处理。
3. **文生视频别带参考素材**：`text_to_video` 下传参考素材会被"文生视频不支持参考素材"逻辑拦截；需要多模态时用 `full`。
4. **首尾帧 ≠ `start_end` 就完事**：Vidu 系 `start_end` 的 `reference_mode` 会被归一化为 `video_ref`；前端 `actualFrameRefMode` 优先取 `video_ref`。
5. **前端依赖后端枚举兜底**：`reference_modes` 为空数组时 `modelAdapter` 会推导 `hasFull = true`（`refModes.length === 0`），纯文生模型不会出现"无任何模式可用"。
6. **改能力枚举要双端同步**：新增/删除 `supported_generation_modes` 枚举值后，需同步检查 `modelAdapter.js` 的能力过滤与 `referenceMode.js` 文案映射。

---

## 8. 验证方法

1. `GET /api/models`，检查目标模型 capabilities 中两个字段的枚举值。
2. 前端创建页切换模型，观察「全能参考/首尾帧」档位与可用素材类型是否与枚举一致。
3. 提交生成请求，在浏览器 Network 面板核对请求体 `generation_mode` / `reference_mode` 的实际取值。
4. 用非法值（如不支持的 `generation_mode`）请求，确认返回 400 及提示文案。

---

## 9. 变更记录

| 日期 | 变更人 | 说明 |
|---|---|---|
| 2026-08-20 | 星野 | 初始版本，依据代码事实梳理字段契约与双端链路 |
