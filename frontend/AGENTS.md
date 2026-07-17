# miioo 前端协作规则

> 文档类型：项目总规则入口
> 最后更新：2026-07-15
> 适用范围：`/Users/suzylee/Desktop/miioo/frontend`

## 1. 项目基线

- 技术栈：React 19、Tailwind CSS v4、Vite 8、Zustand。
- 产品主题：仅深色主题；颜色、圆角、字号和间距优先使用 `src/index.css` 注册的 Token。
- 当前重构分支：`feat/frontend_V1.1`。
- 反馈和交付说明统一使用中文。

## 2. 目录职责

```text
src/
├── pages/       页面入口：页面级状态、生命周期和业务区块编排
├── components/  可复用 UI、反馈、遮罩、动作和业务域组件
├── hooks/       可复用状态逻辑（当前目录按需建立）
├── stores/      Zustand 全局状态
├── api/         接口函数和请求适配
├── config/      模型及能力配置
├── utils/       无业务界限或跨域的纯工具
├── layouts/     页面布局框架（按需建立）
└── ref/         设计稿参考代码，只读
```

组件目录按复用范围分层：`ui`、`feedback`、`overlay`、`actions` 和业务域目录。具体放置规则见 [`docs/architecture/component-architecture.md`](./docs/architecture/component-architecture.md)。

## 3. 不可违反的开发规则

1. 设计稿优先；已有设计稿时不得自行改变视觉和交互。无设计稿或需求有歧义时，先向 Suzy 提供可选方案、推荐方案和影响，等待决定后再修改。
2. 页面入口只负责页面级状态、数据流、生命周期和业务区块编排。按钮、表单字段、弹窗、列表项、重复反馈和稳定业务区块必须按复用范围抽离。
3. `src/components/ui/` 只能包含无业务基础组件，不得引用页面、业务 API、业务 Store 或业务域组件。
4. 页面迁移遵循 [`docs/refactor/migration-guide.md`](./docs/refactor/migration-guide.md)，以“结构变化、行为不变”为前提；不要在一次迁移中混入无关的接口或视觉改版。
5. 任何拆分都必须显式盘点 props、回调、闭包变量、API 返回字段和副作用。迁移后必须全局搜索旧引用、检查 import/export，并执行构建，避免出现 `xxx is not defined`、引用缺失或默认导出不一致。
6. 文件名使用大驼峰；一个组件只承担一个清晰职责。页面和组件的规模警告线不是压缩代码或牺牲可读性的理由。
7. 打开页面或大型组件前，先阅读文件顶部结构索引；修改后同步索引、真实行号和更新记录。规则见 [`src/pages/STRUCTURE_INDEX_SPEC.md`](./src/pages/STRUCTURE_INDEX_SPEC.md)。
8. 新增页面、组件、Tab、表单控件、按钮、弹窗或稳定业务区块前，必须先检索本地组件库、组件资产清单和设计系统，再决定直接复用、扩展已有组件、放入 `ui`/业务域，还是暂留页面。完整流程见 [`docs/architecture/feature-development.md`](./docs/architecture/feature-development.md)。
9. 新增功能不得把通用 UI 或稳定业务区块直接堆入页面入口；主页面只保留页面级状态、生命周期、业务编排和区块组合。需求有多个合理方案或存在视觉/交互歧义时，先向 Suzy 提供选择、推荐和影响，等待决定。
10. 从设计稿复制代码时，必须先将 Tailwind CSS 数字缩写转换为具体 px 数值后再写入项目，不得原样保留 `gap-3`、`px-4`、`py-2` 等缩写；详细规则见 [`design-system/AGENTS.md`](./design-system/AGENTS.md)。

## 4. 任务开始前必须读取的文档

- 新建或修改页面、业务组件：`src/pages/CLAUDE.md`、`docs/architecture/page-architecture.md`、`docs/architecture/component-architecture.md`、`docs/architecture/import-rules.md`。
- 新增页面或组件功能：先读 `docs/architecture/feature-development.md`，并按其中的组件检索和归属决策流程执行。
- 修改 API、请求、mock 或接口适配：`src/api/CLAUDE.md`、`src/api/api文档.json`。
- 修改颜色、间距、字号、交互状态或基础组件：`design-system/CLAUDE.md`、`design-system/tokens.md` 和对应的 `design-system/components/*.md`。
- 进行页面迁移：`docs/refactor/migration-guide.md`、`docs/refactor/component-inventory.md` 及当前 OpenSpec 任务清单。

## 5. 验收命令

```bash
npm run lint
npm run build
npm run check:architecture
git diff --check
```

迁移页面还必须做关键用户流程验证。完整仓库 `lint` 若被历史问题阻塞，不能伪报通过，需记录具体文件和错误；当前页面的定向检查仍必须执行。

## 6. Git 与安全

- 未经 Suzy 明确同意，禁止执行 `git reset`、`git revert`、强制覆盖或其他主动回滚操作。
- 不在文档、日志或命令中写入真实访问令牌、密码或私密环境变量；使用已配置的远程和本地环境完成 Git 操作。
- 本任务默认不提交、不推送；只有 Suzy 明确要求时才执行。

## 7. 进度和文档入口

- 项目整体进度：[`PROJECT.md`](./PROJECT.md)
- 组件重构规划：[`openspec/changes/reorganize-frontend-components/`](./openspec/changes/reorganize-frontend-components/)
- 组件资产和迁移记录：[`docs/refactor/component-inventory.md`](./docs/refactor/component-inventory.md)
- 架构规则：[`docs/architecture/`](./docs/architecture/)
- 设计系统：[`design-system/`](./design-system/)

完成一个页面或架构阶段后，必须同步进度、迁移记录和受影响的规则文档；不得保留与代码现状冲突的“已完成”描述。
