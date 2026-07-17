# 样式与视觉规范

> 文档类型：设计系统使用规则
> 最后更新：2026-07-15（新增功能开发前置决策规则）

## 1. 使用优先级

1. 有设计稿时，优先复刻设计稿的布局、尺寸、状态和交互，不自行发挥。
2. 颜色、圆角、字号、字体、间距和阴影优先使用 `src/index.css` 注册的 Token；完整定义见 `tokens.md`。
3. 组件视觉和交互优先参考 `components/*.md` 对应文档。
4. 没有设计稿时，先写出视觉规则和状态清单，再实现；不能凭感觉估算关键尺寸。

## 2. Token 规则

- 颜色使用 `bg-*`、`text-*`、`border-*` 等 Token 类名，禁止在页面中重复硬编码已有颜色。
- 圆角、字号、字体和间距使用设计系统 Token；设计稿中的数值需按项目约定转换为可读的 px 类名或对应 Token。
- 从设计稿复制代码时，Tailwind CSS 中的数字缩写必须先转换为具体数值后再写入项目；例如 `gap-3`、`px-4`、`py-2` 必须按设计稿和项目间距规则改为 `gap-[具体px]`、`px-[具体px]`、`py-[具体px]`，不得原样保留数字缩写。
- 如果确实没有对应 Token，允许局部使用明确数值，但必须确认不是已有 Token 的重复定义。
- 新增或修改 Token 时，必须同步 `design-system/tokens.md`，并检查受影响组件的默认、悬停、按下、禁用、加载和聚焦状态。

## 3. 基础组件复用

- 视觉和交互相同的按钮统一使用 `src/components/ui/Button`、`IconButton`、`TextButton` 或 `ButtonGroup`。
- 选择模型、比例、分辨率等表单选择器，优先复用 `src/components/ui/Select`；业务域只提供选项、值和回调。
- 页面不得重复实现已有 Button-like、Select-like 或基础弹窗的完整视觉。
- 带 API、权限、确认或 Toast 的按钮不能把业务逻辑塞入基础 UI，应由页面、Hook、`actions/` 或业务域组件编排。
- 新增 Tab、Button、Input、Select 或其他基础组件前，必须先检索 `src/components/ui/`、`docs/refactor/component-inventory.md` 和本目录现有组件文档；优先直接复用或扩展已有组件，不能在页面中复制基础视觉实现。
- 新增通用组件必须放入 `src/components/ui/`，通过目录入口导出，并同步新增/更新对应的 `design-system/components/*.md` 文档；页面只负责传值和业务回调。
- 新增功能的完整组件归属决策见 [`../docs/architecture/feature-development.md`](../docs/architecture/feature-development.md)。

## 4. 视觉状态清单

新增或迁移组件时，至少核对：

- 默认；
- 悬停；
- 按下；
- 禁用；
- 加载；
- 聚焦和键盘操作；
- 空态、错误态和成功反馈（适用时）；
- 深色背景下的文字、图标、描边和对比度。

结构迁移不得顺手改变视觉状态；若设计稿与现有代码冲突，先向 Suzy 给出“保持现状”与“按设计稿修正”的选择和影响。

## 5. 布局和分隔

- 有设计稿时直接复刻设计稿数值；没有设计稿时先确定间距层级。
- 页面层级优先用留白、容器背景和 Token 描边表达，极少使用分割线。
- 弹窗内部优先使用间距分组，不用横线堆叠模块。
- 组件不得因为抽离而改变原有尺寸、层级、滚动容器或遮罩关系。

## 6. 开发前必读

- `design-system/tokens.md`：Token 定义；
- `design-system/components/xxx.md`：对应组件契约；
- `design-system/page-layout.md`：页面布局；
- `design-system/spacing.md`：间距规则。

设计系统组件文档是具体组件的视觉参考，不能覆盖项目架构、页面状态和 API 边界规则；发生冲突时，分别遵循对应专项文档并先确认不明确的部分。
