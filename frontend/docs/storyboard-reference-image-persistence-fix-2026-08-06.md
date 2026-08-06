# 分镜创作面板普通参考图持久化修复记录

> 修复日期：2026-08-06  
> 验证状态：已通过  
> 问题范围：普通参考图持久化，不包含主体参考绑定、`@` 标签或 `video_prompt_mentions` 业务规则

## 问题

在分镜创作面板的“参考图”字段中执行以下任一操作：

- 上传本地图片；
- 从资产库选择创作资产图片。

操作完成后，当前页面可以正常看到参考图，接口响应中也能看到参考图数据；但是刷新页面后，参考图消失，后端重新返回的 `reference_images` 和 `reference_image_urls` 变成空数组。

本次问题与主体参考列、主体绑定关系、提示词标签展示无关，按独立的普通参考图保存问题处理。

## 结论

新版 OpenAPI 仍将普通参考图定义在分镜更新接口中：

- `reference_images`
- `reference_image_urls`
- `gen_params`

新增的 `storyboard_version_id`、`scene_block_id`、`is_current_version` 是分镜响应中的版本标识，不是普通参考图专用保存字段。

本次排查过的真实数据表现为：

```text
上传后的 PATCH 响应：
reference_images = 2 张
reference_image_urls = 2 条
gen_params.creation_form.video.refImages = 2 张
updated_at = 2026-08-05T16:38:13
scene_block_id = 1f1df...

刷新后的 GET 响应：
reference_images = []
reference_image_urls = []
gen_params.creation_form.video.refImages = []
updated_at = 2026-08-05T16:08:34
scene_block_id = 90bc...
```

这组数据首先暴露了前端缓存和旧快照回写问题：刷新时可能没有读取刚保存的数据，页面加载阶段的提示词自动修复还可能把旧空数组再次写回。

同时，`PATCH` 与刷新 `GET` 返回不同 `scene_block_id`，说明后端仍存在版本化读取链路风险。本次用户验证证明前端修复已经解决实际问题，但该后端风险仍应保留在联调记录中。

## 数据职责

普通参考图使用以下字段保存：

```text
reference_images
reference_image_urls
gen_params.reference_images
gen_params.reference_image_urls
gen_params.creation_form.image.refImages
gen_params.creation_form.video.refImages
```

主体引用字段不用于保存普通参考图：

```text
subject_refs_json
generation_refs_json
character_ids
scene_id
prop_ids
```

新版 OpenAPI 中的 `attachments` 和 `reference_image_asset_ids` 属于创作视频生成请求参数，不是创作面板普通参考图编辑状态的持久化接口。

## 前端修复

### 1. 绕过旧分页缓存读取

分镜页面实际使用分页缓存键：

```text
storyboard-pages:{projectId}:{episodeId}:{limit}:{offset}:...
```

此前分镜 PATCH 成功后，主要只更新或失效了整集缓存：

```text
storyboards:{projectId}:{episodeId}
```

分页缓存仍可能保留保存前的空参考图数组。刷新页面时，前端先命中旧分页缓存，导致用户误以为后端没有保存。

修复内容：

- `apiGetStoryboards()` 新增 `skipCache` 参数；
- 分镜页面首次加载和加载更多时使用 `skipCache: true`；
- 请求增加 `Cache-Control: no-cache`、`Pragma: no-cache` 和 `cache: 'no-store'`；
- 强制读取时增加时间戳查询参数，避免浏览器或中间层复用旧响应。

### 2. PATCH 后清理所有分页缓存

分镜 PATCH 成功后新增：

```js
invalidate(K.storyboardPagePrefix(projectId));
```

这样后续刷新、切换分集和加载更多不会继续读取保存前的分页快照。

### 3. 隔离提示词绑定自动修复

页面加载阶段存在一段自动补全提示词主体绑定的逻辑。此前它会把完整创作表单一起提交，可能携带旧的：

```text
image.refImages = []
video.refImages = []
```

修复后，自动补全只提交：

```js
{
  video_prompt,
  video_prompt_mentions,
}
```

普通参考图不再被提示词绑定修复逻辑读取或覆盖。

### 4. 保留参考图资产身份

本地上传和资产库选择统一转换为：

```js
{
  id: assetId || url,
  assetId,
  url,
  name,
  type,
}
```

提交后端时保留：

```json
{
  "asset_id": "资产 ID",
  "url": "图片地址",
  "name": "图片名称"
}
```

这样刷新恢复、去重和重新提交时不会只依赖图片 URL。

## 后端联调检查

前端修复前，如果强制网络读取后仍出现：

```text
PATCH 返回新 scene_block_id
刷新 GET 返回旧 scene_block_id，且 reference_images 为空
```

则问题不再是前端缓存，应检查后端是否只保留一个 `is_current_version = true` 的场景块，以及列表 GET 是否读取 PATCH 写入的同一当前场景块。

由于本次前端验证已经通过，当前不需要后端立即改接口才能使用。但如果后续再次观察到 PATCH 和刷新 GET 返回不同 `scene_block_id`，应把以下问题交给后端确认：

1. 同一 `storyboard_id` 是否存在多个 `is_current_version = true` 的场景块。
2. PATCH 是否真正更新了当前版本，而不是只回显请求体。
3. 列表 GET 是否读取了 PATCH 创建或更新的同一 `scene_block_id`。
4. `reference_images`、`reference_image_urls` 与 `gen_params.creation_form` 是否在当前场景块内同步保存。
5. 空数组是否被正确解释为“用户主动清空”，而不是在重建 `gen_params` 时的默认值。

## 验证

```text
npx eslint src/api/storyboard.js src/pages/StoryboardPage.jsx src/components/storyboard/StoryboardUploadSlots.jsx src/utils/storyboardDataAdapter.js
npm run build
npm run check:architecture
git diff --check
```

以上检查通过。架构检查仅保留仓库既有文件规模提醒。

## 用户验收结果

用户确认：

```text
前端修复验证通过。
```

验收重点为：

1. 在创作面板参考图字段上传图片或选择资产库图片。
2. 当前页面能够看到新增参考图。
3. 等待保存请求完成后刷新页面。
4. 刷新后参考图仍然存在，后端返回的参考图数组不再被前端旧缓存或自动修复逻辑清空。

## 涉及文件

- `src/api/storyboard.js`
- `src/pages/StoryboardPage.jsx`
- `src/components/storyboard/StoryboardUploadSlots.jsx`
- `src/utils/storyboardDataAdapter.js`
