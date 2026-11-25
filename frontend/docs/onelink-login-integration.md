# onelinkai 网页登录接入

更新：2026-11-25。以当日后端交接文档为契约，替换旧的浏览器自建授权参数和第三方令牌回调方案。

## 当前流程

底部登录入口保持原设计。点击后 POST /api/auth/onelink/start，传 {intent:"login"}，携带 credentials:include。加密后端返回的 payload，固定网页身份 clientType=web、clientName/name=miioo；保留后端 state、callback、timestamp。按 authorizeUrl 跳转，对来源进行 HTTPS 白名单检查。

第三方凭证回到后端 /api/auth/callback/onelink，由后端处理。前端 /onelink/callback 只读 status，并立即清理 URL。continue 时调用 POST /api/auth/onelink/complete，依靠 HttpOnly 完成 Cookie；不再接收或存储第三方令牌，不使用 sessionStorage 校验后端 state。旧回调路径只展示重新登录提示。

首次 complete 返回 409 ONELINK_ACCOUNT_CHOICE_REQUIRED 时，显示创建新账号与关联已有账号。关联发码复用 /api/auth/send-code，提交 choice=link_existing、phone、smsCode；创建提交 choice=create。成功凭证交给本项目 setTokens，首页整页进入后重新读取登录态。phone_bound=false 显示可跳过的手机号绑定，使用现有 rebind 发码与绑定接口，绝不混用登录验证码。

保留完成探测 Promise 避免严格模式重复消费；显式账号选择允许下一次提交，按钮互斥防重复。错误支持字符串与结构化 detail，并显示可用的追踪编号。回调失败可重新发起登录。

本仓库 authFetch 与交接文档所述版本不完全相同；登录 API 采用与现有短信登录一致的 API 层 fetch，携带 Cookie 和已有 token，不自动重放一次性 complete 请求。普通已登录手机号操作继续使用现有 authFetch。

## 配置与部署

VITE_API_BASE_URL 使用当前环境后端基址，同源部署留空。未擅自改动全站 API 环境。VITE_ONELINK_AUTHORIZE_ORIGIN 默认测试授权来源 https://scenic.wanlian.cloud；VITE_DECRYPTION_KEY 必须原始 UTF-8 编码恰好 32 字节，不再截断或补零。密钥不写文档、不提交。

旧 AUTH_MODE、CLIENT_NAME、APP_NAME、START_PATH、EXCHANGE_PATH 不再使用。本地已移除这些过时配置。用户再次确认更正后的密钥后，已于 2026-11-25 更新本地 .env.local，并验证开发和生产模式读取一致。未记录密钥明文；已部署站点仍需重新构建部署，真实授权待手动验收。

后端回调地址、前端 origin、Cookie 必须同环境配置。后端若指定测试站回调，localhost 不能假定收到回跳；应使用后端配置的 HTTPS 站点联调。部署需为 /onelink/callback 提供 SPA 回退。

## 范围与验收

此次接入登录入口、授权、回调、首次账号选择和可选手机号绑定。API 支持 intent=bind 和 bound 响应；未新增个人中心绑定入口、管理端登记面板或桌面端流程。这些属于交接文档另一份前端代码的现状说明，不等于本仓库已有实现。

自动测试验证加密格式、后端字段保留、密钥长度、回调状态与旧凭证拒绝。需手动联调首次创建、关联已有账号、再次登录、手机号绑定、拒绝授权及过期重试。测试环境后端临时未验签模式不代表生产可上线；生产验真由后端落实。

## 11 月 25 日回调域名修复

生产 .env.production 的 VITE_API_BASE_URL 已改为空，start/complete 与页面同源，避免 www 与裸域的 host-only Cookie 错配。所有接口自带 /api 前缀，不能把基址设为 /api。部署时须避免外部环境变量重新覆盖为空的配置，并重新构建发布。

授权发起改为模块级共享请求；成功调用页面跳转后维持锁及按钮禁用，失败或取消则释放。从浏览器往返缓存返回时重载页面，重新开始授权。新增并发、跳转后重复调用及失败重试测试。此修改不替代多标签页场景的后端事务处理。
