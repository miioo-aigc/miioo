/** 排列只修改几何；节点归属、内容、选中状态由原节点保留。 */
import { canvasTransferRoots } from './CanvasGroupTransfer.js';
import { canvasDescendantIds } from './CanvasNodeActions.js';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';

export function getCanvasArrangement(nodes) {
  const selected = nodes.filter((node) => node.selected);
  const group = selected.length === 1 && selected[0].type === 'canvasGroup' ? selected[0] : null;
  const targets = group ? nodes.filter((node) => node.parentId === group.id) : canvasTransferRoots(nodes, selected.map((node) => node.id));
  let reason = '';
  if (group?.data?.stacked) reason = '展开组后可排列';
  else if (targets.length < 2) reason = '请选择至少两个节点';
  else if (!targets.every((node) => node.parentId === targets[0].parentId)) reason = '请选择同一层级的节点';
  const affected = canvasDescendantIds(nodes, targets.map((node) => node.id));
  if (!reason && [...getCanvasOperationLocks(nodes).submissionLocked].some((id) => affected.has(id))) reason = '任务提交中，暂不可排列';
  return { targets, reason };
}

function geometry(node) {
  const stacked = node.type === 'canvasGroup' && node.data?.stacked;
  const offset = stacked ? node.data.stackOffset || { x: 0, y: 0 } : { x: 0, y: 0 };
  return { node, x: node.position.x + offset.x, y: node.position.y + offset.y, offset,
    width: stacked ? 312 : Number(node.style?.width || node.measured?.width || 240),
    height: stacked ? 312 : Number(node.style?.height || node.measured?.height || 264) };
}

export function arrangeCanvasNodes(nodes, mode) {
  const { targets, reason } = getCanvasArrangement(nodes);
  if (reason || !['grid', 'horizontal', 'vertical'].includes(mode)) return nodes;
  const items = targets.map(geometry).sort((a, b) => a.y - b.y || a.x - b.x || a.node.id.localeCompare(b.node.id));
  const columns = mode === 'horizontal' ? items.length : mode === 'vertical' ? 1 : Math.ceil(Math.sqrt(items.length));
  const widths = Array(columns).fill(0), heights = [];
  items.forEach((item, i) => {
    const row = Math.floor(i / columns);
    widths[i % columns] = Math.max(widths[i % columns], item.width);
    heights[row] = Math.max(heights[row] || 0, item.height);
  });
  const origin = { x: Math.min(...items.map((item) => item.x)), y: Math.min(...items.map((item) => item.y)) };
  const positions = new Map(items.map((item, i) => [item.node.id, {
    x: origin.x + widths.slice(0, i % columns).reduce((sum, width) => sum + width + 32, 0) - item.offset.x,
    y: origin.y + heights.slice(0, Math.floor(i / columns)).reduce((sum, height) => sum + height + 32, 0) - item.offset.y,
  }]));
  let next = nodes.map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id) } : node);
  // 从内向外更新受影响组框，保留组原点及未选中节点的坐标。
  let parentId = targets[0].parentId;
  while (parentId) {
    const parent = next.find((node) => node.id === parentId);
    if (!parent) break;
    const children = next.filter((node) => node.parentId === parentId).map(geometry);
    const width = Math.max(...children.map((item) => item.x + item.width)) + 20;
    const height = Math.max(...children.map((item) => item.y + item.height)) + 20;
    next = next.map((node) => node.id === parentId ? { ...node, style: { ...node.style, width, height } } : node);
    parentId = parent.parentId;
  }
  return JSON.stringify(next) === JSON.stringify(nodes) ? nodes : next;
}
