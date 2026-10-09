import CanvasNodeIcon from './CanvasNodeIcon';
import CanvasEditableName from './CanvasEditableName';

export default function CanvasNodeHeader({ nodeType, title, onRename, onStart }) {
  return <div className="canvas-node__header"><CanvasNodeIcon nodeType={nodeType} /><CanvasEditableName name={title} onRename={onRename} onStart={onStart} /></div>;
}
