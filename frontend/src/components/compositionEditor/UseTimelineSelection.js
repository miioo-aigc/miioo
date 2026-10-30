import { useEffect, useRef, useState } from 'react';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';
import { intersectsSelection, selectionIds } from './TimelineSelection';

export default function useTimelineSelection(scrollRef) {
  const [box, setBox] = useState(null);
  const [menu, setMenu] = useState(null);
  const cleanup = useRef(null);
  const suppress = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  const modified = (event) => event.ctrlKey || event.metaKey || event.shiftKey;
  const toggle = (event, id) => {
    if (!modified(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    const state = useCompositionEditorStore.getState();
    const ids = selectionIds(state);
    state.selectMany(ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
    return true;
  };
  const openMenu = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    const state = useCompositionEditorStore.getState();
    if (!selectionIds(state).includes(id)) state.selectMany([id]);
    setMenu({ x: event.clientX, y: event.clientY });
  };
  const startBox = (event) => {
    suppress.current = false;
    if (event.button !== 0 || event.target.closest('[data-clip-id],button,[role="menu"]')) return;
    const container = scrollRef.current;
    const content = container?.firstElementChild;
    if (!content || event.clientY < content.getBoundingClientRect().top + 26) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    setMenu(null);
    const before = selectionIds(useCompositionEditorStore.getState());
    const base = modified(event) ? before : [];
    const point = (e) => {
      const rect = content.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const origin = point(event);
    let moved = false;
    content.setAttribute('data-timeline-dragging', 'true');
    const move = (e) => {
      if (e.pointerId !== event.pointerId) return;
      const end = point(e);
      if (!moved && Math.hypot(end.x - origin.x, end.y - origin.y) < 3) return;
      moved = true;
      const rect = { left: Math.min(origin.x, end.x), top: Math.min(origin.y, end.y), right: Math.max(origin.x, end.x), bottom: Math.max(origin.y, end.y) };
      setBox(rect);
      const parent = content.getBoundingClientRect();
      const hits = [...content.querySelectorAll('[data-clip-id][data-box-selectable="true"]')].filter((element) => {
        const r = element.getBoundingClientRect();
        return intersectsSelection(rect, { left: r.left - parent.left, right: r.right - parent.left, top: r.top - parent.top, bottom: r.bottom - parent.top });
      }).map((element) => element.dataset.clipId);
      useCompositionEditorStore.getState().selectMany([...base, ...hits]);
    };
    const finish = (cancelled) => {
      if (cancelled) useCompositionEditorStore.getState().selectMany(before);
      else if (!moved) useCompositionEditorStore.getState().selectMany(base);
      suppress.current = true;
      setBox(null);
      cleanup.current?.();
    };
    const up = (e) => { if (e.pointerId === event.pointerId) { move(e); finish(false); } };
    const cancel = (e) => { e.preventDefault(); finish(true); };
    const key = (e) => { if (e.key === 'Escape') cancel(e); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('timeline:cancel-drag', cancel);
    window.addEventListener('keydown', key);
    cleanup.current = () => {
      content.removeAttribute('data-timeline-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('timeline:cancel-drag', cancel);
      window.removeEventListener('keydown', key);
      cleanup.current = null;
    };
  };
  const captureClick = (event) => {
    if (suppress.current) { suppress.current = false; event.stopPropagation(); }
  };
  return { box, menu, setMenu, toggle, modified, openMenu, startBox, captureClick };
}
