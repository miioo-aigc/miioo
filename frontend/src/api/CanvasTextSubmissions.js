/** 持久文本任务与节点历史；所有请求复用统一鉴权层。 */
import { authFetch } from './request.js';

async function request(canvasId, nodeId, suffix, { body, signal, method = 'GET' } = {}) {
  const path = `/api/canvas-documents/${encodeURIComponent(canvasId)}/nodes/${encodeURIComponent(nodeId)}/${suffix}`;
  const response = await authFetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    method, signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const error = new Error((typeof detail?.message === 'string' && detail.message)
      || (typeof data?.message === 'string' && data.message) || `文本任务请求失败（${response.status}）`);
    error.status = response.status;
    error.code = detail?.code || data?.code;
    throw error;
  }
  if (!data || typeof data !== 'object') throw new Error('文本任务响应格式无效');
  return data;
}

export const apiSubmitCanvasText = (canvasId, nodeId, body, signal) =>
  request(canvasId, nodeId, 'text-submissions', { method: 'POST', body, signal });
export const apiGetCanvasTextSubmission = (canvasId, nodeId, id, signal) =>
  request(canvasId, nodeId, `text-submissions/${encodeURIComponent(id)}`, { signal });
export const apiCancelCanvasTextSubmission = (canvasId, nodeId, id, signal) =>
  request(canvasId, nodeId, `text-submissions/${encodeURIComponent(id)}/cancel`, { method: 'POST', signal });
export const apiGetCanvasTextBatches = (canvasId, nodeId, cursor, signal) =>
  request(canvasId, nodeId, `batches?limit=100${cursor == null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`, { signal });
export const apiMigrateCanvasText = (canvasId, nodeId, body, signal) =>
  request(canvasId, nodeId, 'migrate-legacy', { method: 'POST', body, signal });
export const apiAppendCanvasTextBatch = (canvasId, nodeId, body, signal) =>
  request(canvasId, nodeId, 'batches', { method: 'POST', body, signal });
