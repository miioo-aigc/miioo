# Seedance 素材认证功能后端需求

> 文档用途：说明主体页面角色的 Seedance 素材认证功能需要后端提供的业务能力、数据关系和接口契约。
>
> 需求日期：2026-08-21

## 一、功能目标

主体页面的角色 Tab 支持用户对角色当前定稿图进行 Seedance 素材认证。

用户的实际操作是：

```text
资产库 - 项目资产 - 当前项目 - 角色资产
  -> 读取当前角色定稿图
  -> 选择一个可用的 Seedance 素材组
  -> 将该定稿图归档到该素材组
  -> 发起 Seedance 素材认证
  -> 将认证状态反馈到角色卡片
```

角色卡片需要准确展示以下状态：

| 前端状态 | 含义 |
| --- | --- |
| 去认证 | 当前角色定稿图没有有效的 Seedance 素材认证 |
| 审核中 | 当前角色定稿图已经提交 Seedance 素材认证，正在审核 |
| 已认证 | 当前角色定稿图已经通过 Seedance 素材认证 |
| 认证失败 | 当前角色定稿图的 Seedance 素材认证未通过，可重新提交 |

## 二、必须解决的核心问题

后端需要区分以下两个概念：

1. **角色当前使用的定稿图**：角色当前的 `primary_asset_id`。
2. **Seedance 素材认证记录**：某个角色的某张定稿图，是否被归档到 Seedance 素材组并处于什么认证状态。

角色的 `primary_asset_id` 只能说明当前使用哪张图，不能单独说明这张图是否完成了 Seedance 素材认证。

特别需要注意：`primary_asset_id` 可能来自普通项目资产、虚拟人像库认证素材或 AIGC 素材。前端不按素材来源、素材组类型或认证类别区分可用性；只要当前定稿图存在通过的 Seedance 认证记录，即应视为可用并显示「已认证」。

因此，认证记录必须保存发起认证时使用的定稿图 ID；认证来源和素材组类型可以保留用于追溯，但不能作为前端判断认证是否可用的筛选条件。

## 三、数据模型要求

请为角色与 Seedance 素材认证建立独立的绑定/认证关系，不能直接把认证状态写入角色的普通资产字段，也不能仅通过 `primary_asset_id` 推断认证状态。

每条 Seedance 素材认证记录至少需要表达：

```text
角色 ID
+ 发起认证时的定稿图 ID
+ 目标 Seedance 素材组 ID
+ 当前认证状态
```

推荐字段：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `subject_id` | 是 | 角色 ID |
| `subject_type` | 建议 | 主体类型，角色使用 `character` |
| `project_id` | 是 | 项目 ID，用于项目隔离 |
| `primary_asset_id` | 是 | 发起本次认证时使用的角色定稿图 ID，必须持久化，不应动态改成当前最新定稿图 ID |
| `group_id` | 是 | 目标 Seedance 素材组 ID |
| `source` 或 `certification_type` | 建议 | 认证来源或类别，仅用于追溯，不作为前端可用性筛选条件 |
| `status` | 是 | `pending`、`approved` 或 `failed` |
| `asset_id` | 建议 | 归档到目标素材组后的素材资产 ID |
| `failure_reason` | 可选 | 认证失败原因 |
| `created_at` | 建议 | 认证记录创建时间 |
| `updated_at` | 建议 | 认证状态更新时间 |

前端不要求固定的 `source` 或 `certification_type` 枚举值。认证记录的可用性判断只依赖 `primary_asset_id` 是否匹配和 `status` 是否通过。

## 四、认证状态查询接口

请提供项目维度的角色认证状态查询能力：

```http
GET /api/live-materials/projects/{project_id}/subject-bindings
```

接口应返回当前项目下可供 Seedance 使用的认证绑定记录。推荐响应结构：

```json
{
  "list": [
    {
      "project_id": "项目 ID",
      "subject_id": "角色 ID",
      "subject_type": "character",
      "primary_asset_id": "提交认证时的定稿图 ID",
      "group_id": "Seedance 素材组 ID",
      "source": "认证来源，仅作追溯",
      "status": "pending",
      "asset_id": "归档后的素材资产 ID",
      "failure_reason": null,
      "created_at": "2026-08-21T10:00:00Z",
      "updated_at": "2026-08-21T10:01:00Z"
    }
  ]
}
```

响应可以使用数组或 `items` 等现有结构，但需要稳定返回以下核心字段：

```text
subject_id
primary_asset_id
status
```

查询没有认证记录时，应返回 `200` 和空列表，不应将“没有绑定记录”当成接口不存在或异常。

## 五、认证提交接口

用户选择 Seedance 素材组后，前端提交当前角色进行认证：

```http
POST /api/live-materials/groups/{group_id}/subject-final-assets
Content-Type: application/json
```

请求体：

```json
{
  "project_id": "项目 ID",
  "subject_id": "角色 ID"
}
```

后端必须执行以下流程：

1. 校验项目和角色的归属关系。
2. 读取角色提交时的当前定稿图。
3. 如果角色没有定稿图，拒绝提交并返回明确业务错误。
4. 将这张定稿图归档或关联到指定的 Seedance 素材组。
5. 创建一条认证绑定记录。
6. 保存提交当时的 `primary_asset_id`。
7. 发起 Seedance 素材认证，并将初始状态设置为 `pending`。
8. 返回新建认证记录及其初始状态。

推荐成功响应：

```json
{
  "project_id": "项目 ID",
  "subject_id": "角色 ID",
  "primary_asset_id": "提交时的定稿图 ID",
  "group_id": "Seedance 素材组 ID",
  "source": "认证来源，仅作追溯",
  "status": "pending",
  "asset_id": "归档后的素材资产 ID"
}
```

建议的业务错误：

```http
400 Bad Request
```

```json
{
  "detail": "当前角色没有定稿图，无法进行 Seedance 素材认证"
}
```

## 六、认证状态判断规则

前端会把角色列表中的当前 `primary_asset_id` 与认证记录中的 `primary_asset_id` 进行比较。

```text
角色当前 primary_asset_id 为空
  -> 去认证 / 不允许提交

不存在当前定稿图对应的认证记录
  -> 去认证

认证记录 primary_asset_id 为空
  -> 去认证

认证记录 primary_asset_id != 角色当前 primary_asset_id
  -> 去认证
  -> 旧认证对应旧定稿图，当前角色素材尚未认证

认证记录 primary_asset_id == 角色当前 primary_asset_id
且 status = pending
  -> 审核中

认证记录 primary_asset_id == 角色当前 primary_asset_id
且 status = approved
  -> 已认证

认证记录 primary_asset_id == 角色当前 primary_asset_id
且 status = failed
  -> 认证失败
```

等价伪代码：

```js
const currentAssetId = subject.primary_asset_id;
const certifiedAssetId = binding.primary_asset_id;
if (!currentAssetId || !certifiedAssetId) {
  return 'unverified';
}

if (currentAssetId !== certifiedAssetId) {
  return 'unverified';
}

return binding.status;
```

后端不应在角色更换定稿图后，直接修改历史认证记录中的 `primary_asset_id`。保留原值，前端才能识别旧认证已不适用于新定稿图。

## 七、状态更新要求

Seedance 素材认证状态由后端认证流程或上游回调更新，前端不自行推断审核结果。

状态流转建议为：

```text
pending -> approved
pending -> failed
```

状态要求：

- `pending` 表示已提交认证但尚未完成审核；
- `approved` 表示认证通过；
- `failed` 表示认证失败；
- `failed` 状态需要允许用户重新选择素材组并再次提交；
- 认证状态更新后，查询接口必须返回最新状态；
- 失败时建议保留 `failure_reason`，便于后续产品展示具体原因。

## 八、幂等与数据一致性

认证提交接口需要支持幂等，避免重复点击、网络重试或任务回调造成重复认证记录或重复素材资产。

至少需要保证：

1. 同一项目、同一角色、同一张定稿图重复提交时，不重复创建相同业务记录。
2. 重复提交应返回已有记录或当前有效记录。
3. 认证状态更新不会生成新的角色定稿图。
4. 认证失败后重新提交时，可以创建新的认证尝试，或明确更新原记录，但接口返回结构必须保持稳定。
5. 角色更换定稿图后，历史认证记录仍保留原来的 `primary_asset_id`。
6. 删除角色或项目时，认证绑定关系按业务规则清理，但不应误删仍被其他业务引用的源资产。

## 九、权限与项目隔离

查询和提交接口必须遵守现有用户、项目和素材组权限：

- 只能查询当前用户有权限访问的项目；
- 只能查询指定项目下的角色认证记录；
- 只能向当前用户有权限使用的 Seedance 素材组提交；
- 角色必须属于请求中的项目；
- 无效访问令牌返回 `401`；
- 无权访问项目、角色或素材组返回 `403`；
- 资源不存在按现有接口规范返回 `404`；
- 没有认证记录不是异常，应返回空列表。

## 十、后端验收标准

### 10.1 基础认证

角色有定稿图但没有对应的 Seedance 素材认证记录：

```text
查询结果：没有 `primary_asset_id` 与当前定稿图匹配的认证记录
```

期望：前端显示「去认证」。

### 10.2 审核中

```text
角色当前 primary_asset_id = asset-a
认证记录 primary_asset_id = asset-a
认证记录 status = pending
```

期望：前端显示「审核中」。

### 10.3 已认证

```text
角色当前 primary_asset_id = asset-a
认证记录 primary_asset_id = asset-a
认证记录 status = approved
```

期望：前端显示「已认证」。

### 10.4 认证失败

```text
角色当前 primary_asset_id = asset-a
认证记录 primary_asset_id = asset-a
认证记录 status = failed
```

期望：前端显示「认证失败」，并允许重新提交认证。

### 10.5 更换定稿图

```text
角色当前 primary_asset_id = asset-b
历史认证记录 primary_asset_id = asset-a
历史认证记录 status = approved
```

期望：前端显示「去认证」，不能把 `asset-a` 的认证结果显示到 `asset-b` 上。

### 10.6 不同素材来源

```text
角色当前 primary_asset_id = asset-a
asset-a 的认证记录来自虚拟人像、真人或 AIGC 素材组之一
认证记录 primary_asset_id = asset-a
认证记录 status = approved
```

期望：前端显示「已认证」。素材来源、认证类别和素材组类型均不得影响该判断。

### 10.7 没有定稿图

```text
角色 primary_asset_id = null
```

期望：提交接口拒绝认证，并返回明确的业务错误。

## 十一、交付时请提供

后端完成后，请同步以下信息给前端：

1. 最终接口路径和请求方法；
2. 查询接口完整响应示例；
3. 认证提交接口完整请求和响应示例；
4. `source` 或 `certification_type` 的可选枚举值及其追溯含义；
5. `status` 的完整枚举及状态流转；
6. 无定稿图、无权限、重复提交、认证失败时的状态码和响应体；
7. 认证状态更新的时效和查询方式。

## 十二、结论

本功能要解决的不是简单地给角色增加一个认证字段，而是建立以下可追溯关系：

```text
角色
  -> 当前定稿图
  -> Seedance 素材组
  -> Seedance 素材认证记录
  -> 当前审核状态
```

只要认证记录保存的 `primary_asset_id` 与角色当前定稿图一致，且其最新认证状态为通过，就应把认证结果展示到角色卡片上。素材来源、认证类别和素材组类型不参与该判断。
