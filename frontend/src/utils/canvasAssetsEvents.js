export const CANVAS_ASSETS_CHANGED_EVENT = 'canvas-assets-changed';

export function dispatchCanvasAssetsChanged(canvasId) {
  if (!canvasId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CANVAS_ASSETS_CHANGED_EVENT, {
    detail: { canvasId },
  }));
}
