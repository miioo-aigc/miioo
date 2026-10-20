import { authFetch } from './request.js';
import { throwResponseError } from './error.js';
import { archiveDevelopmentCanvas, duplicateDevelopmentCanvas, getDevelopmentCanvas, isDevelopmentCanvas, updateDevelopmentCanvas } from './CanvasDevelopment.js';

const BASE = import.meta.env.VITE_API_BASE_URL;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reorderQueues = new Map();

function canvasUrl(path = '') {
  return `${BASE}/api/canvas-documents${path}`;
}

/** 同一作用域串行提交；失败不自动重试，不提供跨标签页并发保护。 */
export async function apiReorderCanvasDocuments({ projectId = null, parentCanvasId = null, orderedCanvasIds, signal } = {}) {
  if ([projectId, parentCanvasId].some((id) => id !== null && (typeof id !== 'string' || !UUID.test(id)))) {
    throw new Error('排序作用域必须使用正式项目或父画布编号，不能使用模拟编号');
  }
  if (!Array.isArray(orderedCanvasIds) || !orderedCanvasIds.length
    || orderedCanvasIds.some((id) => typeof id !== 'string' || !UUID.test(id))
    || new Set(orderedCanvasIds.map((id) => id.toLowerCase())).size !== orderedCanvasIds.length) {
    throw new Error('排序需提供非空、不重复的正式画布编号数组');
  }
  const body = JSON.stringify({ project_id: projectId, parent_canvas_id: parentCanvasId, ordered_canvas_ids: orderedCanvasIds });
  const scope = JSON.stringify([projectId?.toLowerCase() ?? null, parentCanvasId?.toLowerCase() ?? null]);
  const pending = (reorderQueues.get(scope) || Promise.resolve()).catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    const response = await authFetch(canvasUrl('/reorder'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal,
    });
    if (!response.ok) await throwCanvasResponseError(response, `画布排序失败（${response.status}）`);
    return response.json();
  });
  reorderQueues.set(scope, pending);
  try { return await pending; }
  finally { if (reorderQueues.get(scope) === pending) reorderQueues.delete(scope); }
}

export async function apiListCanvasDocuments({ search, projectId, page = 1, pageSize = 100 } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set('search', search);
  if (projectId) params.set('project_id', projectId);
  const response = await authFetch(`${canvasUrl()}?${params.toString()}`, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) await throwResponseError(response, `获取画布列表失败（${response.status}）`);
  return response.json();
}

export async function apiCreateCanvasDocument({ title = '未命名画布', projectId = null, clientRequestId } = {}) {
  const response = await authFetch(canvasUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, project_id: projectId, client_request_id: clientRequestId || null }),
  });
  if (!response.ok) await throwResponseError(response, `创建画布失败（${response.status}）`);
  return response.json();
}

export async function apiGetCanvasDocument(canvasId) {
  if (isDevelopmentCanvas(canvasId)) return getDevelopmentCanvas(canvasId);
  const response = await authFetch(canvasUrl(`/${encodeURIComponent(canvasId)}`), { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) await throwResponseError(response, `获取画布详情失败（${response.status}）`);
  return response.json();
}

export async function apiUpdateCanvasDocument(canvasId, { baseRevision, title, projectId, document, clientSavedAt, reconciledRunIds, clientSaveId }) {
  if (isDevelopmentCanvas(canvasId)) return updateDevelopmentCanvas(canvasId, { baseRevision, title, document });
  const response = await authFetch(canvasUrl(`/${encodeURIComponent(canvasId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_revision: baseRevision,
      ...(clientSaveId ? { client_save_id: clientSaveId } : {}),
      ...(title !== undefined ? { title } : {}),
      ...(projectId !== undefined ? { project_id: projectId } : {}),
      ...(document !== undefined ? { document } : {}),
      ...(clientSavedAt ? { client_saved_at: clientSavedAt } : {}),
      ...(reconciledRunIds ? { reconciled_run_ids: reconciledRunIds } : {}),
    }),
  });
  if (!response.ok) await throwCanvasResponseError(response, `保存画布失败（${response.status}）`);
  return response.json();
}

// 保留冲突版本和回填原因，不改变其他业务域的错误处理。
export async function throwCanvasResponseError(response, fallback) {
  try {
    await throwResponseError(response, fallback);
  } catch (error) {
    const detail = error.rawPayload?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      error.code = detail.code;
      error.detail = detail;
    }
    throw error;
  }
}

async function canvasAction(canvasId, suffix, { method = 'GET', body, signal } = {}) {
  if (!canvasId || isDevelopmentCanvas(canvasId)) {
    throw new Error('此操作需要正式后端画布，开发模拟画布不支持');
  }
  const response = await authFetch(canvasUrl(`/${encodeURIComponent(canvasId)}${suffix}`), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  if (!response.ok) await throwCanvasResponseError(response, `画布操作失败（${response.status}）`);
  return response.status === 204 ? null : response.json();
}

/** 仅归档指定画布，不代表项目删除，不在前端推断级联规则。 */
export function apiArchiveCanvasDocument(canvasId, { signal } = {}) {
  if (isDevelopmentCanvas(canvasId)) return Promise.resolve(archiveDevelopmentCanvas(canvasId));
  return canvasAction(canvasId, '', { method: 'DELETE', signal });
}

export function apiDuplicateCanvasDocument(canvasId, { title, clientRequestId } = {}) {
  if (isDevelopmentCanvas(canvasId)) return Promise.resolve(duplicateDevelopmentCanvas(canvasId, { title }));
  return canvasAction(canvasId, '/duplicate', { method: 'POST', body: { title, client_request_id: clientRequestId } });
}

/** 返回运行时媒体视图；调用方不得将这些地址写回画布文档。 */
export function apiResolveCanvasAssetViews(canvasId, assetIds, { signal } = {}) {
  if (!Array.isArray(assetIds) || assetIds.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new Error('资产编号必须是非空字符串数组');
  }
  const ids = [...new Set(assetIds)];
  if (ids.length > 200) throw new Error('单次最多解析200个资产');
  return canvasAction(canvasId, '/resolve-assets', { method: 'POST', body: { asset_ids: ids }, signal });
}

export function apiGetCanvasShareStatus(canvasId, { signal } = {}) {
  return canvasAction(canvasId, '/share', { signal });
}

export function apiEnableCanvasShare(canvasId, { signal } = {}) {
  return canvasAction(canvasId, '/share', { method: 'POST', signal });
}

export function apiDisableCanvasShare(canvasId, { signal } = {}) {
  return canvasAction(canvasId, '/share', { method: 'DELETE', signal });
}

function sharedCanvasUrl(token) {
  if (typeof token !== 'string' || !token.trim()) throw new Error('分享凭证不能为空');
  return `${BASE}/api/canvas-shares/${encodeURIComponent(token)}`;
}

/** 公开接口不经过登录刷新链路，也不附带登录凭证。 */
export async function apiGetSharedCanvas(token, { signal } = {}) {
  const response = await fetch(sharedCanvasUrl(token), { signal, credentials: 'omit' });
  if (!response.ok) await throwCanvasResponseError(response, `读取分享画布失败（${response.status}）`);
  return response.json();
}

/** 仅导入为独立画布；不冒充创建项目，不自动重试写操作。 */
export async function apiImportSharedCanvas(token, { signal, clientRequestId } = {}) {
  const response = await authFetch(`${sharedCanvasUrl(token)}/import`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(clientRequestId ? { client_request_id: clientRequestId } : {}) }),
  });
  if (!response.ok) await throwCanvasResponseError(response, `导入分享画布失败（${response.status}）`);
  return response.json();
}

export function normalizeCanvasDocument(item) {
  return { ...item, id: item?.id, name: item?.title || '未命名画布' };
}

export function apiGetCanvasRuns(canvasId, { status, limit = 20, signal } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('任务查询数量需为1至100');
  const query = new URLSearchParams({ limit: String(limit) });
  if (status) query.set('status', status);
  return canvasAction(canvasId, `/runs?${query}`, { signal });
}

export function apiGetCanvasRun(canvasId, runId, { signal } = {}) {
  if (!runId) throw new Error('任务编号不能为空');
  return canvasAction(canvasId, `/runs/${encodeURIComponent(runId)}`, { signal });
}

export function apiCancelCanvasRun(canvasId, runId, { signal } = {}) {
  if (!runId) throw new Error('任务编号不能为空');
  return canvasAction(canvasId, `/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST', signal });
}

/** 只读取未对账任务，不代表已将结果回填到画布。 */
export function apiReconcileCanvasRuns(canvasId, { signal } = {}) {
  return canvasAction(canvasId, '/runs/reconcile', { method: 'POST', signal });
}
