import { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';
import CanvasNodeIcon from './CanvasNodeIcon';

export { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';

export default function CanvasNodeAddMenu({ onAddNode, items = CANVAS_NODE_MENU_ITEMS }) {
  return <div className="canvas-node-add-menu" role="menu" aria-label="添加节点">
    {items.map((item) => <button key={item.value} type="button" role="menuitem" className="flex items-center gap-[6px]" onClick={() => onAddNode?.(item.value)}><CanvasNodeIcon nodeType={item.value} /><span>{item.label}</span></button>)}
  </div>;
}
