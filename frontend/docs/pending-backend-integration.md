# 待对接后端接口清单

> 文档类型：前端待后端对接能力登记
> 最后更新：2026-10-20
> 维护方式：由 Suzy 命令触发，持续追加 / 更新 / 闭环条目

## 1. 用途

记录当前已在前端实现、但**后端接口尚未就绪（或无对应契约字段）**的功能模块。

登记范围仅指各条目明确缺失的能力；同一模块的其他接口可能已经接通。待后端接口就绪后，
按本文档逐条补充字段、请求参数与调用位置，并把对应条目标记为「已对接」。

## 主体跨设备定稿与原任务找回（2026-10-19）

- 状态：P1，本地代码与协议已核查，待后端确认/补齐；相关能力未完成前端接线、联调，不计修复通过。
- 位置：`src/api/subject.js`、`src/api/openapi.json`、`SubjectPrimaryCoordinator.js`、`src/pages/Home.jsx`；证据及验收条件见[主体并发与任务找回协议核查](reviews/2026-10-12/主体并发与任务找回协议核查.md)。
- 定稿条件写入：需确认读取版本、原子条件写入及冲突响应，覆盖定稿、取消和自动定稿等入口；本地队列不能保证跨设备排序。
- 单图/批量幂等与找回：需确认请求标识、复用和过期规则，以及响应丢失后精确找回原任务的协议。已有项目任务列表，不代表可以唯一关联原提交，不能按最近任务猜测或自动重提。
- 剧本发布/抽取：已有 `client_request_id` 基础，但页面提交记录未持久化该键；需先确认相同键重放、计费与 `force_retry` 的优先级，再接线持久化及恢复。
- 结果完整性：需明确批量实际受理/跳过范围、逐项终态，以及抽取来源版本和完整结果可见依据，不能以列表非空判断全部到齐。
- 下一步：取得实际协议与响应样例后实施最小接线。以上为本地契约缺口，不表示已证实线上后端不存在相应能力；当前不要求在正式项目中重复付费生成验收。

## 画布项目、多画布及保存恢复（2026-10-21，部分接入待联调）

- 边界不变：独立项目包含多画布，名称分离；无视觉风格选择或默认绑定，真实失败不降级模拟。
- 最新三项补齐说明已明确无风格 canvas 项目、自由节点 Run 映射与分享导入目标项目，不再作为缺失契约重复索要。
- 正式项目新建及首张画布、分页列表和重开、项目独立改名已接线；既有正式文档读写、永久资产解析、多画布操作及本站分享仍待真实闭环验收。旧模拟链接仅兼容，不再用于新建入口。
- Run 创建/恢复/回填完整页面链路、分享导入目标项目及排序页面尚未完成，不得视为已验收；并非因上述三项契约缺失而阻塞。
- 后端待确认部署和迁移、同步 OpenAPI，以及项目复制的父子关系；前端下一步先手验正式入口、保存重开与上传，再接完整 Run 和分享导入。相关27项模拟通过，不代表线上部署或真实联调通过。详见 [当前进度](canvas-integration-status-2026-10-20.md) 与 [剩余交接](canvas-backend-followup-2026-10-20.md)。

## 2. 登记规则

每条记录至少包含以下字段，新增时按模板复制：

- 模块 / 位置（文件 + 关键行）
- 当前前端实现形态（UI 组件、状态变量、字段语义值）
- 后端缺失原因（无接口 / 无字段 / 契约未定义）
- 对接时需要的改动（参数、请求体、调用位置）
- 状态：`待对接` / `已对接`
- 登记日期

## 3. 待对接清单

### 剪辑草稿 —— 素材区独立持久化（2026-09-23）

- **状态**：待对接；建议契约待后端确认，尚未实现。
- **位置**：`src/components/compositionEditor/AssetLibraryPanel.jsx`（addNewAssets）、`src/pages/CompositionEditorPage.jsx`（onAssetAdded / 初始化）、`src/stores/compositionEditorStore.js`（save / init）、`src/api/compositions.js`（请求和响应适配）。
- **现状/缺口**：手动素材仅存前端 album，草稿接口只保存时间线，没有独立素材引用列表；未加入时间线的素材重开丢失。
- **需求**：新增有序 `library_asset_ids`（建议名），支持创建、更新、读取和复制；前端添加素材标记 dirty，保存列表并按 ID 恢复，不自动加入时间线。
- **独立问题**：本地上传/资产库视频主动加入时间线后的“不可用视频素材”校验失败，需另行联调，不能宣称随新增字段解决。
- **详细契约及验收**：[剪辑草稿素材区持久化后端需求](./backend-composition-library-requirements-2026-09-23.md)。

### 3.1 新建项目弹窗 —— 创作类型

- **位置**：`src/components/NewProjectModal.jsx`
  - 状态：`const [creationType, setCreationType] = useState('dialogue');`（约 316 行）
  - 调用：`apiCreateProject` 调用处注释提示（约 370 行）
  - UI：`<OptionTabs layout="flex" value={creationType} ... />`，标签「创作类型」（约 487 行）
- **当前前端实现**：
  - 复用通用选项卡组件 `ui/OptionTabs`，`layout="flex"` 等分横向排列
  - 选项语义值：`dialogue`（剧情对白）、`narration`（旁白解说）
  - 仅本地状态驱动，关闭弹窗时重置为 `dialogue`
- **后端缺失原因**：`CreateProjectRequest`（`src/api/api文档.json`）无 `creation_type` 字段，无对应后端契约
- **对接时需要改动**：
  1. `src/api/project.js` 的 `apiCreateProject`：在参数与 `JSON.stringify` 请求体中补充 `creation_type` 字段
  2. `NewProjectModal.jsx` 调用处：移除「仅前端状态」注释，改为上报 `creation_type: creationType`
  3. 字段命名需与后端契约对齐（当前前端 value 语义为 `dialogue` / `narration`）
- **状态**：`待对接`
- **登记日期**：2026-07-20

### 3.2 新建项目弹窗 —— 视觉风格「从风格库选择」二级弹窗（分类 + 封面）

- **位置**：`src/components/NewProjectModal.jsx`
  - 状态：`const [libraryOpen, setLibraryOpen] = useState(false);`、`const [libraryStyleValue, setLibraryStyleValue] = useState('');`
  - 二级弹窗：`StyleLibraryModal` 组件（已按 paper 设计稿重写）
  - 入口：`视觉风格` 字段右侧「从风格库选择」入口卡片，点击打开 `libraryOpen`
  - 分类数据：`LIBRARY_GROUPS`（动漫风格 12 项、真人写实 10 项，命名与顺序对齐设计稿）
- **当前前端实现（已落地，对齐设计稿）**：
  - 弹窗固定 `w-[600px] h-[750px]`，底部绝对定位 footer（取消 / 确定），分类 Tab 选中态 `#2DC3E1` 加粗 + 蓝色下划线、未选中 `#FFFFFF99`
  - 封面网格为行内 `flex flex-wrap gap-[8px] justify-between`，卡片 `w-[130px] h-[130px] border-[#FFFFFF1F]`，标签 `#FFFFFFB3 text-[14px]`
  - 选中态：蓝色边框 + 右上角蓝色对勾角标（与设计稿一致）
  - 单选回填 `libraryStyleValue`，提交时走原 `visual_style` 值（与既有风格库契约一致）
- **后端缺失原因（待对接点）**：
  1. **封面图资源待补**：设计稿中 22 个风格封面均为 paper 外链 PNG；本地网络不可达，无法下载转 avif。当前封面策略为：本地已有 avif 的复用（xianxia / suspense / cyberpunk / pixar / wuxia / ghibli / shinkai / ancient-chinese / urban-workplace / post-apocalyptic），其余 12 个（3D魔幻史诗、日韩二次元、2D写意古风、暗黑哥特、古风写实、都市情感、仙侠玄幻、悬疑恐怖、写实年代剧、未来科幻、职场商战、武侠战争、乡土风格）用渐变占位。需联网下载 paper 外链并转 **avif 压缩**后落到 `src/assets/styles/`，并在 `LIBRARY_GROUPS` 中补 `coverImg`。
  2. **真人写实分类无后端契约**：现有 `apiGetVisualStyleOptions`（`src/api/user-styles.js`）仅返回扁平列表，无「动漫风格 / 真人写实」分类维度，真人写实 10 个条目（古风写实、都市情感、仙侠玄幻、悬疑恐怖、末日废土、写实年代剧、未来科幻、职场商战、武侠战争、乡土风格）暂无对应后端枚举/数据集
  3. **分类接口缺失**：`apiGetVisualStyleOptions` 需补充分类字段（如 `category`）或新增分类接口，否则分类与扩展风格只能前端写死
- **对接时需要改动**：
  1. `src/api/user-styles.js` 的 `apiGetVisualStyleOptions`：补充分类字段（如 `category`）或新增分类接口
  2. `StyleLibraryModal`：从接口读取分类与封面，替换前端写死的 `LIBRARY_GROUPS`
  3. 字段命名与分类枚举需与后端契约对齐；封面改为接口返回的 avif 资源地址
- **状态**：`待对接（前端 UI 已按设计稿落地，封面资源 + 分类接口待后端）`
- **登记日期**：2026-07-20

## 4. 已对接闭环

（后端接口就绪并完成上报后，从上方移到此处，标注对接日期与对应提交 / 任务。）
