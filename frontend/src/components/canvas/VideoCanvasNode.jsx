import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import CanvasVideoPlayer from './CanvasVideoPlayer';
import CanvasAudioPlayer from './CanvasAudioPlayer';
import { getCanvasAudioTranscript } from './CanvasAssets';

export default function VideoCanvasNode({ id, data, selected }) {
  const asset = data?.asset;
  return <CanvasNodeShell nodeType="video" title={data?.label || '视频'} selected={selected} data={{ ...data, nodeId: id }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {asset?.url ? asset.asset_type === 'image'
      ? <img className="canvas-node__media" src={asset.url} alt={asset.name || '参考图片'} draggable={false} />
      : asset.asset_type === 'audio'
        ? <CanvasAudioPlayer key={asset.url} url={asset.url} name={asset.name} transcript={getCanvasAudioTranscript(asset)} />
        : <CanvasVideoPlayer key={asset.url} src={asset.url} poster={asset.posterUrl} />
      : <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={() => data?.onSelectAsset?.(id, 'video')}>从资产库选择</FileUploadButton></div>}
  </CanvasNodeShell>;
}
