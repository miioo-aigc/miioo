/**
 * @file CanvasMiniMap.jsx
 * @description 正文边界预览地图；组合保留外框，复用 XYMinimap 的拖动与缩放。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Panel, useStore, useStoreApi } from '@xyflow/react';
import { XYMinimap } from '@xyflow/system';
import { shallow } from 'zustand/shallow';
import { measureCanvasSnapFrames } from './CanvasSnapMeasurements';
import { getMiniMapRects, getMiniMapView } from './CanvasMiniMapGeometry';
import './CanvasMiniMap.css';

const selectNodes = (state) => Array.from(state.nodeLookup.values(), (node) => ({
  id: node.id, type: node.type, hidden: node.hidden,
  ...node.internals.positionAbsolute,
  width: node.measured?.width ?? node.width,
  height: node.measured?.height ?? node.height,
}));
const equalNodes = (a, b) => a.length === b.length && a.every((node, i) => shallow(node, b[i]));
const selectView = (state) => ({ transform: state.transform, width: state.width,
  height: state.height, domNode: state.domNode, panZoom: state.panZoom,
  translateExtent: state.translateExtent });

export default function CanvasMiniMap() {
  const store = useStoreApi();
  const nodes = useStore(selectNodes, equalNodes);
  const { transform, width, height, domNode, panZoom, translateExtent } = useStore(selectView, shallow);
  const [frames, setFrames] = useState(new Map());
  const svg = useRef(null);
  const scaleRef = useRef(1);
  const instance = useRef(null);

  useLayoutEffect(() => {
    const container = domNode?.querySelector('.react-flow__nodes');
    if (!container) return;
    let pending;
    const measure = () => {
      const next = measureCanvasSnapFrames(container);
      setFrames((previous) => previous.size === next.size
        && [...next].every(([id, frame]) => shallow(previous.get(id), frame)) ? previous : next);
    };
    const schedule = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const observeFrames = () => {
      resize.disconnect();
      container.querySelectorAll('.canvas-node__frame').forEach((frame) => resize.observe(frame));
      schedule();
    };
    const mutations = new MutationObserver(observeFrames);
    mutations.observe(container, { childList: true, subtree: true });
    observeFrames();
    measure();
    return () => { cancelAnimationFrame(pending); resize.disconnect(); mutations.disconnect(); };
  }, [domNode]);

  const viewport = { x: -transform[0] / transform[2], y: -transform[1] / transform[2],
    width: width / transform[2], height: height / transform[2] };
  const rects = getMiniMapRects(nodes, frames);
  const view = getMiniMapView(rects, viewport);
  useLayoutEffect(() => { scaleRef.current = view.scale; }, [view.scale]);
  useEffect(() => {
    if (!svg.current || !panZoom) return;
    const map = XYMinimap({ domNode: svg.current, panZoom,
      getTransform: () => store.getState().transform, getViewScale: () => scaleRef.current });
    instance.current = map;
    return () => { map.destroy(); instance.current = null; };
  }, [panZoom, store]);
  useEffect(() => {
    instance.current?.update({ translateExtent, width, height, pannable: true, zoomable: true, zoomStep: 1 });
  }, [panZoom, translateExtent, width, height]);

  return (
    <Panel position="bottom-right"
      style={{ width: 174, height: 124, boxSizing: 'content-box', background: 'var(--color-surface-card)' }}
      className="react-flow__minimap canvas-mini-map rounded-medium border border-solid border-stroke-normal p-[8px] [outline:1px_solid_var(--color-stroke-outline)]">
      <svg ref={svg} width={174} height={124} className="react-flow__minimap-svg"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label="画布预览地图">
        {rects.map((rect) => <rect key={rect.id} x={rect.x} y={rect.y}
          width={rect.width} height={rect.height} rx={5} ry={5} fill="var(--color-brand-main)" />)}
        <rect {...viewport} fill="none" pointerEvents="none"
          stroke={rects.length ? 'var(--color-stroke-outline)' : 'transparent'}
          strokeWidth={view.scale} />
      </svg>
    </Panel>
  );
}
