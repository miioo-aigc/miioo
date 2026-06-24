/**
 * 任务轮询 & 结果提取 / Task polling and result extraction utilities.
 * 纯函数，仅依赖 apiGetTask。
 */

import { apiGetTask } from '../api/storyboard';

// 轮询任务直到完成或超时
// isSuccessPayload: 可选谓词，若返回 true 则即使 status 为 running 也停止轮询
async function pollTask(taskId, isSuccessPayload) {
  const MAX_POLLS = 150;
  const INTERVAL = 3000;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, INTERVAL));
    const t = await apiGetTask(taskId);
    // 终态
    if (t.status !== 'pending' && t.status !== 'running') return t;
    // 后端修复后 running 态也可携带 results：有可播放视频就提前返回
    if (typeof isSuccessPayload === 'function' && isSuccessPayload(t)) return t;
  }
  throw new Error('任务超时，请重试');
}

// 从轮询响应中归一化提取视频 URL（兼容 result/ results/ video_url/ videoUrl）
function extractVideoUrlFromTask(t) {
  // 1. task.result（单数，创建模块风格）
  if (t.result && typeof t.result === 'object') {
    const url = t.result.video_url || t.result.videoUrl;
    if (url) return url;
  }
  // 2. task.results（数组）
  if (Array.isArray(t.results)) {
    for (const r of t.results) {
      if (!r) continue;
      const url = r.video_url || r.videoUrl;
      if (url) return url;
    }
  }
  // 3. task.videos
  if (Array.isArray(t.videos)) {
    for (const v of t.videos) {
      if (!v) continue;
      const url = v.url || v.video_url || v.videoUrl;
      if (url) return url;
    }
  }
  return null;
}

// 从轮询响应中归一化提取图片 URL（兼容 result / results / images）
function extractImageUrlFromTask(t) {
  if (t.result && typeof t.result === 'object') {
    const url = t.result.image_url || t.result.imageUrl || t.result.url || t.result.original_url || t.result.originalUrl;
    if (url) return url;
  }
  if (Array.isArray(t.results)) {
    for (const result of t.results) {
      if (!result) continue;
      const url = result.image_url || result.imageUrl || result.url || result.original_url || result.originalUrl;
      if (url) return url;
    }
  }
  if (Array.isArray(t.images)) {
    for (const image of t.images) {
      if (!image) continue;
      const url = image.original_url || image.originalUrl || image.image_url || image.imageUrl || image.url || image.thumbnail_url || image.thumbnailUrl;
      if (url) return url;
    }
  }
  return null;
}

function hasImageTaskResult(t) {
  return extractImageUrlFromTask(t) !== null;
}

// 视频任务终态判定：有可播放视频即视为成功
function hasVideoTaskResult(t) {
  return extractVideoUrlFromTask(t) !== null;
}

export { pollTask, extractVideoUrlFromTask, extractImageUrlFromTask, hasImageTaskResult, hasVideoTaskResult };
