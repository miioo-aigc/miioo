import { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';

export { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';

export default function CanvasNodeAddMenu({ onAddNode, items = CANVAS_NODE_MENU_ITEMS }) {
  return <div className="canvas-node-add-menu" role="menu" aria-label="添加节点">
    {items.map((item) => <button key={item.value} type="button" role="menuitem" onClick={() => onAddNode?.(item.value)}>{item.label}</button>)}
  </div>;
}
