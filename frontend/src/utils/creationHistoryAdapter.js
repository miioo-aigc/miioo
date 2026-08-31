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
import { normalizeCreationVideoDetailMedia, toCreationRefMode } from './creationDetailAdapter';

export function getCreationHistoryList(response) {
  return Array.isArray(response)
    ? response
    : (response?.list ?? response?.items ?? response?.data ?? []);
}

function normalizeMediaAlias(value) {
  if (!value || typeof value !== 'string') return '';
  return normalizeImageUrl(value) || value;
}

export function getCreationMediaAliases(item, type) {
  const values = type === 'video'
    ? [item.video_url, item.videoUrl, item.preview_video_url, item.previewVideoUrl, item.preview_url, item.previewUrl, item.original_url, item.originalUrl, item.file_url, item.fileUrl, item.url, item.thumbnail_url, item.thumbnailUrl]
    : type === 'audio'
      ? [item.audio_url, item.audioUrl, item.original_url, item.originalUrl, item.file_url, item.fileUrl, item.url]
      : [item.preview_url, item.previewUrl, item.reference_frame_url, item.referenceFrameUrl, item.original_url, item.originalUrl, item.download_url, item.downloadUrl, item.thumbnail_url, item.thumbnailUrl, item.file_url, item.fileUrl, item.url];
  return [...new Set(values.map(normalizeMediaAlias).filter(Boolean))];
}

export function getCreationAssetMediaAliases(asset) {
  return [...new Set([
    asset?.url,
    asset?.originalUrl,
    asset?.original_url,
    asset?.downloadUrl,
    asset?.download_url,
    asset?.fileUrl,
    asset?.file_url,
    asset?.previewUrl,
    asset?.preview_url,
    asset?.thumbnailUrl,
    asset?.thumbnail_url,
    asset?.posterUrl,
    asset?.poster_url,
  ].map(normalizeMediaAlias).filter(Boolean))];
}

export function dedupeByMediaAliases(list, getAliases, mergeItem = (previous) => previous) {
  const result = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const aliases = getAliases(item);
    const matchingIndexes = new Set();
    result.forEach((existingItem, index) => {
      const existingAliases = getAliases(existingItem);
      if (aliases.some((alias) => existingAliases.includes(alias))) matchingIndexes.add(index);
    });

    if (matchingIndexes.size === 0) {
      result.push(item);
      return;
    }

    // 合并所有相交记录，而不是只合并到第一条命中的记录，避免出现
    // A.preview_url = B.original_url、B.preview_url = C.original_url
    // 这类别名链把同一媒体拆成两条结果。
    const indexes = [...matchingIndexes].sort((a, b) => a - b);
    const targetIndex = indexes[0];
    let merged = result[targetIndex];
    indexes.slice(1).forEach((index) => {
      merged = mergeItem(merged, result[index]);
    });
    merged = mergeItem(merged, item);
    result[targetIndex] = merged;
    indexes.slice(1).reverse().forEach((index) => result.splice(index, 1));
  });
  return result;
}

export function dedupeCreationHistoryList(list, type) {
  return dedupeByMediaAliases(list, (item) => getCreationMediaAliases(item, type), (previous, current) => ({
    ...previous,
    ...current,
    id: previous?.id || current?.id,
    asset_id: previous?.asset_id || previous?.assetId || current?.asset_id || current?.assetId,
    prompt: previous?.prompt || previous?.input_prompt || previous?.inputPrompt ? (previous.prompt || previous.input_prompt || previous.inputPrompt) : (current?.prompt || current?.input_prompt || current?.inputPrompt || ''),
    input_prompt: previous?.input_prompt || previous?.inputPrompt || current?.input_prompt || current?.inputPrompt || '',
    metadata_json: previous?.metadata_json || current?.metadata_json,
  }));
}

export function normalizeCreationHistoryItem(item, type) {
  const metadata = item.metadata_json || item.metadata || {};
  // video 优先使用视频地址；图片和音频沿用原图、文件或通用地址。
  const rawUrl = type === 'video'
    ? (item.video_url || item.videoUrl || item.preview_video_url || item.previewVideoUrl || item.original_url || item.file_url || item.url || '')
    : type === 'image'
      ? (item.preview_url || item.previewUrl || item.reference_frame_url || item.referenceFrameUrl || item.thumbnail_url || item.thumbnailUrl || item.original_url || item.originalUrl || item.file_url || item.fileUrl || item.url || '')
      : (item.audio_url || item.audioUrl || item.original_url || item.file_url || item.url || item.thumbnail_url || item.thumbnailUrl || '');
  const url = normalizeImageUrl(rawUrl) || '';
  const rawOriginalUrl = type === 'image'
    ? (item.download_url || item.downloadUrl || item.original_url || item.originalUrl || item.file_url || item.fileUrl || rawUrl)
    : rawUrl;
  const originalUrl = normalizeImageUrl(rawOriginalUrl) || url;
  const rawThumbUrl = type === 'image'
    ? (item.thumbnail_url || item.thumbnailUrl || rawUrl)
    : '';
  const thumbnailUrl = normalizeImageUrl(rawThumbUrl) || url;
  const detailMedia = type === 'video'
    ? normalizeCreationVideoDetailMedia(item)
    : { refImages: [], refVideos: [], refAudios: [] };

  const refImages = type === 'video'
    ? detailMedia.refImages
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
    ? detailMedia.refVideos
    : [];

  const refAudios = type === 'video'
    ? detailMedia.refAudios
    : [];

  const posterUrl = normalizeImageUrl(
    item.poster_url || item.posterUrl || item.thumbnail_url || item.thumbnailUrl || '',
  ) || undefined;
  const generationMode = item.generation_mode || item.generationMode || undefined;
  const refMode = type === 'video'
    ? toCreationRefMode(generationMode || item.reference_mode || item.referenceMode)
    : undefined;
  const refModeLabel = type === 'video'
    ? (item.reference_mode_label || item.referenceModeLabel || metadata.reference_mode_label || metadata.referenceModeLabel || undefined)
    : undefined;
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
    voiceName: item.voice_name || item.voiceName || metadata.voice_name || metadata.voiceName || '',
    voiceId: item.voice_id || item.voiceId || metadata.voice_id || metadata.voiceId || '',
    voiceSource: item.voice_source || item.voiceSource || metadata.voice_source || metadata.voiceSource || '',
    speed: item.speed ?? metadata.speed,
    pitch: item.pitch ?? metadata.pitch,
    volume: item.volume ?? metadata.volume,
    advancedEnabled: item.advanced_mode_enabled
      ?? item.advanced_enabled
      ?? item.advancedEnabled
      ?? metadata.advanced_mode_enabled
      ?? metadata.advanced_enabled
      ?? metadata.advancedEnabled,
    prompt: item.prompt || '',
    refImages,
    refMode,
    refModeLabel,
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
      audioId: type === 'audio' ? (item.id || item.audio_id || item.audioId || null) : undefined,
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
    voice_name: item.voice_name || item.voiceName || '',
    voice_id: item.voice_id || item.voiceId || item.metadata_json?.voice_id || item.metadata_json?.voiceId || item.metadata?.voice_id || item.metadata?.voiceId || '',
    voice_source: item.voice_source || item.voiceSource || '',
    speed: item.speed,
    pitch: item.pitch,
    volume: item.volume,
    advanced_mode_enabled: item.advanced_mode_enabled
      ?? item.advanced_enabled
      ?? item.advancedEnabled
      ?? item.metadata_json?.advanced_mode_enabled
      ?? item.metadata_json?.advanced_enabled
      ?? item.metadata_json?.advancedEnabled
      ?? item.metadata?.advanced_mode_enabled
      ?? item.metadata?.advanced_enabled
      ?? item.metadata?.advancedEnabled,
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
      poster_url: item.poster_url || item.posterUrl || item.thumbnail_url || item.thumbnailUrl || '',
      thumbnail_url: item.thumbnail_url || item.thumbnailUrl || item.poster_url || item.posterUrl || '',
      reference_mode: item.reference_mode || item.referenceMode || undefined,
      reference_mode_label: item.reference_mode_label || item.referenceModeLabel || undefined,
      generation_mode: item.generation_mode || item.generationMode || undefined,
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
    audio_url: item.audio_url || item.audioUrl || item.file_url || item.url || item.original_url || '',
    metadata_json: item.metadata_json || item.metadata || undefined,
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
