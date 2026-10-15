import { useEffect } from 'react';
import { computeVisualWindows, computeAudioWindows, computeSubtitleWindows, useCompositionEditorStore } from '../../stores/compositionEditorStore';

export function timelineShortcut(event) {
  if (event.isComposing || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (event.shiftKey) return null;
    return { a: 'selectAll', s: 'save', b: 'splitSelected', y: 'redo' }[key] || null;
  }
  if (event.shiftKey && !['+', '='].includes(key)) return null;
  return { ' ': 'togglePlay', c: 'splitSelected', q: 'trimLeft', w: 'trimRight', delete: 'deleteSelected', backspace: 'deleteSelected', escape: 'clearSelection', '=': 'zoomIn', '+': 'zoomIn', '-': 'zoomOut', arrowup: 'previous', arrowdown: 'next' }[key] || null;
}

export function blocksTimelineShortcut(event, root = document) {
  return Boolean(event.defaultPrevented
    || event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
    || root.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"], dialog[open], [role="menu"]'));
}

const trackOf = (segment) => segment.track || (segment.type === 'audio' ? 'A1' : segment.type === 'subtitle' ? 'S1' : 'V1');

export default function useTimelineShortcuts(showToast) {
  useEffect(() => {
    const handle = (event) => {
      if (blocksTimelineShortcut(event)) return;
      const state = useCompositionEditorStore.getState();
      if (!state.loaded) return;
      const action = timelineShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (event.repeat) return;
      if (action === 'clearSelection') {
        const cancel = new Event('timeline:cancel-drag', { cancelable: true });
        window.dispatchEvent(cancel);
        if (!cancel.defaultPrevented) state.select(null);
        return;
      }
      if (document.querySelector('[data-timeline-dragging="true"]')) return;
      if (action === 'save') { void state.save().catch((error) => showToast?.(error.message, 'error')); return; }
      if (action === 'togglePlay') { if (state.playing) state.pause(); else state.play(); return; }
      if (action === 'zoomIn' || action === 'zoomOut') { state.setZoom(state.zoom * (action === 'zoomIn' ? 1.25 : 0.8)); return; }
      if (action === 'trimLeft' || action === 'trimRight') { state.trimSelected(action === 'trimLeft' ? 'left' : 'right'); return; }
      if (action === 'previous' || action === 'next') {
        const selected = state.segments.find((segment) => segment.id === state.selectedId);
        if (!selected) return;
        const windows = [...computeVisualWindows(state.segments).windows, ...computeAudioWindows(state.segments).windows, ...computeSubtitleWindows(state.segments).windows];
        const edges = [...new Set(windows.filter(({ seg }) => trackOf(seg) === trackOf(selected)).flatMap(({ start, end }) => [start, end]))].sort((a, b) => a - b);
        const target = action === 'previous' ? edges.filter((value) => value < state.cursor - 0.000001).at(-1) : edges.find((value) => value > state.cursor + 0.000001);
        if (target != null) { state.pause(); state.seek(target); }
        return;
      }
      state[action]?.();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [showToast]);
}
