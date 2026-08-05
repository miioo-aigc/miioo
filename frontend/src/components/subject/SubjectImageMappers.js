/**
 * @file SubjectImageMappers.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   mapCandidateImages       将后端候选图转换为右侧图片列表数据
 *   mapSubjectAssets          将绑定主体的项目资产转换为右侧候选图
 *   mapReferenceImages       将后端参考图转换为详情/预览数据（不进入候选列表）
 *   mapReferenceImageIdsForModal  将参考图 ID/URL 转为详情弹窗快照
 *   getSubjectCandidateImagesFromResponse 从主体详情响应读取候选图字段
 *   sortSubjectImages        按进入候选列表时间倒序排列
 *   mergeSubjectImages       去重、限制定稿图数量并插入任务占位/结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖图片地址和参考素材适配工具；不引用 React、页面、API、Store 或 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体详情图片的纯数据转换逻辑
 *   2026-07-22  参考图与候选图彻底分流，主体右侧列表只展示候选结果
 *   2026-07-28  合并读取绑定主体的项目资产，支持候选区上传和资产库选择刷新恢复
 *   2026-07-28  保留候选图来源及资产创作元数据，供详情弹窗按来源展示
 *   2026-07-28  候选图统一按创建/上传时间倒序排列，最新进入列表的图片置顶
 *   2026-07-31  参考图改为按候选图片自身原数据映射，不再回退到主体当前参考图
 *   2026-08-03  初始化候选图时排除同时出现在主体资产返回中的参考图资源
 *   2026-08-03  兼容仅返回参考图资产 ID 的响应，并支持参考图状态异步回写后的二次过滤
 *   2026-08-03  候选图过滤改用统一参考图身份键，兼容嵌套资产对象和空数组别名
 *   2026-08-03  候选图身份兼容 reference_asset/reference_image/resource 等嵌套返回
 *   2026-08-04  透传主体图片稳定资产/生成血缘字段，按 assetId 优先合并候选图与项目资产
 *   2026-08-05  适配主体候选图上传/资产库登记接口的完整响应字段
 *   2026-08-05  保留资产库复制来源编号，避免同一源图被重复复制到同一主体
 *   2026-08-05  主体资产列表同步透传源资产编号，保证刷新后仍能禁用重复选择
 */
import { normalizeImageUrl } from '../../utils/imageUrl';
import { getSubjectReferenceImageIdentities, getSubjectReferenceImageKeys, isExplicitReferenceMedia } from '../../utils/referenceMediaAdapter';

function getReferenceImages(value) {
  const candidates = [
    value?.reference_image_urls,
    value?.referenceImages,
    value?.reference_images,
    value?.refImages,
    value?.ref_images,
  ];
  const raw = candidates.find((items) => Array.isArray(items) && items.length > 0)
    || candidates.find((items) => Array.isArray(items))
    || [];
  return raw.map((ref) => {
    if (typeof ref === 'string') return { url: normalizeImageUrl(ref) || ref };
    const url = ref?.url || ref?.file_url || ref?.fileUrl || ref?.image_url || ref?.imageUrl;
    return url ? { ...ref, url: normalizeImageUrl(url) || url } : null;
  }).filter((ref) => ref?.url);
}

/**
 * 主体详情的候选图只允许来自 candidate_images/candidateImages。
 * 不读取通用 images，避免把参考图上传响应或创作输入素材误加入候选列表。
 */
export function getSubjectCandidateImagesFromResponse(response) {
  const containers = [
    response,
    response?.subject,
    response?.data,
    response?.data?.subject,
    response?.result,
    response?.result?.subject,
  ];
  for (const container of containers) {
    const images = container?.candidate_images ?? container?.candidateImages;
    if (Array.isArray(images)) return images;
  }
  return [];
}

function getImageUrl(value) {
  if (typeof value === 'string') {
    return /^(https?:|blob:|\/)/i.test(value) ? value : null;
  }
  return value?.file_url || value?.fileUrl || value?.image_url || value?.imageUrl
    || value?.original_url || value?.originalUrl || value?.preview_url || value?.previewUrl
    || value?.uploaded_url || value?.uploadedUrl
    || value?.large_url || value?.largeUrl || value?.thumbnail_url || value?.thumbnailUrl
    || value?.url || value?.image?.url || value?.image?.file_url || value?.image?.fileUrl;
}

function getImageId(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return /^(https?:|blob:|\/)/i.test(value) ? null : value;
  }
  return value.asset_id || value.assetId || value.file_id || value.fileId
    || value.image_id || value.imageId || value.id || value.image?.asset_id || value.image?.id;
}

function buildReferenceKeys(referenceImages = []) {
  const nestedKeys = getSubjectReferenceImageKeys(referenceImages);
  const ids = new Set(nestedKeys.ids);
  const urls = new Set(nestedKeys.urls);
  (Array.isArray(referenceImages) ? referenceImages : []).forEach((image) => {
    const id = getImageId(image);
    const url = getImageUrl(image);
    if (id != null) ids.add(String(id));
    const normalizedUrl = normalizeImageUrl(url) || url;
    if (normalizedUrl) urls.add(normalizedUrl);
  });
  return { ids, urls };
}

function isReferenceImage(image, referenceKeys) {
  if (isExplicitReferenceMedia(image)) return true;
  const identities = getSubjectReferenceImageIdentities([image]);
  return identities.ids.some((id) => referenceKeys.ids.has(String(id)))
    || identities.urls.some((url) => referenceKeys.urls.has(normalizeImageUrl(url) || String(url)));
}

function toImageItem({ id, rawUrl, thumbnailUrl = null, previewUrl = null, downloadUrl = null, settled = false, isReference = false, refImages = [], assetId = null, sourceAssetId = null, source = null, assetSource = null, taskId = null, generationId = null, resultIndex = null, contentHash = null, detailSource = null, prompt = null, inputPrompt = null, model = null, size = null, ratio = null, resolution = null, createdAt = null }) {
  return {
    id,
    rawUrl,
    thumbnailUrl: normalizeImageUrl(thumbnailUrl || rawUrl),
    previewUrl: normalizeImageUrl(previewUrl || rawUrl),
    downloadUrl: normalizeImageUrl(downloadUrl),
    url: normalizeImageUrl(thumbnailUrl || rawUrl),
    settled,
    isReference,
    refImages,
    ...(assetId ? { assetId } : {}),
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(source ? { source } : {}),
    ...(assetSource ? { assetSource } : {}),
    ...(taskId ? { taskId } : {}),
    ...(generationId ? { generationId } : {}),
    ...(resultIndex != null ? { resultIndex } : {}),
    ...(contentHash ? { contentHash } : {}),
    ...(detailSource ? { detailSource } : {}),
    ...(prompt != null ? { prompt } : {}),
    ...(inputPrompt != null ? { input_prompt: inputPrompt } : {}),
    ...(model != null ? { model } : {}),
    ...(size != null ? { size } : {}),
    ...(ratio != null ? { ratio } : {}),
    ...(resolution != null ? { resolution } : {}),
    ...(createdAt != null ? { created_at: createdAt } : {}),
  };
}

/**
 * 创建生成结果的前端图片条目，统一保留原始 URL 和展示 URL。
 */
export function createSubjectImageItem({ id, rawUrl, settled = false, refImages = [], createdAt = null }) {
  return toImageItem({ id, rawUrl, settled, refImages, createdAt });
}

export function mapCandidateImages(images) {
  return (Array.isArray(images) ? images : []).map((image) => toImageItem({
    id: image.id,
    rawUrl: image.image_url || image.imageUrl || image.preview_url || image.previewUrl || image.large_url || image.largeUrl || image.thumbnail_url || image.thumbnailUrl,
    thumbnailUrl: image.thumbnail_url || image.thumbnailUrl,
    previewUrl: image.preview_url || image.previewUrl || image.large_url || image.largeUrl || image.image_url || image.imageUrl,
    downloadUrl: image.download_url || image.downloadUrl,
    settled: image.is_primary ?? false,
    refImages: getReferenceImages(image),
    assetId: image.asset_id ?? image.assetId,
    sourceAssetId: image.source_asset_id ?? image.sourceAssetId ?? image.source_asset?.id ?? image.sourceAsset?.id,
    source: 'subject-image',
    assetSource: image.source,
    taskId: image.task_id ?? image.taskId,
    generationId: image.generation_id ?? image.generationId,
    resultIndex: image.result_index ?? image.resultIndex,
    contentHash: image.content_hash ?? image.contentHash,
    detailSource: image.source === 'local-upload' ? 'local-upload' : image.source === 'asset-library' ? 'asset-library' : 'ai-generated',
    prompt: image.prompt,
    inputPrompt: image.input_prompt ?? image.inputPrompt,
    model: image.model,
    size: image.size,
    ratio: image.ratio,
    resolution: image.resolution,
    createdAt: image.created_at ?? image.createdAt,
  }));
}

/** 将主体候选图写接口响应转换为页面候选图状态。 */
export function mapSubjectImageResponse(image) {
  return mapCandidateImages(image ? [image] : [])[0] || null;
}

function getAssetDetailSource(asset) {
  const metadata = typeof asset?.metadata_json === 'string'
    ? (() => { try { return JSON.parse(asset.metadata_json) || {}; } catch { return {}; } })()
    : (asset?.metadata_json || asset?.metadata || {});
  const source = [asset?.source, asset?.source_type, asset?.sourceType, metadata.source, metadata.source_type, metadata.sourceType, metadata.origin, metadata.origin_type, metadata.originType]
    .find((value) => value != null && String(value).trim() !== '');
  const normalized = String(source || '').toLowerCase().replace(/[_\s]/g, '-');
  return normalized.includes('upload') || normalized === 'local' || normalized === 'local-file'
    ? 'local-upload'
    : 'asset-library';
}

function getAssetMetadata(asset) {
  if (typeof asset?.metadata_json === 'object') return asset.metadata_json || {};
  if (typeof asset?.metadata_json === 'string') {
    try { return JSON.parse(asset.metadata_json) || {}; } catch { return {}; }
  }
  return asset?.metadata || {};
}

export function mapSubjectAssets(assets) {
  return (Array.isArray(assets) ? assets : []).map((asset) => {
    const metadata = getAssetMetadata(asset);
    const detailSource = getAssetDetailSource(asset);
    return toImageItem({
      id: asset.id || asset.asset_id || asset.assetId,
      rawUrl: asset.file_url || asset.original_url || asset.originalUrl || asset.url || asset.thumbnail_url || asset.thumbnailUrl,
      settled: asset.is_primary ?? false,
      refImages: detailSource === 'local-upload' ? [] : (asset.refImages?.length > 0 ? asset.refImages : getReferenceImages(metadata)),
      assetId: asset.asset_id ?? asset.assetId ?? asset.id,
      sourceAssetId: asset.source_asset_id
        ?? asset.sourceAssetId
        ?? asset.derived_from_asset_id
        ?? asset.derivedFromAssetId
        ?? asset.source_asset?.id
        ?? asset.sourceAsset?.id
        ?? metadata.source_asset_id
        ?? metadata.sourceAssetId
        ?? metadata.derived_from_asset_id
        ?? metadata.derivedFromAssetId,
      source: 'creation-asset',
      assetSource: asset.source ?? asset.source_type ?? asset.sourceType,
      taskId: asset.task_id ?? asset.taskId,
      generationId: asset.generation_id ?? asset.generationId,
      resultIndex: asset.result_index ?? asset.resultIndex,
      contentHash: asset.content_hash ?? asset.contentHash,
      detailSource,
      prompt: asset.prompt ?? metadata.prompt,
      inputPrompt: asset.input_prompt ?? metadata.input_prompt,
      model: asset.model ?? metadata.model,
      ratio: asset.ratio ?? metadata.ratio,
      resolution: asset.resolution ?? metadata.resolution ?? asset.size,
      createdAt: asset.created_at,
    });
  });
}

export function mapReferenceImages(images, refImages = []) {
  return (Array.isArray(images) ? images : []).map((image) => toImageItem({
    id: image.asset_id,
    rawUrl: image.file_url,
    isReference: true,
    refImages,
  }));
}

export function mapReferenceImageIdsForModal(refImageIds) {
  return (Array.isArray(refImageIds) ? refImageIds : []).map((item) => {
    if (item && typeof item === 'object' && item.url) {
      return { url: normalizeImageUrl(item.url) || item.url, fileUrl: item.url };
    }
    if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('blob') || item.startsWith('/'))) {
      return { url: normalizeImageUrl(item) || item, fileUrl: item };
    }
    return null;
  }).filter(Boolean);
}

function dedupeById(images) {
  const seenIds = new Set();

  return images.filter((image) => {
    if (image.id == null) return true;
    if (seenIds.has(image.id)) return false;
    seenIds.add(image.id);
    return true;
  });
}

function dedupeByAssetId(images) {
  const seenAssetIds = new Set();
  return images.filter((image) => {
    if (image?.assetId == null) return true;
    const assetId = String(image.assetId);
    if (seenAssetIds.has(assetId)) return false;
    seenAssetIds.add(assetId);
    return true;
  });
}

function dedupeByUrl(images) {
  const seenUrls = new Set();
  return images.filter((image) => {
    const url = normalizeImageUrl(image?.rawUrl) || image?.rawUrl;
    if (!url) return true;
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });
}

function keepOnlyFirstSettled(images) {
  let settledSeen = false;

  return images.map((image) => {
    if (image.settled && !settledSeen) {
      settledSeen = true;
      return image;
    }
    return image.settled ? { ...image, settled: false } : image;
  });
}

function mapPendingImage(pending) {
  if (!pending) return null;
  if (pending.status === 'pending') {
    return {
      url: null,
      settled: false,
      id: pending.placeholderId,
      isReference: false,
      created_at: pending.createdAt || Date.now(),
    };
  }
  if (pending.status === 'done') {
    return toImageItem({
      id: pending.realId || pending.placeholderId,
      rawUrl: pending.rawUrl,
      refImages: pending.refImages || [],
      createdAt: pending.createdAt || Date.now(),
    });
  }
  return null;
}

/**
 * 合并主体详情里的候选图和跨弹窗任务缓存。
 * 参考图是生成输入素材，不属于右侧候选结果，因此不能参与合并、定稿或下载。
 * 返回值不修改输入，也不会消费 pending；消费缓存由页面根据 pending 状态负责。
 */
function getImageTimestamp(image) {
  const value = image?.created_at ?? image?.createdAt ?? image?.uploaded_at ?? image?.uploadedAt;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

/**
 * 按图片进入候选列表的时间倒序排列。
 * 没有时间字段的历史数据保持原顺序，避免用 id 或 URL 猜测先后关系。
 */
export function sortSubjectImages(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((image, index) => ({ image, index, timestamp: getImageTimestamp(image) }))
    .sort((a, b) => {
      if (a.timestamp == null && b.timestamp == null) {
        return a.index - b.index;
      }
      if (a.timestamp == null) return 1;
      if (b.timestamp == null) return -1;
      return b.timestamp - a.timestamp || a.index - b.index;
    })
    .map(({ image }) => image);
}

export function mergeSubjectImages({
  candidateImages,
  subjectAssets = [],
  referenceImages = [],
  pending = null,
}) {
  const referenceKeys = buildReferenceKeys(referenceImages);
  // 参考图可能被后端同时以 subject_id 资产返回，也可能被旧接口混入
  // candidate_images。两条情况都必须在候选列表入口过滤。
  const candidateList = (Array.isArray(candidateImages) ? candidateImages : [])
    .filter((image) => !isReferenceImage(image, referenceKeys));
  const assetList = (Array.isArray(subjectAssets) ? subjectAssets : [])
    .filter((asset) => !isReferenceImage(asset, referenceKeys));
  const mappedCandidates = mapCandidateImages(candidateList);
  const mappedAssets = mapSubjectAssets(assetList);
  const images = sortSubjectImages(keepOnlyFirstSettled(
    dedupeByUrl(dedupeById(dedupeByAssetId([...mappedCandidates, ...mappedAssets])))
  ));
  const pendingImage = mapPendingImage(pending);

  return pendingImage ? [pendingImage, ...images] : images;
}

/**
 * 参考图绑定关系可能在候选图/主体资产请求之后才回写到页面。
 * 对已经存在的候选状态重新执行同一套过滤，避免请求时序造成参考图回归。
 */
export function filterSubjectImagesByReferences(images = [], referenceImages = []) {
  const referenceKeys = buildReferenceKeys(referenceImages);
  return (Array.isArray(images) ? images : [])
    .filter((image) => !isReferenceImage(image, referenceKeys));
}
