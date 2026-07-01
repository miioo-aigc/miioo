const BASE = import.meta.env.VITE_API_BASE_URL || '';

import { apiDownloadAsset } from './assets.js';
import { authFetch } from './request.js';

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

export function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export function triggerUrlDownload(url, filename, options = {}) {
  if (!url) return;

  const openTarget = options.openTarget || '_blank';
  const openFeatures = options.openFeatures || 'noopener,noreferrer';

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.open(url, openTarget, openFeatures);
  }
}

export async function downloadFromUrl(url, filename, options = {}) {
  if (!url) return;
  const openTarget = options.openTarget || '_blank';
  const openFeatures = options.openFeatures || 'noopener,noreferrer';

  try {
    const response = shouldUseAuthFetch(url)
      ? await authFetch(url, { headers: { Accept: '*/*' } })
      : await fetch(url);

    if (!response.ok) {
      throw new Error(`下载失败（${response.status}）`);
    }

    const blob = await response.blob();
    if (blob.size > 0) {
      triggerBlobDownload(blob, filename);
      return;
    }

    if (response.url && response.url !== url) {
      triggerUrlDownload(response.url, filename, { openTarget, openFeatures });
      return;
    }
  } catch (error) {
    console.warn('[download] 通过 URL 下载失败，回退直链打开：', error);
  }

  triggerUrlDownload(url, filename, { openTarget, openFeatures });
}

export async function downloadMediaFile(media, filename, options = {}) {
  if (!media) return;

  const assetId = media.assetId || media.asset_id || null;
  if (assetId && options.preferAsset !== false) {
    try {
      const blob = await apiDownloadAsset(assetId, {
        prefer_origin: options.preferOrigin !== false,
      });
      triggerBlobDownload(blob, filename);
      return;
    } catch (error) {
      console.warn('[download] 资产下载失败，尝试使用下载地址：', error);
    }
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

  if (url) {
    await downloadFromUrl(url, filename, options);
  }
}
