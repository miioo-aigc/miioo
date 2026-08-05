const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm } from './request.js';
import { cached, invalidate, setCache, peekCache } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';
import { isBackendStoryboardId } from '../utils/storyboardDataAdapter.js';

// 分镜写操作后统一失效该项目的分镜缓存 + 概览（概览含分镜进度）
function invalidateStoryboards(projectId) {
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.storyboardPagePrefix(projectId));
  invalidate(K.storyboardMediaCandidatesPrefix(projectId));
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

// 分镜列表缓存只服务于首屏文字和结构化字段。媒体候选会单独从
// media-candidates 接口读取，避免把大体积媒体元数据或 data URL 写进 localStorage。
export function compactStoryboardForCache(item = {}) {
  if (!item || typeof item !== 'object') return item;
  const compact = { ...item };
  const dropLargeValue = (value) => {
    if (typeof value !== 'string') return value;
    if (value.startsWith('data:') || value.length > 200_000) return undefined;
    return value;
  };

  for (const key of ['image_url', 'video_url', 'imageUrl', 'videoUrl', 'thumbnail_url', 'poster_url', 'reference_image_urls', 'reference_images']) {
    if (!(key in compact)) continue;
    if (Array.isArray(compact[key])) {
      compact[key] = compact[key]
        .map((value) => {
          if (typeof value === 'string') return dropLargeValue(value);
          if (!value || typeof value !== 'object') return value;
          const next = { ...value };
          for (const urlKey of ['url', 'image_url', 'imageUrl', 'thumbnail_url', 'thumbnailUrl', 'poster_url', 'posterUrl']) {
            if (urlKey in next) next[urlKey] = dropLargeValue(next[urlKey]);
          }
          return next;
        })
        .filter(Boolean);
    } else {
      compact[key] = dropLargeValue(compact[key]);
    }
  }

  // 某些历史记录会把原始供应商响应或二进制内容放进 gen_params。
  // 保留生成参数和可恢复的轻量创作表单，但移除明显的大字段，保证文字缓存可持久化。
  const genParams = compact.gen_params ?? compact.genParams;
  if (genParams && typeof genParams === 'object') {
    const nextParams = { ...genParams };
    const compactValue = (value) => {
      if (typeof value === 'string') {
        return value.startsWith('data:') || value.length > 200_000 ? undefined : value;
      }
      if (Array.isArray(value)) {
        return value.map(compactValue).filter((item) => item !== undefined);
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .map(([key, item]) => [key, compactValue(item)])
            .filter(([, item]) => item !== undefined),
        );
      }
      return value;
    };
    Object.keys(nextParams).forEach((key) => {
      nextParams[key] = compactValue(nextParams[key]);
      if (nextParams[key] === undefined) delete nextParams[key];
    });
    compact.gen_params = nextParams;
    delete compact.genParams;
  }
  return compact;
}

// 候选媒体跨刷新只缓存卡片渲染所需的轻量索引，不保存完整候选对象。
// 分镜列和时间轴都依赖这些封面字段；生成参数、参考图数组和供应商响应仍只保留在当前会话内。
function compactStoryboardMediaCandidateForCache(item = {}) {
  if (!item || typeof item !== 'object') return item;
  const dropLargeValue = (value) => (
    typeof value === 'string' && (value.startsWith('data:') || value.length > 200_000)
      ? undefined
      : value
  );
  const cached = {};
  const copy = (key) => {
    if (item[key] === undefined || item[key] === null || item[key] === '') return;
    const value = dropLargeValue(item[key]);
    if (value !== undefined) cached[key] = value;
  };

  // ID、媒体类型、定稿状态和图片地址足以恢复分镜列/时间轴卡片。
  [
    'id', 'assetId', 'asset_id', 'storyboardId', 'storyboard_id',
    'mediaType', 'media_type', 'type', 'isFinalized', 'is_finalized',
    'source', 'source_type', 'sourceType', 'name', 'createdAt', 'created_at',
    'url', 'thumbnailUrl', 'thumbnail_url', 'posterUrl', 'poster_url',
    'previewUrl', 'preview_url', 'previewVideoUrl', 'preview_video_url',
    'videoThumbnailUrl', 'video_thumbnail_url', 'mediaPreviewUrl', 'media_preview_url',
  ].forEach(copy);

  return cached;
}

export async function apiGetStoryboards(projectId, { episode_id, limit, offset = 0, include_gen_params = true } = {}) {
  const isPagedRequest = Number.isFinite(limit);
  const fetchPage = async (withGenParams = include_gen_params) => {
    const query = new URLSearchParams();
    if (episode_id) query.set('episode_id', episode_id);
    query.set('limit', String(isPagedRequest ? limit : 200));
    if (isPagedRequest && offset > 0) query.set('offset', String(offset));
    if (withGenParams) query.set('include_gen_params', 'true');
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
    const filtered = episode_id
      ? items.filter((item) => (item.episode_id ?? item.episodeId) === episode_id)
      : items;
    return filtered;
  };

  // include_gen_params 是可选字段。部分历史分镜的生成参数可能无法被后端
  // 序列化，导致带参数的列表请求返回 500；降级请求仍返回核心分镜数据，
  // 避免整页因为一条异常 gen_params 无法打开。
  const fetchPageWithFallback = async () => {
    try {
      return await fetchPage(include_gen_params);
    } catch (error) {
      if (include_gen_params && error?.status === 500) {
        console.warn('[storyboard] include_gen_params 请求失败，降级读取基础分镜列表:', error.message);
        return fetchPage(false);
      }
      throw error;
    }
  };

  if (isPagedRequest) {
    // 分页结果使用独立 key，不能与整集列表共用，避免页码、limit 或参数版本串数据。
    // 项目分镜写操作通过 storyboards: 项目前缀统一失效这些分页缓存。
    const pageKey = K.storyboardPage(projectId, episode_id, limit, offset, include_gen_params);
    const rawPage = await cached(
      pageKey,
      fetchPageWithFallback,
      {
        // 分页数据只服务当前分镜页，避免每个分页副本长期占用 localStorage。
        medium: 'memory',
        ttl: TTL.CONTENT,
        serialize: (data) => Array.isArray(data) ? data.map(compactStoryboardForCache) : data,
      },
    );
    return Array.isArray(rawPage) ? rawPage : (rawPage?.list || rawPage?.items || []);
  }

  const raw = await cached(
    K.storyboards(projectId, episode_id),
    fetchPageWithFallback,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT, serialize: (data) => Array.isArray(data) ? data.map(compactStoryboardForCache) : data },
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
  // 部分 PATCH 响应只返回分镜基础字段，不回传 gen_params.creation_form。
  // 本次请求已经提交的创作表单不能因此从本地缓存中消失，否则刷新时会恢复成旧状态。
  const requestGenParams = data?.gen_params;
  const responseGenParams = updated?.gen_params;
  const requestedCreationForm = requestGenParams?.creation_form || requestGenParams?.creationForm;
  const responseCreationForm = responseGenParams?.creation_form || responseGenParams?.creationForm;
  const requestFields = [
    'shot_number',
    'content',
    'shot_type',
    'camera',
    'camera_angle',
    'composition',
    'duration',
    'lighting',
    'ambient_sound',
    'voiceover',
    'character_ids',
    'scene_id',
    'prop_ids',
    'reference_image_urls',
    'reference_images',
    'image_url',
    'video_url',
    'image_prompt',
    'video_prompt',
    'video_prompt_mentions',
  ];
  const requestedStoryboardFields = requestFields.reduce((result, field) => {
    if (data?.[field] !== undefined) result[field] = data[field];
    return result;
  }, {});
  const hasRequestGenParams = requestGenParams && typeof requestGenParams === 'object';
  const cacheUpdated = {
    ...updated,
    ...requestedStoryboardFields,
    ...(hasRequestGenParams
      ? {
          gen_params: {
            ...(responseGenParams && typeof responseGenParams === 'object' ? responseGenParams : {}),
            ...requestGenParams,
            ...(requestedCreationForm
              ? {
                  creation_form: {
                    ...(responseCreationForm || {}),
                    ...requestedCreationForm,
                  },
                }
              : {}),
          },
        }
      : {}),
  };
  // 把最新数据回填进所有相关缓存 key，避免刷新时读到旧缓存导致字段丢失
  const updatedId = updated?.id || storyboardId;
  if (updatedId) {
    for (const m of ['memory', 'local', 'session']) {
      // 枚举该项目下所有已缓存的 storyboards key
      for (const episodeId of [undefined, updated.episode_id]) {
        const key = K.storyboards(projectId, episodeId);
        const cached = peekCache(key, m);
        if (Array.isArray(cached)) {
          const next = cached.map(s => s.id === updatedId ? compactStoryboardForCache({ ...cacheUpdated, id: updatedId }) : s);
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
    video_prompt_mentions: Array.isArray(videoState.video_prompt_mentions)
      ? videoState.video_prompt_mentions
      : [],
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
  if (!isBackendStoryboardId(storyboardId)) {
    throw new Error('分镜候选媒体请求缺少有效的分镜 ID');
  }
  const fetchCandidates = async () => {
    const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`获取分镜候选媒体失败（HTTP ${res.status}）`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.items || data?.media || data?.candidates || [];
    return items.map(normalizeStoryboardMediaCandidate);
  };
  return cached(
    K.storyboardMediaCandidates(projectId, storyboardId),
    fetchCandidates,
    {
      // 通过 serialize 只持久化轻量封面索引，避免把候选生成参数写入 localStorage。
      medium: MEDIUM.CONTENT,
      ttl: TTL.CONTENT,
      serialize: (items) => Array.isArray(items) ? items.map(compactStoryboardMediaCandidateForCache) : items,
    },
  );
}

// 候选媒体接口同时兼容后端 snake_case 和旧前端 camelCase，页面统一消费 camelCase。
// previewVideoUrl 只用于悬停动态预览，不能替代封面或原始媒体地址。
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
  const prompt = item.input_prompt ?? item.inputPrompt ?? item.prompt ?? item.prompt_raw ?? item.promptRaw
    ?? item.prompt_resolved ?? item.promptResolved
    ?? metadata.input_prompt ?? metadata.inputPrompt ?? metadata.prompt ?? metadata.prompt_raw ?? metadata.promptRaw
    ?? metadata.prompt_resolved ?? metadata.promptResolved
    ?? mergedParams.input_prompt ?? mergedParams.inputPrompt ?? mergedParams.prompt
    ?? mergedParams.prompt_raw ?? mergedParams.promptRaw ?? mergedParams.prompt_resolved ?? mergedParams.promptResolved;
  const generationParams = mergedParams;
  const mediaType = item.mediaType ?? item.media_type ?? (item.type?.startsWith('video') ? 'video' : 'image');
  const generatedImage = Array.isArray(item.generated_images) ? item.generated_images[0] : null;
  const metadataGeneratedImage = Array.isArray(metadata.generated_images) ? metadata.generated_images[0] : null;
  const imageDerivative = generatedImage || metadataGeneratedImage || {};
  const previewUrl = item.preview_url
    ?? item.previewUrl
    ?? metadata.preview_url
    ?? metadata.previewUrl
    ?? imageDerivative.preview_url
    ?? imageDerivative.previewUrl;
  const thumbnailUrl = item.thumbnail_url
    ?? item.thumbnailUrl
    ?? metadata.thumbnail_url
    ?? metadata.thumbnailUrl
    ?? imageDerivative.thumbnail_url
    ?? imageDerivative.thumbnailUrl;
  const videoThumbnailUrl = item.video_thumbnail_url
    ?? item.videoThumbnailUrl
    ?? metadata.video_thumbnail_url
    ?? metadata.videoThumbnailUrl;
  const previewVideoUrl = item.preview_video_url
    ?? item.previewVideoUrl
    ?? metadata.preview_video_url
    ?? metadata.previewVideoUrl;
  const posterUrl = item.poster_url
    ?? item.posterUrl
    ?? metadata.poster_url
    ?? metadata.posterUrl;
  const normalizedUrl = mediaType === 'video'
    ? (item.url
      ?? item.file_url
      ?? item.fileUrl
      ?? item.preview_video_url
      ?? item.previewVideoUrl
      ?? item.video_url
      ?? item.videoUrl
      ?? item.preview_url
      ?? item.large_url
      ?? item.thumbnail_url
      ?? item.thumbnailUrl)
    : (item.url
      ?? item.file_url
      ?? item.fileUrl
      ?? item.preview_url
      ?? item.previewUrl
      ?? item.large_url
      ?? item.thumbnail_url
      ?? item.thumbnailUrl);
  const normalized = {
    ...item,
    id: item.id,
    storyboardId: item.storyboardId ?? item.storyboard_id,
    mediaType,
    url: normalizedUrl,
    thumbnailUrl,
    posterUrl,
    previewUrl,
    previewVideoUrl,
    videoThumbnailUrl,
    mediaPreviewUrl: mediaType === 'video' ? (videoThumbnailUrl || posterUrl) : (previewUrl || thumbnailUrl),
    downloadUrl: item.downloadUrl ?? item.download_url,
    isFinalized: Boolean(item.isFinalized ?? item.is_finalized ?? false),
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
    referenceImages: item.reference_images ?? item.referenceImages
      ?? item.reference_image_urls ?? item.referenceImageUrls
      ?? item.ref_images ?? item.refImages
      ?? metadata.reference_images ?? metadata.referenceImages
      ?? metadata.reference_image_urls ?? metadata.referenceImageUrls
      ?? metadata.ref_images ?? metadata.refImages
      ?? mergedParams.reference_images ?? mergedParams.referenceImages
      ?? mergedParams.reference_image_urls ?? mergedParams.referenceImageUrls
      ?? mergedParams.ref_images ?? mergedParams.refImages,
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
    preview_url: normalized.previewUrl,
    preview_video_url: normalized.previewVideoUrl,
    video_thumbnail_url: normalized.videoThumbnailUrl,
    media_preview_url: normalized.mediaPreviewUrl,
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
  invalidate(K.storyboardMediaCandidates(projectId, storyboardId));
  return normalizeStoryboardMediaCandidate(await res.json());
}

export async function apiUpdateStoryboardMediaCandidate(projectId, storyboardId, mediaId, data) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates/${mediaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`更新分镜候选媒体失败（HTTP ${res.status}）`);
  invalidate(K.storyboardMediaCandidates(projectId, storyboardId));
  return normalizeStoryboardMediaCandidate(await res.json());
}

export async function apiDeleteStoryboardMediaCandidate(projectId, storyboardId, mediaId) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/media-candidates/${mediaId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`删除分镜候选媒体失败（HTTP ${res.status}）`);
  invalidate(K.storyboardMediaCandidates(projectId, storyboardId));
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

function unwrapStoryboardTaskResponse(data) {
  let payload = data?.data ?? data?.payload ?? data;
  if (payload?.task && typeof payload.task === 'object') return payload.task;
  if (payload && typeof payload === 'object' && (
    payload.id || payload.task_id || payload.taskId || payload.status || payload.raw_status
  )) return payload;
  if (payload?.result && typeof payload.result === 'object') {
    payload = payload.result;
    if (payload.task && typeof payload.task === 'object') return payload.task;
  }
  return payload;
}

export async function apiGenerateStoryboardsFromEpisode(projectId, {
  episode_id,
  model = null,
  overwrite_existing = true,
  confirm_overwrite = false,
} = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episode_id, model, overwrite_existing, confirm_overwrite }),
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
  // 真实后端按文档返回任务对象；联调期间仍兼容旧版直接返回数组及统一响应包装。
  // 包装对象必须在 API 层解开，否则页面会把 { data: ... } 误判为“没有任务 ID”。
  const payload = unwrapStoryboardTaskResponse(data);
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
  return unwrapStoryboardTaskResponse(await res.json());
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
  return unwrapStoryboardTaskResponse(await res.json());
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
  return unwrapStoryboardTaskResponse(await res.json());
}
