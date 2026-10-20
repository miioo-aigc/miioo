import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { safeCanvasMediaUrl } from './CanvasShareDocument';

const text = (value) => typeof value === 'string' ? value : '';

export default function SharedCanvasNode({ data }) {
  const [failed, setFailed] = useState(false);
  const { asset, mediaType, mediaSize } = data;
  const isMedia = Boolean(data.assetId) || ['image', 'video', 'audio'].includes(mediaType);
  const unavailable = failed || (isMedia && (!asset || asset.availability !== 'ready'));
  const preview = safeCanvasMediaUrl(asset?.preview_url);
  const original = safeCanvasMediaUrl(asset?.original_url);
  const poster = safeCanvasMediaUrl(asset?.poster_url);
  const image = original || preview || safeCanvasMediaUrl(asset?.thumbnail_url);
  const missing = <div className="flex h-full min-h-[100px] items-center justify-center px-[16px] text-[13px] text-text-hint">素材暂不可用</div>;
  let content;
  if (!isMedia) {
    content = <div className="nowheel max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-[16px] text-[14px] leading-[22px] text-text-primary">{text(data.content) || text(data.prompt) || '暂无内容'}</div>;
  } else if (unavailable) content = missing;
  else if (mediaType === 'image' && image) content = <img src={image} alt={text(asset.title) || '画布图片'} className="h-full w-full object-contain" onError={() => setFailed(true)} />;
  else if (mediaType === 'video' && preview) content = <video src={preview} poster={poster} controls preload="metadata" className="nodrag nowheel h-full w-full object-contain" onError={() => setFailed(true)} />;
  else if (mediaType === 'audio' && preview) content = <div className="flex h-full items-center px-[12px]"><audio src={preview} controls preload="metadata" className="nodrag nowheel w-full" onError={() => setFailed(true)} /></div>;
  else content = missing;
  return (
    <article className="overflow-hidden rounded-[8px] border border-stroke-normal bg-surface-card shadow-lg">
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <header className="truncate border-b border-stroke-normal px-[12px] py-[8px] text-[12px] text-text-secondary" title={text(data.label) || text(asset?.title)}>{text(data.label) || text(asset?.title) || '画布节点'}</header>
      <div style={isMedia ? { height: mediaType === 'audio' ? 100 : mediaSize.height } : undefined}>{content}</div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  );
}
