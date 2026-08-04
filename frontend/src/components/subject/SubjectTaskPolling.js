/**
 * @file SubjectTaskPolling.js
 * @structure-index
 *
 * ─── 纯数据适配 ─────────────────────────────────────────────────────
 *   TERMINAL_STATUSES        主体任务终态集合
 *   getSubjectTaskStatus      兼容任务状态字段
 *   isSubjectTaskTerminal     判断任务是否进入终态
 *   getSubjectTaskResults     安全读取任务结果列表
 *   getSubjectTaskResult       按主体 ID 读取任务结果
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收任务响应并返回状态或结果；不调用 API、不操作 React 状态、缓存、Toast 或任务持久化
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  抽离主体任务状态、终态与按主体结果读取适配纯函数
 *   2026-08-04  兼容取消任务终态，避免取消后继续轮询至超时
 */

const TERMINAL_STATUSES = new Set([
  'completed',
  'partial',
  'failed',
  'cancelled',
  'done',
  'success',
  'error',
]);

export function getSubjectTaskStatus(task) {
  const status = task?.status || task?.raw_status || '';
  return String(status).trim().toLowerCase();
}

export function isSubjectTaskTerminal(task) {
  return TERMINAL_STATUSES.has(getSubjectTaskStatus(task));
}

export function getSubjectTaskResults(task) {
  return Array.isArray(task?.results) ? task.results : [];
}

export function getSubjectTaskResult(task, subjectId) {
  return getSubjectTaskResults(task).find(
    (item) => (item?.subject_id || item?.id) === subjectId
  ) || null;
}
