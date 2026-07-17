/**
 * @file SubjectGenerationResult.js
 * @structure-index
 *
 * ─── 纯数据适配 ─────────────────────────────────────────────────────
 *   extractSubjectImageResult       统一主体生图响应中的任务、图片和图片 ID 字段
 *   getSubjectGenerationErrorMessage 统一主体生图错误消息字段
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收响应或错误对象并返回标准化数据；不引用 React、页面、API、Store 或 Toast
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  抽离主体生图结果标准化与错误消息适配纯函数
 */

function getResultSource(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.result && typeof payload.result === 'object') return payload.result;
  if (payload.data && typeof payload.data === 'object') return payload.data;
  return payload;
}

function firstDefined(source, keys) {
  return keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null) ?? null;
}

/**
 * 将同步接口、任务轮询和详情恢复返回的不同字段名统一为同一结构。
 * 该函数只做字段读取，不消费缓存，也不执行任何状态更新。
 */
export function extractSubjectImageResult(payload) {
  const source = getResultSource(payload);

  return {
    taskId: firstDefined(source, ['_taskId', 'taskId', 'task_id']),
    rawUrl: firstDefined(source, ['image_url', 'imageUrl', 'url']),
    imageId: firstDefined(source, ['image_id', 'imageId', 'id']),
  };
}

/**
 * 读取主体生图接口、任务结果或 Error 对象中的可展示错误消息。
 */
export function getSubjectGenerationErrorMessage(error, fallback = '图片生成失败') {
  if (typeof error === 'string' && error.trim()) return error;

  const source = error && typeof error === 'object' ? error : {};
  const candidates = [
    source.message,
    source.error_msg,
    source.errorMsg,
    source.error,
    source.detail,
    source.error?.message,
  ];

  return candidates.find((message) => typeof message === 'string' && message.trim()) || fallback;
}
