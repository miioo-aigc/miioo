const BASE = import.meta.env.VITE_API_BASE_URL;

import { authFetch } from './request.js';
import { toAbsoluteUrl } from '../utils/imageUrl.js';

// ── 创作会话（Session）───────────────────────────────────────────────────────

export async function apiListCreationSessions({ project_id, status } = {}) {
  const params = new URLSearchParams();
  if (project_id) params.append('project_id', project_id);
  if (status) params.append('status', status);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/sessions?${query}` : `${BASE}/api/creation/sessions`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export async function apiCreateSession(data) {
  const res = await authFetch(`${BASE}/api/creation/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGetSession(sessionId) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiUpdateSession(sessionId, data) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDeleteSession(sessionId) {
  await authFetch(`${BASE}/api/creation/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── 创作镜头（Shot）──────────────────────────────────────────────────────────

export async function apiListShots(sessionId) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}/shots`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiCreateShot(sessionId, data) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}/shots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGetShot(shotId) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiUpdateShot(shotId, data) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDeleteShot(shotId) {
  await authFetch(`${BASE}/api/creation/shots/${shotId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiReorderShots(sessionId, shot_ids) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}/shots/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shot_ids }),
  });
  return res.json();
}

// ── 创作图片 ──────────────────────────────────────────────────────────────────

export async function apiListCreationImages(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v);
  });
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/images?${query}` : `${BASE}/api/creation/images`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export async function apiGetCreationImage(imageId) {
  const res = await authFetch(`${BASE}/api/creation/images/${imageId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiGenerateCreationImages(data) {
  const res = await authFetch(`${BASE}/api/creation/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGenerateShotImage(shotId, data) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDeleteCreationImage(imageId) {
  const res = await authFetch(`${BASE}/api/creation/images/${imageId}`, { method: 'DELETE' });
  return res.json();
}

export async function apiToggleImageFavorite(imageId, liked) {
  const res = await authFetch(`${BASE}/api/creation/images/${imageId}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked }),
  });
  return res.json();
}

export async function apiBatchDeleteImages(ids) {
  const res = await authFetch(`${BASE}/api/creation/images/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return res.json();
}

export async function apiBatchDownloadImages(ids) {
  const res = await authFetch(`${BASE}/api/creation/images/batch-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return res.blob();
}

export async function apiBatchFavoriteImages(ids, liked) {
  const res = await authFetch(`${BASE}/api/creation/images/batch-favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, liked }),
  });
  return res.json();
}

export async function apiDownloadCreationImage(imageId) {
  const res = await authFetch(`${BASE}/api/creation/images/${imageId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.blob();
}

// ── 创作视频 ──────────────────────────────────────────────────────────────────

export async function apiListCreationVideos({ page, page_size } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.append('page', page);
  if (page_size !== undefined) params.append('page_size', page_size);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/videos?${query}` : `${BASE}/api/creation/videos`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export async function apiGenerateCreationVideo(data) {
  const res = await authFetch(`${BASE}/api/creation/videos/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGenerateShotVideo(shotId, data) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}/generate-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDeleteCreationVideo(videoId) {
  const res = await authFetch(`${BASE}/api/creation/videos/${videoId}`, { method: 'DELETE' });
  return res.json();
}

export async function apiToggleVideoFavorite(videoId, liked) {
  const res = await authFetch(`${BASE}/api/creation/videos/${videoId}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked }),
  });
  if (!res.ok) {
    const err = new Error(`toggleVideoFavorite failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function apiBatchDeleteVideos(ids) {
  const res = await authFetch(`${BASE}/api/creation/videos/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return res.json();
}

export async function apiBatchDownloadVideos(ids) {
  const res = await authFetch(`${BASE}/api/creation/videos/batch-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return res.blob();
}

export async function apiDownloadCreationVideo(videoId) {
  const res = await authFetch(`${BASE}/api/creation/videos/${videoId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.blob();
}

// ── 创作音频 ──────────────────────────────────────────────────────────────────

export async function apiGenerateCreationAudio(data) {
  const res = await authFetch(`${BASE}/api/creation/audios/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiGenerateShotAudio(shotId, data) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}/generate-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiListCreationAudios({ page, page_size, is_favorite, search } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.append('page', page);
  if (page_size !== undefined) params.append('page_size', page_size);
  if (is_favorite !== undefined) params.append('is_favorite', is_favorite);
  if (search) params.append('search', search);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/audios?${query}` : `${BASE}/api/creation/audios`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export async function apiGetCreationAudio(audioId) {
  const res = await authFetch(`${BASE}/api/creation/audios/${audioId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiDeleteCreationAudio(audioId) {
  await authFetch(`${BASE}/api/creation/audios/${audioId}`, { method: 'DELETE' });
}

export async function apiToggleAudioFavorite(audioId) {
  await authFetch(`${BASE}/api/creation/audios/${audioId}/favorite`, { method: 'POST' });
}

export async function apiBatchDeleteAudios(audio_ids) {
  await authFetch(`${BASE}/api/creation/audios/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_ids }),
  });
}

export async function apiBatchDownloadAudios(audio_ids) {
  const res = await authFetch(`${BASE}/api/creation/audios/batch-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_ids }),
  });
  return res.blob();
}

export async function apiDownloadCreationAudio(audioId) {
  const res = await authFetch(`${BASE}/api/creation/audios/${audioId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.blob();
}

// ── 创作任务轮询 ──────────────────────────────────────────────────────────────

export async function apiListCreationTasks({ status, task_type, session_id, shot_id } = {}) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (task_type) params.append('task_type', task_type);
  if (session_id) params.append('session_id', session_id);
  if (shot_id) params.append('shot_id', shot_id);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/tasks?${query}` : `${BASE}/api/creation/tasks`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

export async function apiGetCreationImageTask(taskId) {
  const res = await authFetch(`${BASE}/api/creation/tasks/${taskId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiGetCreationVideoTask(taskId) {
  const res = await authFetch(`${BASE}/api/creation/videos/tasks/${taskId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiGetCreationAudioTask(taskId) {
  const res = await authFetch(`${BASE}/api/creation/audios/tasks/${taskId}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

// ── 创作上传 ──────────────────────────────────────────────────────────────────

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

export async function apiUploadCreationImage({ file, category, asset_name, session_id, shot_id, project_id }) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (asset_name) params.append('asset_name', asset_name);
  if (session_id) params.append('session_id', session_id);
  if (shot_id) params.append('shot_id', shot_id);
  if (project_id) params.append('project_id', project_id);
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetch(`${BASE}/api/creation/images/upload?${params.toString()}`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

export async function apiUploadCreationVideo({ file, category, asset_name, session_id, shot_id, project_id }) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (asset_name) params.append('asset_name', asset_name);
  if (session_id) params.append('session_id', session_id);
  if (shot_id) params.append('shot_id', shot_id);
  if (project_id) params.append('project_id', project_id);
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetch(`${BASE}/api/creation/videos/upload?${params.toString()}`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

export async function apiUploadCreationAudio({ file, category, asset_name, session_id, shot_id, project_id }) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (asset_name) params.append('asset_name', asset_name);
  if (session_id) params.append('session_id', session_id);
  if (shot_id) params.append('shot_id', shot_id);
  if (project_id) params.append('project_id', project_id);
  const form = new FormData();
  form.append('file', file, safeFileName(file));
  const res = await authFetch(`${BASE}/api/creation/audios/upload?${params.toString()}`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}

// ── Legacy：apiGetVideoLastFrame（后端无此接口，暂返回 null）──────────────────

export async function apiGetVideoLastFrame(videoUrl) {
  // 后端无 /api/creation/video-last-frame 接口
  // 如需此功能，可在前端用 ffmpeg.wasm 提取，或等待后端提供
  console.warn('[api] apiGetVideoLastFrame: 后端无此接口，返回 null');
  return { lastFrameUrl: null };
}

// ── 视频任务独立轮询（供刷新后恢复使用）──────────────────────────────────────

export async function apiPollVideoTask(taskId, timeoutMs = 1800000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await authFetch(`${BASE}/api/creation/videos/tasks/${taskId}`);
    const pollData = await pollRes.json();
    const status = pollData.status;
    if (status === 'done' || status === 'completed' || status === 'success' || status === 'partial') {
      const result = pollData.result;
      if (!result) continue;
      const videoUrl = result.hlsUrl || result.hls_url
        || result.previewVideoUrl || result.preview_video_url
        || result.video_url || result.videoUrl;
      if (!videoUrl) continue;
      return {
        videos: [videoUrl].filter(Boolean),
        cardIds: [result.id].filter(Boolean),
        posterUrl: result.posterUrl || result.poster_url || undefined,
      };
    }
    if (status === 'failed' || status === 'error') {
      const rawMsg = pollData.error_msg || pollData.errorMsg || '';
      let userMessage;
      if (rawMsg.includes('copyright')) {
        userMessage = '生成的视频内容可能涉及版权限制，请修改素材或创作描述后重试';
      } else if (rawMsg.includes('sensitive') || rawMsg.includes('policy')) {
        userMessage = '生成内容触发了内容安全限制，请修改素材或创作描述后重试';
      } else {
        userMessage = rawMsg || 'Generation failed';
      }
      const err = new Error(userMessage);
      err.rawMessage = rawMsg;
      throw err;
    }
  }
  throw new Error('Generation timeout');
}

// ── Legacy：apiGenerateCreation（兼容旧调用，内部拆分图片/视频分支）──────────

export async function apiGenerateCreation(params, { onTaskCreated } = {}) {
  const isDubbing = params.genType === 'dubbing';
  const isVideo = params.genType === 'video';

  // ── 内部：轮询任务 ──────────────────────────────────────────────────────
  async function pollTask(pollUrl, extractFn, timeoutMs = 1800000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await authFetch(pollUrl);
      const pollData = await pollRes.json();
      const status = pollData.status;
      if (status === 'done' || status === 'completed' || status === 'success' || status === 'partial') {
        // partial=true 字段表示部分图片完成，继续轮询直到全部完成（针对图片多张生成）
        if (status !== 'partial' && pollData.partial === true) continue;
        return extractFn(pollData);
      }
      if (status === 'failed' || status === 'error') {
        const rawMsg = pollData.error_msg || pollData.errorMsg || '';
        let userMessage;
        if (rawMsg.includes('copyright')) {
          userMessage = '生成的视频内容可能涉及版权限制，请修改素材或创作描述后重试';
        } else if (rawMsg.includes('sensitive') || rawMsg.includes('policy')) {
          userMessage = '生成内容触发了内容安全限制，请修改素材或创作描述后重试';
        } else {
          userMessage = rawMsg || 'Generation failed';
        }
        const err = new Error(userMessage);
        err.rawMessage = rawMsg;
        throw err;
      }
    }
    throw new Error('Generation timeout');
  }

  // ── 上传参考文件，拿到 URL / asset_id ──────────────────────────────────
  const uploadContext = {
    session_id: params.session_id || undefined,
    shot_id: params.shot_id || undefined,
    project_id: params.project_id || undefined,
  };

  // 上传参考文件（按媒体类型分类：图片 / 视频 / 音频）
  const files = params.files ? (Array.isArray(params.files) ? params.files : [params.files]) : [];
  const refUrls = [];
  const refAssetIds = [];
  let uploadedRefVideoUrl;
  let uploadedRefAudioUrl;

  for (const f of files) {
    // 已经有 URL 的资产（如「用作参考图」、资产库选择的素材），直接分类使用
    if (f && typeof f === 'object' && !(f instanceof File) && f.url) {
      const mime = (f.type || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      const isVid = mime.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|wmv|flv)$/.test(name);
      const isAud = mime.startsWith('audio/') || /\.(mp3|wav|aac|ogg|flac|m4a|wma)$/.test(name);
      if (isVid) {
        uploadedRefVideoUrl = f.url;
      } else if (isAud) {
        uploadedRefAudioUrl = f.url;
      } else {
        // 图片资产
        refUrls.push(f.url);
        if (f.assetId) refAssetIds.push(f.assetId);
      }
      continue;
    }
    if (!(f instanceof File)) continue;
    const mime = f.type.toLowerCase();
    const isVid = mime.startsWith('video/');
    const isAud = mime.startsWith('audio/');
    try {
      if (isVid) {
        const result = await apiUploadCreationVideo({ file: f, category: 'reference', ...uploadContext });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) uploadedRefVideoUrl = url;
      } else if (isAud) {
        const result = await apiUploadCreationAudio({ file: f, category: 'reference', ...uploadContext });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) uploadedRefAudioUrl = url;
      } else {
        // 图片
        const result = await apiUploadCreationImage({ file: f, category: 'reference', ...uploadContext });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) refUrls.push(url);
        const assetId = result.asset_id;
        if (assetId) refAssetIds.push(assetId);
      }
    } catch { /* 单个文件上传失败不阻塞整体 */ }
  }

  // 上传首帧 / 尾帧（图片），用于视频生成
  let firstFrameUrl, lastFrameUrl, firstFrameAssetId, lastFrameAssetId;
  if (params.firstFrameFile instanceof File) {
    try {
      const r = await apiUploadCreationImage({ file: params.firstFrameFile, category: 'first_frame', ...uploadContext });
      firstFrameUrl = r.uploaded_url || r.uploadedUrl || undefined;
      firstFrameAssetId = r.asset_id || undefined;
    } catch {}
  } else if (params.firstFrameFile && params.firstFrameFile.url) {
    // 资产库选择的首帧：已有 URL，无需上传
    firstFrameUrl = params.firstFrameFile.url;
    firstFrameAssetId = params.firstFrameFile.assetId || undefined;
  }
  if (params.lastFrameFile instanceof File) {
    try {
      const r = await apiUploadCreationImage({ file: params.lastFrameFile, category: 'last_frame', ...uploadContext });
      lastFrameUrl = r.uploaded_url || r.uploadedUrl || undefined;
      lastFrameAssetId = r.asset_id || undefined;
    } catch {}
  } else if (params.lastFrameFile && params.lastFrameFile.url) {
    // 资产库选择的尾帧：已有 URL，无需上传
    lastFrameUrl = params.lastFrameFile.url;
    lastFrameAssetId = params.lastFrameFile.assetId || undefined;
  }

  // ── 配音生成 ────────────────────────────────────────────────────────────
  if (isDubbing) {
    // 上传参考音频文件
    let referenceAudioUrl;
    const audioFiles = params.files ? (Array.isArray(params.files) ? params.files : [params.files]) : [];
    for (const f of audioFiles) {
      if (f && typeof f === 'object' && !(f instanceof File) && f.url) {
        referenceAudioUrl = f.url;
        break;
      }
      if (!(f instanceof File)) continue;
      try {
        const result = await apiUploadCreationAudio({ file: f, category: 'reference', ...uploadContext });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) referenceAudioUrl = url;
      } catch { /* 单个文件上传失败不阻塞整体 */ }
    }
    const dubbingBody = {
      text: params.prompt || params.text,
      prompt_raw: params.prompt || params.text || undefined,
      model: params.model || undefined,
      speed: params.speed ?? 1.0,
      emotion: params.emotion || undefined,
      voice_id: params.voice_id || undefined,
      reference_audio_url: referenceAudioUrl || undefined,
      session_id: uploadContext.session_id,
      shot_id: uploadContext.shot_id,
      project_id: uploadContext.project_id,
    };
    const TEXT_LENGTH_THRESHOLD = 500;
    const text = params.prompt || params.text || '';
    const isMiniMax = (params.model || '').toLowerCase().includes('minimax');

    if (text.length > TEXT_LENGTH_THRESHOLD) {
      if (!isMiniMax) {
        // 非 MiniMax provider 不支持异步配音，提示用户切换模型或缩短文本
        const err = new Error('当前模型不支持长文本配音，请切换为 MiniMax 模型或将文本缩短至 500 字以内');
        err.code = 'DUBBING_TEXT_TOO_LONG';
        throw err;
      }

      const asyncRes = await authFetch(`${BASE}/api/creation/audios/generate-async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dubbingBody),
      });
      const asyncData = await asyncRes.json();
      const taskId = asyncData.task_id || asyncData.id;
      if (!taskId) throw new Error('No task_id returned');

      const { audios } = await pollTask(
        `${BASE}/api/creation/audios/tasks/${taskId}`,
        (pollData) => {
          const result = pollData.result;
          if (!result) return { audios: [] };
          return {
            audios: [result.audio_url || result.audioUrl],
          };
        },
      );
      return { taskId, audios };
    }

    const genData = await apiGenerateCreationAudio(dubbingBody);
    const taskId = genData.task_id || genData.id;
    if (!taskId) throw new Error('No task_id returned');

    const { audios } = await pollTask(
      `${BASE}/api/creation/audios/tasks/${taskId}`,
      (pollData) => {
        const result = pollData.result;
        if (!result) return { audios: [] };
        const audioUrl = result.audio_url || result.audioUrl || pollData.audio_url || pollData.audioUrl;
        return {
          audios: audioUrl ? [audioUrl] : [],
        };
      },
    );
    return { taskId, audios };
  }

  // ── 图片生成 ────────────────────────────────────────────────────────────
  if (!isVideo) {
    const countNum = parseInt(params.count) || 1;
    const body = {
      prompt: params.prompt,
      model: params.model || undefined,
      size: params.resolution || undefined,
      resolution: params.resolution || undefined,
      aspect_ratio: params.ratio || undefined,
      image_count: countNum,
      count: countNum,
      imageCount: countNum,
      reference_images: refUrls.length > 0 ? refUrls : undefined,
      category: params.category || undefined,
      asset_name: params.asset_name || undefined,
      watermark: params.watermark || undefined,
      save_to_assets: params.save_to_assets ?? true,
      inherit_project_style: params.inherit_project_style ?? false,
      session_id: uploadContext.session_id,
      shot_id: uploadContext.shot_id,
      project_id: uploadContext.project_id,
    };
    const genData = await apiGenerateCreationImages(body);

    // 后端可能返回单个 task_id 或多个 task_ids（count > 1 时）
    const taskIds = Array.isArray(genData.task_ids) && genData.task_ids.length > 0
      ? genData.task_ids
      : [genData.task_id || genData.id].filter(Boolean);
    if (taskIds.length === 0) throw new Error('No task_id returned');

    // 并行轮询所有任务，合并结果
    const pollResults = await Promise.all(
      taskIds.map((tid) =>
        pollTask(
          `${BASE}/api/creation/tasks/${tid}`,
          (pollData) => {
            const imgs = pollData.images || [];
            return {
              images: imgs.map((img) => img.original_url || img.originalUrl || img.thumbnail_url || img.thumbnailUrl),
              cardIds: imgs.map((img) => img.id),
              referenceImages: pollData.reference_images || pollData.referenceImages || [],
            };
          },
        )
      )
    );

    const allImages = pollResults.flatMap((r) => r.images);
    const allCardIds = pollResults.flatMap((r) => r.cardIds);
    // 优先用后端返回的参考图列表，若为空则以本次实际上传/使用的 refUrls 作为兜底
    const referenceImages = (pollResults[0]?.referenceImages ?? []).length > 0
      ? (pollResults[0]?.referenceImages ?? [])
      : refUrls;
    return { taskId: taskIds[0], images: allImages, cardIds: allCardIds, referenceImages };
  }

  // ── 视频生成 ────────────────────────────────────────────────────────────
  // 有参考图/参考视频时强制 generation_mode=full，不让后端自行推断（资产库选图时后端会错误设为 text_to_video）
  const hasRefMedia = refUrls.length > 0 || refAssetIds.length > 0 || uploadedRefVideoUrl || uploadedRefAudioUrl;
  const effectiveGenerationMode = hasRefMedia ? 'full' : (params.generation_mode || undefined);

  // ── @ 数字资产绑定（attachments）────────────────────────────────────────
  // 后端视频生成消费 @ 参考图的真正入口是 attachments（CreationAssetBinding[]），
  // 而非 reference_image_urls（该字段后端不存在）。这里把图片/视频/音频参考统一组装为绑定。
  const attachments = [];
  refUrls.forEach((url, i) => {
    attachments.push({
      asset_id: refAssetIds[i] || undefined,
      asset_type: 'image',
      url: toAbsoluteUrl(url),
      role: 'reference',
      source: 'mention',
    });
  });
  if (uploadedRefVideoUrl) {
    attachments.push({
      asset_type: 'video',
      url: toAbsoluteUrl(uploadedRefVideoUrl),
      role: 'reference',
      source: 'mention',
    });
  }
  if (uploadedRefAudioUrl) {
    attachments.push({
      asset_type: 'audio',
      url: toAbsoluteUrl(uploadedRefAudioUrl),
      role: 'reference',
      source: 'mention',
    });
  }

  const body = {
    prompt: params.prompt,
    model: params.model || 'doubao-seedance-2.0',
    ratio: params.ratio || params.videoRatio || '16:9',
    resolution: params.resolution || params.videoResolution || '720P',
    duration: parseInt(params.videoDuration) || 5,
    reference_mode: params.refMode || undefined,
    generation_mode: effectiveGenerationMode,
    with_audio: params.soundEnabled ?? false,
    // 首尾帧（URL + asset_id 双通道，后端优先看 asset_id）
    first_frame_url: firstFrameUrl || params.firstFrameUrl || undefined,
    last_frame_url: lastFrameUrl || params.lastFrameUrl || undefined,
    first_frame_asset_id: firstFrameAssetId || params.first_frame_asset_id || undefined,
    last_frame_asset_id: lastFrameAssetId || params.last_frame_asset_id || undefined,
    // 参考资源：@ 数字资产绑定通过 attachments 传递（后端真正消费的入口）
    attachments: attachments.length > 0 ? attachments : undefined,
    // asset_id 双通道兜底（后端 reference_image_asset_ids 仍支持）
    reference_image_asset_ids: refAssetIds.length > 0 ? refAssetIds : undefined,
    // 视频/音频参考的独立 URL 字段（兼容后端既有取数口径）
    reference_video_url: uploadedRefVideoUrl ? toAbsoluteUrl(uploadedRefVideoUrl) : (params.reference_video_url ? toAbsoluteUrl(params.reference_video_url) : undefined),
    reference_audio_url: uploadedRefAudioUrl ? toAbsoluteUrl(uploadedRefAudioUrl) : (params.reference_audio_url ? toAbsoluteUrl(params.reference_audio_url) : undefined),
    watermark: params.watermark || undefined,
    session_id: uploadContext.session_id,
    shot_id: uploadContext.shot_id,
    project_id: uploadContext.project_id,
  };
  const genData = await apiGenerateCreationVideo(body);
  const taskId = genData.task_id || genData.id;
  if (!taskId) throw new Error('No task_id returned');

  onTaskCreated?.({ taskId, params });

  const { videos, cardIds, posterUrl } = await pollTask(
    `${BASE}/api/creation/videos/tasks/${taskId}`,
    (pollData) => {
      const result = pollData.result;
      if (!result) return { videos: [], cardIds: [], posterUrl: undefined };
      const videoUrl = result.hlsUrl || result.hls_url
        || result.previewVideoUrl || result.preview_video_url
        || result.video_url || result.videoUrl;
      return {
        videos: [videoUrl].filter(Boolean),
        cardIds: [result.id],
        posterUrl: result.posterUrl || result.poster_url || undefined,
      };
    },
  );
  return { taskId, videos, cardIds, posterUrl, referenceImages: refUrls };
}
