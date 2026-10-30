import { useEffect, useRef, useState } from 'react';
import DragHandleIcon from '../ui/DragHandleIcon';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { trackSwapBoundary } from '../../utils/TimelineTrackEditing';

export default function TrackDragHandle({ track }) {
  const cleanup = useRef(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => cleanup.current?.(), []);
  const start = event => {
    event.stopPropagation();
    if (event.button !== 0 || useCompositionEditorStore.getState().trackSettings[track]?.locked) return;
    event.preventDefault();
    setDragging(true);
    const root = event.currentTarget.closest('[data-timeline-root]');
    const rowsFor = name => [...(root?.querySelectorAll('[data-track-label], [data-drop-track]') || [])]
      .filter(row => (row.dataset.trackLabel || row.dataset.dropTrack) === name);
    const sourceRows = rowsFor(track);
    sourceRows.forEach(row => { row.style.backgroundColor = 'var(--color-tag-bg-blue)'; });
    let target = null;
    const line = document.createElement('div');
    Object.assign(line.style, { position: 'fixed', pointerEvents: 'none', height: '2px', borderRadius: '999px', background: 'var(--color-brand-main)', boxShadow: '0 0 8px var(--color-brand-main)', zIndex: '9999', display: 'none' });
    root.appendChild(line);
    const clear = () => { line.style.display = 'none'; };
    const move = e => {
      if (e.pointerId !== event.pointerId) return;
      clear();
      target = null;
      const bounds = root.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) return;
      const sourceRect = sourceRows[0].getBoundingClientRect();
      for (const row of root.querySelectorAll('[data-track-label]')) {
        const next = row.dataset.trackLabel;
        if (next === track || next[0] !== track[0] || useCompositionEditorStore.getState().trackSettings[next]?.locked) continue;
        const edge = trackSwapBoundary(sourceRect, row.getBoundingClientRect(), e.clientY);
        if (edge === null) continue;
        target = next;
        Object.assign(line.style, { display: 'block', left: bounds.left + 'px', width: bounds.width + 'px', top: (edge - 1) + 'px' });
        break;
      }
    };
    const stop = () => { cleanup.current?.(); setDragging(false); };
    const up = e => {
      if (e.pointerId !== event.pointerId) return;
      move(e);
      if (target && target !== track) {
        const targetRows = rowsFor(target);
        const offsets = sourceRows.map((row, i) => (targetRows[i]?.getBoundingClientRect().top ?? row.getBoundingClientRect().top) - row.getBoundingClientRect().top);
        useCompositionEditorStore.getState().swapTracks(track, target);
        requestAnimationFrame(() => {
          const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;
          sourceRows.forEach((row, i) => row.animate([{ transform: 'translateY(' + offsets[i] + 'px)', backgroundColor: 'var(--color-tag-bg-blue)' }, { transform: 'translateY(0px)', backgroundColor: 'transparent' }], { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)' }));
          targetRows.forEach((row, i) => row.animate([{ transform: 'translateY(' + (-offsets[i]) + 'px)', backgroundColor: 'var(--color-tag-bg-blue)' }, { transform: 'translateY(0px)', backgroundColor: 'transparent' }], { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)' }));
        });
      }
      stop();
    };
    const key = e => { if (e.key === 'Escape') stop(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', key);
    cleanup.current = () => {
      clear();
      line.remove();
      sourceRows.forEach(row => { row.style.backgroundColor = ''; });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      window.removeEventListener('keydown', key);
      cleanup.current = null;
    };
  };
  return <button type="button" aria-label={'拖动交换' + track + '轨道'} title="拖动交换同类型轨道" onPointerDown={start}
    className={'text-white-60 flex h-[20px] w-[16px] shrink-0 items-center justify-center border-0 bg-transparent p-0 touch-none ' + (dragging ? 'cursor-grabbing' : 'cursor-grab')}><DragHandleIcon color="currentColor" /></button>;
}
