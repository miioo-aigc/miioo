import { Handle, Position } from '@xyflow/react';
import { useState } from 'react';
import { getCanvasPortClassName } from './CanvasNodePortState';

// 端口自身维护悬停态，页面只负责提供跨节点连线期间的激活态。
function Port({ type, id, position, connecting = false, nodeActive = false, onUpstreamConnectStart }) {
  const [hovered, setHovered] = useState(false);
  return <Handle
    type={type}
    id={id}
    position={position}
    className={`${getCanvasPortClassName({ portHovered: hovered, connecting, nodeActive })} canvas-node__port-anchor`}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
  ><span
    className="canvas-node__port-hit-area"
    aria-hidden="true"
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}
    onPointerDown={type === 'target' ? (event) => {
      event.preventDefault();
      event.stopPropagation();
      onUpstreamConnectStart?.(event);
    } : undefined}
  /></Handle>;
}

export default function CanvasNodePorts({ ports, connectingType = '', nodeActive = false, onUpstreamConnectStart }) {
  return <>
    <Port type="target" id={ports?.input?.id} position={Position.Left} connecting={connectingType === 'target'} nodeActive={nodeActive} onUpstreamConnectStart={onUpstreamConnectStart} />
    <Port type="source" id={ports?.output?.id} position={Position.Right} connecting={connectingType === 'source'} nodeActive={nodeActive} />
  </>;
}
