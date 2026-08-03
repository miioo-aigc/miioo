# 参考素材统一收口修复记录

> 修复日期：2026-08-03
> 适用范围：主体页面、分镜页面
> 后端解绑说明：[`backend-reference-image-unbind-fix.md`](./backend-reference-image-unbind-fix.md)

## 1. 记录目的

本文件保存本次参考素材统一收口的背景、根因、业务边界、接口契约、实现细节、验收结论和后续排查顺序。再次出现参考图混入候选图、删除后恢复、旧请求覆盖新状态等问题时，优先对照本文件排查。

## 2. 业务边界

### 主体页面

主体编辑弹窗有两套完全独立的图片数据：

| 入口 | 业务含义 | 是否进入候选图列表 | 接口边界 |
| --- | --- | --- | --- |
| 参考图字段 | 发送给大模型作为创作素材 | 否 | `reference-images/upload`、`reference-images/bind` |
| 右侧候选图列表 | AI 创作、本地上传、资产库选择产生的主体图片 | 是 | 候选媒体/资产接口 |

参考图即使被后端同时返回到项目资产或主体关联资产列表，也不能因为“属于当前主体”就被映射为候选图。解除主体参考图绑定也不等于删除资产库原图。

### 分镜页面

分镜参考素材必须保持四种类型：

1. 参考主体
2. 普通参考图
3. 参考视频
4. 参考音频

四类素材都属于生成输入，不属于分镜候选结果。UI 可以放在同一个编辑区域，但状态、去重规则和提交字段不能混用。

## 3. 问题与根因

### 3.1 主体参考图删除后恢复

主体参考图绑定接口是覆盖语义。删除最后一张的合法状态是空绑定，必须提交 `asset_ids: []` 和 `primary_asset_id: null`。旧逻辑可能在空列表时跳过请求，或者上传、绑定、删除分别直接发请求，导致：

- 弹窗内看似删除，刷新后旧图恢复；
- 较早上传/绑定请求晚于删除完成，重新写回旧关系；
- 主体参考图字段和绑定关系不一致。

### 3.2 参考图混入候选图

主体详情、候选图接口和项目资产接口可能重复返回同一图片。页面若直接合并多个原始数组，再按主体 ID 或 URL 去重，会把参考图错误加入候选图列表。必须先按业务来源分流，再在各自列表内归一化和去重。

### 3.3 分镜素材字段不统一

分镜图片面板和视频面板分别维护参考素材，资产选择、本地上传、删除、历史表单恢复和当前镜头主体引用可能使用不同字段，容易造成重复、类型丢失、主体被当作普通图片以及旧表单覆盖新状态。

### 3.4 防抖不能解决请求乱序

450ms 防抖只能减少请求数量，不能保证已发出的 PATCH 按发起顺序完成。后发请求可能先完成，先发请求随后完成并覆盖最新状态。

## 4. 后端契约假设

本次前端实现假设后端已按 [`backend-reference-image-unbind-fix.md`](./backend-reference-image-unbind-fix.md) 支持主体参考图清空：

- `POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/upload`
- `POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind`
- `GET /api/projects/{project_id}/subjects/{subject_id}`

绑定接口为覆盖语义。保留图片时提交完整 `asset_ids` 和属于该列表的 `primary_asset_id`；删除最后一张时提交空 `asset_ids` 和 `primary_asset_id: null`，后端应返回成功并让主体详情返回空列表。

后端还必须保证：空列表不被“至少选择一个资产”拦截；清空绑定不删除资产库原图；绑定关系和主参考图字段同事务更新；成功响应后详情接口不会继续返回旧绑定。

分镜字段契约保持不变：

| 类型 | 后端字段 |
| --- | --- |
| 参考主体 | `character_ids` |
| 普通参考图 | `reference_images`、`reference_image_urls` |
| 参考视频 | `reference_video_url` |
| 参考音频 | `reference_audio_url` |

## 5. 前端实现细节

### 5.1 统一适配器

文件：[`src/utils/referenceMediaAdapter.js`](../src/utils/referenceMediaAdapter.js)

提供参考素材类型常量、URL/ID读取、类型内去重、主体参考图归一化和分镜四类素材分组能力。适配器兼容常见 snake_case/camelCase 字段，图片 URL统一归一化，去重优先使用主体 ID、资产 ID、归一化 URL。适配器不调用 API、不读取 React 状态，也不处理候选图业务。

### 5.2 串行最新快照队列

文件：[`src/utils/referenceMediaPersistence.js`](../src/utils/referenceMediaPersistence.js)

`createLatestPersistenceQueue(persist)` 用于同一主体或镜头的异步保存：正在执行的请求继续完成，等待队列只保留最新快照，随后按顺序提交；单次失败后仍继续处理后续快照，避免一次错误永久卡住删除或绑定。调用方负责记录错误和提示用户。

### 5.3 主体 `RefImageField`

文件：[`src/components/subject/RefImageField.jsx`](../src/components/subject/RefImageField.jsx)

- 上传、资产库绑定、删除统一进入主体参考图队列；
- 删除最后一张也提交绑定请求，不把空列表当成“无需保存”；
- 绑定请求发送完整资产 ID快照，并显式设置 `primary_asset_id`；
- 每次服务端操作完成后回读主体详情；
- 上传接口成功但详情接口短暂为空时，暂时使用上传响应回退，避免成功图片闪退；
- 临时 ID、Blob URL、绝对 URL和路径不会作为资产 ID提交；
- 只更新参考图状态，不写入候选图状态。

### 5.4 分镜图片/视频面板

文件：[`GenerateImagePanel.jsx`](../src/components/storyboard/GenerateImagePanel.jsx)、[`GenerateVideoPanel.jsx`](../src/components/storyboard/GenerateVideoPanel.jsx)。

图片面板分别归一化当前镜头参考主体和普通参考图，再作为生成输入；上传、资产库选择和删除后都重新归一化。视频面板分别维护和归一化 `refSubjects`、`refImages`、`refVideos`、`refAudios`。`ReferenceMediaEditor` 继续只负责槽位展示和回调转换，不直接调用 API。

### 5.5 分镜保存

文件：[`src/pages/StoryboardPage.jsx`](../src/pages/StoryboardPage.jsx)。

保留原有防抖，同时按镜头建立创作表单最新快照队列。图片和视频仍保存到同一镜头的 `creation_form`，但旧 PATCH完成后不会直接覆盖等待队列中的新快照。页面仍集中持有 API、轮询、缓存、Store 写回、Toast 和页面编排。

## 6. 必须保持的不变量

1. 主体参考图永远不进入主体候选图列表。
2. 候选图 AI创作、本地上传、资产库选择不调用主体 `reference-images` 接口。
3. 删除主体最后一张参考图必须发送空数组。
4. 解除主体绑定不删除资产库原图。
5. 分镜四类参考素材不能用无类型数组持久化。
6. 临时 UI 状态最终必须由服务端详情或创作表单读取结果校正。
7. 新字段适配进入统一适配器，不在页面回调中重复读取。
8. 新异步保存操作必须考虑请求乱序和旧响应覆盖。

## 7. 验收记录

静态验收已通过：

- `npm run lint`
- `npm run build`
- `npm run check:architecture`
- `git diff --check`

构建仅保留 Vite 大分块体积提示；架构检查仅有项目已有的大文件规模提醒，没有阻断级违规。

建议登录态回归：上传主体参考图后关闭、重开、刷新仍存在；删除多张中的一张后只保留剩余图；删除最后一张后请求体为空数组且重开/刷新为空；资产库原图仍存在；参考图不出现在候选图列表；分镜四类素材分别添加、删除、重开后仍在各自列表，重复资源不重复，生成请求字段不串。

## 8. 当前结论与后续排查

前端统一适配、严格分流和串行保存已经完成。本次没有改变候选图资产的创建、绑定、定稿和删除接口，也没有把分镜四类参考素材强行抽象为一个后端字段。真实上传、删除、刷新和后端事务一致性仍需在有效登录态和可写测试项目验证。

如果删除后仍恢复，按以下顺序排查：检查最终绑定请求体是否为最新完整快照；检查绑定响应；紧接着检查主体详情是否已返回新列表；检查是否存在更晚完成的旧请求；检查候选图初始化是否误合并参考图；最后检查缓存、表单快照和后端事务/缓存失效。
