# 页面开发规范

## 文件命名
- 页面文件：大驼峰，放 `src/pages/`（如 `ProjectList.jsx`）
- 通用组件：大驼峰，放 `src/components/`
- 布局框架：放 `src/layouts/`

## 开发流程
1. 确认需要哪些数据 → 先在 `src/api/` 建好对应函数
2. 接口未就绪时，函数内用 mock 数据占位
3. 接口就绪后，只改 `src/api/` 函数内部，页面代码不动

## 样式
写页面时同步参考 `design-system/CLAUDE.md`。
