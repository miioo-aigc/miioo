import { setCanvasSelection } from './CanvasGroups.js';

/** 同时按下时减选优先；普通点击不进入修饰键选择。 */
export function canvasSelectionMode(event) {
  return event.ctrlKey || event.metaKey ? 'remove' : event.shiftKey ? 'add' : null;
}

export function changeCanvasSelection(nodes, id, mode) {
  if (!mode || !nodes.some((node) => node.id === id)) return nodes;
  const ids = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
  if (mode === 'remove') ids.delete(id);
  else ids.add(id);
  return setCanvasSelection(nodes, [...ids]);
}
