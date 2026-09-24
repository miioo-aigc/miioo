import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';

export default function VideoCanvasNode({ id, data, selected }) {
  const asset = data?.asset;
  return <CanvasNodeShell nodeType="video" title={data?.label || '视频'} selected={selected} data={{ ...data, nodeId: id }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {asset?.url ? <video className="canvas-node__media" src={asset.url} poster={asset.posterUrl} muted preload="metadata" controls={false} /> : <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={data?.onLocalUpload}>本地上传</FileUploadButton></div>}
  </CanvasNodeShell>;
}
