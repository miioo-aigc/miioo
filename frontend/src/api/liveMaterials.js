import { authFetch } from './request.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

/** 创建真人认证会话，返回 { session_id, h5_link, launch_url, callback_url, expires_at } */
export async function apiCreateLiveMaterialAuthSession({ source, project_id, storyboard_id, return_path } = {}) {
  const res = await authFetch(`${BASE}/api/live-materials/auth-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, project_id, storyboard_id, return_path }),
  });
  if (!res.ok) throw new Error(`创建认证会话失败: ${res.status}`);
  return res.json();
}

/** 查询认证会话状态，返回 { status: 'pending'|'completed'|'failed', group: ...| null } */
export async function apiGetLiveMaterialAuthSessionStatus(sessionId) {
  const res = await authFetch(`${BASE}/api/live-materials/auth-sessions/${sessionId}/status`);
  if (!res.ok) throw new Error(`查询认证会话状态失败: ${res.status}`);
  return res.json();
}

/** 创建无需真人认证的 AIGC 素材组，返回 LiveMaterialGroupResponse */
export async function apiCreateAigcMaterialGroup({ name, description } = {}) {
  const res = await authFetch(`${BASE}/api/live-materials/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, group_type: 'AIGC' }),
  });
  if (!res.ok) throw new Error(`创建AIGC素材组失败: ${res.status}`);
  return res.json();
}

/** 更新素材组名称/描述，返回更新后的 LiveMaterialGroupResponse */
export async function apiUpdateLiveMaterialGroup(groupId, { name, description } = {}) {
  const res = await authFetch(`${BASE}/api/live-materials/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(`更新素材组失败: ${res.status}`);
  return res.json();
}

/** 获取单个真人素材详情 */
export async function apiGetLiveMaterialAsset(assetId) {
  const res = await authFetch(`${BASE}/api/live-materials/assets/${assetId}`);
  if (!res.ok) throw new Error(`获取素材详情失败: ${res.status}`);
  return res.json();
}

/** 删除真人素材 */
export async function apiDeleteLiveMaterialAsset(assetId) {
  const res = await authFetch(`${BASE}/api/live-materials/assets/${assetId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`删除素材失败: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** 删除素材组及其所有素材 */
export async function apiDeleteLiveMaterialGroup(groupId) {
  const res = await authFetch(`${BASE}/api/live-materials/groups/${groupId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`删除素材组失败: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** 获取真人素材组列表，返回 LiveMaterialGroupResponse[] */
export async function apiListLiveMaterialGroups() {
  const res = await authFetch(`${BASE}/api/live-materials/groups`);
  if (!res.ok) throw new Error(`获取真人素材组失败: ${res.status}`);
  return res.json();
}

/** 获取指定组的素材列表，返回 LiveMaterialAssetResponse[]
 * @param {string} groupId
 * @param {{ refresh?: boolean }} options - refresh=true 触发从 OneLinkAI 上游同步最新状态
 */
export async function apiListLiveMaterialAssets(groupId, { refresh } = {}) {
  const url = refresh
    ? `${BASE}/api/live-materials/groups/${groupId}/assets?refresh=true`
    : `${BASE}/api/live-materials/groups/${groupId}/assets`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`获取真人素材失败: ${res.status}`);
  return res.json();
}

/** 上传真人素材文件（multipart），返回 LiveMaterialAssetResponse */
export async function apiUploadLiveMaterialAsset(groupId, file, assetType = 'image', name) {
  const form = new FormData();
  form.append('file', file);
  form.append('asset_type', assetType);
  if (name) form.append('name', name);
  const res = await authFetch(`${BASE}/api/live-materials/groups/${groupId}/assets/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`上传真人素材失败: ${res.status}`);
  return res.json();
}
