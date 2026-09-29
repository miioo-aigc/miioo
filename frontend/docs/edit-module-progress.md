# 剪辑模块重构进度

> 文档类型：剪辑页面功能拆分、组件边界和验收进度
> 建立日期：2026-09-29
> 适用范围：`src/pages/EditPage.jsx`、`src/pages/CompositionEditorPage.jsx`、`src/components/edit/`、`src/components/compositionEditor/`、`src/stores/compositionEditorStore.js`

## 1. 总体状态

**当前阶段：第一阶段已完成，整体未完成。**

当前已经完成剪辑入口、草稿管理和工作台主要区域的第一轮组件化，但仍有部分稳定子职责混在较大的组件或页面数据编排中。只有下表所有模块均达到“完成”，并且结构索引、引用检查、构建、架构检查和关键流程验证全部完成后，才能将整体状态改为“已完成”。

整体完成条件：

- 所有模块的功能边界和组件归属明确；
- 页面入口只保留页面级状态、生命周期、数据编排和区块组合；
- 素材库、时间线、属性面板等稳定子职责完成必要拆分；
- props、回调、Store、API、数据适配和副作用逐项核对；
- 适用的大型页面和组件均有同步的结构索引；
- `npm run lint`、`npm run build`、`npm run check:architecture`、`git diff --check` 和关键用户流程验证完成；
- 本文档、`PROJECT.md`、组件清单和相关迁移记录均与代码现状一致。

状态含义：

- **已完成**：代码、边界、文档和验证均完成，可以作为整体完成条件的一部分；
- **进行中**：已有实现，但仍有明确的拆分、边界或验证事项；
- **待开始**：已确定范围，尚未进行本轮处理；
- **阻塞**：存在外部依赖或既有问题，必须记录原因和不影响本模块的范围。

## 2. 模块进度表

| 模块 | 当前状态 | 已有组件/位置 | 未完成事项 | 完成判定 |
|---|---|---|---|---|
| 剪辑入口与页面切换 | 已完成 | `EditPage.jsx` | 保持入口只负责草稿列表与编辑器切换 | 页面入口无具体业务 UI 和额外副作用 |
| 草稿列表与空态 | 已完成 | `EditWorkspace.jsx`、`EditDraftList.jsx`、`EditDraftCard.jsx` | 补充本模块关键流程回归记录 | 加载、错误、空态、有草稿态和打开工程均验证 |
| 草稿管理动作 | 已完成 | `EditDraftManager.jsx`、`EditMethodActions.jsx` | 保持 API、确认弹窗和 Toast 边界清晰 | 重命名、复制、删除、新建、导出、下载均验证 |
| 工作台页面编排 | 进行中 | `CompositionEditorPage.jsx` | 评估并拆出素材加载、工程初始化和资产归一化编排 | 页面只保留页面级状态、生命周期和区块组合 |
| 工作台头部 | 已完成 | `EditorHeader.jsx`、`WorkspaceHeader.jsx` | 补充独立路由和嵌入路由回归 | 保存、返回、分集切换、导出状态边界清晰 |
| 可调整工作区布局 | 已完成 | `ResizableWorkspace.jsx` | 补充键盘、双击恢复和窗口变化验证记录 | 素材、预览、属性、时间线四区布局行为稳定 |
| 素材库主区块 | 进行中 | `AssetLibraryPanel.jsx` | 评估素材 Tab、素材卡片、上传、资产选择、处理中状态的进一步拆分 | 素材展示与素材动作职责清晰，上传和资产选择流程验证 |
| 预览画布 | 进行中 | `PreviewCanvas.jsx` | 补充结构索引；评估播放控制、媒体展示和淡入淡出职责 | 预览、播放控制、游标联动和速度行为边界清晰 |
| 属性面板 | 进行中 | `PropsPanel.jsx` | 补充结构索引；评估工程设置、片段属性、音频和转场分组 | 各属性编辑组职责清晰，输入和 Store 更新验证 |
| 时间线工具栏 | 已完成 | `TimelineToolbar.jsx` | 补充与时间线关键动作的回归记录 | 撤销、恢复、切割、分离音轨、删除状态正确 |
| 时间线主体 | 进行中 | `TimelineBar.jsx` | 已完成视频、图片、音频拖拽预览与一次性历史提交；仍需补充插入点和关键流程验证，并评估刻度、轨道、片段、拖拽、缩放和播放游标拆分 | 时间线各交互职责清晰，拖拽、吸附、缩放和媒体展示验证 |
| 导出弹窗 | 已完成 | `ExportModal.jsx` | 补充导出成功、失败和取消流程记录 | 导出状态、进度、下载和错误反馈验证 |
| 编辑器 Store 边界 | 进行中 | `compositionEditorStore.js` | 盘点状态、动作、历史、初始化、保存、导出和数据适配职责 | Store 不承载应归属组件或 API 适配层的职责 |
| 数据适配与初始化 | 进行中 | `CompositionEditorPage.jsx`、`FinalizedStoryboardAssets`、Store | 明确资产归一化、草稿恢复、缺失资产补取的归属 | API 字段、资产 ID、恢复路径和异常状态逐项核对 |
| 目录出口与结构索引 | 待开始 | `compositionEditor/`、大型组件顶部 | 增加目录公开导出；为适用组件维护真实行号索引 | 导入导出、索引和旧引用全局搜索通过 |
| 剪辑模块整体验收 | 待开始 | 本文档及项目验收命令 | 完成全部模块后统一执行 | 所有模块完成且全套静态、构建和关键流程验证通过 |

## 3. 当前组件地图

### 3.1 页面入口和剪辑入口

- `src/pages/EditPage.jsx`：在项目导航内切换草稿列表和编辑器，保留独立 `/editor` 路由兼容。
- `src/pages/CompositionEditorPage.jsx`：读取路由/嵌入参数，执行工程和素材初始化，组合工作台区块。

### 3.2 草稿列表域

- `src/components/edit/EditWorkspace.jsx`：分集选择、草稿和分镜数据加载、空态/错误态编排、创建和批量动作。
- `src/components/edit/EditDraftManager.jsx`：重命名、复制、删除及确认弹窗编排。
- `src/components/edit/EditDraftList.jsx`：草稿卡片列表和新建入口展示。
- `src/components/edit/EditDraftCard.jsx`：单张草稿卡片、菜单和打开行为。
- `src/components/edit/EditMethodActions.jsx`：导出剪映格式、批量下载和在线剪辑入口。

### 3.3 工作台域

- `src/components/compositionEditor/EditorHeader.jsx`：独立编辑器路由头部。
- `src/components/compositionEditor/WorkspaceHeader.jsx`：项目内嵌工作台头部。
- `src/components/compositionEditor/ResizableWorkspace.jsx`：四区布局和分隔条交互。
- `src/components/compositionEditor/AssetLibraryPanel.jsx`：素材分类、素材列表、本地上传和资产库选择。
- `src/components/compositionEditor/PreviewCanvas.jsx`：预览媒体、播放控制和游标联动。
- `src/components/compositionEditor/PropsPanel.jsx`：工程设置和选中片段属性编辑。
- `src/components/compositionEditor/TimelineBar.jsx`：时间线刻度、轨道、片段、拖拽、缩放和播放游标。
- `src/components/compositionEditor/TimelineToolbar.jsx`：时间线编辑动作。
- `src/components/compositionEditor/ExportModal.jsx`：导出状态和结果反馈。

## 4. 后续修改登记规则

以后每次修改剪辑模块时，必须同步更新本文件：

1. 修改前确认目标模块当前状态和未完成事项；
2. 修改后将对应模块更新为“进行中”或“已完成”，不得只写代码不记进度；
3. 如果新增组件、移动职责或改变边界，更新“当前组件地图”和模块完成判定；
4. 如果完成一个模块，记录影响文件、验证命令和仍存在的限制；
5. 如果验证被仓库既有问题阻塞，明确写出具体文件和错误，不能写成“已通过”；
6. 只有全部模块完成后，才更新“总体状态”和 `PROJECT.md` 中的整体完成描述。

推荐登记格式：

```md
## YYYY-MM-DD 模块名称

- 状态：进行中 / 已完成 / 阻塞
- 变更：说明新增、移动或保留的组件职责。
- 边界：说明页面、组件、Hook、Store、API 和数据适配的归属。
- 验证：列出实际执行的命令和关键流程。
- 限制：记录未完成项、既有阻塞或未执行的浏览器验收。
```

## 5. 初始审计记录

### 2026-09-29 插入光标首尾感应定位

- 状态：代码及 Store 自动化验证完成，时间线模块仍进行中，浏览器交互验收待完成。
- 变更：插入光标只在鼠标靠近其他视觉片段首或尾 8px 内显示，固定在拖拽前的边界；离开感应范围立即隐藏，不再跟随自由拖动连续移动。
- 定位：关闭吸附时，无插入目标的拖动不推动其他片段，允许在足够空隙自由落位；重叠位置不落位，释放恢复原位置。悬空卡片独立跟随指针，命中首尾目标才执行插入重排。音频和字幕定位逻辑不变。
- 验证：`node --test scripts/timeline-drag.test.mjs` 8 项通过，新增无感应目标不推移、命中边界插入及离开后恢复测试；定向 ESLint、`npm run build`、`git diff --check` 通过。构建保留既有分包体积提示。
- 限制：尚未进行浏览器鼠标感应及动画视觉验收；全仓 lint 和架构阻塞情况见下条记录，本轮未重跑。

### 2026-09-29 时间线拖拽导致整轨后移修复

- 状态：本次缺陷代码修复及自动化回归完成；时间线主体、Store 和剪辑模块整体仍为进行中，浏览器交互验收待完成。
- 根因：关闭吸附时排布游标错误地从拖拽目标时间开始，导致前方片段也被推后；重排只写入 start、未写回数组顺序，窗口计算再次按旧顺序推移；连续预览基于上一帧结果计算，叠加临时位移。
- 修复：排布从零开始，仅在被拖拽片段处应用目标时间；视觉片段按新顺序写回，保留音频和字幕对象及时间位置；每帧基于拖拽前快照计算，退回原位可完整恢复，不产生无效历史或脏状态。
- 影响文件：`TimelineBar.jsx`、`compositionEditorStore.js`；新增 `scripts/timeline-drag.test.mjs`，通过 Vite SSR 加载实际 Store 执行回归。
- 验证：6 项自动化测试通过，覆盖关闭吸附保留间隙、首片段移到末尾、连续预览不累积、开启吸附连续重排、拖回原位无历史、整次撤销和重做；定向 ESLint、构建通过。
- 全仓检查：`npm run lint` 无错误，保留 `src/components/storyboard/PanelPromptInput.jsx:318` 的既有 Hook 依赖警告；架构检查仍被 `src/components/assets/seedanceUploadValidation.js` 命名问题阻塞。
- 限制：本轮未完成浏览器实际指针拖拽验收，不将自动化 Store 测试等同于悬空动画和插入点视觉验收。

### 2026-09-29 时间线拖拽优化

- 状态：进行中。
- 变更：视频、图片和音频片段统一支持指针拖拽；拖拽开始暂停播放并保持选中；拖拽片段使用品牌色描边、垂直上移 `12px` 和 `var(--color-timeline-drag-shadow)` 阴影；非拖拽片段位置使用 `300ms linear` 过渡。
- 历史：拖拽过程通过 `previewVisualSegment`/`previewAudioSegment` 更新，不写入撤销栈；释放后通过 `commitVisualSegment`/`commitAudioSegment` 只写入一次历史快照；无移动不产生历史。
- 吸附：视觉轨道沿用 `V1.excludeGaps`，开启时保持连续排布，关闭时保留间隙；音频仍只影响 A1，字幕不参与拖拽逻辑。
- 验证：`npx eslint src/components/compositionEditor/TimelineBar.jsx src/stores/compositionEditorStore.js`、`npm run build`、`git diff --check` 已通过；构建仅保留既有大体积分包提示。
- 架构检查：`npm run check:architecture` 仍被既有 `src/components/assets/seedanceUploadValidation.js` 小驼峰文件名阻塞，剪辑相关文件未新增非法导入问题。
- 限制：尚未完成登录态浏览器回归，需重点验证插入点靠近首尾、唯一片段不显示无意义插入点、吸附开关前后排布、音频独立移动、释放后单次撤销和小屏溢出；本次未改变音频和字幕的多轨同步关系。

### 2026-09-29 剪辑模块第一轮结构审计

- 结论：入口、草稿域和工作台四大区域已经完成第一轮组件化，但整体剪辑模块尚未完成。
- 已确认的独立区块：草稿卡片、草稿列表、草稿管理、剪辑方式、工作台头部、素材库、预览、属性、时间线、时间线工具栏、可调整布局和导出弹窗。
- 需要继续审计的边界：`CompositionEditorPage` 的资产加载与工程初始化、`AssetLibraryPanel` 的素材动作、`TimelineBar` 的时间线子职责、`PropsPanel` 的属性分组、Store 的状态与动作边界。
- 文档状态：新增本进度文档，并同步 `PROJECT.md` 与 `docs/refactor/component-inventory.md` 入口。
- 验证：已执行 `npm run check:architecture`；剪辑相关文件未触发非法导入，检查仍被既有 `src/components/assets/seedanceUploadValidation.js` 小驼峰文件名问题阻塞。
