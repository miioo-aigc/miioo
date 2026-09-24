import CanvasCreationPanel from './CanvasCreationPanel';
import CanvasCreationPresence from './CanvasCreationPresence';
import CanvasNodeHeader from './CanvasNodeHeader';
import CanvasNodePorts from './CanvasNodePorts';
import './canvas-nodes.css';

export default function CanvasNodeShell({ nodeType, title, selected = false, data, children, onPromptChange, onAddReference, onGenerate }) {
  const creationOpen = Boolean(selected && data?.creationPanelOpen && !data?.editing);
  return <div className={`canvas-node ${selected ? 'canvas-node--selected' : ''}`} data-node-type={nodeType}>
    <CanvasNodeHeader nodeType={nodeType} title={title} />
    <div className="canvas-node__frame" data-state={data?.editing ? 'editing' : 'default'} data-dragging={data?.dragging ? 'true' : 'false'} data-drag-release={data?.dragRelease ? 'true' : 'false'} style={{ '--canvas-drag-scale-x': data?.dragScaleX || 1, '--canvas-drag-scale-y': data?.dragScaleY || 1 }}>
      <CanvasNodePorts ports={data?.ports} />
      {children}
    </div>
    <CanvasCreationPresence open={creationOpen}><CanvasCreationPanel
      nodeId={data?.nodeId}
      nodeType={nodeType}
      prompt={data?.prompt}
      references={data?.references}
      onPromptChange={(value) => onPromptChange?.(data?.nodeId, value)}
      onAddReference={() => onAddReference?.(data?.nodeId)}
      onGenerate={(payload) => onGenerate?.(payload)}
    /></CanvasCreationPresence>
  </div>;
}
