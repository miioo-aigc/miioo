const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch as requestConfig, getAuthSessionGeneration } from './request.js';
import { publishModelConfig } from './ModelConfigEvents.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

async function authFetch(url, options) {
  const generation = getAuthSessionGeneration();
  const response = await requestConfig(url, options);
  if (response.ok && options?.method && options.method !== 'GET'
    && !url.endsWith('/test') && generation === getAuthSessionGeneration()) {
    invalidate('models:');
    publishModelConfig(generation);
  }
  return response;
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function apiListProviders() {
  const res = await authFetch(`${BASE}/api/providers`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) message = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    throw new Error(message);
  }
  return res.json();
}

export async function apiCreateProvider({ name, provider_type, base_url, api_key }) {
  const res = await authFetch(`${BASE}/api/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, provider_type, base_url, api_key }),
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) message = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    throw new Error(message);
  }
  invalidate('models:'); // provider 变化会影响可用模型列表
  return res.json();
}

export async function apiUpdateProvider(providerId, data) {
  const res = await authFetch(`${BASE}/api/providers/${providerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) message = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    throw new Error(message);
  }
  invalidate('models:');
  return res.json();
}

export async function apiDeleteProvider(providerId) {
  await authFetch(`${BASE}/api/providers/${providerId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidate('models:');
}

export async function apiTestConnection(providerId) {
  const res = await authFetch(`${BASE}/api/providers/${providerId}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) message = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    throw new Error(message);
  }
  return res.json();
}

export async function apiOneClickSetup({ api_key }) {
  const res = await authFetch(`${BASE}/api/providers/oneclick-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key }),
  });
  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err?.detail) message = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    throw new Error(message);
  }
  invalidate('models:'); // 一键配置会批量创建 provider/model
  return res.json();
}

export async function apiOneClickCleanup() {
  const res = await authFetch(`${BASE}/api/providers/oneclick-cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidate('models:');
  return res.json();
}

// ── Models ────────────────────────────────────────────────────────────────────

export async function apiListModels({ category, fresh = false, availableOnly = false } = {}) {
  const unwrapModelResponse = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') throw new Error('模型列表响应异常，请重试');
    for (const key of ['items', 'models', 'data', 'd', 'results']) {
      if (Array.isArray(data[key])) return data[key];
    }
    throw new Error('模型列表响应异常，请重试');
  };

  const fetchModels = async () => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (availableOnly) params.append('available_only', 'true');
    const query = params.toString();
    const url = query ? `${BASE}/api/models?${query}` : `${BASE}/api/models`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('读取模型列表失败，请重试');
    return unwrapModelResponse(await res.json());
  };

  if (fresh || availableOnly) return fetchModels();

  const cachedModels = await cached(
    K.models(category),
    fetchModels,
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
  return unwrapModelResponse(cachedModels);
}

export async function apiCreateModel(data) {
  const res = await authFetch(`${BASE}/api/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('新增模型失败，请重试');
  const model = await res.json();
  if (!model || typeof model.id !== 'string' || !model.id.trim()) {
    invalidate('models:');
    throw new Error('新增结果无法确认，请重新读取列表核对');
  }
  invalidate('models:');
  return model;
}

export async function apiUpdateModel(modelId, data) {
  const res = await authFetch(`${BASE}/api/models/${modelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('更新模型失败，请重试');
  invalidate('models:');
  return res.json();
}

export async function apiDeleteModel(modelId) {
  const res = await authFetch(`${BASE}/api/models/${modelId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('删除模型失败，请重试');
  invalidate('models:');
}

export async function apiGetDefaultModels() {
  return cached(
    K.defaultModels(),
    async () => {
      const res = await authFetch(`${BASE}/api/models/defaults`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

// ── Card Visibility ───────────────────────────────────────────────────────────

export async function apiGetCardVisibility() {
  return cached(
    K.cardVisibility(),
    async () => {
      const res = await authFetch(`${BASE}/api/api-config/card-visibility`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items ?? []);
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

// ── Banner ────────────────────────────────────────────────────────────────────

export async function apiGetBanner() {
  return cached(
    K.banner(),
    async () => {
      const res = await authFetch(`${BASE}/api/api-config/banner`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

// ── Legacy aliases ────────────────────────────────────────────────────────────

export async function apiGetApiConfig() {
  const [providers, models] = await Promise.all([
    apiListProviders(),
    apiListModels(),
  ]);
  return { providers, models };
}

export async function apiSaveApiConfig({ name, provider_type, base_url, api_key }) {
  return apiCreateProvider({ name, provider_type, base_url, api_key });
}
