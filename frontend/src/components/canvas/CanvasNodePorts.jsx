import { Handle, Position } from '@xyflow/react';

function Port({ type, id, position }) {
  return <Handle type={type} id={id} position={position} className="canvas-node__port" />;
}

export default function CanvasNodePorts({ ports }) {
  return <>
    <Port type="target" id={ports?.input?.id} position={Position.Left} />
    <Port type="source" id={ports?.output?.id} position={Position.Right} />
  </>;
}
