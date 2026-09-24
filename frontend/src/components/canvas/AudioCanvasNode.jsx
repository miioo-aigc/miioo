import { Play } from 'lucide-react';
import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';

export default function AudioCanvasNode({ id, data, selected }) {
  const hasTranscript = Boolean(data?.transcript);
  return <CanvasNodeShell nodeType="audio" title={data?.label || '音频'} selected={selected} data={{ ...data, nodeId: id }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {!data?.asset?.url && !hasTranscript ? <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={data?.onLocalUpload}>本地上传</FileUploadButton></div> : <div className={`canvas-node__audio ${hasTranscript ? 'canvas-node__audio--transcript' : ''}`}>
      <button type="button" className="canvas-node__play nodrag" aria-label="播放"><Play size={14} fill="currentColor" /></button>
      <div className="canvas-node__audio-time">00:00:00 / 00:00:14</div>
      {hasTranscript && <div className="canvas-node__transcript nodrag nowheel">{data.transcript}</div>}
      <div className="canvas-node__waveform" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 13) % 20)}px` }} />)}</div>
    </div>}
  </CanvasNodeShell>;
}
