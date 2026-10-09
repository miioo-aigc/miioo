/** 组合边框与堆叠预览；堆叠不改写成员坐标。 */
import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import SeedanceFolderCard from '../assets/SeedanceFolderCard';

export default function CanvasGroupNode({ id, data, selected }) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => { updateNodeInternals(id); }, [id, data.stacked, updateNodeInternals]);
  if (data.stacked) return <div className="canvas-group-stack" data-selected={selected}>
    <SeedanceFolderCard presentationOnly name={data.label} count={data.stackMembers?.length || 0}
      images={(data.stackMembers || []).slice(0, 2).map((member) => ({
        ...member.asset, type: member.asset?.url ? member.type : member.type === 'audio' ? 'audio' : 'text',
        label: member.label, content: member.content,
      }))} />
    <Handle type="target" position={Position.Left} id="stack-input" isConnectable={false} style={{ opacity: 0 }} />
    <Handle type="source" position={Position.Right} id="stack-output" isConnectable={false} style={{ opacity: 0 }} />
  </div>;
  return <div className="canvas-group" data-selected={selected}>
    <span className="canvas-group__name" title={data.label}>{data.label}</span>
  </div>;
}
