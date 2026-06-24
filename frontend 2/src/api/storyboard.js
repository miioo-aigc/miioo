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
    } catch {}
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
    } catch {}
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
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch {}
    const err = new Error(detail || `获取任务状态失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
