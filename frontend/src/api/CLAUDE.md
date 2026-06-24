# API 开发规范

## 基本规则
- 所有数据交互封装在 `src/api/` 对应模块，页面/组件禁止直接写 fetch
- 需要登录态的接口统一用 `authFetch` / `authFetchForm`（从 `request.js` 引入），不得自行拼装 header

## Mock 开关模板
```js
export async function apiXxx(params) {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return { ... }
  }
  return authFetch(`${import.meta.env.VITE_API_BASE_URL}/api/xxx`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
```
- `VITE_USE_MOCK=true` 返回假数据，`false` 调真实接口
- 环境变量在 `.env.local`，不得提交 Git

## 日常开发 — 调接口前
1. 直接读 `api文档.json` 确认接口路径、字段、方法
2. 信息不足或有歧义时，找 Suzy 确认

## 后端更新 API 文档时
当 Suzy 说后端更新了 `api文档.json`，通读 `src/api/*.js` 和 `api文档.json`，做全量对比（路径、方法、请求体字段、前端缺失、后端无接口），更新 `API差异报告.html` 全部六个章节。
