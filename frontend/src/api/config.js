const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { throwResponseError } from './error.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';
async function readJson(res, fallback, options) {
  if (!res.ok) {
    await throwResponseError(res, fallback, options);
  }
  return res.json();
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function apiListProviders() {
  const res = await authFetch(`${BASE}/api/providers`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return readJson(res, `获取服务商失败（${res.status}）`);
}

export async function apiCreateProvider({ name, provider_type, base_url, api_key }) {
  const res = await authFetch(`${BASE}/api/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, provider_type, base_url, api_key }),
  });
  const payload = await readJson(res, `保存服务商失败（${res.status}）`);
  invalidate('models:'); // provider 变化会影响可用模型列表
  return payload;
}

export async function apiUpdateProvider(providerId, data) {
  const res = await authFetch(`${BASE}/api/providers/${providerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await readJson(res, `更新服务商失败（${res.status}）`);
  invalidate('models:');
  return payload;
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
  return readJson(res, `连接测试失败（${res.status}）`, { showDialog: true, title: '连接失败' });
}

export async function apiOneClickSetup({ api_key }) {
  const res = await authFetch(`${BASE}/api/providers/oneclick-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key }),
  });
  const payload = await readJson(res, `一键配置失败（${res.status}）`, { showDialog: true, title: '配置失败' });
  invalidate('models:'); // 一键配置会批量创建 provider/model
  return payload;
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

export async function apiListModels({ category, availableOnly = true } = {}) {
  return cached(
    K.models(category, { availableOnly }),
    async () => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (availableOnly) params.append('available_only', 'true');
      const query = params.toString();
      const url = query ? `${BASE}/api/models?${query}` : `${BASE}/api/models`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      return readJson(res, `获取模型列表失败（${res.status}）`);
    },
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiCreateModel(data) {
  const res = await authFetch(`${BASE}/api/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidate('models:');
  return res.json();
}

export async function apiUpdateModel(modelId, data) {
  const res = await authFetch(`${BASE}/api/models/${modelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidate('models:');
  return res.json();
}

export async function apiDeleteModel(modelId) {
  await authFetch(`${BASE}/api/models/${modelId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
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
    apiListModels({ availableOnly: true }),
  ]);
  return { providers, models };
}

export async function apiSaveApiConfig({ name, provider_type, base_url, api_key }) {
  return apiCreateProvider({ name, provider_type, base_url, api_key });
}
