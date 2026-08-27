export const ALLOWED_EXTS = ['.txt', '.md', '.pdf', '.docx'];
export const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.heif'];
export const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv'];
export const ALLOWED_AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.wma'];
export const ALLOWED_MEDIA_EXTS = [...ALLOWED_IMAGE_EXTS, ...ALLOWED_VIDEO_EXTS, ...ALLOWED_AUDIO_EXTS];

export const MAX_CREATION_FILES = 20;
export const MAX_CREATION_IMAGE_BYTES = 20 * 1024 * 1024;

export const IMAGE_EXTS_SET = new Set(ALLOWED_IMAGE_EXTS);
export const AUDIO_EXTS_SET = new Set(ALLOWED_AUDIO_EXTS);
export const VIDEO_EXTS_SET = new Set(ALLOWED_VIDEO_EXTS);

export function getCreationUploadExtensions(genType, supportsAudio = false) {
  if (genType === 'image') return ALLOWED_IMAGE_EXTS;
  if (genType === 'video') {
    return supportsAudio ? ALLOWED_MEDIA_EXTS : [...ALLOWED_IMAGE_EXTS, ...ALLOWED_VIDEO_EXTS];
  }
  if (genType === 'dubbing' || genType === 'music') return ALLOWED_AUDIO_EXTS;
  return ALLOWED_EXTS;
}

export function getCreationAcceptAttr(genType, supportsAudio = false) {
  return getCreationUploadExtensions(genType, supportsAudio).join(',');
}

export function getModelReferenceLimits(capabilitiesMap = {}, model) {
  const directCapabilities = capabilitiesMap?.[model];
  if (directCapabilities) return directCapabilities;

  // HappyHorse 在创作页以聚合模型展示，但默认模型、历史草稿等路径可能保留子模型 ID。
  // 子模型上传限制必须回到聚合入口，才能按素材类型选择 r2v 或 video-edit 的能力。
  const groupedHappyHorseModel = String(model || '').match(/^(happyhorse-1\.[01])-(?:t2v|i2v|r2v|video-edit)$/i)?.[1];
  return groupedHappyHorseModel ? capabilitiesMap?.[groupedHappyHorseModel] || null : null;
}

function getEffectiveReferenceCapabilities(files = [], capabilities = {}) {
  const happyHorseCaps = capabilities?.happyhorse_upload_reference_capabilities;
  if (!happyHorseCaps) return capabilities;
  const hasVideo = files.some(isVideoFile);
  return (hasVideo ? happyHorseCaps.withVideo : happyHorseCaps.imageOnly) || capabilities;
}

function isHappyHorseVideoUnsupported(files = [], capabilities = {}) {
  const withVideo = capabilities?.happyhorse_upload_reference_capabilities?.withVideo;
  return files.some(isVideoFile) && withVideo?.isAvailable === false;
}

export function getReferenceLimitMessage(files = [], capabilities = {}, previousFiles = []) {
  const effectiveCapabilities = getEffectiveReferenceCapabilities(files, capabilities);
  const isHappyHorseVideoRoute = Boolean(
    capabilities?.happyhorse_upload_reference_capabilities
      && files.some(isVideoFile),
  );
  const labels = getReferenceLimitLabels(files, capabilities, previousFiles);
  if (labels.length === 0) return '';
  if (isHappyHorseVideoUnsupported(files, capabilities) && labels.includes('参考视频')) {
    return '当前 HappyHorse 模型暂不支持参考视频，请仅上传图片素材。';
  }
  if (isHappyHorseVideoRoute && labels.includes('参考图')) {
    const maxImages = effectiveCapabilities.max_reference_images;
    return Number.isFinite(maxImages)
      ? `如果您需要参考视频素材，请限制图片素材数量为${maxImages}以内。`
      : '如果您需要参考视频素材，请减少图片素材数量后重试。';
  }
  return `${labels.join('、')}已达该模型的上限`;
}

export function getReferenceLimitLabels(files = [], capabilities = {}, previousFiles = []) {
  const addedFiles = files.filter((file) => !previousFiles.includes(file));
  const effectiveCapabilities = getEffectiveReferenceCapabilities(files, capabilities);
  const labels = [];
  const checks = [
    ['参考图', isImageFile, effectiveCapabilities.max_reference_images],
    ['参考视频', isVideoFile, effectiveCapabilities.max_reference_videos],
    ['参考音频', isAudioFile, effectiveCapabilities.max_reference_audios],
  ];

  for (const [label, predicate, limit] of checks) {
    // HappyHorse 新增视频后会从 r2v 切换到 video-edit，此时即使本次没有新增图片，
    // 也必须重新检查已有图片是否满足 video-edit 的图片上限。
    const routeChangedByVideo = Boolean(
      capabilities?.happyhorse_upload_reference_capabilities
        && addedFiles.some(isVideoFile),
    );
    if (limit != null
      && (addedFiles.some(predicate) || routeChangedByVideo)
      && files.filter(predicate).length > limit) {
      labels.push(label);
    }
  }
  return labels;
}

export function trimFilesToModelReferenceLimits(files = [], capabilities = {}) {
  const effectiveCapabilities = getEffectiveReferenceCapabilities(files, capabilities);
  const images = files.filter(isImageFile);
  const videos = files.filter(isVideoFile);
  const audios = files.filter(isAudioFile);
  const others = files.filter((file) => !isImageFile(file) && !isVideoFile(file) && !isAudioFile(file));
  const trimmedImages = effectiveCapabilities.max_reference_images != null
    ? images.slice(0, effectiveCapabilities.max_reference_images)
    : images;
  const trimmedVideos = effectiveCapabilities.max_reference_videos != null
    ? videos.slice(0, effectiveCapabilities.max_reference_videos)
    : videos;
  const trimmedAudios = effectiveCapabilities.max_reference_audios != null
    ? audios.slice(0, effectiveCapabilities.max_reference_audios)
    : audios;
  return [...trimmedImages, ...trimmedVideos, ...trimmedAudios, ...others];
}

export function appendFilesWithinLimit(files = [], additions = [], maxFiles = MAX_CREATION_FILES) {
  return [...files, ...additions].slice(0, maxFiles);
}

export function isFileOverLimit(file, maxBytes) {
  return Number.isFinite(file?.size) && file.size > maxBytes;
}

export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function truncateFileName(name = '') {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return name;
  const base = name.slice(0, dotIndex);
  const ext = name.slice(dotIndex);
  const maxBase = 12;
  if (base.length <= maxBase) return name;
  return base.slice(0, maxBase) + '… ' + ext;
}

function hasAssetExtension(file, extensions) {
  if (!file?.isAsset) return false;
  const urls = [file.url, file.previewUrl].filter(Boolean);
  return urls.some((url) => {
    const cleanUrl = url.split('?')[0];
    return extensions.test(cleanUrl);
  });
}

export function isImageFile(file) {
  if (file?.type?.startsWith('image/')) return true;
  if (hasAssetExtension(file, /\.(jpg|jpeg|png|webp|gif|bmp|tiff?|heic|heif)$/i)) return true;
  const ext = '.' + (file?.name || '').split('.').pop().toLowerCase();
  return IMAGE_EXTS_SET.has(ext);
}

export function isVideoFile(file) {
  if (file?.type?.startsWith('video/')) return true;
  if (hasAssetExtension(file, /\.(mp4|mov|avi|webm|mkv|wmv|flv)$/i)) return true;
  const ext = '.' + (file?.name || '').split('.').pop().toLowerCase();
  return VIDEO_EXTS_SET.has(ext);
}

export function isAudioFile(file) {
  if (file?.type?.startsWith('audio/')) return true;
  if (hasAssetExtension(file, /\.(mp3|wav|aac|ogg|flac|m4a|wma)$/i)) return true;
  const ext = '.' + (file?.name || '').split('.').pop().toLowerCase();
  return AUDIO_EXTS_SET.has(ext);
}
