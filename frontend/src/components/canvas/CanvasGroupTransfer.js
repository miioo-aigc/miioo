/** 批量归组：整体移到目标最右成员旁，保留子树和引用，展开目标及其祖先。 */
import { canvasDescendantIds, deleteCanvasNodes } from './CanvasNodeActions.js';
import { getCanvasAbsolutePosition, orderParentsFirst } from './CanvasGroups.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';

export function canvasTransferBox(nodes, node) {
  const position = getCanvasAbsolutePosition(nodes, node);
  const group = node.type === 'canvasGroup';
  const stacked = group && node.data?.stacked;
  const size = getCanvasAssetNodeSize(node.data?.asset);
  return { x: position.x + (stacked ? node.data.stackOffset?.x || 0 : 0),
    y: position.y + (stacked ? node.data.stackOffset?.y || 0 : 0) - (group ? 24 : 0),
    width: stacked ? 312 : node.style?.width || node.width || node.measured?.width || size.width,
    height: (stacked ? 312 : node.style?.height || node.height || node.measured?.height || size.height) + (group ? 24 : 0) };
}

export function canvasTransferRoots(nodes, ids) {
  const selected = new Set(ids);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.filter((node) => {
    if (!selected.has(node.id)) return false;
    let parent = byId.get(node.parentId);
    while (parent) {
      if (selected.has(parent.id)) return false;
      parent = byId.get(parent.parentId);
    }
    return true;
  });
}

export function canMoveCanvasNodesInto(nodes, ids, targetId) {
  const roots = canvasTransferRoots(nodes, ids);
  return roots.length > 0
    && nodes.some((node) => node.id === targetId && node.type === 'canvasGroup')
    && !canvasDescendantIds(nodes, roots.map((node) => node.id)).has(targetId)
    && roots.some((node) => node.parentId !== targetId);
}

export function moveCanvasNodesInto(nodes, ids, targetId) {
  if (!canMoveCanvasNodesInto(nodes, ids, targetId)) return nodes;
  const roots = canvasTransferRoots(nodes, ids).filter((node) => node.parentId !== targetId);
  const positions = roots.map((node) => getCanvasAbsolutePosition(nodes, node));
  const origin = getCanvasAbsolutePosition(nodes, nodes.find((node) => node.id === targetId));
  const incomingIds = canvasDescendantIds(nodes, roots.map((node) => node.id));
  const members = nodes.filter((node) => node.parentId === targetId && !incomingIds.has(node.id));
  const rightmost = members.map((node) => canvasTransferBox(nodes, node))
    .sort((a, b) => (b.x + b.width) - (a.x + a.width))[0];
  const boxes = roots.map((node) => canvasTransferBox(nodes, node));
  const dx = (rightmost ? rightmost.x + rightmost.width + 32 : origin.x + 20) - Math.min(...boxes.map((box) => box.x));
  const dy = (rightmost ? rightmost.y : origin.y + 20) - Math.min(...boxes.map((box) => box.y));
  const expanded = new Set();
  let ancestor = nodes.find((node) => node.id === targetId);
  while (ancestor && !expanded.has(ancestor.id)) {
    expanded.add(ancestor.id);
    ancestor = nodes.find((node) => node.id === ancestor.parentId);
  }
  const moved = new Map(roots.map((node, index) => [node.id, {
    ...node, parentId: targetId,
    position: { x: positions[index].x + dx - origin.x, y: positions[index].y + dy - origin.y },
  }]));
  // 先保证父项在前，再清理移空的旧组并按新成员范围调整组框。
  return deleteCanvasNodes(orderParentsFirst(nodes.map((node) => moved.get(node.id)
    || (expanded.has(node.id) ? { ...node, data: { ...node.data, stacked: false } } : node))), []);
}
