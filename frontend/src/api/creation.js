const BASE = import.meta.env.VITE_API_BASE_URL;
const CREATION_DEFAULT_POLL_TIMEOUT_MS = 1800000;
const CREATION_VIDEO_POLL_TIMEOUT_MS = 3600000;
const CREATION_AUDIO_POLL_TIMEOUT_MS = 600000;
const CREATION_POLL_INTERVAL_MS = 3000;
const CREATION_POLL_TRANSIENT_FAILURE_LIMIT = 5;
const CREATION_POLL_TRANSIENT_STATUSES = new Set([502, 503, 504]);

function isLikelyImageMediaUrl(url) {
  return /\.(?:avif|bmp|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(String(url || ''));
}

function getVideoResultUrl(result) {
  const videoUrl = result?.video_url || result?.videoUrl;
  if (videoUrl) return videoUrl;
  const previewUrl = result?.hlsUrl || result?.hls_url
    || result?.previewVideoUrl || result?.preview_video_url;
  return isLikelyImageMediaUrl(previewUrl) ? '' : previewUrl;
}

function createAbortError() {
  const error = new Error('请求已停止');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError();
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function waitForPollInterval(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    let timer;
    const cleanup = () => signal?.removeEventListener('abort', handleAbort);
    const handleAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, CREATION_POLL_INTERVAL_MS);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function createPollResponseError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function recordTransientPollFailure(retryState, error, pollUrl) {
  retryState.consecutiveFailures += 1;
  if (retryState.consecutiveFailures >= CREATION_POLL_TRANSIENT_FAILURE_LIMIT) {
    throw createPollResponseError(
      '任务状态查询暂时不可用，请稍后刷新页面恢复任务',
      error?.status,
    );
  }
  console.warn('[creation-poll] 临时查询失败，继续轮询', {
    pollUrl,
    consecutiveFailures: retryState.consecutiveFailures,
    status: error?.status,
    message: error?.message,
  });
  return null;
}

async function fetchCreationPollData(pollUrl, { signal, retryState }) {
  let pollRes;
  try {
    pollRes = await authFetch(pollUrl, { signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error?.isNetworkError || error instanceof TypeError) {
      return recordTransientPollFailure(retryState, error, pollUrl);
    }
    throw error;
  }

  let rawBody;
  try {
    rawBody = await pollRes.text();
  } catch (error) {
    if (isAbortError(error)) throw error;
    return recordTransientPollFailure(retryState, error, pollUrl);
  }
  if (CREATION_POLL_TRANSIENT_STATUSES.has(pollRes.status)) {
    return recordTransientPollFailure(
      retryState,
      createPollResponseError(`任务状态查询返回 ${pollRes.status}`, pollRes.status),
      pollUrl,
    );
  }
  if (!pollRes.ok) {
    let message = `任务状态查询失败（${pollRes.status}）`;
    if (rawBody) {
      try {
        const errorData = JSON.parse(rawBody);
        message = errorData.detail || errorData.message || errorData.error_msg || message;
      } catch {
        message = rawBody;
      }
    }
    const friendlyMessage = getSeedance20AudioReferenceErrorMessage(message);
    if (friendlyMessage) {
      const error = createPollResponseError(friendlyMessage, pollRes.status);
      error.rawMessage = message;
      throw error;
    }
    throw createPollResponseError(message, pollRes.status);
  }
  if (!rawBody) {
    return recordTransientPollFailure(
      retryState,
      createPollResponseError('任务状态查询返回空响应', pollRes.status),
      pollUrl,
    );
  }

  try {
    const pollData = JSON.parse(rawBody);
    retryState.consecutiveFailures = 0;
    return pollData;
  } catch {
    return recordTransientPollFailure(
      retryState,
      createPollResponseError('任务状态查询返回了无法解析的数据', pollRes.status),
      pollUrl,
    );
  }
}

function getImageUrls(image) {
  const previewUrl = image?.preview_url
    || image?.previewUrl
    || image?.reference_frame_url
    || image?.referenceFrameUrl
    || image?.thumbnail_url
    || image?.thumbnailUrl
    || image?.original_url
    || image?.originalUrl
    || '';
  const downloadUrl = image?.download_url
    || image?.downloadUrl
    || image?.original_url
    || image?.originalUrl
    || previewUrl;
  return { previewUrl, downloadUrl };
}

/**
 * 结构索引（api/creation.js）
 * ─── 音乐生成（自由函数）────────────────────────
 *   [接口] apiGenerateCreationMusic()              L599   POST /api/music/generate （音乐生成/翻唱）
 *   [提取] extractMusicResultUrl()                  L609   从 url/audio_url/result/results[] 提取音乐结果
 *   [轮询] apiPollCreationMusicTask()                L627   GET /api/tasks/{task_id} 最多 600 秒，支持 AbortSignal
 * ─── 视频生成（apiGenerateCreation）────────────────────────
 *   [函数] apiGenerateCreation()                    L881  入口：按 genType 分流 图片/视频/配音/音乐
 *   [上传] 参考文件分类循环                           L933  图片/视频/音频 → refUrls/refAssetIds/refVideo/refAudio
 *                                                        （图片 asset_id 兜底：assetId || backendId || asset_id）
 *   [上传] 首/尾帧上传                               L1006  仅视频首尾帧模式使用
 *   [分支] 配音同步/异步生成与任务轮询                L1037  短文本直取音频，长文本轮询
 *                                                        普通/高级模式统一透传 voice_setting
 *                                                        配音任务轮询最多 600 秒，可通过 AbortSignal 停止
 *   [分支] 音乐生成与任务轮询                        L1163  上传参考音频 → POST /api/music/generate → 轮询任务
 *   [分支] 图片生成（多张并行）                      L1220  count>1 可返回多 task_ids 并行轮询
 *   [分支] 视频生成                                  L1286  generation_mode / reference_mode / attachments
 *   [校验] 视频能力与音频门禁                         L935  上传前校验 generation_mode、reference_mode 与能力映射
 *   [组装] @ 数字资产绑定 attachments                L1292  CreationAssetBinding[]，source:'mention'
 *   [组装] 视频生成请求体 body                       L1322  generation_mode / reference_mode / attachments / reference_image_asset_ids / first_frame_url
 *   [日志] [video-generate] 调试日志                 L1355  打印实际发出的 generation_mode / reference_mode / refAssetIds / attachments
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *  2026-08-28  视频新请求不再发送已下线的 multi_shot 参数；参考模式继续由后端映射结果决定
 *   2026-08-12  新增音乐生成支持：POST /api/music/generate、通用任务中心 GET /api/tasks/{task_id} 轮询（最多 600 秒），
 *               音乐分支与图片/视频/配音完全隔离，参考音频上传不阻塞整体生成
 *   2026-08-20  视频 generation_mode 改由输入层统一能力路由确定；API 仅校验能力并保留厂商字段适配。
 *   2026-08-20  视频请求改为读取后端 generation_reference_mode_map，分别发送 generation_mode 与 reference_mode。
 *   2026-08-20  视频任务轮询容忍连续 5 次 502/503/504、网络异常、空响应或无效 JSON，正常响应后重置计数。
 *   2026-08-26  视频创作任务轮询超时由 1800 秒延长至 3600 秒，图片和配音超时保持不变。
 *   2026-08-07  修复同步配音将音频记录 id 误当异步任务 id，避免错误请求配音任务轮询接口
 *   2026-08-07  配音轮询超时收紧为 600 秒，并支持 AbortSignal 中断上传、生成请求和轮询
 *   2026-08-07  配音生成支持再次点击发送按钮停止前端请求和轮询；后端任务取消能力仍由后端接口决定
 *   2026-08-21  配音同步/异步请求透传高级参数，并识别 speech-* MiniMax 长文本模型
 *   2026-08-21  普通配音模式将 speed / pitch / volume 归一到 voice_setting.speed / pitch / vol
 */

function isMiniMaxSpeechModel(model) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  return normalizedModel.includes('minimax') || normalizedModel.startsWith('speech-');
}

function normalizeDubbingVoiceSetting(params) {
  const input = params.voice_setting || {};
  return {
    ...input,
    voice_id: input.voice_id ?? params.voice_id ?? params.voiceId ?? undefined,
    speed: input.speed ?? params.speed ?? 1.0,
    vol: input.vol ?? params.volume ?? params.vol ?? 1.0,
    pitch: input.pitch ?? params.pitch ?? 0,
  };
}

// ── 通用任务轮询（供刷新后恢复使用，支持图片/视频/音频）───────────────────

export async function apiPollCreationTask(type, taskId, timeoutMs, { signal } = {}) {
  const start = Date.now();
  const retryState = { consecutiveFailures: 0 };
  const effectiveTimeoutMs = timeoutMs ?? (type === 'audio'
    ? CREATION_AUDIO_POLL_TIMEOUT_MS
    : type === 'video'
      ? CREATION_VIDEO_POLL_TIMEOUT_MS
      : CREATION_DEFAULT_POLL_TIMEOUT_MS);
  const pollUrl = type === 'image'
    ? `${BASE}/api/creation/tasks/${taskId}`
    : type === 'audio'
      ? `${BASE}/api/creation/audios/tasks/${taskId}`
      : `${BASE}/api/creation/videos/tasks/${taskId}`;

  while (Date.now() - start < effectiveTimeoutMs) {
    await waitForPollInterval(signal);
    if (Date.now() - start >= effectiveTimeoutMs) break;
    throwIfAborted(signal);
    const pollData = await fetchCreationPollData(pollUrl, { signal, retryState });
    if (!pollData) continue;
    const status = pollData.status;

    if (status === 'done' || status === 'completed' || status === 'success' || status === 'partial') {
      if (status !== 'partial' && pollData.partial === true) continue;

      if (type === 'image') {
        const imgs = pollData.images || [];
        const imageUrls = imgs.map(getImageUrls);
        return {
          images: imageUrls.map(({ previewUrl }) => previewUrl),
          imageDownloadUrls: imageUrls.map(({ downloadUrl }) => downloadUrl),
          cardIds: imgs.map((img) => img.id),
          referenceImages: pollData.reference_images || pollData.referenceImages || [],
        };
      } else if (type === 'audio') {
        const result = pollData.result;
        if (!result) return { audios: [] };
        const audioUrl = result.audio_url || result.audioUrl || pollData.audio_url || pollData.audioUrl;
        return {
          audios: audioUrl ? [audioUrl] : [],
          audioIds: [result.id || result.audio_id || result.audioId || pollData.id || pollData.audio_id].filter(Boolean),
        };
      } else {
        const result = pollData.result;
        if (!result) continue;
        const videoUrl = getVideoResultUrl(result);
        if (!videoUrl) continue;
        return {
          videos: [videoUrl].filter(Boolean),
          cardIds: [result.id].filter(Boolean),
          posterUrl: result.posterUrl || result.poster_url
            || result.thumbnailUrl || result.thumbnail_url || undefined,
        };
      }
    }

    if (status === 'failed' || status === 'error') {
      const rawMsg = pollData.error_msg || pollData.errorMsg || '';
      let userMessage = getSeedance20AudioReferenceErrorMessage(rawMsg);
      if (userMessage) {
        const err = new Error(userMessage);
        err.rawMessage = rawMsg;
        throw err;
      }
      if (rawMsg.includes('copyright')) {
        userMessage = '生成内容可能涉及版权限制，请修改素材或创作描述后重试';
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
  throw new Error(type === 'audio' ? '配音生成超过600秒，已停止轮询' : 'Generation timeout');
}


import { authFetch } from './request.js';
import { toAbsoluteUrl } from '../utils/imageUrl.js';
import { captureVideoLastFrame } from '../utils/videoUtils';
import { assertVideoRequestCapabilities, getSeedance20AudioReferenceErrorMessage } from '../utils/videoModelCapabilities';

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
  if (!res.ok) {
    const error = new Error(`创作会话不存在（HTTP ${res.status}）`);
    error.status = res.status;
    throw error;
  }
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

export async function apiCreateShot(sessionId, data, { signal } = {}) {
  const res = await authFetch(`${BASE}/api/creation/sessions/${sessionId}/shots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
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

async function parseCreationDeleteResponse(res, action) {
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = payload?.detail || payload?.message || '';
      if (typeof detail === 'object') detail = JSON.stringify(detail);
    } catch {
      // 非 JSON 错误响应仍按 HTTP 状态抛出，交给页面统一提示。
    }
    throw new Error(detail || `${action}失败（${res.status}）`);
  }
  return res.json();
}

async function parseCreationDownloadResponse(res, action) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let detail = '';
    try {
      const payload = contentType.includes('application/json')
        ? await res.json()
        : await res.text();
      detail = typeof payload === 'object'
        ? (payload?.detail || payload?.message || JSON.stringify(payload))
        : payload;
    } catch {
      // 无法解析错误响应时仍保留 HTTP 状态，避免把错误内容保存为媒体文件。
    }
    throw new Error(detail || `${action}失败（${res.status}）`);
  }

  if (contentType.includes('application/json') || contentType.startsWith('text/')) {
    throw new Error(`${action}失败：服务端未返回媒体文件`);
  }

  const blob = await res.blob();
  if (!blob.size || blob.type.includes('application/json') || blob.type.startsWith('text/')) {
    throw new Error(`${action}失败：服务端未返回有效媒体文件`);
  }
  return blob;
}

export async function apiDeleteCreationImage(imageId) {
  const res = await authFetch(`${BASE}/api/creation/images/${imageId}`, { method: 'DELETE' });
  return parseCreationDeleteResponse(res, '删除创作图片');
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
  return parseCreationDeleteResponse(res, '批量删除创作图片');
}

export async function apiBatchDownloadImages(ids) {
  const res = await authFetch(`${BASE}/api/creation/images/batch-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return parseCreationDownloadResponse(res, '批量下载创作图片');
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
  return parseCreationDownloadResponse(res, '下载创作图片');
}

// ── 创作视频 ──────────────────────────────────────────────────────────────────

export async function apiListCreationVideos({ page, page_size, exclude_hidden } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.append('page', page);
  if (page_size !== undefined) params.append('page_size', page_size);
  if (exclude_hidden !== undefined) params.append('exclude_hidden', exclude_hidden);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/videos?${query}` : `${BASE}/api/creation/videos`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  const data = await res.json();
  return data;
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
  return parseCreationDeleteResponse(res, '删除创作视频');
}


export async function apiGetCreationVideo(videoId) {
  const res = await authFetch(`${BASE}/api/creation/videos/${videoId}`);
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
  return parseCreationDeleteResponse(res, '批量删除创作视频');
}

export async function apiBatchDownloadVideos(ids) {
  const res = await authFetch(`${BASE}/api/creation/videos/batch-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, asset_ids: ids }),
  });
  return parseCreationDownloadResponse(res, '批量下载创作视频');
}

export async function apiDownloadCreationVideo(videoId) {
  const res = await authFetch(`${BASE}/api/creation/videos/${videoId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return parseCreationDownloadResponse(res, '下载创作视频');
}

// ── 创作音频 ──────────────────────────────────────────────────────────────────

export async function apiGenerateCreationAudio(data, { signal } = {}) {
  const res = await authFetch(`${BASE}/api/creation/audios/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  return res.json();
}

// ── 音乐生成（POST /api/music/generate，支持 music-2.6 文本作曲与 music-cover 翻唱）──────
export async function apiGenerateCreationMusic(data, { signal } = {}) {
  const res = await authFetch(`${BASE}/api/music/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  return res.json();
}

function extractMusicResultUrl(data) {
  if (typeof data === 'string') return data;
  const direct = data?.url || data?.audio_url || data?.audioUrl
    || data?.result?.url || data?.result?.audio_url || data?.result?.audioUrl || '';
  if (direct) return direct;
  const results = data?.results;
  if (Array.isArray(results)) {
    for (const r of results) {
      const url = r?.url || r?.audio_url || r?.audioUrl || r?.file_url || r?.fileUrl
        || r?.preview_url || r?.previewUrl || r?.resource_url || r?.resourceUrl || '';
      if (url) return url;
    }
  }
  return '';
}

// 音乐任务走通用任务中心（GET /api/tasks/{task_id}，GenTaskResponse），
// 轮询最多 600 秒，可通过 AbortSignal 停止。
export async function apiPollCreationMusicTask(taskId, timeoutMs = CREATION_AUDIO_POLL_TIMEOUT_MS, { signal } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await waitForPollInterval(signal);
    if (Date.now() - start >= timeoutMs) break;
    throwIfAborted(signal);
    const pollRes = await authFetch(`${BASE}/api/tasks/${taskId}`, { signal });
    const pollData = await pollRes.json();
    const status = pollData.status;
    if (status === 'done' || status === 'completed' || status === 'success' || status === 'succeeded' || status === 'partial') {
      const audioUrl = extractMusicResultUrl(pollData);
      return { audios: audioUrl ? [audioUrl] : [], audioIds: [] };
    }
    if (status === 'failed' || status === 'error' || status === 'cancelled' || status === 'canceled') {
      const rawMsg = pollData.error_msg || pollData.errorMsg || pollData.message || '';
      throw new Error(rawMsg || '音乐生成失败');
    }
  }
  throw new Error('音乐生成超过600秒，已停止轮询');
}

export async function apiGenerateShotAudio(shotId, data) {
  const res = await authFetch(`${BASE}/api/creation/shots/${shotId}/generate-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiListCreationAudios({ page, page_size, is_favorite, search, exclude_hidden } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.append('page', page);
  if (page_size !== undefined) params.append('page_size', page_size);
  if (is_favorite !== undefined) params.append('is_favorite', is_favorite);
  if (search) params.append('search', search);
  if (exclude_hidden !== undefined) params.append('exclude_hidden', exclude_hidden);
  const query = params.toString();
  const url = query ? `${BASE}/api/creation/audios?${query}` : `${BASE}/api/creation/audios`;
  const res = await authFetch(url, { headers: { 'Content-Type': 'application/json' } });
  return res.json();
}

// ── 清空创作历史（后端持久隐藏，按 tab）────────────────────────────────────────
// 标记当前 tab 的全部创作历史为「已隐藏」（仅影响创作页展示，不删除创作资产），
// 创作页后续以 exclude_hidden=true 读取，资产库仍按 exclude_hidden=false 看到全部。
export async function apiHideCreationHistory(tab) {
  const res = await authFetch(`${BASE}/api/creation/history/hide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab }),
  });
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
  return parseCreationDownloadResponse(res, '批量下载创作音频');
}

export async function apiDownloadCreationAudio(audioId) {
  const res = await authFetch(`${BASE}/api/creation/audios/${audioId}/download`, {
    headers: { 'Content-Type': 'application/json' },
  });
  return parseCreationDownloadResponse(res, '下载创作音频');
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
  const safeBase = Array.from(base, (char) => char.codePointAt(0) < 128 ? char : '_').join('') || 'upload';
  return safeBase + ext;
}

export async function apiUploadCreationImage({ file, category, asset_name, session_id, shot_id, project_id, signal }) {
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
    signal,
  });
  return res.json();
}

export async function apiUploadCreationVideo({ file, category, asset_name, session_id, shot_id, project_id, signal }) {
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
    signal,
  });
  return res.json();
}

export async function apiUploadCreationAudio({ file, category, asset_name, session_id, shot_id, project_id, signal }) {
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
    signal,
  });
  return res.json();
}

// ── 前端抽取视频尾帧（<video> + <canvas> 方案）─────────────────────────────


export async function apiGetVideoLastFrame(videoUrl) {
  if (!videoUrl) {
    console.warn('[api] apiGetVideoLastFrame: 无 videoUrl');
    return { lastFrameUrl: null, blob: null };
  }
  try {
    const { url, blob } = await captureVideoLastFrame(videoUrl);
    return { lastFrameUrl: url, blob };
  } catch (err) {
    console.error('[api] apiGetVideoLastFrame: 前端抽帧失败', err);
    return { lastFrameUrl: null, blob: null };
  }
}

// ── 视频任务独立轮询（供刷新后恢复使用）──────────────────────────────────────

export async function apiPollVideoTask(taskId, timeoutMs = CREATION_VIDEO_POLL_TIMEOUT_MS) {
  const start = Date.now();
  const retryState = { consecutiveFailures: 0 };
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollUrl = `${BASE}/api/creation/videos/tasks/${taskId}`;
    const pollData = await fetchCreationPollData(pollUrl, { retryState });
    if (!pollData) continue;
    const status = pollData.status;
    if (status === 'done' || status === 'completed' || status === 'success' || status === 'partial') {
      const result = pollData.result;
      if (!result) continue;
      const videoUrl = getVideoResultUrl(result);
      if (!videoUrl) continue;
      return {
        videos: [videoUrl].filter(Boolean),
        cardIds: [result.id].filter(Boolean),
        posterUrl: result.posterUrl || result.poster_url
          || result.thumbnailUrl || result.thumbnail_url || undefined,
      };
    }
    if (status === 'failed' || status === 'error') {
      const rawMsg = pollData.error_msg || pollData.errorMsg || '';
      let userMessage = getSeedance20AudioReferenceErrorMessage(rawMsg);
      if (userMessage) {
        const err = new Error(userMessage);
        err.rawMessage = rawMsg;
        throw err;
      }
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

export async function apiGenerateCreation(params, { onTaskCreated, signal } = {}) {
  const isDubbing = params.genType === 'dubbing';
  const isVideo = params.genType === 'video';
  const isMusic = params.genType === 'music';

  // ── 内部：轮询任务 ──────────────────────────────────────────────────────
  async function pollTask(
    pollUrl,
    extractFn,
    timeoutMs = isDubbing
      ? CREATION_AUDIO_POLL_TIMEOUT_MS
      : isVideo
        ? CREATION_VIDEO_POLL_TIMEOUT_MS
        : CREATION_DEFAULT_POLL_TIMEOUT_MS,
  ) {
    const start = Date.now();
    const retryState = { consecutiveFailures: 0 };
    while (Date.now() - start < timeoutMs) {
      await waitForPollInterval(signal);
      if (Date.now() - start >= timeoutMs) break;
      throwIfAborted(signal);
      const pollData = await fetchCreationPollData(pollUrl, { signal, retryState });
      if (!pollData) continue;
      const status = pollData.status;
      if (status === 'done' || status === 'completed' || status === 'success' || status === 'partial') {
        // partial=true 字段表示部分图片完成，继续轮询直到全部完成（针对图片多张生成）
        if (status !== 'partial' && pollData.partial === true) continue;
        return extractFn(pollData);
      }
      if (status === 'failed' || status === 'error') {
        const rawMsg = pollData.error_msg || pollData.errorMsg || '';
        let userMessage = getSeedance20AudioReferenceErrorMessage(rawMsg);
        if (userMessage) {
          const err = new Error(userMessage);
          err.rawMessage = rawMsg;
          throw err;
        }
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
    throw new Error(isDubbing ? '配音生成超过600秒，已停止轮询' : 'Generation timeout');
  }

  throwIfAborted(signal);

  // ── 上传参考文件，拿到 URL / asset_id ──────────────────────────────────
  const uploadContext = {
    session_id: params.session_id || undefined,
    shot_id: params.shot_id || undefined,
    project_id: params.project_id || undefined,
  };

  // 上传参考文件（按媒体类型分类：图片 / 视频 / 音频）
  const files = params.files ? (Array.isArray(params.files) ? params.files : [params.files]) : [];
  if (isVideo) {
    const hasAudioFile = files.some((file) => {
      const mime = String(file?.type || '').toLowerCase();
      const name = String(file?.name || file?.url || '').split('?')[0].toLowerCase();
      return mime.startsWith('audio/') || /\.(mp3|wav|aac|ogg|flac|m4a|wma)$/.test(name);
    });
    assertVideoRequestCapabilities({
      generationMode: params.generation_mode,
      referenceMode: params.reference_mode,
      capabilities: params.videoCapabilities || {},
      supportedGenerationModes: params.supportedGenerationModes || [],
      isSeedance: Boolean(params.isSeedance),
      hasAudio: hasAudioFile || Boolean(params.reference_audio_url),
    });
  }
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
        // 兜底取真实资产 UUID：assetId（AssetPicker 已归一化）/ backendId / asset_id 任一命中即可，
        // 确保不同来源（项目/全局/创作资产、直接上传）的参考图都能正确绑定到后端
        const aid = f.assetId || f.backendId || f.asset_id;
        if (aid) refAssetIds.push(aid);
      }
      continue;
    }
    if (!(f instanceof File)) continue;
    const mime = f.type.toLowerCase();
    const isVid = mime.startsWith('video/');
    const isAud = mime.startsWith('audio/');
    try {
      if (isVid) {
        const result = await apiUploadCreationVideo({ file: f, category: 'reference', ...uploadContext, signal });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) uploadedRefVideoUrl = url;
      } else if (isAud) {
        const result = await apiUploadCreationAudio({ file: f, category: 'reference', ...uploadContext, signal });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) uploadedRefAudioUrl = url;
      } else {
        // 图片
        const result = await apiUploadCreationImage({ file: f, category: 'reference', ...uploadContext, signal });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) refUrls.push(url);
        // 兜底取 asset_id：优先顶层（CreationImageUploadResponse.asset_id），再兜底 image.asset_id
        const assetId = result?.asset_id || result?.image?.asset_id;
        if (assetId) refAssetIds.push(assetId);
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      /* 单个文件上传失败不阻塞整体 */
    }
  }

  // 上传首帧 / 尾帧（图片），用于视频生成
  let firstFrameUrl, lastFrameUrl, firstFrameAssetId, lastFrameAssetId;
  if (params.firstFrameFile instanceof File) {
    try {
      const r = await apiUploadCreationImage({ file: params.firstFrameFile, category: 'reference', ...uploadContext, signal });
      firstFrameUrl = r.uploaded_url || r.uploadedUrl || undefined;
      firstFrameAssetId = r.asset_id || undefined;
    } catch (error) {
      if (isAbortError(error)) throw error;
      /* 单个首帧上传失败时保留后续生成流程 */
    }
  } else if (params.firstFrameFile && params.firstFrameFile.url) {
    // 资产库选择的首帧：已有 URL，无需上传
    firstFrameUrl = params.firstFrameFile.url;
    firstFrameAssetId = params.firstFrameFile.assetId || undefined;
  }
  if (params.lastFrameFile instanceof File) {
    try {
      const r = await apiUploadCreationImage({ file: params.lastFrameFile, category: 'reference', ...uploadContext, signal });
      lastFrameUrl = r.uploaded_url || r.uploadedUrl || undefined;
      lastFrameAssetId = r.asset_id || undefined;
    } catch (error) {
      if (isAbortError(error)) throw error;
      /* 单个尾帧上传失败时保留后续生成流程 */
    }
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
        const result = await apiUploadCreationAudio({ file: f, category: 'reference', ...uploadContext, signal });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) referenceAudioUrl = url;
      } catch (error) {
        if (isAbortError(error)) throw error;
        /* 单个文件上传失败不阻塞整体 */
      }
    }
    const dubbingBody = {
      text: params.prompt || params.text,
      prompt_raw: params.prompt || params.text || undefined,
      model: params.model || undefined,
      speed: params.speed ?? 1.0,
      emotion: params.emotion || undefined,
      voice_id: params.voice_id || params.voiceId || undefined,
      advanced_mode_enabled: params.advanced_mode_enabled
        ?? params.advancedEnabled
        ?? params.advanced_enabled
        ?? false,
      reference_audio_url: referenceAudioUrl || undefined,
      voice_setting: normalizeDubbingVoiceSetting(params),
      voice_modify: params.voice_modify || undefined,
      audio_setting: params.audio_setting || undefined,
      pronunciation_dict: params.pronunciation_dict || undefined,
      timbre_weights: params.timbre_weights || undefined,
      language_boost: params.language_boost || undefined,
      subtitle_enable: params.subtitle_enable,
      subtitle_type: params.subtitle_type || undefined,
      output_format: params.output_format || undefined,
      aigc_watermark: params.aigc_watermark,
      stream: params.stream,
      stream_options: params.stream_options || undefined,
      session_id: uploadContext.session_id,
      shot_id: uploadContext.shot_id,
      project_id: uploadContext.project_id,
    };
    const TEXT_LENGTH_THRESHOLD = 500;
    const text = params.prompt || params.text || '';
    const isMiniMax = isMiniMaxSpeechModel(params.model);

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
        signal,
      });
      const asyncData = await asyncRes.json();
      const taskId = asyncData.task_id || asyncData.taskId || asyncData.id;
      if (!taskId) throw new Error('No task_id returned');

      onTaskCreated?.({ taskId, params });

      const { audios, audioIds } = await pollTask(
        `${BASE}/api/creation/audios/tasks/${taskId}`,
        (pollData) => {
          const result = pollData.result;
          if (!result) return { audios: [] };
          const audioUrl = result.audio_url || result.audioUrl || pollData.audio_url || pollData.audioUrl;
          return {
            audios: audioUrl ? [audioUrl] : [],
            audioIds: [result.id || result.audio_id || result.audioId || pollData.id || pollData.audio_id].filter(Boolean),
          };
        },
      );
      return { taskId, audios, audioIds };
    }

    const genData = await apiGenerateCreationAudio(dubbingBody, { signal });
    const audioUrl = typeof genData === 'string'
      ? genData
      : genData?.audio_url
        || genData?.audioUrl
        || genData?.preview_url
        || genData?.previewUrl
        || genData?.download_url
        || genData?.downloadUrl
        || genData?.result?.audio_url
        || genData?.result?.audioUrl;
    if (audioUrl) return {
      audios: [audioUrl],
      audioIds: [
        genData?.id,
        genData?.audio_id,
        genData?.audioId,
        genData?.result?.id,
        genData?.result?.audio_id,
        genData?.result?.audioId,
      ].filter(Boolean),
    };

    const taskId = genData?.task_id || genData?.taskId;
    if (!taskId) throw new Error('No task_id returned');

    onTaskCreated?.({ taskId, params });

    const { audios, audioIds } = await pollTask(
      `${BASE}/api/creation/audios/tasks/${taskId}`,
      (pollData) => {
        const result = pollData.result;
        if (!result) return { audios: [] };
        const audioUrl = result.audio_url || result.audioUrl || pollData.audio_url || pollData.audioUrl;
        return {
          audios: audioUrl ? [audioUrl] : [],
          audioIds: [result.id || result.audio_id || result.audioId || pollData.id || pollData.audio_id].filter(Boolean),
        };
      },
    );
    return { taskId, audios, audioIds };
  }

  // ── 音乐生成 ────────────────────────────────────────────────────────────
  if (isMusic) {
    // 上传参考音频（music-cover 翻唱参考，单个文件上传失败不阻塞整体）
    let referenceAudioUrl;
    const audioFiles = params.files ? (Array.isArray(params.files) ? params.files : [params.files]) : [];
    for (const f of audioFiles) {
      if (f && typeof f === 'object' && !(f instanceof File) && f.url) {
        referenceAudioUrl = f.url;
        break;
      }
      if (!(f instanceof File)) continue;
      try {
        const result = await apiUploadCreationAudio({ file: f, category: 'reference', ...uploadContext, signal });
        const url = result.uploaded_url || result.uploadedUrl || '';
        if (url) referenceAudioUrl = url;
      } catch (error) {
        if (isAbortError(error)) throw error;
        /* 单个文件上传失败不阻塞整体 */
      }
    }

    const musicBody = {
      model: params.model || undefined,
      prompt: params.prompt || params.text || undefined,
      output_format: 'url',
      audio_url: referenceAudioUrl || undefined,
    };
    const genData = await apiGenerateCreationMusic(musicBody, { signal });
    const audioUrl = typeof genData === 'string'
      ? genData
      : genData?.url
        || genData?.audio_url
        || genData?.audioUrl
        || genData?.result?.url
        || genData?.result?.audio_url
        || genData?.result?.audioUrl;
    if (audioUrl) return {
      audios: [audioUrl],
      audioIds: [
        genData?.id,
        genData?.audio_id,
        genData?.audioId,
        genData?.result?.id,
        genData?.result?.audio_id,
        genData?.result?.audioId,
      ].filter(Boolean),
    };

    const taskId = genData?.task_id || genData?.taskId;
    if (!taskId) throw new Error('No task_id returned');

    onTaskCreated?.({ taskId, params });

    const musicResult = await apiPollCreationMusicTask(taskId, undefined, { signal });
    return { taskId, audios: musicResult.audios, audioIds: musicResult.audioIds };
  }

  // ── 图片生成 ────────────────────────────────────────────────────────────
  if (!isVideo && !isMusic) {
    const countNum = parseInt(params.count) || 1;
    const body = {
      prompt: params.prompt,
      model: params.model || undefined,
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

    onTaskCreated?.({ taskId: taskIds[0], params });

    // 并行轮询所有任务，合并结果
    const pollResults = await Promise.all(
      taskIds.map((tid) =>
        pollTask(
          `${BASE}/api/creation/tasks/${tid}`,
          (pollData) => {
            const imgs = pollData.images || [];
            const imageUrls = imgs.map(getImageUrls);
            return {
              images: imageUrls.map(({ previewUrl }) => previewUrl),
              imageDownloadUrls: imageUrls.map(({ downloadUrl }) => downloadUrl),
              cardIds: imgs.map((img) => img.id),
              referenceImages: pollData.reference_images || pollData.referenceImages || [],
            };
          },
        )
      )
    );

    const allImages = pollResults.flatMap((r) => r.images);
    const allImageDownloadUrls = pollResults.flatMap((r) => r.imageDownloadUrls || []);
    const allCardIds = pollResults.flatMap((r) => r.cardIds);
    // 优先用后端返回的参考图列表，若为空则以本次实际上传/使用的 refUrls 作为兜底
    const referenceImages = (pollResults[0]?.referenceImages ?? []).length > 0
      ? (pollResults[0]?.referenceImages ?? [])
      : refUrls;
    return {
      taskId: taskIds[0],
      images: allImages,
      imageDownloadUrls: allImageDownloadUrls,
      cardIds: allCardIds,
      referenceImages,
    };
  }

  // ── 视频生成 ────────────────────────────────────────────────────────────
  const liveMaterialParam = params.liveMaterialParam || null;
  const hasRefMedia = refUrls.length > 0 || refAssetIds.length > 0 || uploadedRefVideoUrl || uploadedRefAudioUrl || (liveMaterialParam && liveMaterialParam.length > 0);
  const effectiveGenerationMode = params.generation_mode;
  const effectiveReferenceMode = params.reference_mode;

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
    generation_mode: effectiveGenerationMode,
    reference_mode: effectiveReferenceMode,
    // 厂商适配只补字段形态，不重新决定 generation_mode。
    with_audio: params.soundEnabled ?? false,
    // 真人素材通过 provider_params.live_material 传递（后端 _resolve_creation_live_material_inputs 消费）
    subjects: undefined,
    provider_params: liveMaterialParam && liveMaterialParam.length > 0
      ? { live_material: liveMaterialParam[0] }
      : undefined,
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
  console.log('[video-generate]', { model: params.model, generation_mode: body.generation_mode, reference_mode: body.reference_mode, refUrls, refAssetIds, attachments, firstFrameUrl, uploadedRefVideoUrl, hasRefMedia });
  const genData = await apiGenerateCreationVideo(body);
  const taskId = genData.task_id || genData.id;
  if (!taskId) throw new Error('No task_id returned');

  onTaskCreated?.({ taskId, params });

  const { videos, cardIds, posterUrl, referenceModeLabel } = await pollTask(
    `${BASE}/api/creation/videos/tasks/${taskId}`,
    (pollData) => {
      const result = pollData.result;
      if (!result) return { videos: [], cardIds: [], posterUrl: undefined };
      const videoUrl = getVideoResultUrl(result);
      return {
        videos: [videoUrl].filter(Boolean),
        cardIds: [result.id],
        posterUrl: result.posterUrl || result.poster_url
          || result.thumbnailUrl || result.thumbnail_url || undefined,
        referenceModeLabel: result.referenceModeLabel || result.reference_mode_label || undefined,
      };
    },
  );
  return {
    taskId, videos, cardIds, posterUrl,
    referenceImages: refUrls,
    referenceVideos: uploadedRefVideoUrl ? [uploadedRefVideoUrl] : [],
    referenceAudios: uploadedRefAudioUrl ? [uploadedRefAudioUrl] : [],
    refMode: params.refMode || undefined,
    referenceModeLabel,
    firstFrameUrl: firstFrameUrl || undefined,
    lastFrameUrl: lastFrameUrl || undefined,
  };
}
