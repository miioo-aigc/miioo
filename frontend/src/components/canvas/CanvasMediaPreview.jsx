import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

function getPreviewUrl(asset) {
  return asset?.url || asset?.originalUrl || asset?.original_url || asset?.download_url || asset?.downloadUrl || '';
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
          ? <video className="canvas-media-preview__media" src={url} poster={asset.posterUrl || asset.poster_url} controls muted={playback?.muted ?? false} playsInline onLoadedMetadata={async (event) => {
            const video = event.currentTarget;
            video.currentTime = playback?.time || 0;
            video.volume = playback?.volume ?? 1;
            try { await video.play(); } catch (error) {
              if (error.name === 'NotAllowedError' && video.isConnected) {
                video.muted = true;
                try { await video.play(); } catch { /* 保留手动播放控件。 */ }
              }
            }
          }} />
          : <img className="canvas-media-preview__media" src={url} alt={asset.name || '图片详情预览'} />}
    </div>,
    document.body,
  );
}
