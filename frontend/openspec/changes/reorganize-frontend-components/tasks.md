## 1. 盘点与基线

- [x] 1.1 建立 `docs/refactor/component-inventory.md`，记录页面/组件行数、原生按钮、Button-like 组件、弹窗和页面内局部组件数量
- [x] 1.2 为 `ProjectList` 和 `GlobalSettings` 建立按钮、弹窗、接口调用和关键交互清单，选择一个作为样板页并记录选择理由
- [x] 1.3 记录当前构建、Lint 和现有页面关键流程基线，明确本次迁移不得改变的行为

## 2. 架构规则与目录

- [x] 2.1 创建 `src/components/ui/` 目录及统一导出入口；`feedback/`、`overlay/`、`actions/` 在需要对应能力时按同一分层规则创建
- [x] 2.2 创建 `docs/architecture/component-architecture.md`，定义组件分层、页面职责、状态边界和依赖方向
- [x] 2.3 创建 `docs/architecture/import-rules.md`，明确基础组件、业务组件、页面、Hook、Store 和 API 的可引用关系
- [x] 2.4 创建 `docs/refactor/migration-guide.md`，定义单页面迁移步骤、行为保持、验收和记录格式
- [x] 2.5 重写项目总规则、页面/API/设计系统专项规则、组件/页面/状态/导入架构规则，并让各层 `AGENTS.md` 与 `CLAUDE.md` 完全一致

## 3. 基础按钮系统

- [x] 3.1 实现无业务依赖的 `Button`，支持 Accent、Primary、Secondary、Danger 变体及 Large、Small 尺寸
- [x] 3.2 实现 `IconButton`、`TextButton` 和 `ButtonGroup`，复用 Button 的状态和 Token 规则
- [x] 3.3 覆盖按钮图标、禁用、加载、键盘操作和 aria 标签等通用行为
- [x] 3.4 将 `ButtonShowcase` 适配为真实 `Button` 组件，并按 `design-system/components/button.md` 校准变体、尺寸、图标、禁用和加载状态
- [x] 3.5 搜索并标记页面中可迁移的原生 `<button>` 和重复按钮实现，禁止在迁移期间新增同类重复样式

## 4. 架构自动检查

- [x] 4.1 创建 `scripts/check-architecture.mjs`，检查页面/组件命名和基础目录边界
- [x] 4.2 增加页面规模分级检查：旧页面告警、新页面硬阈值阻断、显式豁免需要原因
- [x] 4.3 增加基础 UI 反向依赖检查，禁止引用页面、业务 API 和业务 Store
- [x] 4.4 在 `package.json` 增加 `check:architecture` 脚本，并验证可脱离网络执行
- [x] 4.5 将架构检查接入迁移验收清单，与 `lint`、`build` 分开执行

## 5. 样板页迁移

- [x] 5.1 选择 `ProjectList` 为首个样板页，并在 `GlobalSettings` 完成封面上传按钮的局部迁移；未修改接口和业务数据
- [x] 5.2 将样板页入口收敛为页面级状态与业务区块编排，更新 `ProjectList`、`GlobalSettings` 文件顶部结构索引
- [x] 5.3 完成样板页构建、Lint、架构检查和关键交互回归，记录迁移前后差异（2026-07-17；样板页静态门禁通过，关键入口回归完成）
  - [x] 5.3.a 构建、架构检查和首页/项目页有限浏览器回归通过
  - [x] 5.3.b 完整 lint 已通过；样板页关键入口回归已记录，未将未授权外部副作用伪报通过（2026-07-17）
- [x] 5.4 根据样板页结果校准页面行数阈值、组件 API 和目录规则

## 6. 分阶段业务页面迁移

> 状态口径：6.2–6.5 的父任务表示“静态结构迁移和可安全抽离边界”已完成；登录态、测试数据和外部副作用流程仍由各自未勾选的运行时验收子任务表示，不因静态门禁通过而提前完成。

- [x] 6.1 迁移 `ScriptPage`，拆分剧本编辑、会话区、分集区和页面动作
  - [x] 6.1.a 抽离 `ScriptEditor`、`EditorToolbar` 和编辑器样式到 `src/components/script/`
  - [x] 6.1.b 保持 TipTap 配置、Markdown 内容回调、工具栏命令和容器 ref 行为不变
  - [x] 6.1.c 抽离 `EpisodeItem`、`EpisodeList` 分集导航业务组件
  - [x] 6.1.d 抽离 `InputCard` 及上传/模型/集数/发送/文件子组件
  - [x] 6.1.e 抽离 `ScriptEmptyState`，统一通过剧本组件入口引入
  - [x] 6.1.f 抽离 `AiThinkingMessage`、`AiStreamingContent`、`ScriptRendered` 和展示区域样式
  - [x] 6.1.g 抽离 `ScriptPanel`，保留编辑/定稿/取消/提取主体动作和回调边界
  - [x] 6.1.h 完成 `ScriptPage` 页面级结构回归：接口、状态、SSE、暂停、滚动和编辑行为保持不变
  - [x] 6.1.i 剧本普通主操作统一复用 `components/ui/Button`；保留分集导航、选择器选项和上传槽位等专用按钮交互
- [x] 6.2 完成 `SubjectPage` 首轮迁移收尾：主体列表、卡片、图片区、编辑区稳定子区块和页面编排已接入业务域组件
  - [x] 6.2.a 抽离 `SubjectGrid`，保留主体列表错误态、空态、分页哨兵和加载提示
  - [x] 6.2.b 抽离 `SubjectCard`、`SubjectMoreMenu`、`AddSubjectCard`，保留下载、删除确认、音色试听和选择回调
  - [x] 6.2.c 抽离 `SubjectImageList`、图片上传卡片、图片卡片和详情弹窗组合，保留上传、下载、定稿和 Toast 回调边界
- [x] 6.2.d 完成 `EditSubjectPanel` 可安全抽离的生成展示、参数适配和动作适配；页面级生成请求、模型加载、任务轮询和副作用按边界保留
  - [x] 6.2.d.1 抽离主体详情图片映射纯函数，页面保留任务缓存、状态更新和 API 边界
  - [x] 6.2.d.2 抽离参考图详情弹窗快照转换，页面保留参考图状态和组件回调
  - [x] 6.2.d.3 抽离主体生图参数组装纯函数，页面保留生成请求和任务轮询
  - [x] 6.2.d.4 抽离主体生图结果标准化与错误消息适配纯函数，统一同步、轮询和刷新恢复字段读取
  - [x] 6.2.d.5 抽离主体任务状态、终态与按主体结果读取适配纯函数，页面保留轮询循环和全部副作用
  - [x] 6.2.d.6 抽离主体图片上传、下载和定稿动作适配，页面保留状态、封面同步和 Toast
- [x] 6.2.e 完成主体页批量动作可安全抽离部分；工具栏和标签导航已抽离，批量生成编排与页面副作用按边界保留
  - [x] 6.2.e.1 抽离 `SubjectToolbar`，页面保留添加、批量生成和智能分镜业务回调
  - [x] 6.2.e.2 抽离 `SubjectTabs` 与 `SUBJECT_TABS`，页面保留 activeTab 和主体选择清理
- [x] 6.2.f 抽离批量生成弹窗内模型、比例、分辨率选择器，统一复用 `components/ui/Select`
- [x] 6.2.g 抽离 `EditSubjectPanel` 底部生成动作区，页面保留生成请求、任务轮询、缓存和 Toast 边界
- [x] 6.2.h 抽离 `EditSubjectPanel` 标题和关闭动作，页面保留遮罩关闭与面板生命周期
- [x] 6.2.i 抽离主体音色选择弹窗，性别和年龄选择器复用 `components/ui/Select`
  - [x] 6.2.j 完成 SubjectPage 收尾核对：无失效导入/未定义引用，图片动作链路和页面级副作用边界保持不变，结构索引与组件盘点已同步
  - [x] 6.2.k 主体普通主操作统一复用 `components/ui/Button`；确认弹窗、危险确认和提取失败重试已完成迁移
- [x] 6.3 完成 `AssetsPage` 静态迁移与本次纳入范围运行时验收：资产筛选、资产网格、详情/批量动作和弹窗组合已按边界拆分；音频播放/收藏按要求排除
  - [x] 6.3.a 抽离项目/创作资产标签栏和媒体空态
  - [x] 6.3.b 抽离项目/创作资产批量操作工具栏展示层
  - [x] 6.3.c 抽离项目列表项和更多菜单展示层，保留页面业务回调
  - [x] 6.3.d 抽离资产卡片和详情弹窗组合
    - [x] 6.3.d.1 抽离资产卡片媒体展示层、悬停播放、批量标记和收藏/更多操作展示；页面保留详情 API 与弹窗组合
    - [x] 6.3.d.2 抽离创作资产图片/视频详情弹窗组合；页面保留打开状态、业务回调和项目资产详情链路
    - [x] 6.3.d.3 抽离项目资产详情分支适配层；分镜、主体和普通图片详情弹窗本体暂由页面显式注入
    - [x] 6.3.d.4 抽离项目资产滚动内容、分页哨兵和加载提示展示层；页面保留筛选、分页状态、IntersectionObserver 和 API 请求
    - [x] 6.3.d.5 抽离 `SubjectAssetDetailModal`；主体详情弹窗通过目录入口导出，删除、下载、Toast 和关闭回调继续由页面显式注入
    - [x] 6.3.d.6 抽离 `AssetDetailModal`；普通图片详情弹窗通过目录入口导出，详情数据、下载和关闭回调继续由页面显式注入
    - [x] 6.3.d.7 抽离 `ShotDetailModal`；分镜图片详情弹窗通过目录入口导出，详情 API、下载、删除、Toast 和关闭回调继续由页面/适配层显式注入
    - [x] 6.3.d.8 抽离 `ShotVideoDetailModal`；分镜视频详情弹窗和 `VideoFrameThumbnail` 通过目录入口导出，视频交互由组件负责，API、下载、删除、Toast 和弹窗生命周期继续由页面/适配层显式注入
    - [x] 6.3.d.9 抽离 `AssetsAudioCard`；项目/创作资产音频卡片统一复用，页面继续显式传入批量、收藏、下载和删除回调
  - [x] 6.3.e 完成筛选、分页和批量业务动作的可安全抽离部分；API、IntersectionObserver 和业务副作用保留在面板
    - [x] 6.3.e.1 抽离 `useAssetFilter`、`useAssetPagination`、`useAssetSelection`；页面继续持有 API 请求、IntersectionObserver 和业务副作用
    - [x] 6.3.e.2 抽离 `assetsBatchAdapter`，统一项目资产分页键、主体类别、批量删除参数和下载队列转换
    - [x] 6.3.e.3 修复迁移后创作资产批量删除的 `ids` 失效引用，并完成定向引用搜索、构建和架构检查
  - [x] 6.3.e.4 完成 AssetsPage 卡片/详情组合收尾及登录态关键流程回归（用户确认非音频前端功能均通过；音频播放/收藏按要求不纳入本次重构）
    - [x] 6.3.e.4.a 完成非破坏性登录态验收：资产模块/分类切换、项目切换、批量模式、选择状态、详情打开/关闭、悬停操作、收藏切换、离开页面和刷新恢复
    - [x] 6.3.e.4.b 完成验收后的卡片职责复核；确认 `AssetCard` 与 `ProjectAssetCard` 当前不具备稳定且收益明确的进一步复用边界，暂不强拆
    - [x] 6.3.e.4.b.1 补充只读核对：项目资产全部分类切换、角色详情打开/关闭、创作图片详情打开/关闭、创作视频/配音空态和分页容器状态
    - [x] 6.3.e.4.c 用户确认 AssetsPage 非音频前端功能验证通过；创作配音卡片播放/收藏明确跳过，不作为本次前端重构验收项
    - [x] 6.3.e.4.d 用户确认 AssetsPage 其余前端功能验证通过且无页面级错误；音频功能不纳入本次前端重构范围
    - [x] 6.3.e.4.e 页面入口已收敛为模块切换和业务面板组合；修复 `useAssetSelection` 缺失引用并完成直接文件导入复核（2026-07-16）
    - [x] 6.3.e.4.f 抽离项目重命名/删除弹窗和项目资产卡片网格；项目 API、筛选分页和批量副作用仍保留在业务面板（2026-07-16）
- [x] 6.4 完成 `CreationPage` 静态迁移与运行时验收：创作工具栏、输入区、生成区、历史区和生成动作的可安全展示/适配边界已拆分，运行时验收按用户确认完成
  - [x] 6.4.a 抽离顶部 Tab、批量操作和清空历史展示层；页面保留 activeTab、批量选择、删除确认、下载和清空历史业务回调
  - [x] 6.4.b 拆分输入区稳定展示子区块，先不搬动生成请求和参数状态编排
    - [x] 6.4.b.1 抽离提示词编辑、占位提示、@素材菜单和已选素材卡片展示；页面保留编辑事件、素材状态和生成请求
    - [x] 6.4.b.2 抽离上传入口与文件卡片组合；继续由 InputCard 持有文件校验、AssetPickerModal 和引用状态
    - [x] 6.4.b.3 抽离 `useCreationPromptInteraction`，统一提示词编辑、@素材标签、粘贴、预填充和失败恢复边界
- [x] 6.4.c 抽离模型、比例、分辨率、数量等参数选择区；页面继续保留参数状态、模型加载和生成请求边界
  - [x] 6.4.c.1 抽离 `CreationParamsControls` 参数组合层
  - [x] 6.4.c.2 抽离生成类型、模型、图片参数、参考模式、视频参数和配音选择器视觉实现
  - [x] 6.4.d 创作页普通确认、保存、批量、清空和发送动作统一复用 `components/ui/Button`；保留 Tab、选择器选项、上传槽位和媒体专用交互
  - [x] 6.4.e 拆分创作页结果区与空态区
    - [x] 6.4.e.1 抽离 `CreationImageResultCard`，页面继续持有结果状态和业务动作回调
    - [x] 6.4.e.2 抽离 `CreationAudioResultCard`，保持播放、下载、删除和重新编辑回调边界
    - [x] 6.4.e.3 抽离 `CreationResultState`，结果列表、滚动加载和输入卡通过显式 props/渲染回调接入
  - [x] 6.4.e.4 抽离 `CreationEmptyState` 与空态图标，保持 `InputCard` 和页面生成编排边界
  - [x] 6.4.f 抽离 `CreationLiveMaterialModal` 真人素材弹窗；页面保留选择结果转换、生成请求和任务副作用
  - [x] 6.4.g 整理 `InputCard` 剩余弹窗接线与素材状态边界
    - [x] 6.4.g.1 整理 `AssetPickerModal` 资产选择弹窗接线，不改变预选、类型过滤、首尾帧目标清理和确认回调
    - [x] 6.4.g.2 整理 `DubbingVoiceModal` 配音选择弹窗接线，不改变音色加载、上传、试听和确认回调
    - [x] 6.4.g.3 提取文件类型、容量和模型素材上限适配纯函数，页面保留状态写入和 Toast 副作用
  - [x] 6.4.g.4 抽离 `useCreationInputFiles`，统一素材状态转换、模型上限裁剪和 Blob URL 生命周期；页面保留生成编排与业务副作用
  - [x] 6.4.g.5 抽离 `src/utils/creationHistoryAdapter.js`，统一历史响应解包、记录标准化和缓存载荷适配；页面保留历史 API、缓存、分页和 Store 副作用（2026-07-16）
  - [x] 6.4.g.6 抽离 `src/utils/creationTaskAdapter.js`，统一刷新任务快照、占位 generation 和轮询结果字段适配；页面保留轮询、Store、缓存、Toast 和生命周期副作用（2026-07-16）
  - [x] 6.4.h 完成 `InputCard` 参数状态 Hook 边界迁移；只迁移默认值、联动规则、参数状态和预填充回填，不移动生成 API、任务轮询、缓存、Toast 或 Store 写回
    - [x] 6.4.h.1 新增并接入 `useCreationParamsState`，管理图片/视频/配音参数状态及 `resetDubbingParams`
    - [x] 6.4.h.2 保持模型能力变化、比例/分辨率兼容联动、视频参考模式和预填充触发规则
    - [x] 6.4.h.3 完成定向 ESLint、构建、架构检查、差异检查和失效引用搜索；浏览器运行时验证另列为后续验收
  - [x] 6.4.i 清理 `CreationPage` 页面入口历史 ESLint 问题并同步真实结构索引；页面定向检查通过，未将全仓库历史 lint 误标为完成
  - [x] 6.4.i.1 抽离 `CreationLoginEmptyState` 未登录空态；页面仅通过显式 `onLoginClick` 接线，保留任务轮询、生成 API、Store、Toast、缓存和页面副作用（2026-07-16）
  - [x] 6.4.i.2 抽离 `CreationSendButton` 发送按钮；页面通过显式动作 props 接线，保留生成 API、任务轮询、缓存、Toast 和 Store 副作用（2026-07-16）
  - [x] 6.4.i.3 抽离 `CreationToast` Toast 展示层；页面通过 `toasts` props 接线，保留 Toast 状态、定时器和页面级副作用（2026-07-16）
  - [x] 6.4.i.4 抽离 `CreationInputSurface` 输入区视觉组合；通过五组显式配置接入上传、提示词、参数、发送和弹窗区域，保留 `InputCard` 状态/参数组装/失败恢复及页面 API、轮询、缓存、Toast、Store 副作用（2026-07-16）
  - [x] 6.4.i.5 抽离 `CreationPageOverlays` 页面确认弹窗和视频详情 Portal 组合；页面继续保留删除、清空历史、视频下载/删除/收藏副作用（2026-07-16）
  - [x] 6.4.i.6 抽离 `CreationInputCard` 至 `src/components/creation/`；页面通过 `renderInputCard` 显式接线，继续保留生成 API、任务轮询、缓存、Toast 和 Store 副作用（2026-07-16）
  - [x] 6.4.i.7 抽离 `useCreationGeneration` 至 `src/components/creation/`；页面通过显式参数接入，生成 API、占位/结果卡、Shot 更新和失败清理边界保持不变（2026-08-03）
- [x] 6.4.j 完成创作页运行时验收（2026-07-17；用户确认本次纳入范围全部通过）
  - 静态安全修复和纳入范围的运行时分支均已完成；不重复执行已确认通过的外部流程。
  - [x] 6.4.j.1 登录态安全验证模型切换、图片/视频/配音参数联动、视频参考模式交互和刷新后基础恢复；未触发真实生成接口（2026-07-17）
  - [x] 6.4.j.1.a 未登录基础运行复验：从首页进入创作页，验证图片/视频/配音 Tab、清空、批量操作、登录空态及登录弹窗打开/关闭；页面日志无页面级错误或警告，未触发外部副作用（2026-07-16）
    - [x] 6.4.j.1.b 复验清空确认框和批量操作进入/退出；未发现 CreationPage 页面级引用错误或控制台错误/警告（2026-07-16）
    - [x] 6.4.j.2 验证视频重新编辑参数回填；用户确认无问题（2026-07-17）
    - [x] 6.4.j.3 验证生成失败后的提示词、普通素材和首尾帧素材恢复；用户确认无问题（2026-07-17）
    - [x] 6.4.j.4 验证刷新后的任务恢复；用户确认无问题（2026-07-17）
      - [x] 6.4.j.4.a 修复未登录态任务快照边界：未登录不消费 `miioo_pending_tasks`，登录后才开始恢复（2026-07-16）
      - [x] 6.4.j.4.b 在安全登录态和测试任务下验证恢复成功、失败清理、异常提示和结果写回；用户确认无问题（2026-07-17）
    - [x] 6.4.j.5 验证生成后的配音参数自动重置；用户确认无问题（2026-07-17）
    - [x] 6.4.j.6 在安全测试条件具备后验证真实上传、生成、轮询和失败清理链路；用户确认无问题（2026-07-17）
- [x] 6.5 完成 `StoryboardPage` 静态迁移与运行时验收：分镜表格、镜头行、批量工具栏、媒体列和生成流程的可安全展示/适配边界已拆分，用户确认本次纳入范围全部通过
  - [x] 6.5.a 抽离镜头行组合展示层；页面继续持有上传 API、生成 API、任务轮询和持久化
    - [x] 6.5.a.1 抽离 `StoryboardShotRow` 行级拖拽、悬停、插入提示线和删除确认
    - [x] 6.5.a.2 通过显式上传回调移除行组件对页面 API 闭包的依赖
  - [x] 6.5.b 抽离媒体列展示组合；页面继续持有媒体上传、生成、任务轮询和缓存副作用
    - [x] 6.5.b.1 抽离 `MediaCol` 媒体卡片、详情弹窗、视频查看器和下载入口
    - [x] 6.5.b.2 抽离 `MediaColWrapper` 媒体列标题与布局容器
- [x] 6.5.c 拆分主体参考列和文本编辑列
  - [x] 6.5.c.1 抽离 `MainRefColWrapper`、`MainRefCol`、添加菜单和主体参考悬浮预览；页面保留上传 API、资产映射和 mainRefs 写回
  - [x] 6.5.c.2 抽离 `EditableText`、`TextEditCol`；画面描述、光影和环境音通过显式 props 复用文本编辑能力
  - [x] 6.5.c.3 分镜页普通批量、新增和重试动作统一复用 `components/ui/Button`；页面包装函数仅保留业务语义
- [x] 6.5.d 完成批量工具栏和生成面板组合的静态拆分；API、任务轮询和持久化副作用按边界保留
  - [x] 6.5.d.1 抽离 `GenerateImagePanel`；页面继续持有图片生成 API、任务轮询、持久化、状态写回和 Toast
  - [x] 6.5.d.2 抽离 `GenerateVideoPanel`；保持视频生成 API、任务轮询、持久化和参考素材参数边界
  - [x] 6.5.d.3 抽离 `VideoResultsPanel`；结果列表、上传卡片和视频结果卡片通过显式 props 接入，查看弹窗状态仍由视频面板持有
  - [x] 6.5.d.4 抽离 `ReferenceMediaEditor`；参考主体、参考图、参考视频、参考音频及首尾帧通过显式 props 接入，上传 API、生成参数和页面副作用仍保留在面板/页面边界内
  - [x] 6.5.d.5 抽离 `PanelPromptInput`、`ReferenceMentionDropdown` 和 `SubjectTag`；提示词编辑、提及交互、光标处理和展示态标签由组件内部维护
  - [x] 6.5.d.6 抽离 `PanelSelect`、`ModalSelectItem`；图片/视频生成面板直接引入，页面只保留参数值和变更回调
- [x] 6.5.e 拆分生成面板上传相关组件
  - [x] 6.5.e.1 `ImgUploadBtn`、`ImgUploadCard`、`ImgItem` 已位于 `StoryboardImageUpload.jsx`，保持图片文件校验、资产选择、预览、下载和定稿回调边界
  - [x] 6.5.e.2 抽离 `FrameUploadSlot` 至 `StoryboardUploadSlots.jsx`，保持首尾帧快捷入口、资产选择、上传、删除和悬浮预览行为
  - [x] 6.5.e.3 抽离 `PanelUploadSlot` 至 `StoryboardUploadSlots.jsx`，保持单媒体/多媒体模式、文件类型校验、资产选择、插入提示和悬浮预览行为
- [x] 6.5.f 抽离分镜任务读取适配工具 `src/utils/storyboardTaskAdapter.js`；页面继续保留轮询循环、状态更新、缓存、持久化、Toast 和分镜写回副作用
- [x] 6.5.g 完成 StoryboardPage 登录态关键流程回归（2026-07-17；用户确认所有分镜功能正常可用；音频播放/收藏按要求排除）
  - [x] 6.5.g.1 验证分镜数据加载、镜头字段展示、批量生成菜单及图片/视频生成面板打开与关闭
  - [x] 6.5.g.2 验证模型/分辨率选择器展开、选项切换、当前值回显和收起
  - [x] 6.5.g.3 验证刷新后的分镜数据恢复，并检查无页面级未定义引用、解析错误或控制台错误/警告
  - [x] 6.5.g.4 用户完成分镜图/视频弹窗最终手动验证：本地上传、资产库选择、上传入口样式、模型/分辨率选择器、参考视频/音频最多 3 个入口限制及其他分镜功能均通过；音频播放/收藏不属于本次重构范围
- [x] 6.5.h 抽离 `ShotNumberColumn`、`CardActionBtn` 和镜头编号列图标；页面继续通过显式回调接入镜头新增、复制、选择、拖拽和删除语义（2026-07-16）
- [x] 6.6 已持续同步迁移页面的组件资产清单、结构索引和文档状态；未验证业务边界单独保留
  - [x] 6.6.l 已同步 Home 底部菜单组合迁移、当前实际行数 `1954`、架构统计 `1955`、结构索引和下一步浏览器复验边界（2026-07-16）
  - [x] 6.6.m 已同步 Home 底部菜单未登录浏览器复验、二维码/水印设置结果和 `401` 未登录限制（2026-07-16）
  - [x] 6.6.a 已同步 AssetsPage 登录态非破坏性验收、卡片职责复核、未覆盖边界和下一步（2026-07-16）
  - [x] 6.6.b 已同步 StoryboardPage 登录态非破坏性验收、媒体结果补充验收、未覆盖边界和下一步（2026-07-16）
  - [x] 6.6.c 已补充 AssetsPage 只读分类/详情/空态/分页边界验收，并同步 PROJECT.md 与组件清单（2026-07-16）
  - [x] 6.6.d 已按当前实际行数同步 PROJECT.md、组件清单和本任务清单；同步当前验收顺序与未验证边界（2026-07-16）
  - [x] 6.6.e 已复核 `CreationPage` 当前实际行数为 1584、架构统计为 1585，并同步结构索引、PROJECT.md、组件清单和本任务清单；未登录任务恢复边界、未登录空态、发送按钮拆分、Toast 拆分、输入区视觉组合拆分、重复确认弹窗清理、静态门禁和未登录基础运行验收已完成（2026-07-16）
  - [x] 6.6.f 已同步 Home 标语/开始创作按钮迁移、实际行数、结构索引、组件清单和 PROJECT.md；首页业务副作用边界保持不变（2026-07-16）
  - [x] 6.6.g 已同步 CreationPage 页面遮罩组合迁移、实际行数、结构索引、组件清单和 PROJECT.md；登录态外部副作用流程仍保持未验证（2026-07-16）
  - [x] 6.6.h 已复核 CreationPage 当前实际行数为 1557、架构统计为 1558，并修正结构索引及受影响进度文档中的旧行数；静态门禁仍全部通过（2026-07-16）
  - [x] 6.6.i 已同步 CreationPage 未登录基础运行复验、当前登录态限制和未验证边界；未将未登录渲染通过误标为登录态业务流程完成（2026-07-16）
  - [x] 6.6.j 已同步 `CreationInputCard` 迁移、页面当前实际行数 `1106`、架构统计 `1107`、结构索引和未验证业务边界；未将静态拆分误标为真实生成流程完成（2026-07-16）
  - [x] 6.6.k 已同步 CreationPage 未登录基础运行复验、当前实际行数 `1093`、架构统计 `1094`、结构索引和剩余业务回归边界（2026-07-16）
  - [x] 6.6.ad 已同步 CreationPage 视频详情适配纯函数迁移、当前实际行数 `1072`、架构统计 `1073`、结构索引和业务回归未验证边界（2026-07-16）
  - [x] 6.6.ae 已复用 `creationDetailAdapter` 统一 `CreationResultState` 视频重新编辑的详情素材字段转换；静态门禁通过，登录态回归仍待安全条件（2026-07-16）
  - [x] 6.6.af 已统一 CreationPage 结果区与空态的 `onBeforeModelOpen` / `renderInputCard` 显式接线；当前实际行数 `1080`、架构统计 `1081`，静态门禁通过（2026-07-16）
  - [x] 6.6.ag 已抽离 `CreationResultState` 视频重新编辑预填充适配；`creationDetailAdapter` 统一参考素材和参数回填，静态门禁通过，登录态回归仍待安全条件（2026-07-16）
  - [x] 6.6.ah 已统一 `CreationResultState` 图片重新编辑与用作参考图的回填适配；静态门禁通过，登录态回归仍待安全条件（2026-07-16）
  - [x] 6.6.ai 已抽离尾帧 Blob 转首帧预填充适配；组件保留 API、Toast 和状态边界，静态门禁通过（2026-07-16）

> 进度说明：6.1–6.5 的安全静态拆分范围已完成，6.6 已同步所有迁移页面的最新组件边界与结构索引；StoryboardPage 最终手动验证已由用户确认通过，AssetsPage 音频播放/收藏按要求排除。页面入口仍保留认证、API、任务轮询、缓存、Toast、Store 写回和外部副作用；缺少测试对象或未单独授权的流程继续标记为未验证，不再为了压缩行数强拆页面副作用。

## 7. 收尾与文档同步

- [x] 7.1 使用文档同步流程检查 AGENTS.md、CLAUDE.md、PROJECT.md、README.md 和 docs/ 的路径、命令及进度是否真实（2026-07-15）
- [x] 7.2 清理已废弃的重复基础按钮实现、无效迁移记录和历史备份：创作结果卡片的重复 `CardActionBtn` 已统一为 `CreationCardActionButton`；已删除无引用的 `src/components/LoginModal.jsx.bak`（2026-07-17）
- [x] 7.3.g 将规则文档镜像一致性和页面结构索引占位符纳入 `check:architecture`；当前扫描通过（2026-07-17）
- [x] 7.3.f 将页面/组件/Hook 规模警告线接入 `check:architecture`（页面 300、通用 UI 250、业务区块 400、Hook 300）；告警不阻断，作为后续迁移排序依据（2026-07-17）
- [x] 7.3.e 扩展 `check:architecture` 的导入边界检查：API、ui、反馈/遮罩/动作组件和业务组件的非法反向依赖均纳入阻断级检查，当前扫描通过（2026-07-17）
- [x] 7.3 执行收尾验收命令并保存结果（2026-07-16）
  - [x] 7.3.a `npm run lint` 通过，当前全仓库无错误、无警告
  - [x] 7.3.b `npm run build` 通过；最大 JavaScript 分块约 `441KB`，无超过 `500KB` 告警
  - [x] 7.3.c `npm run check:architecture` 通过；仅保留历史页面规模告警，无阻断级违规
  - [x] 7.3.d `git diff --check` 通过；无空白错误
- [x] 7.4 复核所有迁移页面的关键用户流程，确认无接口、视觉和行为回归（2026-07-17；用户确认本次纳入范围的运行时验收全部通过）
  - [x] 7.4.a.1 补充未登录入口复验：首页头部动作、登录弹窗、资产页分类/媒体 Tab 和创作页图片/视频/配音 Tab 均正常；未触发外部副作用（2026-07-17）
  - [x] 7.4.a.2 补充项目页未登录入口复验：项目导航、搜索框和新建项目入口正常渲染；未触发项目创建、重命名或删除副作用（2026-07-17）

  - [x] 7.4.a 完成首页、项目页入口、懒加载和登录弹窗的有限回归
  - [x] 7.4.b 完成需登录/后端接口支持的本次纳入范围业务流程回归；音频播放/收藏按用户要求排除（2026-07-17）
- [x] 7.5 完成 OpenSpec 变更归档前审查；本次重构纳入范围已完成，音频播放/收藏为明确排除项（2026-07-17）
- [x] 7.6 迁移旧版 `解决方案.md` 中与当前重构结构相关的创作页 Bug 修复：资产选择器占位卡过滤、输入草稿保留、参考素材唯一标识、历史图片参考图命名和并发上限（2026-07-17）

> 2026-07-17 文档整理结果：规则文档已从“建议集合”重写为项目总规则、专项规则、架构规则和可执行检查四层；当前可安全静态拆分范围及本次纳入范围的运行时验收均已完成并记录。页面 300 行、通用 UI 250 行、业务区块 400 行、Hook 300 行、单函数 50 行均定义为警告线，不作为当前无条件阻断。音频播放/收藏是用户明确排除项，不影响本次前端重构完成结论。

  - [x] 6.6.n 已迁移 Home `CreationManualButton` / `LoginButton` 至 `src/components/home/HomeHeaderActions.jsx`，通过显式回调接入；后续已完成 `WorkflowHeadbar` 迁移，静态门禁通过（2026-07-16）
  - [x] 6.6.o 已迁移 Home `WorkflowStepTabs` 与 `STEP_TABS` 配置至 `src/components/home/WorkflowStepTabs.jsx`，页面通过显式 props 接入，静态门禁通过（2026-07-16）
  - [x] 6.6.p 已迁移 Home `WorkflowHeadbar` 至 `src/components/home/WorkflowHeadbar.jsx`，认证和工作流回调均通过显式 props 传递，静态门禁通过（2026-07-16）
  - [x] 6.6.q 已迁移 SubjectPage `ConfirmStoryboardModal` 至 `src/components/subject/ConfirmStoryboardModal.jsx`，页面通过显式回调接入，静态门禁通过（2026-07-16）
  - [x] 6.6.r 已迁移 StoryboardPage `EpisodeSelector`、`ModalCloseBtn` 和选集工具函数至 `components/storyboard/StoryboardControls.jsx` / `storyboardControlUtils.js`，静态门禁通过（2026-07-16）
  - [x] 6.6.s 已迁移 StoryboardPage `CharTag` / `AddSlotBtn` 至 `components/storyboard/NarrationAtoms.jsx`，通过显式回调接入，静态门禁通过（2026-07-16）
  - [x] 6.6.t 已迁移 StoryboardPage `NarrationItem` / `AddNarrationBtn` / `VoiceDubModal` 至 `components/storyboard`，旁白状态和保存副作用仍由页面持有，静态门禁通过（2026-07-16）
  - [x] 6.6.u 已迁移 StoryboardPage `ParamSelect` / `ParamTrigger` / `DescriptionCol` 至 `components/storyboard/DescriptionCol.jsx`，镜头状态通过显式回调写回，静态门禁通过（2026-07-16）
  - [x] 6.6.v 已迁移 Home `ApiConfigBubble` 至 `components/home/ApiConfigBubble.jsx`；页面继续负责显示条件、底部导航和 API 配置弹窗副作用，静态门禁通过（2026-07-16）
  - [x] 6.6.w 已迁移 Home `HomeToast` 至 `components/home/HomeToast.jsx`；页面继续持有 Toast 状态、定时器和触发逻辑，静态门禁通过（2026-07-16）
  - [x] 6.6.x 已迁移 SubjectPage `SubjectToast` 至 `components/subject/SubjectToast.jsx`；主体页和编辑面板继续持有 Toast 状态、定时器和业务触发逻辑，静态门禁通过（2026-07-16）
  - [x] 6.6.y 已迁移 SubjectPage `SubjectEmptyIcons` 至 `components/subject/SubjectEmptyIcons.jsx`；页面通过显式 `emptyIcons` 接入，列表状态和业务副作用保持在页面，静态门禁通过（2026-07-16）
  - [x] 6.6.z 已迁移 SubjectPage `SubjectExtractionState` 至 `components/subject/SubjectExtractionState.jsx`；页面继续持有提取状态和业务回调，静态门禁通过（2026-07-16）
  - [x] 6.6.aa 已新增 `SubjectEditorSlot` 统一角色/场景/道具编辑面板接线；页面继续持有列表写回和 API/副作用回调，静态门禁通过（2026-07-16）
  - [x] 6.6.ab 已完成页面静态收尾审计：当前行数、旧定义、导入/导出和已知引用风险已复核；真实业务回归仍按安全条件单独记录（2026-07-16）
  - [x] 6.6.ac 已复验 Home 顶部动作组件与 `WorkflowHeadbar` 的旧定义、导入/导出、显式回调和静态门禁；未发现引用缺失，真实登录态业务回归仍待安全条件（2026-07-16）

  - [x] 6.6.aj 复验 `CreationManualButton` / `LoginButton`：唯一实现、目录导出、Home 与 `WorkflowHeadbar` 显式接线均正常，未发现引用缺失；定向与全量静态门禁通过（2026-07-16）

  - [x] 6.6.ak 已将 StoryboardPage `NarrationCol` / `NarrationColWrapper` 迁移至 `src/components/storyboard/NarrationCol.jsx`；旁白编辑状态、音色保存和弹窗状态保留在业务组件，页面仅保留镜头数据写回，静态门禁通过（2026-07-16）

  - [x] 6.6.al 已将 StoryboardPage `RefSlotBtn` / `IconPlus` 迁移至 `src/components/storyboard/StoryboardActionPrimitives.jsx`；生成面板和页面通过显式 props/导入复用，静态门禁通过（2026-07-16）

  - [x] 6.6.am 已将 StoryboardPage `subjectTypeFromCategory` / `buildStoryboardRefFromAsset` 迁移至 `src/utils/storyboardReferenceAdapter.js`；页面和生成面板保持显式适配函数接线，静态门禁通过（2026-07-16）

  - [x] 6.6.an 已将 StoryboardPage `buildPromptFromShot` 迁移至 `src/utils/buildStoryboardPrompt.js`；图片/视频生成面板通过显式提示词适配 props 接入，静态门禁通过（2026-07-16）

  - [x] 6.6.ao 已将 Home `normalizeSubjects` 迁移至 `src/utils/subjectAdapter.js`；主体缓存、分页和状态写回仍由页面持有，静态门禁通过（2026-07-16）

  - [x] 6.6.ap 已将 Home 项目列表字段兼容和排序迁移至 `src/utils/projectAdapter.js`；鉴权、导航、缓存和项目状态副作用仍由页面持有，静态门禁通过（2026-07-16）

  - [x] 6.6.aq 已将 Home 剧集状态映射迁移至 `src/utils/episodeStatusAdapter.js`；概览优先级、状态回退和页面写回边界保持不变，静态门禁通过（2026-07-16）

  - [x] 6.6.ar 已将 SubjectPage `getPendingGenResult` 迁移至 `src/utils/subjectPendingGenerationAdapter.js`；任务轮询、pending 持久化和主体状态写回边界保持不变，静态门禁通过（2026-07-16）

  - [x] 6.6.as 已将 SubjectPage `getPendingGenTabSetter` / `defaultPromptForTab` 迁移至 `src/utils/subjectPendingGenerationAdapter.js`；页面保留状态写回、详情加载和任务恢复副作用，静态门禁通过（2026-07-16）

  - [x] 6.6.at 已将 SubjectPage 面板会话缓存和 pending 生图任务持久化桥接迁移至 `src/utils/subjectPanelStorage.js` / `subjectPendingGenerationStore.js`；页面保留轮询、结果识别和状态写回，静态门禁通过（2026-07-16）

  - [x] 6.6.au 已将 StoryboardPage `normalizeStoryboard` / `toBackendStoryboard` / `urlPathKey` / `enrichMainRefs` 迁移至 `src/utils/storyboardDataAdapter.js`；页面保留 API、任务轮询、缓存和状态写回，静态门禁通过（2026-07-16）

  - [x] 6.6.av 已将 Home `NAV_ITEMS` / `BOTTOM_NAV_ITEMS` 静态配置迁移至 `src/components/home/HomeNavigationConfig.jsx`；页面保留导航状态、动态 popup/bubble 和副作用，静态门禁通过（2026-07-16）

  - [x] 6.6.aw 已将 StoryboardPage `makeStoryboardShot` 迁移至 `src/utils/storyboardDataAdapter.js`；页面保留新增/复制镜头 API 和状态写回，静态门禁通过（2026-07-16）

  - [x] 6.6.ax 已将 CreationPage 及三个 Creation 结果卡的 `filenameFromPrompt` 统一迁移至 `src/utils/creationFilename.js`；页面/结果卡继续保留下载副作用，旧重复定义已清理，静态门禁通过（2026-07-16）
  - [x] 6.6.ay 已将 Home 顶部完整品牌 Logo SVG 迁移至 `src/components/home/HomeLogo.jsx`；页面继续负责 activeKey 判断和返回首页状态变更，静态门禁通过（2026-07-16）
  - [x] 6.6.az 已将 Home 背景视频、径向遮罩和非首页底色迁移至 `src/components/home/HomeBackground.jsx`；页面继续负责视频索引切换和导航副作用，静态门禁通过（2026-07-16）
  - [x] 6.6.ba 已将 Home 无项目头部的 Logo、创作手册、账户菜单和登录入口迁移至 `src/components/home/HomeHeader.jsx`；认证判断、用户资料和业务回调仍由页面显式传入，静态门禁通过（2026-07-16）
  - [x] 6.6.bb 已将 SubjectPage 页面内 `normalizeSubjectList` 统一复用至 `src/utils/subjectAdapter.js`；Home/SubjectPage 共用纯字段归一化和排序逻辑，静态门禁通过（2026-07-16）
  - [x] 6.6.bc 已将 StoryboardPage 初始缓存、API 响应和缓存订阅中的重复列表归一化统一迁移为 `src/utils/storyboardDataAdapter.js` 的 `normalizeStoryboardList`；页面继续保留 API、缓存和状态写回副作用，静态门禁通过（2026-07-16）
  - [x] 6.6.bd 已将 SubjectPage / StoryboardPage 重复 Blob 下载生命周期统一迁移至 `src/utils/downloadBlob.js`；页面继续保留业务文件名、API 和 Toast 副作用，静态门禁通过（2026-07-16）
  - [x] 6.6.be 已将 SubjectPage 主体图片模型响应转换迁移至 `src/components/subject/SubjectModelAdapter.js`；页面继续负责 API、fallback、默认选择和能力联动，静态门禁通过（2026-07-16）
  - [x] 6.6.bf 已将 Home 顶部动作按钮重复的 hover/pressed 指针状态抽为 `src/hooks/useHoverPressState.js`；`CreationManualButton` / `LoginButton` 保持视觉结构和显式回调契约，静态门禁通过（2026-07-17）

  - [x] 6.6.bg 已将 CreationPage 主体卡片、工具栏和结果/空态分支迁移至 `src/components/creation/CreationWorkspace.jsx`；页面继续持有 API、任务轮询、缓存、Store 写回和外部副作用，完成导入/导出与静态门禁复核（2026-07-17）
  - [x] 6.6.bh 已将 CreationPage 及三个 Creation 结果卡的媒体 URL 下载生命周期统一至 `src/utils/downloadMediaUrl.js`；文件名、触发时机和失败回退契约保持不变，静态门禁通过（2026-07-17）
  - [x] 6.6.bi 已将 `AssetsProjectPanel.jsx` 的 Blob 下载生命周期统一复用 `src/utils/downloadBlob.js`；资产 API、文件名和批量下载编排保持在业务面板，静态门禁通过（2026-07-17）
  - [x] 6.6.bj 已将 StoryboardPage 图片/视频生成入口重复的参考图绝对 URL 转换与 AVIF/派生资产过滤统一至 `toSafeStoryboardReferenceUrls`；页面继续持有生成 API、任务轮询和状态写回，静态门禁通过（2026-07-17）
  - [x] 6.6.bk 已将 Storyboard 图片/视频生成面板及批量生成弹窗的模型列表适配统一至 `src/utils/storyboardModelAdapter.js`；API、选择状态和参数联动边界保持不变，静态门禁通过（2026-07-17）
  - [x] 6.6.bl 已将 SubjectPage 图片模型 fallback 配置迁移至 `getFallbackSubjectImageModels`；页面保留 API、默认选择和能力联动，静态门禁通过（2026-07-17）
  - [x] 6.6.bm 已将 SubjectPage 重复的生成图片条目构造统一至 `createSubjectImageItem`；缓存、轮询、状态写回和封面副作用保持在页面，静态门禁通过（2026-07-17）

  - [x] 6.6.bn 已完成 CreationPage 静态边界审计与 Home 顶部按钮复验：确认 `CreationWorkspace`、输入区、结果/空态区、遮罩组合和纯适配工具已覆盖当前安全拆分范围；完整 lint、构建、架构检查和差异检查通过。后续不再为压缩行数搬迁页面 API、任务轮询、缓存、Toast、Store 写回或外部副作用，转入安全登录态业务回归准备（2026-07-17）

  - [x] 6.6.bo 已将 Home 主导航与底部快捷导航布局迁移至 `src/components/home/HomeNavigationRail.jsx`；页面继续持有导航状态、动态配置和导航副作用，组件通过显式 props 接入；更新结构索引和当前行数，静态门禁待本轮复核（2026-07-17）

  - [x] 6.6.bp 已将 StoryboardPage 末尾 Toast Portal 展示迁移至 `src/components/storyboard/StoryboardToast.jsx`，复用 `HomeToast` 的视觉实现；页面继续持有 toast 状态、定时器触发和业务错误处理，定向引用检查通过（2026-07-17）

  - [x] 6.6.bq 已将 StoryboardPage 顶部项目/选集头部、后台生成提示、批量工具栏和分镜计数迁移至 `src/components/storyboard/StoryboardHeader.jsx`；页面通过显式 props 保留选集、批量动作和任务副作用（2026-07-17）

  - [x] 6.6.br 已将 SubjectPage 主体列表滚动视口和 `SubjectGrid` 布局接线迁移至 `src/components/subject/SubjectGridViewport.jsx`；页面继续持有列表状态、分页 sentinel、选择、删除、下载、音色和编辑面板业务回调（2026-07-17）

  - [x] 6.6.bs 已将 SubjectPage 工作区外框、工具栏、标签和主体网格组合迁移至 `src/components/subject/SubjectWorkspace.jsx`；编辑面板、弹窗、API、任务轮询、缓存、Toast 和状态写回仍由页面负责（2026-07-17）

  - [x] 6.6.bt 已完成 SubjectPage 工作区静态收尾审计：`SubjectWorkspace`、`SubjectGridViewport`、主体卡片/编辑区/弹窗和纯适配边界已覆盖当前安全拆分范围；完整 lint、构建、架构检查和差异检查通过。下一步转入安全登录态业务回归，不再为压缩行数搬迁页面级副作用（2026-07-17）

  - [x] 6.6.bu 已同步 2026-07-17 AssetsPage/StoryboardPage 只读回归结果、音频功能延期决定、当前规模告警和静态门禁结果；未将无可见音频卡片或空分类误标为播放/收藏通过。
  - [x] 6.6.bv 已复核当前静态门禁：`npm run lint`、`npm run build`、`npm run check:architecture`、`git diff --check` 均通过；架构规模告警保持非阻断，未继续为压缩行数搬迁页面副作用。

> 最新进度（2026-07-17）：CreationPage 运行时项按用户确认完成；AssetsPage 和 StoryboardPage 的主要只读/非破坏性流程已复验。音频播放/收藏、分页真实触发及上传/下载/删除/生成/定稿/配音等外部副作用仍按测试对象和明确授权逐项推进，完成前不归档 OpenSpec。


  - [x] 6.6.bw 已抽离 `SubjectEditForm`，统一主体编辑面板左侧文本、模型/比例/分辨率、参考图和生图模式组合；页面继续保留状态、API、任务轮询、缓存、Toast 和图片副作用（2026-07-17）


  - [x] 6.6.bx 已新增通用 `TextField` 与 `FileUploadButton`；SubjectTextFields 和 RefImageField 完成基础 UI 复用，主体 API、状态同步、资产选择和绑定逻辑保持原边界（2026-07-17）


  - [x] 6.6.by 已将 `RefImageItem`、`RefImageUploadCard` 从 `RefImageField` 拆为独立主体域组件；组件仅接收展示数据和回调，参考图 API、资产选择、绑定、删除和状态同步仍由 `RefImageField` 负责（2026-07-17）


  - [x] 6.6.bz 已统一 SubjectImageList、StoryboardImageUpload 及 StoryboardUploadSlots 的上传按钮视觉基础；新增 PanelPromptConstants/PanelPromptPrimitives，抽离 PanelPromptInput 纯展示区块，未移动上传 API、文件校验或提示词编辑状态（2026-07-17）


  - [x] 6.6.ca 已抽离 `ReferenceMentionDropdown`；保留 Portal 定位、筛选和关闭行为，PanelPromptInput 继续持有 contentEditable、光标、提及插入和 value 同步（2026-07-17）


  - [x] 6.6.cb 已抽离 `GenerationParamsFields`，统一 GenerateImagePanel/GenerateVideoPanel 的模型、时长、分辨率选择器组合；模型加载、能力联动、生成 API、任务轮询和 Toast 边界保持在原面板（2026-07-17）


  - [x] 6.6.cc 已抽离 GenerateImagePanel 的 `ReferenceImageField` 纯展示组合；图片参考图状态、文件校验、上传/资产选择处理、生成 API 和结果写回仍由原面板负责（2026-07-17）


  - [x] 6.6.cd 已抽离 GenerateVideoPanel 的 `VideoGenerationTabs` 与 `VideoSoundToggle`；视频模型/参数联动、参考素材、生成 API、任务轮询和结果状态保持在原面板（2026-07-17）


  - [x] 6.6.ce 已抽离 StoryboardUploadSlots 的媒体展示基础组件 `MediaContent`、`MediaRemoveButton`、`ShortcutMediaCard`；文件校验、上传 API、资产选择和上层状态回调保持原边界（2026-07-17）


  - [x] 6.6.cf 已抽离并复用 `GenerationSubmitButton`，统一图片/视频生成面板提交按钮视觉；生成参数、handleGenerate、API、任务轮询、Toast 和结果状态保持原边界（2026-07-17）

  - [x] 6.6.cg 已将 `VideoResultsPanel` 的视频上传占位卡片拆分为 `VideoUploadCard`；组件仅处理本地文件选择、资产库选择和视觉状态，上传 API、资产转换、结果列表写回、定稿和 Toast 仍由 `VideoResultsPanel` 负责；未执行真实视频上传（2026-07-17）

  - [x] 6.6.ch 已将 `VideoResultsPanel` 的视频结果卡片拆分为 `VideoResultCard`；组件只负责视频展示、加载态、定稿控件和回调透传，结果列表写回、定稿/查看/下载副作用仍由 `VideoResultsPanel` 负责；未执行真实下载或定稿（2026-07-17）

  - [x] 6.6.ci 已将 `GenerateImagePanel` 的图片结果卡片拆分为 `ImageResultCard`；组件仅负责图片展示、加载态、定稿控件和回调透传，结果列表写回、详情弹窗、定稿/下载副作用仍由 `GenerateImagePanel` 负责；未执行真实下载或定稿（2026-07-17）

  - [x] 6.6.cj 已完成生成面板结果展示静态收尾：`ImageResultCard`、`VideoUploadCard`、`VideoResultCard` 均通过业务域入口导出；旧 `ImgItem`/`VideoItem` 实现和页面级上传卡片引用已清理，API、轮询、结果写回、详情弹窗、下载、定稿和 Toast 副作用未下沉（2026-07-17）

  - [x] 6.6.ck 已完成 StoryboardPage P0 候选媒体适配拆分：新增 `src/utils/storyboardCandidateAdapter.js`，承载候选媒体字段、生成参数和保存结果归一化；页面继续持有候选 API、状态写回、定稿映射和错误处理（2026-08-03）

  - [x] 6.6.cl 已完成 StoryboardPage P1/P2 拆分：新增 `StoryboardLoadingState.jsx` 承载全屏生成加载态，新增 `storyboardShotUtils.js` 承载镜头插入、删除、拖拽排序和连续编号纯函数；页面继续持有加载判断、API、状态写回和排序副作用（2026-08-03）

  - [x] 6.6.cm 已完成 StoryboardPage P3 跨刷新任务恢复拆分：新增 `useStoryboardTaskRecovery.js`，通过显式回调承载分镜、图片和视频任务恢复流程；页面继续持有轮询函数、恢复结果写回、缓存和 API 副作用（2026-08-03）
  - [x] 6.6.cn 已同步 StoryboardPage P0-P3 拆分、当前实际行数 `2133`、React ESLint 修复和页面级副作用保留边界；定向 lint、全量 lint、构建、架构检查和差异检查通过，规模提醒不构成阻断（2026-08-03）
