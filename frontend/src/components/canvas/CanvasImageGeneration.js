/** 图片节点的有向素材连线、模型上限和生成快照规则。
 * 2026-10-26：生成结果逐项保留真实资产编号，使画布可保存并刷新恢复。
 * 2026-10-26：批量结果独立卡片、统一上游、垂直/网格布局与组内归属。
 */
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { fitCanvasGroups, getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';

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
  const ownCount = target?.data?.asset?.url ? 1 : 0;
  const overflowSourceIds = imageSourceIds.slice(Math.max(0, effectiveLimit - ownCount));
  return { imageSourceIds, overflowSourceIds, canGenerate: imageSourceIds.length + ownCount <= effectiveLimit };
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
  const ownCount = target.data.asset?.url ? 1 : 0;
  return getCanvasImageReferenceStatus(nodes, target.id, limit).imageSourceIds.length + ownCount < (Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target));
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

export function connectCanvasImage(nodes, connection, limit, { retainInvalid = false } = {}) {
  if (!isCanvasImageConnection(nodes, connection)
    || (!retainInvalid && !canConnectCanvasImage(nodes, connection, limit))) return nodes;
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
  const count = Math.max(1, Number.parseInt(params.count, 10) || 1);
  const firstId = createsResult ? resultId : nodeId;
  const resultIds = Array.from({ length: count }, (_, index) => index ? 'canvas-image-' + crypto.randomUUID() : firstId);
  return { nodeId, prompt, model, params: mediaParams, sources, requestId: crypto.randomUUID(), resultId: firstId, resultIds, createsResult, originalAsset: target.data.asset || null };
}

export function beginCanvasImageGeneration(nodes, plan) {
  const target = findNode(nodes, plan.nodeId);
  if (!target) return nodes;
  const ids = plan.resultIds || [plan.resultId];
  const position = getCanvasAbsolutePosition(nodes, target);
  const size = getCanvasAssetNodeSize(target.data.asset);
  const anchor = { x: position.x + (plan.createsResult ? size.width + 80 : 0), y: position.y };
  const data = { model: plan.model, prompt: plan.prompt, imageReferenceLimit: target.data.imageReferenceLimit,
    generating: true, generationError: '', generationRequestId: plan.requestId,
    imageSourceIds: [...new Set(plan.sources.map((source) => source.id))] };
  let next = nodes.map((node) => node.id === plan.nodeId ? {
    ...node, data: { ...node.data, creationPanelOpen: false, ...(!plan.createsResult ? data : {}) },
  } : node);
  for (const id of ids) {
    if (id === target.id) continue;
    const result = createCanvasNode('image', anchor, id);
    result.data = { ...result.data, ...data };
    next = appendCanvasNode(next, result, target.parentId);
  }
  return setCanvasSelection(layoutImageResults(next, plan, anchor, plan.createsResult), ids, false);
}

function layoutImageResults(nodes, plan, anchor, avoid = false) {
  const ids = plan.resultIds || [plan.resultId];
  const [ratioWidth, ratioHeight] = String(plan.params.ratio || '').split(':').map(Number);
  const fallback = ratioWidth > 0 && ratioHeight > 0 ? { asset_type: 'image', width: ratioWidth, height: ratioHeight } : null;
  const sizes = ids.map((id) => {
    const asset = findNode(nodes, id)?.data.asset;
    const size = getCanvasAssetNodeSize(asset || fallback);
    // 加载中仍是默认空卡片，预留空间同时覆盖空态与预计成品尺寸。
    return asset ? size : { width: Math.max(240, size.width), height: Math.max(264, size.height) };
  });
  const columns = ids.length < 4 ? 1 : Math.ceil(Math.sqrt(ids.length));
  const width = Math.max(...sizes.map((size) => size.width));
  const height = Math.max(...sizes.map((size) => size.height));
  const start = { ...anchor };
  if (avoid) {
    const blockWidth = columns * (width + 48) - 48;
    const blockHeight = Math.ceil(ids.length / columns) * (height + 48) - 48;
    const occupied = nodes.filter((node) => !ids.includes(node.id) && node.type !== 'canvasGroup' && !node.hidden)
      .map((node) => ({ ...getCanvasAbsolutePosition(nodes, node), ...getCanvasAssetNodeSize(node.data.asset) }));
    for (const rect of occupied.sort((a, b) => a.y - b.y)) {
      if (start.x < rect.x + rect.width + 32 && start.x + blockWidth + 32 > rect.x
        && start.y < rect.y + rect.height + 32 && start.y + blockHeight + 32 > rect.y) start.y = rect.y + rect.height + 32;
    }
  }
  const groups = new Set();
  for (const id of ids) {
    let parent = findNode(nodes, findNode(nodes, id)?.parentId);
    while (parent && !groups.has(parent.id)) {
      groups.add(parent.id);
      parent = findNode(nodes, parent.parentId);
    }
  }
  return fitCanvasGroups(nodes.map((node) => {
    const index = ids.indexOf(node.id);
    if (index < 0) return node;
    const parent = findNode(nodes, node.parentId);
    const origin = parent ? getCanvasAbsolutePosition(nodes, parent) : { x: 0, y: 0 };
    return { ...node, position: {
      x: start.x + (index % columns) * (width + 48) - origin.x,
      y: start.y + Math.floor(index / columns) * (height + 48) - origin.y,
    } };
  }), groups);
}

export function recoverCanvasImageGenerationFailure(nodes, plan) {
  const ids = new Set(plan.resultIds || [plan.resultId]);
  return nodes.map((node) => ids.has(node.id) && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, generationError: '', generationRequestId: undefined } } : node);
}

export function applyCanvasImageResult(nodes, plan, asset) {
  const ids = plan.resultIds || [plan.resultId];
  const assets = Array.isArray(asset) ? asset : [asset];
  const active = new Set(nodes.filter((node) => ids.includes(node.id) && node.data.generationRequestId === plan.requestId).map((node) => node.id));
  if (!active.size) return nodes;
  const recovered = recoverCanvasImageGenerationFailure(nodes, plan);
  const next = recovered.map((node) => {
    const index = ids.indexOf(node.id);
    return active.has(node.id) && !node.data.asset?.url ? { ...node, data: { ...node.data,
      asset: assets[index] || null, generationError: assets[index] ? '' : '本次生成未返回该图片，请重试',
    } } : node;
  });
  const first = ids.map((id) => findNode(nodes, id)).find(Boolean);
  const firstIndex = ids.indexOf(first.id);
  const firstPosition = getCanvasAbsolutePosition(nodes, first);
  // 删除首个结果后也保留原索引，避免将第二张误配成第一张。
  const allExistingActive = nodes.filter((node) => ids.includes(node.id)).every((node) => active.has(node.id));
  return firstIndex === 0 && allExistingActive ? layoutImageResults(next, plan, firstPosition) : next;
}

export function getCanvasImageResultAssets(result) {
  const count = Math.max(result?.images?.length || 0, result?.imageDownloadUrls?.length || 0, result?.imageOriginalUrls?.length || 0);
  return Array.from({ length: count }, (_, index) => {
    const previewUrl = result.images?.[index];
    const originalUrl = result.imageOriginalUrls?.[index] || result.imageDownloadUrls?.[index];
    const url = originalUrl || previewUrl;
    return url ? { url, previewUrl, originalUrl, asset_id: result.imageAssetIds?.[index], asset_type: 'image', source: 'ai-generated' } : null;
  });
}
