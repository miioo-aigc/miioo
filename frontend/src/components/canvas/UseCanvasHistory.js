import { useEffect, useState, useSyncExternalStore } from 'react';
import { createCanvasHistory } from './CanvasHistory';

export function useCanvasHistory(cancelPendingClicks, enabled) {
  const [history] = useState(() => createCanvasHistory());
  const state = useSyncExternalStore(history.subscribe, history.getSnapshot);
  useEffect(() => () => history.dispose(), [history]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!enabled || event.defaultPrevented || event.isComposing || event.altKey
        || event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.repeat) return;
      cancelPendingClicks();
      if (event.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, enabled, cancelPendingClicks]);
  return { ...state, ...history };
}
