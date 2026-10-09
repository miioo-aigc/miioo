export const INITIAL_COMPARISON_VIEW = { zoom: 1, x: 0, y: 0 };

export function clampComparisonView(view) {
  const zoom = Math.max(1, Math.min(8, view.zoom));
  if (zoom === 1) return { ...INITIAL_COMPARISON_VIEW };
  const limit = (zoom - 1) / 2;
  return { zoom, x: Math.max(-limit, Math.min(limit, view.x)), y: Math.max(-limit, Math.min(limit, view.y)) };
}

export function zoomComparisonView(view, delta, anchor) {
  const zoom = Math.max(1, Math.min(8, view.zoom * Math.exp(-delta * 0.002)));
  if (zoom === view.zoom) return view;
  const factor = zoom / view.zoom;
  // 平移以视口比例保存，左右面板共享鼠标锚点对应的同一图像位置。
  return clampComparisonView({ zoom,
    x: anchor.x - (anchor.x - view.x) * factor,
    y: anchor.y - (anchor.y - view.y) * factor,
  });
}
