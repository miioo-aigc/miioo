const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { throwResponseError } from './error.js';

export const LIVE_MATERIAL_AUTH_COMPLETED_EVENT = 'miioo:live-material-auth-complete';
export const LIVE_MATERIAL_AUTH_STORAGE_KEY = 'miioo_live_material_auth_result';

async function parseError(res, fallbackMessage) {
  await throwResponseError(res, fallbackMessage || `请求失败（${res.status}）`);
}

async function ensureOk(res, fallbackMessage) {
  if (!res.ok) {
    await parseError(res, fallbackMessage);
  }
  return res;
}

function normalizeAuthPayload(payload = {}) {
  return {
    session_id: payload.session_id ?? payload.sessionId,
    result_code: payload.result_code ?? payload.resultCode,
    byted_token: payload.byted_token ?? payload.bytedToken,
    query_params: payload.query_params ?? payload.queryParams ?? {},
  };
}

function normalizeAssetPayload(payload = {}) {
  return {
    url: String(payload.url || '').trim(),
    asset_type: String(payload.asset_type ?? payload.assetType ?? 'image').trim(),
    name: String(payload.name || '').trim() || undefined,
  };
}

function normalizeUploadAssetType(value) {
  const normalized = String(value ?? 'image').trim().toLowerCase();
  return normalized === 'video' ? 'video' : 'image';
}

function safeFileName(file) {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const base = file.name.slice(0, file.name.length - ext.length);
  const safeBase = base.replace(/[^\x00-\x7F]/g, '_') || 'upload';
  return safeBase + ext;
}

export function storeLiveMaterialAuthResult(payload) {
  try {
    sessionStorage.setItem(LIVE_MATERIAL_AUTH_STORAGE_KEY, JSON.stringify(payload || {}));
  } catch {}
}

export function readLiveMaterialAuthResult() {
  try {
    const raw = sessionStorage.getItem(LIVE_MATERIAL_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLiveMaterialAuthResult() {
  try {
    sessionStorage.removeItem(LIVE_MATERIAL_AUTH_STORAGE_KEY);
  } catch {}
}

export function emitLiveMaterialAuthCompleted(payload) {
  storeLiveMaterialAuthResult(payload);
  window.dispatchEvent(new CustomEvent(LIVE_MATERIAL_AUTH_COMPLETED_EVENT, {
    detail: payload || {},
  }));
}

export async function apiCreateLiveMaterialAuthSession(payload = {}) {
  const res = await authFetch(`${BASE}/api/live-materials/auth-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: payload.source,
      project_id: payload.project_id ?? payload.projectId,
      storyboard_id: payload.storyboard_id ?? payload.storyboardId,
      return_path: payload.return_path ?? payload.returnPath ?? '/',
    }),
  });
  await ensureOk(res, '创建真人认证会话失败');
  return res.json();
}

export async function apiCompleteLiveMaterialAuthSession(payload = {}) {
  const normalized = normalizeAuthPayload(payload);
  const sessionId = String(normalized.session_id || '').trim();
  if (!sessionId) {
    throw new Error('缺少 session_id，无法完成真人认证');
  }
  const res = await authFetch(
    `${BASE}/api/live-materials/auth-sessions/${encodeURIComponent(sessionId)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result_code: normalized.result_code,
        byted_token: normalized.byted_token,
        query_params: normalized.query_params,
      }),
    }
  );
  await ensureOk(res, '完成真人认证失败');
  return res.json();
}

export async function apiListLiveMaterialGroups() {
  const res = await authFetch(`${BASE}/api/live-materials/groups`, {
    headers: { 'Content-Type': 'application/json' },
  });
  await ensureOk(res, '获取真人素材组失败');
  return res.json();
}

export async function apiListLiveMaterialAssets(groupId) {
  const normalizedGroupId = String(groupId || '').trim();
  if (!normalizedGroupId) {
    throw new Error('缺少真人素材组 ID');
  }
  const res = await authFetch(
    `${BASE}/api/live-materials/groups/${encodeURIComponent(normalizedGroupId)}/assets`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  await ensureOk(res, '获取真人素材列表失败');
  return res.json();
}

export async function apiCreateLiveMaterialAsset(groupId, payload = {}) {
  const normalizedGroupId = String(groupId || '').trim();
  if (!normalizedGroupId) {
    throw new Error('缺少真人素材组 ID');
  }
  const normalized = normalizeAssetPayload(payload);
  if (!normalized.url) {
    throw new Error('请先填写素材公网地址');
  }
  const res = await authFetch(
    `${BASE}/api/live-materials/groups/${encodeURIComponent(normalizedGroupId)}/assets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    }
  );
  await ensureOk(res, '创建真人素材失败');
  return res.json();
}

export async function apiUploadLiveMaterialAsset(groupId, payload = {}) {
  const normalizedGroupId = String(groupId || '').trim();
  if (!normalizedGroupId) {
    throw new Error('缺少真人素材组 ID');
  }
  const file = payload?.file;
  if (!(file instanceof File)) {
    throw new Error('请选择要上传的图片或视频文件');
  }

  const form = new FormData();
  form.append('file', file, safeFileName(file));
  form.append('asset_type', normalizeUploadAssetType(payload.asset_type ?? payload.assetType));
  const name = String(payload.name || '').trim();
  if (name) {
    form.append('name', name);
  }

  const res = await authFetch(
    `${BASE}/api/live-materials/groups/${encodeURIComponent(normalizedGroupId)}/assets/upload`,
    {
      method: 'POST',
      body: form,
    }
  );
  await ensureOk(res, '上传真人素材失败');
  return res.json();
}

export async function apiGetLiveMaterialAsset(assetId, { refresh = true } = {}) {
  const normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId) {
    throw new Error('缺少真人素材 ID');
  }
  const query = refresh ? '?refresh=true' : '?refresh=false';
  const res = await authFetch(
    `${BASE}/api/live-materials/assets/${encodeURIComponent(normalizedAssetId)}${query}`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  await ensureOk(res, '获取真人素材详情失败');
  return res.json();
}

export async function waitForLiveMaterialAssetReady(
  assetId,
  {
    maxAttempts = 12,
    intervalMs = 2000,
  } = {}
) {
  let latest = null;
  for (let i = 0; i < maxAttempts; i += 1) {
    latest = await apiGetLiveMaterialAsset(assetId, { refresh: true });
    const status = String(latest?.status || '').trim().toLowerCase();
    if (status === 'active' || status === 'failed') {
      return latest;
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
  return latest;
}
