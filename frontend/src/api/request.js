const BASE = import.meta.env.VITE_API_BASE_URL;

import { clearAllCache } from '../utils/cache.js';

export function getToken() {
  return localStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

let authGeneration = 0;

// 登录或退出改变会话代际；同一会话内刷新凭证不改变它。
export function getAuthSessionGeneration() {
  return authGeneration;
}

function ensureSameAuthSession(generation) {
  if (authGeneration !== generation) {
    throw createUnauthorizedError();
  }
}

export function setTokens(accessToken, refreshToken) {
  authGeneration++;
  clearAllCache();
  writeTokens(accessToken, refreshToken);
}

function writeTokens(accessToken, refreshToken) {
  localStorage.setItem('token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

export function clearTokens() {
  authGeneration++;
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  clearAllCache(); // 任何登出路径都清空业务缓存，防止跨用户数据残留
}

function withAuth(options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  return {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

// 防止并发请求同时触发多次刷新
let refreshPromise = null;
let refreshGeneration = -1;
function cloneFormData(fd) {
  const c = new FormData();
  for (const [k, v] of fd.entries()) {
    // File 类型需要保留克隆前已设置的文件名（第三参数），
    // 直接 append(k, v) 会回退到 File.name（可能含中文），导致服务端 500
    if (v instanceof File) {
      c.append(k, v, v.name);
    } else {
      c.append(k, v);
    }
  }
  return c;
}


async function refreshAccessTokenResult(generation = authGeneration) {
  ensureSameAuthSession(generation);
  if (refreshPromise && refreshGeneration === generation) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return { ok: false, shouldLogout: true };

  refreshGeneration = generation;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      ensureSameAuthSession(generation);
      if (!res.ok) {
        return { ok: false, shouldLogout: [400, 401, 403].includes(res.status), status: res.status };
      }
      const data = await res.json();
      ensureSameAuthSession(generation);
      if (data.access_token) {
        writeTokens(data.access_token, data.refresh_token);
        return { ok: true, shouldLogout: false };
      }
      return { ok: false, shouldLogout: false, status: 502 };
    } catch (cause) {
      return { ok: false, shouldLogout: false, cause,
        status: cause instanceof SyntaxError ? 502 : undefined };
    } finally {
      if (refreshGeneration === generation) refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// 首页静默刷新仍使用布尔结果，失败分类仅供请求层处理 401。
export async function refreshAccessToken() {
  const generation = authGeneration;
  const result = await refreshAccessTokenResult(generation);
  return generation === authGeneration && result.ok;
}

function handleRefreshFailure(result, generation) {
  ensureSameAuthSession(generation);
  if (result.shouldLogout) {
    clearTokens();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw createUnauthorizedError();
  }
  const error = new Error('登录服务暂时不可用，请稍后重试');
  error.status = result.status;
  // 网关 5xx、代理返回的 502 以及连接异常都属于临时不可用，
  // 不能被上层当作凭证失效处理。
  error.isNetworkError = !result.status || result.status >= 500;
  error.cause = result.cause;
  throw error;
}

async function ensureAccessToken(generation) {
  ensureSameAuthSession(generation);
  if (getToken()) return true;
  const result = await refreshAccessTokenResult(generation);
  ensureSameAuthSession(generation);
  if (!result.ok) handleRefreshFailure(result, generation);
  return true;
}

function createUnauthorizedError() {
  const error = new Error('Unauthorized');
  error.status = 401;
  return error;
}

// 带自动刷新的 fetch，供所有需要鉴权的 API 使用
export async function authFetch(url, options = {}) {
  const generation = authGeneration;
  if (!(await ensureAccessToken(generation))) {
    throw createUnauthorizedError();
  }
  ensureSameAuthSession(generation);
  const requestToken = getToken();

  // 克隆 FormData，防止首次 fetch 消费后 401 重试时 body 为空
  const formClone = options.body instanceof FormData ? cloneFormData(options.body) : null;
  let res;
  try {
    res = await fetch(url, withAuth(options));
  } catch (networkErr) {
    // AbortError 是用户主动取消，直接透传
    if (networkErr.name === 'AbortError') throw networkErr;
    const err = new Error(networkErr.message || 'Network request failed');
    err.isNetworkError = true;
    err.cause = networkErr;
    throw err;
  }
  ensureSameAuthSession(generation);
  if (res.status === 401) {
    const result = getToken() !== requestToken ? { ok: true } : await refreshAccessTokenResult(generation);
    ensureSameAuthSession(generation);
    if (result.ok) {
      const retryOpts = formClone ? { ...options, body: cloneFormData(formClone) } : options;
      const retryResponse = await fetch(url, withAuth(retryOpts));
      ensureSameAuthSession(generation);
      return retryResponse;
    }
    handleRefreshFailure(result, generation);
  }
  const isStorageReminderAck = url.includes('/storage-usage/reminders/ack');
  if (res.ok && !isStorageReminderAck && !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
    window.dispatchEvent(new CustomEvent('storage:write-success'));
  }
  return res;
}

// 不带 Content-Type 的 authFetch，用于 FormData 上传
export async function authFetchForm(url, options = {}) {
  const generation = authGeneration;
  if (!(await ensureAccessToken(generation))) {
    throw createUnauthorizedError();
  }
  ensureSameAuthSession(generation);
  const requestToken = getToken();

  // 克隆 FormData，防止首次 fetch 消费后 401 重试时 body 为空
  const formClone = options.body instanceof FormData ? cloneFormData(options.body) : null;
  let res;
  try {
    res = await fetch(url, withAuth(options));
  } catch (networkErr) {
    const err = new Error(networkErr.message || 'Network request failed');
    err.isNetworkError = true;
    err.cause = networkErr;
    throw err;
  }
  ensureSameAuthSession(generation);
  if (res.status === 401) {
    const result = getToken() !== requestToken ? { ok: true } : await refreshAccessTokenResult(generation);
    ensureSameAuthSession(generation);
    if (result.ok) {
      const retryOpts = formClone ? { ...options, body: cloneFormData(formClone) } : options;
      const retryResponse = await fetch(url, withAuth(retryOpts));
      ensureSameAuthSession(generation);
      return retryResponse;
    }
    handleRefreshFailure(result, generation);
  }
  const isStorageReminderAck = url.includes('/storage-usage/reminders/ack');
  if (res.ok && !isStorageReminderAck && !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
    window.dispatchEvent(new CustomEvent('storage:write-success'));
  }
  return res;
}

// Streaming fetch — 与 authFetch 相同的鉴权 + 401 重试逻辑，
// 但直接返回 Response 对象，由调用方自行读取流式 body
export async function authFetchStream(url, options = {}) {
  const generation = authGeneration;
  if (!(await ensureAccessToken(generation))) {
    throw createUnauthorizedError();
  }
  ensureSameAuthSession(generation);
  const requestToken = getToken();

  let res;
  try {
    res = await fetch(url, withAuth(options));
  } catch (networkErr) {
    // AbortError 是用户主动取消，直接透传
    if (networkErr.name === 'AbortError') throw networkErr;
    // 网络层错误（DNS 失败、连接被拒等）→ 包装为可识别的错误
    const err = new Error(networkErr.message || 'Network request failed');
    err.isNetworkError = true;
    err.cause = networkErr;
    throw err;
  }
  ensureSameAuthSession(generation);
  if (res.status === 401) {
    const result = getToken() !== requestToken ? { ok: true } : await refreshAccessTokenResult(generation);
    ensureSameAuthSession(generation);
    if (result.ok) {
      try {
        const retryResponse = await fetch(url, withAuth(options));
        ensureSameAuthSession(generation);
        return retryResponse;
      } catch (retryErr) {
        ensureSameAuthSession(generation);
        if (retryErr.name === 'AbortError') throw retryErr;
        const err = new Error(retryErr.message || 'Network request failed after token refresh');
        err.isNetworkError = true;
        err.cause = retryErr;
        throw err;
      }
    }
    handleRefreshFailure(result, generation);
  }
  return res;
}

export function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
