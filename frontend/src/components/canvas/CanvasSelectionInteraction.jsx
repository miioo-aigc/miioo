/** 多选范围框与修饰键点击；只同步选择，不参与节点内容编辑和业务动作。 */
import { useLayoutEffect } from 'react';
import { useStore, useStoreApi } from '@xyflow/react';
import { changeCanvasSelection, canvasSelectionMode } from './CanvasSelection';

export default function CanvasSelectionInteraction({ enabled, setNodes, cancelPendingClicks }) {
  const store = useStoreApi();
  const root = useStore((state) => state.domNode);
  useLayoutEffect(() => {
    if (!root) return;
    let disposed = false;
    let queued = false;
    const sync = () => {
      queued = false;
      if (disposed) return;
      const state = store.getState();
      const active = !state.userSelectionActive && state.nodes.filter((node) => node.selected && !node.hidden).length > 1;
      if (state.nodesSelectionActive !== active) store.setState({ nodesSelectionActive: active });
    };
    const unsubscribe = store.subscribe(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(sync);
    });
    sync();
    const updateModifier = (event) => {
      root.classList.toggle('canvas-selection-modifying', enabled && Boolean(canvasSelectionMode(event)));
    };
    const clearModifier = () => root.classList.remove('canvas-selection-modifying');
    const capture = (event) => {
      if (!enabled || event.button !== 0 || !canvasSelectionMode(event)) return;
      if (event.target.closest('button, input, textarea, select, [contenteditable="true"], .canvas-creation-panel, .react-flow__handle, .canvas-node__port-hit-area')) return;
      const element = event.target.closest('.react-flow__node');
      if (!element || !root.contains(element)) return;
      const id = element.dataset.id;
      if (!store.getState().nodeLookup.has(id)) return;
      // 在 React Flow 的指针选择和 D3 拖动之前截获，避免默认切换选中状态。
      event.stopPropagation();
      if (event.type !== 'click') return;
      event.preventDefault();
      cancelPendingClicks();
      const mode = canvasSelectionMode(event);
      setNodes((nodes) => changeCanvasSelection(nodes, id, mode), { record: false });
    };
    for (const name of ['pointerdown', 'mousedown', 'click', 'dblclick']) root.addEventListener(name, capture, true);
    window.addEventListener('keydown', updateModifier);
    window.addEventListener('keyup', updateModifier);
    window.addEventListener('blur', clearModifier);
    return () => {
      disposed = true;
      unsubscribe();
      clearModifier();
      for (const name of ['pointerdown', 'mousedown', 'click', 'dblclick']) root.removeEventListener(name, capture, true);
      window.removeEventListener('keydown', updateModifier);
      window.removeEventListener('keyup', updateModifier);
      window.removeEventListener('blur', clearModifier);
    };
  }, [store, root, enabled, setNodes, cancelPendingClicks]);
  return null;
}
