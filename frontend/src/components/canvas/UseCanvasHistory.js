import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createCanvasHistory } from './CanvasHistory';
import { guardCanvasNodeUpdate, guardCanvasSystemUpdate } from './CanvasOperationGuards.js';

export function useCanvasHistory(cancelPendingClicks, enabled) {
  const [history] = useState(() => createCanvasHistory());
  const state = useSyncExternalStore(history.subscribe, history.getSnapshot);
  const setNodes = useCallback((update, options = {}) => {
    let accepted = false;
    history.setNodes((current) => {
    const next = typeof update === 'function' ? update(current) : update;
    const origin = options.origin || 'user';
    const guarded = origin === 'system' ? guardCanvasSystemUpdate(current, next)
      : guardCanvasNodeUpdate(current, next, { origin });
    accepted = guarded !== current;
    return guarded;
    }, options);
    return accepted;
  }, [history]);
  const getCurrentNodes = useCallback(() => history.getSnapshot().nodes, [history]);
  const undo = useCallback(() => {
    return history.undo((current, proposed) => guardCanvasNodeUpdate(current, proposed));
  }, [history]);
  const redo = useCallback(() => {
    return history.redo((current, proposed) => guardCanvasNodeUpdate(current, proposed));
  }, [history]);
  useEffect(() => () => history.dispose(), [history]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!enabled || event.defaultPrevented || event.isComposing || event.altKey
        || event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.repeat) return;
      cancelPendingClicks();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, enabled, cancelPendingClicks, undo, redo]);
  return { ...state, ...history, setNodes, undo, redo, getCurrentNodes };
}
