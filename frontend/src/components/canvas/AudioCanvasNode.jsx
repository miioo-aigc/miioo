import CanvasNodeShell from './CanvasNodeShell';
import CanvasAudioPlayer from './CanvasAudioPlayer';
import { getCanvasAudioTranscript } from './CanvasAssets';
import FileUploadButton from '../ui/FileUploadButton';

export default function AudioCanvasNode({ id, data, selected }) {
  const transcript = getCanvasAudioTranscript(data?.asset || { transcript: data?.transcript });
  return <CanvasNodeShell nodeType="audio" title={data?.label || '音频'} selected={selected} data={{ ...data, transcript, nodeId: id }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {!data?.asset?.url && !transcript ? <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={() => data?.onSelectAsset?.(id, 'audio')}>从资产库选择</FileUploadButton></div>
      : <CanvasAudioPlayer key={data?.asset?.url || 'empty'} url={data?.asset?.url} name={data?.asset?.name} transcript={transcript} />}
  </CanvasNodeShell>;
}
