import { useEffect, useRef, useState } from 'react';

export default function CanvasCreationPresence({ open, children }) {
  const [present, setPresent] = useState(open);
  const elementRef = useRef(null);
  if (open && !present) setPresent(true);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let cancelled = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const current = getComputedStyle(element);
    const start = { transform: current.transform, opacity: current.opacity };
    const frames = open
      ? [start, { transform: 'scale(1.05)', opacity: 1, offset: 0.72 }, { transform: 'scale(1)', opacity: 1 }]
      : [start, { transform: 'scale(1.015)', opacity: 1, offset: 0.18 }, { transform: 'scale(0.3)', opacity: 0 }];
    const animation = element.animate(frames, {
      duration: reduced ? 0 : open ? 300 : 200,
      easing: 'ease-out',
      fill: 'forwards',
    });
    animation.finished.then(() => {
      if (!cancelled && !open) setPresent(false);
    }).catch(() => {});
    return () => {
      cancelled = true;
      // 保留当前帧，让快速反向切换从当前位置继续。
      if (element.isConnected) animation.commitStyles();
      animation.cancel();
    };
  }, [open, present]);

  if (!present) return null;
  return <div className="canvas-creation-presence" ref={elementRef} inert={!open} aria-hidden={!open}>
    {children}
  </div>;
}
