const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm, authFetchStream } from './request.js';
import { getDisplayErrorMessage, throwResponseError } from './error.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeGenerationMode(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/-/g, '_');
  if (!normalized) return undefined;
  if (normalized === 'main') return 'single';
  if (normalized === 'multi_view') return 'three_view';
  return normalized;
}

function normalizeExpandOptions(params = {}) {
  const options = isPlainObject(params.expand_options)
    ? { ...params.expand_options }
    : isPlainObject(params.expandOptions)
      ? { ...params.expandOptions }
      : {};
  const mappings = [
    ['up_expansion_ratio', params.up_expansion_ratio ?? params.upExpansionRatio],
    ['down_expansion_ratio', params.down_expansion_ratio ?? params.downExpansionRatio],
    ['left_expansion_ratio', params.left_expansion_ratio ?? params.leftExpansionRatio],
    ['right_expansion_ratio', params.right_expansion_ratio ?? params.rightExpansionRatio],
  ];
  mappings.forEach(([key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      options[key] = value;
    }
  });
  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizeSubjectCompletionOptions(params = {}) {
  const options = isPlainObject(params.subject_completion_options)
    ? { ...params.subject_completion_options }
    : isPlainObject(params.subjectCompletionOptions)
      ? { ...params.subjectCompletionOptions }
      : {};
  const elementFrontalImage = params.element_frontal_image ?? params.elementFrontalImage;
  if (typeof elementFrontalImage === 'string' && elementFrontalImage.trim()) {
    options.element_frontal_image = elementFrontalImage.trim();
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizeProviderParams(params = {}) {
  if (isPlainObject(params.provider_params)) return params.provider_params;
  if (isPlainObject(params.providerParams)) return params.providerParams;
  return undefined;
}

function normalizeSubjectImagePayload(params = {}) {
  return {
    ...params,
    generation_mode: normalizeGenerationMode(params.generation_mode ?? params.mode),
    expand_options: normalizeExpandOptions(params),
    subject_completion_options: normalizeSubjectCompletionOptions(params),
    provider_params: normalizeProviderParams(params),
  };
}

// 主体写操作后统一失效该项目的主体缓存 + 概览（概览含主体进度）
function invalidateSubjects(projectId) {
  invalidate(K.subjectsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
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

export async function apiGetSubjectsPage(projectId, { type, episode_id, limit = 20, cursor } = {}) {
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (episode_id) params.append('episode_id', episode_id);
  if (limit) params.append('limit', limit);
  if (cursor) params.append('cursor', cursor);
  const query = params.toString();
  const url = query ? `${BASE}/api/projects/${projectId}/subjects?${query}` : `${BASE}/api/projects/${projectId}/subjects`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  if (Array.isArray(data)) return { list: data, nextCursor: null, hasMore: false, total: data.length };
  const list = data?.list ?? data?.items ?? data?.data ?? [];
  return {
    list,
    nextCursor: data?.next_cursor ?? data?.nextCursor ?? null,
    hasMore: data?.has_more ?? data?.hasMore ?? false,
    total: data?.total ?? list.length,
  };
}


export async function apiGetSubjectDetail(projectId, subjectId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
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
    await throwResponseError(res, `更新主体失败（${res.status}）`);
  }
  invalidateSubjects(projectId);
  return res.json();
}

export async function apiDeleteSubject(projectId, subjectId) {
  await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
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

export async function apiGenerateSubjectImage(projectId, subjectId, params) {
  const payload = normalizeSubjectImagePayload(params);
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/${subjectId}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const statusMessages = {
      502: 'AI 绘图服务暂时不可用，请稍后重试',
      504: 'AI 绘图服务响应超时，请简化提示词后重试',
      500: '服务器内部错误，请稍后重试',
    };
    await throwResponseError(
      res,
      statusMessages[res.status] || `图片生成失败（${res.status}）`,
      { showDialog: true, title: '图片生成失败' }
    );
  }
  invalidateSubjects(projectId);
  return res.json();
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
  invalidateSubjects(projectId); // 主图变化影响列表展示
  return res.json();
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
      body: JSON.stringify({ asset_ids, primary_asset_id }),
    }
  );
  invalidateSubjects(projectId);
  return res.json();
}

export async function apiDownloadSubjectImage(projectId, subjectId, imageId, { rawResponse = false } = {}) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/subjects/${subjectId}/images/${imageId}/download`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return rawResponse ? res : res.blob();
}

// ── 批量生成 ──────────────────────────────────────────────────────────────────

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
  const payload = normalizeSubjectImagePayload(params);
  const res = await authFetch(`${BASE}/api/projects/${projectId}/subjects/batch-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await throwResponseError(res, `批量生成失败（${res.status}）`, { showDialog: true, title: '批量生成失败' });
  }
  invalidateSubjects(projectId);
  return res.json();
}

// 流式批量生成：后端通过 SSE 逐个返回每个主体的生成结果
// onSubjectImage(subjectId, imageUrl) — 单个主体生成成功
// onSubjectError(subjectId, errorMsg)   — 单个主体生成失败
// onComplete()                          — 全部完成
// 如果后端尚未支持 SSE，会自动降级为普通 JSON 响应
export async function apiBatchGenerateStream(projectId, params, { onSubjectImage, onSubjectError, onComplete: rawOnComplete, signal } = {}) {
  // 包装 onComplete：全部完成后先失效主体缓存，再触发调用方回调
  const onComplete = (...args) => {
    invalidateSubjects(projectId);
    return rawOnComplete?.(...args);
  };
  const payload = normalizeSubjectImagePayload(params);
  const res = await authFetchStream(`${BASE}/api/projects/${projectId}/subjects/batch-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    await throwResponseError(res, `批量生成失败（${res.status}）`, { showDialog: true, title: '批量生成失败' });
  }

  const contentType = res.headers.get('content-type') || '';

  // ── 非流式降级：后端返回普通 JSON ────────────────────────────────
  if (!contentType.includes('text/event-stream')) {
    const data = await res.json();

    // ── 任务模式：后端返回 task_id → 轮询等待结果 ──────────────────
    if (data && (data.task_id || (data.id && data.status && (data.status === 'pending' || data.status === 'running')))) {
      const taskId = data.task_id || data.id;
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
              const errMsg = item.error || item.message;

              if (errMsg || item.success === false || item.status === 'error') {
                processedIds.add(sid);
                onSubjectError?.(sid, errMsg || '生成失败');
              } else if (imgUrl) {
                processedIds.add(sid);
                onSubjectImage?.(sid, imgUrl);
              }
            }
          }

          const status = task.status || task.raw_status || '';
          if (status === 'completed' || status === 'partial' || status === 'failed') {
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
        if (item.status === 'error' || item.error || item.success === false) {
          onSubjectError?.(sid, item.error || item.message || '生成失败');
        } else if (imgUrl) {
          onSubjectImage?.(sid, imgUrl);
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
                    const e = item.error || item.message;
                    if (e || item.success === false || item.status === 'error') {
                      processedIds.add(s);
                      onSubjectError?.(s, e || '生成失败');
                    } else if (u) {
                      processedIds.add(s);
                      onSubjectImage?.(s, u);
                    }
                  }
                }

                const st = task.status || task.raw_status || '';
                if (st === 'completed' || st === 'partial' || st === 'failed') {
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
          const errMsg = parsed.error || parsed.message;
          const imgUrl = parsed.image_url || parsed.imageUrl || parsed.url;

          if (errMsg || parsed.success === false) {
            onSubjectError?.(sid, errMsg);
          } else if (imgUrl) {
            onSubjectImage?.(sid, imgUrl);
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
  return cached(
    K.episodes(projectId),
    async () => {
      const res = await authFetch(`${BASE}/api/projects/${projectId}/episodes`, {
        headers: { 'Content-Type': 'application/json' },
      });
      return res.json();
    },
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
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

export async function apiGetScriptWorkspace(projectId) {
  return cached(
    K.script(projectId),
    async () => {
      const res = await authFetch(
        `${BASE}/api/projects/${projectId}/script-workspace`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return res.json();
    },
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
}

export async function apiSaveScriptWorkspace(projectId, data) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/script-workspace`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  invalidate(K.script(projectId));
  return res.json();
}

export async function apiChatScriptWorkspace(projectId, { message, model } = {}) {
  const body = { message, apply_to_script: true };
  if (model) body.model = model;
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
  { message, model, episode_count } = {},
  { onChunk, signal } = {}
) {
  const body = { message, apply_to_script: true };
  if (model) body.model = model;
  if (episode_count != null) body.episode_count = episode_count;

  const res = await authFetchStream(
    `${BASE}/api/projects/${projectId}/script-workspace/chat/stream`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }
  );

  // 504 网关超时 → 抛出带标记的错误，由调用方统一处理
  if (res.status === 504) {
    const err = new Error('Gateway Timeout');
    err.isGatewayTimeout = true;
    throw err;
  }

  // 非 2xx 响应 → 读取错误体并抛出，避免静默吞错
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      errorDetail = getDisplayErrorMessage(errBody, errorDetail);
    } catch {
      try {
        errorDetail = await res.text();
      } catch { /* keep HTTP status as fallback */ }
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';

  // ── 非流式 fallback：后端返回普通 JSON ───────────────────────────────────────
  if (!contentType.includes('text/event-stream')) {
    const data = await res.json();
    const content = data?.script?.content || data?.content || '';
    if (content) onChunk?.(content);
    return content;
  }

  // ── SSE 流式读取 ─────────────────────────────────────────────────────────────
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // 保留最后一段不完整行

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return accumulated;

        let chunk = '';
        try {
          const parsed = JSON.parse(payload);
          // 兼容多种格式：OpenAI delta / 自定义 delta / content / chunk
          chunk =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.delta ??
            parsed?.content ??
            parsed?.chunk ??
            '';
        } catch {
          chunk = payload; // 纯文本 chunk
        }

        if (chunk) {
          accumulated += chunk;
          onChunk?.(accumulated);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  invalidate(K.script(projectId)); // 流式 chat 完成后剧本已改写
  return accumulated;
}

export async function apiUploadScriptWorkspace(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/script-workspace/upload`,
    { method: 'POST', body: form }
  );
  invalidate(K.script(projectId));
  return res.json();
}

export async function apiFinalizeScriptWorkspace(projectId, { episode_count, model } = {}) {
  const body = { split_mode: 'rule_first' };
  if (model) body.model = model;
  if (episode_count != null) body.episode_count = episode_count;

  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/script-workspace/finalize`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const rawText = await res.text();
  const trimmedText = rawText.trim();
  const parsed = trimmedText ? (() => {
    try {
      return JSON.parse(trimmedText);
    } catch {
      return null;
    }
  })() : null;

  // 快速路径：apply_split=False，同步返回最终结果
  if (res.ok && parsed && parsed.split_applied === false) {
    invalidate(K.script(projectId));
    return parsed;
  }

  // 异步路径：apply_split=True，返回 task_id，需要轮询
  if (res.ok && parsed && parsed.task_id) {
    const taskId = parsed.task_id;
    // 定稿会拆分生成剧集，先 invalidate
    invalidate(K.script(projectId));
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));

    // 轮询任务直到完成
    const start = Date.now();
    const TIMEOUT_MS = 1800_000; // 30 分钟，与 Nginx 1800s 一致
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const taskRes = await authFetch(`${BASE}/api/tasks/${taskId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!taskRes.ok) continue;

        const task = await taskRes.json();
        const status = task.status || '';
        const results = task.results || [];

        if (status === 'completed') {
          const result = results[0] || {};
          if (result.success) {
            // 从 task results 中提取 finalize 结果
            invalidate(K.episodes(projectId));
            invalidate(K.projectOverview(projectId));
            return {
              split_applied: true,
              replaced_count: result.replaced_count ?? 0,
              created_count: result.created_count ?? 0,
              script_status: result.script_status ?? 'finalized',
              selected_episode_number: result.selected_episode_number,
              backup_history_id: result.backup_history_id,
              items: result.items ?? [],
              split_source: result.split_source ?? 'ai',
              extracted_episode_count: result.extracted_episode_count ?? 0,
              subject_created_count: result.subject_created_count ?? 0,
              subject_updated_count: result.subject_updated_count ?? 0,
              failed_episode_numbers: result.failed_episode_numbers ?? [],
            };
          }
          // success=false → 任务完成但执行失败
          const err = new Error(result.error || '定稿任务执行失败');
          err.status = 500;
          throw err;
        }

        if (status === 'failed') {
          const result = results[0] || {};
          const err = new Error(result.error || '定稿任务执行失败');
          err.status = 500;
          throw err;
        }
        // pending / running → 继续轮询
      } catch (pollErr) {
        if (pollErr.status) throw pollErr; // 确定的错误直接抛出
        console.warn('[apiFinalizeScriptWorkspace] 轮询出错:', pollErr);
        // 网络瞬断等继续重试
      }
    }

    // 超时后的兜底：回查 episodes 确认是否已落库
    invalidate(K.episodes(projectId));
    try {
      const fallbackRes = await authFetch(`${BASE}/api/projects/${projectId}/episodes`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (fallbackRes.ok) {
        const fallbackText = (await fallbackRes.text()).trim();
        const episodes = fallbackText ? JSON.parse(fallbackText) : [];
        if (Array.isArray(episodes) && episodes.length > 0) {
          return {
            items: episodes,
            recovered_from_timeout: true,
          };
        }
      }
    } catch {
      // fallback 也失败，抛超时错误
    }

    const err = new Error('定稿任务超时，请稍后检查分集列表');
    err.status = 524;
    throw err;
  }

  // 兼容旧路径：如果后端仍是同步返回（非 task_id 模式）
  if (res.ok) {
    invalidate(K.script(projectId));
    invalidate(K.episodes(projectId));
    invalidate(K.projectOverview(projectId));
    return parsed ?? {};
  }

  // 某些长耗时定稿在边缘层会先返回 524/空包体，但后端可能已经完成正式分集落库。
  // 这里做一次非缓存回查，只要正式分集已经存在，就按成功结果返回，避免用户看到假失败。
  if ([499, 502, 504, 520, 522, 524].includes(res.status)) {
    try {
      const fallbackRes = await authFetch(`${BASE}/api/projects/${projectId}/episodes`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (fallbackRes.ok) {
        const fallbackText = (await fallbackRes.text()).trim();
        const episodes = fallbackText ? JSON.parse(fallbackText) : [];
        if (Array.isArray(episodes) && episodes.length > 0) {
          invalidate(K.episodes(projectId));
          return {
            items: episodes,
            recovered_from_timeout: true,
            recovered_status: res.status,
          };
        }
      }
    } catch {
      // 保留原始错误继续向上抛出
    }
  }

  const err = new Error(
    parsed?.detail
      || parsed?.message
      || (trimmedText ? trimmedText.slice(0, 200) : `HTTP ${res.status}`)
  );
  err.status = res.status;
  err.response = parsed;
  throw err;
}

export async function apiExtractSubjectsFromScript(projectId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/script-workspace/extract-subjects`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  // 抽取主体会新增主体数据
  invalidate(K.subjectsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
  return res.json();
}
