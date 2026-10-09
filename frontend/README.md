# miioo

AIGC 影视化工作流产品，面向影视创作者，通过 AI 辅助完成从剧本创作到成片剪辑的全流程工作。

## 快速上手

```bash
git clone https://github.com/wangchengxv/miioo.git
cd miioo
npm install
npm run dev   # http://localhost:5173
```

## 开发环境验收

除构建和代码检查外，新增或调整页面、动态导入、依赖包、Vite 配置后，应执行：

```bash
npm run check:dev-cold-start
```

该命令先验证检查器自身，再使用全新临时缓存和独立本地服务检查所有页面的模块依赖，结束后关闭服务并清理临时缓存，不打开浏览器，也不清除日常开发缓存。详细范围和失败处理见 [冷启动检查说明](./docs/dev-cold-start-check.md)。

## 文档入口

- [PROJECT.md](./PROJECT.md) — 项目背景、技术栈、开发规范、Git 流程、完整进度
- [AGENTS.md](./AGENTS.md) / [CLAUDE.md](./CLAUDE.md) — AI 协作总规则（两份内容完全一致）
- [docs/architecture/](./docs/architecture/) — 组件、页面、状态和导入边界
- [docs/refactor/migration-guide.md](./docs/refactor/migration-guide.md) — 页面迁移流程与验收清单
- [design-system/tokens.md](./design-system/tokens.md) — Design Token 完整说明（开发前必读）
- [design-system/components/](./design-system/components/) — 各组件文档

## 技术栈

React 19 · Tailwind CSS v4 · Vite · 仅深色主题
