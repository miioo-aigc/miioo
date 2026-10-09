/** 画布组合快捷键与成员选择；组内节点直接交互，拖拽权限沿用页面工具。 */
import { useCallback, useEffect } from 'react';
import { groupCanvasNodes, ungroupCanvasNodes, setCanvasSelection } from './CanvasGroups';

export function useCanvasGrouping(nodes, setNodes, cancelPendingClicks, enabled) {
  const enterNode = useCallback((nodeId) => {
    cancelPendingClicks();
    setNodes((current) => setCanvasSelection(current, [nodeId], true));
  }, [setNodes, cancelPendingClicks]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!enabled || event.defaultPrevented || event.isComposing || event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key === 'Escape') {
        cancelPendingClicks();
        setNodes((current) => setCanvasSelection(current, []));
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'g' || event.altKey) return;
      event.preventDefault();
      if (event.repeat) return;
      cancelPendingClicks();
      if (event.shiftKey) setNodes((current) => ungroupCanvasNodes(current));
      else {
        const id = `canvas-group-${crypto.randomUUID()}`;
        setNodes((current) => groupCanvasNodes(current, id));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setNodes, enabled, cancelPendingClicks]);

  return {
    enterNode,
    resolveSelectionId: (node) => node.id,
    nodes: nodes.map((node) => ({
      ...node,
      selectable: true,
      className: node.parentId ? 'canvas-group-member' : undefined,
    })),
  };
}
