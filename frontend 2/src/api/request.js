const BASE = import.meta.env.VITE_API_BASE_URL;

import { clearAllCache } from '../utils/cache.js';

export function getToken() {
  return localStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem('token', accessToken);
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  clearAllCache(); // 任何登出路径都清空业务缓存，防止跨用户数据残留
}

function withAuth(options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  return {
    ...options,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

// 防止并发请求同时触发多次刷新
let refreshPromise = null;
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


export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) {
        setTokens(data.access_token, data.refresh_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// 带自动刷新的 fetch，供所有需要鉴权的 API 使用
export async function authFetch(url, options = {}) {
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
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      const retryOpts = formClone ? { ...options, body: cloneFormData(formClone) } : options;
      return fetch(url, withAuth(retryOpts));
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('Unauthorized');
  }
  return res;
}

// 不带 Content-Type 的 authFetch，用于 FormData 上传
export async function authFetchForm(url, options = {}) {
  // 克隆 FormData，防止首次 fetch 消费后 401 重试时 body 为空
  const formClone = options.body instanceof FormData ? cloneFormData(options.body) : null;
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    const err = new Error(networkErr.message || 'Network request failed');
    err.isNetworkError = true;
    err.cause = networkErr;
    throw err;
  }
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      const newToken = getToken();
      return fetch(url, {
        ...(formClone ? { ...options, body: cloneFormData(formClone) } : options),
        headers: {
          ...(options.headers || {}),
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
        },
      });
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('Unauthorized');
  }
  return res;
}

// Streaming fetch — 与 authFetch 相同的鉴权 + 401 重试逻辑，
// 但直接返回 Response 对象，由调用方自行读取流式 body
export async function authFetchStream(url, options = {}) {
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
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      try {
        return await fetch(url, withAuth(options));
      } catch (retryErr) {
        const err = new Error(retryErr.message || 'Network request failed after token refresh');
        err.isNetworkError = true;
        err.cause = retryErr;
        throw err;
      }
    }
    clearTokens();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('Unauthorized');
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
