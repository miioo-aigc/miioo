import AsyncImagePreview from '../AsyncImagePreview';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function getPreviewUrl(asset) {
  return asset?.originalUrl || asset?.original_url || asset?.download_url || asset?.downloadUrl || asset?.url || '';
}

export default function CanvasMediaPreview({ asset, nodeType, playback, onClose }) {
  const url = getPreviewUrl(asset);
  const isVideo = nodeType === 'video' && asset?.asset_type !== 'image' && asset?.asset_type !== 'audio';

  useEffect(() => {
    if (!asset) return undefined;
    document.dispatchEvent(new Event('canvas-media-preview-open'));
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [asset, onClose]);

  if (!asset || !url) return null;
  return createPortal(
    <div className="canvas-media-preview" role="dialog" aria-modal="true" aria-label={`${isVideo ? '视频' : '图片'}详情预览`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <button type="button" className="canvas-media-preview__close" aria-label="关闭详情预览" title="关闭" onClick={onClose}>
        <X size={20} strokeWidth={1.5} />
      </button>
        {isVideo
          ? <PreviewVideo key={url} url={url} poster={asset.posterUrl || asset.poster_url} playback={playback} onClose={onClose} />
          : <AsyncImagePreview plain onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }} src={url} alt={asset.name || '图片详情预览'} style={{ width: '80vw', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} imageStyle={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
    </div>,
    document.body,
  );
}

function PreviewVideo({ url, poster, playback, onClose }) {
  const ref = useRef(null);
  const initialized = useRef(false);
  useEffect(() => { if (ref.current) ref.current.volume = playback?.volume ?? 1; }, [playback?.volume]);
  const media = useMediaPlayback(ref, url, { autoPlay: true, mutedFallback: true });
  return <div onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }} style={{ position: 'relative', width: '80vw', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <video ref={ref} className="canvas-media-preview__media" src={url} poster={poster} controls muted={playback?.muted ?? false} playsInline onLoadedMetadata={event => {
      if (initialized.current) return;
      initialized.current = true;
      event.currentTarget.currentTime = playback?.time || 0;
      event.currentTarget.volume = playback?.volume ?? 1;
    }} />
    <MediaLoadStatus {...media} onPause={media.pause} onRetry={media.retry} onPlay={() => media.play()} />
  </div>;
}
