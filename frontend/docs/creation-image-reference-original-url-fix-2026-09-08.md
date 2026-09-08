# 图片创作参考素材地址修复指南

日期：2026-09-08  
来源项目：miioo-v1.5 前端  
状态：来源项目已修复，Suzy 已实际验证通过；目标项目尚未修改或验收。

## 1. 问题与结论

操作路径：创作 → 图片创作 → 历史图片卡片 → 用作参考图 → 输入提示词 → 发送。

原问题是生成请求把派生 AVIF 预览图作为参考素材，模型报参考图格式不支持。首轮修改后又把受控下载入口作为参考素材，用户验证模型仍无法读取。

最终原则：**生成素材使用接口提供的 `original_url`，兼容 `originalUrl`；预览与下载分别使用自己的字段。不要把下载地址优先写入原图字段。**

初次错误消息包含 `image/gif`，实际参考字段却为 `.avif`。已确认的是地址选错，未确定后端为何报告 GIF；不要把这种 MIME 差异写成已查明的格式转换机制。

## 2. 字段契约

以下为脱敏示例，不包含真实令牌、签名或用户身份：

```json
{
  "id": "example-image-id",
  "asset_id": "example-asset-id",
  "thumbnail_url": "/uploads/derived/assets/card_square/example.avif",
  "preview_url": "/uploads/derived/assets/preview/example.avif",
  "original_url": "/uploads/creation/global/images/example.png",
  "download_url": "/api/media/downloads/REDACTED"
}
```

| 字段 | 含义 | 本次处理 |
| --- | --- | --- |
| `thumbnail_url` / `thumbnailUrl` | 缩略图 | 仅展示，不作为本功能的生成素材 |
| `preview_url` / `previewUrl` | 预览图 | 可供卡片、输入附件预览 |
| `original_url` / `originalUrl` | 原图 | 生成素材首选来源 |
| `download_url` / `downloadUrl` | 下载入口，可能带短期令牌 | 保留下载用途，不混入原图字段 |
| `asset_id` / `assetId` | 资产身份 | 随附件保留，不能替代图片请求所需地址 |

期望发送给本项目后端的参考字段：

```json
{
  "reference_images": ["/uploads/creation/global/images/example.png"]
}
```

该相对路径是本项目后端接受的素材引用，不代表可以原样发给外部模型。另一个项目应遵守自己的后端协议完成域名解析或素材读取，不要硬编码来源项目域名，也不要拆解下载令牌或拼接存储路径绕过权限。

## 3. 两层根因

第一层：`buildCreationImageReferencePrefill` 把 `card.imageUrl` 同时写进附件的 `url` 和 `previewUrl`。历史适配对 `imageUrl` 优先取预览、参考帧或缩略图，因此界面正常不代表素材正确。

第二层：历史适配原先采用 `download_url || original_url`，却把结果命名为 `originalUrl`；生成结果与任务恢复也用 `imageDownloadUrls` 填充卡片原图字段。仅把按钮改为读取 `card.originalUrl` 仍会取到下载入口。

首轮测试只提供原图和预览图，未提供同时存在的下载字段，漏掉了第二层问题。同步修复时必须使用至少三种互不相同的地址做测试。

## 4. 修改清单

下列路径以来源项目的前端目录为根。目标项目文件名可以不同，应按职责对应修改，不要覆盖整个文件或混入无关改动。

| 文件 | 必须核对的修改 |
| --- | --- |
| `src/utils/creationHistoryAdapter.js` | `normalizeCreationHistoryItem` 原图优先取 `original_url`/`originalUrl`，移除下载字段；`pickCreationHistoryCacheItem` 保留两种原图命名 |
| `src/api/creation.js` | `getImageUrls` 分别返回预览、原图和下载地址；两处图片任务轮询结果与多任务合并透传 `imageOriginalUrls`；`normalizeBasicEditImage` 不再从下载地址填充原图 |
| `src/components/creation/useCreationGeneration.js` | 使用 `imageOriginalUrls` 构造完成卡片的 `originalUrl`；去重、过滤时让原图与预览保持配对 |
| `src/utils/creationTaskAdapter.js` | `normalizeCreationTaskResult` 从原图数组或结果对象的原图字段恢复，不读取下载数组填充原图 |
| `src/utils/creationDetailAdapter.js` | `buildCreationImageReferencePrefill` 分离素材与预览地址，并校验候选地址；无可用来源返回 `null` |
| `src/components/creation/CreationResultState.jsx` | 消费回填函数的 `null` 返回值，显示现有错误提示，不更新附件或回填版本 |
| `scripts/creation-image-reference.test.mjs` | 添加回归测试，涵盖原图与下载字段同时存在、缓存兼容和任务恢复 |

### 4.1 分别保留三种地址

关键逻辑示意，不是完整函数替换：

```javascript
const originalUrl = image.original_url || image.originalUrl
  || image.file_url || image.fileUrl || '';
const downloadUrl = image.download_url || image.downloadUrl
  || originalUrl || previewUrl;

return { previewUrl, originalUrl, downloadUrl };
```

`file_url` 仅为来源项目既有兼容字段，目标项目必须确认它确实表示原始文件。不能改成 `downloadUrl || originalUrl`。

### 4.2 轮询与卡片透传

```javascript
const imageUrls = images.map(getImageUrls);
return {
  images: imageUrls.map((item) => item.previewUrl),
  imageOriginalUrls: imageUrls.map((item) => item.originalUrl),
  imageDownloadUrls: imageUrls.map((item) => item.downloadUrl),
};
```

多任务轮询合并时，三个数组按同一任务顺序展开。生成卡片的原图字段使用 `imageOriginalUrls[index]`，而非 `imageDownloadUrls[index]`。若预览列表需要过滤或去重，先配成 `{ previewUrl, originalUrl }` 对象再操作，避免数组错位。

### 4.3 参考附件回填与拦截

最终附件应类似：

```javascript
{
  url: sourceUrl,
  previewUrl: card.imageUrl || sourceUrl,
  assetId: card.assetId || card.id || undefined,
  isAsset: true,
  size: 0,
}
```

来源项目依次检查 `card.originalUrl`、`card.imageUrl`，以保留旧卡片展示地址本身就是原图的兼容能力。用标准 `URL` 解析出 `pathname`，复用 `isSafeImageUrl` 排除 `.avif` 和 `/derived/assets/`，另排除以 `/api/media/downloads/` 开头的路径。解析时使用的基础域名仅用于解析相对路径，不用于改写或请求图片。

这也会拒绝原图字段被历史适配污染为派生预览或下载入口的情况。没有可用来源时返回 `null`，调用处显示“未找到可用原图，请上传原图作为参考素材”，并停止追加。

**限制：这是一组针对已知错误地址的防护，不是文件内容检测或模型格式白名单。** 它不能证明远程文件实际 MIME 类型、权限、有效期或可访问性。来源项目保留的 `.png` 附件名称也不是转码行为。

## 5. 缓存与兼容

- 同时检查网络加载、轻量历史缓存、新生成完成卡、刷新恢复任务四条路径，不能只改网络响应适配。
- 来源项目缓存写入补充 `originalUrl`/`fileUrl` 命名兼容，不用下载字段回填原图。
- 已保存的草稿附件不会因代码更新自动替换 `url`。复测前刷新页面，待历史加载完成，删除旧参考附件后重新从卡片添加。
- 旧卡片只有错误下载入口且没有原图时，当前实现提示并阻止追加，不会自动请求详情或解码令牌恢复原图。
- 不主动清空用户全部草稿、任务或缓存；目标项目若需要自动迁移，应单独设计并验证。

## 6. 自动化验证

来源项目运行命令：

```bash
node --test scripts/creation-image-reference.test.mjs
npm run lint
npm run build
npm run check:architecture
git diff --check
```

测试脚本通过 Vite 加载现有模块。受限环境若报告本地服务监听权限错误，应申请所需权限后重跑，不能仅根据部分断言通过就记录整套测试通过。

当前 8 项测试覆盖：

1. 历史记录同时存在原图、预览和下载字段，附件提交原图，保留预览和资产身份。
2. 只有派生预览的历史记录不能回退提交预览。
3. 拒绝带查询参数的 AVIF、绝对地址派生图和派生目录中的 PNG。
4. 兼容只有原图展示地址的旧卡片。
5. 无地址时拒绝添加，只有原图时使用原图展示。
6. 驼峰原图字段不会被下载字段覆盖。
7. 旧缓存的相对或绝对受控下载入口不能作为参考素材。
8. 任务恢复的对象结果、独立原图数组均优先保留原图。

目标项目还应验证缓存往返、新生成结果去重及实际请求体；来源项目的单元测试不等于这些路径全部已由自动化端到端覆盖。

## 7. 人工验收

1. 选择原图、预览图和下载地址三者不同的历史图片，点击“用作参考图”。
2. 确认输入区仍显示预览，提交请求中的第一张参考图对应接口的 `original_url`，没有 AVIF 派生地址或受控下载入口。
3. 确认模型生成成功，不仅检查响应中的回显字段。
4. 新生成一张图片，不刷新直接用作参考图；重复步骤 2、3。
5. 生成过程中刷新页面，任务完成后用作参考图；再次确认原图字段。
6. 验证正常图片预览、下载、已有附件追加和原图缺失提示未回归。

来源项目最终结果：Suzy 已实际确认修复通过；8 项测试、修改文件定向 ESLint、生产构建、差异格式检查通过。此前全仓检查仍有未修改文件的问题：`AssetsCards.jsx:177` 未使用变量、`PanelPromptInput.jsx:317` 依赖警告、`seedanceUploadValidation.js` 文件命名不符合架构规则。目标项目必须独立运行检查，不能沿用来源项目验收结论。

## 8. 交接经验

- 字段名称不是事实依据：必须追溯它由哪个接口字段赋值。
- 展示、模型素材、用户下载是三种用途，不能因为最终指向同一文件就混用入口。
- 测试数据必须让候选地址不同，并同时提供所有优先级字段。
- 不通过改扩展名、写死 MIME 或解码令牌替代正确的字段选择。
- 先定位完整数据链路，再改各层契约；不要用按钮处的一行改动掩盖上游语义错误。
- 本次同步范围不包含视频素材、主体引用等其他功能，也不包含无关的文件卡片样式修改。
