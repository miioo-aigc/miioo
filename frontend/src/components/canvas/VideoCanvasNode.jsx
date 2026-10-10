import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import CanvasVideoPlayer from './CanvasVideoPlayer';
import CanvasAudioPlayer from './CanvasAudioPlayer';
import { getCanvasAudioTranscript } from './CanvasAssets';
import { downloadUrlWithFeedback } from '../../utils/downloadFeedback';

export default function VideoCanvasNode({ id, data, selected }) {
  const asset = data?.asset;
  const handleToolbarAction = (action) => {
    if (!asset?.url) return;
    if (action === 'download') {
      void downloadUrlWithFeedback(asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url, asset.name || `${data?.label || '视频'}.mp4`);
      return;
    }
    data?.onVideoEdit?.(id, action);
  };
  return <CanvasNodeShell nodeType="video" title={data?.label || '视频'} selected={selected} data={{ ...data, nodeId: id, onToolbarAction: handleToolbarAction }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {asset?.url ? asset.asset_type === 'image'
      ? <img className="canvas-node__media" src={asset.url} alt={asset.name || '参考图片'} draggable={false} />
      : asset.asset_type === 'audio'
        ? <CanvasAudioPlayer key={asset.url} url={asset.url} name={asset.name} transcript={getCanvasAudioTranscript(asset)} />
        : <CanvasVideoPlayer key={asset.url} src={asset.url} poster={asset.posterUrl} />
      : <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={() => data?.onSelectAsset?.(id, 'video')}>从资产库选择</FileUploadButton></div>}
  </CanvasNodeShell>;
}
