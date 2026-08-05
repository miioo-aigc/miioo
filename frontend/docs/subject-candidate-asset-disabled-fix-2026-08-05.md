# 主体候选图资产重复选择禁用修复

> 修复日期：2026-08-05
>
> 问题范围：主体页面“编辑主体”弹窗，主体候选图从资产库选择后再次打开资产选择弹窗的重复选择状态。

## 一、问题现象

在主体 B 的候选图区域从“资产库-创作资产”选择一张图片并添加成功后，再次打开资产选择弹窗，刚添加的原始创作资产仍显示为可选状态。用户可以再次勾选，直到点击确定添加时才由后端返回重复关系错误。

期望行为是：

1. 已复制到当前主体的源资产继续展示在资产选择弹窗中，方便用户确认资产位置；
2. 该资产卡片直接显示为禁选状态；
3. 禁用卡片不能被点击、勾选或再次提交；
4. 页面刷新或关闭弹窗后重新打开，禁选状态仍能恢复。

## 二、根因与接口边界

资产库选择主体候选图使用：

```http
POST /api/projects/{project_id}/subjects/{subject_id}/images/from-asset
```

该接口的业务语义是创建当前主体自己的候选图记录，同时保留源创作资产关系。当前前端接口描述 `src/api/openapi.json` 未完整同步这条接口，也没有正式声明候选图响应中的以下来源字段：

```text
source_asset_id
derived_from_asset_id
```

因此，刷新主体后如果响应只返回复制后的候选图 `asset_id`，前端无法通过新资产 ID反推出资产选择弹窗中的原始创作资产 ID，导致卡片仍被视为可选。

不能通过修改源资产的 `subject_id`、`is_primary` 或分类来解决此问题。源资产仍属于原来的资产范围，当前主体只新增一条独立候选图关系。

## 三、前端修复

### 3.1 资产选择弹窗

`src/components/AssetPickerModal.jsx` 新增 `excludedAssetUrls` 参数，并扩展已占用资产判断：

- ID同时兼容 `id`、`assetId`、`asset_id`；
- 来源 ID统一转成字符串，兼容接口返回数字或字符串的类型差异；
- 媒体地址按现有创作资产地址别名归一化后作为兜底匹配；
- 命中禁选条件后，卡片置灰、复选框禁用、点击事件失效，不再等到确定提交时才提示错误；
- 保留原有 `preSelectedIds` 逻辑，避免影响其他资产选择场景。

### 3.2 主体候选图列表

`src/components/subject/SubjectImageList.jsx` 从当前候选图中收集资产库来源项：

- 优先传递 `sourceAssetId`、`source_asset_id` 及嵌套来源资产 ID；
- 同时收集 `rawUrl`、`url`、`thumbnailUrl`、`previewUrl`，在后端暂未返回来源 ID时按媒体地址兜底禁选；
- 仅对 `asset-library` 来源的候选图生成禁选集合，不影响本地上传和主体 AI 创作结果。

### 3.3 候选图数据映射

`src/components/subject/SubjectImageMappers.js` 的 `mapCandidateImages` 兼容读取以下来源字段：

- `source_asset_id` / `sourceAssetId`；
- `derived_from_asset_id` / `derivedFromAssetId`；
- `source_asset.id` / `sourceAsset.id`；
- `metadata_json` 中的同名字段。

临时添加成功响应仍保留来源资产 ID，避免在不刷新页面的情况下丢失禁选依据。

## 四、验证结果

已完成：

- `npx eslint src/components/AssetPickerModal.jsx src/components/subject/SubjectImageList.jsx src/components/subject/SubjectImageMappers.js`
- `npm run build`
- `npm run check:architecture`
- `git diff --check`

完整 `npm run lint` 无错误，仅保留既有 `GenerateVideoPanel.jsx` React Hook 依赖警告；构建仅保留项目已有的大 chunk 提示；架构检查仅保留既有文件规模提醒。

尚需在有登录态的真实联调环境确认：

1. `POST /images/from-asset` 成功响应是否返回 `source_asset_id` 或等价字段；
2. `GET /subjects/{subject_id}/images` 刷新后是否保留该来源字段；
3. `GET /api/creation/images` 返回的创作资产 ID和媒体地址是否与弹窗卡片使用的字段一致；
4. 源资产被复制到多个主体时，各主体只禁用自己已经添加过的源资产；
5. 删除当前主体候选图后，对应源资产是否恢复为可选，且不影响源资产本身。

## 五、后端接口文档同步要求

后端应正式补齐并稳定返回：

```json
{
  "asset_id": "当前主体的独立候选资产 ID",
  "source_asset_id": "资产库中被复制的源资产 ID",
  "derived_from_asset_id": "source_asset_id 的等价字段，可二选一统一",
  "source": "asset-library"
}
```

其中 `source_asset_id` 或 `derived_from_asset_id` 至少应在候选图查询接口中稳定返回。前端的媒体地址兜底只用于兼容接口过渡期，不能替代稳定的来源资产字段。

