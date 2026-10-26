import { useEffect, useRef, useState } from 'react';
import { framePointerPosition } from './FramePointer';

/** 连续真实帧，滚动只浏览；只挂载可视范围附近的缩略图。 */
export default function VideoFrameTimeline({ times, index, dimensions, thumbnails, requestThumbnails, disabled, onSelect }) {
  const viewport = useRef(null);
  const pointerSelection = useRef(null);
  const [pointer, setPointer] = useState(null);
  const [view, setView] = useState({ left: 0, width: 0 });
  const frameWidth = 58 * (dimensions ? dimensions.width / dimensions.height : 16 / 9);
  const first = Math.max(0, Math.floor(view.left / frameWidth) - 3);
  const last = Math.min(times.length, Math.ceil((view.left + view.width) / frameWidth) + 3);
  useEffect(() => {
    const node = viewport.current;
    const update = () => setView({ left: node.scrollLeft, width: node.clientWidth });
    const wheel = event => {
      if (event.ctrlKey) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      if (node.scrollWidth > node.clientWidth) { event.preventDefault(); node.scrollLeft += delta * scale; }
    };
    const keyboard = event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      pointerSelection.current = null;
      setPointer(null);
    };
    window.addEventListener('keydown', keyboard, true);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener('scroll', update);
    node.addEventListener('wheel', wheel, { passive: false });
    update();
    return () => { window.removeEventListener('keydown', keyboard, true); observer.disconnect(); node.removeEventListener('scroll', update); node.removeEventListener('wheel', wheel); };
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (pointerSelection.current === index) return;
    const left = index * frameWidth;
    if (left < node.scrollLeft) node.scrollLeft = left;
    else if (left + frameWidth > node.scrollLeft + node.clientWidth) node.scrollLeft = left + frameWidth - node.clientWidth;
  }, [index, frameWidth]);
  useEffect(() => {
    if (dimensions && last > first) requestThumbnails(Array.from({ length: last - first }, (_, offset) => first + offset));
  }, [first, last, dimensions, requestThumbnails]);
  const selectAt = event => {
    if (disabled || !times.length) return;
    const node = viewport.current;
    const selected = framePointerPosition(event.clientX, node.getBoundingClientRect(), node.offsetWidth, node.clientLeft, node.scrollLeft, frameWidth, times.length);
    pointerSelection.current = selected.index;
    setPointer({ index: selected.index, offset: selected.position / frameWidth });
    onSelect(selected.index);
  };
  return <div ref={viewport} className="frame-filmstrip" role="slider" tabIndex={0} aria-label="选帧时间轴"
    aria-valuemin={1} aria-valuemax={Math.max(1, times.length)} aria-valuenow={index + 1} aria-disabled={disabled}
    aria-valuetext={'第 ' + (index + 1) + ' 帧'}
    onPointerDown={event => { if (event.button !== 0 || disabled) return; event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); selectAt(event); }}
    onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) selectAt(event); }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
    <div className="frame-filmstrip-content" style={{ width: Math.max(view.width, times.length * frameWidth) }}>
      {Array.from({ length: last - first }, (_, offset) => {
        const frame = first + offset;
        return <div key={frame} className="frame-filmstrip-cell" style={{ left: frame * frameWidth, width: frameWidth }}>
          {thumbnails[frame] ? <img src={thumbnails[frame]} alt="" draggable={false} /> : <span>{frame + 1}</span>}
        </div>;
      })}
      {times.length > 0 && <div className="frame-playhead" style={{ left: (pointer?.index === index ? pointer.offset : index + 0.5) * frameWidth }} />}
    </div>
  </div>;
}
