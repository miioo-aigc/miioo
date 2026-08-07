/**
 * 分镜媒体结果的身份匹配与合并工具。
 *
 * 生成结果可能先使用前端临时 ID，保存候选后又返回后端正式 ID。
 * 因此不能只比较 id；只要任一稳定 ID 或媒体地址相同，就视为同一条结果。
 */

const MEDIA_ID_FIELDS = [
  'id',
  'uuid',
  'assetId',
  'asset_id',
  'mediaId',
  'media_id',
  'candidateId',
  'candidate_id',
  'mediaCandidateId',
  'media_candidate_id',
  'fileId',
  'file_id',
  'videoAssetId',
  'video_asset_id',
  'imageAssetId',
  'image_asset_id',
];
const MEDIA_URL_FIELDS = [
  'url',
  'fileUrl',
  'file_url',
  'videoUrl',
  'video_url',
  'downloadUrl',
  'download_url',
  'previewVideoUrl',
  'preview_video_url',
];

function normalizeIdentityValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function isTemporaryMediaId(value) {
  return /^(?:pending|vid|img|temp|local)-/i.test(value);
}

function getMediaUrlIdentityKeys(value) {
  const normalized = normalizeIdentityValue(value);
  if (!normalized) return [];

  const keys = [`url:${normalized}`];
  try {
    const parsed = new URL(normalized, 'http://storyboard-media.local');
    const pathname = parsed.pathname.replace(/\/+$|^([^/])/, '$1');
    // 后端上传地址可能在一次响应中是相对路径、另一次是绝对路径；
    // 对 /uploads/ 媒体使用路径身份，避免域名/协议差异绕过去重。
    if (pathname.startsWith('/uploads/')) {
      keys.push(`path:${pathname}${parsed.search}`);
    }
  } catch {
    // 非标准媒体地址仍保留原始字符串身份。
  }
  return keys;
}

export function getStoryboardMediaIdentityKeys(media) {
  if (!media || typeof media !== 'object') return [];

  const keys = [];
  MEDIA_ID_FIELDS.forEach((field) => {
    const value = normalizeIdentityValue(media[field]);
    if (value && !isTemporaryMediaId(value)) keys.push(`id:${value}`);
  });
  MEDIA_URL_FIELDS.forEach((field) => {
    keys.push(...getMediaUrlIdentityKeys(media[field]));
  });
  return [...new Set(keys)];
}

export function areStoryboardMediaSame(first, second) {
  if (!first || !second) return false;
  const secondKeys = new Set(getStoryboardMediaIdentityKeys(second));
  return getStoryboardMediaIdentityKeys(first).some((key) => secondKeys.has(key));
}

/**
 * 按原有顺序合并两组媒体。后来的对象覆盖同一媒体的旧对象，
 * 以便正式候选 ID 和服务端补全字段替换前端临时结果。
 */
export function mergeStoryboardMediaItems(previous = [], incoming = []) {
  const merged = [];

  const upsert = (item) => {
    if (!item || typeof item !== 'object') return;
    const matchingIndexes = merged
      .map((candidate, index) => (areStoryboardMediaSame(candidate, item) ? index : -1))
      .filter((index) => index >= 0);
    if (matchingIndexes.length === 0) {
      merged.push(item);
      return;
    }

    const existingIndex = matchingIndexes[0];
    const combined = matchingIndexes.reduce(
      (result, index) => ({ ...result, ...merged[index] }),
      {},
    );
    const next = { ...combined, ...item };
    if (item.pending !== true && next.pending) delete next.pending;
    merged[existingIndex] = next;
    matchingIndexes.slice(1).reverse().forEach((index) => merged.splice(index, 1));
  };

  previous.forEach(upsert);
  incoming.forEach(upsert);
  return merged;
}
