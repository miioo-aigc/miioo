/** 固定媒体浮层：失败时锁定位置，刷新成功后恢复悬停生命周期。 */
import { useEffect, useRef, useState } from 'react';
import { createImagePreviewLoad } from '../../utils/ImagePreviewLoad';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import VisualMediaStatus from '../feedback/VisualMediaStatus';
import { normalizeImageUrl } from '../../utils/imageUrl';

export default function MediaHoverPreview(props) {
  return <PreviewSession key={`${props.isVideo}:${props.url}`} {...props} />;
}

function PreviewSession({ url, isVideo, mouseX, mouseY, onPinnedChange, onDismiss }) {
  const src = normalizeImageUrl(url);
  const root = useRef(null);
  const videoRef = useRef(null);
  const loader = useRef(null);
  const [frozenPosition, setFrozenPosition] = useState(null);
  const locked = useRef(false);
  const inside = useRef(false);
  const callbacks = useRef({ onPinnedChange, onDismiss });
  const [size, setSize] = useState({ w: 16, h: 9 });
  const [image, setImage] = useState({ status: 'loading' });
  const [pinned, setPinned] = useState(false);
  const playback = useMediaPlayback(videoRef, isVideo ? src : null, { autoPlay: true });
  const status = isVideo ? playback.status : image.status;
  const { play } = playback;
  const attempted = useRef(false);
  useEffect(() => { callbacks.current = { onPinnedChange, onDismiss }; });
  useEffect(() => {
    if (isVideo) return undefined;
    const session = createImagePreviewLoad({ src, onChange: setImage });
    loader.current = session;
    queueMicrotask(session.start);
    return () => session.dispose();
  }, [isVideo, src]);
  useEffect(() => {
    if (status === 'error') {
      locked.current = true;
      callbacks.current.onPinnedChange?.(true);
      const rect = root.current?.getBoundingClientRect();
      queueMicrotask(() => {
        if (!root.current) return;
        setPinned(true);
        if (rect) setFrozenPosition({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      });
      attempted.current = false;
    } else if (['loaded', 'ready', 'playing'].includes(status) && locked.current && !inside.current) {
      locked.current = false;
      queueMicrotask(() => { if (root.current) { setPinned(false); setFrozenPosition(null); } });
      callbacks.current.onPinnedChange?.(false);
    }
    if (isVideo && status === 'ready' && playback.requiresClick && !attempted.current) {
      attempted.current = true;
      void play({ automatic: true, hover: true });
    }
  }, [status, isVideo, playback.requiresClick, play]);
  useEffect(() => {
    if (!pinned) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) callbacks.current.onDismiss?.(); };
    const keydown = event => { if (event.key === 'Escape') callbacks.current.onDismiss?.(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keydown); };
  }, [pinned]);

  const gap = 16;
  const scale = Math.min(window.innerWidth * 0.35 / size.w, window.innerHeight * 0.35 / size.h);
  const width = size.w * scale, height = size.h * scale;
  let left = mouseX + gap, top = mouseY + gap;
  if (left + width > window.innerWidth - gap) left = mouseX - width - gap;
  if (top + height > window.innerHeight - gap) top = mouseY - height - gap;
  const position = frozenPosition || { left: Math.max(gap, left), top: Math.max(gap, top), width, height };
  const mediaStyle = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };
  return <div ref={root} onMouseEnter={() => { inside.current = true; }} onMouseLeave={() => {
    inside.current = false;
    if (locked.current) callbacks.current.onDismiss?.();
  }} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
    style={{ position: 'fixed', ...position, zIndex: 99999, pointerEvents: pinned ? 'auto' : 'none', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', border: '1px solid var(--color-stroke-normal)', backgroundColor: 'var(--color-surface-card)' }}>
    {isVideo ? <video ref={videoRef} src={src} muted loop playsInline preload="metadata" onLoadedMetadata={event => {
      const { videoWidth: w, videoHeight: h } = event.currentTarget;
      if (w && h) setSize({ w, h });
    }} style={mediaStyle} /> : image.resolvedSrc && image.status !== 'error' && <img key={image.attempt} src={image.resolvedSrc} alt=""
      onLoad={event => { const { naturalWidth: w, naturalHeight: h } = event.currentTarget; if (w && h) setSize({ w, h }); image.onLoad(); }}
      onError={image.onError} style={{ ...mediaStyle, opacity: status === 'loaded' ? 1 : 0 }} />}
    <VisualMediaStatus status={status} requiresClick={false} onRetry={() => isVideo ? playback.retry() : loader.current?.retry()} />
  </div>;
}
