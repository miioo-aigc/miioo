import { useState } from 'react';
import { ReactFlow, PanOnScrollMode, useViewport } from '@xyflow/react';
import CanvasGridBackground from './CanvasGridBackground';
import SharedCanvasNode from './SharedCanvasNode';
import CanvasGroupNode from './CanvasGroupNode';
import { getSharedCanvasPresentation } from './SharedCanvasGroups';

function SharedGroupNode(props) {
  const { zoom } = useViewport();
  return <CanvasGroupNode {...props} data={{ ...props.data, viewportZoom: zoom, readOnly: true }} />;
}
const nodeTypes = { shared: SharedCanvasNode, canvasGroup: SharedGroupNode };

export default function SharedCanvasGraph({ graph }) {
  const [browsing, setBrowsing] = useState({ graph, toggled: [] });
  const toggled = browsing.graph === graph ? browsing.toggled : [];
  const presentation = getSharedCanvasPresentation(graph, toggled);
  return <ReactFlow nodes={presentation.nodes} edges={presentation.edges} nodeTypes={nodeTypes}
    nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
    elementsSelectable={false} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
    onNodeDoubleClick={(event, node) => {
      if (node.type !== 'canvasGroup' || event.target.closest('.react-flow__node')?.dataset.id !== node.id) return;
      event.stopPropagation();
      setBrowsing((current) => {
        const ids = current.graph === graph ? current.toggled : [];
        return { graph, toggled: ids.includes(node.id) ? ids.filter((id) => id !== node.id) : [...ids, node.id] };
      });
    }}
    panOnDrag panOnScroll panOnScrollMode={PanOnScrollMode.Free} panOnScrollSpeed={0.5}
    zoomOnDoubleClick={false} zoomOnPinch proOptions={{ hideAttribution: true }}
    fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.01} maxZoom={4} colorMode="dark" className="bg-surface-toolbar">
    <CanvasGridBackground />
  </ReactFlow>;
}
