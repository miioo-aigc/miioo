import CanvasNodeIcon from './CanvasNodeIcon';
import CanvasEditableName from './CanvasEditableName';

// selectOnClick 打开时，非编辑态单击冒泡到 React Flow 节点层；分享页没有选中态，保持默认拦截。
export default function CanvasNodeHeader({ nodeType, title, onRename, onStart, zoom = 1, selectOnClick = false, upstreamUpdated = false }) {
  return <div className="canvas-node__header-slot"><div className="canvas-node__header" style={{ '--canvas-header-zoom': zoom, '--canvas-header-inverse-zoom': 1 / zoom }}><CanvasNodeIcon nodeType={nodeType} /><CanvasEditableName name={title} onRename={onRename} onStart={onStart} selectOnClick={selectOnClick} />{upstreamUpdated && <span role="status" className="canvas-node__header-updated">上游已更新</span>}</div></div>;
}
