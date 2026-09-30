import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import { Tooltip } from '../ui';

function ScissorsIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M3.667 14C4.587 14 5.333 13.254 5.333 12.333C5.333 11.413 4.587 10.667 3.667 10.667C2.746 10.667 2 11.413 2 12.333C2 13.254 2.746 14 3.667 14Z" fill="none" stroke="currentColor" strokeLinejoin="round" />
    <path d="M12.333 14C13.254 14 14 13.254 14 12.333C14 11.413 13.254 10.667 12.333 10.667C11.413 10.667 10.667 11.413 10.667 12.333C10.667 13.254 11.413 14 12.333 14Z" fill="none" stroke="currentColor" strokeLinejoin="round" />
    <path d="M5.126 13.138L5.833 11.939L11.5 2.124" fill="none" stroke="currentColor" strokeLinecap="round" />
    <path d="M4.499 2.058L10.165 11.873L10.876 13.138" fill="none" stroke="currentColor" strokeLinecap="round" />
  </svg>;
}

export default function CanvasConnectionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const highlighted = Boolean(data?.highlighted);
  const setEdgeHover = (value) => {
    setHovered(value);
    data?.onHover?.(value ? id : null);
  };
  return <g onPointerEnter={() => setEdgeHover(true)} onPointerLeave={() => setEdgeHover(false)}>
    <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
    <path d={edgePath} fill="none" stroke="transparent" strokeWidth="20" className="react-flow__edge-interaction" />
    {highlighted && <path d={edgePath} fill="none" stroke="var(--color-white-50)" strokeWidth="2" className="pointer-events-none" />}
    <EdgeLabelRenderer>
      <div className={`nodrag nopan pointer-events-auto absolute transition-opacity ${hovered ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        onPointerEnter={() => setEdgeHover(true)} onPointerLeave={() => setEdgeHover(false)}>
        <Tooltip label="删除连线" offset={6}>
          <button type="button" aria-label="断开连线"
            className="flex size-[32px] items-center justify-center rounded-full border border-stroke-normal bg-surface-content-area text-text-primary transition-colors active:text-text-hint"
            style={{ boxShadow: '0 0 4px var(--color-shadow)' }}
            onClick={(event) => { event.stopPropagation(); data?.onDelete?.(id); }}>
            <ScissorsIcon />
          </button>
        </Tooltip>
      </div>
    </EdgeLabelRenderer>
  </g>;
}
