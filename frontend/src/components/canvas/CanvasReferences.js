/** 引用只保存源节点身份与槽位；连线、缩略图实时派生，不复制素材。 */
import { appendCanvasNode, createCanvasNode, updateSelectedNode } from './canvasNodeUtils.js';
import { toCanvasAsset } from './CanvasAssets.js';
import { getCanvasAbsolutePosition } from './CanvasGroups.js';

const REFERENCE_NODE_GAP = 80;
const MAX_REFERENCE_NODE_GAP = 400;
const REFERENCE_NODE_SIZE = { width: 240, height: 240 };

function getNodeSize(node) {
  return {
    width: node?.measured?.width || node?.width || 240,
    height: node?.measured?.height || node?.height || 240,
  };
}

function overlaps(first, second) {
  return first.position.x < second.position.x + second.size.width
    && first.position.x + first.size.width > second.position.x
    && first.position.y < second.position.y + second.size.height
    && first.position.y + first.size.height > second.position.y;
}

export function getCanvasReferenceNodePosition(nodes, target) {
  const targetPosition = getCanvasAbsolutePosition(nodes, target);
  const targetSize = getNodeSize(target);
  const occupied = nodes.filter((node) => node.id !== target.id && node.type !== 'canvasGroup')
    .map((node) => ({ position: getCanvasAbsolutePosition(nodes, node), size: getNodeSize(node) }));

  const isAvailable = (position) => !occupied.some((other) => overlaps({ position, size: REFERENCE_NODE_SIZE }, other));
  const getCandidates = (gap) => [
    // 左侧和上侧是默认阅读方向，优先于右侧和下侧。
    { x: targetPosition.x - REFERENCE_NODE_SIZE.width - gap, y: targetPosition.y },
    { x: targetPosition.x, y: targetPosition.y - REFERENCE_NODE_SIZE.height - gap },
    { x: targetPosition.x - REFERENCE_NODE_SIZE.width - gap, y: targetPosition.y - REFERENCE_NODE_SIZE.height - gap },
    { x: targetPosition.x + targetSize.width + gap, y: targetPosition.y - REFERENCE_NODE_SIZE.height - gap },
    { x: targetPosition.x - REFERENCE_NODE_SIZE.width - gap, y: targetPosition.y + targetSize.height + gap },
    { x: targetPosition.x + targetSize.width + gap, y: targetPosition.y },
    { x: targetPosition.x, y: targetPosition.y + targetSize.height + gap },
    { x: targetPosition.x + targetSize.width + gap, y: targetPosition.y + targetSize.height + gap },
  ];

  for (let gap = REFERENCE_NODE_GAP; gap <= MAX_REFERENCE_NODE_GAP; gap += REFERENCE_NODE_GAP) {
    const available = getCandidates(gap).find(isAvailable);
    if (available) return available;
  }

  // 400px 范围内没有空位时继续向外扩展，但仍沿用相同的方向优先级。
  for (let radius = 2; radius <= 8; radius += 1) {
    const gap = MAX_REFERENCE_NODE_GAP * radius;
    const available = getCandidates(gap).find(isAvailable);
    if (available) return available;
  }
  return getCandidates(MAX_REFERENCE_NODE_GAP)[0];
}

export function getCanvasReferences(nodes, targetId) {
  const target = nodes.find((node) => node.id === targetId);
  return (target?.data.referenceInputs || []).flatMap((input) => {
    const source = nodes.find((node) => node.id === input.sourceId);
    return ['image', 'video', 'audio'].includes(source?.type) && source.data.asset?.url
      ? [{ id: source.id, slot: input.slot, asset: source.data.asset }] : [];
  }).sort((a, b) => a.slot - b.slot);
}

export function addCanvasReference(nodes, targetId, selectedAsset, mode = 'all') {
  const target = nodes.find((node) => node.id === targetId);
  const asset = toCanvasAsset(selectedAsset, target?.type);
  if (!target || !['image', 'video'].includes(target.type) || !asset) return nodes;
  const references = getCanvasReferences(nodes, targetId);
  const frameImage = mode === 'frame' && asset.asset_type === 'image';
  let slot = asset.asset_type === 'image' ? 0 : 2;
  while (references.some((reference) => reference.slot === slot)) slot += 1;
  if (frameImage && slot >= 2) return nodes;
  const position = getCanvasReferenceNodePosition(nodes, target);
  const source = createCanvasNode(asset.asset_type, position);
  // 复用页面提供的节点动作，不能复制目标节点的内容、编辑态或参数。
  for (const key of ['onPromptChange', 'onModelChange', 'onContentChange', 'onCancelPendingClick', 'onEnterEditing', 'onGenerate', 'onAssetChange', 'onSelectAsset']) {
    source.data[key] = target.data[key];
  }
  source.data.asset = asset;
  const next = appendCanvasNode(nodes, source).map((node) => node.id === targetId ? {
    ...node,
    data: { ...node.data, referenceInputs: [...references.map((reference) => ({ sourceId: reference.id, slot: reference.slot })), { sourceId: source.id, slot }], persistenceState: 'draft' },
  } : node);
  return updateSelectedNode(next, targetId);
}

export function removeCanvasReference(nodes, targetId, sourceId) {
  return nodes.map((node) => node.id === targetId ? {
    ...node, data: { ...node.data, referenceInputs: (node.data.referenceInputs || []).filter((input) => input.sourceId !== sourceId), persistenceState: 'draft' },
  } : node);
}

export function getCanvasReferenceEdges(nodes) {
  return nodes.flatMap((target) => getCanvasReferences(nodes, target.id).map((reference) => ({
    id: `reference:${reference.id}:${target.id}`,
    source: reference.id,
    target: target.id,
    sourceHandle: `${nodes.find((node) => node.id === reference.id).type}-output`,
    targetHandle: target.data.ports.input.id,
    style: { stroke: 'var(--color-stroke-accent)' },
  })));
}
