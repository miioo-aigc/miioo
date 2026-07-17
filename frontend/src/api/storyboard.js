const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch, authFetchForm } from './request.js';
import { cached, invalidate } from '../utils/cache.js';
import { K, TTL, MEDIUM } from '../utils/cacheKeys.js';

// 分镜写操作后统一失效该项目的分镜缓存 + 概览（概览含分镜进度）
function invalidateStoryboards(projectId) {
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
}

function storyboardEvidenceItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    id: item.id,
    episode_id: item.episode_id,
    shot_number: item.shot_number,
    voiceover: typeof item.voiceover === 'string' ? item.voiceover.slice(0, 160) : item.voiceover,
  };
}

function logStoryboardEvidence(label, detail) {
  if (import.meta.env.DEV) {
    console.log(`[Storyboard证据] ${label}`, detail);
  }
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

export async function apiGetStoryboards(projectId, { episode_id, fresh = false } = {}) {
  const fetchFn = async () => {
    const params = new URLSearchParams();
    if (episode_id) params.append('episode_id', episode_id);
    // 按接口上限一次取完整当前集，并显式带回结构化参数，避免刷新依赖旧缓存。
    params.append('limit', '200');
    params.append('include_gen_params', 'true');
    const query = params.toString();
    const url = query
      ? `${BASE}/api/projects/${projectId}/storyboards?${query}`
      : `${BASE}/api/projects/${projectId}/storyboards`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.list || data?.items || []);
    logStoryboardEvidence('分镜列表 GET 返回', {
      method: 'GET',
      url,
      episode_id,
      count: Array.isArray(list) ? list.length : 0,
      records: Array.isArray(list) ? list.map(storyboardEvidenceItem) : list,
    });
    // API 文档确认返回直接数组，兼容未来可能改为分页对象的情况
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.list)) return data.list;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  // fresh 用于写入后的确认读取，必须直接请求接口，不能与旧的缓存请求共用 inflight。
  if (fresh) {
    return fetchFn();
  }

  const raw = await cached(
    K.storyboards(projectId, episode_id),
    fetchFn,
    { medium: MEDIUM.CONTENT, ttl: TTL.CONTENT },
  );
  // 兼容旧缓存可能存的非数组格式
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.list)) return raw.list;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

export async function apiCreateStoryboard(projectId, data) {
  const url = `${BASE}/api/projects/${projectId}/storyboards`;
  logStoryboardEvidence('分镜创建 POST 请求', {
    method: 'POST',
    url,
    body: data,
  });
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidateStoryboards(projectId);
  const created = await res.json();
  logStoryboardEvidence('分镜创建 POST 返回', {
    method: 'POST',
    url,
    returned: storyboardEvidenceItem(created),
  });
  return created;
}

export async function apiUpdateStoryboard(projectId, storyboardId, data) {
  // 更新接口只接收 StoryboardUpdate，剔除创建字段和 undefined，避免后端兼容层误判请求。
  const rawUpdateData = Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => key !== 'shot_number' && key !== 'episode_id'),
  );
  const updateData = Object.fromEntries(
    Object.entries(rawUpdateData).filter(([, value]) => value !== undefined),
  );
  const url = `${BASE}/api/projects/${projectId}/storyboards/${storyboardId}`;
  logStoryboardEvidence('分镜 PATCH 请求', {
    method: 'PATCH',
    url,
    storyboardId,
    body: updateData,
  });
  const res = await authFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  const updated = await res.json();
  logStoryboardEvidence('分镜 PATCH 返回', {
    method: 'PATCH',
    url,
    requestedId: storyboardId,
    returned: storyboardEvidenceItem(updated),
  });
  // PATCH 返回的是单条记录，不能直接回填全量/分集列表缓存；统一失效后由 GET 重建列表。
  // 这样可避免响应缺少 episode_id 时被写入错误集，也避免旧列表和新响应混用。
  invalidate(K.storyboardsPrefix(projectId));
  invalidate(K.projectOverview(projectId));
  return updated;
}

export async function apiUpdateStoryboardNarration(projectId, storyboardId, segments) {
  const narrationSegments = Array.isArray(segments)
    ? segments
        .filter((segment) => segment && (segment.role?.trim() || segment.lines?.trim()))
        .map((segment) => ({
          role: segment.role?.trim() || '',
          lines: segment.lines?.trim() || '',
        }))
    : [];
  const voiceover = narrationSegments
    .map((segment) => segment.role ? `${segment.role}：${segment.lines}` : segment.lines)
    .join('\n');

  // 台词列只更新 StoryboardUpdate 中的 voiceover 字段。
  // 不把 gen_params 带入台词保存，避免后端旧兼容逻辑把结构化参数当成创建输入。
  // 台词保存严格禁止调用创建接口；即使旧服务端返回异常 ID，也只把异常交给页面处理。
  return apiUpdateStoryboard(projectId, storyboardId, { voiceover });
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
