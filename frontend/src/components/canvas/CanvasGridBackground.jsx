/**
 * 编辑画布与分享画布共用的网点背景。
 * 2026-11-03：屏幕点间距从 8px 缩至 4px 时平滑淡出，避免密集网点覆盖底色。
 * 仅订阅缩放，不改变网格坐标、吸附规则或画布底色。
 */
import { Background, useStore } from '@xyflow/react';
import { CANVAS_GRID_GAP, CANVAS_GRID_DOT_SIZE, CANVAS_GRID_OFFSET } from './CanvasGrid';

const selectZoom = (state) => state.transform[2];

export default function CanvasGridBackground() {
  const zoom = useStore(selectZoom);
  const screenGap = CANVAS_GRID_GAP * zoom;
  const progress = Math.min(1, Math.max(0, (screenGap - 4) / 4));
  const opacity = progress * progress * (3 - 2 * progress);

  if (opacity === 0) return null;

  return <Background variant="dots" gap={CANVAS_GRID_GAP} size={CANVAS_GRID_DOT_SIZE}
    offset={CANVAS_GRID_OFFSET} patternClassName="[r:0.5px]"
    color={`rgba(255,255,255,${0.16 * opacity})`} />;
}
