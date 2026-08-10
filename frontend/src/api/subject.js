const BASE = import.meta.env.VITE_API_BASE_URL;

// 确认接口当前由后端 script_structure_service 支持的结构协议版本。
export const SCRIPT_SCHEMA_VERSION = 'script_structure.v1';

import { authFetch, authFetchForm, authFetchStream } from './request.js';
import { getDisplayErrorMessage, readResponsePayload, throwResponseError } from './error.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

// 主体写操作后统一失效该项目的主体缓存 + 概览（概览含主体进度）
// 主体的候选图/参考图（生成、上传、绑定、设定稿、删除）都会同步影响
// 资产库-项目资产（按 subject_id 聚合的 category 资产），因此一并失效项目资产缓存，
// 避免资产库开启状态下看到旧数据。
function invalidateSubjects(projectId) {
  invalidate(K.subjectsPrefix(projectId));
  invalidate(K.subjectDetailPrefix(projectId));
  invalidate(K.projectOverview(projectId));
  invalidate(K.projectAssets(projectId), MEDIUM.CONTENT);
  invalidate(K.storyboardPagePrefix(projectId));
}

export async function apiGetSubjects(projectId, { type, episode_id, limit } = {}) {
  const fetchFn = async () => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (episode_id) params.append('episode_id', episode_id);
    if (limit) params.append('limit', limit);
    const query = params.toString();
    const url = query ? `${BASE}/api/projects/${projectId}/subjects?${query}` : `${BASE}/api/projects/${projectId}/subjects`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    // 后端返回 SubjectListResponse: { list: [...], total, limit, offset, has_more }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  // 有 limit 时跳过缓存直接请求；无 limit 时走正常缓存路径
  if (limit) {
    const raw = await fetchFn();
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.list)) return raw.list;
    return [];
  }

  const raw = await cached(
    K.subjects(projectId, type, episode_id),
    fetchFn,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
  // 兼容旧缓存：SWR 命中时直接返回旧缓存值，可能还是 SubjectListResponse 对象
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.list)) return raw.list;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export async function apiGetSubjectsPage(projectId, { type, episode_id, limit = 20, offset } = {}) {
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (episode_id) params.append('episode_id', episode_id);
  if (limit) params.append('limit', limit);
  if (offset != null) params.append('offset', offset);
  const query = params.toString();
  const url = query ? `${BASE}/api/projects/${projectId}/subjects?${query}` : `${BASE}/api/projects/${projectId}/subjects`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (Array.isArray(data)) return { list: data, nextOffset: null, hasMore: false, total: data.length };
  // 兼容网关或统一响应包装：{ data: { list: [...] } } / { result: { list: [...] } }。
  const payload = data?.data && typeof data.data === 'object' ? data.data
    : data?.result && typeof data.result === 'object' ? data.result
      : data;
  const list = Array.isArray(payload) ? payload : payload?.list ?? payload?.items ?? (Array.isArray(payload?.data) ? payload.data : []);
  const currentOffset = offset ?? 0;
  const hasMore = payload?.has_more ?? payload?.hasMore ?? false;
  const nextOffset = hasMore ? currentOffset + limit : null;
  return {
    list,
    nextOffset,
    hasMore,
    total: payload?.total ?? list.length,
  };
}


export async function apiGetSubjectDetail(projectId, subjectId, { fresh = false } = {}) {
  const fetchDetail = async () => {
    const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  };

  if (fresh) return fetchDetail();
  return cached(
    K.subjectDetail(projectId, subjectId),
    fetchDetail,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
}

export async function apiCreateSubject(projectId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidateSubjects(projectId);
  return res.json();
}

export async function apiUpdateSubject(projectId, subjectId, data) {
  const url = `${BASE}/api/projects/${projectId}/subjects/${subjectId}`;
  const body = JSON.stringify(data);
  const res = await authFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await res.json();
        detail = body?.detail || body?.message || '';
        if (typeof detail === 'object') detail = JSON.stringify(detail);
      } else {
        detail = await res.text();
      }
    } catch { /* 忽略非 JSON 错误响应 */ }
    const statusMessages = {
      502: '主体保存服务暂时不可用，请稍后重试',
      504: '主体保存服务响应超时，请稍后重试',
    };
    const err = new Error(statusMessages[res.status] || detail || `更新主体失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  const result = await res.json();
  invalidateSubjects(projectId);
  // 重新拉取主体列表以更新缓存，触发订阅者同步最新主图。
  // 读取 PATCH 响应后再启动刷新，避免响应体读取与缓存刷新竞态。
  Promise.all([
    apiGetSubjects(projectId, { type: 'character' }),
    apiGetSubjects(projectId, { type: 'scene' }),
    apiGetSubjects(projectId, { type: 'prop' }),
  ]).catch(() => {});
  return result;
}

export async function apiDeleteSubject(projectId, subjectId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = await res.json();
        detail = payload?.detail || payload?.message || '';
        if (typeof detail === 'object') detail = JSON.stringify(detail);
      } else {
        detail = await res.text();
      }
    } catch { /* 忽略无法读取的错误响应 */ }
    const error = new Error(detail || `删除主体失败（${res.status}）`);
    error.status = res.status;
    throw error;
  }
  invalidateSubjects(projectId);
}

export async function apiDuplicateSubject(projectId, subjectId, { target_episode_id, as_global } = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_episode_id, as_global }),
  });
  invalidateSubjects(projectId);
  return res.json();
}


// ── 主体图片 ──────────────────────────────────────────────────────────────────

export async function apiGetSubjectImages(projectId, subjectId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}/images`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

function safeUploadFileName(file) {
  const name = file?.name || 'upload';
  const extensionIndex = name.lastIndexOf('.');
  const extension = extensionIndex > 0 ? name.slice(extensionIndex) : '';
  const base = extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
  const safeBase = Array.from(base, (char) => char.codePointAt(0) < 128 ? char : '_').join('') || 'upload';
  return `${safeBase}${extension}`;
}

function readSubjectImagePayload(data) {
  return data?.subject_image || data?.subjectImage || data?.image || data?.data || data?.result || data;
}

/** 主体候选图专用本地上传，不经过通用创作上传或资产归属 PATCH。 */
export async function apiUploadSubjectCandidateImage(projectId, subjectId, file) {
  const form = new FormData();
  form.append('file', file, safeUploadFileName(file));
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/upload`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    const payload = await readResponsePayload(res).catch(() => null);
    throw new Error(getDisplayErrorMessage(payload) || `上传主体候选图失败（${res.status}）`);
  }
  invalidateSubjects(projectId);
  return readSubjectImagePayload(await res.json());
}

/** 将资产库图片登记为主体候选图，不修改源资产归属、分类或主图状态。 */
export async function apiAddSubjectImageFromAsset(projectId, subjectId, assetId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/from-asset`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId }),
    },
  );
  if (!res.ok) {
    const payload = await readResponsePayload(res).catch(() => null);
    throw new Error(getDisplayErrorMessage(payload) || `添加主体候选图失败（${res.status}）`);
  }
  invalidateSubjects(projectId);
  return readSubjectImagePayload(await res.json());
}

export async function apiGenerateSubjectImage(projectId, subjectId, params) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
    } catch {
      // 502 等返回 HTML，无法解析 JSON
    }
    const statusMessages = {
      502: 'AI 绘图服务暂时不可用，请稍后重试',
      504: 'AI 绘图服务响应超时，请简化提示词后重试',
      500: '服务器内部错误，请稍后重试',
    };
    const msg = detail || statusMessages[res.status] || `图片生成失败（${res.status}）`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  invalidateSubjects(projectId);
  const data = await res.json();
  // 后端改为异步任务模式时，返回 task_id 供前端轮询恢复
  return { ...data, _taskId: data.task_id || data.taskId || null };
}

export async function apiDeleteSubjectImage(projectId, subjectId, imageId) {
  await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/${imageId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidateSubjects(projectId);
}

export async function apiSetPrimarySubjectImage(projectId, subjectId, imageId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/${imageId}/set-primary`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await res.json();
        detail = body?.detail || body?.message || '';
        if (typeof detail === 'object') detail = JSON.stringify(detail);
      } else {
        detail = await res.text();
      }
    } catch { /* 忽略无法读取的错误响应 */ }
    const err = new Error(detail || `设置定稿图失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  invalidateSubjects(projectId); // 主图变化影响列表展示
  // 重新拉取主体列表以更新缓存，触发订阅者（如 StoryboardPage）同步最新主图
  apiGetSubjects(projectId, { type: "character" }).catch(() => {});
  apiGetSubjects(projectId, { type: "scene" }).catch(() => {});
  apiGetSubjects(projectId, { type: "prop" }).catch(() => {});
  return res.json();
}

// 取消定稿 / 清除主图（后端方案 B：语义化接口）
// 后端会同时清空主体记录级 primary_image_url / image_url，并把候选图 is_primary 全部置 false，
// 且不删除候选图本身。取消后重拉列表，卡片封面自然回到空占位。
export async function apiUnsetPrimarySubjectImage(projectId, subjectId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/unset-primary`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(detail || `取消定稿失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  invalidateSubjects(projectId); // 主图清空影响列表展示
  // 重新拉取主体列表以更新缓存，触发订阅者同步（封面回到空占位）
  apiGetSubjects(projectId, { type: "character" }).catch(() => {});
  apiGetSubjects(projectId, { type: "scene" }).catch(() => {});
  apiGetSubjects(projectId, { type: "prop" }).catch(() => {});
  return res.json().catch(() => ({}));
}

export async function apiUploadSubjectReferenceImage(projectId, subjectId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/reference-images/upload`,
    { method: 'POST', body: form }
  );
  invalidateSubjects(projectId);
  return res.json();
}

export async function apiBindSubjectReferenceImages(projectId, subjectId, { asset_ids, primary_asset_id }) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/reference-images/bind`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 后端实际校验会要求绑定列表有明确的主参考图；清空时显式传 null。
      body: JSON.stringify({
        asset_ids: Array.isArray(asset_ids) ? asset_ids : [],
        primary_asset_id: primary_asset_id ?? null,
      }),
    }
  );
  if (!res.ok) {
    const responseText = await res.text().catch(() => '');
    const payload = (() => {
      try {
        return responseText ? JSON.parse(responseText) : null;
      } catch {
        return null;
      }
    })();
    let detail = payload?.detail || payload?.message || payload?.error || responseText;
    if (Array.isArray(detail)) {
      detail = detail.map((item) => item?.msg || item?.message || String(item)).join('；');
    }
    if (typeof detail === 'object') detail = JSON.stringify(detail);
    const error = new Error(detail || `绑定主体参考图失败（${res.status}）`);
    error.status = res.status;
    throw error;
  }
  invalidateSubjects(projectId);
  // 重新拉取主体列表以更新缓存，触发订阅者同步最新主图
  apiGetSubjects(projectId, { type: "character" }).catch(() => {});
  apiGetSubjects(projectId, { type: "scene" }).catch(() => {});
  apiGetSubjects(projectId, { type: "prop" }).catch(() => {});
  return res.json();
}

export async function apiDownloadSubjectImage(projectId, subjectId, imageId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/${imageId}/download`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return res.blob();
}

// ── 批量生成 ──────────────────────────────────────────────────────────────────

const BATCH_TERMINAL_STATUSES = new Set([
  'completed',
  'partial',
  'failed',
  'cancelled',
  'done',
  'success',
  'error',
]);

function isBatchSubjectTaskTerminal(status) {
  return BATCH_TERMINAL_STATUSES.has(String(status || '').trim().toLowerCase());
}

export async function apiBatchGenerate(projectIdOrParams, maybeParams) {
  let projectId, params;
  if (maybeParams !== undefined) {
    projectId = projectIdOrParams;
    params = maybeParams;
  } else {
    console.warn('[api] apiBatchGenerate 需要 projectId 作为第一个参数，当前调用将在真实接口下失败');
    projectId = undefined;
    params = projectIdOrParams;
  }
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/batch-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      // FastAPI 422 返回 detail 为数组 [{msg, loc, ...}]
      if (Array.isArray(detail)) {
        detail = detail.map(d => d.msg || JSON.stringify(d)).join('; ');
      }
    } catch {
      // 非 JSON 响应
    }
    const err = new Error(detail || `批量生成失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  invalidateSubjects(projectId);
  return res.json();
}

// 流式批量生成：后端通过 SSE 逐个返回每个主体的生成结果
// onSubjectImage(subjectId, imageUrl, result) — 单个主体生成成功，result 保留后端图片 ID
// onSubjectError(subjectId, errorMsg)   — 单个主体生成失败
// onComplete()                          — 全部完成
// 如果后端尚未支持 SSE，会自动降级为普通 JSON 响应
export async function apiBatchGenerateStream(projectId, params, { onTaskCreated, onSubjectImage, onSubjectError, onComplete: rawOnComplete, signal } = {}) {
  // 包装 onComplete：全部完成后先失效主体缓存，再触发调用方回调
  const onComplete = (...args) => {
    invalidateSubjects(projectId);
    return rawOnComplete?.(...args);
  };
  const res = await authFetchStream(`${BASE}/api/projects/${projectId}/subjects/batch-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (Array.isArray(detail)) {
        detail = detail.map(d => d.msg || JSON.stringify(d)).join('; ');
      }
    } catch {
      // 非 JSON 响应
    }
    const err = new Error(detail || `批量生成失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';

  // ── 非流式降级：后端返回普通 JSON ────────────────────────────────
  if (!contentType.includes('text/event-stream')) {
    const data = await res.json();

    // ── 任务模式：后端返回 task_id → 轮询等待结果 ──────────────────
    if (data && (data.task_id || (data.id && data.status && (data.status === 'pending' || data.status === 'running')))) {
      const taskId = data.task_id || data.id;
      onTaskCreated?.(taskId);
      const processedIds = new Set();
      let pollCount = 0;
      const MAX_POLLS = 200;

      while (pollCount < MAX_POLLS) {
        if (signal?.aborted) return;

        await new Promise(r => setTimeout(r, 3000));
        pollCount++;

        try {
          const taskRes = await authFetch(`${BASE}/api/tasks/${taskId}`, {
            headers: { 'Content-Type': 'application/json' },
            signal,
          });
          if (!taskRes.ok) continue;

          const task = await taskRes.json();
          const results = task.results || [];

          if (Array.isArray(results)) {
            for (const item of results) {
              const sid = item.subject_id || item.id;
              if (!sid || processedIds.has(sid)) continue;

              const imgUrl = item.image_url || item.imageUrl || item.url;
              const errMsg = item.error_msg || item.errorMsg || item.error || item.message;

              if (errMsg || item.success === false || item.status === 'error') {
                processedIds.add(sid);
                onSubjectError?.(sid, errMsg || '生成失败');
              } else if (imgUrl) {
                processedIds.add(sid);
                onSubjectImage?.(sid, imgUrl, item);
              }
            }
          }

          const status = task.status || task.raw_status || '';
          if (isBatchSubjectTaskTerminal(status)) {
            onComplete?.();
            return data;
          }
        } catch (pollErr) {
          if (pollErr?.name === 'AbortError') return;
          console.warn('[apiBatchGenerateStream] 轮询出错:', pollErr);
        }
      }

      onComplete?.();
      return data;
    }

    // ── 同步模式：直接返回结果数组 ──────────────────────────────────
    const results = Array.isArray(data) ? data : (data?.results || data?.items || data?.data || []);
    if (Array.isArray(results)) {
      for (const item of results) {
        const sid = item.subject_id || item.id;
        const imgUrl = item.image_url || item.imageUrl || item.url;
        if (item.status === 'error' || item.error_msg || item.errorMsg || item.error || item.success === false) {
          onSubjectError?.(sid, item.error_msg || item.errorMsg || item.error || item.message || '生成失败');
        } else if (imgUrl) {
          onSubjectImage?.(sid, imgUrl, item);
        }
      }
    }
    const firstError = results.find(r => r.error || r.status === 'error' || r.success === false);
    if (firstError && !results.some(r => r.image_url || r.imageUrl || r.url)) {
      const err = new Error(firstError.error || firstError.message || '批量生成失败');
      err.status = res.status;
      throw err;
    }
    onComplete?.();
    return data;
  }

  // ── SSE 流式读取 ────────────────────────────────────────────────
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();

        if (payload === '[DONE]') {
          onComplete?.();
          return;
        }

        try {
          const parsed = JSON.parse(payload);

          // SSE 中检测到任务模式 → 切换轮询
          if (parsed.type === 'task' && (parsed.task_id || (parsed.id && parsed.status))) {
            const taskId = parsed.task_id || parsed.id;
            onTaskCreated?.(taskId);
            const processedIds = new Set();
            let pollCount = 0;
            const MAX_POLLS = 200;

            while (pollCount < MAX_POLLS) {
              if (signal?.aborted) { reader.releaseLock(); return; }
              await new Promise(r => setTimeout(r, 3000));
              pollCount++;

              try {
                const taskRes = await authFetch(`${BASE}/api/tasks/${taskId}`, {
                  headers: { 'Content-Type': 'application/json' },
                  signal,
                });
                if (!taskRes.ok) continue;

                const task = await taskRes.json();
                const results = task.results || [];

                if (Array.isArray(results)) {
                  for (const item of results) {
                    const s = item.subject_id || item.id;
                    if (!s || processedIds.has(s)) continue;
                    const u = item.image_url || item.imageUrl || item.url;
                    const e = item.error_msg || item.errorMsg || item.error || item.message;
                    if (e || item.success === false || item.status === 'error') {
                      processedIds.add(s);
                      onSubjectError?.(s, e || '生成失败');
                    } else if (u) {
                      processedIds.add(s);
                      onSubjectImage?.(s, u, item);
                    }
                  }
                }

                const st = task.status || task.raw_status || '';
                if (isBatchSubjectTaskTerminal(st)) {
                  reader.releaseLock();
                  onComplete?.();
                  return;
                }
              } catch (pollErr) {
                if (pollErr?.name === 'AbortError') { reader.releaseLock(); return; }
                console.warn('[apiBatchGenerateStream] 轮询出错:', pollErr);
              }
            }

            reader.releaseLock();
            onComplete?.();
            return;
          }

          const sid = parsed.subject_id || parsed.id;
          const errMsg = parsed.error_msg || parsed.errorMsg || parsed.error || parsed.message;
          const imgUrl = parsed.image_url || parsed.imageUrl || parsed.url;

          if (errMsg || parsed.success === false) {
            onSubjectError?.(sid, errMsg);
          } else if (imgUrl) {
            onSubjectImage?.(sid, imgUrl, parsed);
          }
        } catch {
          // 忽略无法解析的 chunk
        }
      }
    }
    onComplete?.();
  } finally {
    reader.releaseLock();
  }
}

export async function apiUpdateSubjectCompat(subjectId, data) {
  console.warn('[api] apiUpdateSubject 缺少 projectId，调用方应改用 apiUpdateSubject(projectId, subjectId, data)');
  return { id: subjectId, ...data };
}

// ── 剧集 ──────────────────────────────────────────────────────────────────────

export function normalizeEpisodeListResponse(payload) {
  if (Array.isArray(payload)) return payload;

  // 兼容网关统一响应包装和旧版接口返回结构；剧集列表的唯一来源仍是 episodes 接口。
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  const list = Array.isArray(data)
    ? data
    : data?.items || data?.list || data?.episodes || data?.result;

  if (!Array.isArray(list)) return [];

  return [...list].sort((a, b) => {
    const numberOf = (item) => Number(item?.episode_number ?? item?.episodeNumber ?? item?.number ?? 0);
    return numberOf(a) - numberOf(b);
  });
}

export async function apiGetEpisodes(projectId) {
  // TODO: 后端需要在 episodes 接口返回中添加 status 字段
  // 期望字段：status（可选值：pending/generated/edited）
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    // Mock 数据：返回带状态的剧集列表
    return [
      { id: 1, title: '第一集', episode_number: 1, status: 'generated' },
      { id: 2, title: '第二集', episode_number: 2, status: 'pending' },
      { id: 3, title: '第三集', episode_number: 3, status: 'pending' },
    ];
  }
  const payload = await cached(
    K.episodes(projectId),
    async () => {
      const res = await authFetch(`${BASE}/api/projects/${projectId}/episodes`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
  return normalizeEpisodeListResponse(payload);
}

export async function apiCreateEpisode(projectId, { title, episode_number, content, summary }) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, episode_number, content, summary }),
  });
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  return res.json();
}

export async function apiUpdateEpisode(projectId, episodeId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/episodes/${episodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  return res.json();
}

export async function apiDeleteEpisode(projectId, episodeId) {
  await authFetch(`${BASE}/api/projects/${projectId}/episodes/${episodeId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  // 剧集删除会级联影响该剧集下的分镜
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.storyboardPagePrefix(projectId));
}

export async function apiGenerateEpisodeScript(projectId, episodeId, { prompt, model }) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/episodes/${episodeId}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    }
  );
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  return res.json();
}

export async function apiUploadEpisodeScript(projectId, episodeId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/episodes/${episodeId}/upload`,
    { method: 'POST', body: form }
  );
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  return res.json();
}

// ── 剧本工作区 ────────────────────────────────────────────────────────────────

export async function apiGetScriptWorkspace(projectId, { fresh = false, signal } = {}) {
  const fetchWorkspace = async () => {
    const isFreshRequest = fresh === true;
    const res = await authFetch(
      `${BASE}/api/projects/${projectId}/script-workspace${isFreshRequest ? `?_workspace_check=${Date.now()}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(isFreshRequest
            ? {
                'Cache-Control': 'no-cache',
                'X-Miioo-Workspace-Check': 'send-preflight',
              }
            : {}),
        },
        ...(isFreshRequest ? { cache: 'no-store' } : {}),
        signal,
      }
    );
    return res.json();
  };

  if (fresh) return fetchWorkspace();
  return cached(
    K.script(projectId),
    fetchWorkspace,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
}

export async function apiConfirmScriptWorkspace(projectId, { expected_draft_revision, schema_version, client_request_id, idempotency_key } = {}) {
  const body = { expected_draft_revision, schema_version };
  if (client_request_id) body.client_request_id = client_request_id;
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotency_key ? { 'Idempotency-Key': idempotency_key } : {}),
    },
    body: JSON.stringify(body),
  });
  invalidate(K.script(projectId));
  return readScriptWorkspaceResponse(res);
}

export async function apiGetScriptStructure(projectId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/structure`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 404) {
    let payload;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    const detail = payload?.detail;
    const code = typeof detail === 'object' ? detail?.code : payload?.code;
    if (code === 'STRUCTURE_NOT_FOUND') return { _notFound: true, payload: {} };
    const error = new Error(getDisplayErrorMessage(payload, `读取剧本结构失败（${res.status}）`));
    error.status = res.status;
    error.code = typeof detail === 'object' ? detail?.code : payload?.code;
    error.rawPayload = payload;
    throw error;
  }
  return readScriptWorkspaceResponse(res);
}

/** 保留脚本工作区错误响应，便于页面从 409 冲突中恢复已有任务。 */
async function readScriptWorkspaceResponse(res) {
  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  if (res.ok) return payload;

  const error = new Error(getDisplayErrorMessage(payload, `请求失败（${res.status}）`));
  const detail = payload?.detail;
  error.status = res.status;
  error.code = typeof detail === 'object' ? detail?.code : payload?.code;
  error.validationErrors = Array.isArray(detail)
    ? detail
    : Array.isArray(payload?.errors) ? payload.errors : null;
  error.rawPayload = payload;
  error.payload = payload;
  return Promise.reject(error);
}

function scriptClientRequestId(prefix) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

async function scriptStructureWrite(projectId, path, body) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/structure${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  invalidate(K.script(projectId));
  return res.json();
}

export async function apiResplitScriptStructure(projectId, { base_revision, episode_count, instruction = '', model } = {}) {
  return scriptStructureWrite(projectId, '/resplit', {
    base_revision,
    episode_count: episode_count ?? null,
    instruction,
    model: model || null,
    client_request_id: scriptClientRequestId('script-resplit'),
  });
}

export async function apiRegenerateScriptEpisode(projectId, itemId, { base_revision, instruction = '', model } = {}) {
  return scriptStructureWrite(projectId, `/episodes/${encodeURIComponent(itemId)}/regenerate`, {
    base_revision,
    instruction,
    model: model || null,
    client_request_id: scriptClientRequestId('script-episode-rewrite'),
  });
}

export async function apiPatchScriptStructure(projectId, { expected_revision, operations, client_request_id, after_item_id } = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/structure`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expected_revision: expected_revision ?? null,
      operations: Array.isArray(operations) ? operations : [],
      client_request_id: client_request_id || scriptClientRequestId('script-structure-patch'),
      after_item_id: after_item_id || null,
    }),
  });
  invalidate(K.script(projectId));
  return readScriptWorkspaceResponse(res);
}

export async function apiGetScriptTask(projectId, taskId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/tasks/${taskId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return readScriptWorkspaceResponse(res);
}

/** 发布结构化剧本，后端异步把结构草稿物化为正式分集。 */
export async function apiPublishScriptStructure(projectId, {
  expected_revision = null,
  impact_policy = 'reject',
  base_revision = null,
  publish_target = ['episodes'],
  client_request_id,
} = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/structure/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expected_revision,
      impact_policy,
      base_revision,
      publish_target: Array.isArray(publish_target) && publish_target.length > 0 ? publish_target : ['episodes'],
      client_request_id: client_request_id || scriptClientRequestId('script-structure-publish'),
    }),
  });
  if (!res.ok) {
    let payload;
    try { payload = await res.json(); } catch { payload = undefined; }
    const error = new Error(getDisplayErrorMessage(payload, `发布剧本结构失败（${res.status}）`));
    error.status = res.status;
    error.rawPayload = payload;
    throw error;
  }
  invalidate(K.episodes(projectId));
  invalidate(K.script(projectId));
  const data = await res.json();
  return { ...data, _async: res.status === 202, _status: res.status };
}

/** 按正式分集异步提取角色、场景和道具主体。 */
export async function apiExtractSubjectsByEpisodes(projectId, {
  episode_ids = [],
  source_revision = null,
  model = null,
  force_retry = true,
  client_request_id,
} = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/extract-subjects/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      episode_ids: Array.isArray(episode_ids) ? episode_ids : [],
      source_revision,
      model,
      force_retry,
      client_request_id: client_request_id || scriptClientRequestId('script-subject-extraction'),
    }),
  });
  if (!res.ok) {
    let payload;
    try { payload = await res.json(); } catch { payload = undefined; }
    const error = new Error(getDisplayErrorMessage(payload, `提交主体抽取任务失败（${res.status}）`));
    error.status = res.status;
    error.rawPayload = payload;
    throw error;
  }
  const data = await res.json();
  return { ...data, _async: res.status === 202, _status: res.status };
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function firstTextValue(source, keys) {
  const value = firstValue(source, keys);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return firstValue(value, ['value', 'content', 'text', 'label', 'name', 'title']);
  }
  return value;
}

function firstTextValueFromSources(sources, keys) {
  for (const source of sources) {
    const value = firstTextValue(source, keys);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function normalizeStructureItem(item) {
  if (typeof item === 'string') return { id: null, name: item, description: '' };
  if (!item || typeof item !== 'object') return null;
  return {
    id: firstValue(item, ['item_id', 'id']) || null,
    name: firstValue(item, ['name', 'title', 'label', 'key']),
    description: firstValue(item, ['description', 'content', 'summary', 'value']),
  };
}

function normalizeEpisode(item, index) {
  if (typeof item === 'string') {
    return { id: null, name: `第${index + 1}集`, title: `第${index + 1}集`, episode_number: index + 1, status: 'pending', description: '', content: item, synopsis: '', storyPoints: [], subjects: {}, hook: '' };
  }
  if (!item || typeof item !== 'object') return null;
  return {
    id: firstValue(item, ['item_id', 'id']) || null,
    name: firstValue(item, ['name', 'title', 'episode_name', 'episode_title']) || `第${index + 1}集`,
    title: firstValue(item, ['title', 'name', 'episode_name', 'episode_title']) || `第${index + 1}集`,
    episode_number: firstValue(item, ['episode_number', 'episodeNumber', 'number', 'index']) ?? index + 1,
    status: firstValue(item, ['status', 'episode_status', 'episodeStatus']) || 'pending',
    description: firstValue(item, ['description', 'summary', 'synopsis', 'plot', 'content']),
    content: firstValue(item, ['content', 'script', 'full_script', 'description', 'plot']),
    synopsis: firstValue(item, ['synopsis', 'summary', 'description']),
    storyPoints: firstValue(item, ['story_points', 'storyPoints', 'plot_points']) || [],
    subjects: firstValue(item, ['subjects', 'cast']) || {},
    hook: firstValue(item, ['hook', 'ending_hook', 'cliffhanger']),
  };
}

function normalizeStructureFields(source, keys) {
  const value = firstValue(source, keys);
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeStructureList(source, keys) {
  const value = firstValue(source, keys);
  return Array.isArray(value) ? value.map(normalizeStructureItem).filter(Boolean) : [];
}

export function normalizeScriptStructure(structure) {
  const payload = structure?.payload || structure?.data || structure || {};
  const overall = normalizeStructureFields(payload, ['overall_settings', 'overallSettings', 'overall', 'overall_setting', 'overallSetting']);
  const overallSources = [
    overall,
    normalizeStructureFields(payload, ['settings', 'project_settings', 'projectSettings']),
    payload,
  ];
  const design = normalizeStructureFields(payload, ['script_design', 'scriptDesign', 'design']);
  const subjects = normalizeStructureFields(payload, ['subjects', 'subject']);
  const rawEpisodes = firstValue(payload, ['episodes', 'episode_plots', 'episodePlots']);
  const episodes = Array.isArray(rawEpisodes) ? rawEpisodes.map(normalizeEpisode).filter(Boolean) : [];

  return {
    revision: structure?.revision ?? payload?.revision ?? 0,
    schemaVersion: structure?.schema_version || payload?.schema_version || '',
    overallSettings: {
      visualStyle: firstTextValueFromSources(overallSources, ['visual_style', 'visualStyle', 'style']),
      aspectRatio: firstTextValueFromSources(overallSources, ['aspect_ratio', 'aspectRatio', 'ratio']),
      creationType: firstTextValueFromSources(overallSources, ['creation_type', 'creationType', 'type']),
    },
    scriptDesign: {
      synopsis: firstValue(design, ['synopsis', 'story_summary', 'storySummary', 'summary']),
      background: firstValue(design, ['background', 'story_background', 'storyBackground']),
      world: firstTextValue(design, [
        'world',
        'world_setting',
        'worldSetting',
        'worldview',
        'world_view',
        'worldView',
        'worldview_setting',
        'worldviewSetting',
        'world_building',
        'worldBuilding',
      ]),
      conflict: firstValue(design, ['conflict', 'core_conflict', 'coreConflict']),
    },
    subjects: {
      characters: normalizeStructureList(subjects, ['characters', 'character', 'roles']),
      scenes: normalizeStructureList(subjects, ['scenes', 'scene', 'locations']),
      props: normalizeStructureList(subjects, ['props', 'prop', 'objects']),
    },
    episodes,
  };
}

export function normalizeScriptMessage(message, index = 0) {
  if (!message) return null;
  return {
    id: message.id || `script-message-${index}`,
    role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
    content: typeof message.content === 'string' ? message.content : '',
    status: message.status || 'completed',
    messageType: message.message_type || 'chat',
    turnId: message.turn_id || null,
    replyToMessageId: message.reply_to_message_id || null,
    sequenceNo: message.sequence_no ?? index,
    modelId: message.model_id || null,
    createdAt: message.created_at || null,
    updatedAt: message.updated_at || null,
    errorCode: message.error_code || null,
    errorMessage: message.error_message || null,
  };
}

export function normalizeScriptMessages(messages) {
  return Array.isArray(messages)
    ? messages.map(normalizeScriptMessage).filter(Boolean)
    : [];
}

export async function apiSaveScriptWorkspace(projectId, data) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`save script workspace 失败，第 ${attempt} 次重试中...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
    }

    let res;
    try {
      res = await authFetch(
        `${BASE}/api/projects/${projectId}/script-workspace`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
    } catch (err) {
      if (err.isNetworkError && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      continue;
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }

    invalidate(K.script(projectId));
    return res.json();
  }
}

export async function apiChatScriptWorkspace(projectId, { message, model, episode_count, episode_duration_seconds, apply_to_script = true, client_request_id } = {}) {
  const body = { message, apply_to_script };
  if (model) body.model = model;
  if (episode_count != null) body.episode_count = episode_count;
  if (episode_duration_seconds != null) body.episode_duration_seconds = episode_duration_seconds;
  if (client_request_id) body.client_request_id = client_request_id;
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  invalidate(K.script(projectId)); // chat 会改写剧本内容
  return res.json();
}

// 流式版本：SSE 逐 chunk 回调，完成后返回完整内容字符串
// onChunk(accumulated: string) 每次收到新内容时触发
// signal 用于 AbortController 取消
export async function apiChatScriptWorkspaceStream(
  projectId,
  { message, model, episode_count, episode_duration_seconds, apply_to_script = true, client_request_id } = {},
  { onChunk, onEvent, signal } = {}
) {
  const body = { message, apply_to_script };
  if (model) body.model = model;
  if (episode_count != null) body.episode_count = episode_count;
  if (episode_duration_seconds != null) body.episode_duration_seconds = episode_duration_seconds;
  if (client_request_id) body.client_request_id = client_request_id;

  const res = await authFetchStream(
    `${BASE}/api/projects/${projectId}/script-workspace/chat/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    }
  );

  // 504 / 524 网关超时 → 抛出带标记的错误，由调用方统一处理
  // 504: nginx 网关超时；524: Cloudflare 源站超时（~100s 内无响应）
  if (res.status === 504 || res.status === 524) {
    const err = new Error('Gateway Timeout');
    err.isGatewayTimeout = true;
    throw err;
  }

  // 非 2xx 响应 → 读取错误体并抛出，避免静默吞错
  if (!res.ok) {
    const payload = await readResponsePayload(res);
    const errorDetail = getDisplayErrorMessage(payload, `请求失败（HTTP ${res.status}）`);
    const err = new Error(errorDetail);
    err.status = res.status;
    err.rawPayload = payload;
    throw err;
  }

  // 后端当前 OpenAPI 将该接口声明为 application/json，但运行时可能仍返回
  // SSE。不能只依赖 Content-Type，否则会把整段响应当成 JSON 一次性展示。
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawResponse = '';
  let accumulated = '';
  let sawSseLine = false;

  const appendChunk = (value, payload = null) => {
    const chunk = typeof value === 'string' ? value : '';
    if (!chunk) return;
    accumulated += chunk;
    onChunk?.(accumulated);
    onEvent?.({ type: 'chunk', content: chunk, accumulated, payload });
  };

  const processSsePayload = (payload) => {
    const trimmed = payload.trim();
    if (!trimmed) return false;
    if (trimmed === '[DONE]') {
      onEvent?.({ type: 'done' });
      return true;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // SSE 允许直接传输纯文本内容。
    }

    if (parsed?.error || parsed?.type === 'error' || parsed?.event === 'error') {
      const error = parsed.error || parsed;
      const eventError = new Error(getDisplayErrorMessage(error, '剧本生成失败'));
      eventError.code = error?.code || parsed?.code || null;
      eventError.status = error?.status || parsed?.status;
      eventError.rawPayload = parsed;
      onEvent?.({ type: 'error', error: eventError, payload: parsed });
      throw eventError;
    }
    if (parsed?.type === 'done' || parsed?.event === 'done') {
      onEvent?.({ type: 'done', payload: parsed });
      return true;
    }

    const chunk = parsed
      ? parsed?.choices?.[0]?.delta?.content
        ?? parsed?.delta
        ?? parsed?.content
        ?? parsed?.chunk
        ?? ''
      : trimmed;
    appendChunk(chunk, parsed);
    return false;
  };

  const processLine = (line) => {
    const normalized = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (!normalized.startsWith('data:')) return false;
    sawSseLine = true;
    return processSsePayload(normalized.slice(5).replace(/^ /, ''));
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      rawResponse += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留最后一段不完整行

      for (const line of lines) processLine(line);
    }

    const tail = decoder.decode();
    buffer += tail;
    rawResponse += tail;

    // 处理没有以换行结尾的最后一条 SSE data 行。
    if (buffer) processLine(buffer);

    // 如果后端确实返回的是完整 JSON，这里保留兼容性；这种情况下网络层
    // 本身没有增量数据，前端无法凭空制造真正的流式接收。
    if (!sawSseLine && !accumulated && rawResponse.trim()) {
      try {
        const data = JSON.parse(rawResponse);
        const content = data?.script?.content || data?.content || '';
        appendChunk(content, data);
      } catch {
        // 非 SSE、非 JSON 的响应交给页面层按空响应处理。
      }
    }
  } finally {
    reader.releaseLock();
  }

  invalidate(K.script(projectId)); // 流式 chat 完成后剧本已改写
  return accumulated;
}

export async function apiUploadScriptWorkspace(projectId, file) {
  if (!projectId) {
    throw new Error('上传剧本前未获取到项目 ID，请先完成项目创建');
  }
  const form = new FormData();
  form.append('file', file);
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/script-workspace/upload`,
    { method: 'POST', body: form }
  );
  if (!res.ok) {
    await throwResponseError(res, `上传剧本失败（${res.status}）`);
  }
  invalidate(K.script(projectId));
  return res.json();
}

/**
 * 导入分镜脚本 Excel。该接口创建后台导入任务，页面需要继续轮询任务状态。
 * 后端文档尚未同步到本地 OpenAPI，本函数按后端工作流记录接入正式路径。
 */
export async function apiImportStoryboardXlsx(projectId, file, idempotencyKey) {
  const form = new FormData();
  form.append('file', file);
  const key = idempotencyKey || scriptClientRequestId('storyboard-xlsx-import');
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/script-workspace/import-storyboard-xlsx`,
    { method: 'POST', headers: { 'Idempotency-Key': key }, body: form },
  );
  const payload = await readScriptWorkspaceResponse(res);
  invalidate(K.script(projectId));
  invalidate(K.episodes(projectId));
  invalidate(K.projectOverview(projectId));
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.storyboardPagePrefix(projectId));
  return normalizeStoryboardImportResult(payload);
}

/**
 * 下载当前项目持久化的分镜脚本原文件。
 * 工作区响应可能只返回 file_id/file_name，前端仍通过稳定项目接口完成下载。
 */
export async function apiDownloadStoryboardFile(projectId) {
  if (!projectId) throw new Error('下载分镜脚本前未获取到项目 ID');
  const res = await authFetch(`${BASE}/api/projects/${projectId}/script-workspace/storyboard-file/download`);
  if (!res.ok) {
    await throwResponseError(res, `下载分镜脚本失败（${res.status}）`);
  }
  return res.blob();
}

function firstDefined(source, keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return undefined;
}

export function normalizeStoryboardFileInfo(source) {
  const payload = source?.data || source?.result || source || {};
  const script = payload?.script && typeof payload.script === 'object' ? payload.script : {};
  const structure = payload?.structure && typeof payload.structure === 'object' ? payload.structure : {};
  const structurePayload = structure?.payload && typeof structure.payload === 'object' ? structure.payload : {};
  const candidates = [payload, script, structure, structurePayload, payload?.task, payload?.active_task, payload?.active_operation]
    .filter((value) => value && typeof value === 'object');
  const nested = candidates.reduce((found, candidate) => found || firstDefined(candidate, ['storyboard_file', 'storyboardFile', 'storyboard_attachment', 'storyboardAttachment', 'attachment', 'file']), undefined);
  const file = nested && typeof nested === 'object' ? nested : {};
  return {
    fileName: firstDefined(file, ['file_name', 'fileName', 'filename', 'name'])
      || candidates.reduce((found, candidate) => found || firstDefined(candidate, ['file_name', 'fileName', 'filename']), '')
      || '',
    downloadUrl: firstDefined(file, ['download_url', 'downloadUrl', 'file_url', 'fileUrl', 'url'])
      || candidates.reduce((found, candidate) => found || firstDefined(candidate, ['download_url', 'downloadUrl', 'file_url', 'fileUrl']), '')
      || '',
    fileId: firstDefined(file, ['file_id', 'fileId', 'resource_id', 'resourceId', 'id'])
      || candidates.reduce((found, candidate) => found || firstDefined(candidate, ['file_id', 'fileId', 'resource_id', 'resourceId']), '')
      || '',
  };
}

/**
 * 判断工作区或任务是否来自分镜脚本导入。
 * 导入任务完成后，工作区不一定继续返回 source_type，因此同时兼容任务 operation。
 */
export function isStoryboardScriptSource(source) {
  if (!source || typeof source !== 'object') return false;
  const storyboardOperations = new Set(['storyboard_upload', 'storyboard_import', 'import_storyboard_xlsx']);
  const storyboardSourceTypes = new Set(['storyboard_upload', 'storyboard_import', 'storyboard_xlsx', 'storyboard_script']);
  const visited = new Set();
  const inspect = (value) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some(inspect);
    const operation = String(value.operation || value.operation_type || value.operationType || '').toLowerCase();
    if (storyboardOperations.has(operation)) return true;
    const sourceType = String(value.source_type || value.sourceType || '').toLowerCase();
    if (storyboardSourceTypes.has(sourceType)) return true;
    if (value.storyboard_file || value.storyboardFile || value.storyboard_attachment || value.storyboardAttachment) return true;
    return Object.values(value).some(inspect);
  };
  return inspect(source);
}

export function normalizeStoryboardImportResult(payload) {
  const taskId = payload?.task_id
    || payload?.taskId
    || payload?.task?.task_id
    || payload?.task?.taskId
    || null;
  const operationId = payload?.operation_id
    || payload?.operationId
    || payload?.operation?.operation_id
    || payload?.operation?.operationId
    || null;
  return {
    ...payload,
    taskId,
    operationId,
    status: payload?.status || payload?.task?.status || 'pending',
    workflowStage: payload?.workflow_stage || payload?.workflowStage || payload?.task?.workflow_stage || payload?.task?.workflowStage || '',
    sourceDraftRevision: payload?.source_draft_revision ?? payload?.sourceDraftRevision ?? null,
    isStoryboardImport: true,
    ...normalizeStoryboardFileInfo(payload),
  };
}

export async function apiFinalizeScriptWorkspace(projectId, { episode_count, model, split_mode = 'rule_first', apply_split = true, auto_extract_subjects = true } = {}) {
  const body = { split_mode, apply_split, auto_extract_subjects };
  if (model) body.model = model;
  if (episode_count != null) body.episode_count = episode_count;

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.warn(`finalize 请求失败，第 ${attempt} 次重试中...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
    }

    let res;
    try {
      res = await authFetch(
        `${BASE}/api/projects/${projectId}/script-workspace/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
    } catch (err) {
      // Cloudflare 524 在浏览器侧表现为网络错误（net::ERR_ABORTED），
      // authFetch 会 catch 并包装为 isNetworkError，不会返回 Response 对象
      if (err.isNetworkError && attempt < MAX_RETRIES) {
        continue;
      }
      throw err;
    }

    // nginx 504 等 5xx 网关错误：重试
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      continue;
    }

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errorDetail = errBody?.message || errBody?.detail || errBody?.error || JSON.stringify(errBody);
      } catch {
        try { errorDetail = await res.text(); } catch { /* keep HTTP status */ }
      }
      const err = new Error(errorDetail);
      err.status = res.status;
      throw err;
    }

    invalidate(K.script(projectId));
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));
    const data = await res.json();
    return res.status === 202
      ? { ...data, _async: true, _status: res.status }
      : { ...data, _async: false, _status: res.status };
  }
}
