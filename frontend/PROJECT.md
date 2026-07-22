# miioo 项目进度管理文档

> 最后更新：2026-07-22（项目总览资产概况组件化与剧本页创作入口进度同步）

---

## 历史进度（2026 年 7 月前）

已完成首页、项目列表和项目工作流的主要页面开发，覆盖全局设定、剧本、主体、分镜等核心流程；创作页和资产库已完成基础能力建设并持续完善。

已完成 API 层和认证层重构，统一请求封装、双 token 刷新、接口路径与字段，并完成项目、主体、分镜、资产和模型配置等主要接口对接；同时保留 Mock 分支支持本地开发。

已补齐项目数据、封面、剧本、主体和资产的持久化与联动，完成分镜提示词、主体参考图、水印设置、模型默认标签及项目总览等功能优化。Design System 和通用组件文档已建立，部分动效与交互模式文档仍待补充。

---

## 2026 年 7 月进度

### 2026-07-21 至 2026-07-22 最新进度

- [x] 项目总览“资产概况”中的剧本进度已组件化：新增 `src/components/project/ScriptProgress.jsx` 与 `src/components/project/ScriptProgressCard.jsx`，并通过 `src/components/project/index.js` 统一导出；`GlobalSettings.jsx` 只负责传入剧集数据和状态映射。
- [x] 剧本进度卡片支持四种状态：未分镜、已分镜、剪辑中、完成；兼容现有 `pending`、`generated`、`edited` 数据契约，并支持 `storyboarded` 状态，不修改 API、Store 或状态来源。
- [x] 剧本进度容器最多展示两行卡片，超出内容在容器内部纵向滚动；角色、场景、道具主体概况容器同样最多展示两行，分别在各自滚动区内查看。
- [x] 角色、场景、道具右上角跳转图标保持可用，分别通过 `char`、`scene`、`prop` 跳转到主体页对应分类 Tab；已补充中文 `title` 与 `aria-label`，未改变原有跳转链路。
- [x] 已完成新增剧本进度组件的定向 ESLint、项目构建、架构检查和 `git diff --check`；架构检查仅保留历史页面规模告警，没有新增阻断问题。
- [x] 剧本页新创作入口已完成首轮页面结构和交互接线：工作区消息可持久化，支持流式消息更新、暂停/超时/网络错误保留已收到内容，并接入剧本模式、分镜脚本和 AI 直接创作入口。
- [x] 剧本编排流程已接入结构化草稿确认、任务轮询、结构数据展示、分集切换、AI 重写、结构保存和删除；剧集结构导航已移除，原有剧本编辑、定稿和主体提取边界保留。
- [ ] 分镜脚本的 `.xlsx` 解析、后端上传、分镜页跳转和模板字段协议尚未纳入当前阶段；当前仅保存本地文件选择状态。

### 已完成

- [x] 分镜视频创作弹窗主体标签分类修复（2026-07-08）：按资产 `category` 还原角色、场景、道具类型，其他资产和本地上传统一显示「其他」，并保证刷新前后一致。改动集中在 `src/pages/StoryboardPage.jsx`。
- [x] 创作页视频结果卡「尾帧用作首帧参考」：前端抽取视频尾帧并回填首帧槽位。

---

## V1.1 前端架构重构（更新于 2026-07-17）

当前分支：`feat/frontend_V1.1`

### 已完成

- 完成页面、组件、按钮、弹窗和局部组件规模盘点。
- 建立并执行 `ui`、`feedback`、`overlay`、`actions` 和业务域组件分层。
- 建立 OpenSpec 重构提案、设计、能力规格和任务清单。
- 建立项目总规则、组件架构、页面架构、状态管理、导入边界、页面迁移和结构索引文档。
- `AGENTS.md` 与 `CLAUDE.md` 内容已统一；`src/pages`、`src/api`、`design-system` 下的两类入口规则也已统一。
- 新增并持续使用 `npm run check:architecture`，检查命名、基础 UI 反向依赖和历史页面规模告警。
- 完成 `ProjectList` / `GlobalSettings` 样板阶段的基础按钮迁移。
- 完成 `ScriptPage` 首轮业务域拆分：编辑器、输入区、分集区、流式展示区和稳定动作区已抽离。
- 完成 `SubjectPage` 首轮收尾：主体列表、卡片、图片区、参考图、生成参数/结果适配、任务读取适配、图片动作、工具栏、标签和音色弹窗已按边界拆分；页面级 API、任务轮询、缓存、Toast 和副作用仍由页面编排。
- 完成 `SubjectPage` 编辑面板左侧表单组合拆分：新增 `src/components/subject/SubjectEditForm.jsx`，统一文本字段、模型/比例/分辨率、参考图和生图模式展示；页面继续持有字段状态、生成 API、任务轮询、缓存、Toast 和图片副作用。
- 完成 `Home.jsx` 低风险展示区块迁移：标语动画和开始创作按钮已移至 `src/components/home/`，通过目录入口和显式 `onClick` 接入；登录判断、新建项目开关、导航、项目加载和工作流副作用仍由首页编排。
- 已处理构建体积告警和 `src/api/config.js` 动态/静态导入冲突。

### 当前页面重构状态

| 页面 | 当前行数 | 状态 | 说明 |
|---|---:|---|---|
| `ProjectList.jsx` | 638 | 样板完成 | 基础按钮和项目操作弹窗已迁移，仍有历史页面逻辑 |
| `GlobalSettings.jsx` | 891 | 样板局部完成 | 封面上传和部分按钮已迁移，自动保存及表单区仍待整理 |
| `ScriptPage.jsx` | 624 | 首轮完成 | 页面保留状态、接口、流式生命周期和业务编排 |
| `SubjectPage.jsx` | 1708（2026-07-17，主体工作区与编辑表单拆分后；架构统计 1709） | 首轮收尾完成，稳定弹窗区块已迁移 | 主体工作区外框、列表滚动视口、网格、卡片、参考图、生成参数/结果、图片动作、工具栏、标签、音色弹窗、分镜确认弹窗、Toast 展示、主体空态图标、提取状态展示和主体编辑面板接线已按边界拆分；`SubjectEditForm`、`TextField`、`Select` 和参考图卡片已复用；API、任务轮询、缓存、Toast 和主体生成编排仍由页面负责 |
| `Home.jsx` | 1296（2026-07-17，HomeNavigationRail 拆分后；架构统计 1297） | 首页稳定展示区块迁移完成，页面保留业务编排 | `HomeHeader`、`HomeLogo`、`HomeBackground`、`HomeSloganText`、`StartCreationButton`、`QRCodePopup`、`MoreOptionsMenu`、`CreationManualButton`、`LoginButton`、`WorkflowStepTabs`、`WorkflowHeadbar`、`HomeNavigationRail`、`ApiConfigBubble`、`HomeToast` 已迁移；页面仍保留认证状态、项目加载、步骤切换、任务触发和全局副作用 |
| `AssetsPage.jsx` | 57（2026-07-16，入口收敛后） | 页面入口与主要非破坏性交互已复验，外部副作用仍待授权 | 页面只负责模块切换和外框；`AssetsProjectPanel.jsx`（506 行）负责项目资产筛选、分页、批量动作和详情编排，`AssetsCreativePanel.jsx`（358 行）负责创作资产历史、收藏和批量动作；API、IntersectionObserver、删除/下载/收藏/Toast 等副作用仍由业务面板持有 |
| `CreationPage.jsx` | 964（2026-07-17，CreationWorkspace 与媒体下载适配复用后；架构统计 965） | 静态收尾与运行时验收完成（按用户确认） | 已抽离顶部工具栏、提示词编辑区、上传/首尾帧入口、文件卡片、参数组合层、输入区视觉组合、确认弹窗和视频详情 Portal、模型/比例/分辨率/数量/配音选择器视觉实现、图片/配音结果卡、结果展示容器、空态区、未登录空态、发送按钮、Toast、真人素材弹窗、资产选择与配音选择弹窗组合接线、素材适配纯函数、`useCreationInputFiles`、`useCreationPromptInteraction`、`useCreationParamsState`、`creationHistoryAdapter`、`creationTaskAdapter`、`creationFilename` 和 `CreationInputCard`；页面仍持有 Toast 状态/定时器、生成参数组装、生成与历史 API、任务轮询、缓存和 Store 编排；CreationPage 运行时验收按用户确认完成 |
| `StoryboardPage.jsx` | 1297（2026-07-17，生成面板结果卡片、StoryboardHeader 与 StoryboardToast 拆分后；架构统计 1298） | 首轮迁移与最终手动验证完成 | 镜头行、媒体列、主体参考列、文本编辑列、头部、批量工具栏、图片/视频生成面板、图片/视频上传与结果卡片、参考素材编辑区、选集控制区、旁白区、上传槽位、镜头编号列和 Toast 展示已抽离；用户确认弹窗、上传入口、选择器及其余分镜功能均正常可用；API、轮询、缓存、持久化和 Toast 状态/触发仍由页面编排 |

### 验收现状

- **2026-07-16 CreationPage 文件名适配迁移**：新增 `src/utils/creationFilename.js`，迁移 `filenameFromPrompt`；页面继续负责图片、音频和视频下载副作用，已搜索旧定义和调用方，未发现缺失引用。

- **2026-07-16 Creation 结果卡片统一复用文件名工具**：`CreationImageResultCard`、`CreationAudioResultCard` 和 `CreationVideoResultCard` 均改为显式导入 `src/utils/creationFilename.js`；删除三个组件内的重复纯函数，图片/音频/视频下载的 fetch、Blob、浏览器回退和下载副作用未移动。全局搜索确认旧 `function filenameFromPrompt` 已无残留；`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过。

- **2026-07-16 Home 导航 SVG 视觉复核**：对照迁移前版本恢复并核对 `src/components/home/HomeNavigationConfig.jsx` 中顶部/底部导航的完整 `viewBox`、路径、描边、填充和创作图标 `clipPath`；保留 `QRCodePopup` 的 popup 契约，页面继续负责动态菜单、API bubble、导航状态和副作用。静态门禁通过。

- **2026-07-16 Storyboard 默认镜头适配迁移**：新增 `makeStoryboardShot` 至 `src/utils/storyboardDataAdapter.js`；页面继续负责新增/复制镜头的 API、状态写回和 Toast，适配函数不读取 React 状态。

- **2026-07-16 Home 导航与背景视频配置迁移**：新增 `src/components/home/HomeNavigationConfig.jsx`，迁移顶部和底部导航的静态配置、图标和标签；`Home.jsx` 继续负责导航状态、登录/API 判断、菜单弹窗和路由副作用。已复核 `NAV_ITEMS`、`BOTTOM_NAV_ITEMS` 的调用方和 `popup`/`bubble` 动态接线，未发现引用缺失。

- **2026-07-16 Home Logo 展示区迁移**：新增 `src/components/home/HomeLogo.jsx`，迁移完整品牌 SVG；组件通过 `clickable` 和 `onClick` 接收返回首页意图，不读取页面状态或执行存储副作用。`Home.jsx` 保留 `activeKey` 判断和导航状态写回，迁移前后的尺寸、路径、颜色和点击行为保持一致；静态门禁通过。

- **2026-07-16 Home 背景展示区迁移**：新增 `src/components/home/HomeBackground.jsx`，抽离首页背景视频、径向遮罩和非首页底色；页面通过显式 `isHome`、`videoRef`、`videoSrc` 和 `onVideoEnded` 接入，继续负责视频索引切换与导航状态，不移动任何认证或业务副作用。全量静态门禁通过。

- **2026-07-16 Home 无项目头部迁移**：新增 `src/components/home/HomeHeader.jsx`，抽离 Logo、创作手册、账户菜单和登录按钮组合；组件通过显式 props 接收认证资料及 `onLogoClick`、`onLoginClick`、`onLogout`、`onOpenProfile`、`onGoToAdmin`，不读取 Home 闭包或执行页面副作用。页面继续负责认证判断、状态和业务回调；lint、build、架构检查和差异检查通过。

- **2026-07-16 SubjectPage 主体归一化工具复用**：SubjectPage 删除重复的 `normalizeSubjectList`，改为显式导入 `src/utils/subjectAdapter.js` 的 `normalizeSubjects`；Home 与 SubjectPage 共用同一字段归一化和排序规则，页面仍负责 API 请求、状态写回、缓存和批量副作用。已通过 lint，后续静态门禁继续复跑。

- **2026-07-16 SubjectPage 模型响应适配迁移**：新增 `src/components/subject/SubjectModelAdapter.js`，抽离主体编辑面板图片模型列表、能力、分辨率、比例和参考图上限字段转换；页面继续负责模型 API、fallback、默认模型选择、状态联动和生成副作用。适配器只接收数据并返回新数组，已通过 lint。

- **2026-07-16 Storyboard 数据适配迁移**：新增 `src/utils/storyboardDataAdapter.js`，迁移 `normalizeStoryboard`、`toBackendStoryboard`、`urlPathKey` 和 `enrichMainRefs`；页面继续负责 API、镜头状态、任务轮询、缓存、持久化和写回副作用。已复核所有导入、导出和调用方，未发现旧定义残留或未定义引用。

- **2026-07-16 Storyboard 批量数据归一化复用**：在 `src/utils/storyboardDataAdapter.js` 新增纯函数 `normalizeStoryboardList`，统一处理初始缓存、分镜 API 响应及两个缓存订阅的列表归一化和主体参考图补全；页面继续负责请求、缓存订阅和状态写回。已删除页面内重复 `normalizeShots` 闭包，静态门禁继续通过。

- **2026-07-16 Subject/Storyboard Blob 下载工具复用**：新增 `src/utils/downloadBlob.js`，统一临时 URL、锚点点击和 URL 释放生命周期；SubjectPage 和 StoryboardPage 继续决定下载文件名、API 请求、Toast 和业务动作，已移除两处重复的页面内下载函数。

- **2026-07-16 SubjectPage 缓存边界适配迁移**：新增 `src/utils/subjectPanelStorage.js` 和 `src/utils/subjectPendingGenerationStore.js`，迁移主体面板 `sessionStorage` 读写及 pending 生图任务的 `localStorage`/`Map` 桥接；页面继续持有轮询、任务结果识别、缓存消费、状态写回和 Toast 副作用。已复核所有旧引用、导入/导出和初始化顺序，未发现未定义引用。

- **2026-07-16 SubjectPage 纯函数适配迁移**：新增 `getPendingGenTabSetter` 和 `defaultPromptForTab` 到 `src/utils/subjectPendingGenerationAdapter.js`；页面继续持有状态 setter 包装、任务恢复、详情加载和副作用，工具函数不读取 React 状态、不调用 API。已全局搜索旧定义和调用方，未发现缺失引用或未定义变量。

- **2026-07-16 SubjectPage 主体任务结果适配迁移**：新增 `src/utils/subjectPendingGenerationAdapter.js`，迁移 `getPendingGenResult` 为 `findPendingSubjectImage`；页面继续负责任务轮询、pending 持久化、状态写回和 Toast，适配工具只负责识别新图片结果。

- **2026-07-16 Home 剧集状态适配迁移**：新增 `src/utils/episodeStatusAdapter.js`，统一项目概览 `episode_progress` 和剧集状态到 `episodeStatuses` 的纯转换；首页继续负责概览请求和状态写回，不改变生成状态优先级。

- **2026-07-16 Home 项目适配迁移**：新增 `src/utils/projectAdapter.js`，统一项目 `cover/cover_url` 字段兼容和创建时间倒序排序；首页继续负责项目请求、缓存恢复、导航和状态副作用。已消除首页三处重复项目列表归一化实现。

- **2026-07-16 Home 主体适配迁移**：新增 `src/utils/subjectAdapter.js`，迁移 `normalizeSubjects`；首页继续负责主体缓存订阅、分页请求、状态写回和项目副作用，纯字段转换和稳定排序不再留在页面入口。未改变主体字段映射或排序行为。


- **2026-07-16 StoryboardPage 提示词适配迁移**：新增 `src/utils/buildStoryboardPrompt.js`，迁移 `buildPromptFromShot`；图片/视频生成面板统一通过显式 `buildStoryboardPrompt` props 构建初始提示词，页面不再持有纯提示词拼接逻辑。未改变提示词字段顺序、台词拼接和生成 API 参数。


- **2026-07-16 StoryboardPage 参考资产适配迁移**：新增 `src/utils/storyboardReferenceAdapter.js`，迁移 `subjectTypeFromCategory` 和 `buildStoryboardRefFromAsset`；页面继续持有 `mainRefs` 写回，生成视频面板通过显式 `buildRefFromAsset` props 使用纯适配函数。未改变主体引用持久化、普通参考图映射或分镜生成参数。


- **2026-07-16 StoryboardPage 轻量操作原子迁移**：新增 `src/components/storyboard/StoryboardActionPrimitives.jsx`，统一 `RefSlotButton` 和 `StoryboardIconPlus`；页面与 `GenerateImagePanel` 通过显式 props 复用，不改变上传入口、资产选择或新增空白分镜行为。`StoryboardPage.jsx` 当前实际 1660 行，架构检查统计 1661 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。

- **2026-07-16 StoryboardPage 旁白列迁移**：新增 `src/components/storyboard/NarrationCol.jsx`，迁移旁白列表、编辑状态、配音弹窗和全局音色参数保存接线；页面仅通过 `NarrationColWrapper` 写回镜头数据。`StoryboardPage.jsx` 当前实际 1685 行，架构检查统计 1688 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。真实配音保存和外部副作用流程仍待安全测试条件。

- **2026-07-16 创作结果卡片按钮复用**：新增 `src/components/creation/CreationCardActionButton.jsx`，统一图片、视频、音频结果卡片中视觉和交互完全相同的悬浮操作按钮；业务回调和图标仍由各结果卡片显式传入。定向 ESLint 和 `git diff --check` 通过，未改变下载、删除、收藏或重新编辑行为。
- **2026-07-16 CreationResultState 尾帧回填适配统一**：新增 `createCreationFirstFramePrefill`，将尾帧 Blob 到首帧文件预填充对象的构造收敛到 `creationDetailAdapter`；结果组件继续负责尾帧 API、空结果判断、Toast、Blob 和状态更新。静态门禁通过，真实尾帧请求仍需登录态数据验证。
- **2026-07-16 CreationResultState 图片回填适配统一**：新增 `buildCreationImageReeditPrefill` 和 `buildCreationImageReferencePrefill`，图片重新编辑与“用作参考图”改为复用 `creationDetailAdapter`；结果组件仅保留 `prefillData` 状态和版本触发。后续运行时回填已由用户在本次总体验收中确认通过。
- **2026-07-16 CreationResultState 视频重新编辑预填充适配抽离**：新增 `buildCreationVideoReeditPrefill` 和 `toCreationRefMode` 至 `src/utils/creationDetailAdapter.js`，统一视频参考素材、真人素材、首尾帧、比例、分辨率和时长的预填充数据组装；组件继续负责详情请求、错误处理和 `prefillVersion` 状态。后续登录态参数回填已由用户在本次总体验收中确认通过。
- **2026-07-16 CreationPage 输入卡接线统一**：将结果区和空态区重复的 `onBeforeModelOpen` 与 `renderInputCard` 接线收敛为页面级显式辅助函数；未移动生成 API、参数状态、任务轮询、缓存或 Store 副作用。当前 `CreationPage.jsx` 实际 `1080` 行，架构统计 `1081` 行；静态门禁通过。
- **2026-07-16 CreationResultState 复用视频详情适配**：重新编辑流程改为复用 `src/utils/creationDetailAdapter.js`，不再在结果区重复解析 `asset_bindings`；保留结果组件的详情请求、预填充状态和用户交互边界。已搜索页面与组件中的旧内联解析，未发现重复字段转换或缺失引用；静态门禁继续通过。
- **2026-07-16 CreationPage 视频详情适配抽离与引用复核**：新增 `src/utils/creationDetailAdapter.js`，将视频详情 `asset_bindings` 的图片/视频/音频字段转换和轻量卡片合并从页面回调中抽为纯函数；页面继续持有详情 API 请求、弹窗状态和错误提示。当前 `CreationPage.jsx` 实际 `1072` 行，架构统计 `1073` 行；未发现旧内联适配残留、缺失导入/导出或未定义引用。
- **2026-07-16 Home 顶部动作组件引用复验**：确认 `CreationManualButton` 与 `LoginButton` 已从 `Home.jsx` 移至 `src/components/home/HomeHeaderActions.jsx`，页面仅保留显式调用和登录回调；`WorkflowHeadbar` 已由 `src/components/home/WorkflowHeadbar.jsx` 通过显式 props 接入。已全局搜索旧定义、导入/导出和调用方，未发现重复定义、缺失引用或未定义回调。
- **2026-07-16 OpenSpec 静态迁移口径收尾**：已将 6.2–6.5 父任务调整为“当前可安全静态拆分范围完成”，并把登录态、测试数据和外部副作用流程继续保留为独立未完成子任务；避免将静态拆分与真实业务回归混为一谈。
- **2026-07-16 静态门禁复验**：`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过；构建最大 JavaScript 分块约 `441KB`，架构检查仅保留 Home、StoryboardPage、SubjectPage 的历史规模告警。未登录态和安全测试数据下的真实业务副作用仍未验证。
- **2026-07-16 SubjectPage 编辑面板接线迁移与收尾审计**：新增 `src/components/subject/SubjectEditorSlot.jsx`，统一角色、场景、道具三个编辑面板的公共接线；页面继续持有列表写回、封面同步、主体 API、取消定稿、Toast、任务轮询和缓存副作用。当前 `SubjectPage.jsx` 实际 `1931` 行，架构统计 `1932` 行。
- **2026-07-16 SubjectPage 编辑面板接线迁移与引用安全复核**：新增 `src/components/subject/SubjectEditorSlot.jsx`，统一角色、场景、道具三类编辑面板的公共接线；列表更新、封面同步、`apiUpdateSubject`、取消定稿和 Toast/任务副作用仍由页面通过显式回调持有。迁移后 `SubjectPage.jsx` 实际 `1931` 行，架构统计 `1932` 行；三个旧的重复 `EditSubjectPanel` 接线块已移除，静态门禁通过。
- **2026-07-16 SubjectPage 提取状态展示迁移与引用安全复核**：新增 `src/components/subject/SubjectExtractionState.jsx`，迁移主体提取加载态和失败态；页面继续负责 `isExtracting`、`extractError`、列表数据和提取 API，仅通过显式加载文案与重试回调接入。迁移后 `SubjectPage.jsx` 实际 `1933` 行，架构统计 `1934` 行；`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过。
- **2026-07-16 SubjectPage 空态图标迁移与引用安全复核**：新增 `src/components/subject/SubjectEmptyIcons.jsx`，迁移角色、场景和道具卡片无图片时的静态空态图标；`SubjectGrid` 仍通过显式 `emptyIcons` props 接收，页面继续负责列表数据、分页、选择和所有业务副作用。迁移后 `SubjectPage.jsx` 实际 `1972` 行，架构统计 `1973` 行；旧内联图标定义无残留，`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过。
- **2026-07-16 SubjectPage Toast 展示迁移与引用安全复核**：新增 `src/components/subject/SubjectToast.jsx`，统一主体编辑面板和主体页批量生成 Toast 的纯展示；页面继续持有各自 Toast 状态、定时器、触发函数和业务消息，组件通过显式 `toast` props 接入。迁移后 `SubjectPage.jsx` 实际 `1993` 行，架构统计 `1994` 行；旧内联 Toast 展示已移除，`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 作为本轮验收项执行。
- **2026-07-16 Home Toast 展示迁移与引用安全复核**：新增 `src/components/home/HomeToast.jsx`，迁移首页成功、警告和错误 Toast 的 Portal 展示；Home 继续持有 `toast` 状态、定时器、`showToast` 触发和业务消息，组件仅接收 `toast` props。迁移后 `Home.jsx` 实际 `1517` 行，架构统计 `1518` 行；旧内联 Toast 搜索无残留，`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。
- **2026-07-16 Home API 配置提示气泡迁移与引用安全复核**：新增 `src/components/home/ApiConfigBubble.jsx`，迁移底部 API 配置入口的提示气泡；组件只负责展示，Home 继续负责登录/API 配置判断、底部导航和配置弹窗副作用。迁移后 `Home.jsx` 实际 `1555` 行，架构统计 `1556` 行；旧内联 SVG/提示气泡搜索无残留，`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。
- **2026-07-16 StoryboardPage 镜头编号列迁移与引用安全复核**：新增 `src/components/storyboard/ShotNumberColumn.jsx`，迁移 `NUMBER_BTNS`、`CardActionBtn`、镜头编号/选择态展示和悬浮 Tooltip；组件通过行级 Context 获取悬停、拖拽和删除确认能力，通过显式 props 接收新增、复制和批量选择回调。页面继续持有镜头 CRUD、排序、删除确认语义和 API/任务/缓存/持久化副作用。迁移后页面实际 `1825` 行，架构统计 `1826` 行；全局旧定义搜索无残留，`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。
- **2026-07-16 Home 底部菜单组合迁移**：新增 `src/components/home/HomeBottomMenus.jsx`，迁移 `MenuPopupItem`、`QRCodePopup`、`MoreOptionsMenu`；组件仅通过 `setWatermarkSettingsOpen` 和 `close` 接收页面动作出口，二维码、外链和菜单自身状态均留在首页组件域。未移动认证、项目加载、导航、任务生成或其他页面副作用。迁移后 `Home.jsx` 实际为 `1954` 行，架构统计为 `1955` 行；定向 lint、引用检查和结构索引已同步。
- **2026-07-16 Home 底部菜单运行时复验**：未登录态下首页菜单可正常打开，商务合作二维码浮层可显示；点击 AI 生成水印设置可打开弹窗并正常关闭。复验未发现项目页面 `ReferenceError`、解析错误或失效引用；水印设置加载触发的 `401 Unauthorized` 为预期未登录接口限制，本轮未提交登录信息或保存设置。


- **2026-07-16 CreationPage 未登录基础运行复验（最新）**：从首页进入创作页后，图片、视频、配音 Tab 均可切换；清空操作可打开确认框并取消；批量操作可进入并退出；登录弹窗可打开并关闭。复验期间未捕获项目页面的 `ReferenceError`、未定义引用、解析错误或页面级错误/警告。浏览器工具额外出现一条外部统计请求超时，不属于 miioo 页面日志，不计入项目回归失败。本轮未提交登录信息，也未触发上传、生成、下载、删除、定稿等外部副作用。

- **2026-07-16 CreationPage 遮罩组合拆分与引用安全复核**：新增 `src/components/creation/CreationPageOverlays.jsx`，统一承载批量删除确认、清空历史确认和视频详情 Portal；组件只接收显式状态、展示文本和动作回调，不调用 API、Store、缓存或任务轮询。页面继续持有删除、清空历史、视频下载、视频删除和收藏副作用；当前工作区 `CreationPage.jsx` 实际为 `1557` 行，架构统计为 `1558` 行。定向 ESLint、全量 lint、构建、架构检查、`git diff --check` 和已知失效引用搜索均通过；本次复核同步了页面结构索引和进度文档，未新增 `ReferenceError`、缺失 props 或导出错配。该拆分不等于登录态真实生成、失败恢复、刷新任务恢复和外部副作用流程已验证。

- **2026-07-16 CreationPage 输入卡片迁移与引用安全复核**：新增 `src/components/creation/CreationInputCard.jsx`（470 行），迁移输入区状态、素材 Hook 接线、参数状态、预填充、资产/音色/真人素材弹窗接线和生成参数组装；页面通过 `renderInputCard` 显式接入，继续持有生成 API、任务轮询、缓存、Toast、Store 写回和页面级副作用。迁移后未发现旧页面 `InputCard` 定义、缺失导入/导出或已知 `onDraftContentChange` 等失效引用；页面实际为 `1106` 行，架构统计为 `1107` 行。下一步不为了压缩行数强拆 `CreationInputCard` 的业务接线，先复跑静态门禁和未登录创作页，再在安全登录态和测试任务具备后验证真实生成相关分支。

- **2026-07-16 AssetsPage 登录态非破坏性验收**：已验证项目资产/创作资产切换、项目切换、项目资产分类（角色、场景、道具、分镜图、分镜视频、音频、成片）、创作资产分类（图片、视频、配音）、批量模式进入/退出、资产选择/取消选择、项目资产详情打开/关闭、创作图片详情打开/关闭、创作资产卡片悬停操作、收藏切换及离开页面后重新进入；测试前收藏状态已恢复。刷新后资产列表和当前分类数据能够恢复；刷新观察中顶部用户区域曾显示登录/API 配置入口，但未阻断资产数据展示，后续全量回归需继续关注认证状态水合。
- 本轮新增只读核对：项目资产的角色、场景、道具、分镜图、分镜视频、音频、成片分类均能切换并回显选中态；角色详情弹窗打开/关闭正常；创作资产图片详情弹窗打开/关闭正常；视频、配音分类当前为空态，未伪造真实媒体播放结论；没有滚动容器产生溢出，因此没有触发真实分页请求。
- 本轮验收明确未执行删除、下载、上传和真实生成等有外部副作用的操作。当前测试数据没有造成滚动容器溢出（`scrollHeight === clientHeight`），因此没有触发分页请求，不能将分页流程记录为完整通过；创作资产配音分类可以切换，但当前无音频卡片，只验证了分类和空状态，未验证真实播放/收藏。
- 本轮页面日志中未发现 `localhost` 页面错误或警告；出现的 `chrome-extension://` `fetchError` 来自浏览器扩展，不计入 miioo 页面错误。AssetsPage 定向 ESLint（页面、资产组件、资产 Hook、批量适配工具）、`npm run build` 和 `git diff --check` 均通过；该次记录时架构检查仅保留历史页面规模告警，后续最终静态验收已确认全仓库 `npm run lint` 通过。
- **2026-07-16 AssetsPage 页面入口收敛与引用安全复核**：`AssetsPage.jsx` 已从资产业务实现中收敛为 57 行，仅组合模块标签和 `AssetsProjectPanel` / `AssetsCreativePanel`；修复创作资产面板缺失的 `useAssetSelection` 引用，并将两个业务面板从目录入口改为直接引入具体组件，降低循环依赖和导出错配风险。资产域定向 ESLint 为 `0 errors / 0 warnings`，构建、架构检查和差异检查均通过；架构检查当前仅保留 `CreationPage`、`Home`、`StoryboardPage`、`SubjectPage` 的页面规模告警。
- **2026-07-16 AssetsProjectPanel 业务区块继续收敛**：新增 `AssetsProjectModals.jsx`，抽离项目重命名和项目删除弹窗；新增 `AssetsProjectGrid.jsx`，统一项目资产按类别选择音频卡片、主体资产卡片和普通资产卡片。`AssetsProjectPanel.jsx` 从 784 行降至 506 行，项目 API、筛选/分页、批量动作和详情副作用仍保留在面板；资产域定向 ESLint、构建、架构检查和差异检查再次通过。

- **2026-07-16 StoryboardPage 登录态非破坏性关键流程验收**：已从项目列表进入 `子不语第一回` 分镜页，验证分镜数据加载（第 1 集、10 个镜头、画面描述、景别/运镜/拍摄角度/构图/时长、光影、环境音、台词分配、主体参考以及分镜图/视频区域）；批量生成菜单可正常打开，图片生成面板和视频生成面板均可正常打开、关闭并显示待生成数量、模型、分辨率等选择器。已展开并收起模型、分辨率选择器，切换模型后当前值正确回显；刷新页面后分镜数据在加载完成后恢复。以上流程未发现 `ReferenceError`、`xxx is not defined`、未定义 props、解析错误或页面级控制台错误/警告。
- **2026-07-16 StoryboardPage 媒体结果补充验收**：在同一登录态项目中发现并核对已有媒体数据：页面包含 4 个图片元素、2 个视频元素和 30 个上传槽位文件输入；参考素材区域正常渲染，视频生成面板可展示「首尾帧」「参考主体」「参考图」「参考视频」「参考音频」等区域。已只读打开并关闭分镜图片详情和分镜视频查看器，图片/视频源地址与当前镜头一致；关闭后页面恢复正常，检查期间页面控制台错误/警告均为空。此次仍未执行开始生成、上传文件、下载、删除、定稿或其他外部副作用操作。
- 初轮验收时媒体结果未加载完成，曾记录为“没有可用媒体结果”；本次补充验收已修正该判断。当前仍未验证真实文件选择、参考素材编辑提交、下载、删除和定稿流程，也未将上传槽位或外部副作用流程记录为通过。

- **2026-07-16 CreationPage 历史数据适配迁移**：新增 `src/utils/creationHistoryAdapter.js`，统一历史列表响应解包、图片/视频/配音记录标准化、视频参考素材字段转换、历史缓存轻量字段裁剪和缓存响应外层结构保持。页面继续持有历史 API、缓存读写、分页、收藏同步、Store 更新和生命周期副作用；适配工具不调用 API、Store、缓存或 React 状态。`CreationPage.jsx` 当前实际为 1993 行，架构检查按末尾换行计 1994 行。定向 ESLint、构建、架构检查和 `git diff --check` 已执行通过；本轮未将页面任务轮询、Toast、生成 API 或缓存副作用搬出页面。
- **2026-07-16 CreationPage 历史数据适配迁移**：新增 `src/utils/creationHistoryAdapter.js`，统一历史列表响应解包、图片/视频/配音记录标准化、视频参考素材字段转换、历史缓存轻量字段裁剪和缓存响应外层结构保持。页面继续持有历史 API、缓存读写、分页、收藏同步、Store 更新和生命周期副作用；适配工具不调用 API、Store、缓存或 React 状态。随后核对当前实际行数为 1950 行，架构检查按末尾换行计 1951 行。
- **2026-07-16 CreationPage 刷新任务恢复适配迁移**：新增 `src/utils/creationTaskAdapter.js`，统一校验和标准化 localStorage 任务快照、恢复占位 generation、图片/视频/配音轮询结果字段和媒体地址转换。页面继续持有 `apiPollCreationTask`、轮询生命周期、Store 删除/写回、缓存失效、Toast 和并发计数副作用；工具不调用 API、Store、缓存、Toast 或 React 状态。CreationPage 定向 ESLint 和失效引用搜索通过；真实刷新任务恢复仍待登录态安全测试条件具备后验证。
- 创作区新增组件定向 ESLint：`CreationInputOverlays.jsx`、`CreationFileUtils.js`、`CreationUploadArea.jsx`、`CreationAssetPickerModal.jsx`、`CreationDubbingVoiceModal.jsx`、`useCreationInputFiles.js`、`useCreationPromptInteraction.js`、`CreationPromptEditor.jsx` 和 `components/creation/index.js` 通过，无新增错误或警告。
- `npm run build`：通过；没有超过 500KB 的 JavaScript 分块告警，`ScriptEditor` 最大约 441KB，`CreationPage` 约 239KB。
- `npm run check:architecture`：通过；仅保留 `CreationPage`、`Home`、`StoryboardPage`、`SubjectPage` 的历史页面规模告警，无阻断级违规；`AssetsPage` 已低于当前检查阈值。
- `git diff --check`：通过。
- `CreationPage.jsx` 定向 ESLint：已清理页面入口的未使用变量、无效赋值、空 `catch` 和历史 Effect 依赖问题，本轮定向检查为 `0 errors / 0 warnings`；创作域相关组件与参数 Hook 定向检查同样通过。该结论仅适用于本轮目标文件及创作域迁移文件，不代表全仓库 lint 已通过。
- 素材 Hook 边界：已静态核对本地图片/视频预览、删除、模型切换裁剪、生成成功清理、失败恢复、首尾帧切换/交换以及资产素材不释放 Blob URL；真实上传和生成请求仍需登录态验证。
- 素材 Hook 生命周期复核：同一文件的 `_objectUrl` 与 `previewUrl`、普通素材与首尾帧重叠场景均增加 URL 去重释放保护；构建无超过 500KB 的 JavaScript 分块告警。
- 资产/配音弹窗引用安全：已确认旧 `src/pages/DubbingVoiceModal.jsx` 及旧导入不存在；`CreationAssetPickerModal`、`CreationDubbingVoiceModal` 均通过目录入口导出，`CreationInputOverlays` 内部调用名称与导出名称一致，页面不再直接导入三个弹窗本体；首尾帧目标清理和类型过滤仍由显式 props 保持。
- `CreationInputOverlays` 接线验收：通过；三个弹窗的开关、关闭、确认、首尾帧目标清理和真人素材初始选中项均有显式 props，已搜索 `onDraftContentChange` 等已知失效引用，未发现本轮新增的未定义引用。
- `useCreationPromptInteraction` 接线验收：通过；已搜索旧提示词交互引用、失效回调和未定义变量，页面仅通过 Hook 的显式返回接口使用编辑器、@素材标签、粘贴、预填充、失败恢复和文件移除能力；参数状态、生成 API、任务轮询、缓存、Toast 和 Store 副作用仍未越界移动。
- `useCreationParamsState` 接线验收：已完成静态检查，并在登录态完成模型切换、图片/视频参数联动、视频参考模式和配音参数交互的安全验证；Hook 仅接收 `creationParams`、`genType`、`prefillVersion` 和 `prefillData`，显式返回参数值、setter 与 `resetDubbingParams`，不引用页面、API、Store 或 Toast。参数默认值、比例/分辨率兼容联动、模型切换后的默认值和视频重新编辑字段回填已从 `InputCard` 移出；生成参数最终组装和页面副作用仍保留在原边界。视频重新编辑回填、失败恢复、刷新任务恢复、配音重置和真实任务链路仍待验证。
- 本轮创作页记录时仅确认目标页面和相关创作域文件的定向 lint；最终静态验收已另行确认全仓库 `npm run lint` 通过。
- 参考素材编辑区引用安全：通过；`ReferenceMediaEditor` 直接引入 `StoryboardUploadSlots`，`GenerateVideoPanel` 不再转发上传槽位，上传槽位不依赖页面闭包变量。
- 任务读取适配边界：通过；`storyboardTaskAdapter.js` 只处理分镜任务状态和媒体结果字段，`creationTaskAdapter.js` 只处理创作刷新任务快照、占位 generation 和轮询结果字段，页面继续持有轮询、状态更新、缓存、持久化、Toast 和业务写回。
- 失效引用搜索：通过；未发现 `onDraftContentChange`、`ModalToggle`、残留页面级 `VideoUploadCard`/`VideoItem` 调用、未定义的 `CharTag`/`AddSlotBtn`、旧任务读取函数或缺失的 `FrameUploadSlot`/`PanelUploadSlot` 引用；`SubjectAssetDetailModal`、`AssetDetailModal` 与 `ShotDetailModal` 页面旧定义均已删除，目录导出和 `ProjectAssetDetail` 注入引用一致。
- `SubjectPage` 定向引用安全检查：通过，未发现未定义引用、失效导入或解析错误。
- **创作页登录态安全验收（2026-07-16）**：已在登录态完成视频模式切换、视频参考模式（全能参考/首尾帧）、视频比例/分辨率/时长切换、配音情绪/语速切换、图片模型切换及图片分辨率/比例切换；交互后参数能回显，未捕获 `ReferenceError`、未定义变量、页面级控制台警告或选择器联动失效。已额外搜索 `onDraftContentChange`、`ModalToggle`、`toastFired`、`restoredShotIdsRef` 等已知引用缺失风险，创作域未发现残留。该验收未触发真实生成接口，因此视频重新编辑回填、生成失败恢复、刷新任务恢复、生成后的配音参数重置、真实上传/生成/轮询/失败清理仍保持“未验证”。
- **后端历史接口问题（2026-07-16）**：创作页加载历史时曾收到 `Internal Server...` 形式的非 JSON 响应，前端因此出现 JSON 解析错误；该问题属于后端接口返回格式或服务端异常，不归因于本轮组件拆分，需在后端服务恢复后单独复核。
- **其他页面运行时验收**：AssetsPage 已完成本轮非破坏性登录态和只读边界验收，但分页真实触发、音频卡片有数据时的播放/收藏、删除/下载/上传及部分逐类详情流程仍未覆盖；刷新后的认证状态水合仍需在全量回归中关注。StoryboardPage 已完成分镜数据、批量生成面板、选择器、刷新恢复以及已有图片/视频结果查看器的非破坏性验收，但参考素材编辑提交、真实文件选择及上传/下载/删除/定稿等外部副作用流程仍未覆盖。验收时不触发真实生成接口。
- **AssetsPage 音频卡片静态收尾（2026-07-16）**：新增并接入 `src/components/assets/AssetsAudioCard.jsx`，页面不再保留 `AudioCard`/`WaveformBars` 定义或调用；同时清理资产库历史 mock、无效页面 props、收藏筛选控件和资产加载 effect/ref 边界。资产库相关文件定向 ESLint 为 `0 errors / 0 warnings`；本轮 `npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。架构检查仅保留页面规模告警，不是阻断错误。

- **2026-07-16 最终静态验收复跑**：按 `npm run lint` → `npm run build` → `npm run check:architecture` → `git diff --check` 顺序执行，四项均通过。全仓库 ESLint 当前无错误、无警告；构建成功，最大 JavaScript 分块为 `ScriptEditor` 约 `441KB`，未出现超过 `500KB` 的分块告警，也未出现 `src/api/config.js` 动态/静态导入冲突；架构检查仅保留 `CreationPage`、`Home`、`StoryboardPage`、`SubjectPage` 页面规模告警，`AssetsPage` 已不再超出当前告警阈值；差异检查无空白错误。
- **2026-07-16 验收边界**：本轮证明的是静态质量门禁和构建可产出，不等于所有业务流程已完成回归。已记录的登录态非破坏性验收覆盖首页/项目入口、AssetsPage、StoryboardPage 以及 CreationPage 的参数交互；上传、下载、删除、定稿、真实生成、任务轮询恢复、失败恢复、分页真实触发和配音播放等有外部副作用或条件依赖的流程仍需在安全测试数据和登录态下逐项验证。
- **2026-07-16 CreationPage 刷新任务适配复验**：`CreationPage.jsx` 与 `src/utils/creationTaskAdapter.js` 定向 ESLint 通过；全仓库 `npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过。架构检查仅保留页面规模告警，构建未出现超过 500KB 的 JavaScript 分块或 `src/api/config.js` 动态/静态导入冲突。刷新任务恢复、失败清理和真实结果写回仍需在安全登录态和测试数据下验证，未将静态通过记录为业务流程通过。
- **2026-07-16 CreationPage 未登录任务恢复边界修复**：刷新任务恢复 effect 现在先判断 `isLoggedIn`；未登录时不读取、不清空、不轮询 `miioo_pending_tasks`，登录状态建立后才消费快照并继续恢复。已在未登录创作页确认页面正常渲染，未发现页面级错误；真实登录态任务恢复、失败清理和结果写回仍未伪报通过。
- **2026-07-16 CreationPage 未登录空态运行时验收**：从首页进入创作页，确认未登录状态下图片/视频/配音标签、清空、批量操作和“请先登录”空态均正常渲染；点击空态登录按钮可正常打开登录弹窗。页面未发现 `ReferenceError`、未定义引用或页面级控制台错误/警告；本次未提交登录信息、未触发外部副作用，登录态任务恢复、失败清理和结果写回仍待安全测试数据验证。
- **2026-07-16 CreationPage 未登录基础运行复验**：从首页点击“开始创作”后，创作页图片/视频/配音 Tab、清空、批量操作和登录空态均正常渲染；打开并关闭登录弹窗后页面恢复正常。浏览器页面日志未发现 `ReferenceError`、未定义引用、解析错误或页面级错误/警告。当前没有可用的安全登录态和测试任务，因此视频重新编辑参数回填、失败恢复、刷新任务恢复、结果写回、配音重置以及真实上传/生成/轮询仍明确记录为“未验证”，本次未触发任何外部副作用。
- **2026-07-16 CreationPage 文档行数校正**：复核工作区后确认 `wc -l` 为 `1954` 行，架构检查脚本按 `split('\n')` 统计为 `1955` 行；已同步进度表、组件盘点、OpenSpec 任务清单和页面结构索引，避免继续引用旧的 `1953/1954` 数值。
- **2026-07-16 CreationPage 未登录空态拆分**：新增 `src/components/creation/CreationLoginEmptyState.jsx`，页面只通过显式 `onLoginClick` 接入登录按钮；未移动任务轮询、生成 API、Store、Toast、缓存或页面副作用。当前 `CreationPage.jsx` 实际为 `1886` 行，架构检查统计为 `1887` 行；已同步结构索引和组件清单。此次只完成静态拆分，未将运行时任务恢复记录为已验证。
- **2026-07-16 Home 低风险区块迁移复核**：新增 `src/components/home/HomeSloganText.jsx`、`StartCreationButton.jsx` 及目录入口；首页仅通过显式 `onClick` 接入开始创作按钮，标语组件无页面业务依赖。已检查 `LoginButton` JSX 闭合结构，首页及新增组件定向 ESLint、构建和旧定义/失效引用搜索通过；未改变首页视觉、登录判断、导航或新建项目副作用。`Home.jsx` 当前实际 `2137` 行，架构统计 `2138` 行，结构索引已按真实行号更新；首页仍属于架构规模告警页面。
- **2026-07-16 CreationPage 发送按钮拆分**：新增 `src/components/creation/CreationSendButton.jsx`，迁移圆形发送按钮、`PulsingBorder`、加载动画、聚焦/悬停/按下反馈及并发限制提示；页面仅通过 `onClick`、`disabled`、`loading` 和 `disabledTooltip` 显式接入。页面不再保留旧 `SendButton`、思考动画样式注入或相关按钮依赖；未移动生成 API、任务轮询、缓存、Toast、Store 或生成参数组装。定向 ESLint 和失效引用搜索通过，当前页面实际 `1748` 行，架构统计 `1749` 行；运行时生成、失败恢复和刷新任务恢复仍未验证。
- **2026-07-16 CreationPage Toast 拆分与引用安全复核**：新增 `src/components/creation/CreationToast.jsx` 并通过 `src/components/creation/index.js` 导出；页面移除旧的本地 Toast 定义，仅通过 `toasts` props 使用展示组件。Toast 状态和定时器仍由 `CreationPage` 持有，未改变提示触发和消失行为；同时清理页面尾部重复的批量删除确认弹窗。已复核导入/导出、旧定义和调用位置，未发现失效引用或缺失 props；当前页面实际 `1700` 行，架构统计 `1701` 行。定向 ESLint、全仓库 lint、构建、架构检查和差异检查均已通过。
- **2026-07-16 CreationPage 输入区视觉组合拆分与引用安全复核**：新增 `src/components/creation/CreationInputSurface.jsx`，承载输入卡布局、悬浮边框、上传区、提示词编辑器、参数控制、发送按钮和弹窗组合接线；`InputCard` 仍显式持有素材/参数状态、生成参数组装、失败恢复和业务回调，生成 API、任务轮询、缓存、Toast 与 Store 副作用继续留在页面边界。组件不读取页面闭包，选择器通过具体文件导入避免目录入口循环依赖；已复核 props、import/export、旧定义和已知失效引用。当前 `CreationPage.jsx` 实际 `1584` 行，架构统计 `1585` 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 已通过。该记录仍不等于登录态生成、失败恢复、刷新任务恢复和真实副作用流程通过。
- **2026-07-16 CreationPage 静态门禁与未登录基础运行验收**：全仓库 `npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过；构建最大 JavaScript 分块约 `441KB`，没有超过 `500KB` 告警或 `src/api/config.js` 动态/静态导入冲突。未登录创作页可正常渲染图片/视频/配音标签、清空、批量操作、登录空态和登录弹窗入口，未发现页面级 `ReferenceError`、未定义引用、错误或警告。登录态刷新任务恢复、失败清理、结果写回及真实生成链路仍未验证。

### 当前收尾口径

- 静态结构迁移：`ScriptPage`、`SubjectPage`、`AssetsPage`、`CreationPage`、`StoryboardPage` 和 Home 稳定区块均已完成当前可安全抽离范围；StoryboardPage 已完成最终手动验证。
- `AssetsPage`：用户确认非音频前端功能验证通过且无页面级错误；音频播放/收藏明确跳过，不纳入本次前端重构验收。
- 运行时业务回归：用户已确认本次纳入范围的运行时验收全部通过；音频播放/收藏此前已明确排除在本次前端重构范围之外。
- 页面级副作用：认证、API、任务轮询、缓存、Store 写回和真实外部动作继续由页面或业务面板负责，不再为了降低行数强行搬迁。

### 当前阻塞条件

- 静态重构、文档同步、运行时验收和归档前审查均已完成；安全登录态和测试项目下，CreationPage、AssetsPage（音频除外）和 StoryboardPage 的纳入范围均已由用户确认通过。

### 下一步

1. **静态收尾已完成**：当前不再为了压缩行数强拆页面 API、任务轮询、结果写回、Toast 和业务副作用；历史备份已清理。
2. **范围边界**：音频播放/收藏按用户要求不纳入本次重构；除此之外，本次重构计划内的运行时验收已全部通过。
3. **OpenSpec 收尾**：任务清单、PROJECT.md 和组件清单已同步；本次前端重构可以按已完成状态交付，变更目录保留为审计记录。

- **2026-07-17 Home 顶部动作状态复用**：新增 `src/hooks/useHoverPressState.js`，统一 `CreationManualButton` 与 `LoginButton` 的 hover/pressed 指针状态；按钮仍保留各自视觉结构和显式 `onClick` 契约，未移动认证或外部链接副作用。已复核两个组件的导入/导出、调用方和未定义引用。
- **2026-07-17 CreationPage 主体工作区拆分**：新增 `src/components/creation/CreationWorkspace.jsx`，迁移主体卡片布局、工具栏以及登录态/结果/空态分支；页面继续持有历史 API、生成 API、任务轮询、缓存、收藏、删除、Toast、模型加载和 Store 写回。视频详情按需读取整理为页面内 `handleVideoCardClick`，通过显式 props 传给工作区，未改变业务行为。页面实际约 `1009` 行，静态门禁通过。

- **2026-07-17 项目页入口回归补充**：未登录态从首页进入项目页，项目导航、项目搜索框和新建项目入口正常渲染；未触发创建、重命名、删除或其他外部副作用。
- **2026-07-17 规则一致性检查增强**：`check:architecture` 新增 `AGENTS.md`/`CLAUDE.md` 镜像一致性和页面结构索引 `L?` 占位符检查；当前规则文档镜像完全一致，未发现索引占位符。
- **2026-07-17 页面规模检查对齐规范**：`scripts/check-architecture.mjs` 现在按规则报告页面 300 行、通用 UI 250 行、业务区块 400 行和 Hook 300 行警告；这些历史复杂文件仍只告警、不阻断，后续按明确安全边界逐步治理，不通过压缩代码规避。
- **2026-07-17 架构检查增强**：扩展 `scripts/check-architecture.mjs`，将 API 不得依赖页面/组件、`ui` 只能依赖通用工具和 ui 内部能力、反馈/遮罩/动作组件不得依赖页面/API/Store、业务组件不得反向依赖页面等规则转为阻断级检查；当前代码通过，页面规模仍仅告警。
- **2026-07-17 未登录入口回归补充**：在本地开发服务中复验首页头部 `创作手册`、`登录`、`开始创作` 入口；登录弹窗可打开并展示手机号/微信扫码模式，关闭后首页恢复。随后复验资产页的项目资产/创作资产切换、角色分类和创作资产图片/视频/配音切换，以及创作页图片/视频/配音模式切换；未发现页面级解析错误或 `ReferenceError`。本轮未提交登录信息，也未触发上传、生成、下载、删除、收藏、定稿或配音等外部副作用。

- **2026-07-17 登录态只读业务回归补充**：在 `http://localhost:5173/` 的安全登录态下，CreationPage 完成图片/视频/配音 Tab、视频模型选择、比例/分辨率/时长联动、刷新后页面恢复和无页面级错误检查；AssetsPage 完成项目资产/创作资产切换、项目资产角色/场景/道具分类切换，以及创作资产图片/视频/配音切换；打开测试项目后，Subject 工作区和 StoryboardPage 完成主体/分镜数据加载、镜头字段展示和分镜列表渲染复验。未触发真实生成、上传、删除、下载、收藏、定稿或配音等外部副作用。

- **2026-07-17 登录态只读回归补充**：在本地安全登录态和测试项目下，CreationPage 完成图片/视频/配音 Tab、视频模型选择、比例/分辨率/时长联动和刷新恢复；AssetsPage 完成项目资产/创作资产、角色/场景/道具分类及创作资产图片/视频/配音切换；StoryboardPage 完成测试项目分镜数据、镜头字段、批量生成菜单以及批量图片/视频生成面板打开/关闭复验。以上流程均未触发真实生成、上传、下载、删除、收藏、定稿或配音；期间未发现页面级 ReferenceError、缺失引用、解析错误或控制台错误。

- **2026-07-17 StoryboardPage 只读选择器与刷新复验补充**：在测试项目分镜页打开批量视频生成面板，模型选择器可展开并切换到 `HappyHorse 文生视频`，切换后分辨率联动为 `720P`，面板关闭正常；刷新页面后登录态仍可恢复，未发现页面级错误。未点击“开始生成”。

- **2026-07-17 CreationPage 历史结果只读复验**：登录态进入 CreationPage 后，图片/视频 Tab 均能正常渲染输入区和参数区；当前测试账号的创作历史区域没有可见结果卡，因此无法继续验证视频结果卡、重新编辑参数回填、收藏/详情入口和结果写回。本轮未触发生成或其他外部副作用，页面日志无项目级错误。

- **2026-07-17 CreationPage 真实图片生成验收**：经用户明确授权，在当前登录态测试项目中提交 1 张图片，使用现有默认模型 `豆包·Seedream 5.0`、`1:1`、`2K` 参数；接口返回 `201` 并创建任务 `763f48d4-83e7-4234-b93e-7291a0eaa454`，页面持续轮询任务接口且未出现页面级 `ReferenceError` 或控制台错误。等待约 30 秒后页面仍未显示结果卡，任务最终状态/结果写回尚未确认，需后续只读复查或继续等待；本次不重复提交生成。

- **2026-07-17 CreationPage 图片生成结果确认**：用户确认上述任务已成功返回生成结果，图片结果写回流程通过；此前“任务最终状态/结果写回尚未确认”的临时记录已失效。本次不重复提交生成。

- **2026-07-17 CreationPage 运行时验收口径更新**：用户确认此前列出的 CreationPage 手动验收项均无问题，其中“图片任务最终状态/结果写回”和“视频重新编辑参数回填”已由用户实际确认；失败恢复、刷新任务恢复、配音参数重置及真实上传/生成/轮询链路按用户要求视为通过，不再重复执行。该记录属于用户确认，不等同于本轮浏览器逐项复测。

- **2026-07-17 AssetsPage 音频范围确认**：用户确认音频功能尚未测通，本次前端重构跳过音频播放/收藏；该功能保持为未开发完成，不影响 AssetsPage 其他前端功能验收结论。


- **2026-07-17 SubjectPage 编辑表单组合拆分**：新增 `src/components/subject/SubjectEditForm.jsx`，抽离 `EditSubjectPanel` 左侧文本字段、模型/比例/分辨率、参考图和生图模式组合。组件只接收显式值、选项和回调，不调用 API、Store、缓存或任务轮询；页面继续持有表单状态、生成参数组装、生成 API、任务轮询、缓存、Toast 和图片副作用。迁移后 `SubjectPage.jsx` 实际为 1707 行，未改变业务流程。

### 当前下一步（2026-07-17，前端重构完成）

0. **本阶段已完成**：首页、项目页、AssetsPage、CreationPage、SubjectPage 和 StoryboardPage 的入口及主要非破坏性交互均已在登录态/测试项目下复验；未发现页面级 `ReferenceError`、缺失引用、解析错误或控制台错误。AssetsPage 当前可见分类已完成只读切换核对；分镜图分类当前无可见图片卡片时，仅记录为空态，不伪造详情通过。
1. **CreationPage**：按用户确认，运行时验收项视为通过；保留已提交的图片任务记录，不重复提交生成。
2. **AssetsPage**：非音频前端功能已由用户确认通过；音频播放/收藏按要求跳过，不纳入本次重构。
3. **StoryboardPage**：用户已完成最终手动验证，确认弹窗、参考素材上传、资产库选择、模型/分辨率等选择器、候选媒体上传入口及其余分镜功能均正常可用；不再作为当前重构阻塞项。音频功能仍按用户决定不纳入本次范围。
4. **静态门禁**：本轮 `npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check` 均通过；架构检查仅保留规模告警，最大 JS 分块约 441KB，无超过 500KB 告警。
5. **OpenSpec 收尾口径**：当前可安全静态拆分范围和本次纳入范围的运行时验收均已完成；音频播放/收藏是明确排除项，页面规模告警仍为非阻断告警。

- **2026-07-17 Storyboard 视频结果上传卡片拆分**：新增 `src/components/storyboard/VideoUploadCard.jsx`，仅负责视频本地文件入口、资产库选择入口和悬浮视觉状态；上传 API、资产字段转换、结果列表写回、定稿和 Toast 仍由 `VideoResultsPanel` 负责。已更新结构索引和 Storyboard 目录导出，未执行真实视频上传或其他外部副作用。下一步继续评估 `VideoResultsPanel` 结果卡及生成面板剩余纯展示边界；若没有更安全的边界，则转入静态收尾和剩余页面规模告警审查。

- **2026-07-17 Storyboard 视频结果卡片拆分**：新增 `src/components/storyboard/VideoResultCard.jsx`，负责视频预览、加载态、定稿控件和查看/下载入口的纯展示；`VideoResultsPanel` 继续持有列表状态写回、定稿回调、查看回调及浏览器下载副作用，并通过显式 props 接入。未执行真实下载或定稿操作。下一步继续评估生成面板剩余纯展示边界；若无明确安全边界，则进入静态收尾与 OpenSpec 未完成项审查。

- **2026-07-17 GenerateImagePanel 图片结果卡片拆分**：新增 `src/components/storyboard/ImageResultCard.jsx`，负责图片预览、加载态、定稿控件和查看/下载入口展示；`GenerateImagePanel` 继续负责结果列表写回、定稿回调、详情弹窗和浏览器下载副作用，并通过显式 props 接入。`StoryboardImageUpload.jsx` 仅保留上传卡片和共享图标按钮。未执行真实下载或定稿操作。下一步评估生成面板是否还存在明确的纯展示边界；若没有，则进入静态收尾与 OpenSpec 未完成项审查。

- **2026-07-17 生成面板结果展示静态收尾**：新增并接入 `ImageResultCard`、`VideoUploadCard` 和 `VideoResultCard`，统一图片/视频生成结果的媒体预览、加载态、定稿控件及回调出口；生成/上传 API、结果列表写回、详情弹窗、下载、定稿、任务状态和 Toast 副作用仍保留在业务面板或页面。全局搜索确认旧 `ImgItem`、`VideoItem` 和页面级 `VideoUploadCard` 实现无残留调用；本阶段可安全抽离的生成面板展示边界已完成。

- **2026-07-17 StoryboardPage 参考图上传修复与入口样式统一**：修复 `GenerateImagePanel` 本地参考图上传时错误读取 `e.target.files` 的问题，改为消费 `ReferenceImageField` 传入的文件数组；同时将 `ImgUploadBtn` 统一接入 `RefSlotButton`，使分镜图候选图、分镜视频候选视频及视频面板参考图/视频/音频入口使用一致样式。分镜相关定向 ESLint、构建、架构检查和差异检查通过；后续已由用户完成最终手动验收。

- **2026-07-17 Storyboard 参考视频/音频数量限制修复**：修复模型允许最多 3 个参考视频/音频时，上传第 1 个后入口错误消失的问题；`GenerateVideoPanel` 与 `ReferenceMediaEditor` 改用数组状态并按模型能力控制入口，支持最多 3 个素材、单项删除和计数显示。生成接口仍按既有单 URL 字段提交首项，未改变后端参数契约。定向 ESLint、构建、架构检查和差异检查通过；后续已由用户完成最终手动验收。

- **2026-07-17 StoryboardPage 最终手动验收通过**：用户确认分镜页面所有功能正常可用，包含弹窗打开/关闭、分镜图/视频参考素材本地上传与资产库选择、上传入口样式、模型/分辨率等选择器及其他分镜交互；参考视频/音频最多 3 个的入口修复纳入本次验收结论。音频播放/收藏仍明确排除在本次前端重构范围之外。

- **2026-07-17 上传入口统一**：主体编辑弹窗左侧参考图、右侧候选图，以及分镜图/视频的参考素材和候选媒体入口统一复用无业务 `src/components/ui/FileUploadButton.jsx`；上传 API、资产选择、文件校验和状态写回仍由原业务组件负责。

### 最终验收结论（2026-07-17）

- 用户确认本次前端重构纳入范围的运行时验收全部通过，前端重构任务完成度为 `100%`。
- 音频播放/收藏是明确排除项，属于后续独立产品功能，不影响本次前端重构完成结论。
- OpenSpec 任务清单已完成本次纳入范围的状态同步；变更目录保留为审计记录。

- **2026-07-17 旧版 Bug 修复经验迁移至重构版**：参考旧版 `解决方案.md`，修复当前版本资产选择器过滤生成中占位卡、创作页离开后输入状态丢失、发送后错误清空输入、参考素材 `@` 标签按唯一 `_uid` 删除、历史图片用作参考图时文件名固定、图片/视频/配音并发上限提示与图片/视频 10 个并发限制。未改变 API 协议和页面级任务编排。

### 旧版 Bug 修复经验迁移（2026-07-17）

参考 `/Users/suzylee/Desktop/miioo-project/frontend/解决方案.md`，已将当前仍适用的创作页问题迁移到重构版：

- `AssetPickerModal` 过滤没有有效 URL 的图片占位卡；视频允许 `url` 或 `posterUrl` 任一存在，音频不误过滤。
- `Home` 常驻 `CreationPage`，切换页面不再卸载创作输入；发送和 Tab 切换不主动清空输入素材。
- 创作输入按图片、视频、配音分别保存草稿；参考素材补充 `_uid`，`@` 标签按唯一标识删除，避免同名素材误删。
- 创作历史图片用作参考图时按提示词生成文件名；图片/视频并发上限为 10，配音保持 5。

## 2026-07-21 剧本页新创作入口

- 剧本创作消息区已接入工作区持久化消息：用户消息和 AI 消息按顺序追加，流式助手消息实时更新，刷新后从工作区恢复。
- 消息区创作阶段替代剧本主展示区；发生暂停、超时或网络错误时保留对话记录和已收到的助手正文，原剧本编辑、保存定稿和主体提取入口仍可通过查看剧本进入。
- 聊天接口已适配 `episode_count` 和 `episode_duration_seconds`，单集时长为自动适应时不传数值。
- 已删除剧本输入的本地最多 10 条历史缓存及方向键回溯逻辑；仅保留当前未发送文本的超时恢复。
- 剧本页初始空态已改为剧本模式、分镜脚本和 AI 直接创作三种入口，内容区背景使用 `dark_bg`（`#060606`）。
- 剧本模式继续复用现有格式校验、10MB 限制和 `apiUploadScriptWorkspace` 解析流程；分镜脚本仅允许 `.xlsx`，本阶段只保存本地选择状态。
- 输入卡已移除上传入口和文件草稿恢复，新增默认 `60s` 的单集时长选择（15/30/60/90/120 秒），文本发送、流式生成、暂停和恢复流程保持原有边界。
- 新增可下载的 `public/分镜模板.xlsx`。分镜解析、后端上传、分镜页面跳转和模板字段协议暂未纳入本阶段。
- 剧本页左侧“剧集结构”导航已移除；`apiGetEpisodes`、定稿后的剧集刷新和 `onEpisodesChange` 数据同步仍保留，供项目级剧集状态使用。
- 剧本页“确认初稿，进入剧本编排”已接入 `/script-workspace/confirm`，通过 `task_id` 轮询 `/script-workspace/tasks/{task_id}`，完成后从 `/script-workspace/structure` 读取结构化内容。
- 编排态使用后端结构数据展示整体设定、剧本设计、角色/场景/道具和分集剧本；进入后消息区与输入卡卸载，不提供返回对话页入口。
- 编排页异步解析期间展示骨架和左向右扫光加载反馈；“下一步：生成主体”仍沿用现有主体流程边界。
- 确认初稿使用工作区 `script.draft_revision` 作为并发版本，并带幂等请求头；初始化不再自动调用旧 `finalize`，避免先改写草稿版本造成 409。
- `STRUCTURE_NOT_FOUND` 仅表示结构化草稿尚未生成，已与其他 404 分开处理；版本冲突会明确提示重新加载，不会无限重试确认。
- 编排页分集剧情改为后端结构数据驱动：分集胶囊支持 AI 重新分集，当前集支持 AI 重写、结构保存和删除；编辑态仅在当前集剧情区域复用富文本编辑器，其他编排区域不挂载该编辑器。
- AI 重新分集已改为独立业务弹窗：当前集数和分集逻辑复用 `TextField`，目标集数复用 `Tabs` 的 `resplit` 变体；通过 `/script-workspace/structure/resplit` 提交并轮询异步任务，自适应目标集数传 `null`，失败时保留弹窗。
- 主体解锁后剧本编排页隐藏分集修改操作，并提供“下载剧本 / 修改剧本”；修改剧本需通过独立二次确认弹窗，确认后恢复剧本修改操作并重新显示“下一步：生成主体”。下载会读取最新结构化分集，按顺序合并为一个 Markdown 文件；待后端提供剧本专用导出接口后再切换为服务端下载。
