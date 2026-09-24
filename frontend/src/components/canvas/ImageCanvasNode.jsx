import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';

export default function ImageCanvasNode({ id, data, selected }) {
  const asset = data?.asset;
  return <CanvasNodeShell nodeType="image" title={data?.label || '图片'} selected={selected} data={{ ...data, nodeId: id }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {asset?.url ? <img className="canvas-node__media" src={asset.url} alt={asset.name || '画布图片'} /> : <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={data?.onLocalUpload}>本地上传</FileUploadButton></div>}
  </CanvasNodeShell>;
}
