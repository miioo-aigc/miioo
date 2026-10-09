import { getCanvasAbsolutePosition } from './CanvasGroups.js';

export function getCanvasGroupFocus(nodes, group, viewport, currentZoom) {
  const position = getCanvasAbsolutePosition(nodes, group);
  const width = group.style?.width || 270;
  const height = group.style?.height || 180;
  const zoom = Math.min(currentZoom, Math.max(1, viewport.width - 96) / width,
    Math.max(1, viewport.height - 160) / height);
  return { x: position.x + width / 2, y: position.y + height / 2, zoom };
}
