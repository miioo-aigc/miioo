import { migrateLegacyCanvasResults } from './CanvasResultCompatibility.js';
import { commitCanvasResultBatch, getCanvasResultAudioTranscript, normalizeCanvasResultBatch, projectCanvasCurrentResult, selectCanvasNodeResult } from './CanvasNodeResults.js';

export function commitCanvasNodeOutput(node, batch, assetViewsByAssetId = {}) {
  const normalized = normalizeCanvasResultBatch(batch);
  if (normalized.results.some((result) => result.type !== node.type)) {
    throw new Error('节点类型与结果类型不一致');
  }
  const state = migrateLegacyCanvasResults(node, { batchId: `legacy-${node.id}`, resultId: `legacy-result-${node.id}` });
  const nodeResults = commitCanvasResultBatch(state, normalized);
  if (nodeResults === state) return node;
  const views = { ...(node.data.asset?.asset_id ? { [node.data.asset.asset_id]: node.data.asset } : {}),
    ...node.data.resultAssetViews, ...assetViewsByAssetId };
  return projectNode(node, nodeResults, views);
}

function projectNode(node, nodeResults, views) {
  const projection = projectCanvasCurrentResult(nodeResults);
  const asset = projection.asset ? { ...views[projection.asset.asset_id], ...projection.asset } : null;
  return { ...node, data: { ...node.data, nodeResults, resultAssetViews: views,
    content: projection.content, asset,
    ...(node.type === 'audio' ? { transcript: getCanvasResultAudioTranscript(nodeResults, asset) } : {}),
    persistenceState: 'draft' } };
}

export function selectCanvasNodeOutput(node, resultId) {
  if (node.data.generating || node.data.generationPending || node.data.editing
    || node.data.submissionLocked || node.data.upstreamProtected || node.data.outputLocked
    || node.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading'
    || node.data.asset?.uploadStatus === 'uploading') {
    throw new Error('当前节点结果受到任务保护，请稍后再试');
  }
  const nodeResults = selectCanvasNodeResult(node.data.nodeResults, resultId);
  const projection = projectCanvasCurrentResult(nodeResults);
  const views = { ...node.data.resultAssetViews,
    ...(node.data.asset?.asset_id ? { [node.data.asset.asset_id]: node.data.asset } : {}) };
  if (projection.asset) {
    const view = views[projection.asset.asset_id];
    if (!view?.url || ['missing', 'forbidden'].includes(view.availability)) throw new Error('素材不可用，无法设为当前结果');
  }
  return projectNode(node, nodeResults, views);
}
