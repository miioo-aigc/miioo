import CanvasNodeIcon from './CanvasNodeIcon';

export default function CanvasNodeHeader({ nodeType, title }) {
  return <div className="canvas-node__header"><CanvasNodeIcon nodeType={nodeType} /><span>{title}</span></div>;
}
