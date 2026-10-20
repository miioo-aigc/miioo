/** 小地图只使用正文边界；组合继续使用 React Flow 的外框。 */
export function getMiniMapRects(nodes, frames) {
  return nodes.filter((node) => !node.hidden).flatMap((node) => {
    const frame = node.type === 'canvasGroup'
      ? { x: 0, y: 0, width: node.width, height: node.height }
      : frames.get(node.id);
    if (!frame?.width || !frame?.height) return [];
    return [{ id: node.id, x: node.x + frame.x, y: node.y + frame.y,
      width: frame.width, height: frame.height }];
  });
}

export function getMiniMapView(rects, viewport, width = 174, height = 124) {
  const bounds = rects.reduce((box, rect) => ({
    left: Math.min(box.left, rect.x), top: Math.min(box.top, rect.y),
    right: Math.max(box.right, rect.x + rect.width),
    bottom: Math.max(box.bottom, rect.y + rect.height),
  }), { left: viewport.x, top: viewport.y,
    right: viewport.x + viewport.width, bottom: viewport.y + viewport.height });
  const scale = Math.max((bounds.right - bounds.left) / width,
    (bounds.bottom - bounds.top) / height, 0.001);
  return { x: (bounds.left + bounds.right - width * scale) / 2,
    y: (bounds.top + bounds.bottom - height * scale) / 2,
    width: width * scale, height: height * scale, scale };
}
