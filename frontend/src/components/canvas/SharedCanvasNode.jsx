import { useRef, useState } from 'react';
import { useCanvasTextOverflow } from './UseCanvasTextOverflow';
import { Handle, Position, useViewport } from '@xyflow/react';
import { safeCanvasMediaUrl } from './CanvasShareDocument';
import CanvasNodeHeader from './CanvasNodeHeader';
import CanvasTextResult from './CanvasTextResult';
import CanvasVideoPlayer from './CanvasVideoPlayer';
import CanvasAudioPlayer from './CanvasAudioPlayer';
import './canvas-nodes.css';

const text = (value) => typeof value === 'string' ? value : '';

export default function SharedCanvasNode({ data }) {
  const [failed, setFailed] = useState(false);
  const textRef = useRef(null);
  useCanvasTextOverflow(textRef);
  const { zoom } = useViewport();
  const { asset, mediaType, mediaSize } = data;
  const nodeType = data.nodeType || mediaType || 'text';
  const isMedia = ['image', 'video', 'audio'].includes(nodeType);
  const unavailable = failed || (isMedia && (!asset || asset.availability !== 'ready'));
  const preview = safeCanvasMediaUrl(asset?.preview_url);
  const original = safeCanvasMediaUrl(asset?.original_url);
  const poster = safeCanvasMediaUrl(asset?.poster_url);
  const image = original || preview || safeCanvasMediaUrl(asset?.thumbnail_url);
  const missing = <div className="canvas-node__empty-state"><span className="text-[13px] text-text-hint">{data.assetId ? '素材暂不可用' : '暂无内容'}</span></div>;
  let content;
  if (!isMedia) {
    content = <div ref={textRef} data-text-preview="true" className="canvas-node__text-content nowheel">{text(data.content) ? <CanvasTextResult content={data.content} /> : <span className="canvas-node__text-placeholder">暂无内容</span>}</div>;
  } else if (unavailable) content = missing;
  else if (mediaType === 'image' && image) content = <img src={image} alt={text(asset.title) || '画布图片'} draggable={false} className="canvas-node__media" onError={() => setFailed(true)} />;
  else if (mediaType === 'video' && preview) content = <CanvasVideoPlayer key={preview} src={preview} poster={poster} />;
  else if (mediaType === 'audio' && preview) content = <CanvasAudioPlayer key={preview} url={preview} name={asset.title} transcript={text(data.transcript)} />;
  else content = missing;
  return (
    <article className="canvas-node" data-node-type={nodeType} data-media-sized={Boolean(data.assetId && ['image', 'video'].includes(nodeType))}
      style={{ '--canvas-media-width': mediaSize.width + 'px', '--canvas-media-height': mediaSize.height + 'px' }}>
      <CanvasNodeHeader nodeType={nodeType} title={text(data.label) || text(asset?.title) || '画布节点'} zoom={zoom} />
      <div className="canvas-node__frame" data-state="default">
        <Handle type="target" position={Position.Left} isConnectable={false} className="canvas-node__port" />
        {content}
        <Handle type="source" position={Position.Right} isConnectable={false} className="canvas-node__port" />
      </div>
    </article>
  );
}
