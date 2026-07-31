/**
 * @file SubjectImageMappers.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   mapCandidateImages       将后端候选图转换为右侧图片列表数据
 *   mapSubjectAssets          将绑定主体的项目资产转换为右侧候选图
 *   mapReferenceImages       将后端参考图转换为详情/预览数据（不进入候选列表）
 *   mapReferenceImageIdsForModal  将参考图 ID/URL 转为详情弹窗快照
 *   sortSubjectImages        按进入候选列表时间倒序排列
 *   mergeSubjectImages       去重、限制定稿图数量并插入任务占位/结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖图片 URL 归一化工具；不引用 React、页面、API、Store 或 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体详情图片的纯数据转换逻辑
 *   2026-07-22  参考图与候选图彻底分流，主体右侧列表只展示候选结果
 *   2026-07-28  合并读取绑定主体的项目资产，支持候选区上传和资产库选择刷新恢复
 *   2026-07-28  保留候选图来源及资产创作元数据，供详情弹窗按来源展示
 *   2026-07-28  候选图统一按创建/上传时间倒序排列，最新进入列表的图片置顶
 *   2026-07-31  参考图改为按候选图片自身原数据映射，不再回退到主体当前参考图
 */
import { normalizeImageUrl } from '../../utils/imageUrl';

function getReferenceImages(value) {
  const raw = Array.isArray(value?.reference_image_urls) ? value.reference_image_urls
    : Array.isArray(value?.referenceImages) ? value.referenceImages
      : Array.isArray(value?.reference_images) ? value.reference_images
        : Array.isArray(value?.refImages) ? value.refImages
          : Array.isArray(value?.ref_images) ? value.ref_images
            : [];
  return raw.map((ref) => {
    if (typeof ref === 'string') return { url: normalizeImageUrl(ref) || ref };
    const url = ref?.url || ref?.file_url || ref?.fileUrl || ref?.image_url || ref?.imageUrl;
    return url ? { ...ref, url: normalizeImageUrl(url) || url } : null;
  }).filter((ref) => ref?.url);
}

function toImageItem({ id, rawUrl, settled = false, isReference = false, refImages = [], assetId = null, source = null, detailSource = null, prompt = null, inputPrompt = null, model = null, ratio = null, resolution = null, createdAt = null }) {
  return {
    id,
    rawUrl,
    url: normalizeImageUrl(rawUrl),
    settled,
    isReference,
    refImages,
    ...(assetId ? { assetId } : {}),
    ...(source ? { source } : {}),
    ...(detailSource ? { detailSource } : {}),
    ...(prompt != null ? { prompt } : {}),
    ...(inputPrompt != null ? { input_prompt: inputPrompt } : {}),
    ...(model != null ? { model } : {}),
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
    rawUrl: image.image_url,
    settled: image.is_primary ?? false,
    refImages: getReferenceImages(image),
    assetId: image.asset_id,
    source: 'subject-image',
    detailSource: 'ai-generated',
    prompt: image.prompt,
    inputPrompt: image.input_prompt,
    model: image.model,
    ratio: image.ratio,
    resolution: image.resolution,
    createdAt: image.created_at,
  }));
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
      id: asset.id || asset.asset_id,
      rawUrl: asset.file_url || asset.original_url || asset.originalUrl || asset.url || asset.thumbnail_url || asset.thumbnailUrl,
      settled: asset.is_primary ?? false,
      refImages: detailSource === 'local-upload' ? [] : (asset.refImages?.length > 0 ? asset.refImages : getReferenceImages(metadata)),
      assetId: asset.id || asset.asset_id,
      source: 'creation-asset',
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
  pending = null,
}) {
  const mappedCandidates = mapCandidateImages(candidateImages);
  const mappedAssets = mapSubjectAssets(subjectAssets);
  const images = sortSubjectImages(keepOnlyFirstSettled(dedupeByUrl(dedupeById([...mappedCandidates, ...mappedAssets]))));
  const pendingImage = mapPendingImage(pending);

  return pendingImage ? [pendingImage, ...images] : images;
}
