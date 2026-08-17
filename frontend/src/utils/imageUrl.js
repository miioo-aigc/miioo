const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_TARGET = import.meta.env.VITE_API_TARGET || '';

function getConfiguredOrigin() {
  // 开发环境 VITE_API_BASE_URL 通常为空，API 走 Vite proxy；
  // 透传给后端的素材 URL 必须使用代理目标域名，不能返回 /uploads/... 相对路径。
  const origin = (API_BASE || API_TARGET).replace(/\/api\/?$/, '');
  if (/^https?:\/\//i.test(origin)) return origin;
  // 生产环境可能使用同站相对 API（例如 VITE_API_BASE_URL 为空），
  // 此时图片应跟随当前站点域名，避免后端返回的裸域地址绕过规范域名。
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin;
  return null;
}

function normalizeSameSiteAbsoluteUrl(url) {
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const parsed = new URL(url);
    const configuredOrigin = getConfiguredOrigin();
    if (!configuredOrigin) return url;

    const configured = new URL(configuredOrigin);
    // 生产后端历史上可能返回裸域地址，而站点配置使用 www（或反过来）。
    // 仅统一同一主域名的静态媒体，不能改写外部 CDN 或第三方图片地址。
    const isSameSiteHost = parsed.hostname === configured.hostname
      || parsed.hostname.replace(/^www\./i, '') === configured.hostname.replace(/^www\./i, '');
    if (!isSameSiteHost || !parsed.pathname.startsWith('/uploads/')) return url;

    parsed.protocol = configured.protocol;
    parsed.hostname = configured.hostname;
    parsed.port = configured.port;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * 将后端返回的相对路径拼接为完整可访问 URL
 * 例如 /uploads/subjects/xxx.jpg → http://localhost:8000/uploads/subjects/xxx.jpg
 * 已经是完整 URL 或 blob/data URL 的直接返回
 */
export function normalizeImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return normalizeSameSiteAbsoluteUrl(url);
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  // Seedance 的 asset:// 是服务商素材身份，不是本站静态资源路径。
  // 虽然展示层应优先使用 preview_url/source_url，但归一化时也不能把它破坏成 /asset://...。
  if (url.startsWith('asset://')) return url;
  // 开发环境返回相对路径，走 Vite proxy 避免 CORS
  if (import.meta.env.DEV) {
    return url.startsWith('/') ? url : `/${url}`;
  }
  // 去掉 API_BASE 末尾的 /api（图片通常不在 /api 路径下）
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
/**
 * 始终返回完整绝对 URL（透传给第三方模型时需要）
 */
export function toAbsoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return normalizeSameSiteAbsoluteUrl(url);
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  // Seedance 素材库的 asset:// 是服务商可识别的素材引用，不是本站相对路径。
  // 透传给后端时必须保持原样，不能拼接为 /asset://...。
  if (url.startsWith('asset://')) return url;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  if (!origin) return url.startsWith('/') ? url : `/${url}`;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** 检查 URL 是否为 AI 模型可消费的安全格式（排除 AVIF / 派生资产等模型不支持的格式） */
export function isSafeImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !lower.endsWith('.avif') && !lower.includes('/derived/assets/');
}
