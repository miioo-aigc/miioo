/** 音频任务快照与结果节点生命周期；只读取直连上游。 */
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';
import { getTextAudioEdges } from './CanvasTextAudio.js';

export function planCanvasAudioGeneration(nodes, nodeId, prompt, model, params = {}) {
  const target = nodes.find((node) => node.id === nodeId);
  if (target?.type !== 'audio') throw new Error('音频节点已不存在');
  if (!prompt?.trim()) throw new Error('请先输入台词');
  if (!model) throw new Error('请选择音频模型');
  const sourceIds = getTextAudioEdges(nodes).filter((edge) => edge.target === nodeId).map((edge) => edge.source);
  const sources = sourceIds.map((id) => nodes.find((node) => node.id === id));
  const createsResult = Boolean(target.data.asset?.url || target.data.transcript);
  if (createsResult) sources.push(target);
  return { nodeId, prompt, model, params, createsResult,
    resultId: createsResult ? `canvas-audio-${crypto.randomUUID()}` : nodeId,
    requestId: crypto.randomUUID(),
    sources: sources.map((node) => ({ id: node.id, type: node.type, asset: node.data.asset })),
  };
}

export function beginCanvasAudioGeneration(nodes, plan) {
  const target = nodes.find((node) => node.id === plan.nodeId);
  if (!target) return nodes;
  const pending = nodes.map((node) => node.id === target.id ? { ...node, data: { ...node.data,
    creationPanelOpen: false, generating: !plan.createsResult,
    generationRequestId: plan.createsResult ? undefined : plan.requestId,
  } } : node);
  if (!plan.createsResult) return pending;
  const position = getCanvasAbsolutePosition(nodes, target);
  const result = createCanvasNode('audio', { x: position.x + 320, y: position.y }, plan.resultId);
  for (const key of ['onPromptChange', 'onModelChange', 'onAssetChange', 'onSelectAsset']) result.data[key] = target.data[key];
  result.data = { ...result.data, model: plan.model, prompt: plan.prompt, generating: true,
    generationRequestId: plan.requestId, audioSourceIds: plan.sources.map((source) => source.id) };
  while (nodes.some((node) => {
    const point = getCanvasAbsolutePosition(nodes, node);
    return Math.abs(point.x - result.position.x) < 260 && Math.abs(point.y - result.position.y) < 280;
  })) result.position.y += 300;
  return setCanvasSelection(appendCanvasNode(pending, result), [result.id], false);
}

export function finishCanvasAudioGeneration(nodes, plan, asset = null) {
  return nodes.map((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, generationRequestId: undefined,
      ...(asset && !node.data.asset?.url ? { asset } : {}) } } : node);
}
