import { useLayoutEffect, useRef } from 'react';
import { resizeSubtitleMask } from './SubtitleMaskGeometry';

const HANDLES = { n: '上边缘', e: '右边缘', s: '下边缘', w: '左边缘', nw: '左上角', ne: '右上角', se: '右下角', sw: '左下角' };

export default function SubtitleMask({ value, onChange, frameRef }) {
  const drag = useRef(null);
  const maskRef = useRef(null);
  const hintRef = useRef(null);

  useLayoutEffect(() => {
    const mask = maskRef.current;
    const hint = hintRef.current;
    const updateVisibility = () => {
      // Reserve space for the edge handles while measuring the unwrapped text.
      hint.style.visibility = mask.clientWidth >= hint.offsetWidth + 40
        && mask.clientHeight >= hint.offsetHeight + 32 ? 'visible' : 'hidden';
    };
    const observer = new ResizeObserver(updateVisibility);
    observer.observe(mask);
    observer.observe(hint);
    updateVisibility();
    return () => observer.disconnect();
  }, []);

  function begin(event, direction) {
    if (event.button !== 0 || drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    drag.current = { direction, value, frame, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    onChange(resizeSubtitleMask(start.value, start.direction,
      (event.clientX - start.x) / start.frame.width,
      (event.clientY - start.y) / start.frame.height));
  }

  function end(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyResize(event, direction) {
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!deltas[event.key]) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 0.02 : 0.005;
    const [dx, dy] = deltas[event.key];
    onChange(resizeSubtitleMask(value, direction, dx * step, dy * step));
  }

  return <div ref={maskRef} className="subtitle-mask" aria-label="字幕处理区域" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.width * 100}%`, height: `${value.height * 100}%` }}>
    <div ref={hintRef} className="subtitle-mask-hint">调整遮罩形状以覆盖字幕区域</div>
    {Object.entries(HANDLES).map(([direction, label]) => <button
      key={direction} type="button" className={`subtitle-handle subtitle-handle-${direction}`}
      aria-label={`调整字幕遮罩${label}`} title={`调整${label}`}
      onPointerDown={(event) => begin(event, direction)} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onKeyDown={(event) => keyResize(event, direction)} onClick={(event) => event.stopPropagation()}
    ><span /></button>)}
  </div>;
}
