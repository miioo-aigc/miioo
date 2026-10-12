/**
 * @file CanvasNodeShell.jsx
 * @structure-index
 * CanvasNodeShell L33：节点标题、卡片、端口、顶部工具栏和创作面板组合；模型加载及卸载保护。2026-10-10 能力加载完成后再回填连线校验能力。
 * 2026-10-10：标题接收视口缩放保持固定尺寸；工具栏与输入框共用激活条件及显隐动画。
 * 2026-10-10：激活节点显示固定屏幕尺寸的顶部工具栏；下方创作面板按视口缩放反向补偿。
 * 2026-10-09：图片与视频主体采用等面积尺寸，最长边限制为480px。
 * 2026-10-09：生成态改用 Paper 动态背景及循环进度文字；保留布局、端口及发送保护。
 * 2026-09-29：端口默认隐藏，卡片悬停显示，端口悬停放大，拖拽连线期间保持激活并置于媒体内容上层；合法目标卡片显示接收描边。
 * 2026-09-28：常驻外壳保留高级音频草稿，收起编辑器不清空音色或效果器。
 * 2026-09-28：透传参考图来源、模式、文件及移除动作，保持媒体参数生命周期。
 * 2026-09-28：媒体本地文件入口常驻外壳，预览出现后隐藏而不卸载，保证临时地址有效。
 * 2026-09-28：媒体参数由外壳持有，创作框收起不丢失；仅当前节点生命周期内保留。
 * 2026-09-28：复用 chat 模型接口，透传文本生成状态、失败反馈及模型草稿。
 * 2026-10-08：透传连线目标合法性，显示蓝色或红色描边。
 * 2026-10-08：手动接线成功后沿卡片边界播放一次双路流光。
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
import CanvasGenerationLoading from './CanvasGenerationLoading';
import CanvasNodeConnectionPulse from './CanvasConnectionPulse';
import CanvasNodeToolbar from './CanvasNodeToolbar';
import './canvas-nodes.css';
import { useCanvasMediaSize } from './UseCanvasMediaSize';

export default function CanvasNodeShell({ nodeType, title, selected = false, data, children, onPromptChange, onAddReference, onGenerate }) {
  const [modelState, setModelState] = useState({ options: [], loading: true, error: false });
  const [audioDraft, setAudioDraft] = useState({});
  const mediaSize = useCanvasMediaSize(['image', 'video'].includes(nodeType) ? data?.asset : null);
  const mediaControls = useCanvasMediaControls(nodeType, data?.model, (value) => data?.onModelChange?.(data?.nodeId, value), (value) => data?.onGenerationModeChange?.(data?.nodeId, value));
  useEffect(() => {
    if (!mediaControls.loading && nodeType === 'image' && Number.isInteger(mediaControls.imageReferenceLimit)) {
      data?.onImageReferenceLimitChange?.(data?.nodeId, mediaControls.imageReferenceLimit);
    }
  }, [data?.nodeId, data?.onImageReferenceLimitChange, mediaControls.imageReferenceLimit, mediaControls.loading, nodeType]);
  useEffect(() => {
    if (mediaControls.loading || nodeType !== 'video' || !mediaControls.videoCapabilities) return;
    data?.onVideoCapabilitiesChange?.(data?.nodeId, mediaControls.videoCapabilities);
    if (!data?.generationMode && mediaControls.refMode) data?.onGenerationModeChange?.(data?.nodeId, mediaControls.refMode);
  }, [data?.generationMode, data?.nodeId, data?.onGenerationModeChange, data?.onVideoCapabilitiesChange, mediaControls.refMode, mediaControls.videoCapabilities, mediaControls.loading, nodeType]);
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
  return <div className={`canvas-node ${selected ? 'canvas-node--selected' : ''}`} data-node-type={nodeType} data-media-sized={Boolean(mediaSize)} style={mediaSize ? { '--canvas-media-width': `${mediaSize.width}px`, '--canvas-media-height': `${mediaSize.height}px` } : undefined}>
    <div className="canvas-node__toolbar-scale" inert={!creationOpen} style={{ '--canvas-inverse-zoom': 1 / (data?.viewportZoom || 1) }}><CanvasCreationPresence open={creationOpen} className="canvas-node__toolbar-presence"><CanvasNodeToolbar nodeType={nodeType} content={data?.content} asset={data?.asset} onAction={data?.onToolbarAction} onMore={data?.onMore} onPreview={data?.onPreview} /></CanvasCreationPresence></div>
    <CanvasNodeHeader nodeType={nodeType} title={title} zoom={data?.viewportZoom || 1} onRename={data?.onRename} onStart={data?.onRenameStart} />
    <div className="canvas-node__frame" aria-busy={Boolean(data?.generating)} data-state={data?.editing ? 'editing' : 'default'} data-connection-target={data?.connectionTarget ? 'true' : 'false'} data-connection-target-status={data?.connectionTargetStatus || ''} data-dragging={data?.dragging ? 'true' : 'false'} data-drag-release={data?.dragRelease ? 'true' : 'false'} style={{ '--canvas-drag-scale-x': data?.dragScaleX || 1, '--canvas-drag-scale-y': data?.dragScaleY || 1 }}>
      <CanvasNodePorts ports={data?.ports} connectingType={data?.connectingType} nodeActive={Boolean(selected || data?.editing || data?.generating)} onUpstreamConnectStart={(event) => data?.onUpstreamConnectStart?.(data?.nodeId, event)} />
      {data?.connectionPulses?.length > 0 && <CanvasNodeConnectionPulse pulses={data.connectionPulses} onMeasure={data.onPulseMeasure} />}
      {nodeType !== 'text' && <div className="canvas-node__local-upload-slot" hidden={Boolean(data?.asset?.url || data?.transcript)}>
        <CanvasLocalUpload nodeType={nodeType} onAssetChange={(asset) => data?.onAssetChange?.(data.nodeId, asset)} />
      </div>}
      {children}
      {data?.generating && <CanvasGenerationLoading key={data.generationRequestId} message={data.generationMessageRequestId === data.generationRequestId ? data.generationMessage : undefined} />}
    </div>
    <CanvasCreationPresence open={creationOpen}><div className="canvas-creation-scale" style={{ '--canvas-inverse-zoom': 1 / (data?.viewportZoom || 1) }}><CanvasCreationPanel
      key={data?.promptImportVersion || 0}
      nodeId={data?.nodeId}
      nodeType={nodeType}
      prompt={data?.prompt}
      promptSnapshot={data?.promptSnapshot}
      references={data?.references}
      imageReferenceLimit={data?.imageReferenceLimit}
      model={data?.model}
      modelState={modelState}
      generating={data?.generating}
      generationError={data?.generationError}
      mediaControls={{ ...mediaControls, imageReferenceLimit: data?.imageReferenceLimit }}
      audioDraft={audioDraft.importVersion === (data?.promptImportVersion || 0) ? audioDraft : { ...audioDraft, snapshot: undefined }}
      onAudioDraftChange={(update) => setAudioDraft((current) => ({ ...(typeof update === 'function' ? update(current) : update), importVersion: data?.promptImportVersion || 0 }))}
      onModelChange={(value) => data?.onModelChange?.(data?.nodeId, value)}
      onPromptChange={(value, snapshot) => onPromptChange?.(data?.nodeId, value, snapshot)}
      onAddReference={(source, mode, file) => onAddReference?.(data?.nodeId, source, mode, file)}
      onRemoveReference={(sourceId) => data?.onRemoveReference?.(data?.nodeId, sourceId)}
      onGenerate={(payload) => onGenerate?.(payload)}
    /></div></CanvasCreationPresence>
  </div>;
}
