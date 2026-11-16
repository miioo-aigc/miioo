/** 批量素材的整块避让、分列瀑布流及视口几何，均使用画布绝对坐标。 */
import { getCanvasAbsolutePosition } from './CanvasGroups.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';

const WIDTH = 240;
const HEIGHT = 264;
const GAP = 32;

export function getCanvasToolbarNodePosition(nodes, center, size = { width: WIDTH, height: HEIGHT }) {
  const visible = nodes.filter((node) => !node.hidden);
  if (!visible.length) return { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  const right = Math.max(...visible.map((node) => {
    const position = getCanvasAbsolutePosition(nodes, node);
    const fallback = getCanvasAssetNodeSize(node.data?.asset);
    const rawWidth = node.type === 'canvasGroup' && node.data?.stacked
      ? 312
      : node.measured?.width ?? node.width ?? node.style?.width ?? fallback.width;
    const width = Number(rawWidth) || WIDTH;
    return position.x + width;
  }));
  return { x: right + GAP, y: center.y - size.height / 2 };
}

/** One generated media node: place at viewport center, then search nearby gaps if occupied. */
export function getCanvasViewportCenterNodePosition(nodes, center, size = { width: WIDTH, height: HEIGHT }) {
  const visible = nodes.filter((node) => !node.hidden);
  const occupied = visible.map((node) => {
    const position = getCanvasAbsolutePosition(nodes, node);
    const fallback = getCanvasAssetNodeSize(node.data?.asset);
    const stacked = node.type === 'canvasGroup' && node.data?.stacked;
    return { x: position.x, y: position.y,
      width: stacked ? 300 : Number(node.measured?.width ?? node.width ?? node.style?.width ?? fallback.width) || WIDTH,
      height: stacked ? 300 : Number(node.measured?.height ?? node.height ?? node.style?.height ?? fallback.height) || HEIGHT };
  });
  const overlaps = (point) => occupied.some((rect) => point.x < rect.x + rect.width + GAP
    && point.x + size.width + GAP > rect.x && point.y < rect.y + rect.height + GAP
    && point.y + size.height + GAP > rect.y);
  const origin = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  if (!overlaps(origin)) return origin;
  for (let ring = 1; ring < 1000; ring += 1) {
    const candidates = [];
    for (let step = -ring; step <= ring; step += 1) {
      candidates.push({ x: origin.x + step * (size.width + GAP), y: origin.y - ring * (size.height + GAP) });
      candidates.push({ x: origin.x + step * (size.width + GAP), y: origin.y + ring * (size.height + GAP) });
    }
    for (let step = -ring + 1; step < ring; step += 1) {
      candidates.push({ x: origin.x - ring * (size.width + GAP), y: origin.y + step * (size.height + GAP) });
      candidates.push({ x: origin.x + ring * (size.width + GAP), y: origin.y + step * (size.height + GAP) });
    }
    const available = candidates.find((point) => !overlaps(point));
    if (available) return available;
  }
  return origin;
}

export function getCanvasImportBounds(positions) {
  if (!positions.length) return null;
  const x = Math.min(...positions.map((p) => p.x));
  const y = Math.min(...positions.map((p) => p.y));
  return { x, y, width: Math.max(...positions.map((p) => p.x + (p.width ?? WIDTH))) - x,
    height: Math.max(...positions.map((p) => p.y + (p.height ?? HEIGHT))) - y };
}

export function planCanvasImportPositions(count, center, nodes = [], sizes = []) {
  if (!count) return [];
  const columns = count <= 4 ? Math.min(2, count) : Math.ceil(Math.sqrt(count));
  const columnWidths = Array.from({ length: columns }, (_, col) => Math.max(...Array.from({ length: count }, (_, i) => i % columns === col ? sizes[i]?.width ?? WIDTH : 0)));
  const columnHeights = Array(columns).fill(0);
  const offsets = Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const y = columnHeights[column];
    columnHeights[column] += (sizes[index]?.height ?? HEIGHT) + GAP;
    return y;
  });
  const width = columnWidths.reduce((sum, value) => sum + value, 0) + (columns - 1) * GAP;
  const height = Math.max(...columnHeights) - GAP;
  const origin = { x: center.x - width / 2, y: center.y - height / 2 };
  const occupied = nodes.map((node) => {
    const stacked = node.type === 'canvasGroup' && node.data?.stacked;
    const fallback = getCanvasAssetNodeSize(node.data?.asset);
    return { selected: node.selected, ...getCanvasAbsolutePosition(nodes, node),
      width: stacked ? 300 : node.measured?.width ?? node.width ?? node.style?.width ?? fallback.width,
      height: stacked ? 300 : node.measured?.height ?? node.height ?? node.style?.height ?? fallback.height };
  });
  const available = (p) => occupied.every((rect) => p.x + width + GAP <= rect.x
    || p.x >= rect.x + rect.width + GAP || p.y + height + GAP <= rect.y || p.y >= rect.y + rect.height + GAP);
  let start = origin;
  if (occupied.length) {
    const selected = occupied.filter((rect) => rect.selected);
    const anchors = selected.length ? selected : occupied;
    start = { x: Math.max(...anchors.map((rect) => rect.x + rect.width)) + GAP,
      y: Math.min(...anchors.map((rect) => rect.y)) };
    // 仅向右移动整块网格，保持与锚点顶边对齐。
    const candidates = [...new Set([start.x, ...occupied.map((rect) => rect.x + rect.width + GAP)])]
      .filter((x) => x >= start.x).sort((a, b) => a - b);
    start.x = candidates.find((x) => available({ x, y: start.y }));
  }
  return Array.from({ length: count }, (_, index) => ({
    x: start.x + columnWidths.slice(0, index % columns).reduce((sum, value) => sum + value + GAP, 0),
    y: start.y + offsets[index],
  }));
}

export function preserveCanvasImportPanels(before, after) {
  const previous = new Map(before.map((node) => [node.id, node]));
  return after.map((node) => ({ ...node, selected: previous.get(node.id)?.selected || false,
    data: { ...node.data, creationPanelOpen: previous.get(node.id)?.data.creationPanelOpen || false } }));
}
