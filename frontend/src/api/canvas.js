import { authFetch } from './request.js';
import { throwResponseError } from './error.js';
import { getDevelopmentCanvas, isDevelopmentCanvas } from './CanvasDevelopment.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

function canvasUrl(path = '') {
  return `${BASE}/api/canvas-documents${path}`;
}

export async function apiListCanvasDocuments({ search, page = 1, pageSize = 100 } = {}) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set('search', search);
  const response = await authFetch(`${canvasUrl()}?${params.toString()}`, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) await throwResponseError(response, `获取画布列表失败（${response.status}）`);
  return response.json();
}

export async function apiCreateCanvasDocument({ title = '未命名画布', clientRequestId } = {}) {
  const response = await authFetch(canvasUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, project_id: null, client_request_id: clientRequestId || null }),
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

export async function apiUpdateCanvasDocument(canvasId, { baseRevision, title, projectId, document, clientSavedAt, reconciledRunIds }) {
  const response = await authFetch(canvasUrl(`/${encodeURIComponent(canvasId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_revision: baseRevision,
      ...(title !== undefined ? { title } : {}),
      ...(projectId !== undefined ? { project_id: projectId } : {}),
      ...(document !== undefined ? { document } : {}),
      ...(clientSavedAt ? { client_saved_at: clientSavedAt } : {}),
      ...(reconciledRunIds ? { reconciled_run_ids: reconciledRunIds } : {}),
    }),
  });
  if (!response.ok) await throwResponseError(response, `保存画布名称失败（${response.status}）`);
  return response.json();
}

export function normalizeCanvasDocument(item) {
  return { ...item, id: item?.id, name: item?.title || '未命名画布' };
}
