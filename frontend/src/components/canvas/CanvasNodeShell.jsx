/**
 * @file CanvasNodeShell.jsx
 * @structure-index
 * 节点标题、卡片、端口和创作面板组合；文本模型列表加载及卸载保护。
 * 2026-09-24：复用 chat 模型接口，模型选择通过节点回调写回草稿。
 */
import { useEffect, useState } from 'react';
import { apiListModels } from '../../api/config';
import { getCanvasTextModels } from './CanvasTextModels';
import CanvasCreationPanel from './CanvasCreationPanel';
import CanvasCreationPresence from './CanvasCreationPresence';
import CanvasNodeHeader from './CanvasNodeHeader';
import CanvasNodePorts from './CanvasNodePorts';
import './canvas-nodes.css';

export default function CanvasNodeShell({ nodeType, title, selected = false, data, children, onPromptChange, onAddReference, onGenerate }) {
  const [modelState, setModelState] = useState({ options: [], loading: true, error: false });
  useEffect(() => {
    if (nodeType !== 'text') return;
    let cancelled = false;
    apiListModels({ category: 'chat' }).then((list) => {
      if (!cancelled) setModelState({ options: getCanvasTextModels(list), loading: false, error: false });
    }).catch(() => {
      if (!cancelled) setModelState({ options: [], loading: false, error: true });
    });
    return () => { cancelled = true; };
  }, [nodeType]);
  const creationOpen = Boolean(selected && data?.creationPanelOpen);
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
      model={data?.model}
      modelState={modelState}
      onModelChange={(value) => data?.onModelChange?.(data?.nodeId, value)}
      onPromptChange={(value) => onPromptChange?.(data?.nodeId, value)}
      onAddReference={() => onAddReference?.(data?.nodeId)}
      onGenerate={(payload) => onGenerate?.(payload)}
    /></CanvasCreationPresence>
  </div>;
}
