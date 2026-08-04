# 主体参考图与资产归属关系排查

## 1. 问题概述

当前发现三个关联问题：

1. 主体自身上传参考图后，刷新页面，参考图混入了该主体的右侧候选图列表（参考图上传后被当成了该主体的候选/自有资产）。
2. 主体 A 有一张定稿图。主体 B 从资产库选择 A 的定稿图作为参考图后，在资产库勾选“仅显示定稿图”，A 的定稿图消失。
3. 删除主体 B 后，主体 A 的定稿图也被删除。

初步判断，这三个问题来自同一个数据关系错误：

> 主体对资产的“参考图引用”，被后端当成了“该资产属于这个主体”（写入/修改了资产的 `subject_id`），或者修改了资产自身的定稿状态（`is_primary`）。

换句话说，后端把「参考图引用关系」和「资产所有权 / 候选归属」混为一谈，没有用独立的绑定关系来表示引用。这一条数据边界错误会同时导致上面三个现象。

请后端重点核查上传参考图、绑定参考图、查询主体资产、查询资产库和删除主体这几条链路，确认是否存在资产引用关系与资产所有权混用的问题。

## 2. 复现步骤

### 2.0 参考图混入候选图列表

1. 创建主体 A（或任意主体）。
2. 打开「编辑主体」弹窗，在左侧「参考图」字段上传一张本地图片，或从资产库选择一张图片作为参考图。
3. 确认上传/绑定成功后，刷新页面（或关闭并重新打开编辑主体弹窗）。
4. 观察右侧候选图列表：期望只显示主体自己的候选/生成图片，不应出现刚上传的那张参考图。

前端已确认：右侧候选图列表来自
`GET /api/assets?project_id=...&scope=project&asset_type=image&category=character`
并按 `subject_id === 当前主体` 过滤（见 `apiGetSubjectAssets`）。参考图之所以会出现在候选列表，是因为参考图上传接口把该资产存成了 `subject_id = 当前主体` 的普通项目资产，与候选图无法区分。

请后端确认：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/upload
```

上传的参考图资产是否写入了 `subject_id = {subject_id}`，以及它的 `category`、`source`/`source_type` 是什么。期望参考图不占用「主体候选/自有资产」的身份，即：

- 参考图与候选图必须能被区分（例如参考图不写 `subject_id`，改用独立绑定表；或写入明确的 `source_type = reference` / `is_reference = true` 标记）。
- `GET /api/assets?scope=project&category=character` 在按主体聚合候选图时，不能把参考图资产算作该主体的候选/自有资产。

### 2.1 定稿图被筛掉

1. 创建主体 A。
2. 为主体 A 生成或上传图片，并将其中一张设置为定稿图。
3. 确认资产库项目资产接口返回该图片：

```json
{
  "id": "asset-a",
  "subject_id": "subject-a",
  "is_primary": true
}
```

4. 创建主体 B。
5. 在主体 B 的图片创作区域，从资产库选择 `asset-a` 作为参考图。
6. 打开资产库选择弹窗，选择项目资产中的角色分类，勾选“仅显示定稿图”。
7. 观察 A 的定稿图是否仍然显示。

### 2.2 删除主体 B 连带删除 A

继续使用上述数据：

1. 确认主体 B 的参考图中包含 `asset-a`。
2. 删除主体 B。
3. 重新查询项目资产和主体 A 的图片。
4. 观察 `asset-a` 是否被移入回收站、从资产列表消失，或主体 A 的定稿图关系被清除。

## 3. 前端已确认的行为

### 3.0 参考图上传的请求

前端调用：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/upload
```

前端上传参考图时只发送图片文件，不会传 `category`、`subject_id` 或 `is_primary`，也不会调用候选图相关接口。上传成功后，前端仅把返回的参考图写入左侧「参考图」字段，不会主动把它加入右侧候选图列表。

因此，如果刷新后参考图出现在候选图列表，说明后端在保存参考图时把它作为 `subject_id = {subject_id}` 的项目资产落库，与候选图共用了同一套归属字段。

### 3.1 绑定参考图的请求

前端调用：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind
```

请求体：

```json
{
  "asset_ids": ["asset-a"],
  "primary_asset_id": "asset-a"
}
```

这里的 `subject_id` 是主体 B，`asset-a` 原本属于主体 A。

前端对参考图绑定没有调用以下资产修改接口：

```http
PATCH /api/assets/{asset_id}
```

也没有主动调用 `is_primary: false` 或修改 `subject_id` 的逻辑。因此，如果绑定后 A 的 `is_primary` 或 `subject_id` 发生变化，需要重点检查后端 `reference-images/bind` 的实现。

### 3.2 资产库定稿筛选

资产选择弹窗的筛选条件是：

```js
if (activeTab === 'project' && finalOnly && !asset.is_primary) return false;
```

也就是说，A 的图片消失通常意味着资产接口重新返回时：

- `is_primary` 已被改为 `false`；或
- 资产被错误删除；或
- 资产查询结果不再包含该资产。

前端筛选本身不会因为资产被主体 B 引用而主动隐藏主体 A 的定稿图。

### 3.3 删除主体 B 的业务语义

主体 B 被删除时：

- 应删除主体 B 自己的候选图和主体记录；
- 应解除 B 对参考图的引用关系；
- 不应删除参考图源资产 `asset-a`；
- 不应修改 `asset-a.subject_id`；
- 不应修改 `asset-a.is_primary`。

## 4. 期望的数据关系

绑定前：

```text
资产 A
  subject_id = 主体 A
  is_primary = true

主体 B
  reference_images = []
```

绑定后：

```text
资产 A
  subject_id = 主体 A
  is_primary = true

主体 B
  reference_images = [资产 A]
```

删除 B 后：

```text
资产 A
  subject_id = 主体 A
  is_primary = true

主体 B
  已删除
```

参考图关系应当是独立的多对多或关联关系，不能通过把 `asset-a.subject_id` 改成主体 B 来表示引用。

## 5. 请后端重点确认的问题

### 5.1 `primary_asset_id` 的字段语义

请确认 `ReferenceAssetBindRequest.primary_asset_id` 的真实含义：

```json
{
  "asset_ids": ["asset-a"],
  "primary_asset_id": "asset-a"
}
```

需要明确：

1. 它是否仅表示“主体 B 的主参考图”。
2. 它是否会修改资产 A 的 `is_primary`。
3. 它是否会修改资产 A 的 `subject_id`。
4. 它是否会将资产 A 从主体 A 转移到主体 B。
5. 它是否会创建独立的主体参考图绑定记录。

期望答案是：

```text
primary_asset_id 只表示主体 B 的主参考图，不修改源资产 A 的 is_primary、subject_id、category 和所有权。
```

### 5.2 绑定接口是否修改源资产字段

请在绑定前后分别查询以下接口，比较 `asset-a` 的完整字段：

```http
GET /api/assets/{asset_id}
```

重点比较：

```text
subject_id
is_primary
category
project_id
is_deleted
```

建议使用以下数据做对照：

```text
绑定前：subject_id = subject-a，is_primary = true
绑定后：subject_id = subject-a，is_primary = true
```

如果绑定后变成以下任一种状态，即可确认绑定接口修改了源资产语义：

```text
subject_id = subject-b
is_primary = false
asset 不再返回
asset 被移入回收站
```

### 5.3 资产列表查询是否错误改变了结果

请核查以下接口在绑定前后返回结果是否一致：

```http
GET /api/assets?project_id={project_id}&scope=project&asset_type=image&category=character
```

确认：

1. `asset-a` 是否仍在结果中。
2. `asset-a.subject_id` 是否仍为主体 A。
3. `asset-a.is_primary` 是否仍为 `true`。
4. 查询是否使用了“当前主体唯一归属”的条件，导致被其他主体引用后被错误排除。
5. 查询是否把参考图绑定关系当成了项目资产的主体归属关系。

资产库“仅显示定稿图”的正确判断应基于资产自身的 `is_primary`，不能基于“是否被其他主体引用”判断。

### 5.4 删除主体是否级联删除参考资产

请核查删除主体 B 时实际执行的数据库删除和关联清理逻辑：

```http
DELETE /api/projects/{project_id}/subjects/{subject_id}
```

需要确认：

1. 删除主体 B 是否会按 `subject_id = subject-b` 删除资产。
2. 绑定参考图后，`asset-a.subject_id` 是否被错误改成了 `subject-b`。
3. 删除主体 B 是否会按照参考图绑定表删除资产本体，而不是只删除绑定关系。
4. 删除主体 B 是否会调用资产批量删除或移入回收站逻辑。
5. 删除主体 B 后是否会清理主体 A 的定稿图关系。

期望规则是：

```text
删除主体 B = 删除 B 的主体记录 + 删除 B 自己的候选资产 + 解除 B 的参考图绑定
删除主体 B != 删除 B 引用的资产本体
```

### 5.5 参考图绑定关系的表结构和删除规则

请提供或确认参考图绑定关系的存储方式，例如：

```text
subject_reference_assets
  subject_id
  asset_id
  is_primary
```

如果存在独立绑定表，删除 B 时应执行：

```sql
DELETE FROM subject_reference_assets
WHERE subject_id = :subject_b;
```

而不是：

```sql
DELETE FROM assets
WHERE id IN (...B 的参考图...);
```

如果没有独立绑定表，而是把参考图直接写入主体或资产字段，请说明字段设计，以及如何保证同一资产被多个主体引用时不会互相覆盖或级联删除。

## 6. 推荐后端修复规则

### 6.0 上传参考图

接口：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/upload
```

后端应当：

1. 保存参考图文件，并建立「主体 → 参考图」的引用绑定关系。
2. 不把参考图作为该主体的候选图 / 自有资产落库。
3. 如果参考图仍以资产形式存储，必须与候选图明确区分，二选一：
   - 不写入 `subject_id`，改用独立参考图绑定表关联主体；或
   - 写入明确的参考标记（如 `source_type = reference` / `is_reference = true` / `category = reference`），且主体候选图查询必须排除该标记。
4. 主体候选图 / 项目资产查询（按 `subject_id` 聚合角色/场景/道具）不能返回参考图资产。

期望结果：主体上传参考图后刷新，参考图只出现在左侧「参考图」字段，不出现在右侧候选图列表。

### 6.1 绑定参考图

接口：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind
```

请求：

```json
{
  "asset_ids": ["asset-a", "asset-b"],
  "primary_asset_id": "asset-a"
}
```

后端应当：

1. 校验资产存在、属于当前用户且为图片资产。
2. 创建或更新主体 B 与资产的参考图绑定关系。
3. 仅更新主体 B 的参考图关系及其主参考图。
4. 不修改源资产的 `subject_id`。
5. 不修改源资产的 `is_primary`。
6. 不修改源资产的 `category`、`project_id`、名称和所有权。
7. 不删除任何源资产。

### 6.2 删除主体

删除主体 B 时应当：

1. 删除主体 B 的参考图绑定关系。
2. 删除或处理主体 B 自己产生的候选资产。
3. 保留被 B 引用、但归属于其他主体或资产库的源资产。
4. 保留源资产原有的 `subject_id` 和 `is_primary`。
5. 不因为 B 曾经引用过 A 的定稿图，就删除 A 的资产。

### 6.3 返回数据

绑定接口成功后，主体详情应返回完整参考图列表，并明确区分：

```json
{
  "asset_id": "asset-a",
  "file_url": "/uploads/example.png",
  "is_primary": false
}
```

这里的 `is_primary` 如果存在，需要明确它表示“主体 B 的主参考图”，不能让前端误以为它是资产 A 的项目定稿状态。建议接口文档中改名或补充字段说明，例如：

```text
is_primary：是否为当前主体的主参考图，不代表资产库资产自身的 is_primary。
```

## 7. 建议后端提供的排查结果

请针对一次完整复现，提供以下信息：

1. 上传参考图请求体和响应体，以及落库后该资产的 `subject_id`、`category`、`source`/`source_type`、`is_primary` 字段。
2. 上传参考图后 `GET /api/assets?scope=project&category=character` 是否返回该资产、其 `subject_id` 是否等于当前主体。
3. 绑定参考图请求体和响应体。
4. 绑定前后 `GET /api/assets/{asset_id}` 的关键字段。
5. 绑定前后项目资产列表中 `asset-a` 的记录。
6. 删除主体 B 时实际删除或更新的资产 ID 列表。
7. 删除主体 B 前后 `asset-a` 的资产状态。
8. 删除主体 B 前后主体 A 的详情和定稿图状态。
9. 参考图绑定关系的数据库表或字段设计。
10. 删除主体接口是否存在级联删除逻辑。

## 8. 验收标准

### 用例零：上传参考图不混入候选图

1. 主体 A 上传一张参考图。
2. 刷新页面并重新打开主体 A 的编辑弹窗。
3. 参考图出现在左侧「参考图」字段。
4. 参考图不出现在右侧候选图列表。
5. `GET /api/assets?scope=project&category=character` 按 `subject_id = subject-a` 聚合时不返回该参考图资产（或该资产带有明确的参考标记且被候选图查询排除）。

### 用例一：引用定稿图

1. A 有 `asset-a`，且 `is_primary = true`。
2. B 绑定 `asset-a` 为参考图。
3. `GET /api/assets/{asset-a}` 仍返回：

```json
{
  "subject_id": "subject-a",
  "is_primary": true
}
```

4. 资产库勾选“仅显示定稿图”时，A 的 `asset-a` 仍显示。

### 用例二：删除引用主体

1. B 已引用 A 的 `asset-a`。
2. 删除 B。
3. A 仍存在。
4. `asset-a` 仍存在，且未被移入回收站。
5. `asset-a.subject_id` 仍为主体 A。
6. `asset-a.is_primary` 仍为 `true`。
7. B 的参考图绑定关系已清除。
8. 主体 A 重新打开、资产库重新打开或刷新页面后，A 的定稿图仍显示。

## 9. 结论

这三个问题表面上分别表现为“参考图混入候选图”“定稿筛选丢图”和“删除主体连带删图”，但都来自同一条数据边界被打破：

```text
主体参考图引用关系
与
资产自身的主体归属（subject_id）、候选身份、定稿状态（is_primary）、删除生命周期
必须完全分离。
```

推荐的根本解法是引入独立的参考图绑定关系（例如 `subject_reference_assets` 表），让「引用」只是一条关联记录，绝不修改源资产的 `subject_id`、`is_primary`、`category` 和所有权，删除主体时也只删绑定记录、不删源资产。

请后端先确认实际数据变化（上传、绑定、查询、删除四条链路），再决定是修正现有接口，还是补充独立的参考图绑定表及解绑逻辑。前端已在删除主体前尽力解绑并排除参考图资产做临时兜底，但只要后端仍把引用写成源资产的归属/定稿字段，前端就无法可靠避免这三个问题，最终修复必须落在后端。
