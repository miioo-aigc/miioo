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
  if (genType === 'dubbing') return ALLOWED_AUDIO_EXTS;
  return ALLOWED_EXTS;
}

export function getCreationAcceptAttr(genType, supportsAudio = false) {
  return getCreationUploadExtensions(genType, supportsAudio).join(',');
}

export function getModelReferenceLimits(capabilitiesMap = {}, model) {
  return capabilitiesMap?.[model] || null;
}

export function getReferenceLimitLabels(files = [], capabilities = {}, previousFiles = []) {
  const addedFiles = files.filter((file) => !previousFiles.includes(file));
  const labels = [];
  const checks = [
    ['参考图', isImageFile, capabilities.max_reference_images],
    ['参考视频', isVideoFile, capabilities.max_reference_videos],
    ['参考音频', isAudioFile, capabilities.max_reference_audios],
  ];

  for (const [label, predicate, limit] of checks) {
    if (limit != null && addedFiles.some(predicate) && files.filter(predicate).length > limit) {
      labels.push(label);
    }
  }
  return labels;
}

export function trimFilesToModelReferenceLimits(files = [], capabilities = {}) {
  const images = files.filter(isImageFile);
  const videos = files.filter(isVideoFile);
  const audios = files.filter(isAudioFile);
  const others = files.filter((file) => !isImageFile(file) && !isVideoFile(file) && !isAudioFile(file));
  const trimmedImages = capabilities.max_reference_images != null
    ? images.slice(0, capabilities.max_reference_images)
    : images;
  const trimmedVideos = capabilities.max_reference_videos != null
    ? videos.slice(0, capabilities.max_reference_videos)
    : videos;
  const trimmedAudios = capabilities.max_reference_audios != null
    ? audios.slice(0, capabilities.max_reference_audios)
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
