/** 菜单与快捷键共用动作入口；弹窗状态隔离画布快捷键。 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { groupCanvasNodes, setCanvasSelection, ungroupCanvasNodes } from './CanvasGroups';
import { copyCanvasNodes, pasteCanvasNodes, deleteCanvasNodes, moveCanvasNodesOut, setCanvasGroupsStacked } from './CanvasNodeActions';
import { getCanvasGroupFocus } from './CanvasGroupFocus';
import { canMoveCanvasNodesInto, canvasTransferRoots, moveCanvasNodesInto } from './CanvasGroupTransfer';
import { showGlobalToast } from '../../stores/toastStore';

export function useCanvasNodeActions({ nodes, setNodes, enabled, cancelPendingClicks, flowInstance, containerRef, dialog, setDialog }) {
  const [menu, setMenu] = useState(null);
  const [clipboard, setClipboard] = useState([]);
  const pasteCount = useRef(0);
  const [focusGroupId, setFocusGroupId] = useState(null);
  useEffect(() => {
    if (!focusGroupId || !flowInstance) return;
    const frame = requestAnimationFrame(() => {
      const group = nodes.find((node) => node.id === focusGroupId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (group && !group.data.stacked && rect) {
        const focus = getCanvasGroupFocus(nodes, group, rect, flowInstance.getZoom());
        flowInstance.setCenter(focus.x, focus.y, { zoom: focus.zoom, duration: 300 });
      }
      setFocusGroupId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusGroupId, flowInstance, nodes, containerRef]);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeDialog = useCallback(() => setDialog(null), [setDialog]);

  const execute = useCallback((action, targetId) => {
    cancelPendingClicks();
    const selected = nodes.filter((node) => node.selected);
    const ids = selected.map((node) => node.id);
    if (action === 'moveInto' && canMoveCanvasNodesInto(nodes, ids, targetId)) {
      const target = nodes.find((node) => node.id === targetId);
      const moved = canvasTransferRoots(nodes, ids).filter((node) => node.parentId !== targetId);
      setNodes((current) => moveCanvasNodesInto(current, ids, targetId));
      const label = moved.length === 1 ? moved[0].data.label : `${moved[0].data.label}等${moved.length}项`;
      showGlobalToast(`${label}已经移入${target.data.label}`, 'success');
    }
    if (action === 'copy') { setClipboard(copyCanvasNodes(nodes)); pasteCount.current = 0; }
    if (action === 'paste' || action === 'duplicate') {
      const contents = action === 'duplicate' ? copyCanvasNodes(nodes) : clipboard;
      const roots = contents.filter((node) => !node.parentId);
      if (roots.length) {
        const offset = 32 * (action === 'duplicate' ? 1 : ++pasteCount.current);
        const rect = containerRef.current?.getBoundingClientRect();
        const point = menu ? { x: menu.x, y: menu.y } : rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
        const position = action === 'paste' && point && flowInstance
          ? flowInstance.screenToFlowPosition(point)
          : { x: Math.min(...roots.map((node) => node.position.x)) + offset, y: Math.min(...roots.map((node) => node.position.y)) + offset };
        if (action === 'paste' && !menu) { position.x += offset; position.y += offset; }
        setNodes((current) => pasteCanvasNodes(current, contents, position));
      }
    }
    if (action === 'group') setNodes((current) => groupCanvasNodes(current, `canvas-group-${crypto.randomUUID()}`));
    if (action === 'ungroup') setNodes(ungroupCanvasNodes);
    if (action === 'stack' || action === 'unstack') setNodes((current) => setCanvasGroupsStacked(current, ids, action === 'stack'));
    if (action === 'unstack') setFocusGroupId(selected.find((node) => node.type === 'canvasGroup')?.id || null);
    if (action === 'moveOut') {
      const messages = selected.flatMap((node) => {
        const parent = nodes.find((group) => group.id === node.parentId);
        return parent ? [`${node.data.label}已经移出${parent.data.label}`] : [];
      });
      setNodes((current) => moveCanvasNodesOut(current, ids));
      if (messages.length) showGlobalToast(messages.join('；'), 'success');
    }
    if (action === 'rename' && selected.length === 1) setDialog({ type: 'rename', ids, value: selected[0].data.label });
    if (action === 'delete' && ids.length) setDialog({ type: 'delete', ids, group: selected.some((node) => node.type === 'canvasGroup') });
    setMenu(null);
  }, [cancelPendingClicks, nodes, clipboard, containerRef, menu, flowInstance, setNodes, setDialog]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!enabled || event.defaultPrevented || event.isComposing || event.repeat) return;
      if (dialog) {
        if (event.key === 'Escape') { event.preventDefault(); setDialog(null); }
        return;
      }
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') { closeMenu(); cancelPendingClicks(); setNodes((current) => setCanvasSelection(current, []), { record: false }); return; }
      let action;
      if (event.metaKey || event.ctrlKey) {
        if (key === 'g') action = event.altKey ? (event.shiftKey ? 'unstack' : 'stack') : (event.shiftKey ? 'ungroup' : 'group');
        else if (!event.altKey && !event.shiftKey) action = { c: 'copy', d: 'duplicate', v: 'paste', r: 'rename' }[key];
        // macOS 的 Option+G 会改变 event.key，使用物理键码识别。
        if (event.altKey && event.code === 'KeyG') action = event.shiftKey ? 'unstack' : 'stack';
      } else if (!event.altKey && ['Backspace', 'Delete'].includes(event.key)) action = 'delete';
      if (!action) return;
      event.preventDefault();
      execute(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, dialog, execute, setDialog, closeMenu, cancelPendingClicks, setNodes]);

  return {
    menu, dialog, clipboard, execute, closeMenu, closeDialog,
    onGroupDoubleClick: (event, node) => {
      if (!enabled || dialog || event.target.closest('button, input, textarea, [contenteditable="true"], .react-flow__handle')) return;
      if (!node.data.stacked && !event.target.classList.contains('canvas-group')) return;
      event.stopPropagation();
      cancelPendingClicks();
      setMenu(null);
      setNodes((current) => setCanvasSelection(setCanvasGroupsStacked(current, [node.id], !node.data.stacked), [node.id]));
      if (node.data.stacked) setFocusGroupId(node.id);
    },
    setName: (value) => setDialog((current) => ({ ...current, value })),
    onContextMenu: (event, node) => {
      if (!enabled || dialog || event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      cancelPendingClicks();
      if (!node.selected) setNodes((current) => setCanvasSelection(current, [node.id]), { record: false });
      setMenu({ id: node.id, x: event.clientX, y: event.clientY });
    },
    confirm: () => {
      if (!dialog) return;
      if (dialog.type === 'delete') setNodes((current) => deleteCanvasNodes(current, dialog.ids));
      else if (dialog.value.trim()) setNodes((current) => current.map((node) => dialog.ids.includes(node.id)
        ? { ...node, data: { ...node.data, label: dialog.value.trim() } } : node));
      setDialog(null);
    },
  };
}
