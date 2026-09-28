/** 引用只保存源节点身份与槽位；连线、缩略图实时派生，不复制素材。 */
import { appendCanvasNode, createCanvasNode, updateSelectedNode } from './canvasNodeUtils.js';
import { toCanvasAsset } from './CanvasAssets.js';
import { getCanvasAbsolutePosition } from './CanvasGroups.js';

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
  const targetPosition = getCanvasAbsolutePosition(nodes, target);
  const position = { x: targetPosition.x - 320, y: targetPosition.y };
  while (nodes.some((node) => {
    if (node.type === 'canvasGroup') return false;
    const absolute = getCanvasAbsolutePosition(nodes, node);
    return Math.abs(absolute.x - position.x) < 260 && Math.abs(absolute.y - position.y) < 280;
  })) position.y += 300;
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
