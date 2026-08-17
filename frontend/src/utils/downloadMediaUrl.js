/**
 * 下载媒体 URL，并校验响应确实是媒体文件。
 * 负责 fetch、Blob 临时 URL 和浏览器下载生命周期，不包含业务文件名规则。
 */
import { downloadBlob } from './downloadBlob';

export async function downloadMediaUrl(url, filename) {
  if (!url) return false;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    throw new Error(`下载失败（${response.status}）`);
  }
  if (contentType.includes('application/json') || contentType.startsWith('text/')) {
    throw new Error('下载失败：媒体链接已失效');
  }
  const blob = await response.blob();
  if (!blob.size || blob.type.includes('application/json') || blob.type.startsWith('text/')) {
    throw new Error('下载失败：未获取到有效媒体文件');
  }
  downloadBlob(blob, filename);
  return true;
}
