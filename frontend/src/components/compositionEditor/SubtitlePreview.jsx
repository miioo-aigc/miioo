import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SUBTITLE_STYLE, subtitleColorWithOpacity } from '../../utils/SubtitleImport';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

export default function SubtitlePreview({ cues }) {
  const container = useRef(null);
  const drag = useRef(null);
  const [height, setHeight] = useState(400);
  const selectedId = useCompositionEditorStore((state) => state.selectedId);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const finish = (cancel = false) => {
    if (!drag.current) return;
    if (cancel) useCompositionEditorStore.setState({ segments: drag.current.before.segments });
    else useCompositionEditorStore.getState().commitVisualSegment(drag.current.id, drag.current.before);
    drag.current = null;
  };
  return <div ref={container} className="pointer-events-none absolute inset-0 overflow-hidden">
    {[...cues].reverse().map(({ seg }) => {
      const style = { ...DEFAULT_SUBTITLE_STYLE, ...seg.style };
      const scale = height / 1080;
      return <div key={seg.id} className={`pointer-events-auto absolute max-w-[90%] touch-none whitespace-pre-wrap break-words ${selectedId === seg.id ? 'outline outline-1 outline-brand-main' : ''}`}
        style={{ left: `${style.x}%`, top: `${style.y}%`, width: 'max-content', transform: 'translate(-50%, -50%)',
          color: subtitleColorWithOpacity(style.color, style.textOpacity), fontFamily: style.fontFamily, fontSize: style.fontSize * scale, lineHeight: 1.3, textAlign: style.align,
          WebkitTextStroke: `${(style.outlineOn === false ? 0 : style.outline) * scale}px ${subtitleColorWithOpacity(style.outlineColor, style.outlineOpacity)}`, paintOrder: 'stroke fill', background: style.backgroundOn ? subtitleColorWithOpacity(style.background, style.backgroundOpacity) : 'transparent', cursor: 'move' }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const store = useCompositionEditorStore.getState();
          store.select(seg.id); store.pause();
          drag.current = { id: seg.id, before: { segments: store.segments, selectedId: seg.id }, x: event.clientX, y: event.clientY, style };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const rect = container.current.getBoundingClientRect();
          const start = drag.current;
          useCompositionEditorStore.getState().previewSubtitle(seg.id, { style: {
            x: Math.max(0, Math.min(100, start.style.x + (event.clientX - start.x) / rect.width * 100)),
            y: Math.max(0, Math.min(100, start.style.y + (event.clientY - start.y) / rect.height * 100)),
          } });
        }} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}>{seg.text}</div>;
    })}
  </div>;
}
