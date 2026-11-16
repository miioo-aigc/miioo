/** 可独立测试的文本任务协议、历史适配与提交恢复。 */
import { normalizeCanvasResultBatch, validateCanvasNodeResults } from './CanvasNodeResults.js';

export const ACTIVE_TEXT_STATES = ['preparing', 'queued', 'running'];
export const TEXT_STATES = [...ACTIVE_TEXT_STATES, 'completed', 'failed', 'cancelled', 'outcome_unknown'];
export const isActiveText = (node) => ACTIVE_TEXT_STATES.includes(node.data?.textSubmission?.status);

export function validateTextResponse(response, submission, nodeId, canvasId) {
  if (!response || !TEXT_STATES.includes(response.status) || response.status === 'preparing'
    || response.client_submission_id !== submission.clientSubmissionId
    || response.node_id !== nodeId || response.canvas_id !== canvasId) throw new Error('文本任务响应身份或状态不匹配');
  return response;
}

export async function readTextHistory(getPage) {
  const items = [], seen = new Set();
  let cursor, baseline;
  do {
    const page = await getPage(cursor);
    if (!Array.isArray(page.items) || !Number.isInteger(page.output_version) || !Number.isInteger(page.revision)) {
      throw new Error('文本历史响应缺少版本或批次');
    }
    baseline ||= page;
    if (page.output_version !== baseline.output_version || page.current_result_id !== baseline.current_result_id) {
      throw new Error('文本历史正在更新，请稍后重试');
    }
    items.push(...page.items);
    cursor = page.next_cursor;
    if (cursor != null && seen.has(String(cursor))) throw new Error('文本历史分页游标重复');
    seen.add(String(cursor));
  } while (cursor != null);
  return { ...baseline, items };
}

export function textHistoryState(page) {
  const batches = [...page.items].sort((a, b) => a.sequence - b.sequence)
    .filter((batch) => batch.results?.length).map((batch) => normalizeCanvasResultBatch({
      id: batch.id, source: batch.source, requestedCount: batch.request_count, results: batch.results,
      submittedAt: Date.parse(batch.submitted_at), completedAt: Date.parse(batch.completed_at),
      taskIds: batch.task_ids, snapshot: batch.input_snapshot,
    }));
  return validateCanvasNodeResults({ version: 1, batches, currentResultId: page.current_result_id,
    selections: page.current_result_id ? [{ resultId: page.current_result_id, reason: 'select' }] : [] });
}

export function applyTextHistory(node, page) {
  const nodeResults = textHistoryState(page);
  const current = nodeResults.batches.flatMap((batch) => batch.results).find((result) => result.id === page.current_result_id);
  return { ...node, data: { ...node.data, nodeResults, content: current?.content ?? '',
    outputVersion: page.output_version } };
}

export function textEditRequest(content, version, ids) {
  return { operation_id: ids.operationId, expected_version: version, batch_id: ids.batchId,
    source: 'edit', status: 'completed', request_count: 1, task_ids: [], input_snapshot: {},
    results: [{ id: ids.resultId, index: 0, type: 'text', assetId: null, content }] };
}

/** 响应丢失先查询，同一个请求体最多重发一次；不生成新身份。 */
export async function recoverTextSubmission({ get, post, body, preparing }) {
  try { return await get(); }
  catch (error) { if (error.status !== 404 || !preparing) throw error; }
  if (!body) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await post(body); }
    catch (error) {
      if (error.status && error.status < 500 || error.status === 503) throw error;
      try { return await get(); }
      catch (queryError) { if (queryError.status !== 404 || attempt === 1) throw queryError; }
    }
  }
}
