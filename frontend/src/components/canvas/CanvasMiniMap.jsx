/**
 * @file CanvasMiniMap.jsx
 * @description 画布预览地图；保留 React Flow 的视口交互，封装双层外观。
 */
import { MiniMap, useStore } from '@xyflow/react';
import './CanvasMiniMap.css';

const selectHasVisibleNodes = (state) => state.nodes.some((node) => !node.hidden);

export default function CanvasMiniMap() {
  const hasVisibleNodes = useStore(selectHasVisibleNodes);

  return (
    <MiniMap
      pannable
      zoomable
      ariaLabel="画布预览地图"
      nodeColor="#2DC3E1"
      bgColor="var(--color-surface-card)"
      maskColor="transparent"
      maskStrokeColor={hasVisibleNodes ? 'var(--color-stroke-normal)' : 'transparent'}
      maskStrokeWidth={hasVisibleNodes ? 1 : 0}
      style={{ width: 174, height: 124, boxSizing: 'content-box' }}
      className="canvas-mini-map rounded-medium border border-solid border-stroke-normal p-[8px] [outline:1px_solid_var(--color-stroke-outline)]"
    />
  );
}
