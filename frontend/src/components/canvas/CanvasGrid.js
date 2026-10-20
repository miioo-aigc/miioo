/** 与 React Flow Background 的圆点中心计算保持一致。 */
export const CANVAS_GRID_GAP = 16;
export const CANVAS_GRID_DOT_SIZE = 1;
export const CANVAS_GRID_OFFSET = 0;
export const CANVAS_GRID_ORIGIN = CANVAS_GRID_DOT_SIZE / 2 - CANVAS_GRID_GAP / 2 - CANVAS_GRID_OFFSET;

export function snapToCanvasGrid(value) {
  return Math.round((value - CANVAS_GRID_ORIGIN) / CANVAS_GRID_GAP) * CANVAS_GRID_GAP + CANVAS_GRID_ORIGIN;
}
