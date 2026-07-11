# miioo 项目上下文

## 技术栈
React 19 + Tailwind CSS v4 + Vite 8 / 仅深色主题 / Token 通过 `@theme` 注册在 `src/index.css`

## Git 推送
```bash
git push https://wangchengxv:<token>@github.com/miioo-aigc/miioo.git <branch>
```

## 规则文档
任务开始前，根据任务类型主动读取对应文档，无需用户提示：
- 涉及样式、颜色、间距、组件视觉 → 读 `design-system/CLAUDE.md`
- 涉及 API 函数、数据请求、mock、接口对接 → 读 `src/api/CLAUDE.md`
- 日常调接口 → 直接读 `src/api/api文档.json`

## 项目结构

```
src/
├── api/          # 11 个文件，统一通过 request.js 请求
│   ├── request.js        ← 请求层（双 token 自动刷新）
│   ├── storyboard.js     # 分镜相关接口
│   ├── assets.js / creation.js / subject.js / project.js / config.js
│   ├── auth.js / user.js / settings.js / voices.js / user-styles.js
│   └── api文档.json      ← 接口文档（对接时先读）
├── components/  # 126 个通用组件（每个文件只做一件事，10 个 Creation- 已迁至 pages/creation/）
│   ├── 按钮家族 — 两种视觉风格，不可混用：
│   │   ├── 玻璃渐变（gradient+shadow）：PrimaryBtn / GhostBtn
│   │   ├── 简单边框（background+outline）：PrimaryButton / GhostButton
│   │   └── 纯文字/其他：PlainBtn / SecondaryBtn / IconBtn
│   ├── 弹窗类：ModalOverlay / ModalCloseBtn / ModalGhostBtn / ConfirmDialog
│   ├── 上传类：FrameUploadSlot / PanelUploadSlot / ImgUploadBtn / UploadBtn
│   ├── 选择器：ModelSelector / GenTypeSelector / RefModeSelector / AssetPickerModal
│   ├── 生成面板：GenerateImagePanel / GenerateVideoPanel
│   ├── 结果卡片：ImageResultCard / VideoResultCard / AudioResultCard
│   ├── ShotRow / ShotViewerModal / EpisodeSelector / Toast / DotsLoading
│   └── 其他 120+ 组件
├── config/      # 模型能力配置
├── pages/       # 业务页面（⚠ 行数标注 = 重构优先级）
│   ├── Home.jsx                2185 行 🚨
│   ├── ScriptPage.jsx          2240 行 🚨
│   ├── CreationPage.jsx         919 行 ✅
│   ├── SubjectPage.jsx          908 行 ✅（subject/ 19 文件）
│   ├── GlobalSettings.jsx       855 行
│   ├── ProjectList.jsx          755 行
│   ├── AssetsPage.jsx           548 行 ✅（assets/ 20 文件）
│   ├── StoryboardPage.jsx       478 行 ✅（storyboard/ 10 文件）
│   ├── DubbingVoiceModal.jsx    399 行
│   ├── InputShowcase / ButtonShowcase  # 开发用展示页
│   ├── creation/               # 10 文件（Creation 前缀组件 + EmptyIconShell）
│   │   ├── CreationEmptyState / CreationResultState / CreationGhostBtn
│   │   ├── CreationLoginEmptyState / CreationPlainBtn / CreationTabBar
│   │   ├── CreationEmptyIconDubbing / CreationEmptyIconImage / CreationEmptyIconVideo
│   │   └── EmptyIconShell
│   ├── storyboard/             # 10 文件（components/ 7 + hooks/ 3）
│   │   ├── components/（AddShotButton / ShotList / StoryboardToolbar / ToastPortal 等）
│   │   └── hooks/（useBatchGeneration / useDownloadMode / useShotOperations）
│   ├── subject/                # 19 文件
│   │   ├── AddCard / CharCard / EditSubjectPanel / ImageViewModal / MoreMenu
│   │   ├── RadioOption / RefImageField / RefImageItem / RefImageUploadCard
│   │   ├── SelectField / SubjectRefHoverPreview / TabNav / Toolbar
│   │   ├── UploadBtn / VoiceCard / VoiceSelectModal / ImageItem / ImageItemUpload
│   │   └── IconBtn
│   ├── assets/                 # 20 文件
│   │   ├── AssetCard / AssetDetailModal / ProjectAssetCard / ProjectAssetsPanel
│   │   ├── AudioCard / BatchActionBtn / MoreMenu / FavFilterCheckbox / EmptyAssetState
│   │   ├── ProjectListItem / VideoFrameThumbnail
│   │   ├── ShotDetailModal / ShotVideoDetailModal / SubjectAssetDetailModal
│   │   ├── ModuleTabBar / TabBar
│   │   └── DownloadIcon / TrashIcon / GhostButton / PlainBtn
├── stores/     # Zustand（creationStore.js）
├── utils/      # 22 个工具函数
│   ├── fonts.js ← 共享字体常量（FONT / FONT_MEDIUM）
│   ├── fileTypes.js ← 文件类型常量（ALLOWED_EXTS 等）
│   ├── cache.js / cacheKeys.js / taskPolling.js / serialPolling.js
│   └── download.js / imageUrl.js / episodeUtils.js 等
└── ref/        # 设计稿参考代码（只读，不修改）
```

### 文件命名规范
- 组件文件：**大驼峰**（`ShotRow.jsx`），每个组件只做一件事
- Hook 文件：**useXxx.js**（`useDownloadMode.js`）
- 工具函数：**小驼峰**（`episodeUtils.js`）
- 页面子模块：**放在 `pages/<页面名>/` 子目录**

### 组件放置规则

- **先查再建**：新建组件前必须 `rg` 搜索 `components/` 目录，避免在页面子目录创建同名副本
- **页面子目录仅放页面专属组件**：与 `components/` 功能重复的一律删除，改用 `components/` 版本（通过 props 扩展适应新场景）
- **不可混淆视觉风格**：同一名称的组件在两处有视觉差异会导致开发者困惑，必须统一
- **图标组件统一放 `components/`**：不以页面维度拆分图标库
- **当前去重清单**（`pages/assets/` vs `components/`）：
  - ✅ 已合并：GhostBtn、StarIcon、WaveformBars（已统一使用 components/ 版本）
  - 需 prop 扩展后合并：FavFilterCheckbox、TabBar、ModuleTabBar、DownloadIcon、TrashIcon
  - 视觉差异需统一：GhostButton、PlainBtn、BatchActionBtn、AudioCard

## 开发规范

### 开发优先级
1. 设计稿代码 → 完全复刻，不自行发挥；复刻时将 Tailwind CSS 数字缩写转换为具体数值
2. Token 替换 → 颜色/圆角/字号用 token 类名
3. 设计规范组件文档 → `design-system/components/xxx.md`
4. frontend-design 插件 → 无设计稿时制定视觉规则

**需求不清晰时，必须先向 Suzy 确认再动手。**

### 页面行数控制

| 页面行数 | 状态 | 措施 |
|----------|------|------|
| ≤ 600 行 | ✅ 健康 | 正常开发维护 |
| 600–1000 行 | ⚠️ 预警 | **新增功能前必须先提取 Hook** |
| > 1000 行 | 🚨 超标 | **禁止新增内联逻辑，必须拆分后再加功能** |

### 拆分原则：从叶子到聚合

每次重构遵循自底向上，保证每一步都能构建通过：

1. **提取状态 Hook** → `useXxx.js`（useState / useEffect / 业务函数）
   - 先提取最独立的叶子 Hook，再提取依赖它们的聚合 Hook
   - 每提取一个立即 `npx vite build` 验证
2. **提取 UI 子组件** → `XxxComponent.jsx`（JSX 渲染区）
   - 优先提取纯展示组件（无业务逻辑），再提取带交互的复合组件
3. **整理 imports** → 删除不再使用的导入
4. **重复以上** → 直到页面 ≤ 400 行或所有可提取的逻辑均已提取

### 提取验证规则 —— 每次提取后必须执行

每提取一个组件或 Hook，立即执行以下检查，**禁止跳过**：

1. `npx vite build` — 确保构建通过 ✅
2. 确认 import 指向的是**已存在的文件** — 禁止先加 import 后建文件
3. 确认内联定义已**完整删除** — 避免重复声明错误
4. 确认被提取组件所需的**所有依赖**（FONT、TrashIcon 等）已在目标文件正确导入

**严禁**：
- 先写 `import X from './path/X'` 再后续创建文件
- 保留内联原版的同时添加新的 import（导致 `already been declared` 错误）
- 跳过构建验证直接进入下一个提取任务

### 组件复用规则

- **不新建 Sb- / Creation- 等前缀组件**。如需定制，通过 props（如 `variant` / `size`）扩展现有组件。
- **按钮统一用 `components/` 下已有按钮**，通过 `icon` / `children` / `disabled` / `loading` / `danger` 等 props 覆盖场景。
- **不要整模块导入**：`import { a, b } from 'x'` 而非 `import * as X from 'x'`。
- **按钮命名约定**：
  - 玻璃渐变风格 → `GhostBtn` / `PrimaryBtn`（Btn 后缀）
  - 简单边框风格 → `GhostButton` / `PrimaryButton`（Button 后缀）
  - 两种风格**不可互换**，选择取决于设计稿

### 代码组织模板

页面文件内按固定顺序排列：
```
// 1. 第三方库 import（React / Zustand 等）
// 2. 内部 Hook import（useXxx）
// 3. 内部组件 import（按路径深度排序：./storyboard/ > ../components/ > ../../）
// 4. 工具函数 / 常量 import
// 5. 组件函数体：
//    a. props 解构
//    b. useState / useRef
//    c. 自定义 Hook 调用
//    d. useEffect / useCallback / useMemo
//    e. 事件处理函数
//    f. 条件渲染 / 早期 return
//    g. JSX return
```

## 代码安全
**严禁在任何情况下主动回滚代码。** 若评估后认为回滚是必要选项，必须做到以下三点才能继续：
1. 向 Suzy 反复确认（至少说明一次以上）
2. 清晰声明回滚的必要性（为什么其他方案不可行）
3. 列出回滚可能带来的弊端（数据丢失风险、功能退代、冲突风险等）
未经 Suzy 明确同意，禁止执行任何形式的 `git revert` / `git reset` / 强制覆盖操作。

## 当前进度

### 重构状态（2026-06-24）
| 页面 | 行数 | 状态 |
|------|------|------|
| StoryboardPage | 478 | ✅ 3 Hook + 7 子组件，收进 storyboard/ 子目录 |
| CreationPage | 919 | ✅ creation/ 10 文件（含 CreationVideoDetailModal 留 components/ 共享） |
| AssetsPage | 548 | ✅ 20 文件收进 assets/ 子目录 |
| SubjectPage | 908 | ✅ 19 文件收进 subject/ 子目录 |
| ScriptPage | 2240 | ⏳ 排队 |
| Home.jsx | 2185 | ⏳ 排队 |
| GlobalSettings | 855 | ⚠️ 接近预警线 |
| ProjectList | 755 | ⚠️ 接近预警线 |

详见 `PROJECT.md`

## 规则文档
任务开始前，根据任务类型主动读取对应文档，无需用户提示：
- 涉及样式、颜色、间距、组件视觉 → 读 `design-system/CLAUDE.md`
- 涉及 API 函数、数据请求、mock、接口对接 → 读 `src/api/CLAUDE.md`
- 新建或修改页面组件 → 读 `src/pages/CLAUDE.md`

## 代码文件阅读规则
- 打开任何页面或组件文件前，**先阅读文件顶部的结构索引注释**，再开始分析或修改代码
- 结构索引格式为文件顶部的 `/** 结构索引 ... */` 注释块，包含状态层、数据流、组件结构、副作用的位置索引
- 若文件无结构索引，说明该文件尚未整理，直接阅读代码即可

## 代码文件修改规则
- 每次完成任务后，**必须同步更新该文件顶部的结构索引**，确保行号和结构描述与当前代码一致
- 若新增了组件、hook、副作用，必须追加到索引对应分类下
- 若删除或移动了代码块，必须从索引中移除或修正对应条目
- 索引更新是任务完成的必要条件，未更新索引视为任务未完成

## 后端接口对接
- 日常调接口 → 直接读 `src/api/api文档.json`
- 后端更新 `api文档.json` → 遵循 `src/api/CLAUDE.md` 中的全量差异分析流程，AI 直接分析更新报告（不用脚本）
