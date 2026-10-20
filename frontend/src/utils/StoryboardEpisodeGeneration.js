import { getStoryboardTaskId, getStoryboardTaskStatus, getStoryboardTaskErrorMessage } from './storyboardTaskAdapter.js';

function unwrapStoryboardTaskResponse(value) {
  let payload = value?.data ?? value?.payload ?? value;
  if (payload?.task && typeof payload.task === 'object') return payload.task;
  if (payload && typeof payload === 'object' && (
    payload.id || payload.task_id || payload.taskId || payload.status || payload.raw_status
  )) return payload;
  if (payload?.result && typeof payload.result === 'object') {
    payload = payload.result;
    if (payload.task && typeof payload.task === 'object') return payload.task;
  }
  return payload;
}

export async function runStoryboardEpisodeGeneration({ submit, persist, poll, readResult, applyResult, remove, isCurrent }) {
  let taskId = null;
  let settled = false;
  try {
    const response = unwrapStoryboardTaskResponse(await submit());
    taskId = Array.isArray(response) ? null : getStoryboardTaskId(response);
    // 已发出的提交不可撤回：即使离页，编号仍应保存在原归属下。
    if (taskId) persist(taskId);
    if (!isCurrent()) return { settled: false };
    const result = taskId ? await poll(taskId, undefined, 1000, isCurrent) : response;
    if (!isCurrent()) return { settled: false };
    const status = String(getStoryboardTaskStatus(result) || '').toLowerCase();
    const partialFailure = ['partial', 'completed_with_errors', 'completed_with_failures'].includes(status)
      && Number(result?.fail_count || result?.failCount || 0) > 0;
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status) || partialFailure) {
      settled = true;
      throw new Error(getStoryboardTaskErrorMessage(result) || '分镜生成失败');
    }
    if (!Array.isArray(result) && !['completed', 'success', 'succeeded', 'done', 'partial'].includes(status)) {
      throw new Error('生成结果尚未确认，请勿重复生成');
    }
    const latest = await readResult(result);
    if (!isCurrent()) return { settled: false };
    applyResult(latest);
    settled = true;
    return { settled };
  } catch (error) {
    error.generationSettled = settled;
    error.generationTaskId = taskId;
    throw error;
  } finally {
    if (taskId && settled && isCurrent()) remove(taskId);
  }
}
