# 页面开发规范

> 文档类型：页面入口和页面迁移专项规则
> 最后更新：2026-07-15（新增功能开发前置决策规则）

## 1. 文件命名与目录

- 页面入口文件使用大驼峰，放在 `src/pages/`，例如 `SubjectPage.jsx`。
- 页面专属且暂不复用的布局或区块可以与入口同目录；稳定复用后迁移到 `src/components/<domain>/`。
- 通用基础组件不得放在页面文件中；统一放入 `src/components/ui/` 或对应分层目录。
- 新增页面功能前必须先检索本地组件库、`docs/refactor/component-inventory.md` 和 `design-system/`，再决定复用、扩展已有组件或新增组件；Tab、Button、Input、Select 等通用能力不得直接写进页面。
- 页面入口是编排层，不是新功能的默认容器；新增页面应优先由页面 Hook、布局组件和业务区块组成，保持主页面洁净。

## 2. 页面入口职责

页面入口负责页面级状态、路由上下文、生命周期、API/Store 编排和业务区块组合。页面不应堆积按钮、复杂弹窗、表单字段、长列表项、重复反馈、请求细节和大量局部工具函数。

目标结构：

```jsx
export default function CreationPage() {
  const pageState = useCreationPage();

  return (
    <CreationLayout>
      <CreationHeader {...pageState.header} />
      <CreationSidebar {...pageState.sidebar} />
      <CreationWorkspace {...pageState.workspace} />
      <CreationFooter {...pageState.footer} />
    </CreationLayout>
  );
}
```

这只是页面结构示例，不要求把所有逻辑强行塞进一个 Hook。页面应保持可读，优先显示“状态来源 → 区块组合 → 页面级副作用”的关系。

## 3. 页面规模警告线

- 页面入口：300 行；
- 业务区块组件：400 行；
- Hook：300 行；
- 单个函数：50 行。

以上是警告线，不是绝对硬限制。历史复杂页面可以分阶段迁移，但必须在迁移记录中写明原因、风险和下一步，不得通过压缩代码绕过检查。

## 4. 页面开发流程

1. 先阅读本文件、`docs/architecture/page-architecture.md`、`component-architecture.md`、`import-rules.md` 和 `feature-development.md`。
2. 打开大型页面前，先阅读顶部结构索引；没有索引时先建立状态、数据流和区块地图。
3. 盘点所有状态、setter、Store、API、effect、定时器、ref、props、回调和闭包变量。
4. 先拆纯展示区块，再拆交互区块，最后拆可复用 Hook；每次只迁移一个明确区块。
5. 拆分时保持原 props、回调签名、API 参数、视觉 Token 和用户流程。
6. 迁移后全局搜索旧定义、旧导入、失效回调和未定义变量，检查 import/export 与目录入口。
7. 更新相关文件顶部结构索引、`docs/refactor/component-inventory.md` 和迁移记录。
8. 执行定向 ESLint、`npm run build`、`npm run check:architecture`、`git diff --check`，并验证关键页面路径。

## 5. 引用安全要求

- 每个从页面移出的变量必须明确落到 props、Hook 参数、Store 选择器或纯函数参数。
- 不得把整个页面状态对象透传给所有子组件。
- 子组件不得读取页面闭包中的变量；没有显式传入的回调视为无效依赖。
- 新增组件必须同步导出；删除组件前必须全局搜索调用方。
- 构建通过不代表运行时安全，必须检查 `ReferenceError`、undefined props、回调参数缺失和加载/刷新恢复路径。

## 6. 样式规则

涉及颜色、圆角、字号、间距、按钮状态和弹窗视觉时，先读 `design-system/CLAUDE.md`、`design-system/tokens.md` 和对应组件文档。设计稿优先，不在结构迁移中自行发挥视觉。

## 7. 完成条件

只有当结构索引、引用检查、定向检查、构建和关键流程验证都完成后，页面区块才能标记为迁移完成。完整仓库 `npm run lint` 若被历史问题阻塞，必须如实记录，不能伪报通过。
