const BASE = import.meta.env.VITE_API_BASE_URL || '';

import { apiDownloadAsset } from './assets.js';
import { authFetch } from './request.js';

const DEFAULT_PROMPT_LENGTH = 24;
const FALLBACK_EXTENSIONS = {
  image: '.png',
  video: '.mp4',
  audio: '.mp3',
  zip: '.zip',
};

const CONTENT_TYPE_EXTENSIONS = {
  'application/zip': '.zip',
  'audio/aac': '.aac',
  'audio/flac': '.flac',
  'audio/m4a': '.m4a',
  'audio/mp3': '.mp3',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const GENERIC_NAME_PATTERNS = [
  /^asset$/i,
  /^download$/i,
  /^image$/i,
  /^video$/i,
  /^audio$/i,
  /^file$/i,
  /^creation$/i,
  /^dubbing$/i,
  /^creation\.(png|jpe?g|webp|mp4|mp3|wav)$/i,
  /^shot[-_].*/i,
  /^subject-image[-_].*/i,
  /^storyboard[-_].*/i,
  /^project-assets?$/i,
  /^(创作图片|创作视频|创作配音|分镜图|分镜视频|主体图|项目资产)$/i,
];

function resolveOrigin(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  try {
    return new URL(normalized).origin;
  } catch {
    return '';
  }
}

function getCurrentOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location?.origin || '';
}

function normalizeDownloadOptions(filenameOrOptions, legacyOptions = {}) {
  if (filenameOrOptions && typeof filenameOrOptions === 'object' && !Array.isArray(filenameOrOptions)) {
    return { ...filenameOrOptions, ...legacyOptions };
  }
  return {
    ...(legacyOptions || {}),
    ...(typeof filenameOrOptions === 'string' ? { filenameHint: filenameOrOptions } : {}),
  };
}

function splitExtension(value) {
  const text = String(value || '').trim();
  if (!text) return { stem: '', ext: '' };
  const match = text.match(/(\.[a-z0-9]{1,8})$/i);
  if (!match) return { stem: text, ext: '' };
  return {
    stem: text.slice(0, -match[1].length),
    ext: match[1].toLowerCase(),
  };
}

function sanitizeFileSegment(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFilename(value) {
  const cleaned = sanitizeFileSegment(value);
  if (!cleaned) return '';
  const { stem, ext } = splitExtension(cleaned);
  const safeStem = sanitizeFileSegment(stem);
  if (!safeStem) return ext || '';
  return `${safeStem}${ext}`;
}

function takeReadableChars(value, limit = DEFAULT_PROMPT_LENGTH) {
  return Array.from(String(value || '').trim()).slice(0, limit).join('');
}

function buildPromptExcerpt(value) {
  const excerpt = sanitizeFileSegment(takeReadableChars(value, DEFAULT_PROMPT_LENGTH));
  return excerpt || '';
}

function isGenericName(value) {
  const cleaned = sanitizeFileSegment(splitExtension(value).stem);
  if (!cleaned) return true;
  return GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function parseContentDispositionFilename(headerValue) {
  const value = String(headerValue || '').trim();
  if (!value) return '';

  const utfMatch = value.match(/filename\*\s*=\s*([^;]+)/i);
  if (utfMatch?.[1]) {
    const raw = utfMatch[1].trim().replace(/^UTF-8''/i, '').replace(/^"(.*)"$/, '$1');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  const plainMatch = value.match(/filename\s*=\s*([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim().replace(/^"(.*)"$/, '$1');
  }

  return '';
}

function inferExtensionFromUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const parsed = new URL(input, getCurrentOrigin() || 'http://localhost');
    return splitExtension(parsed.pathname).ext;
  } catch {
    return splitExtension(input.split('?')[0]).ext;
  }
}

function inferExtensionFromContentType(contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!type) return '';
  return CONTENT_TYPE_EXTENSIONS[type] || '';
}

function resolveMediaType(options = {}) {
  const explicit = String(options.mediaType || options.type || '').trim().toLowerCase();
  if (explicit) return explicit;

  const contentType = String(options.contentType || '').toLowerCase();
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/zip') return 'zip';

  const filenameCandidates = [
    options.filenameHint,
    options.assetName,
    options.headerFilename,
    options.url,
  ];
  const ext = filenameCandidates.map(inferExtensionFromUrl).find(Boolean);
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'].includes(ext)) return 'image';
  if (['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.webm'].includes(ext)) return 'audio';
  if (ext === '.zip') return 'zip';
  return 'file';
}

function getDefaultPrefix(options = {}) {
  const contextLabel = sanitizeFileSegment(options.contextLabel);
  if (contextLabel) return contextLabel;
  switch (resolveMediaType(options)) {
    case 'image':
      return '图片素材';
    case 'video':
      return '视频素材';
    case 'audio':
      return '音频素材';
    case 'zip':
      return '资源包';
    default:
      return '下载资源';
  }
}

function resolveSequence(options = {}) {
  const raw = options.sequence
    ?? options.index
    ?? options.number
    ?? options.shotNumber
    ?? options.shot_number
    ?? null;
  if (raw === null || raw === undefined || raw === '') return '';
  return sanitizeFileSegment(String(raw));
}

function resolveFallbackLabel(options = {}) {
  const candidates = [
    options.assetName,
    options.name,
    options.subjectName,
    options.voiceName,
    options.filenameHint ? splitExtension(options.filenameHint).stem : '',
  ];
  return candidates
    .map((value) => sanitizeFileSegment(value))
    .find((value) => value && !isGenericName(value)) || '';
}

function inferExtension(options = {}) {
  const candidates = [
    splitExtension(options.filenameHint).ext,
    splitExtension(options.headerFilename).ext,
    splitExtension(options.assetName).ext,
    splitExtension(options.name).ext,
    inferExtensionFromUrl(options.url),
    inferExtensionFromContentType(options.contentType),
  ];
  const ext = candidates.find(Boolean);
  if (ext) return ext;
  return FALLBACK_EXTENSIONS[resolveMediaType(options)] || '';
}

export function buildDownloadFilename(options = {}) {
  if (options.headerFilename) {
    const sanitizedHeaderName = sanitizeFilename(options.headerFilename);
    if (sanitizedHeaderName) return sanitizedHeaderName;
  }

  const prefix = getDefaultPrefix(options);
  const promptExcerpt = buildPromptExcerpt(options.prompt);
  const fallbackLabel = resolveFallbackLabel(options);
  const sequence = resolveSequence(options);
  const extension = inferExtension(options);

  const parts = [prefix];
  if (promptExcerpt) {
    parts.push(promptExcerpt);
  } else if (fallbackLabel && fallbackLabel !== prefix) {
    parts.push(fallbackLabel);
  }
  if (sequence) parts.push(sequence);

  const baseName = parts
    .map((value) => sanitizeFileSegment(value))
    .filter(Boolean)
    .join('_') || 'download';

  return `${baseName}${extension}`;
}

function shouldUseAuthFetch(url) {
  const cleaned = String(url || '').trim();
  if (!cleaned) return false;

  if (cleaned.startsWith('/api/') || cleaned.startsWith('/uploads/') || cleaned.startsWith('/media/')) {
    return true;
  }

  try {
    const parsed = new URL(cleaned);
    const baseOrigin = resolveOrigin(BASE) || getCurrentOrigin();
    return Boolean(baseOrigin && parsed.origin === baseOrigin);
  } catch {
    return false;
  }
}

export function triggerBlobDownload(blob, filenameOrOptions, legacyOptions = {}) {
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  const filename = buildDownloadFilename(options);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
  return filename;
}

export function triggerUrlDownload(url, filenameOrOptions, legacyOptions = {}) {
  if (!url) return '';
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  const filename = buildDownloadFilename({ ...options, url });
  const openTarget = options.openTarget || '_blank';
  const openFeatures = options.openFeatures || 'noopener,noreferrer';

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.open(url, openTarget, openFeatures);
  }

  return filename;
}

export async function downloadBlob(blob, filenameOrOptions, legacyOptions = {}) {
  if (!blob) return null;
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  const filename = triggerBlobDownload(blob, options);
  return { filename, size: blob.size ?? 0, contentDispositionFilename: '' };
}

export async function downloadResponse(response, filenameOrOptions, legacyOptions = {}) {
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  if (!response?.ok) {
    const status = response?.status ?? 'unknown';
    throw new Error(`下载失败（${status}）`);
  }

  const contentDispositionFilename = parseContentDispositionFilename(
    response.headers?.get('content-disposition'),
  );
  const contentType = response.headers?.get('content-type') || '';
  const blob = await response.blob();
  const filename = triggerBlobDownload(blob, {
    ...options,
    headerFilename: contentDispositionFilename,
    contentType,
    url: response.url || options.url,
  });

  return {
    filename,
    size: blob.size ?? 0,
    contentDispositionFilename,
  };
}

export async function downloadFromUrl(url, filenameOrOptions, legacyOptions = {}) {
  if (!url) return null;
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  const openTarget = options.openTarget || '_blank';
  const openFeatures = options.openFeatures || 'noopener,noreferrer';

  try {
    const response = shouldUseAuthFetch(url)
      ? await authFetch(url, { headers: { Accept: '*/*' } })
      : await fetch(url);

    return await downloadResponse(response, {
      ...options,
      url,
    });
  } catch (error) {
    console.warn('[download] 通过 URL 下载失败，回退直链打开：', error);
  }

  const filename = triggerUrlDownload(url, {
    ...options,
    openTarget,
    openFeatures,
  });
  return { filename, size: 0, contentDispositionFilename: '' };
}

export async function downloadFile(config = {}) {
  const {
    responseFetcher,
    blobFetcher,
    url,
    ...options
  } = config;

  if (typeof responseFetcher === 'function') {
    try {
      const response = await responseFetcher();
      return await downloadResponse(response, options);
    } catch (error) {
      console.warn('[download] 业务下载接口失败，尝试回退：', error);
    }
  }

  if (typeof blobFetcher === 'function') {
    try {
      const blob = await blobFetcher();
      return await downloadBlob(blob, options);
    } catch (error) {
      console.warn('[download] Blob 下载失败，尝试回退：', error);
    }
  }

  if (url) {
    return downloadFromUrl(url, options);
  }

  throw new Error('缺少可用的下载源');
}

export async function downloadMediaFile(media, filenameOrOptions, legacyOptions = {}) {
  if (!media) return null;
  const options = normalizeDownloadOptions(filenameOrOptions, legacyOptions);
  const assetId = media.assetId || media.asset_id || null;

  if (assetId && options.preferAsset !== false) {
    return downloadFile({
      responseFetcher: () => apiDownloadAsset(assetId, {
        prefer_origin: options.preferOrigin !== false,
        rawResponse: true,
      }),
      url: media.downloadUrl
        || media.download_url
        || media.fileUrl
        || media.file_url
        || media.videoUrl
        || media.video_url
        || media.imageUrl
        || media.image_url
        || media.audioUrl
        || media.audio_url
        || media.url
        || media.rawUrl
        || null,
      ...media,
      ...options,
      assetName: options.assetName || media.assetName || media.name || media.title || '',
      prompt: options.prompt || media.prompt || media.input_prompt || media.prompt_resolved || media.prompt_raw || '',
      mediaType: options.mediaType || media.mediaType || media.kind || media.type || '',
    });
  }

  const url = media.downloadUrl
    || media.download_url
    || media.fileUrl
    || media.file_url
    || media.videoUrl
    || media.video_url
    || media.imageUrl
    || media.image_url
    || media.audioUrl
    || media.audio_url
    || media.url
    || media.rawUrl
    || null;

  return downloadFromUrl(url, {
    ...media,
    ...options,
    url,
    assetName: options.assetName || media.assetName || media.name || media.title || '',
    prompt: options.prompt || media.prompt || media.input_prompt || media.prompt_resolved || media.prompt_raw || '',
    mediaType: options.mediaType || media.mediaType || media.kind || media.type || '',
  });
}
