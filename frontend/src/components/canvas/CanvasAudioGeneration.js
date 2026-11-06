/** 音频任务快照与结果节点生命周期；只读取直连上游。 */
import { getTextAudioEdges } from './CanvasTextAudio.js';
import { commitCanvasNodeOutput } from './CanvasResultMutations.js';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';

export function planCanvasAudioGeneration(nodes, nodeId, prompt, model, params = {}) {
  const target = nodes.find((node) => node.id === nodeId);
  if (target?.type !== 'audio') throw new Error('音频节点已不存在');
  if (target.data.generating || target.data.submissionLocked || target.data.editing || target.data.upstreamProtected
    || target.data.asset?.uploadStatus === 'uploading' || target.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading'
    || getCanvasOperationLocks(nodes).upstreamProtected.has(nodeId)) throw new Error('当前音频节点正在执行、上传或受到任务保护');
  if (!prompt?.trim()) throw new Error('请先输入台词');
  if (!model) throw new Error('请选择音频模型');
  const sourceIds = getTextAudioEdges(nodes).filter((edge) => edge.target === nodeId).map((edge) => edge.source);
  const sources = sourceIds.map((id) => nodes.find((node) => node.id === id));
  if (sources.some((source) => !source || source.data.generating || source.data.submissionLocked || source.data.editing
    || source.data.upstreamProtected || source.data.asset?.uploadStatus === 'uploading'
    || source.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading')) throw new Error('直接上游正在执行或上传，无法生成');
  if (sources.some((source) => source.type === 'text' && !source.data.content?.trim())) throw new Error('直接上游文本缺失或无有效结果');
  const requestId = crypto.randomUUID();
  return { nodeId, prompt, model, params, createsResult: true, resultId: nodeId, requestId, submittedAt: Date.now(),
    snapshot: { prompt, model, params: { ...params }, inputs: sources.map((source) => ({ nodeId: source.id, type: source.type,
      ...(source.type === 'text' ? { content: source.data.content || '' } : { assetId: source.data.asset?.asset_id || source.data.asset?.assetId || null }) })) },
    sources: sources.map((node) => ({ id: node.id, type: node.type, asset: node.data.asset })),
  };
}

export function beginCanvasAudioGeneration(nodes, plan) {
  const target = nodes.find((node) => node.id === plan.nodeId);
  if (!target || target.type !== 'audio') return nodes;
  if (target.data.generating || target.data.submissionLocked || target.data.editing || target.data.asset?.uploadStatus === 'uploading'
    || target.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading'
    || getCanvasOperationLocks(nodes).upstreamProtected.has(target.id)) throw new Error('当前音频节点状态已变化，已取消本次创作');
  const protectedBy = nodes.find((node) => node.id !== target.id && node.data.submissionLocked
    && node.data.executionSourceIds?.includes(target.id));
  if (protectedBy) throw new Error('当前音频节点已被其他任务作为上游保护，已取消本次创作');
  return nodes.map((node) => node.id === target.id ? { ...node, data: { ...node.data,
    creationPanelOpen: false, generating: true, generationRequestId: plan.requestId,
    generationError: '', submissionLocked: true, generationTaskIds: [],
    executionSourceIds: plan.sources.filter((source) => source.id !== node.id).map((source) => source.id),
  } } : node);
}

export function acceptCanvasAudioSubmission(nodes, plan, task) {
  const ids = Array.isArray(task?.taskIds) && task.taskIds.length ? task.taskIds : [task?.taskId].filter(Boolean);
  if (!ids.length || ids.some((id) => typeof id !== 'string' || !id.trim())) throw new Error('音频任务缺少真实服务端编号');
  plan.taskIds = [...new Set([...(plan.taskIds || []), ...ids])];
  return nodes.map((node) => node.id === plan.nodeId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, submissionLocked: false, generationTaskIds: [...plan.taskIds] } } : node);
}

export function finishCanvasAudioGeneration(nodes, plan, asset = null) {
  return nodes.map((node) => {
    if (node.id !== plan.nodeId || node.data.generationRequestId !== plan.requestId) return node;
    const clean = { ...node, data: { ...node.data, generating: false, generationRequestId: undefined, executionSourceIds: undefined,
      submissionLocked: false, generationTaskIds: undefined } };
    if (!asset) return clean;
    const now = Date.now();
    return commitCanvasNodeOutput(clean, { id: plan.requestId, source: 'generation', requestedCount: 1,
      results: [{ id: `audio-result-${plan.requestId}`, index: 0, type: 'audio', assetId: asset.asset_id }],
      submittedAt: plan.submittedAt, completedAt: now, snapshot: plan.snapshot, taskIds: plan.taskIds || [] },
    { [asset.asset_id]: asset });
  });
}
