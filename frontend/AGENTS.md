# miioo 项目上下文

## 技术栈
React 19 + Tailwind CSS v4 + Vite 8 / 仅深色主题 / Token 通过 `@theme` 注册在 `src/index.css`

## Git 推送
```bash
git push https://wangchengxv:<token>@github.com/wangchengxv/miioo.git <branch>
```

## 文件结构
```
src/
├── api/        接口函数（request.js 统一请求层，含双 token 自动刷新）
├── components/ 通用组件
├── config/     模型能力配置
├── layouts/    页面框架
├── pages/      业务页面
├── stores/     Zustand 状态（creationStore.js）
├── ref/        设计稿参考代码（只读）
└── utils/      工具函数
```
组件文件名大驼峰，每个组件只做一件事。

## 开发优先级
1. 设计稿代码 → 完全复刻，不自行发挥
2. Token 替换 → 颜色/圆角/字号用 token 类名
3. 设计规范组件文档 → `design-system/components/xxx.md`
4. frontend-design 插件 → 无设计稿时制定视觉规则

**需求不清晰时，必须先向 Suzy 确认再动手。**

**严禁在任何情况下主动回滚代码。** 若评估后认为回滚是必要选项，必须做到以下三点才能继续：
1. 向 Suzy 反复确认（至少说明一次以上）
2. 清晰声明回滚的必要性（为什么其他方案不可行）
3. 列出回滚可能带来的弊端（数据丢失风险、功能退化、冲突风险等）
未经 Suzy 明确同意，禁止执行任何形式的 `git revert` / `git reset` / 强制覆盖操作。

## 当前进度
✅ 已完成：首页 / 项目列表 / 工作流（全局设定/剧本/主体/分镜）/ 创作页 / 资产库基础 / API 层 / 认证层
🚧 进行中：创作页收尾 + 资产库完善（2026-05-28）
详见 `PROJECT.md`

## 规则文档
任务开始前，根据任务类型主动读取对应文档，无需用户提示：
- 涉及样式、颜色、间距、组件视觉 → 读 `design-system/CLAUDE.md`
- 涉及 API 函数、数据请求、mock、接口对接 → 读 `src/api/CLAUDE.md`
- 新建或修改页面组件 → 读 `src/pages/CLAUDE.md`

## 后端接口对接
- 日常调接口 → 直接读 `src/api/api文档.json`
- 后端更新 `api文档.json` → 遵循 `src/api/CLAUDE.md` 中的全量差异分析流程，AI 直接分析更新报告（不用脚本）
