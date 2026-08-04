/**
 * @file referenceMediaAdapter.js
 *
 * 主体与分镜参考素材的纯数据适配。
 * 参考素材按业务类型分流，不能与候选媒体共用列表或去重边界。
 *
 * 更新记录：2026-08-03 兼容参考图响应的空数组遮蔽和嵌套资产身份；统一提供候选图过滤键。
 * 更新记录：2026-08-03 兼容 reference_asset/reference_image/resource/source 等嵌套身份。
 */

import { normalizeImageUrl } from './imageUrl';

export const REFERENCE_MEDIA_TYPES = Object.freeze({
  SUBJECT: 'subject',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
});

function readValue(item, keys) {
  for (const key of keys) {
    if (item?.[key] != null && item[key] !== '') return item[key];
  }
  return null;
}

export function getReferenceMediaUrl(item) {
  if (typeof item === 'string') return item;
  return readValue(item, [
    'url', 'fileUrl', 'file_url', 'previewUrl', 'preview_url',
    'originalUrl', 'original_url', 'uploadedUrl', 'uploaded_url',
    'thumbnailUrl', 'thumbnail_url',
  ]);
}

export function getReferenceMediaId(item) {
  if (typeof item === 'string') return item;
  return readValue(item, ['assetId', 'asset_id', 'subjectId', 'subject_id', 'id', 'fileId', 'file_id']);
}

export function getReferenceMediaKey(item) {
  const subjectId = item?.subjectId || item?.subject_id;
  const assetId = item?.assetId || item?.asset_id;
  const url = getReferenceMediaUrl(item);
  if (subjectId) return `subject:${subjectId}`;
  if (assetId) return `asset:${assetId}`;
  if (url) return `url:${normalizeImageUrl(url) || url}`;
  return null;
}

export function normalizeReferenceMedia(item, type = REFERENCE_MEDIA_TYPES.IMAGE) {
  if (!item) return null;
  const rawUrl = getReferenceMediaUrl(item);
  const url = type === REFERENCE_MEDIA_TYPES.IMAGE || type === REFERENCE_MEDIA_TYPES.SUBJECT
    ? (normalizeImageUrl(rawUrl) || rawUrl || null)
    : (rawUrl || null);
  const id = getReferenceMediaId(item) || url;
  if (!id && !url) return null;

  const subjectId = item?.subjectId
    || item?.subject_id
    || (type === REFERENCE_MEDIA_TYPES.SUBJECT || ['char', 'scene', 'prop'].includes(item?.type)
      ? item?.id
      : null);
  const assetId = item?.assetId || item?.asset_id || null;
  return {
    ...item,
    id,
    assetId,
    subjectId,
    url,
    type: item?.type || type,
    name: item?.name || item?.filename || null,
  };
}

export function dedupeReferenceMedia(items = [], type) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeReferenceMedia(item, type))
    .filter((item) => {
      const key = getReferenceMediaKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeSubjectReferenceImages(items = []) {
  return dedupeReferenceMedia(items, REFERENCE_MEDIA_TYPES.IMAGE)
    .map((item) => ({ ...item, source: 'reference' }));
}

/**
 * 读取主体详情/上传响应中的参考图数组。
 * 后端兼容响应可能同时返回顶层空数组和嵌套的真实数组，不能用 `||`
 * 判断数组，否则空数组会遮住后续字段。
 */
export function getSubjectReferenceImagesFromResponse(response) {
  const candidates = [
    response?.reference_images,
    response?.referenceImages,
    response?.reference_image_ids,
    response?.referenceImageIds,
    response?.reference_image_urls,
    response?.referenceImageUrls,
    response?.reference_image,
    response?.referenceImage,
    response?.subject?.reference_images,
    response?.subject?.referenceImages,
    response?.subject?.reference_image_ids,
    response?.subject?.referenceImageIds,
    response?.data?.reference_images,
    response?.data?.referenceImages,
    response?.data?.reference_image_ids,
    response?.data?.referenceImageIds,
    response?.data?.subject?.reference_images,
    response?.data?.subject?.referenceImages,
    response?.data?.subject?.reference_image_ids,
    response?.data?.subject?.referenceImageIds,
    response?.result?.reference_images,
    response?.result?.referenceImages,
    response?.result?.reference_image_ids,
    response?.result?.referenceImageIds,
    response?.result?.subject?.reference_images,
    response?.result?.subject?.referenceImages,
    response?.result?.subject?.reference_image_ids,
    response?.result?.subject?.referenceImageIds,
    response?.images,
  ];
  const nestedCandidates = [];
  const visited = new Set();
  function collectNested(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    Object.entries(value).forEach(([key, child]) => {
      if (/reference|ref_images|refImages/i.test(key) && Array.isArray(child)) {
        nestedCandidates.push(child);
      }
      if (child && typeof child === 'object' && !Array.isArray(child)) collectNested(child);
    });
  }
  collectNested(response);
  return [...candidates, ...nestedCandidates].find((value) => Array.isArray(value) && value.length > 0)
    || [...candidates, ...nestedCandidates].find((value) => Array.isArray(value))
    || [];
}

const REFERENCE_ID_KEYS = ['asset_id', 'assetId', 'file_id', 'fileId', 'image_id', 'imageId', 'id'];
const REFERENCE_URL_KEYS = [
  'file_url', 'fileUrl', 'original_url', 'originalUrl', 'download_url', 'downloadUrl',
  'preview_url', 'previewUrl', 'large_url', 'largeUrl', 'thumbnail_url', 'thumbnailUrl',
  'uploaded_url', 'uploadedUrl', 'url',
];

function collectReferenceImageIdentity(value, ids, urls, visited) {
  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  REFERENCE_ID_KEYS.forEach((key) => {
    if (value[key] != null && value[key] !== '') ids.add(String(value[key]));
  });
  REFERENCE_URL_KEYS.forEach((key) => {
    if (value[key]) urls.add(String(value[key]));
  });
  [
    'asset', 'image', 'file', 'media', 'data', 'result',
    'reference_asset', 'referenceAsset', 'reference_image', 'referenceImage',
    'resource', 'source', 'attachment',
  ].forEach((key) => {
    collectReferenceImageIdentity(value[key], ids, urls, visited);
  });
}

/** 从参考图对象中提取资产身份，兼容接口把资产信息嵌套在 image/asset 下。 */
export function getSubjectReferenceImageIdentities(images = []) {
  const ids = new Set();
  const urls = new Set();
  const visited = new Set();
  (Array.isArray(images) ? images : []).forEach((image) => {
    if (typeof image === 'string') {
      if (/^(https?:|blob:|\/)/i.test(image)) urls.add(image);
      else ids.add(image);
      return;
    }
    collectReferenceImageIdentity(image, ids, urls, visited);
  });
  return { ids: [...ids], urls: [...urls] };
}

/**
 * 将参考图对象的所有常见图片地址归一化为过滤键。
 * 参考图接口有时只返回 asset_id，有时同时返回 image/file 嵌套对象。
 */
export function getSubjectReferenceImageKeys(images = []) {
  const { ids, urls } = getSubjectReferenceImageIdentities(images);
  return {
    ids: new Set(ids.map((id) => String(id))),
    urls: new Set(urls.map((url) => normalizeImageUrl(url) || String(url))),
  };
}

export function normalizeStoryboardReferenceGroups({ subjects = [], images = [], videos = [], audios = [] } = {}) {
  return {
    subjects: dedupeReferenceMedia(subjects, REFERENCE_MEDIA_TYPES.SUBJECT),
    images: dedupeReferenceMedia(images, REFERENCE_MEDIA_TYPES.IMAGE),
    videos: dedupeReferenceMedia(videos, REFERENCE_MEDIA_TYPES.VIDEO),
    audios: dedupeReferenceMedia(audios, REFERENCE_MEDIA_TYPES.AUDIO),
  };
}
