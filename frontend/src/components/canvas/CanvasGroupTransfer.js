/** 批量归组：只改选中根项归属，保留世界坐标、子树、引用和目标堆叠状态。 */
import { canvasDescendantIds, deleteCanvasNodes } from './CanvasNodeActions.js';
import { getCanvasAbsolutePosition, orderParentsFirst } from './CanvasGroups.js';

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
  const moved = new Map(roots.map((node, index) => [node.id, {
    ...node, parentId: targetId,
    position: { x: positions[index].x - origin.x, y: positions[index].y - origin.y },
  }]));
  // 先保证父项在前，再清理移空的旧组并按新成员范围调整组框。
  return deleteCanvasNodes(orderParentsFirst(nodes.map((node) => moved.get(node.id) || node)), []);
}
