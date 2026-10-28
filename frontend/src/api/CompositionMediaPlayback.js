import { authFetch } from './request';

export function isProtectedCompositionSource(source) {
  if (!source || typeof window === 'undefined') return false;
  const url = new URL(source, window.location.origin);
  const api = new URL(import.meta.env.VITE_API_BASE_URL || '/', window.location.origin);
  return (url.origin === window.location.origin || url.origin === api.origin)
    && new RegExp('^/api/(?:assets/[^/]+|projects/[^/]+/storyboards/[^/]+/media-candidates/[^/]+)/download/?$').test(url.pathname);
}

// 受控原文件接口需要登录头；不能直接作为 video.src 或降级到预览文件。
export async function loadCompositionMediaBlob(source, signal) {
  if (!isProtectedCompositionSource(source)) throw new Error('不是本站受控媒体地址');
  const response = await authFetch(source, { signal });
  if (!response.ok) throw new Error(`原视频加载失败（${response.status}）`);
  const blob = await response.blob();
  if (!blob.size || blob.type.includes('json') || blob.type.includes('text/html')) throw new Error('原视频返回内容无效');
  return blob;
}
