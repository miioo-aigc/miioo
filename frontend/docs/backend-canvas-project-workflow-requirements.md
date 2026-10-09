# 自由画布项目与多画布后端交接清单

> 文档状态：前端需求交接稿
> 更新时间：2026-09-23
> 适用范围：自由画布项目、项目下多画布、节点式工作流

## 一、需求背景

当前后端的 `canvas-documents` 接口将一个画布文档按“一个项目”使用。前端当前也暂时通过该接口进入已有画布详情，但产品规划要求自由画布采用两级资源模型：一个项目包含多个画布。

本轮前端允许使用已有画布详情作为开发入口，但暂不复用普通工作流项目创建接口，也不再把 `POST /api/canvas-documents` 当作“新建项目”接口。首页的“新建项目”入口保留，点击时仅提示能力建设中，等待后端项目级接口完成后再接入。

## 二、目标资源关系

```text
项目 Project
└── 画布 CanvasDocument（一个项目可有多个）
    ├── 节点 Node
    ├── 连接 Edge
    └── 视口 Viewport
```

- 左上角显示项目名称，不显示当前画布名称。
- 工具栏“画布列表”显示当前项目下的画布，并支持新增、切换和重命名。
- 节点、连接和视口只属于具体画布。
- 项目级权限、分享范围和未来全局 Agent 作用于项目；节点生成仍由用户在节点中主动确认，Agent 不得直接触发扣费生成。

## 三、项目接口需求

建议提供以下接口，具体路径可按后端规范调整，但必须保持项目与画布的资源语义分离：

```http
GET    /api/canvas-projects
POST   /api/canvas-projects
GET    /api/canvas-projects/{project_id}
PATCH  /api/canvas-projects/{project_id}
```

项目响应至少包含：

```json
{
  "id": "project-id",
  "name": "项目名称",
  "revision": 1,
  "created_at": "2026-09-23T00:00:00Z",
  "updated_at": "2026-09-23T00:00:00Z"
}
```

创建项目时，后端应在同一事务中自动创建第一张画布，默认名称为“画布1”。创建请求应支持 `client_request_id`，网络重试不得重复创建项目或初始画布。

## 四、项目下画布接口需求

```http
GET    /api/canvas-projects/{project_id}/canvases
POST   /api/canvas-projects/{project_id}/canvases
GET    /api/canvas-projects/{project_id}/canvases/{canvas_id}
PATCH  /api/canvas-projects/{project_id}/canvases/{canvas_id}
DELETE /api/canvas-projects/{project_id}/canvases/{canvas_id}
```

画布响应至少包含：

```json
{
  "id": "canvas-id",
  "project_id": "project-id",
  "name": "画布1",
  "revision": 1,
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "created_at": "2026-09-23T00:00:00Z",
  "updated_at": "2026-09-23T00:00:00Z"
}
```

要求：

1. 新增画布只创建当前项目下的画布，不创建新项目。
2. 画布名称与项目名称必须是两个字段，不能共用 `title`。
3. 画布名称由前端限制最多 30 个字符，并禁止特殊符号；后端也必须再次校验。
4. 删除或归档当前画布时，必须明确是否禁止删除项目最后一张画布。
5. 画布列表返回稳定排序字段，默认创建顺序或显式 `sort_order`，不能依赖数据库自然顺序。

## 五、保存与并发要求

项目名称、画布名称和画布文档内容都需要版本控制：

- 请求携带 `base_revision`；
- 成功后返回新的 `revision`；
- 版本冲突返回 HTTP `409`，并返回服务端最新版本或可重新读取的资源地址；
- 保存项目名称不能覆盖画布节点数据；
- 保存画布节点不能覆盖项目名称或其他画布；
- 保存请求建议支持幂等键，避免网络重试产生重复版本。

## 六、节点文档最小要求

节点和连接暂可作为画布文档的一部分保存，但字段必须能稳定映射到 React Flow 之外的业务模型：

```json
{
  "schema_version": 1,
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

节点至少需要稳定的业务 `id`、`type`、`position`、`data`；连接至少需要 `id`、`source`、`target`，以及必要时的端口字段。不能只保存 React Flow 内部临时对象作为长期协议。

## 七、资产选择与绑定

本轮前端会尽量复用现有资产库查询和选择弹窗，但后端需确认：

- 自由画布资产是否按 `project_id` 隔离；
- 是否允许选择项目外的用户资产；
- 节点保存 `asset_id`、资产引用快照，还是两者同时保存；
- 原资产删除、归档或权限失效后节点如何展示；
- 图片、视频、音频是否统一使用 `asset_type`；
- 资产选择是否需要记录使用关系，避免资产删除后无法追溯。

## 八、分享与导出

后续需要确认：

- 分享范围是整个项目还是单张画布；
- 分享链接是只读还是可编辑；
- 是否支持过期时间、撤销和权限校验；
- “导出节点”是当前选中节点还是当前画布全部节点；
- 导出是否包含节点参数、端口连接、资产 ID、视口和 schema 版本；
- 导入时是否重新生成节点 ID，并校验资产访问权限。

## 九、本轮前端暂缓项

- 不调用普通工作流项目创建接口。
- 不调用 `POST /api/canvas-documents` 作为新建自由画布项目的替代。
- 不把当前画布的 `title` 当作最终项目名称。
- 不宣称项目创建、多画布持久化、项目名称保存和分享导出已经完成。
- 允许使用已有画布详情作为工具栏、React Flow 和节点交互的开发入口。
