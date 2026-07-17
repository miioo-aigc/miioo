/**
 * @file storyboardTaskAdapter.js
 * @structure-index
 *
 * ─── 任务字段适配 ───────────────────────────────────────────
 *   getStoryboardTaskStatus       兼容 status / raw_status
 *   isStoryboardTaskInProgress    判断是否继续轮询
 *   extractStoryboardVideoUrl     兼容视频结果字段和结果数组
 *   extractStoryboardImageUrl     兼容图片结果字段和结果数组
 *   hasStoryboard*TaskResult      判断任务是否已携带可用媒体结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只接收任务响应并返回状态或媒体地址；不调用 API、不操作 React 状态、缓存、Toast 或持久化。
 */

export function getStoryboardTaskStatus(task) {
  return task?.status || task?.raw_status || '';
}

export function isStoryboardTaskInProgress(task) {
  const status = getStoryboardTaskStatus(task);
  return status === 'pending' || status === 'running';
}

export function extractStoryboardVideoUrl(task) {
  if (!task || typeof task !== 'object') return null;

  if (task.result && typeof task.result === 'object') {
    const url = task.result.video_url || task.result.videoUrl;
    if (url) return url;
  }

  if (Array.isArray(task.results)) {
    for (const result of task.results) {
      if (!result) continue;
      const url = result.video_url || result.videoUrl;
      if (url) return url;
    }
  }

  if (Array.isArray(task.videos)) {
    for (const video of task.videos) {
      if (!video) continue;
      const url = video.url || video.video_url || video.videoUrl;
      if (url) return url;
    }
  }

  return null;
}

export function extractStoryboardImageUrl(task) {
  if (!task || typeof task !== 'object') return null;

  if (task.result && typeof task.result === 'object') {
    const url = task.result.image_url
      || task.result.imageUrl
      || task.result.url
      || task.result.original_url
      || task.result.originalUrl;
    if (url) return url;
  }

  if (Array.isArray(task.results)) {
    for (const result of task.results) {
      if (!result) continue;
      const url = result.image_url
        || result.imageUrl
        || result.url
        || result.original_url
        || result.originalUrl;
      if (url) return url;
    }
  }

  if (Array.isArray(task.images)) {
    for (const image of task.images) {
      if (!image) continue;
      const url = image.original_url
        || image.originalUrl
        || image.image_url
        || image.imageUrl
        || image.url
        || image.thumbnail_url
        || image.thumbnailUrl;
      if (url) return url;
    }
  }

  return null;
}

export function hasStoryboardImageTaskResult(task) {
  return extractStoryboardImageUrl(task) !== null;
}

export function hasStoryboardVideoTaskResult(task) {
  return extractStoryboardVideoUrl(task) !== null;
}
