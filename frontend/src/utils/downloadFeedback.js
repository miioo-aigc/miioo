import { downloadBlob } from './downloadBlob';
import { downloadMediaUrl } from './downloadMediaUrl';
import {
  hideGlobalDownloadToast,
  showGlobalToast,
  startGlobalDownloadToast,
  updateGlobalDownloadProgress,
} from '../stores/toastStore';

const MIN_DOWNLOAD_VISIBLE_MS = 900;

function getToastDelay(startedAt) {
  return Math.max(0, MIN_DOWNLOAD_VISIBLE_MS - (Date.now() - startedAt));
}

export function triggerAnchorDownload(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || '';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function startDownloadFeedback(message = '正在下载') {
  const id = startGlobalDownloadToast(message);
  const startedAt = Date.now();

  return {
    setProgress: (progress) => updateGlobalDownloadProgress(id, progress),
    async complete(message, type = 'success') {
      await new Promise((resolve) => setTimeout(resolve, getToastDelay(startedAt)));
      hideGlobalDownloadToast(id);
      if (message) showGlobalToast(message, type);
    },
    async fail(message = '下载失败，请重试', type = 'error') {
      await new Promise((resolve) => setTimeout(resolve, getToastDelay(startedAt)));
      hideGlobalDownloadToast(id);
      showGlobalToast(message, type);
    },
  };
}

export async function downloadBlobWithFeedback(blob, filename, message = '正在下载') {
  const feedback = startDownloadFeedback(message);
  try {
    downloadBlob(blob, filename);
    await feedback.complete();
    return true;
  } catch (error) {
    await feedback.fail(error?.message || '下载失败，请重试');
    throw error;
  }
}

export async function downloadUrlWithFeedback(url, filename, {
  message = '正在下载',
  fallbackToAnchor = true,
} = {}) {
  const feedback = startDownloadFeedback(message);
  try {
    await downloadMediaUrl(url, filename, feedback.setProgress);
    await feedback.complete();
    return true;
  } catch (error) {
    if (!fallbackToAnchor) {
      await feedback.fail(error?.message || '下载失败，请重试');
      return false;
    }
    triggerAnchorDownload(url, filename);
    await feedback.complete();
    return true;
  }
}
