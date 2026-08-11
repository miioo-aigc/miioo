/**
 * @file storyboardTaskAdapter.js
 * @structure-index
 *
 * ─── 任务字段适配 ───────────────────────────────────────────
 *   getStoryboardTaskStatus       兼容 status / raw_status
 *   getStoryboardTaskId           兼容直接响应及多层任务包装
 *   getStoryboardTaskStatusMessage / getStoryboardTaskErrorMessage 兼容任务提示和错误字段
 *   isStoryboardTaskInProgress    判断是否继续轮询
 *   extractStoryboard*Media       兼容原图、缩略图、预览图、海报和下载地址
 *   extractStoryboardVideoUrl     兼容视频结果字段和结果数组
 *   extractStoryboardImageUrl     兼容图片结果字段和结果数组
 *   hasStoryboard*TaskResult      判断任务是否已携带可用媒体结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────
 *   只接收任务响应并返回状态或媒体地址；不调用 API、不操作 React 状态、缓存、Toast 或持久化。
 */

export function getStoryboardTaskStatus(task) {
  return task?.status
    || task?.raw_status
    || task?.rawStatus
    || task?.data?.status
    || task?.data?.raw_status
    || task?.data?.rawStatus
    || '';
}

export function getStoryboardTaskId(task) {
  if (!task || typeof task !== 'object') return null;
  return task.task_id
    || task.taskId
    || task.id
    || task.data?.task_id
    || task.data?.taskId
    || task.data?.id
    || task.data?.task?.task_id
    || task.data?.task?.taskId
    || task.data?.task?.id
    || task.payload?.task_id
    || task.payload?.taskId
    || task.payload?.id
    || task.result?.task_id
    || task.result?.taskId
    || task.result?.id
    || null;
}

export function isStoryboardTaskInProgress(task) {
  const status = String(getStoryboardTaskStatus(task) || '').toLowerCase();
  if ([
    'completed',
    'succeeded',
    'success',
    'done',
    'partial',
    'completed_with_errors',
    'completed_with_failures',
    'failed',
    'error',
    'cancelled',
    'canceled',
  ].includes(status)) return false;

  // 后端任务状态存在扩展值（例如 waiting、submitted、started、generating）。
  // 只要不是明确终态，就继续轮询，避免一次状态字段变更让页面提前结束。
  return Boolean(getStoryboardTaskId(task)) || [
    'pending',
    'queued',
    'created',
    'waiting',
    'waiting_for_worker',
    'submitted',
    'started',
    'running',
    'generating',
    'processing',
    'in_progress',
    'in-progress',
  ].includes(status);
}

export function extractStoryboardVideoUrl(task) {
  if (!task || typeof task !== 'object') return null;

  const payload = task.data && typeof task.data === 'object' ? task.data : task;
  const resultItems = [
    payload.result,
    ...(Array.isArray(payload.results) ? payload.results : []),
    ...(Array.isArray(payload.videos) ? payload.videos : []),
    ...(Array.isArray(payload.generated_videos) ? payload.generated_videos : []),
  ].filter((item) => item && typeof item === 'object');

  const directUrl = payload.video_url || payload.videoUrl || payload.url;
  if (directUrl) return directUrl;
  for (const result of resultItems) {
    const url = result.video_url || result.videoUrl || result.url || result.preview_video_url || result.previewVideoUrl;
    if (url) return url;
  }

  return null;
}

export function extractStoryboardVideoMedia(task) {
  if (!task || typeof task !== 'object') return {};
  const payload = task.data && typeof task.data === 'object' ? task.data : task;
  const result = payload.result && typeof payload.result === 'object'
    ? payload.result
    : (Array.isArray(payload.results) ? payload.results.find(Boolean) : null) ||
      (Array.isArray(payload.videos) ? payload.videos.find(Boolean) : null) ||
      (Array.isArray(payload.generated_videos) ? payload.generated_videos.find(Boolean) : null) ||
      payload;
  return {
    videoUrl: result.video_url || result.videoUrl || result.url || null,
    thumbnailUrl: result.thumbnail_url || result.thumbnailUrl || result.video_thumbnail_url || result.videoThumbnailUrl || null,
    posterUrl: result.poster_url || result.posterUrl || result.video_thumbnail_url || result.videoThumbnailUrl || null,
    previewUrl: result.preview_video_url || result.previewVideoUrl || null,
    downloadUrl: result.download_url || result.downloadUrl || null,
    assetId: result.asset_id || result.assetId || result.video_asset_id || result.videoAssetId || null,
  };
}

function imageResultItems(task) {
  const payload = task?.data && typeof task.data === 'object' ? task.data : task;
  return [
    payload?.result,
    ...(Array.isArray(payload?.results) ? payload.results : []),
    ...(Array.isArray(payload?.images) ? payload.images : []),
    ...(Array.isArray(payload?.generated_images) ? payload.generated_images : []),
  ].filter((item) => item && typeof item === 'object');
}

export function extractStoryboardImageMedia(task) {
  if (!task || typeof task !== 'object') return {};
  const payload = task.data && typeof task.data === 'object' ? task.data : task;
  const result = imageResultItems(task)[0] || payload;
  return {
    imageUrl: result.image_url || result.imageUrl || result.url || result.original_url || result.originalUrl || null,
    thumbnailUrl: result.thumbnail_url || result.thumbnailUrl || null,
    previewUrl: result.preview_url || result.previewUrl || null,
    largeUrl: result.large_url || result.largeUrl || null,
    downloadUrl: result.download_url || result.downloadUrl || null,
    assetId: result.asset_id || result.assetId || null,
  };
}

export function getStoryboardTaskStatusMessage(task) {
  return task?.status_message
    || task?.statusMessage
    || task?.params?.status_message
    || task?.params?.statusMessage
    || task?.data?.status_message
    || task?.data?.statusMessage
    || '';
}

export function getStoryboardTaskErrorMessage(task) {
  const detail = task?.detail;
  const detailMessage = typeof detail === 'string' ? detail : detail?.message || detail?.detail;
  const error = task?.error;
  const errorMessage = typeof error === 'string' ? error : error?.message || error?.detail;
  return detailMessage
    || errorMessage
    || task?.error_msg
    || task?.errorMsg
    || task?.data?.error_msg
    || task?.data?.errorMsg
    || task?.message
    || task?.params?.error
    || getStoryboardTaskStatusMessage(task)
    || '';
}

function firstImageUrl(task) {
  const media = extractStoryboardImageMedia(task);
  return media.imageUrl || media.previewUrl || media.largeUrl || media.thumbnailUrl;
}

/*
 * 兼容后端将结果放在 result/results/images/generated_images，且兼容 data 包装。
 * 具体媒体字段由 extractStoryboard*Media 统一提供，页面只消费语义化结果。
 */
export function extractStoryboardVideoResult(task) {
  return extractStoryboardVideoMedia(task);
}

export function extractStoryboardImageResult(task) {
  return extractStoryboardImageMedia(task);
}

export function extractStoryboardImageUrl(task) {
  return firstImageUrl(task);
}

export function hasStoryboardImageTaskResult(task) {
  return extractStoryboardImageUrl(task) !== null;
}

export function hasStoryboardVideoTaskResult(task) {
  return extractStoryboardVideoUrl(task) !== null;
}
