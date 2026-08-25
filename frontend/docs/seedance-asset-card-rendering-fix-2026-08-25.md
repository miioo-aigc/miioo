# Seedance 素材卡片图片渲染与弹窗三列布局修复

> 修复日期：2026-08-25
> 卡片、三列布局与输入框回填：用户已验证通过

## 一、问题范围

资产库的 Seedance 素材库中，进入真人或虚拟人像素材组后，素材卡片需要与 Seedance 文件夹详情页保持统一样式。同时，从资产库选择素材的弹窗中存在两个问题：

1. 后端响应体中的 `preview_url`、`source_url` 虽然存在，前端卡片仍可能显示为黑卡片；
2. 卡片使用固定宽度时，弹窗内容区无法一行容纳三个卡片，第三张会换行。

本次修复不改变素材选择业务规则，也不新增修改素材的能力。

## 二、实现内容

### 1. 统一素材卡片

新增 `SeedanceAssetCard`，由以下两个入口复用：

- 资产库 Seedance 素材组文件夹详情页；
- “从资产库选择”弹窗的 Seedance 素材列表。

弹窗调用时关闭预览和删除操作按钮，但保留卡片点击选择行为。

### 2. 图片地址处理

卡片使用原生 `<img>` 展示图片，不再依赖 CSS `background-image`。图片地址按以下候选顺序尝试，并在加载失败后继续切换备用地址：

```text
url
preview_url / previewUrl
poster_url / posterUrl
thumbnail_url / thumbnailUrl
source_url / sourceUrl
file_url / fileUrl
```

同时：

- 过滤 `asset://...` 这类只供模型或服务商识别的素材引用；
- 兼容 `[图片名称](https://...)` 形式的 Markdown 链接；
- 还原接口序列化后可能出现的 `\\&`、`\\_` 转义符；
- 保留视频地址和静态封面地址的独立回退逻辑。

### 3. 弹窗三列自适应

弹窗进入 Seedance 素材组后，Seedance 素材列表使用：

```js
gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
```

卡片外层和卡片自身均允许收缩并占满当前网格列，避免固定宽度把第三列挤到下一行。项目资产、创作资产和音频等其他 Tab 继续使用原有的弹性换行布局和卡片尺寸，选择、禁选和点击回调保持原样。

### 4. 创作输入框回填

Seedance 真人素材和虚拟人像加入创作输入框时，图片槽统一使用可访问的 `url`、`previewUrl` 或 `preview_url`，不再将 `asset://...` 服务商引用写入图片展示字段。生成请求仍单独保留 `assetRefUrl`，因此不会影响 Seedance 素材引用逻辑；项目资产和创作资产的原有回填逻辑保持不变。

### 5. 虚拟人像最终渲染问题的根因

真人和虚拟人像的接口响应字段结构一致，均包含 `source_url`、`preview_url` 和 `asset_ref_url`。因此不能仅凭“虚拟人像无法渲染”推断为字段缺失或 URL 格式特殊。

最终确认的问题发生在选择确认后的二次回填：

1. 素材列表接口返回对象经过归一化后，虚拟人像卡片已经可以正常渲染；
2. 用户点击确认时，旧逻辑再次请求素材详情；
3. 详情结果重新与列表对象合并并重新构造，可能覆盖列表阶段已经处理好的展示地址或分组标识；
4. 输入框收到的对象因此无法被图片卡片按预期识别和渲染。

最终处理方式：

- 虚拟人像确认时直接沿用弹窗列表中已经成功渲染的归一化对象，不再用详情接口结果二次覆盖；
- `url`、`previewUrl`、`sourceUrl`、`fileUrl` 继续作为浏览器展示地址；
- `assetRefUrl` 单独保留给 Seedance 生成请求；
- 真人素材原有详情补全流程保持不变。

这类问题的排查顺序应优先区分三个阶段：列表展示、确认回填、输入框渲染。若列表已正常显示而输入框异常，应优先检查确认回调是否重新请求并重建对象，而不是先改动媒体 URL 的字段优先级。

## 三、涉及文件

- `src/components/AssetPickerModal.jsx`
- `src/components/assets/SeedanceAssetCard.jsx`
- `src/components/assets/SeedanceFolderDetail.jsx`
- `src/components/assets/index.js`
- `src/components/creation/CreationInputCard.jsx`

## 四、验收结果

- Seedance 真人素材卡片图片正常渲染；
- Seedance 虚拟素材卡片图片正常渲染；
- 资产库文件夹详情页和选择弹窗复用同一卡片样式；
- 弹窗一行稳定展示三个卡片，卡片宽度随弹窗内容区自适应；
- 项目资产、创作资产和音频等其他 Tab 的卡片尺寸与原有行为保持一致；
- 勾选、禁选和点击选择逻辑保持正常；
- 用户已验证通过。

静态检查结果：

- `npm run lint -- --quiet` 通过；
- `npm run build` 通过；
- `npm run check:architecture` 通过，只有项目既有规模提醒；
- `git diff --check` 通过。

针对首次回填修复后仍无法渲染的问题，已继续调整 `CreationFileCard`：资产图片改用原生 `<img>`，统一归一化图片地址，并在 `previewUrl` 加载失败时按 `url`、`sourceUrl`、`fileUrl` 依次回退；回填对象同步保留这些备用地址。后续定位确认虚拟人像的最终问题属于确认阶段对象二次覆盖，已修复并由用户验证通过。

构建输出仍有项目已有的大体积 chunk 提醒，不影响本次修复。
