import { getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';
import { setCanvasGroupsStacked } from './CanvasNodeActions.js';

export const CANVAS_SEARCH_TYPES = [
  { value: 'all', label: '全部' },
  { value: 'text', label: '文本' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'canvasGroup', label: '分组' },
];

export function canvasSearchName(node) {
  return String(node.data?.label || node.data?.name || CANVAS_SEARCH_TYPES.find((item) => item.value === node.type)?.label || '未命名节点');
}

export function filterCanvasSearchNodes(nodes, query, type) {
  const keyword = query.trim().toLowerCase();
  return nodes.filter((node) => (type === 'all' || node.type === type)
    && canvasSearchName(node).toLowerCase().includes(keyword));
}

export function canvasSearchParts(name, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [{ text: name, match: false }];
  const parts = [];
  let start = 0;
  let index;
  while ((index = name.toLowerCase().indexOf(keyword, start)) !== -1) {
    if (index > start) parts.push({ text: name.slice(start, index), match: false });
    parts.push({ text: name.slice(index, index + keyword.length), match: true });
    start = index + keyword.length;
  }
  if (start < name.length) parts.push({ text: name.slice(start), match: false });
  return parts;
}

export function revealCanvasSearchNode(nodes, id) {
  const target = nodes.find((node) => node.id === id);
  if (!target) return nodes;
  const ancestors = new Set();
  let parent = nodes.find((node) => node.id === target.parentId);
  while (parent && !ancestors.has(parent.id)) {
    ancestors.add(parent.id);
    parent = nodes.find((node) => node.id === parent.parentId);
  }
  return setCanvasSelection(setCanvasGroupsStacked(nodes, [...ancestors], false), [id]);
}

export function getCanvasSearchFocus(nodes, id, viewport, currentZoom) {
  const node = nodes.find((item) => item.id === id);
  if (!node) return null;
  const position = getCanvasAbsolutePosition(nodes, node);
  const stacked = node.type === 'canvasGroup' && node.data.stacked;
  const width = stacked ? 300 : node.style?.width ?? node.measured?.width ?? 240;
  const height = stacked ? 300 : node.style?.height ?? node.measured?.height ?? 264;
  return {
    x: position.x + width / 2, y: position.y + height / 2,
    zoom: Math.min(currentZoom, Math.max(1, viewport.width - 96) / width, Math.max(1, viewport.height - 160) / height),
  };
}
