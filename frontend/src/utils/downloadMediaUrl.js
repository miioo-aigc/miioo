/**
 * 下载媒体 URL 并在失败时回退为新窗口打开。
 * 负责 fetch、Blob 临时 URL 和浏览器下载生命周期，不包含业务文件名规则。
 */
import { downloadBlob } from './downloadBlob';

export async function downloadMediaUrl(url, filename) {
  if (!url) return false;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    downloadBlob(blob, filename);
    return true;
  } catch {
    window.open(url, '_blank');
    return false;
  }
}
