import { useCallback, useEffect, useRef, useState } from 'react';
import { snapCanvasNodes } from './CanvasSnapping';
import { measureCanvasSnapFrames } from './CanvasSnapMeasurements';

export function useCanvasSnapping(canvasId, containerRef) {
  const previous = useRef({});
  const [display, setDisplay] = useState({ canvasId: null, guides: [] });
  const [enabled, setEnabled] = useState(false);
  const clear = useCallback(() => { previous.current = {}; setDisplay({ canvasId: null, guides: [] }); }, []);
  useEffect(() => {
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, [clear]);
  const apply = useCallback((nodes, ids, zoom) => {
    if (!enabled) return nodes;
    const result = snapCanvasNodes(nodes, ids, zoom, previous.current.canvasId === canvasId ? previous.current : {}, measureCanvasSnapFrames(containerRef.current));
    previous.current = { locks: result.locks, box: result.box, canvasId };
    setDisplay({ canvasId, guides: result.guides });
    return result.nodes;
  }, [canvasId, enabled, containerRef]);
  const toggle = useCallback((value) => { clear(); setEnabled(value); }, [clear]);
  return { enabled, toggle, guides: enabled && display.canvasId === canvasId ? display.guides : [], apply, clear };
}
