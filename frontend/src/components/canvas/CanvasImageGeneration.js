/** 图片节点的有向素材连线、模型上限和生成快照规则。 */
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';

function findNode(nodes, id) {
  return nodes.find((node) => node.id === id);
}

function imageReferenceLimit(node) {
  const value = node?.data?.imageReferenceLimit;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getImageReferenceLimit(capabilities) {
  // 图片模型能力由后端以 snake_case 返回；保留旧字段仅用于兼容历史草稿。
  const value = capabilities?.max_reference_images ?? capabilities?.maxReferenceImages;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isCanvasImageConnection(nodes, connection) {
  const source = findNode(nodes, connection.source);
  const target = findNode(nodes, connection.target);
  return ['text', 'image'].includes(source?.type) && target?.type === 'image' && source.id !== target.id
    && (!connection.sourceHandle || connection.sourceHandle === `${source.type}-output`)
    && (!connection.targetHandle || connection.targetHandle === 'image-input');
}

export function getCanvasImageReferenceStatus(nodes, targetId, limit) {
  const target = findNode(nodes, targetId);
  const sourceIds = [...new Set(target?.data?.imageSourceIds || [])]
    .filter((id) => ['text', 'image'].includes(findNode(nodes, id)?.type));
  const imageSourceIds = sourceIds.filter((id) => findNode(nodes, id)?.type === 'image');
  const effectiveLimit = Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target);
  const overflowSourceIds = imageSourceIds.slice(effectiveLimit);
  return { imageSourceIds, overflowSourceIds, canGenerate: overflowSourceIds.length === 0 };
}

export function hasUnsupportedCanvasImageReferences(nodes, targetId) {
  return getCanvasImageReferenceStatus(nodes, targetId).imageSourceIds.length > 0;
}

export function canConnectCanvasImage(nodes, connection, limit) {
  if (!isCanvasImageConnection(nodes, connection)) return false;
  const target = findNode(nodes, connection.target);
  const sourceIds = target?.data?.imageSourceIds || [];
  if (sourceIds.includes(connection.source)) return true;
  if (findNode(nodes, connection.source)?.type !== 'image') return true;
  return getCanvasImageReferenceStatus(nodes, target.id, limit).imageSourceIds.length < (Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target));
}

export function getCanvasImageConnectionError(nodes, connection, limit) {
  if (!isCanvasImageConnection(nodes, connection)) return '该节点不接受此类型的连线';
  if (findNode(nodes, connection.source)?.type !== 'image') return '';
  const target = findNode(nodes, connection.target);
  const effectiveLimit = Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target);
  if (effectiveLimit === 0) return '当前图片模型不支持图片参考，无法连接图片节点';
  if (!canConnectCanvasImage(nodes, connection, effectiveLimit)) return `当前图片模型最多支持 ${effectiveLimit} 张参考图，无法继续连接`;
  return '';
}

export function connectCanvasImage(nodes, connection, limit) {
  if (!canConnectCanvasImage(nodes, connection, limit)) return nodes;
  return setCanvasSelection(nodes.map((node) => node.id === connection.target ? {
    ...node,
    data: { ...node.data, imageSourceIds: [...new Set([...(node.data.imageSourceIds || []), connection.source])], persistenceState: 'draft' },
  } : node), [connection.target], true);
}

export function disconnectCanvasImage(nodes, target, source) {
  return nodes.map((node) => node.id === target ? {
    ...node,
    data: { ...node.data, imageSourceIds: (node.data.imageSourceIds || []).filter((id) => id !== source), persistenceState: 'draft' },
  } : node);
}

export function getCanvasImageEdges(nodes) {
  return nodes.filter((target) => target.type === 'image').flatMap((target) => [...new Set(target.data.imageSourceIds || [])]
    .map((sourceId) => ({ source: findNode(nodes, sourceId), target }))
    .filter(({ source }) => ['text', 'image'].includes(source?.type))
    .map(({ source, target }) => ({
      id: `image-material:${source.id}:${target.id}`,
      source: source.id,
      target: target.id,
      sourceHandle: `${source.type}-output`,
      targetHandle: 'image-input',
      data: { overflow: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) },
      className: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) ? 'canvas-edge--overflow' : undefined,
      style: { stroke: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) ? 'var(--color-text-danger)' : 'var(--color-stroke-accent)', strokeWidth: 2 },
    })));
}

export function planCanvasImageGeneration(nodes, nodeId, prompt, model, params = {}, resultId = `canvas-image-${crypto.randomUUID()}`) {
  const target = findNode(nodes, nodeId);
  if (!target || target.type !== 'image') throw new Error('图片节点已不存在');
  if (!prompt?.trim()) throw new Error('请输入创作提示词');
  if (!model) throw new Error('请选择可用的图片模型');
  const status = getCanvasImageReferenceStatus(nodes, nodeId, params.imageReferenceLimit);
  if (!status.canGenerate) throw new Error('参考图片数量超过当前模型上限，请删除超出的参考图后再创作');
  const sources = [...new Set(target.data.imageSourceIds || [])]
    .map((id) => findNode(nodes, id))
    .filter((source) => ['text', 'image'].includes(source?.type))
    .map((source) => ({ id: source.id, type: source.type, label: source.data.label, content: source.type === 'text' ? source.data.content : undefined, asset: source.type === 'image' ? source.data.asset : undefined }));
  if (target.data.asset?.url) sources.push({ id: target.id, type: target.type, label: target.data.label, asset: target.data.asset });
  const createsResult = Boolean(target.data.asset?.url);
  const mediaParams = { ...params };
  delete mediaParams.imageReferenceLimit;
  return { nodeId, prompt, model, params: mediaParams, sources, requestId: crypto.randomUUID(), resultId: createsResult ? resultId : nodeId, createsResult, originalAsset: target.data.asset || null };
}

export function beginCanvasImageGeneration(nodes, plan) {
  const target = findNode(nodes, plan.nodeId);
  if (!target) return nodes;
  const pending = nodes.map((node) => node.id === plan.nodeId ? { ...node, data: { ...node.data, creationPanelOpen: false, generating: !plan.createsResult, generationError: '', generationRequestId: plan.createsResult ? undefined : plan.requestId } } : node);
  if (!plan.createsResult) return pending;
  const position = getCanvasAbsolutePosition(nodes, target);
  const result = createCanvasNode('image', { x: position.x + 320, y: position.y }, plan.resultId);
  result.data = { ...result.data, model: plan.model, prompt: plan.prompt, imageReferenceLimit: target.data.imageReferenceLimit, generating: true, generationRequestId: plan.requestId, imageSourceIds: [...new Set([...plan.sources.map((source) => source.id)])] };
  while (nodes.some((node) => { const p = getCanvasAbsolutePosition(nodes, node); return Math.abs(p.x - result.position.x) < 260 && Math.abs(p.y - result.position.y) < 280; })) result.position.y += 300;
  return setCanvasSelection(appendCanvasNode(pending, result), [result.id], false);
}

export function recoverCanvasImageGenerationFailure(nodes, plan) {
  return nodes.map((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, generationError: '', generationRequestId: undefined } } : node);
}

export function applyCanvasImageResult(nodes, plan, asset) {
  const pending = nodes.find((node) => node.id === plan.resultId && node.data.generationRequestId === plan.requestId);
  if (!pending) return nodes;
  const recovered = recoverCanvasImageGenerationFailure(nodes, plan);
  return recovered.map((node) => node.id === plan.resultId && !node.data.asset?.url ? { ...node, data: { ...node.data, asset } } : node);
}
