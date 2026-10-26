/** 组合边框与堆叠预览；堆叠不改写成员坐标。2026-10-19：连接点常驻，避免收起时连线先于连接点注册。 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Handle, Position, useStore, useStoreApi, useUpdateNodeInternals } from '@xyflow/react';
import CanvasGroupStackPreview from './CanvasGroupStackPreview';
import CanvasEditableName from './CanvasEditableName';
import { Tooltip } from '../ui';

export default function CanvasGroupNode({ id, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const store = useStoreApi();
  const hasSingleGroupSelection = useStore((state) => state.nodesSelectionActive
    && state.nodes.some((node) => node.id === id && node.selected)
    && !state.nodes.some((node) => node.id !== id && node.selected));
  useLayoutEffect(() => {
    // 单组选中由组合自身描边反馈；仅关闭框选覆盖层，不清除节点选中状态。
    if (hasSingleGroupSelection) store.setState({ nodesSelectionActive: false });
  }, [hasSingleGroupSelection, store]);
  const rootRef = useRef(null);
  const stackRef = useRef(null);
  const frameRef = useRef(null);
  const previousStacked = useRef(Boolean(data.stacked));
  const previousMembers = useRef(new Set((data.stackMembers || []).map((member) => member.id)));
  const interrupted = useRef(new Map());
  const stacked = Boolean(data.stacked);
  const zoom = data.viewportZoom || 1;
  const offsetX = data.stackOffset?.x || 0;
  const offsetY = data.stackOffset?.y || 0;
  const membersSnapshot = JSON.stringify(data.stackMembers || []);
  useLayoutEffect(() => {
    const changed = previousStacked.current !== stacked;
    previousStacked.current = stacked;
    const members = JSON.parse(membersSnapshot);
    const addedIds = new Set(members.filter((member) => !previousMembers.current.has(member.id)).map((member) => member.id));
    previousMembers.current = new Set(members.map((member) => member.id));
    const receiving = stacked && !changed && addedIds.size > 0;
    if ((!changed && !receiving) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interruptedFrames = interrupted.current;
    const options = { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    const small = { transform: `translate(${stacked ? 0 : offsetX}px, ${stacked ? 0 : offsetY}px)`, width: '312px', height: '312px', opacity: 1, borderRadius: '20px' };
    const large = { transform: `translate(${stacked ? -offsetX : 0}px, ${stacked ? -offsetY : 0}px)`, width: `${data.expandedWidth || 270}px`, height: `${data.expandedHeight || 180}px`, opacity: 1, borderRadius: '20px' };
    const animations = [];
    const tracked = [];
    const play = (element, frames, timing = options) => {
      const start = interruptedFrames.get(element);
      tracked.push(element);
      animations.push(element.animate(start ? [start, ...frames.slice(1)] : frames, timing));
    };
    if (changed) {
      play(frameRef.current, stacked ? [large, small] : [small, large]);
      play(stackRef.current, [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: stacked ? 1 : 0 }], { ...options, duration: 375 });
    }
    stackRef.current.querySelectorAll('[data-stack-member]').forEach((element, index) => {
      const member = members.find((item) => item.id === element.dataset.stackMember);
      if (!member) return;
      if (receiving && !addedIds.has(member.id)) return;
      const compact = { transform: `translate(${stacked ? 0 : offsetX}px, ${stacked ? 0 : offsetY}px) ${element.style.transform}`, width: '240px', height: '240px', opacity: Number(element.style.opacity) };
      const expanded = { transform: `translate(${member.x - (stacked ? offsetX : 0)}px, ${member.y - (stacked ? offsetY : 0)}px) rotate(0deg)`, width: `${member.width}px`, height: `${member.height}px`, opacity: 1 };
      play(element, stacked ? [expanded, compact] : [compact, expanded], { ...options, delay: Math.min(index, 5) * 15, fill: 'both' });
    });
    if (!stacked) {
      const ids = new Set(members.map((member) => member.id));
      rootRef.current.closest('.react-flow')?.querySelectorAll('.react-flow__node').forEach((element) => {
        if (ids.has(element.dataset.id)) animations.push(element.animate([
          { opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 },
        ], { duration: 375, easing: 'ease-out' }));
      });
    }
    interruptedFrames.clear();
    return () => {
      if (animations.some((animation) => animation.playState === 'running')) tracked.forEach((element) => {
        const style = getComputedStyle(element);
        interruptedFrames.set(element, { transform: style.transform, width: style.width, height: style.height, opacity: style.opacity });
      });
      animations.forEach((animation) => animation.cancel());
    };
  }, [stacked, membersSnapshot, data.expandedWidth, data.expandedHeight, offsetX, offsetY]);
  useEffect(() => { updateNodeInternals(id); }, [id, data.stacked, updateNodeInternals]);
  return <div ref={rootRef} className={stacked ? 'canvas-group-stack' : 'canvas-group'} data-selected={selected}
    style={stacked ? undefined : { borderColor: 'transparent', background: 'transparent' }}>
    <div ref={frameRef} className="canvas-group canvas-group-morph__frame" />
    <div ref={stackRef} className="canvas-group-morph__stack" style={{ opacity: stacked ? 1 : 0, pointerEvents: stacked ? 'auto' : 'none' }} aria-hidden={!stacked}>
      <CanvasGroupStackPreview members={data.stackMembers} />
    </div>
    {data.readOnly && stacked && <div className="absolute inset-0">
      <Tooltip label="双击展开组" followCursor>
        <span className="block h-[312px] w-[312px]" />
      </Tooltip>
    </div>}
    {/* 保持可测量的连接点常驻，收起时连线可直接复用已注册的端点。 */}
    <Handle type="target" position={Position.Left} id="stack-input" isConnectable={false} style={{ opacity: 0, pointerEvents: 'none' }} />
    <Handle type="source" position={Position.Right} id="stack-output" isConnectable={false} style={{ opacity: 0, pointerEvents: 'none' }} />
    <div className="canvas-group__name" style={{ '--canvas-group-name-zoom': zoom, '--canvas-group-name-inverse-zoom': 1 / zoom }}>
      {data.readOnly ? <span title={data.label}>{data.label}</span> : <CanvasEditableName name={data.label} onRename={data.onRename} onStart={data.onRenameStart} />}
    </div>
  </div>;
}
