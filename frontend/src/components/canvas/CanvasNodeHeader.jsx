import CanvasNodeIcon from './CanvasNodeIcon';
import CanvasEditableName from './CanvasEditableName';
import { useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../ui';

// selectOnClick 打开时，非编辑态单击冒泡到 React Flow 节点层；分享页没有选中态，保持默认拦截。
export default function CanvasNodeHeader({ nodeType, title, onRename, onStart, selectOnClick = false, upstreamUpdated = false, upstreamUpdateKey = '' }) {
  const [dismissedKey, setDismissedKey] = useState(null);
  return <div className="canvas-node__header-slot"><div className="canvas-node__header"><CanvasNodeIcon nodeType={nodeType} /><CanvasEditableName name={title} onRename={onRename} onStart={onStart} selectOnClick={selectOnClick} />{upstreamUpdated && dismissedKey !== upstreamUpdateKey && <span role="status" className="canvas-node__header-updated">上游已更新
    <IconButton aria-label="关闭上游已更新提示" variant="link" className="canvas-node__dismiss-updated nodrag nopan"
      onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); setDismissedKey(upstreamUpdateKey); }}><X size={12} strokeWidth={1.5} /></IconButton>
  </span>}</div></div>;
}
