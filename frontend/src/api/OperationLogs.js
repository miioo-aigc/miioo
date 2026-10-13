import { authFetch } from './request.js';
import { getDisplayErrorMessage } from './error.js';

const BASE = import.meta.env.VITE_API_BASE_URL;

async function readOperationLogResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(getDisplayErrorMessage(payload, '获取操作日志失败'));
  }
  return payload;
}

export function normalizeOperationLog(raw) {
  if (!raw?.id) return null;
  return {
    id: raw.id, source: raw.source || '', createdAt: raw.created_at || '',
    actor: raw.actor || null, feature: raw.feature || '', featureLabel: raw.feature_label || '',
    action: raw.action || '', actionLabel: raw.action_label || '', model: raw.model || '',
    provider: raw.provider || '', targetType: raw.target_type || '', targetId: raw.target_id || '',
    projectId: raw.project_id || '', result: raw.result || 'pending', resultLabel: raw.result_label || '',
    errorMessage: raw.error_message || '', detail: raw.detail && typeof raw.detail === 'object' ? raw.detail : null,
  };
}

export async function apiGetAdminOperationLogs({ page = 1, pageSize = 20, action = [], signal, ...filters } = {}) {
  const query = new URLSearchParams({ page, page_size: pageSize });
  for (const key of ['keyword', 'feature', 'model', 'result', 'start', 'end']) {
    if (filters[key]) query.set(key, String(filters[key]).trim());
  }
  for (const value of (Array.isArray(action) ? action : [action]).filter(Boolean)) query.append('action', value);
  const response = await authFetch(`${BASE}/api/admin/operation-logs?${query}`, { signal });
  const data = await readOperationLogResponse(response);
  const options = {};
  for (const key of ['features', 'actions', 'models', 'results']) {
    options[key] = (Array.isArray(data.filter_options?.[key]) ? data.filter_options[key] : [])
      .filter((item) => item?.value).map((item) => ({ value: String(item.value), label: String(item.label || item.value) }));
  }
  return {
    list: (Array.isArray(data.list) ? data.list : []).map(normalizeOperationLog).filter(Boolean),
    total: Number(data.total) || 0, page: Number(data.page) || page,
    pageSize: Number(data.page_size) || pageSize,
    hasMore: data.has_more ?? (page * pageSize < Number(data.total)), filterOptions: options,
  };
}
