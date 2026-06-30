export const GLOBAL_ERROR_DIALOG_EVENT = 'miioo:global-error-dialog';

function parseJsonLike(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function pickFirstString(payload, paths = []) {
  for (const path of paths) {
    let current = payload;
    let valid = true;
    for (const segment of path) {
      if (current && typeof current === 'object') {
        current = current[segment];
      } else {
        valid = false;
        break;
      }
    }
    if (!valid) continue;
    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }
  return '';
}

function normalizeStructuredDetail(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return pickFirstString(item, [['msg'], ['message'], ['detail'], ['error']]);
        }
        return '';
      })
      .filter(Boolean)
      .join('；');
  }
  if (detail && typeof detail === 'object') {
    return pickFirstString(detail, [
      ['message'],
      ['detail'],
      ['error'],
      ['msg'],
      ['code'],
    ]);
  }
  return typeof detail === 'string' ? detail.trim() : '';
}

export function getDisplayErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') {
    const nestedPayload = parseJsonLike(payload);
    return nestedPayload ? getDisplayErrorMessage(nestedPayload, fallback) : (payload.trim() || fallback);
  }

  const candidates = [
    pickFirstString(payload, [['detail', 'message'], ['error', 'message']]),
    normalizeStructuredDetail(payload.detail),
    normalizeStructuredDetail(payload.message),
    normalizeStructuredDetail(payload.error),
    pickFirstString(payload, [['msg']]),
  ].filter(Boolean);

  const first = candidates[0];
  if (!first) return fallback;

  const nestedPayload = parseJsonLike(first);
  return nestedPayload ? getDisplayErrorMessage(nestedPayload, fallback) : first;
}

export function createDisplayError(message, options = {}) {
  const err = new Error(message || options.fallback || '请求失败');
  err.status = options.status;
  err.code = options.code;
  err.title = options.title || '';
  err.detail = options.detail || '';
  err.showDialog = Boolean(options.showDialog);
  err.rawPayload = options.rawPayload;
  return err;
}

export async function readResponsePayload(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => '');
  const parsed = parseJsonLike(text);
  return parsed || text;
}

export async function throwResponseError(res, fallback = '请求失败', options = {}) {
  const payload = await readResponsePayload(res);
  const message = getDisplayErrorMessage(payload, fallback || `请求失败（${res.status}）`);
  throw createDisplayError(message, {
    ...options,
    status: res.status,
    fallback: fallback || `请求失败（${res.status}）`,
    rawPayload: payload,
  });
}

export function getErrorMessage(error, fallback = '请求失败') {
  if (!error) return fallback;
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

export function shouldPromoteErrorToDialog(errorOrMessage) {
  const message = getErrorMessage(errorOrMessage, '');
  if (!message) return false;
  if (errorOrMessage && typeof errorOrMessage === 'object' && errorOrMessage.showDialog) {
    return true;
  }
  return (
    message.includes('OneLinkAI')
    || message.includes('当前模型已被管理员关闭')
    || message.includes('余额或额度不足')
    || message.includes('API Key 无效')
    || message.includes('内容安全')
    || message.includes('响应超时')
    || message.includes('请求参数不合法')
    || message.includes('当前不可用')
  );
}

export function openGlobalErrorDialog(errorOrMessage, options = {}) {
  if (typeof window === 'undefined') return;
  const message = getErrorMessage(errorOrMessage, options.fallback || '操作失败，请稍后重试');
  window.dispatchEvent(new CustomEvent(GLOBAL_ERROR_DIALOG_EVENT, {
    detail: {
      title: options.title || '操作失败',
      message,
      detail: options.detail || '',
    },
  }));
}

export function presentPromotedError(errorOrMessage, options = {}) {
  if (!shouldPromoteErrorToDialog(errorOrMessage)) return false;
  openGlobalErrorDialog(errorOrMessage, options);
  return true;
}
