/**
 * @file SubjectImageMappers.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   mapCandidateImages       将后端候选图转换为右侧图片列表数据
 *   mapReferenceImages       将后端参考图转换为详情/预览数据（不进入候选列表）
 *   mapReferenceImageIdsForModal  将参考图 ID/URL 转为详情弹窗快照
 *   mergeSubjectImages       去重、限制定稿图数量并插入任务占位/结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   仅依赖图片 URL 归一化工具；不引用 React、页面、API、Store 或 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 抽离主体详情图片的纯数据转换逻辑
 *   2026-07-22  参考图与候选图彻底分流，主体右侧列表只展示候选结果
 */
import { normalizeImageUrl } from '../../utils/imageUrl';

function toImageItem({ id, rawUrl, settled = false, isReference = false, refImages = [] }) {
  return {
    id,
    rawUrl,
    url: normalizeImageUrl(rawUrl),
    settled,
    isReference,
    refImages,
  };
}

/**
 * 创建生成结果的前端图片条目，统一保留原始 URL 和展示 URL。
 */
export function createSubjectImageItem({ id, rawUrl, settled = false, refImages = [] }) {
  return toImageItem({ id, rawUrl, settled, refImages });
}

export function mapCandidateImages(images, refImages = []) {
  return (Array.isArray(images) ? images : []).map((image) => toImageItem({
    id: image.id,
    rawUrl: image.image_url,
    settled: image.is_primary ?? false,
    refImages,
  }));
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

function mapPendingImage(pending, refImages) {
  if (!pending) return null;
  if (pending.status === 'pending') {
    return {
      url: null,
      settled: false,
      id: pending.placeholderId,
      isReference: false,
    };
  }
  if (pending.status === 'done') {
    return toImageItem({
      id: pending.realId || pending.placeholderId,
      rawUrl: pending.rawUrl,
      refImages: pending.refImages || refImages,
    });
  }
  return null;
}

/**
 * 合并主体详情里的候选图和跨弹窗任务缓存。
 * 参考图是生成输入素材，不属于右侧候选结果，因此不能参与合并、定稿或下载。
 * 返回值不修改输入，也不会消费 pending；消费缓存由页面根据 pending 状态负责。
 */
export function mergeSubjectImages({
  candidateImages,
  refImages = [],
  pending = null,
}) {
  const mappedCandidates = mapCandidateImages(candidateImages, refImages);
  const images = keepOnlyFirstSettled(dedupeById(mappedCandidates));
  const pendingImage = mapPendingImage(pending, refImages);

  return pendingImage ? [pendingImage, ...images] : images;
}
