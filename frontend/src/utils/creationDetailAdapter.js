/**
 * @file creationDetailAdapter.js
 * @structure-index
 *
 * ─── 视频详情适配 ─────────────────────────────────────────
 *   normalizeCreationVideoDetailMedia 将详情中的 asset_bindings 转为结果弹窗素材
 *   mergeCreationVideoDetail 将详情字段合并到已打开的轻量卡片
 *
 * ─── 依赖边界 ─────────────────────────────────────────────
 *   只接收详情数据并返回新对象；不调用 API、Store、缓存或 React 状态。
 */

import { normalizeImageUrl } from './imageUrl';

function bindingUrl(binding, ...keys) {
  for (const key of keys) {
    if (binding?.[key]) return binding[key];
  }
  return '';
}

function getBindingType(binding) {
  return binding?.asset_type || binding?.assetType || '';
}

function getBindingIdentityValues(binding) {
  return [
    binding?.asset_id,
    binding?.assetId,
    binding?.id,
    bindingUrl(binding, 'url', 'original_url', 'originalUrl', 'file_url', 'fileUrl'),
    bindingUrl(binding, 'preview_url', 'previewUrl', 'preview_video_url', 'previewVideoUrl'),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function getBindingSemanticIdentity(binding) {
  const type = getBindingType(binding);
  const role = String(binding?.role || binding?.assetRole || '').trim();
  return type === 'audio' && role === 'reference_audio'
    ? `role:${type}:${role}`
    : '';
}

// 资产库选择的素材可能同时以不同绑定记录返回，详情展示只应保留一个媒体实体。
export function dedupeCreationAssetBindings(bindings) {
  const result = [];
  const identityIndexes = new Map();
  const semanticIndexes = new Map();
  (Array.isArray(bindings) ? bindings : []).forEach((binding) => {
    if (!binding || !getBindingType(binding)) return;
    const identities = getBindingIdentityValues(binding);
    const semanticIdentity = getBindingSemanticIdentity(binding);
    const semanticIndex = semanticIdentity ? semanticIndexes.get(semanticIdentity) : undefined;
    if (semanticIndex !== undefined) {
      // 同一参考角色只保留首条记录，避免后端同时返回附件和补充绑定。
      result[semanticIndex] = Object.keys(binding).reduce(
        (merged, key) => ({ ...merged, ...(merged[key] == null || merged[key] === '' ? { [key]: binding[key] } : {}) }),
        result[semanticIndex],
      );
      return;
    }
    const matchingIndexes = [...new Set(identities
      .map((identity) => identityIndexes.get(identity))
      .filter((index) => index !== undefined))].sort((a, b) => a - b);
    if (matchingIndexes.length === 0) {
      result.push(binding);
      const index = result.length - 1;
      identities.forEach((identity) => identityIndexes.set(identity, index));
      if (semanticIdentity) semanticIndexes.set(semanticIdentity, index);
      return;
    }

    const targetIndex = matchingIndexes[0];
    let merged = result[targetIndex];
    matchingIndexes.slice(1).forEach((index) => {
      merged = { ...merged, ...result[index] };
    });
    merged = { ...merged, ...binding };
    result[targetIndex] = merged;
    matchingIndexes.slice(1).reverse().forEach((index) => result.splice(index, 1));
    identityIndexes.clear();
    semanticIndexes.clear();
    result.forEach((item, index) => {
      getBindingIdentityValues(item).forEach((identity) => identityIndexes.set(identity, index));
      const itemSemanticIdentity = getBindingSemanticIdentity(item);
      if (itemSemanticIdentity) semanticIndexes.set(itemSemanticIdentity, index);
    });
  });
  return result;
}

function readReferenceModeLabel(detail) {
  const metadata = detail?.metadata_json || detail?.metadataJson || detail?.metadata || {};
  const parsedMetadata = typeof metadata === 'string'
    ? (() => { try { return JSON.parse(metadata); } catch { return {}; } })()
    : metadata;
  const containers = [
    detail, parsedMetadata,
    detail?.params, detail?.gen_params, detail?.genParams, detail?.generation_params, detail?.generationParams,
    parsedMetadata?.params, parsedMetadata?.gen_params, parsedMetadata?.genParams,
    parsedMetadata?.generation_params, parsedMetadata?.generationParams,
  ];
  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    const label = container.reference_mode_label || container.referenceModeLabel;
    if (String(label || '').trim()) return label;
  }
  return '';
}

export function normalizeCreationVideoDetailMedia(detail, { preferOriginalImageUrl = false } = {}) {
  const bindings = dedupeCreationAssetBindings(detail?.asset_bindings || detail?.assetBindings || []);
  const refImages = bindings
    .filter((binding) => getBindingType(binding) === 'image')
    .map((binding) => {
      const rawUrl = preferOriginalImageUrl
        ? bindingUrl(binding, 'url', 'preview_url', 'previewUrl')
        : bindingUrl(binding, 'preview_url', 'previewUrl', 'url');
      const url = normalizeImageUrl(rawUrl) || rawUrl;
      return {
        url,
        previewUrl: url,
        type: 'image/png',
        isAsset: true,
        name: binding.asset_name || 'ref.png',
        size: 0,
        assetId: binding.asset_id || binding.assetId || binding.id,
        role: binding.role || binding.assetRole || '',
      };
    });

  const refVideos = bindings
    .filter((binding) => getBindingType(binding) === 'video')
    .map((binding) => {
      const url = bindingUrl(binding, 'url');
      const previewUrl = bindingUrl(
        binding,
        'preview_video_url',
        'previewVideoUrl',
        'preview_url',
        'previewUrl',
        'url',
      );
      return {
        url,
        previewUrl,
        type: 'video/mp4',
        isAsset: true,
        name: binding.asset_name || 'ref.mp4',
        size: 0,
        duration: binding.duration,
        assetId: binding.asset_id || binding.assetId || binding.id,
      };
    });

  const refAudios = bindings
    .filter((binding) => getBindingType(binding) === 'audio')
    .map((binding) => ({
      url: bindingUrl(binding, 'url'),
      name: binding.asset_name || 'ref.mp3',
      size: 0,
      duration: binding.duration,
      assetId: binding.asset_id || binding.assetId || binding.id,
    }));

  return { refImages, refVideos, refAudios };
}

export function mergeCreationVideoDetail(card, detail) {
  if (!card) return card;
  const media = normalizeCreationVideoDetailMedia(detail);
  const videoUrl = normalizeImageUrl(
    detail?.video_url
      || detail?.videoUrl
      || detail?.original_url
      || detail?.originalUrl
      || card.videoUrl
      || detail?.preview_video_url
      || detail?.previewVideoUrl,
  ) || card.videoUrl;
  const posterUrl = normalizeImageUrl(
    detail?.poster_url
      || detail?.posterUrl
      || detail?.thumbnail_url
      || detail?.thumbnailUrl
      || card.posterUrl,
  ) || card.posterUrl;
  return {
    ...card,
    ...media,
    videoUrl,
    posterUrl,
    promptHTML: detail?.prompt_raw || detail?.promptResolved || card.promptHTML,
    refModeLabel: readReferenceModeLabel(detail) || card.refModeLabel,
  };
}

// multiframe 仅用于历史详情回填为当前首尾帧输入，不代表当前模型能力或新请求参数。
const FRAME_REFERENCE_MODES = new Set(['first_frame', 'last_frame', 'start_end', 'multiframe']);

export function toCreationRefMode(value) {
  if (value === 'frame' || value === 'all') return value;
  return FRAME_REFERENCE_MODES.has(value) ? 'frame' : 'all';
}

function toPrefillAsset(item, type, defaults) {
  return {
    name: item.name || defaults.name,
    url: item.url || item.previewUrl || '',
    previewUrl: item.url || item.previewUrl || '',
    type,
    isAsset: true,
    size: 0,
  };
}

export function buildCreationVideoReeditPrefill(card, media) {
  const refMode = toCreationRefMode(card.refMode);
  const refImages = media.refImages || [];
  const refVideos = media.refVideos || [];
  const refAudios = media.refAudios || [];

  return {
    prompt: card.prompt,
    promptHTML: card.promptHTML || '',
    files: refMode === 'frame' ? [] : [
      ...refImages.filter((item) => !item.isLiveMaterial).map((item) => toPrefillAsset(item, 'image/png', { name: 'ref.png' })),
      ...refImages.filter((item) => item.isLiveMaterial).map((item) => ({
        isAsset: true,
        isLiveMaterial: true,
        assetId: item.assetId,
        groupId: item.groupId,
        groupType: item.groupType,
        assetRefUrl: item.assetRefUrl,
        url: item.previewUrl || item.url || '',
        previewUrl: item.previewUrl || item.url || '',
        name: item.name || '真人素材',
        type: 'image/jpeg',
        size: 0,
      })),
      ...refVideos.map((item) => toPrefillAsset(item, 'video/mp4', { name: 'ref.mp4' })),
      ...refAudios.map((item) => toPrefillAsset(item, 'audio/mpeg', { name: 'ref.mp3' })),
    ],
    ratio: card.ratio,
    resolution: card.resolution,
    duration: card.duration,
    refMode,
    firstFrameFile: card.firstFrameUrl
      ? { url: card.firstFrameUrl, previewUrl: card.firstFrameUrl, name: 'first-frame.png', size: 0 }
      : undefined,
    lastFrameFile: card.lastFrameUrl
      ? { url: card.lastFrameUrl, previewUrl: card.lastFrameUrl, name: 'last-frame.png', size: 0 }
      : undefined,
  };
}

export function buildCreationImageReeditPrefill(card) {
  return {
    prompt: card.prompt,
    promptHTML: card.promptHTML || '',
    files: (card.refImages || []).map((item) => toPrefillAsset(item, 'image/png', { name: 'ref.png' })),
    ratio: card.ratio,
    resolution: card.resolution,
    count: undefined,
  };
}

export function buildCreationImageReferencePrefill(card) {
  const promptName = (card.prompt || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '')
    .trim()
    .slice(0, 10)
    .trim() || 'creation';
  return {
    appendFiles: [{
      name: `${promptName}.png`,
      url: card.imageUrl,
      previewUrl: card.imageUrl,
      assetId: card.assetId || card.id || undefined,
      isAsset: true,
      size: 0,
    }],
  };
}

export function createCreationFirstFramePrefill(frameBlob, frameUrl = '') {
  const firstFrameFile = new File([frameBlob], 'last-frame.png', { type: 'image/png' });
  // 首帧上传槽位使用 url/previewUrl 渲染；仅有 File 时虽然能提交，界面不会显示预览。
  // useCreationInputFiles 会在状态归一化时展开文件对象，字段必须可枚举才能保留下来。
  Object.defineProperty(firstFrameFile, 'url', {
    value: frameUrl,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(firstFrameFile, 'previewUrl', {
    value: frameUrl,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  return {
    firstFrameFile,
    refMode: 'frame',
  };
}
