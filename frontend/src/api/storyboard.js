const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm } from './request.js';
import { throwResponseError } from './error.js';
import { cached, invalidate, setCache, peekCache } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';
import { toAbsoluteUrl } from '../utils/imageUrl.js';

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
    options.element_frontal_image = toAbsoluteUrl(elementFrontalImage.trim());
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizeProviderParams(params = {}) {
  const base = isPlainObject(params.provider_params)
    ? { ...params.provider_params }
    : isPlainObject(params.providerParams)
      ? { ...params.providerParams }
      : {};
  const liveMaterial = isPlainObject(params.live_material)
    ? params.live_material
    : isPlainObject(params.liveMaterial)
      ? params.liveMaterial
      : null;
  if (liveMaterial) {
    const assetIds = Array.isArray(liveMaterial.asset_ids)
      ? liveMaterial.asset_ids
      : Array.isArray(liveMaterial.assetIds)
        ? liveMaterial.assetIds
        : [];
    const normalizedAssetIds = assetIds
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    const groupId = String(liveMaterial.group_id ?? liveMaterial.groupId ?? '').trim();
    if (groupId || normalizedAssetIds.length > 0) {
      base.live_material = {
        group_id: groupId || undefined,
        asset_ids: normalizedAssetIds,
        group_type: String(liveMaterial.group_type ?? liveMaterial.groupType ?? 'LivenessFace').trim() || 'LivenessFace',
      };
    }
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

function normalizeUrlList(values) {
  if (!Array.isArray(values)) return undefined;
  const urls = values
    .map((item) => {
      if (typeof item === 'string') return toAbsoluteUrl(item);
      if (item && typeof item === 'object' && typeof item.url === 'string') return toAbsoluteUrl(item.url);
      return null;
    })
    .filter(Boolean);
  return urls.length > 0 ? urls : undefined;
}

function normalizeMultiPrompt(params = {}) {
  const prompts = Array.isArray(params.multi_prompt)
    ? params.multi_prompt
    : Array.isArray(params.multiPrompt)
      ? params.multiPrompt
      : null;
  return prompts && prompts.length > 0 ? prompts : undefined;
}

export async function apiGetStoryboards(projectId, { episode_id } = {}) {
  const raw = await cached(
    K.storyboards(projectId, episode_id),
    async () => {
      const params = new URLSearchParams();
      if (episode_id) params.append('episode_id', episode_id);
      const query = params.toString();
      const url = query
        ? `${BASE}/api/projects/${projectId}/storyboards?${query}`
        : `${BASE}/api/projects/${projectId}/storyboards`;
      const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      // API 文档确认返回直接数组，兼容未来可能改为分页对象的情况
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.list)) return data.list;
      if (Array.isArray(data?.items)) return data.items;
      return [];
    },
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
    const prefix = K.storyboardsPrefix(projectId);
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

export async function apiGenerateStoryboardsFromEpisode(projectId, { episode_id, model }) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episode_id, model }),
  });
  invalidateStoryboards(projectId);
  return res.json();
}

export async function apiGenerateStoryboardsFromFinalScript(projectId) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/generate-from-final-script`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } }
  );
  if (!res.ok) {
    await throwResponseError(res, `分镜生成失败（${res.status}）`, { showDialog: true, title: '分镜生成失败' });
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
    reference_images: normalizeUrlList(params?.reference_images ?? params?.refImages),
    generation_mode: normalizeGenerationMode(params?.generation_mode ?? params?.mode),
    expand_options: normalizeExpandOptions(params),
    subject_completion_options: normalizeSubjectCompletionOptions(params),
    provider_params: normalizeProviderParams(params),
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
    await throwResponseError(res, `生成失败（${res.status}）`, { showDialog: true, title: '图片生成失败' });
  }
  return res.json();
}

export async function apiGenerateStoryboardVideo(projectId, storyboardId, params) {
  const payload = {
    ...params,
    reference_images: normalizeUrlList(params?.reference_images ?? params?.refImages),
    reference_video_url: params?.reference_video_url ? toAbsoluteUrl(params.reference_video_url) : undefined,
    reference_audio_url: params?.reference_audio_url ? toAbsoluteUrl(params.reference_audio_url) : undefined,
    first_frame_url: params?.first_frame_url ? toAbsoluteUrl(params.first_frame_url) : undefined,
    last_frame_url: params?.last_frame_url ? toAbsoluteUrl(params.last_frame_url) : undefined,
    generation_mode: normalizeGenerationMode(params?.generation_mode),
    generate_audio: params?.generate_audio ?? params?.with_audio ?? params?.sound,
    sound_effect: params?.sound_effect ?? params?.sound,
    multi_shot: typeof params?.multi_shot === 'boolean' ? params.multi_shot : undefined,
    shot_type: typeof params?.shot_type === 'string' && params.shot_type.trim() ? params.shot_type.trim() : undefined,
    multi_prompt: normalizeMultiPrompt(params),
    provider_params: normalizeProviderParams(params),
  };
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/generate-video`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    await throwResponseError(res, `生成失败（${res.status}）`, { showDialog: true, title: '视频生成失败' });
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
  const safeBase = base.replace(/[^\x00-\x7F]/g, '_') || 'upload';
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

export async function apiDownloadStoryboardVideo(projectId, storyboardId, { rawResponse = false } = {}) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/download-video`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return rawResponse ? res : res.blob();
}

export async function apiDownloadStoryboardImage(projectId, storyboardId, { rawResponse = false } = {}) {
  const res = await authFetch(
    `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}/download-image`,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return rawResponse ? res : res.blob();
}

export async function apiBatchDownloadStoryboardImages(projectId, storyboard_ids, { rawResponse = false } = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/download/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboard_ids }),
  });
  return rawResponse ? res : res.blob();
}

export async function apiBatchDownloadStoryboardVideos(projectId, storyboard_ids, { rawResponse = false } = {}) {
  const res = await authFetch(`${BASE}/api/projects/${projectId}/storyboards/download/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyboard_ids }),
  });
  return rawResponse ? res : res.blob();
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

export async function apiReorderShots(episodeId, orderedIds) {
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
    await throwResponseError(res, `获取任务状态失败（${res.status}）`);
  }
  return res.json();
}
