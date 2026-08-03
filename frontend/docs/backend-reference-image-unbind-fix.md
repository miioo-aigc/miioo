# 主体参考图删除失败修复需求

## 1. 问题概述

主体编辑弹窗中删除参考图时，前端调用：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind
```

删除最后一张参考图时，前端提交：

```json
{
  "asset_ids": [],
  "primary_asset_id": null
}
```

后端返回：

```http
400 Bad Request
```

```json
{
  "detail": "请至少选择一个资产"
}
```

导致结果：

- 弹窗内图片暂时从前端消失；
- 关闭弹窗后重新打开，参考图仍然出现；
- 刷新浏览器后，已删除的参考图恢复；
- 用户无法真正清空主体的参考图绑定关系。

## 2. 根因

当前 `reference-images/bind` 接口对 `asset_ids` 增加了“至少一个资产”的校验，但该接口同时承担了“覆盖主体参考图绑定列表”的职责。

当用户删除最后一张参考图时，合法业务状态应当是：

```text
主体参考图绑定列表 = 空列表
主参考图 = 空
```

当前接口不允许空列表，因此前端无法通过现有接口表达“清空全部参考图”。这与接口文档中 `asset_ids` 允许传空数组的约定不一致。

## 3. 业务边界

参考图与候选图是两套完全独立的数据：

- 参考图：仅作为大模型创作输入，不进入主体候选图列表；
- 候选图：AI 创作、本地上传、资产库选择产生的结果图片，进入资产库并关联主体；
- 删除参考图：只解除主体与参考图资产的绑定，不删除资产库中的原始资产；
- 删除最后一张参考图：只清空主体参考图绑定，不删除资产本身。

## 4. 推荐修复方案

### 4.1 放开现有绑定接口

继续使用：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/reference-images/bind
```

接口应支持“覆盖绑定列表”语义：

```json
{
  "asset_ids": ["asset-id-1", "asset-id-2"],
  "primary_asset_id": "asset-id-1"
}
```

清空全部参考图时支持：

```json
{
  "asset_ids": [],
  "primary_asset_id": null
}
```

### 4.2 后端处理规则

#### 非空列表

1. 校验所有 `asset_ids` 存在且当前用户有权访问；
2. 校验资产类型为图片；
3. 校验 `primary_asset_id` 属于 `asset_ids`；
4. 删除当前主体已有但不在本次 `asset_ids` 中的参考图绑定；
5. 保留或创建本次列表中的绑定关系；
6. 将 `primary_asset_id` 设置为主参考图；
7. 不删除资产库原始资产。

#### 空列表

收到以下请求时：

```json
{
  "asset_ids": [],
  "primary_asset_id": null
}
```

必须：

1. 删除当前主体的全部参考图绑定关系；
2. 清空主体记录中的主参考图字段（如果存在）；
3. 不删除资产库中的图片资产；
4. 返回成功响应；
5. 后续主体详情接口返回空的 `reference_images`。

## 5. 请求与响应示例

### 5.1 删除其中一张，保留其他参考图

请求：

```http
POST /api/projects/project-1/subjects/subject-1/reference-images/bind
Content-Type: application/json
```

```json
{
  "asset_ids": ["asset-remaining"],
  "primary_asset_id": "asset-remaining"
}
```

响应建议保持现有结构，返回绑定后的完整列表：

```json
[
  {
    "asset_id": "asset-remaining",
    "file_url": "/uploads/images/reference.png",
    "thumbnail_url": "/uploads/images/reference-thumb.png",
    "preview_url": "/uploads/images/reference.png",
    "name": "reference.png",
    "is_primary": true
  }
]
```

### 5.2 删除最后一张，清空全部参考图

请求：

```http
POST /api/projects/project-1/subjects/subject-1/reference-images/bind
Content-Type: application/json
```

```json
{
  "asset_ids": [],
  "primary_asset_id": null
}
```

响应：

```json
[]
```

状态码建议为 `200`。

## 6. 数据一致性要求

绑定关系更新和主参考图更新必须在同一个事务中完成，避免出现以下不一致状态：

- `reference_images` 已清空，但主体仍保留旧的主参考图 ID；
- 主参考图已变更，但旧参考图绑定仍然存在；
- 接口返回成功，但详情接口仍返回删除前的列表；
- 绑定关系删除后误删资产库原始图片。

接口成功返回前，数据库写入必须完成。若后端使用异步写入，需要保证详情接口不会在成功响应后继续返回旧绑定关系。

## 7. 接口校验建议

以下情况应继续返回明确的 `4xx` 错误：

| 场景 | 建议状态码 | 错误信息 |
|---|---:|---|
| `asset_ids` 不是数组 | 422 | `asset_ids 必须是数组` |
| `primary_asset_id` 不在 `asset_ids` 中 | 422 | `primary_asset_id 必须属于 asset_ids` |
| 资产不存在 | 404 或 422 | `参考图资产不存在` |
| 资产不属于当前用户 | 403 | `无权使用该资产` |
| 资产不是图片 | 422 | `参考图必须是图片资产` |
| 清空列表 | 200 | 返回 `[]`，不得返回“请至少选择一个资产” |

## 8. 可选兼容方案

如果后端不希望修改现有绑定接口，也可以新增独立解绑接口：

```http
DELETE /api/projects/{project_id}/subjects/{subject_id}/reference-images
```

成功响应：

```json
{
  "success": true,
  "reference_images": []
}
```

但无论采用哪种方案，都必须保证：

- 清空主体参考图绑定；
- 不删除资产库原图；
- 主体详情返回空参考图列表；
- 关闭弹窗、重新打开和刷新浏览器后都不再恢复旧图。

## 9. 验收用例

### 用例一：删除唯一参考图

1. 主体已有一张参考图；
2. 打开编辑主体弹窗；
3. 删除参考图；
4. 确认请求成功，返回 `200` 和空列表；
5. 关闭弹窗后重新打开；
6. 参考图列表为空；
7. 刷新浏览器后参考图列表仍为空；
8. 资产库中原图片仍然存在。

### 用例二：删除多张中的一张

1. 主体已有两张或三张参考图；
2. 删除其中一张；
3. 请求提交删除后剩余的完整 `asset_ids`；
4. 主体详情只返回剩余参考图；
5. 关闭、重开和刷新后结果一致。

### 用例三：删除与上传连续发生

1. 上传一张参考图；
2. 在上传请求完成前删除另一张参考图；
3. 最终主体参考图列表应符合用户最后一次操作；
4. 不得由旧请求覆盖新请求结果。

### 用例四：参考图与候选图隔离

1. 上传或绑定参考图；
2. 打开右侧候选图列表；
3. 参考图不得出现在候选图列表；
4. 删除参考图时不得删除候选图或资产库原图。

## 10. 需要后端确认的事项

请确认以下内容：

1. 是否接受 `asset_ids=[]` 作为清空绑定语义；
2. 如果不接受，请提供正式解绑接口路径、请求方法和响应结构；
3. 清空时是否需要同步清理主体记录中的旧主参考图字段；
4. 绑定关系和主参考图更新是否在同一事务中完成；
5. 主体详情接口在清空成功后是否立即返回 `reference_images: []`；
6. 是否会保留资产库原始图片，不执行物理删除。

