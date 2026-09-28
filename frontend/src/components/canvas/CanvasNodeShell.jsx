/**
 * @file CanvasNodeShell.jsx
 * @structure-index
 * CanvasNodeShell L24：节点标题、卡片、端口和创作面板组合；模型加载及卸载保护。
 * 2026-09-28：结果卡片生成时隐藏内部内容，居中复用高度 32px 的公共加载动画；保留布局、端口及发送保护。
 * 2026-09-28：常驻外壳保留高级音频草稿，收起编辑器不清空音色或效果器。
 * 2026-09-28：透传参考图来源、模式、文件及移除动作，保持媒体参数生命周期。
 * 2026-09-28：媒体本地文件入口常驻外壳，预览出现后隐藏而不卸载，保证临时地址有效。
 * 2026-09-28：媒体参数由外壳持有，创作框收起不丢失；仅当前节点生命周期内保留。
 * 2026-09-28：复用 chat 模型接口，透传文本生成状态、失败反馈及模型草稿。
 */
import { useEffect, useState } from 'react';
import { apiListModels } from '../../api/config';
import { getCanvasTextModels } from './CanvasTextModels';
import { useCanvasMediaControls } from './UseCanvasMediaControls';
import CanvasCreationPanel from './CanvasCreationPanel';
import CanvasCreationPresence from './CanvasCreationPresence';
import CanvasNodeHeader from './CanvasNodeHeader';
import CanvasNodePorts from './CanvasNodePorts';
import CanvasLocalUpload from './CanvasLocalUpload';
import LoadingAnimation from '../LoadingAnimation';
import './canvas-nodes.css';

export default function CanvasNodeShell({ nodeType, title, selected = false, data, children, onPromptChange, onAddReference, onGenerate }) {
  const [modelState, setModelState] = useState({ options: [], loading: true, error: false });
  const [audioDraft, setAudioDraft] = useState({});
  const mediaControls = useCanvasMediaControls(nodeType, data?.model, (value) => data?.onModelChange?.(data?.nodeId, value));
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
    <div className="canvas-node__frame" aria-busy={Boolean(data?.generating)} data-state={data?.editing ? 'editing' : 'default'} data-dragging={data?.dragging ? 'true' : 'false'} data-drag-release={data?.dragRelease ? 'true' : 'false'} style={{ '--canvas-drag-scale-x': data?.dragScaleX || 1, '--canvas-drag-scale-y': data?.dragScaleY || 1 }}>
      <CanvasNodePorts ports={data?.ports} />
      {nodeType !== 'text' && <div className="canvas-node__local-upload-slot" hidden={Boolean(data?.asset?.url || data?.transcript)}>
        <CanvasLocalUpload nodeType={nodeType} onAssetChange={(asset) => data?.onAssetChange?.(data.nodeId, asset)} />
      </div>}
      {children}
      {data?.generating && <div className="canvas-node__loading" aria-hidden="true">
        <LoadingAnimation width="auto" style={{ height: 32 }} />
      </div>}
    </div>
    <CanvasCreationPresence open={creationOpen}><CanvasCreationPanel
      key={data?.promptImportVersion || 0}
      nodeId={data?.nodeId}
      nodeType={nodeType}
      prompt={data?.prompt}
      references={data?.references}
      model={data?.model}
      modelState={modelState}
      generating={data?.generating}
      generationError={data?.generationError}
      mediaControls={mediaControls}
      audioDraft={audioDraft.importVersion === (data?.promptImportVersion || 0) ? audioDraft : { ...audioDraft, snapshot: undefined }}
      onAudioDraftChange={(update) => setAudioDraft((current) => ({ ...(typeof update === 'function' ? update(current) : update), importVersion: data?.promptImportVersion || 0 }))}
      onModelChange={(value) => data?.onModelChange?.(data?.nodeId, value)}
      onPromptChange={(value) => onPromptChange?.(data?.nodeId, value)}
      onAddReference={(source, mode, file) => onAddReference?.(data?.nodeId, source, mode, file)}
      onRemoveReference={(sourceId) => data?.onRemoveReference?.(data?.nodeId, sourceId)}
      onGenerate={(payload) => onGenerate?.(payload)}
    /></CanvasCreationPresence>
  </div>;
}
