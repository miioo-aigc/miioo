# 导入边界规范

> 文档类型：目录依赖与导入规则
> 最后更新：2026-07-15

## 1. 总体依赖方向

```text
pages
  ├── components/ui
  ├── components/feedback
  ├── components/overlay
  ├── components/actions
  ├── components/<domain>
  ├── hooks
  ├── stores
  ├── api
  └── utils

components/<domain> / components/actions
  ├── components/ui
  ├── components/feedback
  ├── components/overlay
  ├── hooks
  ├── api（只有明确业务动作需要时）
  ├── stores（只有明确业务状态需要时）
  └── utils

components/feedback / components/overlay
  └── components/ui、utils

components/ui
  └── utils（只能使用通用工具）

api
  ├── request.js
  ├── utils（接口适配所需）
  └── 不得引用 pages 或 React 业务组件
```

## 2. 明确禁止

- `src/components/ui/` 不得导入 `src/pages/`、`src/api/`、`src/stores/` 或业务域组件。
- `ui` 组件不得直接调用接口、修改业务 Store、决定页面路由或显示业务 Toast。
- API 模块不得引用页面或组件；页面不得直接拼接请求 URL、header 或重复实现 token 刷新。
- 页面和业务组件不得通过相对路径跨越多个业务目录引用页面内部实现。
- 页面不得复制已有基础组件的完整视觉实现；需要新状态时先评估扩展公开 API 或新增明确语义组件。
- 业务域组件不得反向引用页面入口，不能依赖页面中的未声明变量或闭包。
- 禁止用“导出一个巨大对象”替代清晰的 props 契约，禁止无差别透传整个页面状态。

## 3. 推荐导入方式

优先使用目录入口，减少页面绑定内部文件路径：

```jsx
import { Button, IconButton, Select } from '../components/ui';
import { SubjectCard, SubjectGrid } from '../components/subject';
```

目录入口只导出该目录的稳定公开能力。新增导出时必须同步检查名称冲突、默认导出和循环依赖。

## 4. 迁移时的引用安全检查

每次抽离一个区块后，按以下顺序检查：

1. 列出被移动代码读取的所有变量、状态 setter、回调、API、Store、常量和工具函数。
2. 将它们逐一改为 props、Hook、业务工具参数或组件内部局部变量。
3. 搜索旧定义名和旧导入路径，确认没有残留调用方。
4. 检查新文件的 import、导出入口和调用方名称完全一致。
5. 对目标文件执行定向 ESLint，并运行 `npm run build`。
6. 对页面进行运行时关键路径验证，特别关注 `xxx is not defined`、undefined props、回调参数缺失和循环依赖。

任何一项未完成，都不能把该区块标记为迁移完成。

## 5. 可执行检查的边界

当前项目已提供 `npm run check:architecture`，检查文件命名、页面/组件/Hook 规模告警、基础 UI 反向依赖、规则文档镜像一致性、结构索引占位符，以及 API/反馈/遮罩/业务组件的页面反向依赖。页面 300 行、组件 250/400 行、Hook 300 行和函数 50 行目前作为文档警告线，不自动阻断；命名、文档镜像不一致、结构索引占位符和非法导入属于阻断级错误。

如需新增独立的 `check:page-size`、`check:imports` 或 `check:structure` 命令，必须先明确输出格式、阻断级别和豁免方式，再单独修改脚本和 `package.json`。
