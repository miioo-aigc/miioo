/** 吸附使用卡片正文的世界坐标；不包含标题、工具栏和创作面板。 */
import { getCanvasAbsolutePosition } from './CanvasGroups.js';
import { snapToCanvasGrid } from './CanvasGrid.js';

export function getSnapBox(nodes, node, frames = new Map()) {
  const position = getCanvasAbsolutePosition(nodes, node);
  const group = node.type === 'canvasGroup';
  const stacked = group && node.data?.stacked;
  const frame = !group && frames.get(node.id);
  if (frame) return { x: position.x + frame.x, y: position.y + frame.y, width: frame.width, height: frame.height };
  const width = stacked ? 312 : node.measured?.width ?? node.style?.width ?? 240;
  const height = stacked ? 312 : node.measured?.height ?? node.style?.height ?? 264;
  return { x: position.x + (stacked ? node.data.stackOffset?.x || 0 : 0),
    y: position.y + (stacked ? node.data.stackOffset?.y || 0 : group ? 0 : 24),
    width, height: height - (group ? 0 : 24) };
}

function ancestors(node, byId) {
  const ids = new Set();
  let parent = byId.get(node.parentId);
  while (parent && !ids.has(parent.id)) {
    ids.add(parent.id);
    parent = byId.get(parent.parentId);
  }
  return ids;
}

export function snapCanvasNodes(nodes, movingIds, zoom = 1, previous = {}, frames = new Map()) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const moving = new Set(movingIds);
  const roots = nodes.filter((node) => moving.has(node.id) && ![...ancestors(node, byId)].some((id) => moving.has(id)));
  if (!roots.length) return { nodes, guides: [], locks: {} };
  const boxes = roots.map((node) => getSnapBox(nodes, node, frames));
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
  const box = { x, y, width: Math.max(...boxes.map((item) => item.x + item.width)) - x,
    height: Math.max(...boxes.map((item) => item.y + item.height)) - y };
  const excluded = new Set(roots.flatMap((node) => [...ancestors(node, byId), node.id]));
  const targets = nodes.filter((node) => !node.hidden && !excluded.has(node.id)
    && ![...ancestors(node, byId)].some((id) => moving.has(id) || byId.get(id)?.data?.stacked))
    .map((node) => ({ ...getSnapBox(nodes, node, frames), id: node.id }));
  const scale = Math.max(0.05, zoom);
  const guides = [], locks = {}, delta = {};
  for (const axis of ['x', 'y']) {
    const size = axis === 'x' ? 'width' : 'height';
    const other = axis === 'x' ? 'y' : 'x';
    const otherSize = axis === 'x' ? 'height' : 'width';
    const direction = box[axis] - (previous.box?.[axis] ?? box[axis]);
    const sides = direction > 0 ? [1, 0] : [0, 1];
    let best;
    for (const target of targets) {
      const gap = Math.max(target[other] - box[other] - box[otherSize], box[other] - target[other] - target[otherSize], 0);
      if (gap * scale > 400) continue;
      for (const side of sides) for (const targetSide of [0, 1]) {
        const line = target[axis] + targetSide * target[size];
        const offset = line - box[axis] - side * box[size];
        const locked = previous.locks?.[axis]?.id === target.id && previous.locks[axis].side === side
          && previous.locks[axis].targetSide === targetSide;
        if (Math.abs(offset) * scale > (locked ? 10 : 6)) continue;
        const score = Math.abs(offset) * scale - (locked ? 10 : 0);
        if (!best || score < best.score) best = { id: target.id, side, targetSide, line, offset, score };
      }
    }
    delta[axis] = best ? best.offset : snapToCanvasGrid(box[axis]) - box[axis];
    if (best) {
      locks[axis] = best;
      guides.push({ axis, value: best.line });
    }
  }
  const rootIds = new Set(roots.map((node) => node.id));
  return { nodes: nodes.map((node) => rootIds.has(node.id) ? { ...node,
    position: { x: node.position.x + delta.x, y: node.position.y + delta.y } } : node),
  guides, locks, box };
}
