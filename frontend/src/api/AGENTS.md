# API 开发规范

> 文档类型：接口函数、请求层和数据适配专项规则
> 最后更新：2026-07-15

## 1. API 层职责

- 所有网络请求封装在 `src/api/` 对应业务模块；页面和普通展示组件不得直接写 `fetch`、请求 URL、鉴权 header 或 token 刷新。
- 请求统一通过 `src/api/request.js` 的 `authFetch`、`authFetchForm` 或 `authFetchStream`，保持自动刷新、401 处理和登出事件行为一致。
- API 文件按业务域拆分，例如 `auth.js`、`project.js`、`subject.js`、`storyboard.js`、`assets.js`、`creation.js`、`config.js`。
- API 层不得引用页面或 React 业务组件；接口函数返回稳定、可说明的结果结构。

## 2. 调接口前

1. 先阅读 `src/api/openapi.json`，确认路径、方法、请求体、查询参数、鉴权要求和响应字段。
2. 检查现有 API 模块是否已有同类函数，优先复用或扩展，不重复创建近义接口。
3. 如果后端文档、现有调用方或字段含义存在多个合理解释，必须先向 Suzy 提供选择和推荐方案，等待决定后再改。
4. 页面只调用 API 函数，不拼接后端 URL；字段转换集中在 API 或明确命名的业务适配工具。

## 3. Mock 规则

```js
export async function apiXxx(params) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { /* 与真实响应结构一致的最小数据 */ };
  }

  return authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/xxx`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
```

- `VITE_USE_MOCK=true` 才允许返回 mock；mock 只能存在于 API 层或明确的接口适配工具。
- mock 字段必须尽量与真实响应一致，不能为了方便页面渲染创建另一套结构。
- 环境变量放在本地环境文件，不提交真实密钥。
- 业务组件只有在明确属于动作组件、且 API 边界已经记录时才可以直接调用业务 API；基础 UI 禁止调用。

## 4. 修改 API 后检查

1. 检查函数名称、默认导出/具名导出和所有调用方。
2. 检查参数字段及 snake_case/camelCase 转换。
3. 检查请求体能否重复使用，尤其是 `FormData` 和流式请求。
4. 检查错误、取消、401 刷新和网络失败行为。
5. 检查 mock 与真实响应结构的一致性。
6. 执行定向 ESLint、`npm run build` 和关键调用页面验证。

任何接口迁移都必须避免通过编译但在页面运行时出现 undefined 回调、空响应解构或结果字段缺失。
