# miioo 项目进度管理文档

> 最后更新：2026-06-03

---

## 一、项目背景

**产品名称**：miioo

**产品定位**：AIGC 影视化工作流产品，面向影视创作者，通过 AI 辅助完成从剧本创作到成片剪辑的全流程工作。

**当前阶段**：前端页面开发期（Design System 建设完成，业务页面开发中）

**协作模式**：设计师 + AI 前端（Suzy）负责前端页面，后端同学负责接口开发，完成后双方对接联调。

**仓库地址**：https://github.com/wangchengxv/miioo.git

---

## 二、一级功能模块

| 模块 | 核心功能 | 开发状态 |
|------|----------|----------|
| 首页 | 开始创作主按钮、登录/个人中心、设置、消息、社群二维码、创作手册、API 配置、Logo | ✅ 已完成 |
| 项目 | 新建项目、项目列表（卡片式）、工作流（全局设定/剧本/主体/分镜/剪辑成片） | 开发中 |
| 创作 | AI 生图、AI 生视频 | 开发中 |
| 资产库 | 项目资产、创作资产，可编辑 | 开发中 |

### 项目工作流详细说明

```
项目工作流
├── 全局设定
│   ├── 项目概况（角色/场景/道具/剧情结构数量统计）
│   └── 模型配置（LLM / 图片 / 视频 / 音频模型）
├── 剧本        ← LLM 对话创作剧本、分集管理
├── 主体        ← AI 制作角色 / 场景 / 道具
├── 分镜        ← AI 生成可编辑分镜
└── 剪辑成片    ← 接入第三方开源剪辑工具
```

---

## 三、技术栈

| 技术 | 版本 |
|------|------|
| React | ^19.2.5 |
| Tailwind CSS | ^4.2.4 |
| Vite | ^8.x |

**主题**：仅深色主题，无浅色皮肤切换。

---

## 四、当前进度

### Design System 文档
- [x] tokens.md — Token 完整定义
- [ ] motion.md — 动效规范
- [ ] patterns.md — 交互模式

### 组件文档（design-system/components/）
- [x] Button / Input / Tag / Form / Modal / Select / Toast / Tooltip / Checkbox & Radio / Tab
- [x] Navigation（PrimaryNav，expanded / compact / vertical 三种变体）
- [x] Switch Button

### 业务页面进度

**✅ 已完成（2026-05-19 前）**
- 首页：顶部栏、一级导航、工具栏、开始创作按钮、底部工具交互、登录弹窗、API 配置弹窗
- 项目列表页：卡片网格、搜索、新建、重命名、删除、卡片交互动效
- 项目工作流：顶部导航栏、步骤条交互与解锁逻辑
- 项目工作流 — 全局设定：统计卡片、模型配置、资产概况宫格、跳转联动
- 项目工作流 — 剧本：对话式创作、流式输出动画、富文本编辑（Tiptap）、剧集目录、左右联动、定稿解锁
- 项目工作流 — 主体：角色/场景/道具卡片列表、步骤解锁回调
- 项目工作流 — 分镜：卡片网格、集数切换、批量下载、镜头全屏查看、Toggle 组件
- 通用组件：AssetPickerModal（含项目切换下拉、音频支持）

**✅ 已完成（2026-05-20 ~ 05-24）**
- API 层重构：所有页面内联 stub 函数迁移至 `src/api/` 模块（auth / user / project / config / storyboard / subject / assets）
- API 接口补全：页面硬编码数据全部替换为 API 调用，mock 占位完整
- 通用组件：ProfileModal（头像上传、微信绑定流程、手机号解绑换绑二步弹窗）
- 通用组件：ApiConfigModal 模型列表接入 API 规范

**✅ 已完成（2026-05-25 ~ 05-27）**
- 认证层重构：`src/api/request.js` 统一请求封装，双 token 自动刷新，401 自动重试，`clearTokens` + `auth:logout` 事件
- 通用组件：DotsLoading 全局应用（主体页、分镜页生成等待态）
- 创作页开发：模型/参数后端驱动、`@` 引用文件标签、图片生成结果展示、滚动布局、批量操作
- 创作页：分标签独立生成历史（image / video / dubbing 三切片）
- 创作页：视频模型能力配置（`src/config/`）、音频过滤、首尾帧上传组件（FrameUploader）
- 创作页：图片详情弹窗交互完成、重新编辑回填

**✅ 已完成（2026-05-28 上午）**
- 创作页：历史持久化（Zustand + persist）、资源库联动（删除/收藏同步后端 API）、generate 改用新端点、authFetch 统一
- 资产库：创作资产数据源统一（`creativeDaysAdapter`）、AssetPickerModal 接入 store、收藏/删除双向联动、视频缩略图、详情弹窗复用

**✅ 已完成（2026-05-28 下午）— 资产联动与生成入库修复**

基于 `api-new.json`（OpenAPI 3.1 规范）逐条核对，修复以下 6 项数据一致性问题：

| 优先级 | 模块 | 修复内容 |
|--------|------|----------|
| P0-1 | 资产库 · 项目资产 | `deleteAsset` / `deleteSelected` 调用 `DELETE /api/assets/{id}` 和 `POST /api/assets/batch-delete`，之前只改本地 state |
| P0-2 | 资产库 · 项目资产 | `toggleStar` 调用 `PATCH /api/assets/{id}` body `{ is_starred }`，之前只改本地 state |
| P0-3 | 主体页 | CharCard MoreMenu 删除接通 `DELETE /api/projects/{pid}/subjects/{sid}`，之前是空回调 |
| P1-4 | 主体页 · 生成 | `apiGenerateSubjectImage` 端点修正为含 projectId，响应中的 `assetId` 存入 `generatedImages` 状态 |
| P1-5 | 分镜页 · 生成 | `apiGenerateImage` / `apiGenerateVideo` 端点修正，picsum/w3schools mock 替换为真实 API 调用，`assetId` 入库 |
| P2-6 | 分镜页 · 删除 | `deleteShot` 接通 `DELETE /api/projects/{pid}/storyboards/{sid}`，之前是 TODO 注释 |

**改动文件**：`src/api/assets.js`、`src/api/subject.js`、`src/api/storyboard.js`、`src/pages/AssetsPage.jsx`、`src/pages/SubjectPage.jsx`、`src/pages/StoryboardPage.jsx`、`src/pages/Home.jsx`

**✅ 已完成（2026-05-28 下午）— 导航栏间距与对齐统一**

- PrimaryNav vertical 变体：`items-start` → `items-center justify-center`，图标水平与垂直居中
- 导航栏外层容器：移除条件 padding（`project|assets|create` 12px / `home` 24px），统一为固定 `px-[16px]`，消除页面切换时的宽度跳变
- 底部功能图标组：移除条件 padding（8px / 32px），由外层容器统一提供间距
- 改动文件：`src/components/PrimaryNav.jsx`、`src/pages/Home.jsx`

**✅ 已完成（2026-05-28 晚）— API 层对齐真实后端**

基于 `api文档.json`（OpenAPI 3.1，150+ 端点）逐条比对，重写 `src/api/` 全部 8 个文件，消除前后端分离开发期的路径与字段差异。

| 类别 | 数量 | 处理方式 |
|------|------|----------|
| 路径错误 | 19 处 | 全部修正为后端正确路由 |
| 请求体字段差异 | 9 处 | 字段名改为后端 snake_case 命名 |
| 后端有接口·前端未实现 | 80+ 处 | 新增对应 API 函数 |
| 前端有·后端无接口 | 9 处 | 以 mock stub / no-op 保留，待后端确认 |
| 响应字段未消费 | 8 处 | 已标注在差异报告中，页面按需补充 |

**各文件主要改动：**

| 文件 | 改动要点 |
|------|----------|
| `auth.js` | 新增微信扫码登录三接口（qrcode / poll / confirm）；`apiRegister` 改为保存 token；`bindPhone` 映射为 legacy alias |
| `user.js` | 通知拆分为 5 个独立函数；微信绑定/手机换绑以 mock stub 保留（后端无对应路由） |
| `project.js` | `apiCreateProject` 字段改为 `description / aspect_ratio / visual_style`；新增 `apiGetProject / apiDeleteProject / apiGetProjectOverview / apiDownloadProjectAssets` |
| `subject.js` | 所有路径加 `projectId`；新增主体详情/复制/提取/参考图绑定/主图设置/剧集 CRUD 等 15 个接口 |
| `storyboard.js` | 路径改为 `/api/projects/{pid}/storyboards/...`；新增分镜生成/上传/下载/排序等 12 个接口 |
| `assets.js` | 改用 `GET /api/assets?project_id=...`；新增恢复/帧提取/下载等 6 个接口 |
| `config.js` | Provider 和 Model 拆为独立 CRUD；新增一键安装/清理/默认模型接口 |
| `creation.js` | 全面重写，新增 Session / Shot / Image / Video / Audio / Task 全套 40+ 接口 |

**兼容策略**：页面代码零修改。旧函数名通过 legacy alias 映射到新函数（如 `apiGetShots → apiGetStoryboards`），缺 `projectId` 的旧调用以 `console.warn` 提示。

**差异报告**：`API差异报告.html`（6 张表格，覆盖路径/字段/缺失接口/响应字段全维度对比）

**构建验证**：`vite build` — 0 错误通过

**改动文件**：`src/api/auth.js`、`src/api/user.js`、`src/api/project.js`、`src/api/subject.js`、`src/api/storyboard.js`、`src/api/assets.js`、`src/api/config.js`、`src/api/creation.js`

**✅ 已完成（2026-05-29）— 项目模块 BUG 修复**

修复项目列表和项目总览页面的 5 个数据同步问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | 项目重命名无法保存 | `ProjectList` 添加 `onRenameProject` / `onDeleteProject` 回调，调用 `apiUpdateProject` / `apiDeleteProject` 保存到后端 |
| 2 | 项目封面数据丢失 | GlobalSettings 接收 `projectCoverUrl` prop，实现 800ms debounce 自动保存；封面上传改用 base64 data URL（可持久化）；修复字段映射 `cover_url` → `cover` |
| 3 | 视觉风格数据不同步 | GlobalSettings 接收 `projectStyle` / `projectRatio` props，动态显示视觉风格封面图和画面比例选中状态 |
| 4 | Mock 模式刷新丢失数据 | 项目 CRUD 操作持久化到 localStorage（key: `miioo_mock_projects`），刷新页面后数据不丢失 |
| 5 | 时间显示格式错误 | 创建 `formatRelativeTime` 工具函数，将 ISO 时间戳格式化为友好的相对时间（刚刚、X分钟前、昨天等） |
| 6 | 创建项目按照时间倒序排序 |
| 7 | 将剧本页面的模型选择功能从硬编码改为从后端接口动态获取 |改造内容：StoryboardPage.jsx ｜

**改动文件**：`src/pages/Home.jsx`、`src/pages/ProjectList.jsx`、`src/pages/GlobalSettings.jsx`、`src/api/project.js`、`src/utils/formatTime.js`

**✅ 已完成（2026-05-29）— 刷新恢复与封面保存优化**

修复浏览器刷新后项目进度丢失和封面保存时序问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | 刷新后项目进度丢失 | 持久化项目 ID、激活步骤、解锁状态到 localStorage；新增 `loadProjectDetails` 函数并行加载项目信息、剧本、主体、分镜数据；刷新后自动恢复到之前的项目和工作流步骤 |
| 2 | 封面设置后返回未生效 | GlobalSettings 添加 `saveImmediately()` 异步函数，返回按钮点击时等待保存完成；修改 `onProjectUpdate` 返回 Promise 支持 await |
| 3 | 封面保存缺少反馈 | 封面保存成功后显示 Toast 提示（绿色对勾 + "封面保存成功"），水平居中，垂直 1/4 位置 |
| 4 | 上传中状态不明确 | 封面上传区域显示旋转加载动画 + "保存中..." 文字，保存中禁止点击，半透明遮罩效果 |

**技术细节**：
- 新增 `apiGetScriptWorkspace` API 函数对接后端剧本工作区接口
- localStorage 键名规范：`miioo_active_project_id`、`miioo_active_step`、`miioo_unlocked_steps_{projectId}`
- Toast 根据类型显示不同图标（success: 绿色对勾，warning: 橙色感叹号）
- 使用 CSS `@keyframes spin` 实现加载动画

**改动文件**：`src/api/subject.js`、`src/pages/Home.jsx`、`src/pages/GlobalSettings.jsx`

**✅ 已完成（2026-05-29 下午）— Mock 模式数据持久化修复**

修复 Mock 模式下刷新后数据丢失的三个核心问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | 刷新后总是回到首页 | `activeKey` 状态从 localStorage 恢复；监听变化并保存；所有清理逻辑同时清除 `miioo_active_key` |
| 2 | 封面保存无反馈 | 自动保存逻辑添加 `isSaving` 状态设置；上传时显示加载动画和"保存中..."；保存完成显示 Toast |
| 3 | Mock 模式剧本数据丢失 | `apiGetScriptWorkspace` 从 localStorage 读取；新增 `apiSaveScriptWorkspace` 保存到 localStorage；`ScriptPage` 保存时调用 API |
| 4 | Mock 模式主体数据丢失 | `apiGetSubjects` 从 localStorage 读取；`apiCreateSubject` / `apiUpdateSubject` / `apiDeleteSubject` 保存到 localStorage |

**技术细节**：
- localStorage 键名规范：
  - `miioo_active_key` - 当前页面（home / project / create / assets）
  - `miioo_script_{projectId}` - 剧本数据（content / episodes / phase）
  - `miioo_subjects_{projectId}_{type}` - 主体数据（按 character / scene / prop 分类）
- Mock 模式下所有 CRUD 操作持久化到 localStorage
- 真实后端模式不受影响，仅 Mock 分支修改

**改动文件**：`src/pages/Home.jsx`、`src/pages/GlobalSettings.jsx`、`src/api/subject.js`、`src/pages/ScriptPage.jsx`

**✅ 已完成（2026-05-29 下午）— Mock 模式数据持久化修复**

修复 Mock 模式下刷新后数据丢失的三个核心问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | 刷新后总是回到首页 | `activeKey` 状态从 localStorage 恢复；监听变化并保存；所有清理逻辑同时清除 `miioo_active_key` |
| 2 | 封面保存无反馈 | 自动保存逻辑添加 `isSaving` 状态设置；上传时显示加载动画和"保存中..."；保存完成显示 Toast |
| 3 | Mock 模式剧本数据丢失 | `apiGetScriptWorkspace` 从 localStorage 读取；新增 `apiSaveScriptWorkspace` 保存到 localStorage；`ScriptPage` 保存时调用 API |
| 4 | Mock 模式主体数据丢失 | `apiGetSubjects` 从 localStorage 读取；`apiCreateSubject` / `apiUpdateSubject` / `apiDeleteSubject` 保存到 localStorage |

**技术细节**：
- localStorage 键名规范：
  - `miioo_active_key` - 当前页面（home / project / create / assets）
  - `miioo_script_{projectId}` - 剧本数据（content / episodes / phase）
  - `miioo_subjects_{projectId}_{type}` - 主体数据（按 character / scene / prop 分类）
- Mock 模式下所有 CRUD 操作持久化到 localStorage
- 真实后端模式不受影响，仅 Mock 分支修改

**改动文件**：`src/pages/Home.jsx`、`src/pages/GlobalSettings.jsx`、`src/api/subject.js`、`src/pages/ScriptPage.jsx`

**验证结果**：
- ✅ 刷新后停留在当前页面（不回到首页）
- ✅ 封面上传有加载动画和 Toast 提示
- ✅ 剧本内容刷新后保留
- ✅ 主体数据刷新后保留
- ✅ 解锁状态正确恢复
- ✅ 构建通过（0 错误）

**✅ 已完成（2026-05-29 晚）— Mock 模式核心数据流修复**

修复 Mock 模式下项目数据加载和字段映射问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | `apiGetProject` 返回空对象 | Mock 模式下从 localStorage 读取项目数据，返回完整项目对象 |
| 2 | 字段名不匹配 | `Home.jsx` 传递 props 时兼容两种字段名：`description/desc`、`cover_url/cover`、`aspect_ratio/ratio`、`visual_style/style` |
| 3 | 项目名称不显示 | 修复后面包屑和输入框正确显示项目名称 |
| 4 | 封面无法保存 | 修复后 `projectId` 正确传递，自动保存触发 |
| 5 | 主体创建 projectId undefined | `SubjectPage` 接收并传递 `projectId` 参数 |
| 6 | 项目加载时页面闪烁 | 添加 `isLoadingProject` 状态，加载时不显示项目列表 |

**技术细节**：
- Mock 数据字段名：`description`、`cover_url`、`aspect_ratio`、`visual_style`
- 后端字段名（兼容）：`desc`、`cover`、`ratio`、`style`
- 使用 `||` 运算符兼容两种字段名，优先使用后端字段名

**改动文件**：`src/api/project.js`、`src/pages/Home.jsx`、`src/pages/SubjectPage.jsx`、`src/pages/GlobalSettings.jsx`

**验证结果**：
- ✅ 项目名称正确显示在面包屑和输入框
- ✅ 封面上传后自动保存，控制台显示 `[mock] update project`
- ✅ 主体创建时 localStorage 键名正确（`miioo_subjects_{projectId}_character`）
- ✅ 刷新后项目数据完整恢复
- ✅ 构建通过（0 错误）

**✅ 已完成（2026-06-01）— 分镜页提示词输入框优化**

修复分镜页生成面板提示词输入框的三个交互问题：

| 序号 | 问题描述 | 修复内容 |
|------|----------|----------|
| 1 | 主体参考图上传后提示词无标签 | 修复 `apiUploadImage` 未定义错误；主体参考列上传成功后自动在 `description` 末尾追加 `[参考图:URL]` 标签 |
| 2 | 参考图标签样式不符合设计稿 | 参考图标签改为紫色样式（背景 `#8870FF1A`、文字 `#E8A1FF`、边框 `#FFFFFF14`、圆角 `6px`）；文本从 URL 提取文件名，截断到 7 字符 + `…` |
| 3 | @ 快捷键无法引用主体参考图 | `SubjectMentionDropdown` 新增 `mainRefs` 参数，下拉菜单最前面显示已上传的主体参考图（格式：`「主体」图片名称`）；点击后插入 `[参考图:URL]` 标签 |
| 4 | 编辑态和展示态格式不一致 | `buildPromptFromShot` 改用 `\n` 分组（镜头参数一行、光影环境音一行、画面描述一行、台词一行）；编辑态和展示态都呈现相同的换行格式，`whiteSpace: pre-wrap` 自动处理换行 |
| 5 | 多行内容被截断 | 输入框高度从固定 `height: 120px` 改为 `minHeight: 120px`，内容多时自动撑高 |

**技术细节**：
- `handleSelectMention` 函数区分主体提及（`@name`）和参考图（`[参考图:URL]`）两种插入格式
- `rebuildEditorDOM` 和 `SubjectTag` 组件都实现了参考图标签的文件名提取和截断逻辑
- `parseSegments` 函数支持解析 `[参考图:URL]` 标签，type 为 `'ref'`
- `buildPromptFromShot` 按语义分组：第一行镜头参数、第二行光影环境音、第三行画面描述、第四行台词分配

**改动文件**：`src/pages/StoryboardPage.jsx`、`src/api/assets.js`

**验证结果**：
- ✅ 主体参考列上传图片后，生成面板提示词自动显示紫色参考图标签
- ✅ 输入 `@` 后下拉菜单显示主体参考图（排在最前面）
- ✅ 点击参考图项后插入紫色标签，文本为截断后的文件名
- ✅ 编辑态和展示态格式一致，都按分组换行显示
- ✅ 多行内容不被截断，输入框自动撑高
- ✅ 构建通过（0 错误）

**✅ 已完成（2026-06-01 下午）— 分镜页提示词数据关系梳理 + BUG 修复**

明确产品逻辑并落为代码备注：列表固定参数实时回传后端；提示词初始内容由列表字段拼出，仅暂存弹窗本地，编辑不回写、关闭即丢弃、生图时才回传，只辅助生成不控制分镜内容。

| 序号 | 问题 | 修复 |
|------|------|------|
| 1 | 提示词展示字段标题 | `buildPromptFromShot` 去掉「景别：」等标题只留值（台词「角色：台词」属内容保留） |
| 2 | 主体参考列上传污染「画面描述」列 | 上传只更新 `mainRefs`，参考图标签改为只在提示词画面描述段末尾追加 |
| 3 | 弹窗本地上传报错（`createObjectURL` Overload resolution failed） | `apiUploadFile` 内部已建 FormData，调用处改为直接传原始 `file` |

附带移除展示态每次渲染触发的调试 `console.log`。**改动文件**：`src/pages/StoryboardPage.jsx`。构建通过（0 错误）。

**✅ 已完成（2026-06-01 晚）— 水印设置功能**

首页左侧导航「更多选项」菜单新增「水印设置」入口，点击弹出设置弹窗：

| 序号 | 功能 | 实现 |
|------|------|------|
| 1 | 弹窗组件 | 按 Paper 设计稿精确还原（400px 宽、圆角 16px、卡片背景 `#1D1E1E`、悬停 `#1F1F1F`） |
| 2 | 开关交互 | Toggle 组件补充 hover/active 状态（透明度变化）；切换时显示 Toast 提示（「图片水印已开启/关闭」） |
| 3 | API 对接 | 新增 `apiGetWatermarkSettings` / `apiUpdateWatermarkSettings`（`src/api/settings.js`）；点击保存调用后端接口 |
| 4 | Toast 位置 | 水平居中、垂直 25vh（屏幕 1/4 位置），使用 Flexbox 全屏容器确保精确对齐 |
| 5 | 组件文档 | 新增 `design-system/components/toggle.md`（尺寸/状态/颜色规范） |

**技术细节**：
- 所有间距使用明确 px 值（`gap-[16px]`、`py-[12px]`、`px-[16px]`），不使用 Tailwind 数字缩写
- 按钮交互：关闭图标 hover 0.8 / active 0.6；取消/保存按钮 hover `#1C1C1C` / active `#1A1A1A`
- 菜单项动态注入：`BOTTOM_NAV_ITEMS` 在组件内通过 `map` 为 `menu` 项注入 `popup` 函数，访问 `setWatermarkSettingsOpen` 状态

**改动文件**：`src/components/WatermarkSettingsModal.jsx`、`src/components/Toggle.jsx`、`src/api/settings.js`、`src/pages/Home.jsx`、`design-system/components/toggle.md`

**验证结果**：
- ✅ 点击「水印设置」正常打开弹窗
- ✅ Toggle 切换显示 Toast 提示
- ✅ 卡片悬停背景色变化
- ✅ 按钮交互状态完整
- ✅ Toast 水平垂直位置准确
- ✅ 构建通过（0 错误）

**✅ 已完成（2026-06-01 晚）— API 配置弹窗模型默认标签**

API 配置弹窗模型列表卡片新增「设为默认」交互：

| 序号 | 功能 | 实现 |
|------|------|------|
| 1 | 标签样式 | 未激活：灰色边框/背景（`#FFFFFF14` / `#FFFFFF08`）、Regular 字体；激活：青色边框/背景（`#2DC3E133` / `#2DC3E11A`）、Medium 字体 |
| 2 | 位置布局 | 标签紧随模型标题，gap 8px |
| 3 | 交互逻辑 | 点击「设为默认」→ 变「默认中」；再次点击「默认中」→ 取消默认；点击其他模型自动取消前一个默认 |
| 4 | 状态管理 | 新增 `setDefaultOnelinkModel` / `setDefaultCustomProviderModel` 函数，按 tab 独立管理默认模型（对话/图片/视频/配音各自独立） |
| 5 | 数量统计修复 | OneLinkAI 服务商卡片「已配置模型」从硬编码 `23` 改为动态计算 `Object.values(modelsByTab).reduce(...)` |

**改动文件**：`src/components/ApiConfigModal.jsx`

**验证结果**：
- ✅ 标签样式符合设计稿
- ✅ 点击切换默认状态正常
- ✅ 取消默认功能正常
- ✅ 模型数量实时统计
- ✅ 构建通过（0 错误）

**✅ 已完成（2026-06-02）— API 配置弹窗后端对接**

| 序号 | 功能 | 实现 |
|------|------|------|
| 1 | 弹窗宽度 | 配置 OneLinkAI API 二级弹窗从 400px 改为 800px |
| 2 | 测试连接 | 调用 `POST /api/providers/oneclick-setup`，传入用户输入的 api_key，连通后自动将后端返回的模型列表按 category 分发到各 tab |
| 3 | 添加自定义模型 | 调用 `POST /api/models`，传入 model_id；后端返回错误时 toast 提示「模型添加失败！id不匹配」 |
| 4 | 设为默认 | 打开子弹窗时调用 `GET /api/models` 初始化 `is_default` 状态；点击时乐观更新本地 + 调用 `PATCH /api/models/{id}` 同步后端 |
| 5 | 按钮样式 | 「添加模型」按钮去掉阴影，边框改为 `1px dashed #FFFFFF33` |

**改动文件**：`src/components/ApiConfigModal.jsx`。构建通过（0 错误）。

**✅ 已完成（2026-06-03）— 项目总览页面布局调整**

| 序号 | 调整内容 |
|------|----------|
| 1 | 项目信息区字段改为单列布局（项目名称、项目描述、画面比例、视觉风格、项目封面独立成行） |
| 2 | 所有字段宽度统一改为 24.15% |
| 3 | 资产概况卡片网格从 9 宫格（3×3）改为 6 宫格（3×2） |

**改动文件**：`src/pages/GlobalSettings.jsx`

### 待开发
- [ ] 创作页（生视频 持续完善）
- [ ] 资产库（持续完善）
- [ ] 页面调用方迁移：逐步将 legacy alias 替换为新函数签名（加 `projectId` 参数）
- [ ] 与后端确认 9 个前端有·后端无接口的规划（微信绑定/换绑手机/视频尾帧等）

---

## 五、后端对接说明

- 前端已完成 API 接入审查（2026-05-18），所有缺失接口均已用 mock 函数占位
- 后端接口就绪后，搜索以下关键词快速定位占位点：
  ```
  VITE_USE_MOCK        — mock 分支入口
  TODO: 替换为真实接口  — 需要替换的位置
  ```
- 详细清单见 `API_AUDIT.md`，按 P0 → P1 → P2 → P3 优先级排列
---

## 六、代码重构 — CreationPage 组件拆分

> 最后更新：2026-06-24

### 目标

将 `src/pages/CreationPage.jsx`（原 5357 行）和 `src/pages/StoryboardPage.jsx`（原 6639 行）中的内联组件逐步抽离为 `src/components/` 下的独立文件。每个组件文件只做一件事，便于测试、复用和维护。

### 总览

| 指标 | 值 |
|------|-----|
| CreationPage 原大小 | 5357 行 |
| CreationPage 现大小 | 4652 行 |
| 已减少 | **705 行（13.1%）** |
| 新建组件 | 21 个 |
| 新建工具文件 | 4 个 |
| StoryboardPage 状态 | 尚未开始 |

### 已完成 — 批次 1（纯 SVG 图标）

**创建 7 个文件，-150 行**

| 组件 | 说明 |
|------|------|
| `StarIcon` | 收藏星标，已在 ImageDetailModal 中重复定义，后续需去重 |
| `RatioIcon` | 画面比例标识方块 |
| `DubbingEqIcon` | 配音均衡器图标 |
| `EmptyIconShell` | SVG 容器（渐变遮罩+圆角矩形基底），被下方 3 个组件共用 |
| `CreationEmptyIconImage` | 图片空态图标 |
| `CreationEmptyIconVideo` | 视频空态图标（胶片+播放三角） |
| `CreationEmptyIconDubbing` | 配音空态图标（麦克风） |

**同时提取**：`downloadImage` → `src/utils/downloadImage.js`

> **注意**：`StarIcon`、`ModalActionBtn`、`formatCreationDate`、`downloadImage` 在 `src/components/ImageDetailModal.jsx` 中也有重复定义，后续去重。

### 已完成 — 批次 2（简单按钮/菜单项）

**创建 9 个文件（含 fonts.js），-241 行**

| 组件 | 说明 |
|------|------|
| `UploadMenuItem` | 上传菜单项按钮 |
| `GenTypeDropdownItem` | 生成类型下拉项（选中/未选中双图标） |
| `DropdownItem` | 通用下拉项 |
| `RefModeDropdownItem` | 参考图模式下拉项 |
| `CardActionBtn` | 卡片操作按钮（含 Tooltip） |
| `ModalActionBtn` | 弹窗操作按钮 |
| `CreationGhostBtn` | 幽灵风格按钮 |
| `CreationPlainBtn` | 朴素风格按钮 |

**同时提取**：`FONT` / `FONT_MEDIUM` → `src/utils/fonts.js`

### 已完成 — 批次 3（轻量组件 + 工具函数）

**创建 8 个文件，-322 行**

| 组件/工具 | 说明 |
|-----------|------|
| `CopyPromptButton` | 复制提示词按钮 |
| `Toast` | Toast 通知（success/warning/error 三态 SVG 图标） |
| `SoundToggle` | 配音开关（ant-design 风格滑块） |
| `CreationTabBar` | 图片/视频/配音三标签栏（内嵌 DEFAULT_TABS） |
| `BatchButton` | 批量操作按钮 |
| `CreationLoginEmptyState` | 未登录空态提示 |
| `formatMentionLabel` | 文件名截断工具 → `src/utils/formatMentionLabel.js` |
| `formatCreationDate` | ISO 时间格式化 → `src/utils/formatCreationDate.js` |

### 待完成

**批次 4 — 中等复杂度组件（Dropdown 等）**

以下组件依赖已提取的叶子组件（RatioIcon、DropdownItem 等），需按依赖顺序提取：

1. `Dropdown` — 通用下拉容器
2. `GenTypeSelector` — 依赖 Dropdown + GenTypeDropdownItem + GEN_TYPE_OPTIONS
3. `ModelSelector` — 依赖 Dropdown + DropdownItem
4. `ParamsSelector` — 依赖 RatioIcon
5. `RefModeSelector` — 依赖 Dropdown + RefModeDropdownItem
6. `VideoParamsSelector` — 独立（无内联组件依赖）
7. `SendButton` — 依赖 PulsingBorder、`creation-thinking-dot` class
8. `DubbingAdjust` — 依赖 DubbingEqIcon（已提取）

**注意**：
- `SendButton` 使用了 `PulsingBorder`（`@paper-design/shaders-react`）和 `createPortal`，提取时需额外导入
- 动态注入的 `<style>`（`ensureThinkingStyle` 等）是否同时迁移待定

**批次 5 — 文件上传相关组件**

1. `UploadPlaceholder` — 依赖 UploadMenuItem（已提取）+ ALLOWED_EXTS 常量
2. `FrameUploader` — 依赖 UploadPlaceholder + UploadMenuItem
3. `FileCard` — 仅依赖 FONT
4. `ImageViewModal` — 仅依赖 FONT
5. `FilePreviewTooltip` — 独立（纯 CSS 定位）
6. `isImageFile` / `isVideoFile` — 纯工具函数，可迁到 `src/utils/`

**批次 6 — 结果卡片组件**

1. `VideoResultCard` — 依赖 CardActionBtn + StarIcon
2. `ImageResultCard` — 依赖 CardActionBtn + StarIcon
3. `AudioResultCard` — 依赖 CardActionBtn
4. `ImageDetailModal` — 依赖 ModalActionBtn + StarIcon + formatCreationDate

> 注意：`ImageDetailModal` 与 `src/components/ImageDetailModal.jsx` 同名但不同实现，后续需合并/区分命名

**批次 7 — 聚合组件 + 页面骨架**

1. `CreationResultState` — 依赖 VideoResultCard + ImageResultCard + AudioResultCard + BatchButton + CreationPage state
2. `CreationEmptyState` — 依赖 CreationTabBar + SendButton + EMPTY_ICON_MAP
3. `InputCard` — 约 900 行，依赖 GenTypeSelector + ModelSelector + ParamsSelector + SoundToggle + DubbingAdjust + UploadPlaceholder + FrameUploader
4. `EMPTY_ICON_MAP` — 简单常量，合并到 CreationEmptyState 或留在 CreationPage
5. `DETAIL_PANEL_DIVIDER` — 极简常量，合并到 ImageDetailModal（唯一使用方）
6. 页面骨架 — `export default function CreationPage` 主体逻辑

**批次 8 — StoryboardPage 拆分**

与 CreationPage 相同的拆分流程。当前行数：6639 行。

### 提取原则

- 每个文件一个组件，命名大驼峰
- 共用常量 → `src/utils/fonts.js` 等共享模块
- 样式：组件自身字体引用 `import { FONT } from '../utils/fonts'`
- 提取后清理 CreationPage 中的 `function xxx` 定义并添加 `import xxx from '...'`
- 每次提取完成后执行 `vite build` 验证
- 不触碰未受影响的文件，不做无关重构
- 不去重已有独立组件中的重复定义，留待后续统一清理

### 依赖提取提示

CreationPage 中有些内联常量被多个组件引用，提取前需确认是否所有引用方都已提取或复制：

| 常量 | 引用方 | 处理方式 |
|------|--------|----------|
| `FONT` / `FONT_MEDIUM` | 几乎所有组件 | ✅ 已提取到 `src/utils/fonts.js` |
| `ALLOWED_EXTS` / `ALLOWED_IMAGE_EXTS` / `ALLOWED_VIDEO_EXTS` / `ALLOWED_AUDIO_EXTS` / `ALLOWED_MEDIA_EXTS` | UploadPlaceholder / FrameUploader / FileCard | 待提取时同步迁入 |
| `GEN_TYPE_OPTIONS` | GenTypeSelector | 待提取时作为 prop 传入或迁入 |
| `EMPTY_ICON_MAP` | CreationEmptyState | 待批次 7 处理 |
| `DETAIL_PANEL_DIVIDER` | ImageDetailModal | 待批次 6 处理，迁入该组件 |
