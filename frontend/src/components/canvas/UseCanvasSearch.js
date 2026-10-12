import { useEffect, useState } from 'react';
import { getCanvasSearchFocus, revealCanvasSearchNode } from './CanvasSearch.js';

export function useCanvasSearch({ nodes, setNodes, flowInstance, containerRef, cancelPendingClicks, open, setOpen }) {
  const [targetId, setTargetId] = useState(null);
  useEffect(() => {
    if (!targetId || !flowInstance) return;
    const frame = requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect();
      const focus = rect && getCanvasSearchFocus(nodes, targetId, rect, flowInstance.getZoom());
      if (focus) flowInstance.setCenter(focus.x, focus.y, { zoom: focus.zoom, duration: 300 });
      setTargetId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetId, nodes, flowInstance, containerRef]);
  return {
    open,
    show: () => { cancelPendingClicks(); setOpen(true); },
    close: () => setOpen(false),
    select: (id) => {
      cancelPendingClicks();
      setNodes((current) => revealCanvasSearchNode(current, id));
      setTargetId(id);
      setOpen(false);
    },
  };
}
