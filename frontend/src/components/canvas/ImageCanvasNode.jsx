import CanvasNodeShell from './CanvasNodeShell';
import FileUploadButton from '../ui/FileUploadButton';
import { downloadUrlWithFeedback } from '../../utils/downloadFeedback';

export default function ImageCanvasNode({ id, data, selected }) {
  const asset = data?.asset;
  const handleToolbarAction = (action) => {
    if (!asset?.url) return;
    if (action === 'download') {
      void downloadUrlWithFeedback(asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url, asset.name || `${data?.label || '图片'}.png`);
      return;
    }
    data?.onImageEdit?.(id, action);
  };
  return <CanvasNodeShell nodeType="image" title={data?.label || '图片'} selected={selected} data={{ ...data, nodeId: id, onToolbarAction: handleToolbarAction, onPreview: data?.onPreview }} onPromptChange={data?.onPromptChange} onAddReference={data?.onAddReference} onGenerate={data?.onGenerate}>
    {asset?.url ? <img className="canvas-node__media" src={asset.url} alt={asset.name || '画布图片'} /> : <div className="canvas-node__empty-state"><FileUploadButton className="nodrag nopan" onClick={() => data?.onSelectAsset?.(id, 'image')}>从资产库选择</FileUploadButton></div>}
  </CanvasNodeShell>;
}
