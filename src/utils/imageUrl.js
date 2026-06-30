const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const MEDIA_BASE = import.meta.env.VITE_MEDIA_BASE_URL || '';
const MANAGED_MEDIA_PATH_RE = /^\/(?:uploads|media)\//i;

/**
 * 将后端返回的相对路径拼接为完整可访问 URL
 * 例如 /uploads/subjects/xxx.jpg → http://localhost:8000/uploads/subjects/xxx.jpg
 * 已经是完整 URL 或 blob URL 的直接返回
 */
function resolveOrigin(base) {
  const normalized = String(base || '').trim();
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

function getManagedMediaOrigin() {
  const mediaOrigin = resolveOrigin(MEDIA_BASE);
  if (mediaOrigin) return mediaOrigin;

  const apiOrigin = resolveOrigin(API_BASE);
  if (!apiOrigin) return getCurrentOrigin() || '';

  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && apiOrigin.startsWith('http:')) {
    return getCurrentOrigin() || apiOrigin;
  }

  return apiOrigin;
}

function rewriteManagedMediaUrl(cleaned) {
  if (!cleaned) return null;
  const origin = getManagedMediaOrigin();
  if (!origin) return null;

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      if (!MANAGED_MEDIA_PATH_RE.test(parsed.pathname)) return null;
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  }

  if (MANAGED_MEDIA_PATH_RE.test(cleaned)) {
    return `${origin}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
  }

  return null;
}

export function normalizeImageUrl(url) {
  const cleaned = String(url || '').trim();
  if (!cleaned) return null;
  if (cleaned.startsWith('blob:')) return cleaned;

  const managed = rewriteManagedMediaUrl(cleaned);
  if (managed) return managed;

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  // 开发环境返回相对路径，走 Vite proxy 避免 CORS
  if (import.meta.env.DEV) {
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }
  // 去掉 API_BASE 末尾的 /api（图片通常不在 /api 路径下）
  const origin = getManagedMediaOrigin() || API_BASE.replace(/\/api\/?$/, '');
  if (!origin) {
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }
  return `${origin}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
}
/**
 * 始终返回完整绝对 URL（透传给第三方模型时需要）
 */
export function toAbsoluteUrl(url) {
  const cleaned = String(url || '').trim();
  if (!cleaned) return cleaned;
  if (cleaned.startsWith('blob:')) return cleaned;

  const managed = rewriteManagedMediaUrl(cleaned);
  if (managed) return managed;

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  const origin = getManagedMediaOrigin() || API_BASE.replace(/\/api\/?$/, '');
  if (!origin) return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return `${origin}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
}

/** 检查 URL 是否为 AI 模型可消费的安全格式（排除 AVIF / 派生资产等模型不支持的格式） */
export function isSafeImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !lower.endsWith('.avif') && !lower.includes('/derived/assets/');
}
