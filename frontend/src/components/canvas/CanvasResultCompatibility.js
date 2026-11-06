/** Compatibility for result data only; does not copy nodes or invent task history. */
import { commitCanvasResultBatch, createCanvasNodeResults, normalizeCanvasResultBatch, validateCanvasNodeResults } from './CanvasNodeResults.js';

/** Explicit IDs make migration repeatable. URL-only legacy media fails visibly. */
export function migrateLegacyCanvasResults(node, { batchId, resultId } = {}) {
  if (!['text', 'image', 'video', 'audio'].includes(node?.type)) throw new Error('旧节点类型不支持结果迁移');
  if (node?.data?.nodeResults !== undefined) {
    const state = cloneCanvasNodeResults(node.data.nodeResults);
    if (state.batches.some((batch) => batch.results.some((result) => result.type !== node.type))) throw new Error('节点类型与结果类型不一致');
    return state;
  }
  const data = node.data || {};
  const state = createCanvasNodeResults();
  if (node.type === 'text' && data.content !== undefined && typeof data.content !== 'string') throw new Error('旧文本正文必须是字符串');
  if (node.type === 'text' ? !data.content?.trim() : !data.asset && !data.assetId) return state;
  const result = node.type === 'text'
    ? { id: resultId, index: 0, type: 'text', content: data.content }
    : { id: resultId, index: 0, type: node.type, assetId: data.asset?.asset_id || data.assetId };
  return commitCanvasResultBatch(state, { id: batchId, source: 'legacy', requestedCount: 1, results: [result] });
}

/** Node-local IDs survive copying; whitelist strips live tasks, URLs and UI state.
 * Historical taskIds and immutable execution snapshots remain as provenance.
 * Copying a whole graph / remapping external references belongs to the caller.
 */
export function cloneCanvasNodeResults(state) {
  validateCanvasNodeResults(state);
  return { version: 1, batches: state.batches.map(normalizeCanvasResultBatch),
    currentResultId: state.currentResultId,
    selections: state.selections.map(({ resultId, reason }) => ({ resultId, reason })) };
}
