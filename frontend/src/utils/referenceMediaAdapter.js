/**
 * @file referenceMediaAdapter.js
 *
 * 主体与分镜参考素材的纯数据适配。
 * 参考素材按业务类型分流，不能与候选媒体共用列表或去重边界。
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

export function normalizeStoryboardReferenceGroups({ subjects = [], images = [], videos = [], audios = [] } = {}) {
  return {
    subjects: dedupeReferenceMedia(subjects, REFERENCE_MEDIA_TYPES.SUBJECT),
    images: dedupeReferenceMedia(images, REFERENCE_MEDIA_TYPES.IMAGE),
    videos: dedupeReferenceMedia(videos, REFERENCE_MEDIA_TYPES.VIDEO),
    audios: dedupeReferenceMedia(audios, REFERENCE_MEDIA_TYPES.AUDIO),
  };
}
