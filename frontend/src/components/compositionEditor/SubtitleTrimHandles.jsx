import { useRef } from 'react';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

export default function SubtitleTrimHandles({ segment, zoom }) {
  const drag = useRef(null);
  const finish = (cancel) => {
    if (!drag.current) return;
    if (cancel) useCompositionEditorStore.setState({ segments: drag.current.before.segments });
    else useCompositionEditorStore.getState().commitVisualSegment(segment.id, drag.current.before);
    drag.current = null;
  };
  return ['left', 'right'].map((side) => <button key={side} type="button" aria-label={side === 'left' ? '调整字幕开始时间' : '调整字幕结束时间'}
    className={`absolute bottom-0 top-0 z-30 w-[6px] cursor-ew-resize touch-none bg-brand-main/40 ${side === 'left' ? 'left-0' : 'right-0'}`}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      event.stopPropagation();
      const store = useCompositionEditorStore.getState();
      store.pause();
      drag.current = { before: { segments: store.segments, selectedId: segment.id }, x: event.clientX, segment };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      if (!drag.current) return;
      const original = drag.current.segment;
      const delta = (event.clientX - drag.current.x) / zoom;
      const start = side === 'left' ? Math.max(0, Math.min(original.start + original.duration - 0.01, original.start + delta)) : original.start;
      const end = side === 'right' ? Math.max(start + 0.01, original.start + original.duration + delta) : original.start + original.duration;
      useCompositionEditorStore.getState().previewSubtitle(segment.id, { start, duration: end - start }, drag.current.before);
    }} onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)} />);
}
