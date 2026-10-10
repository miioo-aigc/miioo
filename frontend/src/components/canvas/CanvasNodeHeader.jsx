import CanvasNodeIcon from './CanvasNodeIcon';
import CanvasEditableName from './CanvasEditableName';

export default function CanvasNodeHeader({ nodeType, title, onRename, onStart, zoom = 1 }) {
  return <div className="canvas-node__header-slot"><div className="canvas-node__header" style={{ '--canvas-header-zoom': zoom, '--canvas-header-inverse-zoom': 1 / zoom }}><CanvasNodeIcon nodeType={nodeType} /><CanvasEditableName name={title} onRename={onRename} onStart={onStart} /></div></div>;
}
