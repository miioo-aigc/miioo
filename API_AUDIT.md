# 前端 API 接入审查报告

> 生成日期：2026-05-18（更新：2026-05-20）
> 审查范围：`src/pages/` + `src/components/`  
> 目的：找出所有"数据写死"或"应调接口但未调"的位置，逐一修复

---

## P0 — 核心业务流程（直接影响功能可用性）

### 1. 新建项目 — `NewProjectModal.jsx` + `Home.jsx`

**问题：**
- `NewProjectModal.jsx` `handleConfirm` 只通过回调传数据，无 `POST /projects`
- `Home.jsx` `onConfirm` 只取 `name`，丢弃 `style / ratio / desc / coverFile`
- `handleProjectCreated` 用 `Date.now()` 生成本地 ID，无持久化

**缺失接口：** `POST /projects`  
**涉及字段：** `name`, `desc`, `ratio`, `style`, `customStyleDesc`, `coverFile`  
**状态：** ✅ `apiCreateProject(data)` 已封装至 `src/api/project.js`，Home.jsx 改为 import 引用

---

### 2. 登录 / 注册 — `LoginModal.jsx`

**问题：**
- 发送验证码：无 `POST /auth/send-code`
- 手机号登录：无 `POST /auth/login`
- 微信扫码：直接调 `onScanSuccess`，跳过真实 OAuth 流程
- 绑定手机：无 `POST /auth/bind-phone`

**缺失接口：** `POST /auth/send-code`、`POST /auth/login`、`POST /auth/bind-phone`  
**状态：** ✅ mock 函数已迁移至 `src/api/auth.js`，LoginModal 改为 import 引用

---

### 3. 主体页面（角色/场景/道具）— `SubjectPage.jsx`

**问题：**
- `INITIAL_CHARS`：6 条角色数据硬编码，无 `GET /subjects/chars`
- `MOCK_EPISODES`：12 条集数硬编码，无 `GET /episodes`
- `MOCK_PROPS = []`：道具为空数组占位
- 生成按钮：只创建本地占位对象，无 `POST /generate`
- 批量生成：`console.log('batch generate', params)` stub
- 增删改角色/场景/道具：只更新本地 state，无 `POST/PATCH/DELETE /subjects/*`
- 模型选项：`['Doubao-Seed-2.0-Pro', ...]` 硬编码，无 `GET /models`

**缺失接口：** `GET /subjects/*`、`POST/PATCH/DELETE /subjects/*`、`POST /generate`、`GET /models`  
**状态：** ✅ API stub 函数已迁移至 `src/api/subject.js`，SubjectPage 改为 import 引用

---

### 4. 分镜页面 — `StoryboardPage.jsx`

**问题：**
- 图片/视频上传：`URL.createObjectURL` 仅本地预览，无 `POST /upload`
- 生成图片/视频：只创建本地占位对象，无 `POST /generate`
- 镜头增删改排序：只更新本地 state，无 `PATCH/DELETE /shots/:id`
- 模型选项（`BatchImageModal` / `BatchVideoModal`）：硬编码
- `PARAM_OPTIONS`（镜头类型/运镜/角度/构图/时长）：硬编码

**缺失接口：** `POST /upload`、`POST /generate`、`PATCH/DELETE /shots/:id`  
**状态：** ✅ API stub 函数已迁移至 `src/api/storyboard.js`，StoryboardPage 改为 import 引用

---

### 5. 分镜页面 — 初始镜头数据写死 `StoryboardPage.jsx`

**问题：**
- `INITIAL_SHOTS`（第 4028 行）：3 条硬编码镜头对象，页面加载时直接 `useState(INITIAL_SHOTS)` 而非调接口
- `makeShot` 工厂函数（第 4014 行）用 `Date.now() + Math.random()` 生成 ID，新建镜头无法对应后端主键

**缺失接口：** `GET /shots?episodeId=...`  
**状态：** ⬜ 待修复

---

### 6. 主体页面 — 生成按钮未接通 `SubjectPage.jsx`

**问题：**
- `EditSubjectPanel` 生成按钮 `onClick`（第 1506–1510 行）只创建本地 placeholder，实际调用 `apiGenerateSubjectImage` 的代码被注释，逻辑未接通

**缺失接口：** `POST /generate`  
**状态：** ⬜ 待修复

---

## P1 — 用户数据（影响个人信息持久化）

### 7. 个人资料 — `ProfileModal.jsx`

**问题：**
- 保存编辑：无 `PATCH /users/me`
- 头像上传：空 stub，无 `POST /users/me/avatar`
- 注销账号：无 `DELETE /users/me`

**缺失接口：** `PATCH /users/me`、`POST /users/me/avatar`、`DELETE /users/me`  
**状态：** ✅ API stub 函数已迁移至 `src/api/user.js`，ProfileModal 改为 import 引用

---

### 8. 账户菜单 — `AccountMenu.jsx`

**问题：**
- 退出登录：无 `POST /auth/logout`
- 默认 props：`userName='user-name'`、`userId='miioo_user'` 硬编码

**缺失接口：** `POST /auth/logout`  
**状态：** ✅ apiLogout 已迁移至 `src/api/auth.js`，AccountMenu 改为 import 引用

---

### 9. 首页数据 — `Home.jsx`

**问题：**
- `projects` 初始化为 `[]`，无 `useEffect` 拉取项目列表
- 用户信息硬编码：`userName="Suzy"`、`userId="miioo_suzy"`、`phone="178 **** 0361"`、`wechat="suzylee"`
- `NOTIFICATION_ITEMS`：6 条通知硬编码

**缺失接口：** `GET /projects`、`GET /users/me`、`GET /notifications`  
**状态：** ✅ `apiGetProjects()`、`apiGetCurrentUser()`、`apiGetNotifications()` 已封装至 `src/api/project.js` / `src/api/user.js`，Home.jsx 改为 import 引用

---

### 10. 全局设定 — `GlobalSettings.jsx`

**问题：**
- 保存项目设置：无 `PATCH /projects/:id`
- 默认项目名硬编码

**缺失接口：** `PATCH /projects/:id`  
**状态：** ✅ apiUpdateProject 已迁移至 `src/api/project.js`，GlobalSettings 改为 import 引用

---

## P2 — 功能完整性

### 11. API 配置弹窗 — `ApiConfigModal.jsx`

**问题：**
- `testConnection`：`Math.random() > 0.4` 模拟成功/失败
- 保存配置：无 `POST /api-config`
- 硬编码：日期 "2026-01-01"、模型数量 23

**缺失接口：** `POST /api-config/test`、`POST /api-config`  
**状态：** ✅ `apiTestConnection()`、`apiSaveApiConfig(data)` 已封装至 `src/api/config.js`，ApiConfigModal.jsx 改为 import 引用

---

### 12. 镜头查看器 — `ShotViewerModal.jsx`

**问题：**
- 镜头"定稿"状态：无 `PATCH /shots/:id` 保存

**缺失接口：** `PATCH /shots/:id`  
**状态：** ✅ apiUpdateShotFinalized 已迁移至 `src/api/storyboard.js`，ShotViewerModal 改为 import 引用

---

### 13. SubjectPage — apiGetEpisodes / apiGetModels 未调用

**问题：**
- `apiGetEpisodes`、`apiGetModels` 已 import 但页面内无调用点
- 集数应在 `useEffect` 里调用 `apiGetEpisodes()` 初始化
- `EditSubjectPanel` 模型列表硬编码，应替换为 `apiGetModels()` 返回值

**缺失接口：** `GET /episodes`、`GET /models`  
**状态：** ⬜ 待修复

---

### 14. StoryboardPage — PARAM_OPTIONS 硬编码

**问题：**
- 第 2050 行：景别/运镜/拍摄角度/构图/时长五组选项全部写死

**缺失接口：** `GET /param-options`（需先与后端确认是否需要接口，或作为静态配置保留）  
**状态：** ⬜ 待修复

---

### 15. StoryboardPage — EPISODES 兜底假数据

**问题：**
- 第 4051 行：`const EPISODES = ['第一集','第二集',...]` 作为 props 默认值，父组件未传时回退到写死集数

**缺失接口：** `GET /episodes`  
**状态：** ⬜ 待修复

---

### 16. BatchVideoModal / BatchImageModal — 模型列表硬编码

**问题：**
- StoryboardPage 第 380、417 行：两个批量生成弹窗的模型选项数组仍是写死字符串

**缺失接口：** `GET /models`  
**状态：** ⬜ 待修复

---

## P3 — 静态展示数据（低优先级）

### 17. 资产页面 — `AssetsPage.jsx`

**硬编码数据：**
- `MOCK_DETAIL`：资产详情（名称/描述/prompt/模型/比例/分辨率/生成时间/图片 URL）
- `MOCK_SHOT_DETAIL`：镜头详情
- `MOCK_SHOT_VIDEO_DETAIL`：视频详情（含外部 w3schools.com 视频 URL）
- `MOCK_PROJECTS`：4 个项目对象
- `CREATIVE_DAYS`：创作日历数据
- `MOCK_PROJECT_ASSETS`：按分类的资产映射

**状态：** ⬜ 待修复（等资产页面进入开发阶段）

---

## 修复顺序

按 P0 → P1 → P2 → P3 逐条推进，每条修复前找 Suzy 确认接口字段和行为预期。

| 顺序 | 优先级 | 条目 | 文件 | 状态 |
|------|--------|------|------|------|
| 1 | P0 | 新建项目 | `NewProjectModal.jsx` + `Home.jsx` | ✅ 函数已封装 |
| 2 | P0 | 登录/注册 | `LoginModal.jsx` | ✅ 占位完成 |
| 3 | P0 | 主体页面 | `SubjectPage.jsx` | ✅ 占位完成 |
| 4 | P0 | 分镜页面 | `StoryboardPage.jsx` | ✅ 占位完成 |
| 5 | P0 | 初始镜头数据写死 | `StoryboardPage.jsx` | ⬜ 待修复 |
| 6 | P0 | 生成按钮未接通 | `SubjectPage.jsx` | ⬜ 待修复 |
| 7 | P1 | 个人资料 | `ProfileModal.jsx` | ✅ 占位完成 |
| 8 | P1 | 账户菜单 | `AccountMenu.jsx` | ✅ 占位完成 |
| 9 | P1 | 首页数据 | `Home.jsx` | ✅ 函数已封装 |
| 10 | P1 | 全局设定 | `GlobalSettings.jsx` | ✅ 占位完成 |
| 11 | P2 | API 配置弹窗 | `ApiConfigModal.jsx` | ✅ 函数已封装 |
| 12 | P2 | 镜头查看器 | `ShotViewerModal.jsx` | ✅ 占位完成 |
| 13 | P2 | apiGetEpisodes/apiGetModels 未调用 | `SubjectPage.jsx` | ⬜ 待修复 |
| 14 | P2 | PARAM_OPTIONS 硬编码 | `StoryboardPage.jsx` | ⬜ 待修复 |
| 15 | P2 | EPISODES 兜底假数据 | `StoryboardPage.jsx` | ⬜ 待修复 |
| 16 | P2 | 批量弹窗模型列表硬编码 | `StoryboardPage.jsx` | ⬜ 待修复 |
| 17 | P3 | 资产页面 | `AssetsPage.jsx` | ⬜ 待修复 |
