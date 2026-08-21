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

function unwrapLiveMaterialAsset(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return payload.asset || payload.data || payload.result || payload;
}

function getLiveMaterialSourceUrl(asset) {
  return asset?.download_url
    || asset?.downloadUrl
    || asset?.original_url
    || asset?.originalUrl
    || asset?.source_url
    || asset?.sourceUrl
    || asset?.preview_url
    || asset?.previewUrl
    || asset?.file_url
    || asset?.fileUrl
    || null;
}

/**
 * 受控素材下载地址不能直接交给 img 标签：标签请求无法附带 Bearer Token，
 * 短时令牌过期后会返回 401。这里经 authFetch 下载后转为当前页面可用的 Blob URL。
 */
export async function apiGetLiveMaterialPreview(assetId) {
  const payload = await apiGetLiveMaterialAsset(assetId);
  const asset = unwrapLiveMaterialAsset(payload);
  const sourceUrl = getLiveMaterialSourceUrl(asset);
  if (!sourceUrl) return { asset, previewUrl: null };

  // COS 等外部地址可能没有 CORS 配置。图片标签不需要读取响应内容，
  // 直接加载不会触发带 Authorization 头的预检；仅本站受控媒体需要鉴权下载为 Blob。
  if (/^https?:\/\//i.test(sourceUrl)) {
    return { asset, previewUrl: sourceUrl };
  }

  const mediaUrl = `${BASE || ''}${sourceUrl.startsWith('/') ? '' : '/'}${sourceUrl}`;
  const res = await authFetch(mediaUrl);
  if (!res.ok) throw new Error(`获取素材预览失败: ${res.status}`);
  const blob = await res.blob();
  return { asset, previewUrl: URL.createObjectURL(blob) };
}

const liveMaterialPreviewByRef = new Map();

/**
 * 根据 Seedance 返回的 asset:// 身份反查真人素材，并获取当前页面可用的预览地址。
 * asset:// 不是浏览器地址，不能直接交给 img；反查只使用素材库已有的 asset_ref_url 映射。
 */
export async function apiGetLiveMaterialPreviewByRef(assetRefUrl) {
  if (!assetRefUrl) return null;
  if (!String(assetRefUrl).startsWith('asset://')) return assetRefUrl;

  const ref = String(assetRefUrl);
  if (liveMaterialPreviewByRef.has(ref)) return liveMaterialPreviewByRef.get(ref);

  const request = (async () => {
    const groupsPayload = await apiListLiveMaterialGroups();
    const groups = Array.isArray(groupsPayload)
      ? groupsPayload
      : (groupsPayload?.list ?? groupsPayload?.items ?? groupsPayload?.data ?? []);
    const assetsByGroup = await Promise.all(groups.map(async (group) => {
      if (!group?.id) return [];
      try {
        const payload = await apiListLiveMaterialAssets(group.id);
        return Array.isArray(payload)
          ? payload
          : (payload?.list ?? payload?.items ?? payload?.data ?? []);
      } catch {
        return [];
      }
    }));
    const asset = assetsByGroup.flat().find((item) => (
      item?.asset_ref_url === ref || item?.assetRefUrl === ref
    ));
    if (!asset?.id) return null;
    const { previewUrl } = await apiGetLiveMaterialPreview(asset.id);
    return previewUrl;
  })();

  liveMaterialPreviewByRef.set(ref, request);
  try {
    return await request;
  } catch (error) {
    liveMaterialPreviewByRef.delete(ref);
    throw error;
  }
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

/** 获取项目主体与真人素材组的归档绑定及审核状态 */
export async function apiListLiveMaterialSubjectBindings(projectId) {
  const res = await authFetch(`${BASE}/api/live-materials/projects/${projectId}/subject-bindings`);
  if (!res.ok) {
    const error = new Error(`获取主体真人认证状态失败: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/** 将主体当前定稿图归档到指定真人素材组并发起认证 */
export async function apiBindSubjectFinalAsset(groupId, { project_id, subject_id } = {}) {
  const res = await authFetch(`${BASE}/api/live-materials/groups/${groupId}/subject-final-assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id, subject_id }),
  });
  if (!res.ok) throw new Error(`提交真人素材认证失败: ${res.status}`);
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
