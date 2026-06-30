const BASE = import.meta.env.VITE_API_BASE_URL;

import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';
import { normalizeImageUrl } from '../utils/imageUrl.js';
import { authFetch } from './request.js';
import { getDisplayErrorMessage } from './error.js';

function getErrorMessage(payload, fallback = '请求失败') {
  return getDisplayErrorMessage(payload, fallback);
}

async function parseJsonResponse(res, fallback = '请求失败') {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getErrorMessage(payload, fallback));
  }
  return payload;
}

function normalizeMediaConfig(data) {
  if (!data || typeof data !== 'object') {
    return {
      id: null,
      imageUrl: '',
      isEnabled: false,
      createdAt: null,
      updatedAt: null,
    };
  }

  const imageUrl = normalizeImageUrl(data.image_url) || data.image_url || '';

  return {
    id: data.id || null,
    imageUrl,
    isEnabled: Boolean(data.is_enabled ?? data.isEnabled ?? false),
    createdAt: data.created_at || data.createdAt || null,
    updatedAt: data.updated_at || data.updatedAt || null,
  };
}

function buildAdminAccountsParams({ page = 1, pageSize = 20, keyword = '', isActive, isAdmin } = {}) {
  return {
    page,
    pageSize,
    keyword: String(keyword || '').trim(),
    isActive: typeof isActive === 'boolean' ? isActive : undefined,
    isAdmin: typeof isAdmin === 'boolean' ? isAdmin : undefined,
  };
}

function normalizeCardVisibilityItem(item) {
  if (!item || typeof item !== 'object') return null;
  const key = String(item.card_key || item.cardKey || '').trim();
  if (!key) return null;
  return {
    key,
    isVisible: Boolean(item.is_visible ?? item.isVisible ?? true),
    updatedAt: item.updated_at || item.updatedAt || null,
  };
}

function normalizeAdminModelVisibilityItem(item) {
  if (!item || typeof item !== 'object') return null;
  const providerType = String(item.provider_type || item.providerType || '').trim();
  const category = String(item.category || '').trim();
  const modelId = String(item.model_id || item.modelId || '').trim();
  if (!providerType || !category || !modelId) return null;
  return {
    providerType,
    providerName: item.provider_name || item.providerName || providerType,
    category,
    modelId,
    name: item.name || modelId,
    isVisible: Boolean(item.is_visible ?? item.isVisible ?? true),
    updatedAt: item.updated_at || item.updatedAt || null,
  };
}

function buildAdminModelVisibilityParams({
  page = 1,
  pageSize = 20,
  keyword = '',
  providerType,
  category,
} = {}) {
  return {
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
    keyword: String(keyword || '').trim(),
    providerType: typeof providerType === 'string' ? providerType.trim() : '',
    category: typeof category === 'string' ? category.trim() : '',
  };
}

function normalizeAdminModelVisibilityListResponse(payload, paramsModel) {
  const list = Array.isArray(payload?.list)
    ? payload.list
    : Array.isArray(payload)
      ? payload
      : payload?.items;
  return {
    list: Array.isArray(list) ? list.map(normalizeAdminModelVisibilityItem).filter(Boolean) : [],
    total: Number(payload?.total || 0),
    visibleTotal: Number(payload?.visible_total || payload?.visibleTotal || 0),
    page: Number(payload?.page || paramsModel.page) || paramsModel.page,
    pageSize: Number(payload?.page_size || payload?.pageSize || paramsModel.pageSize) || paramsModel.pageSize,
    hasMore: Boolean(payload?.has_more ?? payload?.hasMore ?? false),
  };
}

function normalizeAdminAccountItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || '').trim();
  if (!id) return null;
  return {
    id,
    displayId: item.display_id || item.displayId || '',
    nickname: item.nickname || '',
    currentPhone: item.current_phone || item.currentPhone || '',
    registeredPhone: item.registered_phone || item.registeredPhone || '',
    lastLoginPhone: item.last_login_phone || item.lastLoginPhone || '',
    lastLoginAt: item.last_login_at || item.lastLoginAt || null,
    isAdmin: Boolean(item.is_admin ?? item.isAdmin ?? false),
    isActive: Boolean(item.is_active ?? item.isActive ?? true),
    createdAt: item.created_at || item.createdAt || null,
    updatedAt: item.updated_at || item.updatedAt || null,
  };
}

export async function apiGetAdminApiConfigBanner({ force = false } = {}) {
  const fetcher = async () => {
    const res = await authFetch(`${BASE}/api/api-config/banner`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return normalizeMediaConfig(await parseJsonResponse(res, '获取 API 推荐图失败'));
  };
  if (force) return fetcher();
  return cached(K.banner(), fetcher, { medium: MEDIUM.STATIC, ttl: TTL.STATIC });
}

export async function apiUpdateAdminApiConfigBanner({ image_url, is_enabled }) {
  const res = await authFetch(`${BASE}/api/api-config/banner`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: image_url || null,
      is_enabled: Boolean(is_enabled),
    }),
  });
  const payload = normalizeMediaConfig(await parseJsonResponse(res, '保存 API 推荐图失败'));
  invalidate(K.banner());
  return payload;
}

export async function apiDeleteAdminApiConfigBannerImage() {
  const res = await authFetch(`${BASE}/api/api-config/banner/image`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = normalizeMediaConfig(await parseJsonResponse(res, '删除 API 推荐图失败'));
  invalidate(K.banner());
  return payload;
}

export async function apiGetAdminCommunityQrConfig({ force = false } = {}) {
  const fetcher = async () => {
    const res = await authFetch(`${BASE}/api/community/qr-config`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return normalizeMediaConfig(await parseJsonResponse(res, '获取社群二维码配置失败'));
  };
  if (force) return fetcher();
  return cached(K.adminCommunityQr(), fetcher, { medium: MEDIUM.STATIC, ttl: TTL.STATIC });
}

export async function apiUpdateAdminCommunityQrConfig({ image_url, is_enabled }) {
  const res = await authFetch(`${BASE}/api/community/qr-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: image_url || null,
      is_enabled: Boolean(is_enabled),
    }),
  });
  const payload = normalizeMediaConfig(await parseJsonResponse(res, '保存社群二维码配置失败'));
  invalidate(K.adminCommunityQr());
  return payload;
}

export async function apiGetAdminCardVisibility({ force = false } = {}) {
  const fetcher = async () => {
    const res = await authFetch(`${BASE}/api/api-config/card-visibility`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await parseJsonResponse(res, '获取卡片显示配置失败');
    const list = Array.isArray(payload) ? payload : payload?.items;
    return Array.isArray(list)
      ? list.map(normalizeCardVisibilityItem).filter(Boolean)
      : [];
  };
  if (force) return fetcher();
  return cached(K.cardVisibility(), fetcher, { medium: MEDIUM.STATIC, ttl: TTL.STATIC });
}

export async function apiUpdateAdminCardVisibility(cardKey, { is_visible }) {
  const res = await authFetch(`${BASE}/api/api-config/card-visibility/${cardKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_visible: Boolean(is_visible),
    }),
  });
  const payload = normalizeCardVisibilityItem(
    await parseJsonResponse(res, '更新卡片显示配置失败')
  );
  invalidate(K.cardVisibility());
  return payload;
}

export async function apiGetAdminModelVisibility({
  page = 1,
  pageSize = 20,
  keyword = '',
  providerType,
  category,
  force = false,
} = {}) {
  const paramsModel = buildAdminModelVisibilityParams({
    page,
    pageSize,
    keyword,
    providerType,
    category,
  });
  const fetcher = async () => {
    const params = new URLSearchParams({
      page: String(paramsModel.page),
      page_size: String(paramsModel.pageSize),
    });
    if (paramsModel.keyword) params.set('keyword', paramsModel.keyword);
    if (paramsModel.providerType) params.set('provider_type', paramsModel.providerType);
    if (paramsModel.category) params.set('category', paramsModel.category);
    const res = await authFetch(`${BASE}/api/admin/model-visibility?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await parseJsonResponse(res, '获取模型开放配置失败');
    return normalizeAdminModelVisibilityListResponse(payload, paramsModel);
  };
  if (force) return fetcher();
  return cached(
    K.adminModelVisibility(paramsModel),
    fetcher,
    { medium: MEDIUM.STATIC, ttl: TTL.STATIC },
  );
}

export async function apiUpdateAdminModelVisibility(providerType, category, modelId, { is_visible }) {
  const encodedModelId = encodeURIComponent(modelId);
  const res = await authFetch(
    `${BASE}/api/admin/model-visibility/${encodeURIComponent(providerType)}/${encodeURIComponent(category)}/${encodedModelId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: Boolean(is_visible) }),
    }
  );
  const payload = normalizeAdminModelVisibilityItem(
    await parseJsonResponse(res, '更新模型开放状态失败')
  );
  invalidate(K.adminModelVisibilityPrefix());
  invalidate('models:');
  invalidate(K.defaultModels());
  return payload;
}

export async function apiGetAdminUserAccounts({
  page = 1,
  pageSize = 20,
  keyword = '',
  isActive,
  isAdmin,
  force = false,
} = {}) {
  const paramsModel = buildAdminAccountsParams({
    page,
    pageSize,
    keyword,
    isActive,
    isAdmin,
  });
  const fetcher = async () => {
    const params = new URLSearchParams({
      page: String(paramsModel.page),
      page_size: String(paramsModel.pageSize),
    });
    if (paramsModel.keyword) {
      params.set('keyword', paramsModel.keyword);
    }
    if (typeof paramsModel.isActive === 'boolean') {
      params.set('is_active', String(paramsModel.isActive));
    }
    if (typeof paramsModel.isAdmin === 'boolean') {
      params.set('is_admin', String(paramsModel.isAdmin));
    }
    const res = await authFetch(`${BASE}/api/users/admin/accounts?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await parseJsonResponse(res, '获取账号管理列表失败');
    const list = Array.isArray(payload?.list) ? payload.list : [];
    return {
      list: list.map(normalizeAdminAccountItem).filter(Boolean),
      total: Number(payload?.total || 0),
      page: Number(payload?.page || paramsModel.page) || paramsModel.page,
      pageSize: Number(payload?.page_size || payload?.pageSize || paramsModel.pageSize) || paramsModel.pageSize,
      hasMore: Boolean(payload?.has_more ?? payload?.hasMore ?? false),
    };
  };
  if (force) return fetcher();
  return cached(
    K.adminAccounts(paramsModel),
    fetcher,
    { medium: MEDIUM.LIST, ttl: TTL.LIST },
  );
}

export async function apiUpdateAdminUserAccount(userId, payload = {}) {
  const body = {};
  if (typeof payload.nickname === 'string') {
    body.nickname = payload.nickname.trim();
  }
  if (typeof payload.phone === 'string') {
    body.phone = payload.phone.trim();
  }
  if (typeof payload.isActive === 'boolean') {
    body.is_active = payload.isActive;
  }
  if (typeof payload.isAdmin === 'boolean') {
    body.is_admin = payload.isAdmin;
  }

  const res = await authFetch(`${BASE}/api/users/admin/accounts/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const account = normalizeAdminAccountItem(
    await parseJsonResponse(res, '更新账号信息失败')
  );
  invalidate(K.adminAccountsPrefix());
  return account;
}
