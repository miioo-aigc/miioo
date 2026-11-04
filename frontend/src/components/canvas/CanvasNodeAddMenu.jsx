import { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';
import CanvasNodeIcon from './CanvasNodeIcon';
import { Upload, FolderOpen } from 'lucide-react';

export { CANVAS_NODE_MENU_ITEMS } from './CanvasNodeAddMenuConfig';

export default function CanvasNodeAddMenu({ onAddNode, items = CANVAS_NODE_MENU_ITEMS, onUpload, onSelectAssets }) {
  return <div className="canvas-node-add-menu" role="menu" aria-label="添加节点">
    {items.map((item) => <button key={item.value} type="button" role="menuitem" className="flex items-center gap-[6px]" onClick={() => onAddNode?.(item.value)}><CanvasNodeIcon nodeType={item.value} /><span>{item.label}</span></button>)}
    {(onUpload || onSelectAssets) && <>
      <div role="separator" className="my-[4px] border-t border-stroke-normal" />
      {onUpload && <button type="button" role="menuitem" className="flex items-center gap-[6px]" onClick={onUpload}><Upload size={16} /><span>本地上传</span></button>}
      {onSelectAssets && <button type="button" role="menuitem" className="flex items-center gap-[6px]" onClick={onSelectAssets}><FolderOpen size={16} /><span>从资产库选择</span></button>}
    </>}
  </div>;
}
