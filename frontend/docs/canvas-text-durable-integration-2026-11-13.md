# 画布文本持久任务接入记录

日期：2026-11-13。状态：本地实现及隔离验证完成，未发布，152 浏览器验收未运行。

## 实现

- CanvasTextSubmissions 封装专用提交、查询、取消和节点历史接口，兼容顶层及 detail 内错误码。画布文本入口不再调用同步 llm/chat。
- CanvasTextTask 管理串行查询、隐藏页暂停、退避、响应丢失查回、同请求有限重放及取消竞态。outcome_unknown 不自动重投。
- UseCanvasTextGeneration 在 POST 前保存 submission UUID、迁移/编辑操作 UUID 和最终请求体；读取节点 output_version；同步直接上游及目标历史。
- CanvasDurableText 将后端分页批次转换为本地结果历史，按 current_result_id 投影，未成为当前定稿的生成结果保留在历史。
- CanvasSaveSession 为历史写入提供与 PATCH 共用的串行队列。生成期间沿用暂停自动保存的策略；完成或取消后读取历史 revision，再保存。409 不用新版本盲目覆盖。
- 运行身份随普通画布文档持久化，复制、文件导出和撤销历史剥离该身份。刷新/关页只清理本地轮询，不取消服务器任务。
- 取消按钮复用 Button；菜单/快捷键删除、React Flow 删除、应用内导航、当前画布归档及登出先 await 专用取消。失败保留节点/页面。

## 产品与实现边界

- 保留当前同节点更新交互，不采用参考前端“已有正文则新建右侧结果节点”。
- 同一画布限制一个活跃文本任务；生成期间保留当前正文编辑保护。上游受理后可以编辑，其输入由服务端冻结。
- 文档中已持久保存 preparing 及原请求体即足以恢复；queued/running 不强制额外 PATCH，避免 Worker 投影期间覆盖正文。恢复先查询原 UUID。
- 409、queued/running 查询 404 或鉴权问题停止自动轮询并保留身份，不自动生成新 UUID。跨标签页未知活跃 UUID 的恢复仍依赖后端补充冲突响应身份；当前采取显示错误并允许专用取消/刷新排查。
- 服务器版本并发冲突采取保留草稿、停止覆盖策略，不实现任意跨标签页文档自动合并。已有保存失败请求保持原幂等身份。
- 已有本地历史选择/编辑保持当前接口；下次文本提交前同步为服务器 edit 批次。

## 验证

12 个相关测试文件共 112 项通过，包含实际 hook 替身测试、专用 API 路径、取消入口可交互、丢响应恢复、终态停止、分页历史、保存队列、序列化/复制/撤销等。没有调用真实模型。

```sh
node --test scripts/canvas-durable-text.test.mjs scripts/canvas-text-generation.test.mjs scripts/canvas-autosave.test.mjs scripts/canvas-document.test.mjs scripts/canvas-node-results.test.mjs scripts/canvas-node-actions.test.mjs scripts/canvas-list.test.mjs scripts/canvas-operation-guards.test.mjs scripts/canvas-node-result-controls.test.mjs scripts/canvas-history.test.mjs scripts/canvas-result-mutations.test.mjs scripts/canvas-file.test.mjs
npm run build
npm run check:architecture
git diff --check
```

构建、架构检查、差异检查通过。定向 ESLint 无错误，CanvasNodeShell 两条既有 effect 依赖警告。全库 lint：Home.jsx:287、822 两处错误及 12 条警告，未修改无关首页逻辑。

扩展检查发现 canvas-node-toolbar 两项、canvas-node 三项旧断言不符合当前工具栏、描边、缩放和平移实现；未以修改业务实现的方式迁就旧断言。

## 待线上验收

空正文、已有正文、直接文本上游；正常完成、主动取消、刷新、网络断开恢复；核对 Network 使用 text-submissions；确认实际服务端 document 投影与本地历史结构兼容。真实生成可能计费，发布及真实模型验收未执行。
