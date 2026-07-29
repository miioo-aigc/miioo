const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm } from './request.js';
import { cached, invalidate, setCache, peekCache } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

// 分镜写操作后统一失效该项目的分镜缓存 + 概览（概览含分镜进度）
function invalidateStoryboards(projectId) {
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
}

function normalizeStoryboardImageSize(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (/^\d+x\d+$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[234]k$/i.test(trimmed)) return trimmed.toLowerCase();

  const aliasMap = {
    '1024': '1024x1024',
    '1536': '1536x1536',
    '2048': '2k',
    '3072': '3k',
    '4096': '4k',
    '2K': '2k',
    '3K': '3k',
    '4K': '4k',
  };

  return aliasMap[trimmed] || trimmed;
}

export async function apiGetStoryboards(projectId, { episode_id, limit, offset = 0, include_gen_params = false } = {}) {
  const isPagedRequest = Number.isFinite(limit);
  const fetchPage = async () => {
    const query = new URLSearchParams();
    if (episode_id) query.set('episode_id', episode_id);
    query.set('limit', String(isPagedRequest ? limit : 200));
    if (isPagedRequest && offset > 0) query.set('offset', String(offset));
    if (include_gen_params) query.set('include_gen_params', 'true');
    const res = await authFetch(
      `${BASE}/api/projects/${projectId}/storyboards?${query.toString()}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) {
      const responseText = await res.text().catch(() => '');
      let detail = responseText;
      try {
        const body = responseText ? JSON.parse(responseText) : null;
        detail = body?.detail || body?.message || body?.error || responseText;
      } catch {
        // 后端异常页可能直接返回纯文本，保留原始内容用于诊断。
      }
      const error = new Error(detail || `获取分镜列表失败（HTTP ${res.status}）`);
      error.status = res.status;
      throw error;
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.list || data?.items || [];
    return episode_id
      ? items.filter((item) => (item.episode_id ?? item.episodeId) === episode_id)
      : items;
  };

  // 分页请求不能复用“整集列表”缓存，否则翻页会读到错误的第一页或旧的 200 条数据。
  if (isPagedRequest) return fetchPage();

  const raw = await cached(
    K.storyboards(projectId, episode_id),
    fetchPage,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
  // 兼容旧缓存可能存的非数组格式
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.list)) return raw.list;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

export async function apiCreateStoryboard(projectId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidateStoryboards(projectId);
  return res.json();
}

export async function apiUpdateStoryboard(projectId, storyboardId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const updated = await res.json();
  // 把最新数据回填进所有相关缓存 key，避免刷新时读到旧缓存导致字段丢失
  if (updated?.id) {
    for (const m of ['memory', 'local', 'session']) {
      // 枚举该项目下所有已缓存的 storyboards key
      for (const episodeId of [undefined, updated.episode_id]) {
        const key = K.storyboards(projectId, episodeId);
        const cached = peekCache(key, m);
        if (Array.isArray(cached)) {
          const next = cached.map(s => s.id === updated.id ? updated : s);
          setCache(key, next, { medium: m });
        }
      }
    }
  }
  invalidate(K.projectOverview(projectId));
  return updated;
}

/**
 * 持久化分镜创作面板的编辑状态。
 * 结构化表单放在 gen_params.creation_form，提示词同步写入分镜已有字段，
 * 这样既能完整恢复前端表单，也兼容后端已有的提示词读取逻辑。
 */
export async function apiUpdateStoryboardCreationForm(projectId, storyboardId, { image, video, genParams }) {
  const imageState = image && typeof image === 'object' ? image : {};
  const videoState = video && typeof video === 'object' ? video : {};
  return apiUpdateStoryboard(projectId, storyboardId, {
    image_prompt: imageState.prompt ?? null,
    video_prompt: videoState.prompt ?? null,
    gen_params: {
      ...(genParams && typeof genParams === 'object' ? genParams : {}),
      creation_form: {
        image: imageState,
        video: videoState,
      },
    },
  });
}

// ── 分镜候选媒体 ─────────────────────────────────────────────────────────────

export async function apiListStoryboardMediaCandidates(projectId, storyboardId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`获取分镜候选媒体失败（HTTP ${res.status}）`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.items || data?.media || data?.candidates || [];
  return items.map(normalizeStoryboardMediaCandidate);
}

// 候选媒体接口同时兼容后端 snake_case 和旧前端 camelCase，页面统一消费 camelCase。
export function normalizeStoryboardMediaCandidate(item = {}) {
  const rawMetadata = item.metadata ?? item.metadata_json ?? item.metadataJson ?? {};
  const metadata = typeof rawMetadata === 'string'
    ? (() => { try { return JSON.parse(rawMetadata) || {}; } catch { return {}; } })()
    : (rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : {});
  const parseObject = (value) => {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };
  const parameterContainers = [
    item.params, item.parameters, item.generation, item.options,
    item.gen_params, item.genParams, item.generation_params, item.generationParams,
    item.provider_params, item.providerParams,
    metadata.params, metadata.parameters, metadata.generation, metadata.options,
    metadata.gen_params, metadata.genParams, metadata.generation_params, metadata.generationParams,
    metadata.provider_params, metadata.providerParams,
  ].map(parseObject).filter((value) => Object.keys(value).length > 0);
  const mergedParams = Object.assign({}, ...parameterContainers, {
    expand_options: item.expand_options ?? item.expandOptions ?? metadata.expand_options ?? metadata.expandOptions,
    subject_completion_options: item.subject_completion_options ?? item.subjectCompletionOptions ?? metadata.subject_completion_options ?? metadata.subjectCompletionOptions,
    optimize_prompt: item.optimize_prompt ?? item.optimizePrompt ?? metadata.optimize_prompt ?? metadata.optimizePrompt,
    sequential_image_generation: item.sequential_image_generation ?? item.sequentialImageGeneration ?? metadata.sequential_image_generation ?? metadata.sequentialImageGeneration,
  });
  const prompt = item.input_prompt ?? item.inputPrompt ?? item.prompt ?? metadata.input_prompt ?? metadata.inputPrompt ?? metadata.prompt
    ?? mergedParams.input_prompt ?? mergedParams.inputPrompt ?? mergedParams.prompt;
  const generationParams = mergedParams;
  const normalized = {
    ...item,
    id: item.id,
    storyboardId: item.storyboardId ?? item.storyboard_id,
    mediaType: item.mediaType ?? item.media_type,
    url: item.url ?? item.file_url ?? item.fileUrl,
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url,
    posterUrl: item.posterUrl ?? item.poster_url,
    downloadUrl: item.downloadUrl ?? item.download_url,
    isFinalized: item.isFinalized ?? item.is_finalized ?? false,
    source: item.source ?? item.source_type ?? item.sourceType ?? metadata.source ?? metadata.source_type ?? metadata.sourceType,
    detailSource: item.detailSource ?? item.detail_source ?? item.source_type ?? item.sourceType ?? metadata.detailSource ?? metadata.detail_source,
    createdAt: item.createdAt ?? item.created_at,
    metadata,
    inputPrompt: prompt,
    prompt,
    model: item.model ?? metadata.model ?? mergedParams.model,
    resolution: item.resolution ?? metadata.resolution ?? metadata.size ?? mergedParams.resolution ?? mergedParams.size,
    duration: item.duration ?? metadata.duration ?? mergedParams.duration,
    ratio: item.ratio ?? item.aspect_ratio ?? item.aspectRatio ?? metadata.ratio ?? metadata.aspect_ratio ?? metadata.aspectRatio ?? mergedParams.ratio ?? mergedParams.aspect_ratio ?? mergedParams.aspectRatio,
    referenceImages: item.reference_images ?? item.referenceImages ?? metadata.reference_images ?? metadata.referenceImages ?? mergedParams.reference_images ?? mergedParams.referenceImages,
    genParams: generationParams && typeof generationParams === 'object' ? generationParams : {},
    prompt_raw: item.prompt_raw ?? item.promptRaw ?? metadata.prompt_raw ?? metadata.promptRaw ?? mergedParams.prompt_raw ?? mergedParams.promptRaw,
    prompt_resolved: item.prompt_resolved ?? item.promptResolved ?? metadata.prompt_resolved ?? metadata.promptResolved ?? mergedParams.prompt_resolved ?? mergedParams.promptResolved,
    assetId: item.assetId ?? item.asset_id ?? metadata?.asset_id ?? metadata?.assetId,
  };
  // 保留 snake_case 别名，兼容当前尚未迁移的展示组件和历史缓存。
  return {
    ...normalized,
    storyboard_id: normalized.storyboardId,
    media_type: normalized.mediaType,
    thumbnail_url: normalized.thumbnailUrl,
    poster_url: normalized.posterUrl,
    download_url: normalized.downloadUrl,
    is_finalized: Boolean(normalized.isFinalized),
    created_at: normalized.createdAt,
    input_prompt: normalized.inputPrompt,
    gen_params: normalized.genParams,
    generation_params: normalized.genParams,
    detail_source: normalized.detailSource,
  };
}

export async function apiCreateStoryboardMediaCandidate(projectId, storyboardId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`保存分镜候选媒体失败（HTTP ${res.status}）`);
  return normalizeStoryboardMediaCandidate(await res.json());
}

export async function apiUpdateStoryboardMediaCandidate(projectId, storyboardId, mediaId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates/${mediaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`更新分镜候选媒体失败（HTTP ${res.status}）`);
  return normalizeStoryboardMediaCandidate(await res.json());
}

export async function apiDeleteStoryboardMediaCandidate(projectId, storyboardId, mediaId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates/${mediaId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`删除分镜候选媒体失败（HTTP ${res.status}）`);
}

export async function apiDownloadStoryboardMediaCandidate(projectId, storyboardId, mediaId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates/${mediaId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`下载分镜候选媒体失败（HTTP ${res.status}）`);
  return res.blob();
}

export async function apiDeleteStoryboard(projectId, storyboardId) {
  await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  invalidateStoryboards(projectId);
}

export async function apiReorderStoryboards(projectId, ordered_ids) {
  await authFetch(`${BASE}/api/projects/${projectId}/storyboards/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordered_ids }),
  });
  invalidateStoryboards(projectId);
}

// ── 分镜生成 ──────────────────────────────────────────────────────────────────

export async function apiGenerateStoryboardsFromEpisode(projectId, { episode_id, model = null, overwrite_existing = true } = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episode_id, model, overwrite_existing }),
  });
  if (!res.ok) {
    const responseText = await res.text().catch(() => '');
    let detail;
    try {
      const body = responseText ? JSON.parse(responseText) : null;
      detail = body?.detail || body?.message || body?.error || body?.status_message || '';
    } catch {
      // 网关错误可能返回纯文本或 HTML，保留可读的原始响应用于联调。
      detail = responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const error = new Error(detail || `分镜生成失败（HTTP ${res.status}）`);
    error.status = res.status;
    throw error;
  }
  invalidateStoryboards(projectId);
  const data = await res.json();
  // OpenAPI 当前声明该接口直接返回分镜数组；兼容后端联调期间出现的统一响应包装。
  // 包装对象必须在 API 层解开，否则页面会把 { data: ... } 误判为“没有任务 ID”。
  const payload = data?.data ?? data?.result ?? data?.payload ?? data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.storyboards)) return payload.storyboards;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.items)) return payload.items;
  return payload;
}

export async function apiGenerateStoryboardsFromFinalScript(projectId, options = {}) {
  const payload = {
    model: null,
    episode_count: null,
    split_mode: 'rule_first',
    continue_in_background: true,
    first_episode_only: true,
    ...options,
  };
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/generate-from-final-script`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
    } catch {
      // 非 JSON 响应（如 502 HTML），忽略解析
    }
    const err = new Error(detail || `分镜生成失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  // 失效 episodes 缓存：后端可能在此过程中重新创建 episodes（新 UUID）
  invalidate(K.episodes(projectId));
  invalidateStoryboards(projectId);
  return res.json();
}

// ── 分镜图片/视频生成 ─────────────────────────────────────────────────────────

export async function apiGenerateStoryboardImage(projectId, storyboardId, params) {
  const normalizedSize = normalizeStoryboardImageSize(params?.size || params?.resolution);
  const payload = {
    ...params,
    size: normalizedSize,
    resolution: normalizedSize,
  };

  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/generate-image`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(detail || `生成失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiGenerateStoryboardVideo(projectId, storyboardId, params) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/generate-video`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(detail || `生成失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── 分镜文件上传/下载 ─────────────────────────────────────────────────────────

/**
 * 将文件名中的非 ASCII 字符替换为下划线，保留扩展名。
 * 避免部分服务端（python-multipart）解析 Content-Disposition 中中文文件名时报 500。
 */
function safeFileName(file) {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const base = file.name.slice(0, file.name.length - ext.length);
  const safeBase = Array.from(base, (char) => char.codePointAt(0) < 128 ? char : '_').join('') || 'upload';
  return safeBase + ext;
}

export async function apiUploadStoryboardImage(projectId, storyboardId, file) {
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/upload-image`,
    { method: 'POST', body: form }
  );
  invalidateStoryboards(projectId);
  return res.json();
}

export async function apiUploadStoryboardVideo(projectId, storyboardId, file) {
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetchForm(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/upload-video`,
    { method: 'POST', body: form }
  );
  invalidateStoryboards(projectId);
  return res.json();
}

export async function apiDownloadStoryboardVideo(projectId, storyboardId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/download-video`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return res.blob();
}

export async function apiBatchDownloadStoryboardImages(projectId, storyboard_ids) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/download/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboard_ids }),
  });
  return res.blob();
}

export async function apiBatchDownloadStoryboardVideos(projectId, storyboard_ids) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/download/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboard_ids }),
  });
  return res.blob();
}

// ── 通用文件上传（图片）──────────────────────────────────────────────────────

export async function apiUploadImage(file) {
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetchForm(`${BASE}/api/images/upload`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

// ── Legacy aliases（兼容旧页面调用）────────────────────────────────────────────

export const apiUploadFile = apiUploadImage;
export const apiGetShots = apiGetStoryboards;
export const apiCreateShot = apiCreateStoryboard;
export const apiDeleteShot = apiDeleteStoryboard;

export async function apiUpdateShot(storyboardId, data) {
  console.warn('[api] apiUpdateShot 缺少 projectId，调用方应改用 apiUpdateStoryboard(projectId, storyboardId, data)');
  return { id: storyboardId, ...data };
}

export async function apiUpdateShotFinalized(shotId, finalized) {
  console.warn('[api] apiUpdateShotFinalized: 后端 StoryboardUpdate 无 finalized 字段，此调用为 no-op');
  return { id: shotId, finalized };
}

export async function apiReorderShots(_episodeId, _orderedIds) {
  void _episodeId;
  void _orderedIds;
  console.warn('[api] apiReorderShots 缺少 projectId，调用方应改用 apiReorderStoryboards(projectId, ordered_ids)');
}

export const apiGenerateImage = apiGenerateStoryboardImage;
export const apiGenerateVideo = apiGenerateStoryboardVideo;

// ── 任务轮询 ──────────────────────────────────────────────────────────────────

export async function apiGetTask(taskId) {
  const res = await authFetch(`${BASE}/api/tasks/${taskId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch { /* 忽略非 JSON 错误响应 */ }
    const err = new Error(detail || `获取任务状态失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
