/**
 * @file creationHistoryAdapter.js
 * @structure-index
 *
 * ─── 列表响应适配 ───────────────────────────────────────────
 *   getCreationHistoryList       兼容数组、list、items 和 data 响应
 *   dedupeCreationHistoryList    按媒体地址去重并优先保留非空创作提示词
 *   normalizeCreationHistoryItem 将历史记录转换为创作页 generation
 *
 * ─── 缓存适配 ───────────────────────────────────────────────
 *   pickCreationHistoryCacheItem 保留缓存所需的轻量字段
 *   buildCreationHistoryCachePayload 保持服务端响应外层结构
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只接收数据并返回新对象；不调用 API、不操作 React 状态、缓存、Toast 或 Store。
 */

import { normalizeImageUrl } from './imageUrl';

export function getCreationHistoryList(response) {
  return Array.isArray(response)
    ? response
    : (response?.list ?? response?.items ?? response?.data ?? []);
}

function getHistoryMediaKey(item, type) {
  const rawUrl = type === 'video'
    ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
    : type === 'audio'
      ? (item.audio_url || item.audioUrl || item.original_url || item.file_url || item.url || '')
      : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
  return normalizeImageUrl(rawUrl) || rawUrl;
}

export function dedupeCreationHistoryList(list, type) {
  const seen = new Map();
  const result = [];
  list.forEach((item) => {
    const mediaKey = getHistoryMediaKey(item, type);
    const key = mediaKey ? `url:${mediaKey}` : item?.id ? `id:${item.id}` : '';
    if (!key) {
      result.push(item);
      return;
    }

    const previousIndex = seen.get(key);
    if (previousIndex === undefined) {
      seen.set(key, result.length);
      result.push(item);
      return;
    }

    // 同一图片存在多条记录时，保留带创作提示词的那条，避免详情弹窗显示空提示词。
    const previous = result[previousIndex];
    const currentPrompt = item?.prompt || item?.input_prompt || item?.inputPrompt || '';
    const previousPrompt = previous?.prompt || previous?.input_prompt || previous?.inputPrompt || '';
    if (!previousPrompt && currentPrompt) result[previousIndex] = item;
  });
  return result;
}

export function normalizeCreationHistoryItem(item, type) {
  // video 优先使用视频地址；图片和音频沿用原图、文件或通用地址。
  const rawUrl = type === 'video'
    ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
    : type === 'image'
      ? (item.preview_url || item.previewUrl || item.reference_frame_url || item.referenceFrameUrl || item.thumbnail_url || item.thumbnailUrl || item.original_url || item.originalUrl || item.file_url || item.fileUrl || item.url || '')
      : (item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
  const url = normalizeImageUrl(rawUrl) || '';
  const rawOriginalUrl = type === 'image'
    ? (item.download_url || item.downloadUrl || item.original_url || item.originalUrl || item.file_url || item.fileUrl || rawUrl)
    : rawUrl;
  const originalUrl = normalizeImageUrl(rawOriginalUrl) || url;
  const rawThumbUrl = type === 'image'
    ? (item.thumbnail_url || item.thumbnailUrl || rawUrl)
    : '';
  const thumbnailUrl = normalizeImageUrl(rawThumbUrl) || url;
  const assetBindings = item.asset_bindings || item.assetBindings || [];

  const refImages = type === 'video'
    ? assetBindings
        .filter((binding) => binding.asset_type === 'image')
        .map((binding) => {
          const imageUrl = binding.preview_url || binding.previewUrl || binding.url || '';
          const normalized = normalizeImageUrl(imageUrl) || imageUrl;
          return {
            url: normalized,
            previewUrl: normalized,
            type: 'image/png',
            isAsset: true,
            name: binding.asset_name || 'ref.png',
            size: 0,
            assetId: binding.asset_id,
          };
        })
    : (item.reference_images || item.referenceImages || []).map((image) => {
        const imageUrl = typeof image === 'string' ? image : (image?.url || image?.original_url || '');
        const normalized = normalizeImageUrl(imageUrl) || imageUrl;
        return {
          url: normalized,
          previewUrl: normalized,
          type: 'image/png',
          isAsset: true,
          name: normalized.split('/').pop() || 'ref.png',
          size: 0,
          assetId: image?.asset_id,
        };
      });

  const refVideos = type === 'video'
    ? assetBindings
        .filter((binding) => binding.asset_type === 'video')
        .map((binding) => {
          const videoUrl = binding.url || '';
          const previewUrl = binding.preview_video_url || binding.previewVideoUrl || binding.preview_url || binding.previewUrl || videoUrl;
          return {
            url: videoUrl,
            previewUrl,
            type: 'video/mp4',
            isAsset: true,
            name: binding.asset_name || 'ref.mp4',
            size: 0,
            duration: binding.duration,
            assetId: binding.asset_id,
          };
        })
    : [];

  const refAudios = type === 'video'
    ? assetBindings
        .filter((binding) => binding.asset_type === 'audio')
        .map((binding) => ({
          url: binding.url || '',
          name: binding.asset_name || 'ref.mp3',
          size: 0,
          duration: binding.duration,
          assetId: binding.asset_id,
        }))
    : [];

  const posterUrl = normalizeImageUrl(item.poster_url || item.posterUrl || '') || undefined;
  const refMode = item.reference_mode || item.referenceMode || undefined;
  const firstFrameUrl = normalizeImageUrl(item.first_frame_url || item.firstFrameUrl || '') || undefined;
  const lastFrameUrl = normalizeImageUrl(item.last_frame_url || item.lastFrameUrl || '') || undefined;
  const needsDetail = type === 'video'
    && (item.has_reference_image || item.has_reference_video || item.has_reference_audio)
    && refImages.length === 0
    && refVideos.length === 0
    && refAudios.length === 0;

  return {
    id: `history-${item.id}`,
    backendId: item.id,
    ratio: item.ratio || item.aspect_ratio || '16:9',
    resolution: item.resolution || item.size || '',
    duration: item.duration || undefined,
    model: item.model || '',
    prompt: item.prompt || '',
    refImages,
    refMode: type === 'video' ? refMode : undefined,
    refVideos: type === 'video' ? refVideos : undefined,
    refAudios: type === 'video' ? refAudios : undefined,
    firstFrameUrl: type === 'video' ? firstFrameUrl : undefined,
    lastFrameUrl: type === 'video' ? lastFrameUrl : undefined,
    createdAt: item.created_at || new Date().toISOString(),
    _needsDetail: needsDetail || undefined,
    cards: [{
      id: item.id,
      assetId: item.asset_id || item.assetId || item.image?.asset_id || item.image?.assetId || null,
      type,
      status: 'done',
      imageUrl: type === 'image' ? url : null,
      originalUrl: type === 'image' ? originalUrl : null,
      thumbnailUrl: type === 'image' ? thumbnailUrl : null,
      videoUrl: type === 'video' ? url : null,
      audioUrl: type === 'audio' ? url : null,
      posterUrl: type === 'video' ? posterUrl : undefined,
      isFavorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
    }],
  };
}

export function pickCreationHistoryCacheItem(item, tab) {
  if (!item || typeof item !== 'object') return item;

  const base = {
    id: item.id,
    prompt: item.prompt || '',
    model: item.model || '',
    ratio: item.ratio || item.aspect_ratio || '16:9',
    resolution: item.resolution || item.size || '',
    duration: item.duration || undefined,
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    is_favorite: item.is_favorite ?? item.is_liked ?? item.isLiked ?? false,
  };

  if (tab === 'image') {
    return {
      ...base,
      preview_url: item.preview_url || item.previewUrl || item.thumbnail_url || item.thumbnailUrl || item.original_url || item.file_url || item.url || '',
      download_url: item.download_url || item.downloadUrl || item.original_url || item.originalUrl || item.file_url || item.url || '',
      original_url: item.original_url || item.file_url || item.url || '',
      thumbnail_url: item.thumbnail_url || item.thumbnailUrl || item.original_url || item.file_url || item.url || '',
      reference_images: Array.isArray(item.reference_images)
        ? item.reference_images.map((image) => (typeof image === 'string'
          ? image
          : { url: image?.url || image?.original_url || '', asset_id: image?.asset_id }))
        : [],
    };
  }

  if (tab === 'video') {
    return {
      ...base,
      video_url: item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '',
      preview_video_url: item.preview_video_url || item.previewVideoUrl || item.video_url || item.videoUrl || '',
      poster_url: item.poster_url || item.posterUrl || '',
      reference_mode: item.reference_mode || item.referenceMode || undefined,
      first_frame_url: item.first_frame_url || item.firstFrameUrl || undefined,
      last_frame_url: item.last_frame_url || item.lastFrameUrl || undefined,
      asset_binding_count: item.asset_binding_count ?? 0,
      asset_binding_types: item.asset_binding_types || [],
      has_reference_image: item.has_reference_image ?? false,
      has_reference_video: item.has_reference_video ?? false,
      has_reference_audio: item.has_reference_audio ?? false,
    };
  }

  return {
    ...base,
    file_url: item.file_url || item.url || item.original_url || '',
  };
}

export function buildCreationHistoryCachePayload(tab, response) {
  const list = getCreationHistoryList(response)
    .map((item) => pickCreationHistoryCacheItem(item, tab));

  if (Array.isArray(response)) return list;
  if (response && typeof response === 'object') {
    if (Array.isArray(response.list)) return { ...response, list };
    if (Array.isArray(response.items)) return { ...response, items: list };
    if (Array.isArray(response.data)) return { ...response, data: list };
  }
  return { list };
}
