import { useEffect, useState } from 'react';
import { getCanvasSearchFocus, revealCanvasSearchNode } from './CanvasSearch.js';

export function useCanvasSearch({ nodes, setNodes, flowInstance, containerRef, cancelPendingClicks, open, setOpen }) {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    if (!target || !flowInstance) return;
    const frame = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      const focus = rect && getCanvasSearchFocus(nodes, target.id, rect, flowInstance.getZoom(), { resetZoom: target.resetZoom });
      if (focus) flowInstance.setCenter(focus.x, focus.y, { zoom: focus.zoom, duration: 300 });
      setTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, nodes, flowInstance, containerRef]);
  const locate = (id, { resetZoom = true } = {}) => {
    cancelPendingClicks();
    setNodes((current) => revealCanvasSearchNode(current, id));
    setTarget({ id, resetZoom });
  };
  return {
    open,
    show: () => { cancelPendingClicks(); setOpen(true); },
    close: () => setOpen(false),
    locate,
    select: (id) => { locate(id, { resetZoom: false }); setOpen(false); },
  };
}
