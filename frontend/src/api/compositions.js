const BASE = import.meta.env.VITE_API_BASE_URL || '';

import { authFetch } from './request.js';
import { createDisplayError, throwResponseError } from './error.js';
import { invalidate } from '../utils/cache.js';
import { K, MEDIUM } from '../utils/cacheKeys.js';

async function ensureOk(res, fallback) {
  if (!res.ok) {
    await throwResponseError(res, fallback || `请求失败（${res.status}）`);
  }
  return res;
}

// 成片工程接口都属于项目作用域，空 ID 属于调用方误用，直接拦截并给用户中文提示。
function assertId(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw createDisplayError(`${label}无效，已拦截错误请求`);
  }
  return normalized;
}

/**
 * 归一化成片工程视图模型（兼容后端 snake_case 与前端 camelCase）。
 * 非对象输入返回 null，由调用方过滤，避免脏数据进入页面。
 */
export function normalizeComposition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: raw.id ?? null,
    episodeId: raw.episodeId ?? raw.episode_id ?? null,
    name: raw.name ?? '',
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    libraryAssetIds: raw.libraryAssetIds ?? raw.library_asset_ids ?? [],
    trackSettings: raw.trackSettings ?? raw.track_settings ?? {},
    resolution: raw.resolution ?? '',
    aspectRatio: raw.aspectRatio ?? raw.aspect_ratio ?? '',
    status: raw.status ?? '',
    outputUrl: raw.outputUrl ?? raw.output_url ?? null,
    taskId: raw.taskId ?? raw.task_id ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
  };
}

/**
 * 成片工程写操作后统一失效：刷新资产库（导出产出的 film 资产可见）+ 项目概览 + 成片工程缓存。
 */
export function invalidateCompositionDependents(projectId) {
  if (!projectId) return;
  invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
  invalidate(K.projectOverview(projectId));
  invalidate(`compositions:${projectId}:`, MEDIUM.CONTENT);
}

// 仅把提供的字段放入请求体，未传字段保持 undefined 不入 body（PATCH 语义）。
export function buildCompositionBody({ name, timeline, resolution, aspectRatio, libraryAssetIds, trackSettings, episodeId }) {
  const body = {};
  if (episodeId !== undefined) body.episode_id = episodeId;
  if (name !== undefined) body.name = name;
  if (timeline !== undefined) body.timeline = timeline;
  if (resolution !== undefined) body.resolution = resolution;
  if (aspectRatio !== undefined) body.aspect_ratio = aspectRatio;
  if (libraryAssetIds !== undefined) body.library_asset_ids = libraryAssetIds;
  if (trackSettings !== undefined) body.track_settings = trackSettings;
  return body;
}

export async function apiGetCompositions(projectId, episodeId) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  const query = episodeId != null ? '?' + new URLSearchParams({ episode_id: assertId(episodeId, '分集 ID ') }) : '';
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions${query}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  await ensureOk(res, `加载成片工程列表失败（${res.status}）`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (Array.isArray(data?.list) ? data.list : []);
  return list.map(normalizeComposition).filter((item) => item && (episodeId == null || String(item.episodeId) === String(episodeId)));
}

export async function apiCreateComposition(projectId, opts = {}) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  assertId(opts.episodeId, '分集 ID ');
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCompositionBody(opts)),
  });
  await ensureOk(res, `创建成片工程失败（${res.status}）`);
  const data = await res.json();
  invalidateCompositionDependents(normalizedProjectId);
  const draft = normalizeComposition(data || {});
  if (String(draft.episodeId) !== String(opts.episodeId)) {
    throw createDisplayError('后端未正确返回草稿分集归属，请联系后端确认 episode_id 支持后再重试');
  }
  return draft;
}

export async function apiUpdateComposition(projectId, compId, opts = {}) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  const normalizedCompId = assertId(compId, '成片工程 ID ');
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions/${normalizedCompId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCompositionBody(opts)),
  });
  await ensureOk(res, `更新成片工程失败（${res.status}）`);
  const data = await res.json();
  invalidateCompositionDependents(normalizedProjectId);
  return normalizeComposition(data || {});
}

export async function apiRenderComposition(projectId, compId) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  const normalizedCompId = assertId(compId, '成片工程 ID ');
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions/${normalizedCompId}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  await ensureOk(res, `发起成片导出任务失败（${res.status}）`);
  const data = await res.json();
  return normalizeComposition(data || {});
}

export async function apiDeleteComposition(projectId, compId) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  const normalizedCompId = assertId(compId, '成片工程 ID ');
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions/${normalizedCompId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  await ensureOk(res, `删除成片工程失败（${res.status}）`);
  const data = await res.json();
  invalidateCompositionDependents(normalizedProjectId);
  return data || { message: '已删除' };
}

/**
 * 导出剪映（JianyingPro）工程包 ZIP。
 *
 * 入参 storyboard_ids 决定时间线内容；后端按 `sort_order → shot_number` 重排，
 * 故调用方传入顺序不影响成片顺序，重复 ID 在此去重。
 *
 * 返回**原始 Response**而非 Blob：必须交给 `downloadResponse()` 消费，才能从
 * `Content-Disposition` 里解析出后端用 RFC 5987 编码的中文真实文件名
 * （`<项目名>_剪映工程包.zip`），并识别「HTTP 200 但内容是错误页」的情况。
 */
export async function apiExportJianyingDraft(projectId, { storyboardIds = [], projectName = '' } = {}) {
  const normalizedProjectId = assertId(projectId, '项目 ID ');
  const ids = [...new Set((storyboardIds || []).filter(Boolean).map(String))];
  const res = await authFetch(`${BASE}/api/projects/${normalizedProjectId}/compositions/export-jianying`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyboard_ids: ids,
      project_name: typeof projectName === 'string' ? projectName.trim() : '',
    }),
  });
  await ensureOk(res, `导出剪映工程包失败（${res.status}）`);
  return res;
}
