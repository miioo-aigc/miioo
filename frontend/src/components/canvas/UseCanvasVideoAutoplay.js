import { useEffect, useRef } from 'react';
import { hasBlockingDialog } from './CanvasModalGuard';

// 单击节点才允许鼠标选中自动播放；框选及拖动不触发，键盘选中仍可播放。
export function useCanvasVideoAutoplay(videoRef, containerRef, active, src, play, pause) {
  const gesture = useRef(null);
  const pending = useRef(false);
  const selectionAllowed = useRef(true);
  useEffect(() => {
    const start = () => {
      pending.current = false;
      if (hasBlockingDialog()) return;
      const video = videoRef.current;
      if (!video) return;
      if (!video.getAttribute('src')) { video.src = src; video.load(); }
      video.muted = false;
      void play({ automatic: true });
    };
    const down = (event) => {
      const node = containerRef.current?.closest('.react-flow__node');
      selectionAllowed.current = event.button === 0 && Boolean(node?.contains(event.target));
      pending.current = false;
      if (!selectionAllowed.current) { gesture.current = null; return; }
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    };
    const move = (event) => {
      const current = gesture.current;
      if (current?.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 3) {
        current.moved = true;
        selectionAllowed.current = false;
      }
    };
    const up = (event) => {
      if (gesture.current?.id !== event.pointerId) return;
      move(event);
      const moved = gesture.current.moved;
      gesture.current = null;
      if (pending.current && !moved && active) start();
      pending.current = false;
    };
    const cancel = () => { gesture.current = null; pending.current = false; selectionAllowed.current = false; };
    const keydown = () => { if (!gesture.current) selectionAllowed.current = true; };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('blur', cancel);
    if (!active) { pending.current = false; pause(); }
    else if (gesture.current) pending.current = true;
    else if (selectionAllowed.current) start();
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('blur', cancel);
    };
  }, [active, src, play, pause, videoRef, containerRef]);
}
