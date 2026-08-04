# 创作页面与资产库图片重复修复需求

> 文档用途：交接后端进行问题定位、接口契约确认和修复联调。
>
> 问题范围：生产环境「创作页面 - 图片创作 - 创作历史」和「资产库 - 创作资产 - 图片」出现同一张业务图片重复展示。
>
> 发现日期：2026-08-04

## 一、业务背景

用户在创作页面生成图片后，图片会进入「图片创作 - 创作历史」。用户也可能把已经生成的图片导入某个分镜，作为分镜图片或参考素材使用。

当前生产环境的历史接口同时返回了以下两类记录：

1. `creation_shot_image`：真正由图片创作任务生成的图片；
2. `creation_shot_import`：将已有图片导入分镜后，系统为分镜创建的导入副本。

导入副本虽然拥有新的数据库 `id`、新的 `asset_id` 和新的文件路径，但业务来源仍然是原来的创作图片。两类记录同时出现在图片创作历史和资产库创作资产列表时，用户会看到同一张图片展示两次。

## 二、用户现象

生产环境打开「创作页面 - 图片创作 - 创作历史」或「资产库 - 创作资产 - 图片」后，在不发起新的创作请求的情况下，列表中出现重复图片。

本次提供的资产库生产响应共返回 10 条记录，实际对应 5 组图片。每组均由一条生成记录和一条导入记录组成：

| 分组 | 生成记录 `source` | 导入记录 `source` |
| --- | --- | --- |
| 镜头 `b38ae4bb-d0c6-425a-9e74-c5f761f329f8` | `creation_shot_image` | `creation_shot_import` |
| 镜头 `51474ec9-e57e-43cb-8f00-46f8195f0b21` | `creation_shot_image` | `creation_shot_import` |
| 镜头 `aa3cc4f5-034b-414d-9533-055753e74be7` | `creation_shot_image` | `creation_shot_import` |
| 镜头 `56a51341-60c4-4323-a1b5-ec6e1e4ccad6` | `creation_shot_image` | `creation_shot_import` |
| 镜头 `ded211dd-fbca-4f6a-a787-e5bbbd0dc15f` | `creation_shot_image` | `creation_shot_import` |

每组两条记录的 `session_id` 相同、`shot_id` 相同，且导入记录的 `metadata_json.origin_url` 指向对应生成记录的预览地址。本次样本中 5 条导入记录全部可以找到对应的原始创作图。

两个页面目前都通过 `GET /api/creation/images` 获取图片列表：

| 页面 | 请求接口 | 关键参数差异 |
| --- | --- | --- |
| 创作页面 - 图片创作 - 创作历史 | `GET /api/creation/images` | 传入 `exclude_hidden=true` |
| 资产库 - 创作资产 - 图片 | `GET /api/creation/images` | 不传 `exclude_hidden` |

两个页面的隐藏记录口径可能不同，但重复资产的来源是同一接口返回的两类资产记录，不是两个页面分别生成了重复数据。

## 三、生产数据证据

### 3.1 资产库响应统计

本次资产库响应统计如下：

```text
总记录数：10
creation_shot_image：5
creation_shot_import：5
明确的来源匹配组：5
```

每条 `creation_shot_import` 都满足：

```text
creation_shot_import.metadata_json.origin_url
    == 同组 creation_shot_image.preview_url（补齐生产环境域名后）
```

导入副本自身的 `preview_url` 和 `original_url` 指向 `imports/images/...`，原始创作图则指向 `images/...`，所以仅按记录自身媒体地址无法去重。

以镜头 `51474ec9-e57e-43cb-8f00-46f8195f0b21` 为例。

### 3.2 原始创作图片

```json
{
  "id": "2f317f01-8e0a-4f3f-8ad5-66f144ae050a",
  "asset_id": "2f317f01-8e0a-4f3f-8ad5-66f144ae050a",
  "source": "creation_shot_image",
  "session_id": "d0d6c55d-a0c0-4108-ae99-e1d20a318bfa",
  "shot_id": "51474ec9-e57e-43cb-8f00-46f8195f0b21",
  "preview_url": "/uploads/derived/assets/preview/27c08a117dbe444ca62babc937ba8955-preview_contain-7dd9df09f35843fdbd0c11a81e599ad9.avif",
  "original_url": "/uploads/creation/sessions/d0d6c55d-a0c0-4108-ae99-e1d20a318bfa/shots/51474ec9-e57e-43cb-8f00-46f8195f0b21/images/27c08a117dbe444ca62babc937ba8955.png",
  "metadata_json": {
    "task_id": "497e947b-897d-44f4-94e6-a5fa8972a5cf",
    "source": "creation_shot_image"
  }
}
```

### 3.3 分镜导入副本

```json
{
  "id": "150d531b-4713-4e1f-8d9e-de64312bbc09",
  "asset_id": "150d531b-4713-4e1f-8d9e-de64312bbc09",
  "source": "creation_shot_import",
  "session_id": "d0d6c55d-a0c0-4108-ae99-e1d20a318bfa",
  "shot_id": "51474ec9-e57e-43cb-8f00-46f8195f0b21",
  "preview_url": "/uploads/derived/assets/preview/c4ddc28ba1b24d62ad146787096c36f0-preview_contain-321df08d410145d6840f80115f3fe2ba.avif",
  "original_url": "/uploads/creation/sessions/d0d6c55d-a0c0-4108-ae99-e1d20a318bfa/shots/51474ec9-e57e-43cb-8f00-46f8195f0b21/imports/images/c4ddc28ba1b24d62ad146787096c36f0.jpg",
  "metadata_json": {
    "source": "creation_shot_import",
    "origin_url": "https://www.chengxvblog.top/uploads/derived/assets/preview/27c08a117dbe444ca62babc937ba8955-preview_contain-7dd9df09f35843fdbd0c11a81e599ad9.avif"
  }
}
```

### 3.4 证据结论

两条记录的数据库身份和物理路径不同：

```text
id 不同
asset_id 不同
preview_url 不同
original_url 不同
```

但导入记录保留了来源地址：

```text
creation_shot_import.metadata_json.origin_url
    -> creation_shot_image.preview_url
```

因此当前问题不是“同一个接口数组中同一个对象重复返回”，而是：

```text
图片创作生成
  -> 导入分镜
  -> 创建新的导入资产副本
  -> 图片创作历史同时返回原生成资产和导入副本
  -> 前端展示为两张图片
```

同样的关系在资产库响应中还出现于另外 4 个镜头，因此不是单个镜头的偶发脏数据。

## 四、根因判断

### 4.1 后端返回范围与两个页面的业务语义不一致

接口 `GET /api/creation/images` 同时服务“图片创作历史”和“创作资产图片”。两个页面的共同展示对象都是用户可管理的创作结果，用户期望同一业务图片只出现一张。

但当前接口将分镜导入类资产也作为独立图片资产返回：

```text
source = creation_shot_import
```

导入类资产不是新的图片创作结果，而是已有图片在分镜业务中的引用或副本，不应在图片创作历史或资产库创作资产列表中作为第二条独立结果展示。

### 4.2 前端现有去重无法识别该关系

前端当前主要按以下字段进行去重：

```text
id / asset_id
preview_url
original_url
download_url
thumbnail_url
file_url
url
```

本次两条记录的 `id`、`asset_id` 和媒体 URL 均不同，因此普通 ID 去重和 URL 去重都不会命中。

前端没有把 `metadata_json.origin_url` 作为稳定的来源关系处理，也不应该仅依赖一个可能不稳定的 URL 字段推断所有资产关系。

## 五、当前需求

### 5.1 两个展示入口都只展示一次业务图片

请后端调整 `GET /api/creation/images` 的返回语义：

- 返回真正由图片创作任务产生的图片结果；
- 不将仅用于分镜导入、分镜引用或业务复制的资产作为独立图片创作结果返回；
- 资产库创作资产列表不能因为图片被导入分镜，就新增一张重复卡片；
- 同一原始业务图片在两个页面都只展示一次。

对于本次数据，推荐接口列表只保留：

```text
source = creation_shot_image
```

过滤或排除：

```text
source = creation_shot_import
```

### 5.2 导入分镜不应破坏原始创作记录

导入分镜后应满足：

1. 原始 `creation_shot_image` 记录仍可在图片创作历史和资产库创作资产中查看；
2. 分镜页面仍能正常使用该图片；
3. 图片创作历史和资产库创作资产均不新增一条导入副本卡片；
4. 删除分镜或解除分镜引用时，不应误删原始创作结果；
5. 原始资产的收藏、下载和删除语义不应被导入副本覆盖。

### 5.3 优先采用“引用关系”而不是“业务复制”

如果导入分镜的文件副本是存储层或格式转换上的必要实现，请将它视为分镜业务的派生文件或引用文件，不要将它当成新的图片创作结果。

推荐的数据关系是：

```text
原始创作资产
  asset_id = A
       |
       +-- 图片创作历史引用
       +-- 分镜引用
       +-- 必要时的分镜派生文件
```

如果后端能够直接复用原始 `asset_id`，优先复用原始资产并单独建立分镜引用关系；如果必须创建新的导入资产，则必须保留明确的来源资产 ID。

## 六、推荐后端解决方案

### 方案 A：图片列表接口排除导入类资产（推荐，最小改动）

在 `GET /api/creation/images` 查询或组装返回结果时，排除：

```text
source = creation_shot_import
```

只返回符合图片创作历史语义的记录，例如：

```text
source = creation_shot_image
```

该方案同时修复创作页面和资产库，因为两个页面调用同一个图片列表接口。

优点：

- 修改范围最小；
- 不改变分镜页面现有逻辑；
- 不需要前端依赖 `origin_url` 推断关系；
- 可直接解决当前用户可见的重复卡片问题；
- 对历史脏数据也有效，只要接口查询时统一过滤。

需要后端确认：

- `creation_shot_import` 是否只用于分镜导入；
- 是否存在其他页面依赖 `/api/creation/images` 返回导入类资产；
- 图片创作历史是否还应包含用户手动上传的图片；如包含，请明确其他 `source` 的展示规则。

### 方案 B：导入资产增加稳定来源字段（推荐作为长期契约）

在所有导入类资产上增加稳定的来源关系字段，至少包含：

```json
{
  "source": "creation_shot_import",
  "source_asset_id": "2f317f01-8e0a-4f3f-8ad5-66f144ae050a",
  "derived_from_asset_id": "2f317f01-8e0a-4f3f-8ad5-66f144ae050a",
  "source_resource_id": "可选",
  "source_type": "creation_shot_image"
}
```

字段要求：

- `source_asset_id` 或 `derived_from_asset_id` 必须指向原始资产的稳定 ID；
- 不能只返回 `origin_url` 作为唯一关联依据；
- URL 可以作为展示或兼容字段，但不能替代资产关系；
- 原始资产删除、分镜引用删除和导入副本删除必须遵循独立的引用计数或引用关系规则。

图片创作历史仍建议按 `source` 过滤，不建议让前端通过来源 ID自行判断哪些记录应该隐藏。来源 ID主要用于分镜详情、资产详情、数据修复和审计。

### 方案 C：导入时不创建新的业务资产（长期优化）

如果业务允许，导入分镜时直接引用原始资产：

```text
分镜引用关系 -> 原始 asset_id
```

只有在必须做格式转换、裁剪或存储迁移时，才创建派生文件，并将派生文件与原资产建立稳定关系。

该方案可以从数据模型上避免“原图和导入副本被当作两个创作结果”的问题，但改动范围可能涉及分镜导入、资产删除、媒体下载和历史查询，不建议作为本次线上问题的唯一紧急修复。

## 七、接口契约建议

### 7.1 `GET /api/creation/images`

请确认并固定以下语义：

```text
接口用途：图片创作结果历史
返回范围：图片生成结果，不返回分镜导入副本
排序：按创作结果创建时间倒序
分页：过滤导入副本后再分页，不能先分页再过滤
```

特别注意：必须在数据库查询或服务端组装阶段过滤，再计算 `total`、`has_more` 和分页结果。不能先取 18 条再在后端或前端删除导入项，否则会造成分页数量不足、重复跨页和数据缺失。

### 7.2 资产来源字段

建议统一返回：

```json
{
  "id": "资产记录 ID",
  "asset_id": "业务资产 ID",
  "source": "creation_shot_image",
  "derived_from_asset_id": null,
  "session_id": "创作会话 ID",
  "shot_id": "镜头 ID",
  "metadata_json": {}
}
```

导入副本示例：

```json
{
  "id": "导入资产记录 ID",
  "asset_id": "导入资产 ID",
  "source": "creation_shot_import",
  "derived_from_asset_id": "原始创作资产 ID",
  "session_id": "创作会话 ID",
  "shot_id": "镜头 ID",
  "metadata_json": {
    "source": "creation_shot_import"
  }
}
```

## 八、前端配合与临时兜底

后端修复上线前，前端可以增加临时兼容逻辑：

1. 在图片创作历史和资产库创作资产展示中优先隐藏 `source = creation_shot_import`；
2. 对旧数据尝试通过 `metadata_json.origin_url` 与生成记录的 `preview_url` 建立弱关联；
3. 保留当前按媒体 URL和资产 ID的去重；
4. 不把 `download_url` 作为唯一身份，因为受控下载地址包含短时 token；
5. 不根据图片名称、提示词或文件扩展名判断是否为同一张图片。

但这只能作为展示层兜底，不应替代后端修复，原因是：

- `origin_url` 可能是完整域名，原记录可能是相对路径；
- 不同环境域名可能不同；
- URL 可能发生 CDN、签名或派生地址变化；
- 导入文件可能经过压缩、转码或裁剪；
- 前端无法判断哪一条数据库记录应被删除；
- 前端过滤无法修复分页总数和跨页重复问题。

## 九、验收标准

### 9.1 图片创作历史与资产库创作资产

1. 生成一张图片后，图片创作历史和资产库创作资产各出现 1 张结果。
2. 将该图片导入一个或多个分镜后，两个入口仍各只出现 1 张结果。
3. 刷新页面、重新登录、切换页面后，不能再次出现导入副本。
4. 分镜数量、导入次数不会影响两个入口中该图片的卡片数量。
5. 两个入口的分页 `total`、`has_more` 与过滤后的实际列表一致。
6. 图片创作历史和资产库仍能正常查看、收藏、下载和删除原始创作结果。

### 9.2 分镜页面

1. 导入图片后，分镜中仍能正常看到并使用该图片。
2. 分镜引用和图片创作历史使用同一原始资产时，不能相互误删。
3. 删除分镜引用不会删除原始图片创作记录。
4. 删除原始图片时，后端按照既有引用规则处理，不产生孤立或错误恢复的数据。

### 9.3 兼容历史数据

1. 对已存在的 `creation_shot_import` 历史数据，接口过滤后也不再返回重复卡片。
2. 不要求用户重新导入分镜或重新生成图片。
3. 旧数据的分镜引用仍然有效。
4. 新旧数据混合时，分页、排序和数量均正确。

## 十、需要后端确认的问题

请后端联调时明确回复以下问题：

1. `GET /api/creation/images` 当前是否设计为只返回图片生成结果？
2. `creation_shot_import` 是否仅表示分镜导入副本？是否还有其他业务含义？
3. 导入副本是否有原始资产 ID，只是当前响应没有返回？
4. `metadata_json.origin_url` 是否始终指向原始创作图片？是否可能指向主体图、上传图或其他来源？
5. 导入副本是否必须保留独立文件？如果必须，是否可以增加 `derived_from_asset_id`？
6. 过滤导入副本后，分页、总数和 `has_more` 是否会在过滤后重新计算？
7. 删除原始资产、删除分镜引用和删除导入副本之间的引用关系如何定义？
8. 是否可以先上线方案 A，再补充方案 B 的稳定来源字段？

## 十一、推荐落地顺序

### 第一阶段：线上止血

后端在 `GET /api/creation/images` 服务端过滤 `source = creation_shot_import`，并在过滤后重新计算分页信息。

### 第二阶段：补齐数据契约

导入类资产增加 `derived_from_asset_id` 或等价稳定来源字段，明确原始资产、派生文件和业务引用之间的关系。

### 第三阶段：数据治理

排查历史数据中是否存在重复导入副本、孤立副本和缺少来源关系的记录。必要时做数据修复，但不能直接删除可能仍被分镜引用的资产。

## 十二、最终结论

本问题的核心不是两个页面各自的前端数组去重失败，而是后端将不同业务语义的两类资产同时放进了同一个图片列表接口：

```text
creation_shot_image
creation_shot_import
```

其中 `creation_shot_import` 是已有图片进入分镜后的导入副本，不应作为第二条图片创作结果展示，也不应在资产库创作资产中与原始创作图并列展示。

本次推荐的最小修复是：

```text
GET /api/creation/images
  服务端排除 source = creation_shot_import
  过滤后重新计算分页和总数
```

该接口修复应同时覆盖：

```text
创作页面 - 图片创作 - 创作历史
资产库 - 创作资产 - 图片
```

长期方案是建立稳定的原始资产与派生资产关系，并让分镜通过引用关系使用图片，而不是让导入副本污染图片创作历史。
