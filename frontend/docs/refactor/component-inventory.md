# 组件重构盘点基线

> 盘点日期：2026-07-17（最终手动验收与 OpenSpec 收尾审查）
> 分支：`feat/frontend_V1.1`
> 目的：为组件抽离和页面迁移提供可复查基线，不代表本文件中的数量永久不变。

## 2026-07-21 GlobalSettings 剧本进度区块

- 新增 `src/components/project/ScriptProgress.jsx`，负责项目总览“资产概况”中的剧本进度容器、集数标题和空态展示。
- 新增 `src/components/project/ScriptProgressCard.jsx`，负责单集卡片和四种状态视觉：未分镜、已分镜、剪辑中、完成。
- `GlobalSettings.jsx` 仅通过 `ScriptProgress` 传入 `episodes` 与 `episodeStatuses`；现有 `pending`、`generated`、`edited` 数据契约保持不变，并兼容 `storyboarded` 状态。
- 页面未新增 API、Store 或副作用；状态来源仍由 Home 的 `buildEpisodeStatusMap` 提供。
- 已同步 `src/components/project/index.js` 目录出口，后续项目域页面可复用卡片和容器。
- 剧本进度和三类主体概览内容区均固定展示两行，超出后在各自容器内纵向滚动；主体右上角跳转图标继续沿用 `char`、`scene`、`prop` 分类回调，并补充了无障碍名称。

## 历史状态复核（2026-07-16）

- 当日记录中的 `Home.jsx` 为 `1355` 行、架构统计 `1356` 行；该数字仅保留为历史迁移记录，当前数字以文末“文件规模”和 `PROJECT.md` 为准。
- 已复验 Home 顶部动作组件的旧定义、导入/导出、显式回调和调用方，未发现 `ReferenceError`、缺失 props 或重复定义。
- 当前静态门禁全部通过；真实登录态、任务恢复和外部副作用流程仍按 `PROJECT.md` 标记为未验证。
- 下一个实现重点不是重复拆分 Home 顶部按钮，而是按安全条件补齐 `CreationPage` 登录态业务回归；若安全条件仍不可用，继续进行剩余页面静态审计。

## 2026-07-17 登录态入口与 CreationPage 非破坏性回归
## 2026-07-17 CreationPage、AssetsPage 与 StoryboardPage 登录态只读回归补充
## 2026-07-17 StoryboardPage 选择器与刷新复验补充
## 2026-07-17 非破坏性登录态回归收尾
## 2026-07-17 CreationPage 历史结果只读复验
## 2026-07-17 AssetsPage 配音播放/收藏验收
## 2026-07-17 音频功能延期决定

- 用户确认当前音频功能尚未测通，暂缓 AssetsPage 的音频播放/收藏验收。
- 音频播放/收藏保持未验证，不因当前没有音频卡片而标记通过；待音频功能本身稳定且有可见测试音频后再继续。
- 其他不依赖音频的 AssetsPage/StoryboardPage 静态和只读验收可以继续，上传、下载、删除、生成、定稿等外部副作用仍需逐项授权。


- 用户授权进入当前测试项目的创作资产“配音”分类；页面和分类切换正常，接口未产生页面级错误。
- 当前账号没有可见音频卡片，页面没有可播放对象（`audio` 元素数量为 0），因此未执行播放或收藏，也未将该项记录为通过。
- 后续需要具备至少一条可见音频资产后再验证播放和收藏；本轮未执行上传、下载、删除或其他资产操作。

## 2026-07-17 AssetsPage 前端功能验收口径更新

- 用户确认 AssetsPage 除音频播放/收藏外的前端功能均已验证通过，未发现页面级错误。
- 音频播放/收藏明确视为尚未开发完成，本次前端重构不纳入该功能；不再把它作为 AssetsPage 重构收尾阻塞项。

## 2026-07-17 CreationPage 手动验收确认

- 用户确认此前列出的 CreationPage 手动验收项均无问题；其中图片任务最终状态/结果写回、视频重新编辑参数回填两项已由用户实际验证。
- 按用户要求，生成失败恢复、刷新任务恢复、配音参数自动重置以及真实上传/生成/轮询/失败清理链路视为通过，不再重复执行。
- 该状态来源为用户确认，不冒充本轮浏览器逐项复测；CreationPage 不再作为当前阻塞项，后续转入 AssetsPage 和 StoryboardPage 的剩余外部流程。

## 2026-07-17 当前运行时阻塞边界校正
## 2026-07-17 CreationPage 真实图片生成验收

- 用户已明确授权在当前测试项目中生成 1 张图片；使用默认模型 `豆包·Seedream 5.0`、`1:1`、`2K`，接口返回 `201` 并创建任务 `763f48d4-83e7-4234-b93e-7291a0eaa454`。
- 页面持续请求任务状态接口，期间没有发现页面级 `ReferenceError`、解析错误或项目控制台错误；等待约 30 秒后仍未显示结果卡，因此暂不能记录任务成功、失败清理或结果写回通过。
- 本轮只提交了一次生成，未执行其他上传、下载、删除、收藏、定稿或配音操作；后续先只读复查该任务状态，不重复提交。

## 2026-07-17 CreationPage 图片生成结果确认

- 用户确认上述图片生成任务已成功返回结果，CreationPage 的图片结果写回流程通过。
- 上一节中“任务最终状态/结果写回尚未确认”属于当时的临时观察记录，现已由用户确认结果覆盖；本次不重复提交生成。


- 安全登录态和测试项目已具备，主要非破坏性回归已经完成；此前“当前没有安全登录态和测试项目”的描述已过时并校正。
- 当前 CreationPage 没有可见历史结果卡，因此无法只读验证视频重新编辑参数回填、结果详情、收藏和结果写回。
- 真实生成、上传、下载、删除、收藏、定稿和配音属于外部副作用；在未获得具体授权前继续保留为未验证，不自动执行。


- 登录态进入 CreationPage 后，图片/视频 Tab 均可正常渲染输入区和参数区；当前测试账号的创作历史区域没有可见结果卡。
- 因没有现成结果卡，本轮无法验证视频重新编辑参数回填、结果详情、收藏和结果写回；未触发生成或其他外部副作用，页面日志无项目级错误。
- 这些项目继续保留为 OpenSpec 未完成项，直到有可回收的测试任务或结果数据。


- CreationPage、AssetsPage、SubjectPage 和 StoryboardPage 的当前只读入口与主要展示/选择器交互均已复验；静态门禁持续通过，未发现页面级未定义引用或控制台错误。
- OpenSpec 的 StoryboardPage 非破坏性回归项已具备证据并更新为完成；真实写操作没有并入非破坏性验收。
- 当前剩余工作已收敛为需要明确授权和测试对象的外部流程：CreationPage 任务恢复/失败恢复/真实生成，AssetsPage 上传/下载/删除/收藏，StoryboardPage 参考素材提交/上传/生成/下载/删除/定稿/配音。


- 批量视频生成面板的模型选择器可展开并切换到 `HappyHorse 文生视频`，选择后分辨率自动联动为 `720P`，面板关闭正常。
- 刷新页面后登录态仍可恢复，分镜页再次加载时无页面级错误；本轮未点击“开始生成”。
- 参考素材编辑提交、文件选择/上传、下载、删除、定稿和生成仍未执行。


- CreationPage：图片/视频/配音 Tab、视频模型、比例、分辨率、时长联动和刷新后页面恢复正常；未发现页面级错误。
- AssetsPage：项目资产/创作资产切换、角色/场景/道具分类切换、创作资产图片/视频/配音切换正常；已有测试项目数据可渲染。
- StoryboardPage：从测试项目进入后，分镜数据、镜头字段、批量生成菜单以及批量图片/视频生成面板的打开和关闭均正常；本轮未执行生成、上传、下载、删除、定稿或配音。
- 下一步：继续补齐分镜模型/分辨率选择器、参考素材和刷新恢复的只读检查；任何真实写操作前单独确认具体对象与副作用。

## 2026-07-17 CreationPage、AssetsPage 与 StoryboardPage 登录态只读回归补充

- CreationPage：图片/视频/配音 Tab、视频模型、比例、分辨率、时长联动和刷新后页面恢复正常；未发现页面级错误。
- AssetsPage：项目资产/创作资产切换、角色/场景/道具分类切换、创作资产图片/视频/配音切换正常；已有项目资产和创作资产数据可渲染。
- StoryboardPage：从测试项目进入后，分镜数据、镜头字段、批量下载/生成/剪辑入口和分镜列表可渲染；本轮未点击会产生外部副作用的动作。
- 下一步：继续做分镜模型/分辨率选择器与参考素材的只读交互；真实生成、上传、下载、删除、收藏、定稿和配音前单独确认。


- 已接管本地登录态页面，用户菜单显示登录用户；首页、项目页和创作页导航可正常切换。
- CreationPage 的图片/视频/配音 Tab、清空、批量操作、模型/参数展示均正常渲染；本轮未触发真实生成、上传、删除、下载、收藏或配音。
- 未发现项目页面 `ReferenceError`、缺失 props、解析错误或页面级错误；记录到的外部统计请求超时不计入项目页面失败。
- 下一步：在不产生外部副作用的前提下继续验证 CreationPage 历史/结果/重新编辑/刷新恢复，再验证 AssetsPage 与 StoryboardPage；任何真实写操作前先单独确认具体动作。

## 当前状态复核（2026-07-17，SubjectWorkspace 拆分后）

- `CreationManualButton` 与 `LoginButton` 继续由 `src/components/home/HomeHeaderActions.jsx` 唯一提供；本轮仅将两者重复的 hover/pressed 指针状态抽为 `src/hooks/useHoverPressState.js`。
- 组件仍通过显式 `onClick` 接入登录动作；创作手册仍由组件负责打开固定文档链接，未改变认证、导航或外部链接行为。
- 已完成旧定义、调用方、导入/导出和未定义引用复核；CreationPage 现有稳定展示区块和纯适配工具已覆盖当前明确安全边界，Home 主导航布局、StoryboardHeader、Storyboard Toast、SubjectGridViewport 和 SubjectWorkspace 也已迁移。
- 本轮完整静态门禁通过：`npm run lint`、`npm run build`、`npm run check:architecture` 和 `git diff --check`；架构检查仅保留 Home、StoryboardPage、SubjectPage 的规模告警。
- 当前安全静态拆分边界已收尾；下一步转入安全登录态业务回归。当前缺少可回收测试项目和测试素材时，仅保留非破坏性入口复验，不触发真实生成、上传、删除或定稿。

## 2026-07-17 CreationPage 主体工作区拆分

- 新增 `src/components/creation/CreationWorkspace.jsx`，统一承载创作页外层卡片、顶部工具栏和登录态/结果/空态分支。
- 页面通过显式 props 传入历史数据、模型参数、选择状态、展示回调和业务动作；工作区不读取页面闭包、不调用 API、Store 或缓存。
- `handleVideoCardClick` 保留在 `CreationPage.jsx`，继续负责视频详情 API 和详情合并；页面仍负责生成、轮询、历史分页、收藏、删除、下载、Toast 和 Store 写回。
- 已检查直接导入以避免组件目录循环依赖；定向 ESLint、构建、架构检查和 `git diff --check` 通过。

## 2026-07-17 未登录入口回归补充

- 在本地开发服务中复验首页 `创作手册`、`登录`、`开始创作` 入口，登录弹窗打开/关闭正常；资产页项目资产/创作资产切换、角色分类和创作资产媒体 Tab 正常；创作页图片/视频/配音 Tab 正常切换。
- 未发现页面级解析错误、`ReferenceError` 或失效入口；本轮未提交登录信息，也未触发任何外部副作用。
- 该结果只覆盖未登录和只读入口，不替代登录态任务恢复、失败恢复、分页真实触发、上传、生成、下载、删除、收藏、定稿和配音回归。

## 2026-07-17 项目页入口回归补充

- 未登录态从首页进入项目页，项目导航、搜索框和新建项目入口正常渲染；未触发创建、重命名、删除等外部副作用。
- 项目列表中的后端数据和项目操作仍需登录态/测试数据验证，不能以入口渲染替代关键交互回归。

## 2026-07-17 架构检查增强

- `scripts/check-architecture.mjs` 已增加 API、基础 UI、反馈/遮罩/动作组件和业务组件的非法导入检查；当前全量扫描通过，页面规模告警仍按历史复杂页面保留。

## 2026-07-17 规则一致性检查增强

- 架构检查新增规则文档镜像一致性和结构索引占位符检查；当前根目录、页面、API、设计系统的 `AGENTS.md` 与 `CLAUDE.md` 均完全一致，页面索引未发现 `L?`。

## 2026-07-17 页面规模检查对齐规范

- 架构检查现按项目警告线报告页面 300 行、通用 UI 250 行、业务区块 400 行和 Hook 300 行；告警用于迁移排序，不代表必须机械拆分。
- 当前页面级告警集中在 Home、StoryboardPage、SubjectPage、CreationPage、ScriptPage、ProjectList、GlobalSettings 和展示样例；已迁移的稳定边界不再重复搬动，页面级副作用仍保留在入口。

## 当前阻塞条件（运行时回归）

- 用户已确认本次前端重构纳入范围的运行时验收全部通过，CreationPage、AssetsPage（音频除外）和 StoryboardPage 不再存在本次重构阻塞项。音频播放/收藏按要求排除，不纳入本次任务。

## OpenSpec 归档前审查（2026-07-17）

- 静态迁移任务已按当前代码完成并记录；最新完成项包括 SubjectPage 缓存边界适配和 Storyboard 数据适配。
- `7.4` 已由用户确认本次纳入范围的运行时验收全部完成；`6.3.e.4`、`6.4.j` 和 `6.5.g` 的纳入范围均已完成，音频播放/收藏明确排除。
- `5.3` 已完成样板页静态门禁与关键入口回归记录；`7.5` 已完成归档前审查，OpenSpec 变更目录可作为本次重构完成后的审计记录保留。

## 当前收尾口径

- OpenSpec 父任务现与当前代码状态一致：静态拆分范围和本次纳入范围的运行时业务回归均已完成；音频播放/收藏是明确范围外功能，历史迁移记录保留，不机械改写历史行数。

- `ScriptPage`、`SubjectPage`、`AssetsPage`、`CreationPage`、`StoryboardPage` 和 Home 的当前可安全静态拆分范围已完成。
- 本次前端重构没有剩余的纳入范围工作；音频播放/收藏属于明确排除的后续产品功能，不计入本次完成度。页面级 API、任务轮询、缓存、Store 写回和外部副作用继续保留在原业务边界。
- 页面级 API、任务轮询、缓存、Store 写回和外部副作用不作为继续压缩页面行数的对象。

## 文件规模

> 当前工作区复核（2026-07-17）：`SubjectPage.jsx` 1708 行、`Home.jsx` 1296 行、`StoryboardPage.jsx` 1297 行、`CreationPage.jsx` 964 行；生成面板结果卡片已完成安全拆分。历史条目保留为迁移记录，最新结果以 PROJECT.md 和文末最新迁移记录为准。


| 文件 | 行数 | 优先级 |
|---|---:|---|
| `src/pages/StoryboardPage.jsx` | 1297（2026-07-17，生成面板结果卡片、StoryboardHeader 与 StoryboardToast 拆分后；架构统计 1298） | 首轮迁移收尾 |
| `src/pages/CreationPage.jsx` | 964（2026-07-17，CreationWorkspace 与媒体下载适配复用后；架构统计 965） | 静态收尾与运行时验收完成（按用户确认） |
| `src/pages/AssetsPage.jsx` | 57（2026-07-16，页面入口收敛后） | 页面入口收敛完成，业务面板和登录态副作用回归待完成 |
| `src/pages/SubjectPage.jsx` | 1708（2026-07-17，主体工作区与编辑表单拆分后；架构统计 1709） | 首轮收尾，静态验收通过 |
| `src/pages/ScriptPage.jsx` | 624（2026-07-16，当前工作区实际行数） | 首轮完成 |
| `src/pages/Home.jsx` | 1296（2026-07-17，HomeNavigationRail 与顶部动作状态复用后；架构统计 1297） | 稳定展示区块迁移完成，页面入口保留业务编排 |
| `src/pages/GlobalSettings.jsx` | 891（2026-07-16，当前工作区实际行数） | 样板候选 |
| `src/pages/ProjectList.jsx` | 638 | 样板候选 |

## 2026-07-16 Home 底部菜单组合迁移记录

- 新增 `src/components/home/HomeBottomMenus.jsx`，迁移 `MenuPopupItem`、`QRCodePopup`、`MoreOptionsMenu`。
- 组件通过显式 `close`、`setWatermarkSettingsOpen` 和二维码位置 props 接入，不引用首页认证、项目加载、导航、任务生成或 Store 状态。
- 页面继续保留底部菜单的打开状态、水印设置弹窗和导航副作用；未改变外链、二维码和商务合作展示行为。
- 当前 `Home.jsx` 实际为 `1954` 行，架构统计为 `1955` 行；新增组件为 `188` 行。
- 定向 lint 和架构检查通过。
- 未登录态浏览器复验：菜单可打开，商务合作二维码浮层可显示，水印设置弹窗可打开并关闭；未发现项目页面 `ReferenceError` 或解析错误。水印设置请求的 `401 Unauthorized` 属于未登录限制，未执行保存。

## 2026-07-16 CreationResultState 尾帧回填适配记录

- 新增 `createCreationFirstFramePrefill`，统一尾帧 Blob 转首帧文件的预填充对象构造。
- 结果组件继续负责尾帧 API 请求、空结果判断、Toast、Blob 和 `prefillData`/`prefillVersion` 状态；适配工具仅创建数据对象。
- 已移除结果组件内联的 `new File` 回填对象，静态门禁和差异检查通过。
- 真实尾帧请求和后续生成流程仍待安全登录态与测试数据。

## 2026-07-16 CreationResultState 图片回填适配记录

- 新增 `buildCreationImageReeditPrefill` 和 `buildCreationImageReferencePrefill`，统一图片重新编辑与“用作参考图”的回填对象。
- 结果组件继续负责点击交互、`prefillData` 和 `prefillVersion` 状态；适配工具不调用 API、Store、缓存或 React 状态。
- 已移除旧的图片回填内联组装，未发现缺失导入或重复实现。
- 当前 `CreationResultState.jsx` 实际 `366` 行；静态门禁和差异检查通过。
- 登录态真实回填和后续生成流程仍待安全测试条件。

## 2026-07-16 CreationResultState 视频重新编辑预填充适配记录

- 新增 `buildCreationVideoReeditPrefill` 和 `toCreationRefMode` 至 `src/utils/creationDetailAdapter.js`，统一视频重新编辑的参考素材、真人素材、首尾帧和参数回填对象。
- `CreationResultState` 继续持有视频详情 API 请求、失败提示、`prefillData` 与 `prefillVersion` 状态；纯适配工具不调用 API、Store、缓存或 React 状态。
- 已搜索旧的预填充字段组装和重复参考模式转换，未发现缺失引用或重复实现。
- 当前 `CreationResultState.jsx` 实际 `366` 行；静态门禁和差异检查通过。
- 登录态视频重新编辑参数回填仍待安全测试数据，不能以纯函数迁移代替运行时验收。

## 2026-07-16 CreationPage 输入卡接线统一记录

- 结果区与空态区现在共用页面级 `handleBeforeModelOpen` 和 `renderInputCard`，避免两处 JSX 重复创建同一套接线函数。
- 页面仍持有 API 配置判断、模型提示、生成参数、任务轮询、缓存和 Store 副作用；本轮仅收敛显式 props 接线。
- `CreationPage.jsx` 当前实际 `1080` 行，架构统计 `1081` 行；未发现引用缺失，静态门禁和差异检查通过。

## 2026-07-16 CreationResultState 视频详情适配复用记录

- `CreationResultState` 的视频重新编辑流程改为复用 `src/utils/creationDetailAdapter.js`，与页面视频详情弹窗使用同一套 `asset_bindings` 字段转换。
- 结果组件继续负责重新编辑请求、预填充状态和交互回调；API 请求没有下沉到纯适配工具，页面级生成和任务副作用边界不变。
- 已全局搜索旧的 `asset_bindings` 内联解析，当前仅保留适配工具的统一实现；未发现缺失导入、未定义引用或循环依赖。
- `CreationResultState.jsx` 当前 `429` 行，未为压缩行数继续强拆其结果交互状态。
- 登录态视频重新编辑和参数回填仍需安全测试数据，不能以静态复用代替运行时验收。

## 2026-07-16 CreationPage 视频详情适配迁移记录

- 新增 `src/utils/creationDetailAdapter.js`，迁移视频详情 `asset_bindings` 的图片、视频、音频字段转换及轻量视频卡片合并。
- `CreationPage` 继续负责 `apiGetCreationVideo` 请求、详情弹窗状态和失败日志；适配工具不调用 API、Store、缓存或 React 状态。
- 已全局搜索旧的详情字段转换代码、导入/导出和调用方，未发现重复定义、缺失引用或未定义回调。
- 当前 `CreationPage.jsx` 实际 `1072` 行，架构统计 `1073` 行；本轮 lint、构建、架构检查和差异检查均通过。
- 登录态视频重新编辑、失败恢复、刷新任务恢复、结果写回和真实生成链路仍需安全测试条件，不能以本轮静态迁移代替业务回归。

## 全局计数

> 当前验收顺序（2026-07-17）：静态门禁、CreationPage 验收、AssetsPage（音频除外）用户确认和 StoryboardPage 最终手动验收均已完成；后续仅保留范围外、缺少测试对象或未单独授权的业务流程，不自动执行外部副作用。

## 2026-07-16 CreationPage 输入卡片迁移记录

- 新增 `src/components/creation/CreationInputCard.jsx`，迁移输入区状态、素材 Hook 接线、参数状态、预填充、资产/音色/真人素材弹窗接线和生成参数组装。
- 页面通过 `renderInputCard` 显式接入 `CreationInputCard`；生成 API、任务轮询、缓存、Toast、Store 写回和页面级副作用仍由 `CreationPage.jsx` 持有。
- `CreationInputCard` 当前为 `470` 行，不继续为了满足规模警告强拆其业务接线；该组件内部的状态与回调边界已经通过显式 Hook 参数、props 和返回接口表达。
- 引用安全：已核对目录导出、页面导入、两个渲染调用方和旧页面局部 `InputCard` 定义；未发现 `onDraftContentChange` 等已知失效引用、缺失导出或反向依赖。
- 当前工作区 `CreationPage.jsx` 实际为 `1106` 行，架构统计为 `1107` 行；结构索引已同步到真实行号。
- 下一步：复跑静态门禁并复验未登录创作页；安全登录态和测试任务具备后，再验证视频重新编辑回填、失败恢复、刷新任务恢复、结果写回、配音参数重置和真实任务链路。

## 2026-07-16 CreationPage 页面遮罩组合拆分记录

- 新增 `src/components/creation/CreationPageOverlays.jsx`，统一承载批量删除确认、清空历史确认和视频详情 Portal。
- 组件通过显式 props 接收确认状态、清空历史描述、视频详情数据和动作回调；不引用 `CreationPage.jsx`、API、Store、缓存或任务轮询。
- 页面继续负责 `deleteSelected`、`handleClearHistory`、视频下载、视频删除和收藏回调，未改变历史 API、生成 API、任务轮询、缓存和 Store 副作用边界。
- `src/components/creation/index.js` 已增加目录导出；页面旧的 `createPortal`、`ConfirmDialog` 和 `CreationVideoDetailModal` 直接接线已移除，未发现失效引用或导出错配。
- 当前工作区 `CreationPage.jsx` 为 `1557` 行，架构检查统计 `1558` 行；相较页面遮罩组合拆分前的 `1584` 行减少 `27` 行。新增组件为 `83` 行。
- 静态验收：创作页及新增组件定向 ESLint、全仓库 lint、构建、架构检查和 `git diff --check` 均通过；构建最大 JavaScript 分块仍约 `441KB`，无超过 `500KB` 告警。
- 未完成：登录态视频重新编辑回填、失败恢复、刷新任务恢复、生成结果写回、配音参数重置以及真实上传/生成/轮询流程仍待安全测试条件具备后验证。
- **2026-07-16 未登录基础运行复验**：从首页进入创作页后，图片/视频/配音 Tab、清空、批量操作、登录空态以及登录弹窗打开/关闭均正常；页面日志未发现 `ReferenceError`、未定义引用、解析错误或页面级错误/警告。当前没有可用的安全登录态和测试任务，视频重新编辑回填、失败恢复、刷新任务恢复、结果写回、配音重置及真实上传/生成/轮询仍未验证。
- 下一步：安全登录态和测试任务具备后，先完成 CreationPage 未覆盖边界；在此之前不触发真实生成、上传、下载、删除或定稿流程，随后再评估剩余页面规模告警。

## 2026-07-16 CreationPage 未登录基础运行复验（最新）

- 从首页进入创作页后，图片、视频、配音 Tab 均可切换；清空操作可打开确认框并取消；批量操作可进入并退出；登录弹窗可打开并关闭。
- 页面复验期间未捕获 `ReferenceError`、未定义引用、解析错误或页面级错误/警告；未发现 `CreationInputCard` 迁移新增的缺失 props、导出错配或页面闭包引用。
- 浏览器工具额外出现一条外部统计请求超时，不属于 miioo 页面日志，不计入项目页面回归失败。
- 本轮未提交登录信息，也未触发上传、生成、下载、删除、定稿等外部副作用。
- 当前工作区 `CreationPage.jsx` 为 `1072` 行，架构检查统计为 `1073` 行；架构检查已不再报告 CreationPage 页面规模告警，仅保留 `Home`、`StoryboardPage` 和 `SubjectPage` 的历史告警。
- 下一步：安全登录态和测试任务具备后，优先验证视频重新编辑回填、失败恢复、刷新任务恢复和结果写回；不继续为了压缩行数强拆 `CreationInputCard`。

- 页面和组件中的原生 `<button>`：约 242 个
- 页面和组件中的 `onClick`：约 678 个
- Button-like 组件引用或定义：约 94 处
- Modal 命名文件：约 15 个
- 页面内局部组件声明最多：`StoryboardPage.jsx` 约 65 个

## 初步重复类别

### 按钮

- 页面内存在 `PrimaryBtn`、`SecondaryBtn`、`GhostBtn` 等局部实现。
- 多个组件直接使用原生 `<button>` 并重复写尺寸、颜色、禁用和加载样式。
- 第一阶段应先建立 `Button`、`IconButton`、`TextButton`、`ButtonGroup`，再逐页迁移。

### 弹窗和反馈

- 现有弹窗组件数量较多，但目录尚未明确区分基础遮罩、确认反馈和业务弹窗。
- `ConfirmDialog`、`LoadingAnimation` 等可作为跨页面能力盘点入口。
- 业务弹窗暂不强行合并，先提取稳定的基础遮罩与动作区域。

### 页面内局部组件

- `StoryboardPage.jsx`、`CreationPage.jsx` 含大量局部组件，应先按“纯展示区块 → 交互区块 → 状态 Hook”顺序拆分；CreationPage 已完成发送按钮和 Toast 等低风险展示/交互区块迁移，当前优先复查刷新任务恢复数据适配边界，不搬动轮询和副作用。
- 页面迁移期间保持 props 和回调边界清晰，不把整个页面状态对象无差别透传给所有子组件。

## 2026-07-16 Home 首页低风险区块迁移记录

- 新增 `src/components/home/HomeSloganText.jsx`、`StartCreationButton.jsx` 和 `src/components/home/index.js`，分别承载首页标语动画与开始创作按钮。
- `Home.jsx` 通过目录入口引入两个组件；`StartCreationButton` 只接收显式 `onClick`，登录判断、新建项目开关和页面业务副作用仍由首页保留。
- 行为保持：未改变标语动效、按钮视觉、登录拦截、创建项目入口、导航或项目工作流状态。
- 引用安全：已检查 `LoginButton` JSX 闭合标签；旧组件定义、旧常量和已知失效引用搜索无结果，新增组件均有默认导出和目录入口导出。
- 静态验收：首页及新增组件定向 ESLint、`npm run build` 通过；构建无超过 500KB 的 JavaScript 分块告警。首页当前实际 `2137` 行，架构统计 `2138` 行，结构索引已同步，架构规模告警仍保留为历史页面告警。
- 下一步：优先补齐 `CreationPage` 登录态未覆盖流程；当前未登录基础运行已确认页面和登录入口正常。首页下一块不直接拆 `WorkflowHeadbar`，先盘点登录态、步骤权限、用户菜单和导航回调，确保所有依赖通过显式 props 接入。

## 2026-07-15 StoryboardPage 镜头行与媒体列迁移记录

- 新增 `src/components/storyboard/StoryboardShotRow.jsx` 与 `StoryboardShotRowContext.js`，抽离镜头行拖拽、悬停、插入提示线和删除确认。
- 新增 `src/components/storyboard/MediaCol.jsx`，抽离分镜图/视频媒体卡片、文件选择、悬停预览、详情弹窗、视频查看器和下载入口。
- `MediaColWrapper` 与媒体列标题、宽度和边框布局一并迁移到 `MediaCol.jsx`，通过 `src/components/storyboard/index.js` 统一导出。
- 页面保留 `ShotRow` 业务桥接、上传回调、生成回调、任务轮询、缓存、Toast 和持久化；新组件不引用 `StoryboardPage`、页面 API 或页面 Store。
- 行为边界：`MediaCol` 通过显式 props 接收 `media`、`shotMeta`、生成历史、参考图和上传/生成回调，未搬动 API 参数组装与页面状态更新。
- 页面规模：该阶段 `StoryboardPage.jsx` 实际 `6249` 行；媒体列展示实现、主体参考列和文本编辑列已移出，随后继续迁移批量工具栏和生成流程。
- 验证：媒体组件与行容器定向 ESLint、构建、架构检查和 `git diff --check` 已通过；完整页面 lint 仍受历史问题影响，需在后续全量治理阶段处理。

## 2026-07-15 StoryboardPage 主体参考列迁移记录

- 新增 `src/components/storyboard/MainRefCol.jsx`，抽离主体参考列容器、参考图网格、添加菜单、资产选择、临时上传预览、删除交互和媒体悬浮预览。
- `MainRefColWrapper` 通过显式 props 接收 `shot`、`onChange`、`projectId`、`onUploadFile` 和 `onAssetConfirm`；新组件不引用 `StoryboardPage`、业务 API 或页面闭包。
- 页面继续负责 `apiUploadCreationImage`、`buildRefFromAsset`、`mainRefs` 写回、上传失败清理和页面级 API/缓存副作用；旁白列仍保留页面内 `AddSlotBtn`，避免因主体参考列迁移误删共享调用方。
- `MediaHoverPreview` 同步迁移到 `MainRefCol.jsx` 并通过 `src/components/storyboard/index.js` 导出，页面内其他生成面板预览入口改为显式导入，避免保留重复定义。
- 页面规模：该阶段 `StoryboardPage.jsx` 实际 `6485` 行；本轮移除主体参考列实现约 `320` 行，新增业务域组件约 `356` 行，后续图片/视频生成面板迁移继续压缩页面入口。
- 引用安全：迁移前确认 `MainRefModal` 无调用方但暂不删除；迁移后全局搜索旧 `AddSlotDropdown`、`MainRefCol`、`MediaHoverPreview` 定义和调用方，确认页面只保留 `StoryboardMainRefColWrapper` / `StoryboardMediaHoverPreview` 导入。
- 验证状态：主体参考列定向 ESLint、构建、架构检查和 `git diff --check` 已通过；完整仓库 lint 仍按历史问题单独记录。

## 2026-07-15 StoryboardPage 图片生成面板迁移记录

- 新增 `src/components/storyboard/GenerateImagePanel.jsx`，抽离单镜头图片生成表单、参考图编辑、上传/资产库选择、生成结果列表和媒体详情弹窗。
- 页面继续负责 `apiGenerateStoryboardImage`、任务轮询、任务持久化、生成中状态、分镜图状态写回、后端更新和 Toast；图片面板通过显式 props 接收页面级提示词构建器、表单兼容 UI 和业务回调。
- 组件入口 `src/components/storyboard/index.js` 新增 `GenerateImagePanel` 导出，页面统一从业务域目录入口引入，避免绑定内部实现路径。
- 迁移收尾时修复两类引用风险：删除图片面板残留的 `setDuration` 逻辑；恢复视频面板所需的页面级 `SpinnerIcon`，并将不存在的 `ModalToggle` 改为已有 `Toggle`。
- 页面规模：视频面板迁移前 `StoryboardPage.jsx` 实际 `5246` 行；图片生成面板迁出约 `470` 行，视频面板随后继续按同一 props 与引用安全流程迁移。
- 验证：图片面板定向 ESLint、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过；完整页面 lint 仍存在迁移前历史问题，未将其伪报为本轮通过。

## 2026-07-15 StoryboardPage 文本编辑列迁移记录

- 新增 `src/components/storyboard/TextEditCol.jsx`，抽离 `EditableText` 和 `TextEditCol`；前者负责点击编辑、失焦提交和 Escape 取消，后者负责光影/环境音列布局。
- `DescriptionCol` 通过 `StoryboardEditableText` 显式复用同一文本编辑能力；`ShotRow` 通过 `StoryboardTextEditCol` 显式传入 `label`、`value` 和 `onChange`。
- 页面继续负责 `shot.description`、`shot.lightShadow`、`shot.ambientSound` 的状态更新与持久化；组件不引用页面变量、API 或 Store。
- 引用安全：旧 `EditableText`、`TextEditCol` 页面定义已删除，组件通过 `src/components/storyboard/index.js` 导出；未定义引用检查无新增问题。
- `TextEditCol.jsx` 当前 `109` 行；组件定向 ESLint、构建、架构检查和 `git diff --check` 作为本轮验收项执行。

## 2026-07-15 StoryboardPage 视频生成面板迁移记录

- 新增 `src/components/storyboard/GenerateVideoPanel.jsx`，抽离视频生成面板、参考素材编辑区、首尾帧输入、视频上传卡片、生成结果卡片和视频查看弹窗。
- 新增 `src/components/storyboard/VideoResultsPanel.jsx`，继续拆出视频上传卡片和视频结果卡片；结果列表只负责上传、展示、定稿、查看和下载事件。
- 组件通过显式 props 接收 `buildPromptFromShot`、`buildRefFromAsset`、面板兼容 UI、资产映射和页面事件出口；不读取 `StoryboardPage.jsx` 的页面闭包变量。
- `VideoResultsPanel` 通过显式 props 接收 `shot`、`projectId`、结果列表、列表更新、定稿、Toast、查看回调和按钮组件；视频生成 API、轮询和分镜写回仍由页面负责。
- 页面继续负责 `apiGenerateStoryboardVideo`、任务轮询、任务持久化、生成状态、分镜视频写回、`apiUpdateStoryboard` 和 Toast；视频面板仅负责表单状态、素材交互和结果展示。
- 新增组件由 `src/components/storyboard/index.js` 导出，页面通过业务域入口导入；未保留页面内 `GenerateVideoPanel`、`VideoUploadCard` 或 `VideoItem` 定义。
- 页面规模：`StoryboardPage.jsx` 当前实际 `4529` 行；`GenerateVideoPanel.jsx` 从 `786` 行降至 `578` 行，新增 `ReferenceMediaEditor.jsx` 当前 `204` 行、`VideoResultsPanel.jsx` 当前 `198` 行。
- 参考素材编辑区已从 `GenerateVideoPanel` 中独立为 `ReferenceMediaEditor`，覆盖全能参考模式的主体/图片/视频/音频和首尾帧模式的首帧/尾帧快捷入口；通过显式 props 接收上传槽位、素材状态、资产映射和变更回调。
- `GenerateVideoPanel` 继续持有参考媒体上传 API、失败 Toast、模型能力/数量限制、视频生成参数和页面级生成回调；`ReferenceMediaEditor` 不调用 API、不读取页面闭包变量。
- 静态验收：`GenerateVideoPanel.jsx`、`ReferenceMediaEditor.jsx`、`VideoResultsPanel.jsx` 定向 ESLint、构建、架构检查和 `git diff --check` 已通过；迁移后曾捕获并修复 `FrameUploadSlot` / `PanelUploadSlot` 未显式向下传递的引用遗漏；完整页面 lint 仍受迁移前历史问题影响，未将其伪报为本轮通过。
- 待完成：浏览器运行时验证模型加载、Tab 切换、参考素材、生成结果、定稿、查看、下载和关闭流程；验证通过后再进入下一块页面区块拆分。

## 2026-07-15 StoryboardPage 历史 ESLint 治理记录

- 定向检查：`npx eslint src/pages/StoryboardPage.jsx` 已达到 `0 errors / 0 warnings`。
- 修复范围：清理未使用导入和图标，恢复旁白列仍在使用的 `CharTag` / `AddSlotBtn`，移除首尾帧快捷卡片失效的 `setBtn3Pressed` 引用，修正参数选择器的 ref 传递，补全 Effect 依赖，并将页面同步状态更新延后到 `requestAnimationFrame`。
- 引用安全：全局搜索未发现 `CharMentionDropdown`、`CharReplaceDropdown`、`MainRefModal`、`INITIAL_SHOTS`、`onDraftContentChange` 等残留失效定义或调用；`FrameUploadSlot` / `PanelUploadSlot` 仍由页面经视频面板显式传递到 `ReferenceMediaEditor`。
- 验证：`npm run build`、`npm run check:architecture`、`git diff --check` 通过；架构检查仍仅报告既有页面规模告警，不构成阻断。

## 2026-07-16 StoryboardPage 选择器迁移与验收记录

- 新增 `src/components/storyboard/PanelSelect.jsx`，抽离 `PanelSelect` 与 `ModalSelectItem` 的标签、当前值、展开菜单、激活态和选项选择交互。
- `GenerateImagePanel`、`GenerateVideoPanel` 直接引入 `PanelSelect`；页面不再通过 props 转发选择器，模型、时长和分辨率的值与变更回调仍由生成面板状态持有。
- 页面规模：`StoryboardPage.jsx` 当前实际 `3412` 行，架构检查按文件末尾换行计 `3413` 行；本轮没有改变 API、任务轮询、缓存、持久化或用户交互边界。
- 引用安全：全局搜索确认旧 `PanelSelect` / `ModalSelectItem` 页面定义和页面级转发已移除；`src/components/storyboard/index.js` 保留公开导出，未发现失效导入或未定义引用。
- 验收：定向 ESLint（页面、选择器、两个生成面板）通过；`npm run build`、`npm run check:architecture`、`git diff --check` 通过；构建无超过 500KB 的 JavaScript 分块告警。
- 待完成：生成面板中的图片上传卡、图片结果项、首尾帧上传槽和多媒体上传槽仍在页面内，下一轮按“图片组 → 视频参考组”继续迁移。

## 2026-07-16 StoryboardPage 上传槽位与任务读取收尾记录

- 新增 `src/components/storyboard/StoryboardUploadSlots.jsx`，抽离 `FrameUploadSlot` 与 `PanelUploadSlot`。
- `FrameUploadSlot` 负责首帧/尾帧图片槽位、资产库选择、当前/下一分镜快捷入口、文件校验、上传、删除和悬浮预览；`PanelUploadSlot` 负责参考主体、参考图、参考视频、参考音频的单/多媒体槽位、资产选择、插入提示和预览。
- `ReferenceMediaEditor` 直接引入上传槽位；`GenerateVideoPanel` 不再接收或转发上传槽位，页面不再持有上传槽位实现。组件只通过明确 props 和回调通信，不读取页面闭包变量。
- 新增 `src/utils/storyboardTaskAdapter.js`，统一兼容分镜任务的状态字段、图片结果字段和视频结果字段；工具不调用 API、不操作 React 状态、缓存、Toast 或持久化。
- 页面继续保留 `pollTask` 轮询循环、任务状态更新、缓存、任务持久化、Toast、分镜写回和 API 参数组装，适配工具不携带页面副作用。
- 当前 `StoryboardPage.jsx` 实际为 `2784` 行；架构检查脚本计为 `2788` 行，仍属于历史超长页面告警，不构成阻断级违规。
- 静态验收：分镜相关文件定向 ESLint 为 `0 errors / 0 warnings`；`npm run build` 通过且无超过 500KB 的 JavaScript 分块；`npm run check:architecture` 通过；`git diff --check` 通过；旧任务读取函数、未定义引用和上传槽位缺失引用搜索无结果。
- 浏览器运行时验收已完成第一轮登录态非破坏性关键流程：分镜数据加载、批量图片/视频生成面板打开与关闭、模型/分辨率选择器展开/收起与值回显、刷新后的分镜数据恢复均正常；检查期间未发现页面级 `ReferenceError`、未定义 props、解析错误或控制台错误/警告。
- 本轮未触发真实生成、上传、下载、删除或定稿；因当前分镜没有可用的参考素材和媒体结果，参考素材展示、上传槽位文件选择、真实图片/视频结果查看和逐类详情流程仍待测试数据具备后验证。
- 下一步：先补齐 AssetsPage、CreationPage、StoryboardPage 的登录态未覆盖边界；静态门禁和 CreationPage 未登录基础运行已通过，继续处理 CreationPage、Home、StoryboardPage、SubjectPage 的规模告警，最后治理全量业务回归与 OpenSpec 收尾。

## 2026-07-16 StoryboardPage 登录态非破坏性验收记录

- 验收入口：从项目列表进入 `子不语第一回` → 分镜，确认第 1 集和 10 个镜头正常加载；镜头行中的画面描述、景别、运镜、拍摄角度、构图、时长、光影、环境音、台词分配、主体参考以及分镜图/视频区域均正常显示。
- 批量操作：批量生成菜单正常展开；图片生成面板和视频生成面板均正常打开/关闭，待生成数量均显示为 10 个；视频面板显示模型、分辨率、时长，图片面板显示模型、分辨率。
- 选择器：模型选择器可展开并切换到 `GPT-Image 2 - 稳定版`，切换后值正确回显；分辨率选择器可展开、显示当前选项并正常收起。未点击“开始生成”。
- 刷新恢复：刷新后页面短暂进入加载态，等待请求完成后 10 个镜头和镜头详情恢复；检查期间未发现 `ReferenceError`、未定义变量/props、解析错误或页面级控制台错误/警告。
- 未覆盖：当前测试数据没有分镜图、分镜视频和参考素材内容，因此未验证结果查看、参考素材编辑、上传槽位文件选择、下载、删除、定稿和真实副作用流程。浏览器工具自身的遥测提示不计入页面控制台错误。

## 2026-07-16 StoryboardPage 媒体结果补充验收记录

- 在同一登录态项目中补充发现并核对已有媒体结果：页面共有 4 个图片元素、2 个视频元素和 30 个文件输入槽位；分镜图/分镜视频媒体卡片均能正常渲染。
- 参考素材区域与视频生成面板正常展示，视频面板包含「首尾帧」「参考主体」「参考图」「参考视频」「参考音频」等区域；本轮只检查展示，不执行文件选择或提交。
- 只读打开并关闭分镜图片详情与分镜视频查看器，详情媒体地址与当前镜头数据一致；关闭后页面恢复，`tab.dev.logs({ levels: ['error', 'warn'] })` 结果为空。
- 初轮验收时媒体结果尚未加载完成，旧记录中的“没有可用媒体结果”已由本记录修正为“补充验收时已有媒体结果”。
- 未覆盖：真实文件选择、参考素材编辑提交、上传、下载、删除、定稿和生成任务流程；这些操作仍属于后续安全条件具备后的验收范围。
- 下一步：按既定顺序进入 AssetsPage 未覆盖边界验收；StoryboardPage 只保留上述外部副作用和参考素材提交流程，不再阻塞资产库验收。

## 样板页选择

样板页已确定：`ProjectList` 为首个样板，`GlobalSettings` 为第二个局部样板。

- `ProjectList` 文件较短，已验证页面入口、卡片和按钮的第一轮拆分。
- `GlobalSettings` 处于工作流中，已验证封面上传按钮、表单保存和页面导航边界的局部拆分。
- 两个样板页均不代表完整页面迁移结束；自动保存、复杂表单和历史页面逻辑仍按后续区块任务处理。

## 每次迁移必须补充

- 迁移前后行数和局部组件数量。
- 原实现到目标组件的映射。
- 接口、状态和关键交互是否保持不变。
- `npm run lint`、`npm run build`、`npm run check:architecture` 结果。
- 尚未迁移或需要后续处理的重复实现。

## 2026-07-15 第一轮迁移记录

- 样板页：`src/pages/ProjectList.jsx`
- 迁移内容：重命名弹窗、删除确认弹窗中的文字按钮、危险按钮、关闭图标按钮
- 新增组件：`src/components/ui/Button.jsx`、`IconButton.jsx`、`TextButton.jsx`、`ButtonGroup.jsx`、`index.js`
- 行为保持：未修改项目接口、Store、项目对象结构和回调签名；确认按钮仍在名称为空时禁用；删除仍由页面回调触发
- 暂未迁移：项目操作菜单项、卡片点击区域和新建项目卡片，它们仍包含页面域交互或卡片行为，后续按业务动作边界处理
- 迁移后 `ProjectList.jsx`：约 660 行，仍保留大量历史内联样式，视觉 Token 迁移另行处理

## 2026-07-15 全局 Primary 按钮与三类页面动作统一记录

- `src/components/ui/Button.jsx`：Primary 使用双层结构，外层通过 `style={{ padding: '1px' }}` 保证只露出 1px 渐变描边；禁用态移除外层渐变，内层仍保持完整铺满。
- `src/pages/ScriptPage.jsx` 与 `src/components/script/`：ScriptPanel、编辑工具栏、上传入口、文件删除、模型/集数选择器和发送动作已接入 `Button`；组件保留页面回调、流式状态和上传业务逻辑。
- `src/pages/CreationPage.jsx` 与 `src/components/creation/`：素材库确认/保存、普通批量操作、清空历史和圆形发送动作已接入 `Button`；Tab、下拉选项、上传槽位、文件移除和媒体操作仍保留专用交互。
- `src/pages/SubjectPage.jsx` 与 `src/components/subject/`：工具栏、主体生图、确认弹窗、失败重试、图片上传/下载动作已接入 `Button` 或 `IconButton`；关闭、标签导航、音色试听和图片卡片操作仍按专用交互保留。
- `src/pages/StoryboardPage.jsx`：`GhostBtn`、`PrimaryBtn`、`SecondaryBtn` 仅作为业务语义包装，内部统一调用 `components/ui/Button`；新增、重试和批量动作同样复用基础按钮。
- 行为边界：原生 `<button>` 的剩余项主要是 Tab 导航、选择器选项、上传槽位、文件/媒体动作以及关闭、播放、收藏等图标交互，不应仅按标签名机械替换。
- 验证边界：本记录只标记普通按钮统一，不代表 `CreationPage` 或 `StoryboardPage` 整页迁移完成；完整页面回归和历史 lint 治理继续按任务清单执行。

## 2026-07-15 第二轮迁移记录

- `src/pages/ButtonShowcase.jsx`：删除页面内 14 个按钮状态实现和内联 `<style>`，统一改为引入 `src/components/ui/Button.jsx`；保留四种变体、默认/禁用/加载三种展示状态。
- `src/pages/GlobalSettings.jsx`：`CoverUpload` 的文件选择外层交互改为基础 `Button`；文件选择、上传 API、保存状态、预览和 hover 覆盖层仍由页面业务组件控制。
- `src/pages/ProjectList.jsx`：项目更多菜单项改用 `Button`，弹窗关闭/取消/确认动作继续使用 `IconButton`、`TextButton`、`Button` 和 `ButtonGroup`。
- `src/pages/ScriptPage.jsx`：迁移 `ScriptPanel` 底部稳定动作区、`UploadPlaceholder` 上传入口、`FileCard` 文件删除按钮、模型/集数选择器的触发器/选项/加减按钮、`SendButton` 和 `ToolbarBtn`，统一复用 `Button` / `IconButton`；`EpisodeItem` 等业务导航按钮暂不强行基础化。
- 基础组件修正：`Button` 的仅图标尺寸按 `large=36px / small=24px` 区分，并补齐 Accent 表面渐变和按钮字重。
- 未迁移：`GlobalSettings` 的自动保存逻辑、项目卡片点击区域、复杂页面按钮；这些属于后续业务区块迁移范围。

## 2026-07-15 第十三轮迁移记录

- `src/pages/SubjectPage.jsx`：将 `EditSubjectPanel` 中后端候选图、参考图的纯数据转换逻辑抽离到 `src/components/subject/SubjectImageMappers.js`。
- 新增纯函数：`mapCandidateImages`、`mapReferenceImages`、`mapReferenceImageIdsForModal`、`mergeSubjectImages`，负责 URL 归一化、候选图/参考图映射、参考图详情快照、按 ID 去重、保证最多一个定稿图，以及插入跨弹窗生成占位/结果。
- 组件边界：映射文件不引用 React、页面、API、Store 或 Toast；任务缓存的读取和消费、状态更新、API 请求仍由 `SubjectPage` 持有。
- 行为保持：候选图优先于参考图、参考图不参与定稿、只保留第一个候选定稿、pending 任务插入列表头部等规则保持不变。
- 页面规模：`SubjectPage.jsx` 从约 `2211` 行降至 `2148` 行，移除详情图片映射、参考图快照和生成参数组装逻辑约 `63` 行。
- 风险检查：接入后全局搜索确认旧的 `candidateMapped`、`referenceMapped` 和页面内 `finalImages` 构造已移除；新增映射文件定向 ESLint 通过。
- 参考图详情快照也统一由主体映射工具生成；页面仅保留 `refImageIds` 状态和 `useMemo` 生命周期，不再重复处理 URL 类型判断。
- 同步抽离 `buildSubjectGenerationParams`，页面仍负责生成按钮回调、API 请求、任务轮询和缓存；参数字段与原请求结构保持一致。

## 2026-07-15 第三轮迁移记录

- `src/pages/ScriptPage.jsx`：将 `ScriptEditor`、`EditorToolbar` 和编辑器样式注入函数抽离到 `src/components/script/`，页面仅保留编辑状态、内容回调和容器 ref 的编排。
- 新增组件：`src/components/script/ScriptEditor.jsx`、`EditorToolbar.jsx`、`ScriptStyles.js`、`index.js`。
- 行为保持：TipTap 扩展配置、Markdown 转换、`immediatelyRender: false`、内容更新回调、工具栏命令和滚动容器 ref 均未改变。
- 组件边界：剧本编辑器属于剧本业务域，不进入 `components/ui`；编辑器组件不引用 API、Store、Toast 或页面状态。
- 当前 `ScriptPage.jsx`：约 627 行；编辑器域、分集导航域、会话输入区、`ScriptPanel` 和流式展示域已完成首轮抽离，页面保留状态、接口请求、生命周期和业务编排。

## 2026-07-15 第十六轮迁移记录

- `src/pages/SubjectPage.jsx`：将主体编辑区图片上传、下载和定稿回调接线抽离到 `src/components/subject/SubjectImageActions.js`。
- `createSubjectImageActionHandlers` 通过显式参数接收页面状态 setter、封面同步、Toast 和 Blob 下载能力，兼容资产库选择、本地上传、候选图定稿和参考图定稿。
- 页面继续负责 `generatedImages` 状态、主体封面同步、Toast 生命周期和组件编排；动作适配文件负责 API 调用与错误日志，不反向引用页面。
- 同步确认 `RefImageField` 调用处的 `projectId` props 无重复，避免无意义的重复传参。

## 2026-07-15 SubjectPage 收尾核对记录

- `src/pages/SubjectPage.jsx`：完成首轮迁移收尾，当前文件约 `2093` 行（架构检查脚本按文件分割计 `2094` 行）；页面继续保留主体列表数据、生成任务轮询、缓存、Toast、封面同步和 API 副作用，稳定展示区块与图片业务动作已通过主体域组件接入。
- 图片动作链路核对：资产库选择、本地上传占位/上传替换/失败清理、图片下载、候选图定稿、参考图定稿和取消定稿均保持原有回调与接口边界；取消定稿继续由页面 `onCoverChange(null)` 调用 `apiUnsetPrimarySubjectImage`。
- 引用安全核对：主体域统一入口 `src/components/subject/index.js` 已导出当前 SubjectPage 依赖；已迁移 API 导入已移除；SubjectPage 定向扫描未发现 `no-undef`、未定义引用、解析错误或 `react-hooks/refs` 问题。
- 结构索引：已按实际代码行号同步 `src/pages/SubjectPage.jsx` 顶部结构索引，避免后续读取和拆分依赖过期位置。
- 验证结果：`git diff --check`、主体图片动作/入口定向 ESLint、SubjectPage 引用安全扫描、`npm run check:architecture`、`npm run build` 通过；架构检查仍仅报告历史超长页面建议，完整仓库 lint 的历史问题另行治理。
- 后续边界：`EditSubjectPanel` 剩余模型加载、生成流程和主体页批量动作编排仍保留在页面，后续可继续拆分，但不阻断本轮进入 `AssetsPage`。

## 2026-07-15 AssetsPage 首轮迁移记录

- `src/pages/AssetsPage.jsx`：完成资产库标签栏、项目/创作资产模块切换标签、项目/创作资产空态和批量操作工具栏的首轮抽离。
- 新增组件：`src/components/assets/AssetsTabs.jsx`、`AssetsEmptyState.jsx`、`AssetsBatchToolbar.jsx`，通过 `src/components/assets/index.js` 统一导出。
- `AssetsBatchToolbar` 仅负责批量模式的展示和事件出口，通过 props 接收批量状态、选中数量、全选、下载、删除和取消回调；不调用 API、不读取 Store、不创建确认弹窗。
- 页面继续持有项目列表、资产分页/筛选、选中状态、批量下载/删除、删除确认、创作历史加载、收藏同步和详情弹窗等业务副作用；创作资产下载仍保持原有空动作，不在本轮扩大业务范围。
- 页面规模：从约 `4177` 行降至约 `3855` 行；本轮移除标签栏、媒体空态和两套批量工具栏重复 JSX，减少约 `322` 行。
- 行为保持：项目资产和创作资产的 tab 切换、批量模式进入/退出、全选、项目资产下载、删除确认和现有视觉结构保持原有回调边界；新增组件未引用页面、API 或 Store。
- 验证：新增资产组件定向 ESLint、`npm run build`、`npm run check:architecture`、`git diff --check` 通过；页面原有历史 lint 告警仍单独保留，未伪报全量通过。
- 尚未迁移：`ProjectListItem`、项目更多菜单、资产卡片、详情弹窗组合、筛选/分页 Hook 和批量业务动作编排。

## 2026-07-15 AssetsPage 项目列表项迁移记录

- `src/pages/AssetsPage.jsx`：移除页面内 `ProjectListItem` 及项目更多菜单的展示实现，改为引入 `src/components/assets/AssetsProjectListItem.jsx`。
- 组件通过显式 props 接收项目对象、选中态、项目切换回调以及重命名、复制、下载、删除回调；不引用项目 API、Store 或页面入口。
- 页面继续负责 `handleRenameProject`、`handleCopyProject`、`handleDownloadProject`、`handleDeleteProject` 及对应弹窗、Toast 和数据刷新，不改变任何业务回调签名。
- 行为保持：项目名称选中、悬停态、更多菜单、菜单外点击关闭和四项菜单动作保持原有交互；组件定向 ESLint 与差异检查通过。
- 页面规模：从约 `3855` 行降至约 `3703` 行；本轮移除项目列表项及更多菜单实现约 `152` 行。
- 尚未迁移：资产卡片、详情弹窗组合、筛选/分页 Hook 和批量业务动作编排。

## 2026-07-15 AssetsPage 资产卡片媒体层迁移记录

- `src/pages/AssetsPage.jsx`：资产卡片接入 `src/components/assets/AssetCardMedia.jsx`，抽离媒体展示、视频悬停播放、批量选择标记、更多菜单和收藏按钮展示层。
- `AssetCardMedia` 通过显式 props 接收媒体数据、悬停态、收藏动画和下载/删除/收藏出口；不读取页面状态、不调用 API、不组合详情弹窗。
- 页面继续负责 `AssetCard` 的点击打开、详情 API 请求、详情数据、详情弹窗、收藏回调、删除和下载回调；`AssetCard` 仍是业务组合层，未把详情链路一次性搬走。
- 行为保持：卡片悬停播放、批量选择、更多菜单显示、收藏按钮显示与点击冒泡阻止逻辑保持原有边界；`AssetsMoreMenu` 继续通过 `ConfirmDialog` 发出删除确认后的回调。
- 新增组件：`src/components/assets/AssetCardMedia.jsx`，并通过 `src/components/assets/index.js` 统一导出。
- 页面规模：当前实际 `3524` 行（架构脚本计 `3525` 行）；本轮与资产更多菜单接入合计移除约 `179` 行，资产卡片详情组合仍待后续迁移。
- 风险检查：迁移后定向扫描确认 `AssetsPage` 不再声明旧 `MoreMenu`，`AssetsMoreMenu` 和 `AssetCardMedia` 的导入/导出一致；新增组件不反向引用页面、API 或 Store。

## 2026-07-15 AssetsPage 创作资产详情组合迁移记录

- `AssetCardCreativeDetail` 已接入 `AssetCard`，负责创作资产图片/视频详情弹窗的类型分发和 props 组装。
- 页面继续负责详情打开状态、项目资产详情 API、删除后关闭、收藏回调和业务数据；组件不调用 API、不读取 Store。
- `ImageDetailModal` 在页面中仍被项目资产卡片使用，因此保留页面导入，不做无依据的删除。
- 当前页面实际 `3441` 行；架构脚本计 `3442` 行。项目资产镜头详情弹窗本体、通用详情弹窗和筛选/分页编排仍待后续处理。

## 2026-07-15 AssetsPage 项目资产详情组合迁移记录

- `ProjectAssetDetail` 已接入 `ProjectAssetCard`，统一编排分镜图、分镜视频、主体多图和普通图片四类详情分支。
- 详情适配层通过显式 props 接收页面内弹窗组件，避免业务域组件反向引用页面；页面继续持有详情弹窗本体、打开状态、API、下载、删除和 Toast 回调。
- 保持原有数据映射：分镜图片/视频继续把 `fileUrl/url` 归一为 `src`，`is_primary` 归一为 `finalized`；主体多图删除仍按单图/最后一张分别处理。
- 页面规模：当前实际 `3441` 行（架构脚本计 `3442` 行）；资产卡片和详情组合已完成首轮，筛选、分页和批量业务动作编排仍待处理。

## 2026-07-16 AssetsPage 分镜视频详情弹窗迁移记录

- 新增 `src/components/assets/ShotVideoDetailModal.jsx`，从 `AssetsPage.jsx` 抽离 `ShotVideoDetailModal` 与 `VideoFrameThumbnail`，并通过 `src/components/assets/index.js` 统一导出。
- 组件负责视频详情预览、自动播放、播放/进度/音量控制、视频帧缩略图切换、定稿状态、参考图/参考视频/首尾帧展示、提示词复制、参数展示、删除确认、下载和关闭交互。
- 组件通过显式 props 接收 `onClose`、`onDownload`、`onDelete`、`onShowToast`、分镜信息、视频帧、视频地址、参考素材和首尾帧；不引用页面 API、Store 或未声明变量。
- 页面 `AssetCard` 与 `ProjectAssetDetail` 均已接入目录导出的组件；详情 API、下载、删除、Toast 和弹窗生命周期仍由页面/适配层负责，未把业务副作用下沉到资产组件。
- 初次静态核对发现并修复 `MOCK_SHOT_VIDEO_DETAIL` 默认数据和组件默认导出缺失；修复后全局搜索未发现页面旧弹窗、旧 `VideoFrameThumbnail` 定义或失效 `sound` props 接线。
- 页面规模：`AssetsPage.jsx` 当前实际 `1817` 行；`ShotVideoDetailModal.jsx` 当前实际 `659` 行。结构索引已按实际代码位置同步。
- 验收：资产详情相关组件定向 ESLint 已通过（`0 errors / 0 warnings`）；完整 `npm run build`、`npm run check:architecture`、`git diff --check` 待本轮复跑；浏览器登录态关键流程仍待具备登录会话后验证。

## 2026-07-16 CreationPage 结果展示区、空态与真人素材弹窗迁移记录

- 新增 `src/components/creation/CreationImageResultCard.jsx`，抽离图片结果卡的预览、下载、收藏、删除、批量选择和重新编辑展示组合；页面继续通过显式回调持有业务状态和副作用。
- 新增 `src/components/creation/CreationAudioResultCard.jsx`，抽离配音结果卡的播放、下载、删除、批量选择和重新编辑展示组合；音频状态与业务动作仍由结果容器/页面传入。
- 新增 `src/components/creation/CreationResultState.jsx`，抽离结果列表扁平化、图片/视频/配音结果卡组合、无限滚动、自动填充、加载状态、重新编辑、视频尾帧回填和底部输入卡展示。
- `CreationResultState` 通过 `renderInputCard` 显式接入页面内 `InputCard`；不读取 `CreationPage.jsx` 闭包，不拥有生成请求、历史请求、任务轮询、缓存、Toast 或 Store 写回。结果卡编辑和尾帧操作所需的详情读取 API 由组件显式调用。
- 新增 `src/components/creation/CreationEmptyState.jsx`，抽离图片/视频/配音空态图标和空历史布局；组件通过 `renderInputCard` 显式接入页面内 `InputCard`，不调用 API、Store、Toast 或生成请求。
- 页面 `CreationPage.jsx` 当前实际为 `2623` 行；页面顶部结构索引已同步，旧结果区、空态图标和真人素材弹窗局部组件定义已删除，结果区和空态均显式传入输入卡渲染回调。
- 引用安全：已核对 `CreationResultState`、`CreationEmptyState` 的导入、目录导出和调用参数；`onDraftContentChange`、旧结果/空态局部定义和失效组件引用搜索无结果。
- 新增 `src/components/creation/CreationLiveMaterialModal.jsx`，抽离真人素材组/素材卡片、扫码认证、素材上传审核轮询、重命名、删除、全屏预览和选择确认；组件通过 `src/components/creation/index.js` 导出。
- `InputCard` 通过显式 `open`、`onClose`、`onConfirm`、`initialSelected` 接入真人素材弹窗，并负责把返回的元数据转换为生成请求使用的 file-like 对象；生成 API、任务轮询、缓存、Toast 和 Store 写回未下沉。
- 引用安全：全局搜索确认页面不再声明或导入旧 `LiveMaterialModal`，真人素材组件不读取 `CreationPage` 闭包；迁移后需以本轮验收命令结果为准。
- 新增 `src/components/creation/CreationAssetPickerModal.jsx`，作为创作域适配层复用通用 `AssetPickerModal`；普通参考素材和首尾帧选择统一通过显式 props 接线，保留 `accept` 过滤、预选资产和关闭时清理 `frameAssetTarget` 的行为。
- 新增 `src/components/creation/CreationDubbingVoiceModal.jsx`，迁移原 `src/pages/DubbingVoiceModal.jsx` 的官方/自定义/收藏音色、筛选、试听、上传和确认流程；通过 `components/creation/index.js` 导出，页面不再保留旧文件或旧导入。
- `CreationPage.jsx` 当前实际为 `2584` 行；页面仍保留 `files`、首尾帧、音色和弹窗开关状态，以及素材状态写入、模型能力限制、生成请求、任务轮询、缓存、Toast 和 Store 副作用。
- 静态边界：通用 `AssetPickerModal` 未搬动，因为它仍被主体页和多个分镜组件复用；新增创作域组件不读取 `CreationPage` 闭包，不调用生成 API 或 Store。
- 新增 `src/components/creation/CreationFileUtils.js`，统一导出文件类型判断、上传扩展名/accept、图片容量限制、最大文件数和模型素材上限裁剪辅助函数；`CreationPage` 与 `CreationUploadArea` 复用同一套图片大小规则，页面仍保留 `files`、首尾帧等状态写入与 Toast 副作用。
- 静态验收：素材适配工具、上传区、资产选择弹窗、配音选择弹窗和目录入口通过定向 ESLint；构建、架构检查、差异检查与旧引用搜索需以本轮命令结果为准。`CreationPage.jsx` 完整定向 ESLint 仍包含迁移前历史问题，不将其误报为本轮组件迁移通过。
- 下一步：`useCreationInputFiles` 已完成静态验收；继续核对运行时边界和 `InputCard` 剩余业务接线，具备登录态后进行关键流程回归。

## 2026-07-16 CreationPage 素材状态 Hook 迁移记录

- 新增 `src/components/creation/useCreationInputFiles.js`，统一管理普通参考素材列表、首帧/尾帧文件、模型素材上限裁剪、文件删除和本地 Blob URL 创建/释放。
- Hook 公开 `replaceFiles`、`clearFiles`、`clearFrameFiles`、`swapFrameFiles`、`handleFileSelect`、`removeFile` 和 `releaseFiles` 等显式接口；页面不再直接负责素材列表的生命周期清理。
- `InputCard` 仍负责提示词编辑、@素材标签、参数状态、资产/配音/真人素材弹窗接线以及生成参数组装；`CreationPage` 仍负责生成 API、任务轮询、缓存、Toast、Store 写回和历史业务编排。
- 发送成功时释放已提交的本地素材 Blob URL；发送失败时恢复普通素材和首尾帧，并保留资产 URL 不参与 Blob URL 释放。模型切换裁剪、生成类型切换、离开首尾帧模式和卸载清理均由 Hook 负责。
- 静态验收：`useCreationInputFiles.js`、`CreationUploadArea.jsx`、`CreationFileUtils.js`、资产/配音弹窗和创作目录入口定向 ESLint 通过；构建、架构检查、差异检查和失效引用搜索以本轮命令结果为准。完整页面 ESLint 仍保留历史问题，不将其混入 Hook 迁移结论。
- 本轮复核：`CreationPage.jsx` 当前实际为 `2490` 行，文件顶部结构索引已同步；Hook 的 Blob URL 释放增加同一 URL 去重保护，避免同一文件同时出现在普通素材/首尾帧或同时挂载多个字段时重复调用释放。
- 本轮验收：`npm run build`、`npm run check:architecture`、`git diff --check` 均通过，构建无超过 500KB 的 JavaScript 分块告警；完整页面定向 ESLint 为 `12 errors / 6 warnings`，均为页面入口既有问题。
- 引用搜索：未发现本轮新增的失效素材 Hook 接口或旧页面弹窗导入；`FrameUploadSlot` / `PanelUploadSlot` 的现有引用均来自有效的分镜目录导出。

## 2026-07-16 CreationPage 输入区弹窗组合接线迁移记录

- 新增 `src/components/creation/CreationInputOverlays.jsx`，统一组合资产选择、配音选择和真人素材三个输入区弹窗；组件只负责弹窗组合与显式 props 接线，不持有 `InputCard` 的素材状态、音色状态转换或生成参数组装。
- `CreationPage.jsx` / `InputCard` 仍通过显式回调传递开关、关闭、确认、首尾帧目标清理和真人素材初始选中项；`CreationInputOverlays` 内部导入弹窗本体，页面移除已被替代的三个旧弹窗导入，避免重复导入和未使用变量。
- 引用安全：已搜索 `CreationInputOverlays` 的导出、调用和三个内部弹窗引用；已搜索 `onDraftContentChange` 等已知失效引用，未发现本轮新增的未定义引用或旧弹窗调用残留。
- 当前页面规模：`CreationPage.jsx` 实际 `2485` 行，架构检查按末尾换行计 `2486` 行；`CreationInputOverlays.jsx` 为 `55` 行，顶部结构索引已同步。
- 静态验收：定向 ESLint 中新增组件及相关创作组件通过；`CreationPage.jsx` 仍为 `12 errors / 6 warnings`，与本轮迁移前一致，均属于页面历史 lint 问题；`npm run build`、`npm run check:architecture`、`git diff --check` 均通过，构建无超过 `500KB` 的 JavaScript 分块告警。
- 下一步：继续拆分 `InputCard` 的提示词交互边界；一次只移动明确区块，保持生成 API、任务轮询、缓存、Toast 和页面级 Store 副作用留在原边界。

## 当前验证记录

## 2026-07-16 创作页登录态安全验收记录

- 在登录态完成创作页非副作用参数交互验证：视频模式切换、全能参考/首尾帧模式切换、视频比例/分辨率/时长切换、配音情绪/语速切换、图片模型切换、图片分辨率/比例切换。
- 验收结果：参数选择后能正确回显，未捕获 `ReferenceError`、未定义变量、页面级控制台警告或选择器联动失效。
- 已针对已知迁移风险搜索 `onDraftContentChange`、`ModalToggle`、`toastFired`、`restoredShotIdsRef`，创作域未发现残留引用。
- 本轮未触发真实生成、上传或删除/下载动作；视频重新编辑回填、生成失败恢复、刷新任务恢复、生成后的配音参数重置和真实任务轮询仍为未验证项。
- 曾发现创作历史接口返回 `Internal Server...` 形式的非 JSON 响应，记录为后端接口返回格式/服务端异常，不归因于组件拆分；后端恢复后需单独复核。

## 2026-07-16 AssetsPage 当前静态基线

- `src/pages/AssetsPage.jsx` 当前实际为 `57` 行；页面顶部结构索引已按当前代码重新同步，页面只保留模块配置、模块切换和外框组合。
- 新增 `src/components/assets/AssetsProjectPanel.jsx`（当前 `506` 行）、`src/components/assets/AssetsProjectGrid.jsx`（当前 `76` 行）、`src/components/assets/AssetsProjectModals.jsx`（当前 `153` 行）和 `src/components/assets/AssetsCreativePanel.jsx`（当前 `358` 行），分别承载项目资产面板、按类别选择卡片、项目重命名/删除弹窗和创作资产业务状态；`src/components/assets/AssetsCards.jsx` 当前 `300` 行，承载两类资产卡片。
- 已抽离：筛选、分页、选中状态 Hook；项目/创作资产批量请求适配；标签栏、空态、批量工具栏、项目列表项、资产卡片媒体层、音频卡片与波形、创作资产详情组合、项目资产详情适配层及四类详情弹窗。
- 两个业务面板仍分别持有项目/创作资产 API、IntersectionObserver、删除/下载/收藏/Toast、详情数据和弹窗生命周期等副作用；页面入口不再持有这些实现。
- 静态验收已覆盖导入/导出、`useAssetSelection` 引用、目录入口循环依赖风险、旧 `AudioCard` 调用清理、未定义引用、定向 ESLint、构建、架构检查和差异检查；当前结果为资产域定向 ESLint `0 errors / 0 warnings`，构建、架构检查和差异检查通过。登录态副作用流程尚未完成。

## 2026-07-16 AssetsPage 页面入口收敛记录

- `AssetsPage.jsx` 已收敛为模块切换和页面外框，直接组合 `AssetsModuleTabBar`、`AssetsProjectPanel` 与 `AssetsCreativePanel`。
- 修复 `AssetsCreativePanel.jsx` 缺失的 `useAssetSelection` 引用；项目/创作资产面板改为直接引入具体组件文件，不再从 `./index` 反向引用，降低目录入口循环依赖和导出错配风险。
- 行为边界保持：项目/创作资产 API、筛选、分页、批量操作、收藏、详情弹窗和 Toast 均保留在业务面板；本轮未扩大删除、下载、上传或真实生成等外部副作用范围。
- 验证：资产域定向 ESLint `0 errors / 0 warnings`；`npm run build`、`npm run check:architecture`、`git diff --check` 均通过。当前架构告警只剩 `CreationPage`、`Home`、`StoryboardPage`、`SubjectPage`。
- 下一步：继续将 `AssetsProjectPanel.jsx` 的项目重命名/删除弹窗、项目资产卡片网格和项目动作编排按职责拆出，再处理其余页面规模告警。

## 2026-07-16 AssetsProjectPanel 业务区块继续收敛记录

- 新增 `AssetsProjectModals.jsx`，抽离项目重命名和项目删除弹窗；弹窗只接收值、显示名称和确认/关闭回调，不调用项目 API。
- 新增 `AssetsProjectGrid.jsx`，统一按项目资产类别选择 `AssetsAudioCard`、`ProjectAssetCard` 和 `AssetCard`，卡片操作通过显式 props 返回面板。
- `AssetsProjectPanel.jsx` 从 `784` 行降至 `506` 行；项目 API、筛选分页、批量删除/下载、详情数据和 Toast 副作用继续保留在业务面板。
- 验证：资产域定向 ESLint `0 errors / 0 warnings`；`npm run build`、`npm run check:architecture`、`git diff --check` 均通过。当前架构告警只剩 `CreationPage`、`Home`、`StoryboardPage`、`SubjectPage`。
- 后续不为降低行数强行搬动项目 API 和状态；先评估剩余项目动作、筛选分页和批量副作用是否形成稳定可复用边界，再进入其他页面规模告警。

## 2026-07-16 AssetsPage 音频卡片与静态收尾记录

- 新增 `src/components/assets/AssetsAudioCard.jsx`，迁移音频资产卡片、波形条、播放视觉态、收藏动画和下载/删除操作展示；页面仅传入名称、时长、收藏/批量状态和显式回调。
- `src/components/assets/index.js` 已新增 `AssetsAudioCard` 目录导出；项目资产和创作资产的音频分支均改为使用该组件。
- 页面不再声明或调用旧 `AudioCard`、`WaveformBars`；迁移后曾发现两处残留 `<AudioCard>` 调用并已修复，随后定向 ESLint 复验通过，避免把导入缺失伪装成构建完成。
- 同轮清理未接入的历史 mock、收藏筛选控件、无效页面 props，并修正资产加载 effect/ref 的引用边界；API 请求、分页观察器、Store、Toast 和删除/下载副作用仍保留在页面面板。
- 验证：目标文件和资产组件定向 ESLint `0 errors / 0 warnings`；`npm run build`、`npm run check:architecture`、`git diff --check` 均通过。架构检查仍只报告历史页面规模告警。
- 未完成：登录态下的项目切换、筛选、分页/滚动、音频卡片交互、详情打开/关闭、批量模式、收藏切换和刷新恢复尚未全部回归；删除、下载、上传和真实生成继续暂缓。

## 2026-07-16 AssetsPage 登录态非破坏性验收记录

- 已验证项目资产/创作资产切换、项目切换、项目资产分类（角色、场景、道具、分镜图、分镜视频、音频、成片）、创作资产分类（图片、视频、配音）、批量模式进入/退出、资产选择/取消选择、项目资产详情打开/关闭、创作图片详情打开/关闭、创作资产卡片悬停操作、收藏切换、离开页面后重新进入和刷新后重新加载；测试前收藏状态已恢复。
- 控制台结果：未发现 `ReferenceError`、未定义变量或 props、页面级控制台错误和页面级控制台警告。
- 明确未执行删除、下载、上传和真实生成等外部副作用操作。当前测试数据下滚动容器没有溢出（`scrollHeight === clientHeight`），所以没有触发分页请求；该边界不能记录为分页完整通过。创作资产配音分类可以切换，但当前数据为空，只验证了分类切换和空状态，未验证真实音频播放/收藏。
- 验收后职责复核结论：`AssetCard` 与 `ProjectAssetCard` 暂不继续强拆。两者仍分别持有创作/项目资产详情生命周期、详情 API 组合、视频悬停状态和业务回调，当前没有稳定且收益明确的通用 props 契约；继续拆分可能增加引用遗漏风险。已抽离的媒体层、详情适配层、详情弹窗、筛选/分页/选中 Hook 和批量适配层作为当前稳定边界保留。
- 静态验证：AssetsPage 及资产相关文件定向 ESLint `0 errors / 0 warnings`；`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过。构建最大 JavaScript 分块约 441KB，无超过 500KB 告警；架构检查仅保留历史页面规模告警。全仓库 `npm run lint` 仍有历史问题，不能据此宣称全量通过。
- 当前尚未覆盖：分页真实触发、音频卡片真实播放和收藏、删除、下载、上传、更丰富的创作配音数据，以及全部详情类型的逐类业务回归。

## 2026-07-16 AssetsPage 只读边界补充验收记录

- 继续在登录态下完成项目资产全部分类的只读切换核对：角色、场景、道具、分镜图、分镜视频、音频和成片均能切换并正确回显选中态；当前数据中的角色详情弹窗可打开并关闭。
- 创作资产图片分类有 15 个图片元素，图片详情弹窗可打开并关闭；视频和配音分类可切换到空态，当前没有真实视频或音频卡片，因此不记录播放、收藏和媒体详情流程通过。
- 批量模式已验证进入、选择 1 项、显示“已选 1 项”和取消退出；项目切换后资产列表刷新，切回原项目后数据恢复；刷新后资产内容恢复。观察到刷新期间顶部用户区域显示登录/API 配置入口，未阻断资产数据展示，认证状态水合列入后续全量回归关注项。
- 通过只读 DOM 检查确认当前没有产生 `scrollHeight > clientHeight` 的滚动容器，因此没有触发真实分页请求；分页流程仍保持未验证。
- 页面本地日志没有发现 `localhost` 来源的错误或警告；出现的 `chrome-extension://` `fetchError` 来自浏览器扩展，不归因于 miioo 页面。
- 本轮没有执行上传、下载、删除、定稿、真实文件选择、音频播放或生成等外部副作用操作。下一步转入 `CreationPage` 剩余安全边界验收。

## 2026-07-15 CreationPage 选择器视觉实现迁移记录

- `src/pages/CreationPage.jsx`：将生成类型、模型、图片参数、参考模式、视频参数和配音参数选择器的视觉实现迁移到 `src/components/creation/`；页面继续持有参数状态、模型能力筛选、参数联动、生成请求、任务轮询、缓存和 Toast。
- 新增组件：`CreationSelectorPrimitives.jsx`、`CreationGenTypeSelector.jsx`、`CreationModelSelector.jsx`、`CreationImageParamsSelector.jsx`、`CreationRefModeSelector.jsx`、`CreationVideoParamsSelector.jsx`、`CreationDubbingAdjust.jsx`、`CreationSelectorConstants.js`。
- `CreationParamsControls.jsx` 继续负责按生成类型组合选择器；所有选择器通过显式 props 接收值、选项和回调，没有引用页面闭包、API、Store 或页面组件。
- 引用安全修复：`DEFAULT_EMOTIONS` 移入独立常量文件，由页面和配音选择器共同引入，避免迁移后页面在配音模式触发 `ReferenceError`。
- 页面规模：`CreationPage.jsx` 当前实际为 `4812` 行；选择器旧定义已从页面移除，页面保留 `InputCard` 的参数状态和业务编排。
- 验证：选择器组件定向 ESLint、`npm run build` 和差异检查通过；页面历史 lint 问题仍单独保留，未伪报全量 lint 通过。
- 下一步：继续拆分 `StoryboardPage` 的批量工具栏和生成面板组合，不移动 API、任务轮询和持久化副作用。

## 2026-07-15 AssetsPage 首轮核对与 CreationPage 首轮迁移

- `AssetsPage.jsx` 最新实际行数为 `3422`；架构检查脚本计数为 `3423`。已验证 `AssetsScrollableContent` 的导入/导出、滚动容器、分页哨兵和加载节点只保留一份。
- AssetsPage 当前已抽离：标签栏、模块标签、空态、批量工具栏、项目列表项、资产更多菜单、资产卡片媒体层、创作资产详情组合、项目资产详情适配层、项目资产滚动展示层。
- AssetsPage 仍保留：项目/创作资产 API、筛选与分页状态、IntersectionObserver、批量删除/下载、详情弹窗本体、Toast 和业务副作用；历史遗留 `favOnly` / `FavFilterCheckbox` 未擅自恢复。
- `CreationPage.jsx` 顶部 Tab、批量操作和清空历史展示层已抽离到 `src/components/creation/CreationToolbar.jsx`，Tab 常量位于 `CreationTabs.js`，通过 `components/creation/index.js` 统一导出。
- CreationToolbar 只接收显式 props，不引用 API、Store 或页面；页面继续负责 `activeTab`、`batchMode`、`selected`、删除确认、下载、清空历史和切换生成类型。
- CreationPage 行为保持：Tab 与 `genType` 同步、批量全选/下载/删除/取消、清空历史确认和清空提示均由原页面回调继续执行；已补回原有图标、悬停/按下反馈和清空历史 hover 提示。
- `CreationPromptEditor` 已接入 `InputCard`，负责提示词编辑 DOM、按生成类型切换占位提示、@素材菜单和已选素材卡片展示；编辑事件、素材删除/插入、引用状态和生成请求仍由 `InputCard` 持有。
- CreationPage 最新实际行数为 `5949`，架构检查脚本计数为 `5950`；本轮继续抽离上传/首尾帧入口、文件卡片和参数选择组合层。页面历史 lint 问题仍未混入本轮专项处理。
- 验证：新 Creation 组件定向 ESLint、`git diff --check`、`npm run build` 通过；CreationPage 定向 ESLint 仍受迁移前历史问题阻塞，未发现本轮新增的组件 lint 错误。

## 2026-07-15 CreationPage 输入区首轮迁移记录

- 新增 `src/components/creation/CreationPromptEditor.jsx`，并通过 `src/components/creation/index.js` 导出。
- 组件仅接收显式 props：编辑器 ref、生成类型/参考模式、素材列表、提示词事件、失焦处理、@素材选择状态和素材卡片渲染回调；不引用页面、API、Store 或生成任务状态。
- 页面继续负责 `handleInput`、`handleKeyDown`、`handlePaste`、光标保存、@引用状态、素材删除/插入、文件上传、AssetPickerModal、生成请求和任务轮询。
- 保持原有交互：图片/视频/配音占位提示、全能参考/首尾帧/智能多帧提示、素材卡片位置、@素材过滤和键盘/鼠标选择行为不改变。
- 引用安全核对：`CreationPromptEditor`、`CreationToolbar`、`CreationTabs` 的导入/导出一致；旧 `creationTabs` 路径无残留；新增组件定向 ESLint 通过。
- 验证：`npm run build`、`npm run check:architecture`、`git diff --check` 通过；架构检查仅报告历史超长页面告警。
- 下一步：迁移选择器的视觉实现；不搬动 `handleSend`、API、Store、任务轮询和缓存副作用，完成后进入 `StoryboardPage`。

## 2026-07-15 CreationPage 上传区、文件卡片与参数组合迁移记录

- 新增 `CreationUploadArea.jsx`：统一普通上传、资产库入口、视频首尾帧槽位和配音上传入口组合；文件校验后的状态写入、`AssetPickerModal`、配音弹窗和业务回调仍由 `InputCard` 持有。
- 新增 `CreationFileCard.jsx` 与 `CreationFileUtils.js`：统一图片/视频/普通文件卡片和文件类型判断，页面继续负责文件状态、Blob URL 释放和素材标签插入。
- 新增 `CreationParamsControls.jsx`：按 `image` / `video` / `dubbing` 组合生成类型、模型、配音、图片和视频参数选择器；组件通过显式 props 接收页面状态和回调，不读取页面闭包。
- 本轮尚未迁移选择器的视觉实现；`GenTypeSelector`、`ModelSelector`、`ParamsSelector`、`RefModeSelector`、`VideoParamsSelector` 和 `DubbingAdjust` 暂由页面定义后通过 props 注入，下一轮再逐个迁移到 `components/creation/`。
- CreationPage 最新实际行数为 `5949`，架构检查脚本计数为 `5950`；生成请求、任务轮询、缓存、Toast、模型加载和参数状态仍由页面编排。
- 验证：参数组合组件定向 ESLint、`npm run build`、`npm run check:architecture`、`git diff --check` 通过；构建无新增 500KB 以上分块告警。

## 2026-07-15 规范重写同步

- 重写项目总规则、页面架构、组件架构、状态管理、导入边界、页面迁移、API 和设计系统规范。
- `AGENTS.md` 与 `CLAUDE.md` 以及三个专项目录下的对应文件已逐字一致。
- 页面警告线统一为：页面入口 300 行、通用 UI 250 行、业务区块 400 行、Hook 300 行、单函数 50 行；当前均为警告线，不作为无条件阻断。
- 当前代码规模以文件实际行数为准；架构脚本按末尾换行分割时可能比编辑器显示多计 1 行，不影响告警判断。

## 2026-07-15 第十五轮迁移记录

- `src/pages/SubjectPage.jsx`：新增 `src/components/subject/SubjectTaskPolling.js`，统一读取主体任务状态、终态和按主体结果。
- `SubjectTaskPolling` 仅提供无副作用纯函数：兼容 `status` / `raw_status`，集中维护 `completed` / `partial` / `failed` 终态集合，并安全读取 `results`。
- 三条主体任务路径统一接入：单主体生成后的轮询、刷新后批量任务恢复、刷新后单主体任务恢复。
- 页面边界保持不变：`SubjectPage` 继续负责 API 请求、3 秒轮询循环、详情回退、React 状态更新、生成缓存、Toast、异常日志和任务持久化。
- 风险检查：未改变任务 ID、主体 ID 的兼容判定、终态集合和失败清理行为；新增工具通过主体组件入口导出，避免页面绑定内部文件路径。

## 2026-07-15 第十四轮迁移记录

- `src/pages/SubjectPage.jsx`：将主体生图响应中的任务 ID、图片 URL、图片 ID 和错误消息字段读取统一接入 `SubjectGenerationResult` 纯函数。
- 新增组件域工具：`src/components/subject/SubjectGenerationResult.js`，导出 `extractSubjectImageResult` 与 `getSubjectGenerationErrorMessage`；不引用 React、API、Store 或 Toast。
- 接入范围：单主体同步生成、单主体任务轮询、批量任务恢复、刷新后的单主体任务恢复，以及详情恢复结果；页面继续负责占位图、缓存、状态更新、任务持久化和 Toast。
- 行为保持：兼容 `_taskId` / `taskId` / `task_id`、`image_url` / `imageUrl` / `url`、`image_id` / `imageId` / `id` 及多种错误消息字段，未改变生成参数、轮询终态和失败清理流程。
- 风险检查：主体域入口已补充新工具导出；未定义引用扫描无结果；新增纯函数定向 ESLint 与 `git diff --check` 通过。
- 当前 `SubjectPage.jsx`：`2151` 行；本轮不搬动整个生成回调，继续保留页面级副作用边界。

## 2026-07-15 第十一轮迁移记录

- `src/pages/SubjectPage.jsx`：抽离主体音色选择弹窗到 `src/components/subject/SubjectVoiceSelectModal.jsx`。
- 新增组件：`SubjectVoiceSelectModal`，负责音色库加载、中文音色筛选、性别/年龄筛选、四列音色网格、试听、取消和确认布局。
- 复用基础组件：性别和年龄筛选统一使用 `src/components/ui/Select`；关闭、取消和确认动作使用 `IconButton` / `Button`。
- 组件边界：弹窗仅通过 `open`、`currentVoice`、`onClose`、`onConfirm`、`onVoicesLoaded` 与页面通信；主体音色保存 API、主体列表状态和 Toast 仍由 `SubjectPage` 持有。
- 行为保持：打开时调用 `apiGetVoiceLibrary({ provider: 'miioo', skipCache: true })`，只展示中文音色，试听音频在卡片内部清理，确认时先回调页面保存逻辑再关闭弹窗。
- 页面规模：`SubjectPage.jsx` 从约 2729 行降至 2427 行，移除页面内音色筛选器、试听图标、音色卡片和弹窗实现约 300 行。
- 风险检查：已移除旧 `VoiceSelectModal` 及 `apiGetVoiceLibrary` 页面导入，统一通过主体组件目录入口接入；未发现 `VoiceSelectModal`、`SelectField`、`VoiceCard` 等遗留引用。
- 本轮验证：`git diff --check`、主体音色组件定向 ESLint、`npm run build`、`npm run check:architecture` 均通过；架构检查仅输出历史超长页面告警。

## 2026-07-15 第十二轮迁移记录

- `src/pages/SubjectPage.jsx`：抽离顶部工具栏和主体标签导航，页面入口仅保留页面级状态、列表切换清理和业务回调。
- 新增组件：`src/components/subject/SubjectToolbar.jsx`、`SubjectTabs.jsx`、`subjectTabs.constants.js`，并通过 `src/components/subject/index.js` 统一导出。
- `SubjectToolbar` 负责项目返回、添加主体、批量生成和开始智能分镜的视觉与回调透传；API、Toast、批量生成状态和分镜确认逻辑仍由页面持有。
- `SubjectTabs` 负责角色/场景/道具标签及数量气泡展示；`activeTab`、主体选中项清理和列表状态切换仍由页面持有。
- 组件边界：新组件不引用页面、API、Store；标签常量单独放置，避免组件文件同时导出常量触发 Fast Refresh 规则。
- 风险检查：已删除页面内 `GhostButton`、`PrimaryButton`、`Toolbar`、`TabNav` 和 `TABS` 实现，并全局搜索确认无遗留引用；新组件定向 ESLint 通过。
- 页面规模：`SubjectPage.jsx` 当前 `2211` 行；本轮移除页面工具栏和标签导航实现约 `250` 行。

## 2026-07-15 第十轮迁移记录

- `src/pages/SubjectPage.jsx`：抽离 `EditSubjectPanel` 的标题和关闭动作到主体业务域组件。
- 新增组件：`src/components/subject/SubjectPanelHeader.jsx`，通过 `src/components/subject/index.js` 统一导出，并复用 `src/components/ui/IconButton`。
- 组件边界：`SubjectPanelHeader` 只负责标题展示、关闭按钮视觉和 `onClose` 回调，不调用 API、不读取 Store、不依赖页面入口。
- 行为保持：原有关闭回调、标题文案、28px 关闭按钮尺寸和 hover 视觉保持不变；页面仍负责遮罩关闭和面板生命周期。
- 风险检查：移除页面内 `closeHovered` 状态及重复关闭按钮实现，接线使用统一导出；未改变 `EditSubjectPanel` 的业务状态、请求和生成流程。

## 2026-07-15 第九轮迁移记录

- `src/pages/SubjectPage.jsx`：抽离 `EditSubjectPanel` 底部生成动作区，页面继续持有提示词、模型、比例、分辨率、参考图、生成方式和任务恢复状态。
- 新增组件：`src/components/subject/SubjectGenerationAction.jsx`，通过 `src/components/subject/index.js` 统一导出，并复用 `src/components/ui/Button`。
- 组件边界：`SubjectGenerationAction` 只负责底部布局、生成按钮视觉和 `onGenerate` 回调，不引用 API、Store、Toast 或页面状态。
- 行为保持：生成参数组装、单主体重复生成保护、占位图、同步/异步结果处理、任务轮询、跨弹窗缓存、封面同步和 Toast 均保留在 `SubjectPage`。
- 页面规模：`SubjectPage.jsx` 从 3383 行降至约 2809 行；本轮生成按钮视觉实现移除约 30 行，底部动作区职责已明确分层。
- 风险检查：新增组件无页面反向依赖；接线使用统一导出；未改变 `onGenerate` 业务回调契约，重点防止引用缺失和 import/export 不一致。

- 本轮 `npm run build`：通过；已消除 500KB 以上分块告警，并统一 `ApiConfigModal` 对 `src/api/config.js` 的静态导入。
- 本轮 `npm run check:architecture`：通过；仅输出既有超长页面告警。
- `npm run lint`：失败（297 个错误、64 个警告），主要来自仓库历史文件；本轮只修复了明确的迁移接线问题，未批量改动历史 lint。

- `npm run build`：通过；当前无 500KB 分块告警，也无 `src/api/config.js` 动态/静态导入冲突。
- `npm run check:architecture`：通过；历史超长页面输出告警，不阻断检查。
- 针对性 ESLint：`src/components/ui`、`ProjectList.jsx`、`ButtonShowcase.jsx` 通过；`GlobalSettings.jsx` 和 `ScriptPage.jsx` 仍有迁移前已存在的未使用变量和 effect 规则问题，未在本轮改动自动保存、流式请求和选择器状态同步逻辑。

## 2026-07-15 第八轮迁移记录

- `src/components/BatchGenerateModal.jsx`：移除弹窗内重复的 `SelectField` 和箭头图标实现，模型、比例、分辨率三组选择器统一复用 `src/components/ui/Select.jsx`。
- `src/components/ui/Select.jsx`：补充 `displayValue`、加载文案、选中项颜色/背景、悬停背景、菜单高度和展开态阴影等可选参数，既支持主体页默认视觉，也支持批量生成弹窗沿用原白色选中态和 240px 菜单高度。
- 行为保持：模型选中回调仍传模型 `value`；比例和分辨率回调仍传对应 `value`；模型能力拉取、弹窗重置、分辨率/比例联动和 `onConfirm({ model, ratio, resolution, mode, only_undrafted })` 参数结构未改变。
- 风险检查：已移除 `BatchGenerateModal` 对 `useRef`、局部 `SelectField` 和重复 `ChevronDownIcon` 的依赖；文件顶部结构索引已同步。
- 本轮验证：`git diff --check`、定向 ESLint、`npm run build`、`npm run check:architecture` 均通过；架构检查仅输出既有超长页面告警。

## 2026-07-15 第六轮迁移记录

- `src/pages/SubjectPage.jsx`：删除已迁移的页面内 `MoreMenu`、`CharCard`、`AddCard` 重复实现，主体列表网格统一通过 `SubjectGrid` 编排。
- 新增组件：`src/components/subject/SubjectGrid.jsx`、`src/components/subject/SubjectCard.jsx`。
- `SubjectCard` 负责角色/场景/道具卡片、更多操作菜单、下载、删除确认、新增卡片和角色音色试听；业务请求与页面状态通过回调保留在页面入口。
- 行为保持：卡片选择、主体删除确认、主体图片下载、批量生成 loading、空态图标、滚动加载哨兵和角色音色选择回调均保持原回调边界。
- 页面规模：`SubjectPage.jsx` 从 3904 行降至 3621 行，减少 283 行；编辑面板、批量动作和页面生命周期仍待后续拆分。
- 未迁移：`EditSubjectPanel` 及其图片/参考图子组件、页面工具栏、音色选择弹窗；这些区域仍依赖主体 API、弹窗或页面级状态，下一轮按业务边界继续拆分。

## 2026-07-15 第七轮迁移记录

- `src/pages/SubjectPage.jsx`：抽离编辑主体右侧图片列表、上传卡片、图片卡片和媒体详情弹窗组合。
- 新增组件：`src/components/subject/SubjectImageList.jsx`。
- `SubjectImageList` 负责右侧图片区布局、图片数据映射、详情弹窗、上传入口、图片查看/下载/定稿回调透传；页面继续负责上传接口、下载接口、定稿接口、封面同步和 Toast。
- 行为保持：本地上传 20M 限制、资产库选择、参考图标记、候选图定稿、下载成功/失败提示、详情弹窗参数和图片索引均保持原边界。
- 页面规模：`SubjectPage.jsx` 从 3621 行降至 3383 行，本轮减少 238 行；`EditSubjectPanel` 的模型/比例/分辨率、参考图、生成任务和恢复逻辑仍待后续拆分。

## 2026-07-15 第四轮迁移记录

- 新增组件：`src/components/script/EpisodeItem.jsx`、`EpisodeList.jsx`，并通过 `src/components/script/index.js` 统一导出。
- `src/pages/ScriptPage.jsx`：抽离 `EpisodeItem` 与 `EpisodeList`，页面只保留分集数据、选中索引和 `onSelect` 回调编排。
- 行为保持：分集标题层级缩进、选中态、悬停态、生成中的骨架占位和“等待剧本生成”空态均保持原实现。
- 组件边界：分集导航依赖剧本领域语义，放入 `src/components/script/`，不下沉到通用 `components/ui/`。

## 2026-07-15 第五轮迁移记录

- `src/pages/ScriptPage.jsx`：抽离会话输入区 `InputCard`、无剧本空状态 `ScriptEmptyState` 及上传入口、模型选择器、集数选择器、发送按钮、文件卡片。
- 新增组件：`src/components/script/InputCard.jsx`、`ScriptEmptyState.jsx`、`UploadPlaceholder.jsx`、`ModelSelector.jsx`、`EpisodeCountSelector.jsx`、`SendButton.jsx`、`FileCard.jsx`、`ScriptInputStyles.js`。
- 页面职责：保留输入区所需的页面状态、`handleSend` / `handleStop` 回调和恢复数据，通过 `src/components/script/index.js` 统一引入业务组件。
- 行为保持：模型加载和默认模型选择、文件格式/大小/字符数校验、草稿缓存上下导航、发送后清空、生成中停止、超时恢复输入等行为未改变。
- 组件边界：输入组件位于剧本业务域，可引用剧本 API、草稿缓存和基础 UI；未引用页面入口、页面 Store 或 Toast 实现。
- 当前 `ScriptPage.jsx`：约 626 行；输入区、编辑器域、分集导航域、ScriptPanel 和流式展示域已完成首轮抽离，页面保留状态、接口请求、生命周期和业务编排。
- 新增剧本展示组件：`AiThinkingMessage`、`AiStreamingContent`、`ScriptRendered`、`ScriptPanel`、`ScriptDisplayStyles`；统一从 `src/components/script/index.js` 导出。
- 行为保持：SSE 逐字渲染、后台标签页跳帧、暂停回调去重、自动滚动、手动滚动脱离、分集标题侦测、最后一集底部占位、编辑/定稿/取消/提取主体动作均保持原回调和视觉结构。
- 本轮验证：`git diff --check`、`npm run build`、`npm run check:architecture` 均通过；本地浏览器已验证首页加载、项目页懒加载、项目入口和登录弹窗渲染，未捕获运行时错误。

## 2026-07-16 AssetsPage 主体资产详情弹窗迁移记录

- 新增 `src/components/assets/SubjectAssetDetailModal.jsx`，从 `AssetsPage.jsx` 抽离主体资产多图详情弹窗。
- 组件负责主体图片预览、缩略图切换、定稿状态、参考图、提示词复制、生成参数、创建时间、删除确认、下载和关闭交互。
- 组件通过显式 props 接收 `onClose`、`onDownload`、`onDeleteImage`、`onShowToast`、`name`、`description` 和 `images`；不引用页面闭包、API 或 Store。
- `src/components/assets/index.js` 已新增统一导出；`ProjectAssetDetail` 继续通过显式组件 props 注入，页面仍持有删除、下载、Toast 和弹窗生命周期回调。
- 页面规模：`AssetsPage.jsx` 从 `3393` 行降至当前 `3039` 行；架构检查按文件末尾换行计 `3040` 行。
- 引用安全：旧页面定义已删除，新增组件定向 ESLint 为 `0 errors / 0 warnings`；全局搜索未发现重复定义或失效调用。
- 静态验收：`npm run build`、`npm run check:architecture`、`git diff --check` 通过；构建无超过 500KB 的 JavaScript 分块告警。
- 未完成：其他项目资产详情弹窗（`AssetDetailModal`、`ShotDetailModal`、`ShotVideoDetailModal`）仍在页面内；浏览器登录态关键流程尚未验证。

## 2026-07-16 AssetsPage 普通图片详情弹窗迁移记录

- 新增 `src/components/assets/AssetDetailModal.jsx`，从 `AssetsPage.jsx` 抽离普通图片资产详情弹窗。
- 组件负责图片预览、缩略图切换、定稿状态、名称/描述、提示词、生成参数、生成时间、下载和关闭交互；默认 mock 数据与 `useModalSize`、占位图等内部依赖随组件迁移。
- 组件通过显式 props 接收 `onClose`、`onDownload`、`name`、`description`、`prompt`、`model`、`ratio`、`resolution`、`generatedAt` 和 `images`；不引用页面闭包、业务 API 或 Store。
- `src/components/assets/index.js` 已新增统一导出；`AssetCard` 仅负责详情 API 结果映射和页面级打开/下载回调，调用方与导出名称一致。
- 页面规模：`AssetsPage.jsx` 从 `3039` 行降至当前 `2798` 行；架构检查按文件末尾换行计 `2799` 行。
- 引用安全：页面旧 `AssetDetailModal` 与 `MOCK_DETAIL` 定义已删除，迁移后全局搜索未发现失效引用；新组件定向 ESLint 为 `0 errors / 0 warnings`。
- 静态验收：`npm run build`、`npm run check:architecture`、`git diff --check` 通过；构建无超过 500KB 的 JavaScript 分块告警。
- 未完成：`ShotDetailModal`、`ShotVideoDetailModal` 仍在页面内；AssetsPage 完整 lint 仍有 `13 errors / 3 warnings` 的历史问题，浏览器登录态关键流程尚未验证。

## 2026-07-16 AssetsPage 分镜图片详情弹窗迁移记录

- 新增 `src/components/assets/ShotDetailModal.jsx`，从 `AssetsPage.jsx` 抽离分镜图片详情弹窗，并通过 `src/components/assets/index.js` 统一导出。
- 组件负责分镜图片预览、缩略图切换、定稿状态、参考图、提示词复制、生成参数、生成时间、删除确认、下载和关闭交互；复制提示使用组件内部状态，不依赖页面 Toast 闭包。
- 组件通过显式 props 接收 `onClose`、`onDownload`、`onDelete`、`onShowToast`、`shotNumber`、`prompt`、`model`、`resolution`、`generatedAt`、`images` 和 `refImages`；不引用页面 API、Store 或未声明变量。
- `AssetCard` 直接使用目录导入的 `ShotDetailModal`；`ProjectAssetDetail` 继续通过显式组件 props 注入，详情 API、删除、下载、Toast 和弹窗生命周期仍由页面/适配层持有。
- 页面规模：`AssetsPage.jsx` 当前实际 `2456` 行；架构检查按末尾换行计 `2460` 行。
- 引用安全：页面旧 `ShotDetailModal` 与 `MOCK_SHOT_DETAIL` 定义已删除；全局搜索确认导入、导出和 `ProjectAssetDetail` 注入一致；组件与相关资产组件定向 ESLint 为 `0 errors / 0 warnings`。
- 静态验收：`npm run build`、`npm run check:architecture`、`git diff --check` 通过；构建无超过 500KB 的 JavaScript 分块告警。
- AssetsPage 完整 lint 当前为 `11 errors / 3 warnings`，属于页面已有的 `isHov`、未使用 mock/变量和 Effect 规则等历史问题；`ShotDetailModal` 迁移未引入新的页面 lint 问题。
- 未完成：`ShotVideoDetailModal` 仍在页面内；浏览器登录态关键流程尚未验证。

## 2026-07-16 CreationPage 刷新任务恢复适配迁移记录

- 新增 `src/utils/creationTaskAdapter.js`，统一校验和标准化 localStorage 中的任务快照、恢复占位 generation、图片/视频/配音轮询结果字段和媒体地址转换。
- `CreationPage.jsx` 仅调用适配函数；刷新任务恢复的轮询、Store 删除/写回、缓存失效、Toast、并发计数和生命周期副作用仍由页面持有。
- 适配工具只接收任务快照和轮询结果并返回新对象，不调用 API、Store、缓存、Toast 或 React 状态；无隐式页面闭包依赖。
- 当前页面规模为 `1950` 行；架构检查按末尾换行计 `1951` 行。页面与任务适配工具定向 ESLint、失效引用搜索通过；全仓库 lint、构建、架构检查和差异检查也已复跑通过。
- 验收边界：静态检查未发现新的未定义引用、导出错配或构建体积告警；真实刷新任务恢复、失败清理和结果写回仍待登录态安全测试条件具备后验证。
- 下一步：先补齐创作页刷新任务恢复、失败清理和结果写回的运行时验证，再处理剩余页面规模告警；不为了压缩行数强拆页面副作用。

## 2026-07-16 CreationPage 未登录任务恢复边界修复记录

- `src/pages/CreationPage.jsx` 的刷新任务恢复 effect 现在先判断 `isLoggedIn`；未登录时不读取、不清空、不轮询 `miioo_pending_tasks`，登录后才执行快照消费和任务恢复。
- 这样避免未登录状态直接调用需要鉴权的轮询接口，也避免页面先以未登录状态挂载时误消费待恢复任务；任务快照会保留到登录状态建立后处理。
- 已在未登录创作页确认页面正常渲染，未发现页面级错误；受限于当前无安全登录态和测试任务，真实刷新任务恢复、失败清理和结果写回仍未验证。
- 页面当前实际 `1886` 行，架构检查统计 `1887` 行；结构索引已同步新增登录态边界和未登录空态组件说明。
- 下一步：在安全登录态和测试任务条件具备后验证恢复成功、无媒体结果失败清理、轮询异常清理和结果写回，再处理剩余页面规模告警。

## 2026-07-16 CreationPage 未登录空态拆分记录

- 新增 `src/components/creation/CreationLoginEmptyState.jsx`，负责未登录提示、登录按钮和空态布局。
- 页面通过显式 `onLoginClick` 接入组件；未移动任务轮询、生成 API、Store、Toast、缓存或页面副作用。
- 已核对目录导出、页面导入、调用参数和旧页面定义，避免出现缺失引用或默认导出错配。
- `CreationPage.jsx` 当前实际 `1886` 行，架构检查统计 `1887` 行；本轮只完成静态拆分，运行时任务恢复仍未验证。
- 下一步：先复跑完整静态门禁，再在安全登录态和测试任务条件具备后验证刷新任务恢复、失败清理和结果写回。

## 2026-07-16 CreationPage 历史数据适配迁移记录

- 新增 `src/utils/creationHistoryAdapter.js`，统一历史列表响应解包、图片/视频/配音记录标准化、视频参考素材字段转换、历史缓存轻量字段裁剪和缓存响应外层结构保持。
- `CreationPage.jsx` 继续持有历史 API、缓存读写、分页、收藏同步、Store 更新和生命周期副作用；适配工具只接收数据并返回新对象，不调用 API、Store、缓存或 React 状态。
- 该历史记录创建时页面实际为 `1993` 行；当前最新行数和状态以本清单顶部状态表及“刷新任务恢复适配迁移记录”为准。
- 下一步：按安全登录态验证历史加载、分页、刷新恢复和失败清理；不搬动任务轮询、Toast、缓存、Store 写回和生成 API。

## 2026-07-16 CreationPage 提示词交互 Hook 迁移记录

- 新增 `src/components/creation/useCreationPromptInteraction.js`，统一管理 `contentEditable` 编辑器、`@` 素材标签创建/替换/删除、光标保存与恢复、键盘菜单、图片/视频/音频/文本粘贴、提示词预填充、生成失败恢复和文件移除后的标签清理。
- `CreationPage.jsx` 的 `InputCard` 通过 Hook 的显式返回接口接入编辑器 ref、内容状态、提示词事件、素材卡片插入、快照/清空/恢复能力；页面不再直接持有提示词交互内部的光标、菜单和标签状态。
- `InputCard` 仍负责模型、比例、分辨率、数量、时长、参考模式、音效和配音参数状态，资产/配音/真人素材弹窗接线及生成参数组装；生成 API、任务轮询、缓存、Toast 和 Store 写回继续由页面层持有。
- `CreationPage.jsx` 当前实际行数为 `2169`；架构检查脚本按末尾换行计数为 `2170`，状态仍为“首轮迁移进行中”。
- 引用安全：已搜索 `formatMentionLabel`、`buildTagElement`、`mentionTargetTag`、`onDraftContentChange`、`setHasContent`、`savedCursorRangeRef` 等旧提示词引用，未发现迁移后新增的失效调用或未定义引用。
- 静态验收：新增提示词 Hook、编辑器、弹窗组合和相关目录入口执行定向 ESLint；随后执行构建、架构检查和 `git diff --check`，结果记录以本轮命令输出为准。
- 未完成：浏览器登录态和真实生成失败恢复尚未验证；下一步评估 `InputCard` 参数状态 Hook 与生成参数组装边界，不移动页面级 API、轮询、缓存、Toast 或 Store 副作用。

## 2026-07-16 CreationPage 输入区视觉组合拆分记录

- 新增 `src/components/creation/CreationInputSurface.jsx`，抽离输入卡片的布局、悬浮边框、上传区、提示词编辑器、参数控制、发送按钮和弹窗组合接线。
- `InputCard` 通过 `upload`、`prompt`、`controls`、`send`、`overlays` 五组显式配置接入视觉组件；素材状态、参数状态、生成参数组装、失败恢复和页面业务回调仍由 `InputCard` 持有。
- `CreationInputSurface` 不读取 `CreationPage.jsx` 或 `InputCard` 的隐式闭包；选择器从具体文件导入，避免通过目录入口形成循环依赖；目录导出与页面导入已核对。
- 页面级生成 API、任务轮询、缓存、Toast 状态/定时器、Zustand Store 写回、Blob URL 生命周期和页面副作用均未下沉。
- 当前 `CreationPage.jsx` 实际为 `1584` 行，架构检查统计为 `1585` 行；顶部结构索引已按当前真实行号更新。
- 本轮静态验收通过：定向 ESLint、全量 `npm run lint`、`npm run build`、`npm run check:architecture`、`git diff --check` 和失效引用搜索均通过；架构检查仍仅保留历史页面规模告警。
- 未完成：登录态视频重新编辑回填、生成失败恢复、刷新任务恢复、生成结果写回、配音参数重置及真实上传/生成/轮询流程仍需在安全测试条件下验证。
- 下一步：先完成上述登录态业务回归，再决定是否继续拆分 `InputCard` 剩余业务接线；不为了压缩页面行数强行移动页面级副作用。

## 2026-07-16 Home 顶部动作按钮迁移记录

- 新增 `src/components/home/HomeHeaderActions.jsx`，迁移 `CreationManualButton` 和 `LoginButton`；两者不读取 Home 页面闭包，登录行为仅通过显式 `onClick` 接收。
- `WorkflowHeadbar` 暂不迁移：其同时承载工作流步骤权限、认证用户信息、登出、资料、管理员入口和首页返回，仍属于页面级业务编排边界。
- 迁移后已全局搜索旧定义、目录导出和调用方，未发现重复定义、失效导入或缺失回调；首页实际 `1871` 行，架构检查同样报告 `1871` 行历史规模告警。
- 定向 lint、全量 lint、构建、架构检查和 `git diff --check` 均通过；尚未触发登录或外部副作用，需在浏览器未登录态复验创作手册新窗口和登录弹窗入口。
- 下一步：CreationManualButton 与 LoginButton 的静态拆分和引用安全复核已完成；先做未登录入口复验，随后在安全登录态和测试数据具备后按 CreationPage → AssetsPage → StoryboardPage 完成业务回归。不再为了压缩行数强拆 WorkflowHeadbar 或移动认证、工作流副作用。

## 2026-07-16 Home 工作流步骤栏迁移记录

- 新增 `src/components/home/WorkflowStepTabs.jsx`，迁移 `STEP_TABS` 配置、激活态、禁用态和步骤点击展示；组件仅接收 `activeStep`、`unlockedSteps` 和 `onStepChange`。
- `WorkflowHeadbar` 继续保留 Logo、创作手册、认证用户菜单和页面级导航组合；未移动认证、项目加载、步骤解锁、持久化和业务切换副作用。
- 迁移过程中修复并验证组件 JSX 闭合结构，已搜索旧 `STEP_TABS` 定义和页面残留 `PulsingBorder` 引用；未发现缺失导出或失效回调。
- 当前 `Home.jsx` 实际 `1635` 行，架构统计 `1636` 行；定向 lint、全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：浏览器复验项目工作流步骤栏；若登录态仍不可用，则继续记录登录态业务回归为待验证，不触发真实生成或外部副作用。

## 2026-07-16 Home 工作流顶栏迁移记录

- 新增 `src/components/home/WorkflowHeadbar.jsx`，迁移工作流 Logo、创作手册、认证用户菜单和步骤栏的展示组合。
- 组件显式接收 `activeStep`、`unlockedSteps`、`currentUser`、`isLoggedIn` 以及登录、登出、资料、管理员、Logo 返回和步骤切换回调；不引用 Home 页面闭包。
- 页面仍保留非项目首页顶栏的认证入口，因为该区域直接绑定首页登录弹窗和用户状态；未改变认证、项目加载、步骤解锁、持久化和任务副作用。
- 当前 `Home.jsx` 实际 `1592` 行，架构统计 `1593` 行；全量 lint、构建、架构检查和 `git diff --check` 已通过。
- 下一步：复验已有项目下的步骤栏切换、锁定状态和返回首页入口；登录态生成与任务恢复仍需安全测试数据。

## 2026-07-16 SubjectPage 确认弹窗迁移记录

- 新增 `src/components/subject/ConfirmStoryboardModal.jsx`，迁移分镜重新生成确认弹窗。
- 组件仅接收 `onConfirm` 和 `onCancel`，不读取 SubjectPage 闭包，不调用 API、Store、缓存或任务轮询。
- 页面继续负责确认状态、重新生成流程和导航副作用；未改变原有按钮、遮罩和关闭行为。
- 当前 `SubjectPage.jsx` 实际 `2049` 行，架构统计 `2050` 行；全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续评估 SubjectPage 剩余纯展示区块；若无安全边界则转入 StoryboardPage 规模告警治理。

## 2026-07-16 StoryboardPage 选集控制区迁移记录

- 新增 `src/components/storyboard/StoryboardControls.jsx`，迁移集数选择下拉和弹窗关闭按钮；新增 `storyboardControlUtils.js` 承载选集标签/ID纯函数。
- `GenerateImagePanel`、`GenerateVideoPanel` 继续通过显式 `ModalCloseBtn` props 接收关闭能力；页面继续持有 episode 状态、API、任务轮询、缓存、持久化和 Toast。
- 迁移后已搜索旧局部定义、直接引用、目录出口和失效 `getEpisodeId`，未发现引用缺失；为避免 Fast Refresh 规则，组件与纯函数分文件导出。
- 当前 `StoryboardPage.jsx` 实际 `2641` 行，架构统计 `2642` 行；全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续评估 StoryboardPage 中 `CharTag`/旁白列剩余展示边界，避免移动 API 和任务副作用。

## 2026-07-16 StoryboardPage 旁白原子展示迁移记录

- 新增 `src/components/storyboard/NarrationAtoms.jsx`，迁移 `CharTag` 与 `AddSlotBtn`。
- 两个组件只负责标签/空槽视觉和悬停按下反馈，所有行为通过显式 `onClick` 接入；未读取页面闭包或业务 API。
- 页面继续负责旁白列表、打开编辑、删除和保存等业务状态与副作用。
- 当前 `StoryboardPage.jsx` 实际 `2581` 行，架构统计 `2582` 行；全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：评估 `NarrationItem` 与 `AddNarrationBtn` 是否能在不移动旁白编辑状态的前提下继续拆分。

## 2026-07-16 StoryboardPage 旁白区迁移记录

- 新增 `src/components/storyboard/NarrationItems.jsx`，迁移 `NarrationItem` 和 `AddNarrationBtn`；新增 `VoiceDubModal.jsx`，迁移角色选择、语速/音量、台词输入和保存按钮等配音编辑交互。
- `NarrationCol` 继续持有 `dubList`、`editingIdx`、`modalOpen`、全局音色参数合并、保存、删除和 `onChange` 写回；迁移组件不读取 StoryboardPage 闭包。
- `NarrationItems.jsx` 通过 `CharTag` 组合主体标签；`VoiceDubModal` 通过 `chars`、`initialData`、`onSaveCurrent`、`onSaveGlobal` 和 `onClose` 显式接入。
- 当前 `StoryboardPage.jsx` 实际 `2219` 行，架构统计 `2220` 行；全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 当前不再为压缩行数强拆 `NarrationCol` 的业务状态；下一步进入 StoryboardPage 静态边界复核和全量页面业务回归准备。

## 2026-07-16 StoryboardPage 画面描述列迁移记录

- 新增 `src/components/storyboard/DescriptionCol.jsx`，迁移画面描述编辑、景别/运镜/拍摄角度/构图/时长参数触发器和下拉选择器。
- 组件只接收 `shot` 和 `onChange`，参数更新仍由组件构造新 shot 后通过回调交给页面；页面继续负责镜头状态写回和 API 副作用。
- 已移除页面中的 `PARAM_OPTIONS`、`PARAM_LABELS`、`ParamSelect`、`ParamTrigger` 和 `DescriptionCol` 定义；旧引用、导出和 `EditableText` 接线已核对。
- 当前 `StoryboardPage.jsx` 实际 `2015` 行，架构统计 `2016` 行；全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续审查镜头编号列；若其依赖行级上下文但不依赖页面 API，则迁移为业务域组件，否则保留页面桥接。

## 2026-07-16 StoryboardPage 镜头编号列迁移记录

- 新增 `src/components/storyboard/ShotNumberColumn.jsx`，迁移 `NUMBER_BTNS`、`CardActionBtn`、镜头编号展示、选择态和 Tooltip。
- 组件通过 `StoryboardShotRowContext` 获取行级悬停、拖拽手柄和删除确认回调；新增、复制和批量选择仍由页面通过显式 props 接入。
- 页面继续持有镜头 CRUD、排序、API、任务轮询、缓存、持久化和 Toast 副作用，未改变行为边界。
- `StoryboardPage.jsx` 当前实际 `1660` 行，架构统计 `1661` 行；全量 lint、构建、架构检查和差异检查通过。
- 下一步：优先进行剩余页面的非破坏性入口复验；安全登录态和测试任务具备后，补齐真实任务恢复及上传、生成、下载、删除、定稿等业务回归。

## 2026-07-16 Home API 配置提示气泡迁移记录

- 新增 `src/components/home/ApiConfigBubble.jsx`，迁移底部 API 配置入口的纯展示提示气泡。
- Home 继续负责 `showApiBubble` 显示条件、登录判断、底部导航和 `ApiConfigModal` 打开逻辑；组件不读取页面状态、不调用 API。
- `Home.jsx` 当前实际 `1555` 行，架构统计 `1556` 行；全量 lint、构建、架构检查和差异检查通过。
- 下一步：继续进行剩余页面的非破坏性入口复验；安全登录态和测试任务具备后补齐业务副作用回归。

## 2026-07-16 Home Toast 展示迁移记录

- 新增 `src/components/home/HomeToast.jsx`，迁移首页 Toast 的成功、警告和错误视觉展示。
- Home 继续持有 `toast` 状态、定时器和 `showToast` 触发逻辑；组件通过显式 `toast` props 接入，不拥有业务副作用。
- `Home.jsx` 当前实际 `1518` 行，架构统计 `1519` 行；全量 lint、构建、架构检查和差异检查通过。
- 下一步：继续进行剩余页面的非破坏性入口复验；安全登录态和测试任务具备后补齐业务副作用回归。

## 2026-07-16 SubjectPage Toast 展示迁移记录

- 新增 `src/components/subject/SubjectToast.jsx`，统一主体编辑面板和主体页批量生成 Toast 的视觉展示。
- 页面继续持有 Toast 状态、定时器、触发函数和业务消息；组件不调用 API、Store、缓存或任务轮询。
- `SubjectPage.jsx` 当前实际 `1993` 行，架构统计 `1994` 行；迁移后旧内联 Toast 展示已移除。
- 下一步：继续进行剩余页面的非破坏性入口复验；不再为了压缩行数强拆 SubjectPage 的生成、任务恢复和批量副作用边界。

## 2026-07-16 SubjectPage 空态图标迁移记录

- 新增 `src/components/subject/SubjectEmptyIcons.jsx`，迁移角色、场景和道具卡片无图片时的静态图标。
- `SubjectPage` 通过 `emptyIcons={SubjectEmptyIcons}` 显式传给 `SubjectGrid`；列表状态、分页、选择、下载、删除和生成副作用仍由页面持有。
- `SubjectPage.jsx` 当前实际 `1972` 行，架构统计 `1973` 行；旧内联空态图标定义已移除。
- 下一步：继续完成非破坏性入口复验和 OpenSpec 未完成项审查，不为了压缩行数强拆页面级生成与任务副作用。

## 2026-07-16 SubjectPage 提取状态展示迁移记录

- 新增 `src/components/subject/SubjectExtractionState.jsx`，迁移主体提取加载态、错误态、重试按钮和错误图标。
- 页面继续持有提取状态、列表数据和 `onExtractSubjects` 业务回调；组件只接收 `message`、`loading` 和 `onRetry`。
- `SubjectPage.jsx` 当前实际 `1933` 行，架构统计 `1934` 行；静态门禁和差异检查通过。
- 下一步：继续核对剩余页面纯展示区块；不移动主体生成、任务恢复、批量生成和缓存副作用。

## 2026-07-16 SubjectPage 编辑面板接线迁移记录

- 新增 `src/components/subject/SubjectEditorSlot.jsx`，统一角色、场景、道具三个 `EditSubjectPanel` 的公共展示接线。
- 页面仍通过显式 `onCommit` 和 `onCoverChange` 回调负责对应列表写回、封面同步、API 更新和取消定稿；组件不读取页面闭包。
- `SubjectPage.jsx` 当前实际 `1914` 行，架构统计 `1915` 行；三个重复接线块已移除，静态门禁通过。
- 下一步：继续核对主体页和其他页面的剩余稳定区块；不移动生成、轮询、缓存和 Store 副作用。

## 2026-07-16 SubjectPage 主体任务结果适配迁移

- 新增 `src/utils/subjectPendingGenerationAdapter.js`，迁移 `getPendingGenResult` 为 `findPendingSubjectImage`，统一候选图/定稿图、已知 ID/URL 去重和 URL 归一化。
- SubjectPage 继续持有任务轮询、pending 持久化、状态写回和反馈副作用；适配工具不调用 API 或 React 状态。
- 已完成旧定义搜索、定向 ESLint 和 `git diff --check`。

## 2026-07-16 Home 剧集状态适配迁移

- 新增 `src/utils/episodeStatusAdapter.js`，统一概览优先、剧集状态回退和未知状态兜底规则。
- Home 继续负责项目概览请求、状态写回和后续分镜加载；适配工具不持有副作用。
- 已完成旧状态映射搜索、定向 ESLint 和 `git diff --check`。

## 2026-07-16 Home 项目适配迁移

- 新增 `src/utils/projectAdapter.js`，统一项目列表 `cover/cover_url` 兼容和创建时间倒序排序。
- Home 的鉴权初始化、登录成功、导航切换和项目缓存订阅均复用同一适配函数，页面继续持有请求和状态副作用。
- 已消除三处重复项目列表归一化实现，定向 ESLint 和 `git diff --check` 通过。

## 2026-07-16 Home 主体适配迁移

- 新增 `src/utils/subjectAdapter.js`，迁移 `normalizeSubjects` 的字段兼容和稳定排序。
- Home 继续持有主体缓存、分页请求、状态写回和副作用；适配工具仅负责纯数据转换。
- 已完成旧定义搜索、定向 ESLint 和 `git diff --check`。

## 2026-07-16 Storyboard 提示词适配迁移

- 新增 `src/utils/buildStoryboardPrompt.js`，迁移 `buildPromptFromShot` 纯函数。
- `GenerateImagePanel` 和 `GenerateVideoPanel` 通过显式 `buildStoryboardPrompt` props 使用，页面不再持有提示词拼接实现；提示词字段顺序和生成参数保持不变。
- 已完成旧名称搜索、定向 ESLint 和 `git diff --check`。

## 2026-07-16 Storyboard 参考资产适配迁移

- 新增 `src/utils/storyboardReferenceAdapter.js`，统一 `subjectTypeFromCategory` 和 `buildStoryboardRefFromAsset` 的纯资产映射。
- `StoryboardPage` 继续负责主体引用写回和 API/任务副作用；`GenerateVideoPanel` / `ReferenceMediaEditor` 通过现有 `buildRefFromAsset` props 使用适配函数。
- 已复核主体资产、普通参考图和兜底类型，定向 ESLint 与 `git diff --check` 通过。

## 2026-07-16 Storyboard 轻量操作原子迁移

- 新增 `src/components/storyboard/StoryboardActionPrimitives.jsx`，迁移 `RefSlotBtn` 和 `IconPlus` 为 `RefSlotButton` / `StoryboardIconPlus`。
- `GenerateImagePanel` 继续通过显式 `RefSlotBtn` props 使用上传/资产选择入口；页面新增空白分镜入口通过显式组件导入使用。
- 组件不读取页面状态、不调用 API；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。

## 2026-07-16 Storyboard 旁白列迁移

- 新增 `src/components/storyboard/NarrationCol.jsx`，迁移 `NarrationCol` / `NarrationColWrapper`，包含旁白列表编辑、删除、配音弹窗和全局音色参数保存。
- 页面不再持有旁白列内部状态，仅通过 `NarrationColWrapper` 显式传入镜头和写回回调；未移动页面 API、任务轮询、缓存、持久化和 Toast 副作用。
- 当前 `StoryboardPage.jsx` 实际 `1685` 行；架构检查统计 `1688` 行。定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。

## 2026-07-16 创作结果卡片按钮复用

- 新增 `src/components/creation/CreationCardActionButton.jsx`，统一 `CreationImageResultCard`、`CreationVideoResultCard` 和 `CreationAudioResultCard` 中重复的 `CardActionBtn`。
- 组件只负责悬浮提示和通用按钮视觉，图标、提示文案和业务回调由结果卡片通过显式 props 传入；未移动下载、删除、收藏和重新编辑副作用。
- 已完成旧定义搜索和定向 ESLint；该复用不涉及 `StoryboardPage` 的镜头编号 `CardActionBtn`，避免跨业务域误合并。

## 2026-07-16 Home 顶部动作组件复验

- `CreationManualButton` 与 `LoginButton` 的唯一实现位于 `src/components/home/HomeHeaderActions.jsx`；`Home.jsx` 与 `WorkflowHeadbar.jsx` 均通过显式 props/目录入口接入。
- 已全局搜索旧定义、调用方、导入/导出和关键回调，未发现引用缺失、重复实现或 `ReferenceError` 风险。
- 定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过；真实登录态点击回归仍待安全条件。
- 下一步：审查无引用历史备份和重复基础实现，再按 CreationPage → AssetsPage → StoryboardPage 进行安全登录态业务回归；不直接拆 `WorkflowHeadbar`。

## 2026-07-16 页面重构静态收尾审计

- 当前页面实际行数：`AssetsPage.jsx` 57、`CreationPage.jsx` 1072、`Home.jsx` 1518、`StoryboardPage.jsx` 1826、`SubjectPage.jsx` 1931。
- 已搜索本轮迁移涉及的旧局部定义和已知引用风险，未发现页面残留的 `CardActionBtn`、`NumberCol`、`PanelSelect`、`DescriptionCol`、`NarrationItem`、`SubjectToast`、`HomeToast` 或空态图标旧定义。
- `CreationPage`、`AssetsPage`、`StoryboardPage` 的真实任务、副作用流程仍不能以静态检查代替；安全登录态和测试数据具备后继续按 PROJECT.md 顺序验证。
- 下一步：先执行完整静态门禁和差异检查，再继续 OpenSpec 未完成项审查。


## 2026-07-16 SubjectPage 纯函数适配迁移

- 新增 `getPendingGenTabSetter` 和 `defaultPromptForTab` 到 `src/utils/subjectPendingGenerationAdapter.js`；工具只负责 setter 选择和默认提示词映射，不读取 React 状态、不调用 API 或执行写回。
- `SubjectPage.jsx` 继续保留状态更新、详情加载、任务恢复、轮询、缓存和 Toast 副作用；调用方通过显式导入接入。
- 当前 `SubjectPage.jsx` 实际 1899 行，架构统计 1900 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续审查剩余纯函数；若没有安全拆分边界，则转入登录态业务回归和 OpenSpec 未完成项核对。


## 2026-07-16 SubjectPage 缓存边界适配迁移

- 新增 `src/utils/subjectPanelStorage.js`，迁移主体编辑面板的 `sessionStorage` 保存、读取和清理。
- 新增 `src/utils/subjectPendingGenerationStore.js`，迁移 pending 生图任务的 `Map` 与 `localStorage` 同步/恢复；页面继续负责轮询、结果识别、状态写回和缓存消费。
- 当前 `SubjectPage.jsx` 实际 1827 行，架构统计 1828 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续审查剩余纯适配边界；若无明确安全收益，则转入登录态业务回归与 OpenSpec 未完成项核对。


## 2026-07-16 Storyboard 数据适配迁移

- 新增 `src/utils/storyboardDataAdapter.js`，迁移分镜前后端数据映射、URL 路径去重和主体参考图补全。
- `StoryboardPage.jsx` 继续持有镜头状态、API、任务轮询、缓存、持久化、Toast 和写回副作用；纯适配工具不读取 React 状态。
- 当前 `StoryboardPage.jsx` 实际 1400 行，架构统计 1401 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：继续审查剩余明确的纯适配边界；若无安全收益，则转入登录态业务回归与 OpenSpec 未完成项核对。

## 2026-07-16 Storyboard 批量数据归一化复用

- 新增 `normalizeStoryboardList(data, chars)` 至 `src/utils/storyboardDataAdapter.js`，统一执行列表归一化和 `enrichMainRefs` 主体参考图补全。
- `StoryboardPage` 的初始缓存、后端响应、项目级缓存和选集级缓存共用该纯工具；页面仍持有 API、缓存订阅、状态写回和 Toast 副作用。
- 删除页面内重复 `normalizeShots` 闭包；当前 `StoryboardPage.jsx` 实际 `1379` 行。


## 2026-07-16 Home 导航配置迁移

- 对照迁移前 `Home.jsx` 恢复 `NAV_ITEMS`、`BOTTOM_NAV_ITEMS` 的完整 SVG 路径、尺寸、颜色、`viewBox` 和创作图标 `clipPath`，避免静态配置迁移造成视觉回归。
- `BOTTOM_NAV_ITEMS.apps` 继续通过 `QRCodePopup` 函数 popup 接收 `anchorLeft`；动态菜单和 API bubble 不下沉到静态配置文件。

## 2026-07-16 Home Logo 展示区迁移

- 新增 `src/components/home/HomeLogo.jsx`，抽离 Home 顶部完整品牌 SVG，保持 `66px` 宽度、`viewBox`、路径、填充和透明度不变。
- 组件只接收 `clickable` / `onClick`；页面继续根据 `activeKey` 决定是否可点击，并负责返回首页的状态变更。
- 已通过全量 lint、build、架构检查和 `git diff --check`，未发现 Logo 迁移造成的缺失引用或导出错配。

## 2026-07-16 Home 背景展示区迁移

- 新增 `src/components/home/HomeBackground.jsx`，抽离背景视频、径向遮罩和非首页底色展示。
- 组件只通过 `isHome`、`videoRef`、`videoSrc`、`onVideoEnded` 接收显式 props；视频索引、切换副作用和导航状态仍由 `Home.jsx` 持有。
- 迁移后 Home 实际 `1331` 行、架构统计 `1332` 行；未改变首页背景视觉、视频播放属性或非首页底色。

## 2026-07-16 Home 无项目头部迁移

- 新增 `src/components/home/HomeHeader.jsx`，统一无项目状态下的 Logo、创作手册、登录入口和 `AccountMenu` 组合。
- 组件只接收 `activeKey`、`isLoggedIn`、`currentUser` 以及认证/导航动作回调；认证状态、用户资料加载、退出登录和个人资料弹窗仍由 `Home.jsx` 持有。
- 迁移后 Home 实际 `1318` 行、架构统计 `1319` 行；旧头部 JSX、`AccountMenu`、`CreationManualButton` 和 `LoginButton` 页面导入已清理，静态门禁通过。

## 2026-07-16 SubjectPage 主体归一化工具复用

- `SubjectPage.jsx` 删除页面内重复的 `normalizeSubjectList`，改为复用 `src/utils/subjectAdapter.js` 的 `normalizeSubjects`。
- Home 与 SubjectPage 现在统一使用相同的描述字段、图片字段和创建时间排序规则；该工具不读取 React 状态、不调用 API。
- 页面仍保留请求、列表写回、分页、缓存、Toast 和批量生成副作用；本轮只统一纯转换逻辑。

## 2026-07-16 SubjectPage 模型响应适配迁移

- 新增 `src/components/subject/SubjectModelAdapter.js`，抽离主体编辑面板的图片模型响应转换，统一输出 `value`、`label`、`resolutions`、`resolutionSizeMap`、`ratios`、`is_default` 和 `maxRefImages`。
- 页面继续负责 `apiListModels` 请求、fallback 模型、默认模型选择、分辨率/比例联动及生成参数状态；适配器不读取页面或执行副作用。

## 2026-07-16 Creation 结果卡片文件名工具复用

- `CreationImageResultCard`、`CreationAudioResultCard`、`CreationVideoResultCard` 统一导入 `src/utils/creationFilename.js` 的 `filenameFromPrompt`，删除组件内重复实现。
- 三个结果卡继续分别负责自己的下载副作用；本次只迁移纯函数，不改变 fetch、Blob、下载回退、收藏、删除或详情交互。

## 2026-07-16 Subject/Storyboard Blob 下载工具复用

- 新增 `src/utils/downloadBlob.js`，只处理 Blob 临时 URL 和 DOM 锚点生命周期。
- SubjectPage 的主体图片下载、StoryboardPage 的批量图片/视频下载均复用该工具；文件名、API 请求、Toast 和业务判断仍在页面或业务适配层。

- 新增 `src/components/home/HomeNavigationConfig.jsx`，迁移首页顶部/底部导航的静态配置、图标和标签。
- `Home.jsx` 继续负责导航状态、登录/API 判断、菜单弹窗、底部导航动态气泡和所有导航副作用。
- 当前 `Home.jsx` 实际 1355 行，架构统计 1356 行；定向 ESLint、全量 lint、构建、架构检查和 `git diff --check` 均通过。
- 下一步：不再为压缩行数强拆 Home 的认证、导航和业务副作用；进入运行时回归条件审查。

## 2026-07-17 Creation 媒体下载适配复用

- 新增 `src/utils/downloadMediaUrl.js`，复用 `downloadBlob` 统一 URL 媒体的 fetch、Blob 临时 URL、锚点下载和失败回退。
- `CreationPage` 与 `CreationImageResultCard`、`CreationAudioResultCard`、`CreationVideoResultCard` 均改为显式传入文件名调用该工具。
- 工具不决定文件名、不调用 API/Store、不读取页面状态；真实下载仍属于登录态业务回归范围，静态门禁不能替代运行时验证。

## 2026-07-17 Assets 项目资产下载复用

- `AssetsProjectPanel.jsx` 的单项资产下载改为复用 `src/utils/downloadBlob.js`，面板继续负责资产 API、文件名、批量顺序和错误日志。
- 本轮只统一 Blob 临时 URL 生命周期，不改变资产筛选、分页、删除、收藏或真实下载流程；真实登录态下载仍待业务回归。

## 2026-07-17 Storyboard 参考图 URL 适配复用

- 新增 `toSafeStoryboardReferenceUrls` 至 `src/utils/storyboardReferenceAdapter.js`，统一 StoryboardPage 图片/视频生成入口的绝对 URL 转换与不支持格式过滤。
- 该适配器只接收参考图数组并返回新数组，不调用 API、Store、缓存或 React 状态；生成 API、任务轮询和镜头写回仍由页面持有。
- 已搜索旧的重复转换表达式，确认四个生成入口均改为显式调用适配函数；真实生成流程仍待安全测试数据。

## 2026-07-17 Storyboard 模型列表适配复用

- 新增 `src/utils/storyboardModelAdapter.js`，统一图片生成面板、视频生成面板和批量生成弹窗的模型列表字段适配。
- 适配器只负责响应解包、模型 ID/名称、分辨率、比例映射和视频时长能力转换；各组件仍持有 API 请求、默认选择、Tab 切换和参数联动状态。
- 已清理 `BatchGenerateModals` 页面内重复 `normalizeModelList`，并复核新工具的所有调用方和导出；真实模型加载与生成流程仍待登录态回归。

## 2026-07-17 Subject 模型 fallback 复用

- 将 `SubjectPage.jsx` 内的图片模型 fallback 配置迁移至 `src/components/subject/SubjectModelAdapter.js` 的 `getFallbackSubjectImageModels`。
- 页面仍负责模型 API、失败回退、默认模型选择、分辨率/比例联动；适配器只返回新数组，不读取页面状态。
- 已复核 fallback 唯一实现、目录导出和调用方；真实模型 API 失败回退仍需运行时条件验证。

## 2026-07-17 Subject 图片条目映射复用

- 新增 `createSubjectImageItem` 至 `src/components/subject/SubjectImageMappers.js`，统一主体生成图片条目的 `rawUrl`、展示 URL、定稿状态、参考图快照和默认字段。
- `SubjectPage.jsx` 的批量缓存恢复、单主体完成恢复、封面兜底和批量任务完成路径均改为显式调用该纯函数；页面继续持有缓存消费、任务轮询、状态写回和封面副作用。
- 已检查旧重复对象构造、组件导出和调用方；定向 ESLint、构建、架构检查和差异检查通过。

## 2026-07-17 AssetsPage/StoryboardPage 只读回归与静态门禁复核

- AssetsPage：复核项目资产的角色、场景、道具、分镜图、分镜视频、音频、成片分类切换，以及创作资产的图片、视频、配音分类切换；当前分镜图和音频分类在复核时没有可见对象，因此只记录分类/空态，不记录详情、播放或收藏通过。
- StoryboardPage：继续复核测试项目分镜数据、镜头字段、批量生成菜单、图片/视频生成面板、模型/分辨率选择器和刷新恢复；没有执行真实生成、上传、下载、删除、定稿或配音。
- 本轮静态门禁结果：`npm run lint`、`npm run build`、`npm run check:architecture`、`git diff --check` 均通过；架构检查仅保留规模告警，构建最大 JavaScript 分块约 `441KB`，无超过 `500KB` 告警。
- 当前下一步：音频播放/收藏按用户要求排除；StoryboardPage 已完成最终手动验收。仅对后续具备具体测试对象并获得单独授权的外部流程进行验证，未授权副作用不自动执行。


## 2026-07-17 SubjectPage 编辑表单组合拆分

- 新增 `src/components/subject/SubjectEditForm.jsx`，抽离 `EditSubjectPanel` 左侧文本字段、模型/比例/分辨率、参考图和生图模式的稳定展示组合。
- 组件只接收显式值、选项和回调，不调用 API、Store、缓存或任务轮询；页面继续持有字段状态、生成参数组装、生成 API、任务轮询、缓存、Toast 和图片副作用。
- `SubjectPage.jsx` 当前实际 `1707` 行；本次未改变业务流程，后续只继续处理有明确边界的展示/业务区块。


## 2026-07-17 主体编辑基础组件复用

- 新增 `src/components/ui/TextField.jsx`，主体名称、描述、提示词通过 `SubjectTextFields` 复用同一套无业务受控输入视觉；字段标签和保存回调仍由主体域组合组件传入。
- 新增 `src/components/ui/FileUploadButton.jsx`，`RefImageField` 的本地上传和资产库选择入口复用该无业务按钮；参考图 API、资产选择、绑定、删除和状态同步仍由 `RefImageField` 保留。
- 主体模型、画面比例和分辨率继续复用 `src/components/ui/Select.jsx`，本轮未改变其参数联动和页面状态边界。


## 2026-07-17 参考图卡片拆分

- 新增 `src/components/subject/RefImageItem.jsx`，负责参考图展示、延迟悬浮预览和删除回调。
- 新增 `src/components/subject/RefImageUploadCard.jsx`，负责参考图区域上传/资产选择入口的视觉卡片，并复用无业务 `FileUploadButton`。
- `RefImageField.jsx` 仅保留参考图状态同步、文件上传 API、资产选择绑定 API、删除和外部回调；未移动业务逻辑。


## 2026-07-17 上传按钮与 PanelPromptInput 展示区块复用

- `SubjectImageList` 和 `StoryboardImageUpload` 的重复上传按钮改为复用无业务 `FileUploadButton`；`StoryboardUploadSlots` 继续通过 `ImgUploadBtn` 间接复用同一视觉基础，文件校验、上传 API 和资产选择逻辑未移动。
- 新增 `src/components/storyboard/PanelPromptConstants.js` 与 `PanelPromptPrimitives.jsx`，抽离提示词提及类型配置、`SubjectTag` 和字符计数展示。`PanelPromptInput` 继续保留 contentEditable、光标、提及插入、粘贴和同步逻辑。


## 2026-07-17 ReferenceMentionDropdown 拆分

- 新增 `src/components/storyboard/ReferenceMentionDropdown.jsx`，负责 @ 提及列表、类型筛选 Tab、Portal 定位和外部点击关闭。
- `PanelPromptInput.jsx` 继续负责 contentEditable、光标处理、查询词、提及插入、粘贴、组合输入和 value 同步；本轮未移动编辑器业务状态。


## 2026-07-17 Storyboard 生成面板参数组合复用

- 新增 `src/components/storyboard/GenerationParamsFields.jsx`，提供 `GenerationModelField` 和 `GenerationOptionFields`，统一图片/视频面板的模型、时长、分辨率选择器展示组合。
- `GenerateImagePanel`、`GenerateVideoPanel` 继续持有模型 API、能力过滤、参数联动、生成 API、任务轮询和 Toast；本轮只迁移选择器组合和显式 props。


## 2026-07-17 图片生成面板参考图展示拆分

- 新增 `src/components/storyboard/ReferenceImageField.jsx`，负责参考图展示、数量标签、悬浮预览、上传入口和删除回调。
- `GenerateImagePanel.jsx` 继续保留参考图状态、文件校验、上传/资产选择处理、`AssetPickerModal`、模型状态、生成 API 和结果写回；本轮只迁移纯展示组合。


## 2026-07-17 视频生成面板展示拆分

- 新增 `src/components/storyboard/VideoGenerationControls.jsx`，抽离全能参考/首尾帧 Tab 和音效开关展示。
- `GenerateVideoPanel` 继续保留 Tab 切换后的模型列表、分辨率/时长联动、参考素材、生成 API、任务轮询、结果查看和 Toast 状态；本轮只迁移展示组合。


## 2026-07-17 Storyboard 上传槽位媒体展示拆分

- 新增 `src/components/storyboard/StoryboardMediaPrimitives.jsx`，抽离 `MediaContent`、`MediaRemoveButton` 和 `ShortcutMediaCard`。
- `StoryboardUploadSlots.jsx` 继续负责文件校验、上传 API、资产选择、预选、预览定位状态和业务回调；本轮只复用媒体展示结构。


## 2026-07-17 生成面板提交按钮复用

- 新增 `src/components/storyboard/GenerationSubmitButton.jsx`，统一图片/视频生成面板底部提交按钮、hover/pressed 状态、加载态和媒体图标。
- `GenerateImagePanel` 与 `GenerateVideoPanel` 继续传入各自 `handleGenerate`，生成 API、任务轮询、Toast 和结果状态未移动。

## 2026-07-17 VideoResultsPanel 视频上传入口拆分

- 新增 `src/components/storyboard/VideoUploadCard.jsx`，负责视频上传占位卡的布局、悬浮状态、本地文件选择和资产库选择弹窗。
- `VideoUploadCard` 只通过 `onUpload` 与 `onAssetsSelected` 透传选择结果；不调用 `apiUploadStoryboardVideo`，不转换资产字段，不维护生成视频列表、定稿状态或 Toast。
- `VideoResultsPanel.jsx` 继续负责视频上传 API、资产 URL 归一化、结果列表写回、定稿和结果卡操作；未执行真实视频上传。
- 下一步：评估 `VideoResultsPanel` 结果卡和生成面板剩余纯展示边界；若无明确安全边界，则进入静态收尾和剩余页面规模告警审查。

## 2026-07-17 VideoResultsPanel 视频结果卡片拆分

- 新增 `src/components/storyboard/VideoResultCard.jsx`，负责视频预览、加载态、定稿控件和悬浮查看/下载入口展示。
- `VideoResultCard` 不调用 API、不写入视频列表、不创建下载链接；查看、定稿和下载均通过显式回调透传。
- `VideoResultsPanel.jsx` 继续负责结果列表状态写回、定稿回调、查看回调和浏览器下载副作用；未执行真实下载或定稿。
- 下一步：继续评估生成面板剩余纯展示边界；若无明确安全边界，则进入静态收尾与 OpenSpec 未完成项审查。

## 2026-07-17 GenerateImagePanel 图片结果卡片拆分

- 新增 `src/components/storyboard/ImageResultCard.jsx`，负责图片预览、加载态、定稿控件和悬浮查看/下载入口。
- `ImageResultCard` 只接收图片 URL、定稿状态和显式回调，不调用 API、不写入结果列表、不创建下载链接。
- `GenerateImagePanel.jsx` 继续负责生成结果状态、定稿写回、详情弹窗和浏览器下载副作用；`StoryboardImageUpload.jsx` 不再包含图片结果卡片。
- 下一步：评估生成面板是否还存在明确的纯展示边界；若没有，则进入静态收尾与 OpenSpec 未完成项审查。

## 2026-07-17 生成面板结果展示静态收尾

- `GenerateImagePanel` 已将图片结果展示迁移至 `ImageResultCard`；`GenerateVideoPanel` 通过 `VideoResultsPanel` 使用 `VideoUploadCard` 与 `VideoResultCard`。
- 结果卡片只负责媒体预览、加载态、定稿控件和回调出口；生成/上传 API、结果列表写回、详情弹窗、下载、定稿、任务状态和 Toast 副作用仍保留在业务面板或页面。
- 全局搜索确认旧 `ImgItem`、`VideoItem` 和页面级 `VideoUploadCard` 实现无残留调用；`onDraftContentChange` 仅存在于受控 `ScriptPage` props 与 `GlobalSettings` 的显式传递链路中。
- 本阶段可安全抽离的生成面板展示边界已完成；剩余规模告警不作为强拆 API、轮询、缓存、Store 或外部副作用的理由。

## 2026-07-17 StoryboardPage 上传入口错误与样式统一修复

- 修复 `GenerateImagePanel.jsx` 本地参考图上传报错：`ReferenceImageField` 已将原生事件转换为文件数组，面板此前仍读取 `e.target.files`，导致 `Cannot read properties of undefined (reading 'files')`；现改为直接消费文件数组，业务上传 API 和结果写回边界不变。
- 统一分镜页上传入口视觉：`StoryboardImageUpload.jsx` 的 `ImgUploadBtn` 改为复用 `StoryboardActionPrimitives.jsx` 的 `RefSlotButton`。因此分镜图候选图、分镜视频候选视频，以及视频面板参考图/视频/音频入口统一使用同一上传按钮样式；文件选择、资产选择和上传 API 仍由各业务组件负责。
- 分镜相关定向 ESLint、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过；架构检查仅保留历史规模告警。
- 已由用户完成分镜图/视频弹窗最终手动验证，所有分镜功能正常；音频播放/收藏不在本次重构范围。

## 2026-07-17 Storyboard 参考视频/音频数量限制修复

- 修复历史问题：模型允许最多 3 个参考视频或参考音频时，旧状态使用单个 `refVideo`/`refAudio`，上传第 1 个后即被视为已满，上传入口错误消失。
- `GenerateVideoPanel` 与 `ReferenceMediaEditor` 现改用 `refVideos`/`refAudios` 数组，并根据模型能力以 `length < max_reference_*` 控制入口；本地上传、资产库选择、删除单项和计数显示均支持最多 3 个。
- 当前生成接口仍使用单个 `reference_video_url`/`reference_audio_url` 字段，因此提交时保持既有接口契约，使用列表首项；本次只修复前端素材槽位数量和入口显示，不擅自修改后端参数协议。
- 分镜相关定向 ESLint、`npm run build`、`npm run check:architecture` 和 `git diff --check` 通过。

## 2026-07-17 StoryboardPage 最终手动验收通过

- 用户确认 StoryboardPage 所有功能正常可用：弹窗打开/关闭、分镜图/视频参考素材本地上传、资产库选择、上传入口样式、候选媒体入口、模型/分辨率等选择器以及其他分镜交互均通过验证。
- 参考视频/参考音频最多 3 个的入口显示修复已纳入验收结论：上传第 1、2 个后入口继续显示，达到第 3 个后隐藏，删除后可重新出现。
- 本条为用户手动验证结果，不将其扩大解释为音频播放/收藏通过；音频播放/收藏按用户要求排除在本次前端重构范围之外。
- StoryboardPage 不再作为当前前端重构阻塞项；后续只保留静态门禁复验、OpenSpec 记录整理和明确范围外功能的后续产品任务。

## 2026-07-17 前端重构最终验收完成

- 用户确认本次前端重构纳入范围的运行时验收全部通过，包含 CreationPage、AssetsPage（音频播放/收藏除外）和 StoryboardPage 的相关业务流程。
- OpenSpec 7.4 及其本次纳入范围的运行时子任务已同步为完成；音频播放/收藏是明确排除项，不影响本次前端重构完成结论。
- 当前没有剩余的纳入范围重构工作。页面规模告警继续作为非阻断治理项，不通过强拆 API、任务轮询、缓存、Store 写回或外部副作用来压缩行数。

> 本节为当前有效结论；文档前部 2026-07-16 及更早记录中的“待验证/未完成”仅保留历史审计上下文，不代表当前状态。

## 2026-07-17 旧版 Bug 修复经验迁移

- 参考 `/Users/suzylee/Desktop/miioo-project/frontend/解决方案.md`，将旧版已确认的创作页 Bug 修复迁移到当前重构结构。
- `AssetPickerModal` 现在同时过滤 Store/API 来源中没有有效 URL 的图片占位卡；视频保留 `url` 或 `posterUrl` 任一有效即可，音频不因没有预览图被误过滤。
- `Home` 常驻 `CreationPage`，切换页面不再卸载创作输入；发送成功不主动清空提示词和素材，Tab 切换不再清空文件；按生成类型保存草稿，切换图片/视频/配音时恢复各自内容。
- 参考素材文件统一补充前端 `_uid`，`@` 标签按 `_uid` 删除，避免同名素材误删；历史图片用作参考图时文件名由提示词生成，重复添加也保持独立引用。
- 图片/视频并发上限调整为 10，配音保持 5，按钮提示同步显示对应上限。

## 2026-07-17 统一主体与分镜上传入口按钮
- 主体编辑弹窗参考图和候选图、分镜图/视频的参考素材与候选媒体入口统一直接复用 `src/components/ui/FileUploadButton.jsx`。
- `FileUploadButton` 仅负责按钮视觉和点击出口，不处理文件、资产库、API 或业务状态；各业务组件继续保留原有上传逻辑。
- 移除分镜上传入口对 `RefSlotButton`/`ImgUploadBtn` 的重复视觉包装，未改变回调参数和上传流程。

## 2026-07-21 剧本页新创作入口

- 剧本创作阶段新增 `ScriptMessageArea` 和 `ScriptMessageLoading`，消息列表由 `ScriptPage` 持有并按后端工作区消息恢复；流式助手消息在当前消息位置增量更新。
- `InputCard` 不再维护本地最多 10 条输入历史，已删除旧 `scriptDraftCache.js` 及其回溯入口；保留超时后的当前文本恢复。
- 消息区替代创作阶段的 `ScriptPanel` 主展示区，进入编辑态时仍通过“查看剧本”恢复原剧本编辑工作区。
- 剧本聊天请求新增集数和单集时长参数适配，自动适应时不发送 `episode_duration_seconds`。
- `ScriptPage` 初始空态改为三种入口：剧本模式上传自有剧本、分镜脚本本地选择 `.xlsx`、输入指令直接生成剧本。
- 新增 `ScriptCreationEntry` 和 `ScriptUploadCard`，上传卡片支持整卡点击、键盘触发、文件校验、文件移除、悬停阴影和弹簧放大；分镜模板使用 `public/分镜模板.xlsx` 静态下载。
- `InputCard` 移除上传入口和文件恢复职责，仅保留指令、模型、单集时长、集数和发送/停止；草稿缓存同步移除文件 Blob 序列化，增加 `episodeDuration`。
- 分镜 `.xlsx` 本阶段只保留本地文件状态，不调用剧本上传接口、不解析、不跳转分镜页；剧本模式继续复用 `apiUploadScriptWorkspace`。

## 2026-07-21 剧本页结构化编排态

- `ScriptPage` 新增确认初稿后的不可返回编排态：调用确认接口创建异步任务，轮询任务终态，并从结构接口读取最终数据。
- 新增 `ScriptOutlineLoading`，负责整体设定、剧本设计、主体和分集剧本骨架，以及从左向右的光带加载反馈。
- 新增 `ScriptOutlineWorkspace`，只渲染 API 适配后的结构化数据；字段为空时显示空值，不使用设计稿示例文本。
- 刷新时若工作区已有结构或活跃编排任务，直接恢复编排态并继续轮询；进入编排态后不再渲染消息区、InputCard 或返回入口。
- 确认接口使用 `script.draft_revision`，`STRUCTURE_NOT_FOUND` 作为“尚无结构草稿”处理，其他 404 与真实版本冲突均保留错误信息，不自动无限重试。
- 新增 `ScriptEpisodeOutline`，负责后端分集胶囊、AI 重新分集、当前集 AI 重写/删除和剧情编辑；富文本 `ScriptEditor` 只在当前集编辑态挂载。

## 2026-07-21 剧本页移除左侧剧集结构

- 删除 `src/components/script/EpisodeItem.jsx` 与 `EpisodeList.jsx`，并移除目录导出和 `ScriptPage` 中的左侧导航渲染。
- `ScriptPage` 已改为单列剧本工作区，不再持有左侧导航的选中索引、骨架加载状态和标题滚动定位回调。
- `ScriptPanel` / `ScriptRendered` 移除仅服务分集导航的 `onActiveIndexChange` 与当前分集侦测；剧本内容滚动和最后一集底部占位仍保留。
- `backendEpisodes`、`apiGetEpisodes`、定稿刷新和 `onEpisodesChange` 不删除，继续承担项目级剧集数据同步职责。
