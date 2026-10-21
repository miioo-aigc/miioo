import { authFetch } from './request';
import { createCanvasAssetLibraryDevelopment } from './CanvasAssetLibraryDevelopment';
import { apiUpdateAsset, apiDownloadAsset } from './assets';

// 按画布资产库需求契约请求；只在显式开发开关启用时模拟，不因请求失败降级。
export const canvasLibraryMockEnabled = import.meta.env.DEV && import.meta.env.VITE_CANVAS_ASSET_LIBRARY_MOCK === 'true';
const base = `${import.meta.env.VITE_API_BASE_URL || ''}/api/canvas-asset-library`;
const development = canvasLibraryMockEnabled ? createCanvasAssetLibraryDevelopment() : null;
const key = () => crypto.randomUUID();
const messages = {
  DELETE_PREVIEW_EXPIRED: '删除确认已过期，请重新预检并确认',
  DELETE_SCOPE_CHANGED: '删除范围已改变，请重新预检并确认',
  FOLDER_CYCLE: '不能移动到自身或子文件夹',
  PROJECT_FOLDER_LOCKED: '项目文件夹不允许独立重命名或移动',
  REVISION_CONFLICT: '内容已被修改，请刷新后重试',
  PERMISSION_DENIED: '没有操作权限', ASSET_UNAVAILABLE: '素材已失效或没有访问权限',
  CROSS_COLLECTION_MOVE_FORBIDDEN: '跨集合不能移动，请通过添加素材创建引用',
  ROOT_FOLDER_CREATION_FORBIDDEN: '不能自由创建项目级集合',
  COLLECTION_NOT_FOUND: '资产集合已不存在，请刷新列表',
  SELECTION_EXPIRED: '全选范围已过期，请重新全选',
  SELECTION_SCOPE_CHANGED: '目录内容已改变，请重新全选',
  DOWNLOAD_SCOPE_CHANGED: '下载范围已改变，请重新预检',
};

async function request(path, method = 'GET', body, signal) {
  const response = await authFetch(`${base}${path}`, {
    method, signal, headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code || data.detail?.code;
    const serverMessage = data.message || data.detail?.message || (typeof data.detail === 'string' ? data.detail : null);
    const fallback = response.status === 404
      ? (path.startsWith('/folders/') ? '文件夹不存在或已删除，请返回上一级后重试' : '画布资产请求失败（404），请检查请求地址与服务配置')
      : '画布资产操作失败，请稍后重试';
    throw Object.assign(new Error(messages[code] || (typeof serverMessage === 'string' ? serverMessage : null) || fallback), { code, status: response.status });
  }
  return data;
}

async function settle(result) {
  if (result?.status === 'failed') throw new Error(result.error?.message || '后台操作失败');
  if (!['pending', 'processing'].includes(result?.status)) return result?.result ?? result;
  if (!result.operation_id) throw new Error('服务端未返回操作编号，请刷新确认结果');
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const operation = await request(`/operations/${encodeURIComponent(result.operation_id)}`);
    if (operation.status === 'completed') return operation.result ?? operation;
    if (operation.status === 'failed') throw new Error('后台操作失败，请刷新确认当前状态');
  }
  throw new Error('后台仍在处理中，请稍后刷新确认结果，不要重复提交');
}

export const canvasAssetLibrary = {
  collections: (params = {}, signal) => development ? development.collections(params) : request(`/collections?${new URLSearchParams(params)}`, 'GET', undefined, signal),
  renameCollection: (id, body) => development ? development.renameCollection(id, body) : request(`/collections/${encodeURIComponent(id)}`, 'PATCH', { ...body, idempotency_key: key() }).then(settle),
  copyCollection: (id, body) => development ? development.copyCollection(id, body) : request(`/collections/${encodeURIComponent(id)}/copies`, 'POST', { idempotency_key: key(), ...body }),
  previewDownload: (id) => development ? development.previewDownload(id) : request(`/collections/${encodeURIComponent(id)}/downloads/preview`, 'POST', {}),
  downloadCollection: (id, body) => development ? development.downloadCollection(id, body) : request(`/collections/${encodeURIComponent(id)}/downloads`, 'POST', { idempotency_key: key(), ...body }),
  operation: (id, signal) => request(`/operations/${encodeURIComponent(id)}`, 'GET', undefined, signal),
  selection: (body) => development ? development.selection(body) : request('/selections', 'POST', body),
  list: (params = {}, signal) => {
    if (development) return development.list(params);
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) if (value != null) query.set(name, value);
    return request(`/items?${query}`, 'GET', undefined, signal).then((page) => ({
      ...page, items: page.items.map((item) => item.type === 'folder' ? item : { ...item, asset_id: item.asset_id ?? item.asset?.id }),
    }));
  },
  folder: (id, signal) => development ? development.folder(id) : request(`/folders/${encodeURIComponent(id)}`, 'GET', undefined, signal),
  create: (body) => development ? development.create(body) : request('/folders', 'POST', { ...body, idempotency_key: key() }).then(settle),
  rename: (body) => {
    if (development) return development.rename(body);
    if (body.type !== 'folder') return apiUpdateAsset(body.asset_id, { name: body.name, base_revision: body.base_revision });
    return request(`/folders/${encodeURIComponent(body.id)}`, 'PATCH', { name: body.name, base_revision: body.base_revision }).then(settle);
  },
  move: (body) => development ? development.move(body) : request('/moves', 'POST', { ...body, idempotency_key: key() }).then(settle),
  references: (body) => development ? development.references(body) : request('/references', 'POST', { ...body, idempotency_key: key() }).then(settle),
  preview: (body) => development ? development.preview(body) : request('/deletions/preview', 'POST', body),
  commit: (body) => development ? development.commit(body) : request('/deletions/commit', 'POST', { ...body, idempotency_key: key() }).then(settle),
  async download(entry) {
    if (development) return { url: entry.asset.url, name: entry.asset.name };
    const blob = await apiDownloadAsset(entry.asset_id ?? entry.asset?.id);
    return { url: URL.createObjectURL(blob), name: entry.asset?.name, revoke: true };
  },
};
