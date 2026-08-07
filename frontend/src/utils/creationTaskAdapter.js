/**
 * @file creationTaskAdapter.js
 * @structure-index
 *
 * ─── 刷新恢复任务适配 ───────────────────────────────────────
 *   normalizeCreationPendingTask  校验并标准化 localStorage 任务快照
 *   createCreationTaskPlaceholder 生成恢复中的占位 generation
 *   createCreationTaskResult      将轮询结果转换为完成的 generation
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只接收任务快照和轮询结果并返回新对象；不调用 API、Store、缓存、Toast 或 React 状态。
 */

import { normalizeImageUrl } from './imageUrl';

export function getCreationTaskType(genType) {
  return genType === 'dubbing' ? 'audio' : genType || 'image';
}

function getCreationCardType(genType) {
  return genType === 'video' ? 'video' : genType === 'dubbing' ? 'audio' : 'image';
}

function getCreationTaskTab(task) {
  return task.tab || (task.genType === 'dubbing' ? 'dubbing' : task.genType || 'image');
}

function getResultUrl(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value.preview_url
    || value.previewUrl
    || value.reference_frame_url
    || value.referenceFrameUrl
    || value.thumbnail_url
    || value.thumbnailUrl
    || value.url
    || value.original_url
    || value.originalUrl
    || value.file_url
    || value.fileUrl
    || '';
}

function getImageDownloadUrl(value, fallback) {
  if (!value || typeof value !== 'object') return fallback;
  return value.download_url || value.downloadUrl || value.original_url || value.originalUrl || fallback;
}

function normalizeReferenceImage(value) {
  const rawUrl = getResultUrl(value);
  const url = normalizeImageUrl(rawUrl) || rawUrl;
  return {
    url,
    previewUrl: url,
    isAsset: true,
    name: value?.name || value?.asset_name || url.split('/').pop() || 'ref.png',
    size: 0,
    assetId: value?.asset_id || value?.assetId,
  };
}

export function normalizeCreationPendingTask(task) {
  if (!task || typeof task !== 'object' || !task.taskId || !task.genId) return null;

  const genType = task.genType === 'video' || task.genType === 'dubbing' ? task.genType : 'image';
  const count = Math.max(1, parseInt(task.count, 10) || 1);

  return {
    ...task,
    taskId: task.taskId,
    genId: task.genId,
    shotId: task.shotId || null,
    tab: getCreationTaskTab({ ...task, genType }),
    genType,
    count,
    prompt: task.prompt || '',
    promptHTML: task.promptHTML || '',
    model: task.model || '',
    ratio: task.ratio || '16:9',
    resolution: task.resolution || '',
    duration: task.duration || undefined,
    createdAt: task.createdAt || new Date().toISOString(),
    refVideos: Array.isArray(task.refVideos) ? task.refVideos : [],
    refAudios: Array.isArray(task.refAudios) ? task.refAudios : [],
  };
}

export function createCreationTaskPlaceholder(task) {
  const cardType = getCreationCardType(task.genType);
  const cardCount = task.genType === 'video' || task.genType === 'dubbing' ? 1 : task.count;

  return {
    id: task.genId,
    shot_id: task.shotId || undefined,
    ratio: task.ratio,
    resolution: task.resolution,
    duration: task.duration,
    model: task.model,
    prompt: task.prompt,
    promptHTML: task.promptHTML,
    refImages: [],
    refVideos: task.refVideos,
    refAudios: task.refAudios,
    createdAt: task.createdAt,
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: null,
      type: cardType,
      status: 'loading',
      imageUrl: null,
      videoUrl: null,
      audioUrl: null,
      placeholderId: `restored-${task.genId}-${index}`,
    })),
  };
}

export function normalizeCreationTaskResult(result, task) {
  const cardType = getCreationCardType(task.genType);
  const rawMedia = task.genType === 'video'
    ? (result?.videos || [])
    : task.genType === 'dubbing'
      ? (result?.audios || [])
      : (result?.images || []);
  const mediaUrls = rawMedia.map((value) => {
    const rawUrl = getResultUrl(value);
    return normalizeImageUrl(rawUrl) || rawUrl;
  }).filter(Boolean);
  const cardIds = task.genType === 'dubbing' ? [] : (result?.cardIds || []);
  const refImages = task.genType === 'video'
    ? []
    : (result?.referenceImages || []).map(normalizeReferenceImage).filter((item) => item.url);

  return {
    mediaUrls,
    cardIds,
    generation: {
      id: task.genId,
      shot_id: task.shotId || undefined,
      ratio: task.ratio,
      resolution: task.resolution,
      duration: task.duration,
      model: task.model,
      prompt: task.prompt,
      promptHTML: task.promptHTML,
      refImages,
      refVideos: task.refVideos,
      refAudios: task.refAudios,
      createdAt: task.createdAt,
      cards: mediaUrls.map((url, index) => ({
        id: task.genType === 'dubbing' ? (result?.audioIds?.[index] || null) : null,
        type: cardType,
        status: 'done',
        imageUrl: task.genType === 'image' ? url : null,
        originalUrl: task.genType === 'image'
          ? (result?.imageDownloadUrls?.[index] || getImageDownloadUrl(rawMedia[index], url) || url)
          : undefined,
        videoUrl: task.genType === 'video' ? url : null,
        audioUrl: task.genType === 'dubbing' ? url : null,
        audioId: task.genType === 'dubbing' ? (result?.audioIds?.[index] || null) : undefined,
      })),
    },
  };
}
