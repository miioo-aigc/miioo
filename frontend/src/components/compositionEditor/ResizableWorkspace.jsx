import { useEffect, useRef, useState } from 'react';

const GAP = 12;
const DEFAULTS = { left: 400, right: 400, bottom: 280 };
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));

export default function ResizableWorkspace({ assets, preview, properties, timeline }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [bounds, setBounds] = useState({ width: 1200, height: 700 });
  const [sizes, setSizes] = useState(DEFAULTS);
  const [dragging, setDragging] = useState(null);
  const usableWidth = Math.max(740, bounds.width - GAP * 2);
  const minimumSide = 200;
  const minimumLeft = 346;
  const minimumCenter = Math.min(280, usableWidth / 3);
  const left = clamp(sizes.left, minimumLeft, usableWidth - minimumSide - minimumCenter);
  const right = clamp(sizes.right, minimumSide, usableWidth - left - minimumCenter);
  const usableHeight = Math.max(0, bounds.height - GAP);
  const minimumBottom = Math.min(160, usableHeight / 3);
  const maximumBottom = usableHeight - Math.min(220, usableHeight / 2);
  const bottom = clamp(sizes.bottom, minimumBottom, maximumBottom);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function resize(panel, value) {
    const next = panel === 'left'
      ? clamp(value, minimumLeft, usableWidth - right - minimumCenter)
      : panel === 'right'
        ? clamp(value, minimumSide, usableWidth - left - minimumCenter)
        : clamp(value, minimumBottom, maximumBottom);
    setSizes((previous) => ({ ...previous, [panel]: next }));
  }

  function separator(panel) {
    const vertical = panel !== 'bottom';
    const minimum = panel === 'left' ? minimumLeft : vertical ? minimumSide : minimumBottom;
    const value = panel === 'left' ? left : panel === 'right' ? right : bottom;
    const maximum = panel === 'bottom' ? maximumBottom : usableWidth - (panel === 'left' ? right : left) - minimumCenter;
    return (
      <div role="separator" tabIndex={0}
        aria-label={panel === 'left' ? '调整素材区域宽度' : panel === 'right' ? '调整属性区域宽度' : '调整时间线高度'}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(maximum)} aria-valuenow={Math.round(value)}
        className="group flex items-center justify-center outline-none focus-visible:bg-white/[0.08]"
        style={{ cursor: vertical ? 'col-resize' : 'row-resize', touchAction: 'none', gridColumn: panel === 'bottom' ? '1 / -1' : undefined }}
        onDoubleClick={() => resize(panel, DEFAULTS[panel])}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { panel, start: vertical ? event.clientX : event.clientY, value };
          setDragging(panel);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.panel !== panel) return;
          const delta = (vertical ? event.clientX : event.clientY) - drag.start;
          resize(panel, drag.value + (panel === 'left' ? delta : -delta));
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          setDragging(null);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => { dragRef.current = null; setDragging(null); }}
        onPointerCancel={() => { dragRef.current = null; setDragging(null); }}
        onKeyDown={(event) => {
          const decrease = vertical ? 'ArrowLeft' : 'ArrowUp';
          const increase = vertical ? 'ArrowRight' : 'ArrowDown';
          if (![decrease, increase, 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') return resize(panel, minimum);
          if (event.key === 'End') return resize(panel, maximum);
          const delta = (event.key === increase ? 1 : -1) * (event.shiftKey ? 40 : 10);
          resize(panel, value + (panel === 'left' ? delta : -delta));
        }}>
        <span className="pointer-events-none rounded-full bg-white/[0.15] group-hover:bg-brand-main group-focus-visible:bg-brand-main" style={{ width: vertical ? 2 : 40, height: vertical ? 40 : 2, background: dragging === panel ? 'var(--color-brand-main)' : undefined }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="grid min-h-0 min-w-0 flex-1 overflow-hidden rounded-[12px]" style={{ gridTemplateColumns: `${left}px ${GAP}px minmax(0, 1fr) ${GAP}px ${right}px`, gridTemplateRows: `minmax(0, 1fr) ${GAP}px ${bottom}px`, userSelect: dragging ? 'none' : undefined }}>
      <div className="flex min-h-0 min-w-0 overflow-hidden">{assets}</div>
      {separator('left')}
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-200" style={{ pointerEvents: dragging ? 'none' : undefined }}>{preview}</div>
      {separator('right')}
      <div className="flex min-h-0 min-w-0 overflow-hidden">{properties}</div>
      {separator('bottom')}
      <div className="flex min-h-0 min-w-0 overflow-hidden" style={{ gridColumn: '1 / -1' }}>{timeline}</div>
    </div>
  );
}
