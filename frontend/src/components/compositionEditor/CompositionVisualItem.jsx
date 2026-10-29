import { useEffect, useRef, useState } from 'react';
import { useVideoPreview } from './UseVideoPreview';
import { useCompositionEditorStore } from '../../stores/compositionEditorStore';

/** 单个时间线上活跃的图片/视频层，源尺寸决定真实素材外框。 */
export default function CompositionVisualItem({ window, rect, clipBounds, playing, clock, seekEpoch, settings, outputVolume, onStatus, onImageStatus }) {
  const { seg } = window;
  const { start, end } = window;
  const { offset, duration, speed } = seg;
  const active = true;
  const video = useVideoPreview(seg.type === 'video' && active ? seg.assetId : null);
  const reportMediaError = video.mediaError;
  const videoRef = useRef(null);
  const bufferTimer = useRef(null);
  const clearBufferTimer = () => clearTimeout(bufferTimer.current);
  const waitForMedia = () => {
    clearBufferTimer();
    onStatus(seg.id, { status: 'buffering', playable: false, data: video.data, retry: video.retry });
    bufferTimer.current = setTimeout(reportMediaError, 60000);
  };
  const mediaReady = () => {
    clearBufferTimer();
    onStatus(seg.id, { status: 'ready', playable: true, data: video.data, retry: video.retry });
  };
  useEffect(() => {
    const ratio = video.data?.source?.display_aspect_ratio;
    if (ratio) useCompositionEditorStore.getState().reportSourceRatio(seg.id, ratio.num / ratio.den);
    if (seg.type === 'video' && active) onStatus(seg.id, { status: video.status, playable: video.status === 'ready' && videoRef.current?.readyState >= 3 && !videoRef.current?.seeking, data: video.data, retry: video.retry, error: video.error });
    else if (seg.type === 'video') onStatus(seg.id, null);
  }, [seg.id, seg.type, active, video.status, video.data, video.error, video.retry, onStatus]);
  useEffect(() => {
    const el = videoRef.current;
    if (!el || seg.type !== 'video' || video.status !== 'ready') return;
    const mediaWindow = { start, end, seg: { type: 'video', offset, duration, speed, sourceUrl: video.data.preview.url } };
    return clock.register('video-' + seg.id, el, mediaWindow, false, playing,
      () => useCompositionEditorStore.getState().cursor, video.mediaError);
  }, [seg.id, seg.type, start, end, video.status, video.data, video.mediaError, offset, duration, speed, clock, playing, seekEpoch]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, (settings?.volume ?? 1) * outputVolume));
  }, [settings?.volume, outputVolume, video.status]);
  useEffect(() => () => { if (seg.type === 'video') onStatus(seg.id, null); }, [seg.id, seg.type, onStatus]);
  useEffect(() => {
    if (video.status !== 'ready') return undefined;
    bufferTimer.current = setTimeout(() => {
      if (videoRef.current?.readyState < 3) reportMediaError();
    }, 60000);
    return () => clearTimeout(bufferTimer.current);
  }, [video.status, reportMediaError]);
  const style = { position: 'absolute', left: rect?.x ?? 0, top: rect?.y ?? 0, width: rect?.width ?? '100%', height: rect?.height ?? '100%', zIndex: rect?.zIndex ?? 1, pointerEvents: 'none', overflow: 'hidden' };
  if (rect && clipBounds) style.clipPath = `inset(${Math.max(0, -rect.y)}px ${Math.max(0, rect.x + rect.width - clipBounds.width)}px ${Math.max(0, rect.y + rect.height - clipBounds.height)}px ${Math.max(0, -rect.x)}px)`;
  if (seg.type === 'video' && active) {
    const poster = seg.posterUrl || seg.thumbnailUrl;
    return <div style={style}>
      {poster && <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />}
      {video.status === 'ready' && <video ref={videoRef} src={video.data.preview.url} poster={poster || undefined} preload="auto" playsInline
        muted={settings?.hidden || (settings?.volume ?? 1) <= 0 || outputVolume <= 0 || seg.hasAudio === false}
        onCanPlay={mediaReady}
        onSeeking={waitForMedia}
        onSeeked={() => { if (videoRef.current?.readyState >= 3) mediaReady(); }}
        onWaiting={waitForMedia}
        onError={video.mediaError} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />}
      {video.status === 'failed' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', pointerEvents: 'auto' }}><button type="button" onClick={video.retry} style={{ padding: '8px 12px' }}>预览视频暂不可用，点击重试</button></span>}
    </div>;
  }
  return <ImageLayer key={seg.sourceUrl} segment={seg} style={style} onStatus={onImageStatus} />;
}

function ImageLayer({ segment, style, onStatus }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    let cancelled = false;
    onStatus(segment.id, { status: 'loading' });
    const report = async () => {
      if (!image.naturalWidth || !image.naturalHeight) { onStatus(segment.id, { status: 'failed' }); return; }
      try {
        await image.decode();
        if (!cancelled) { useCompositionEditorStore.getState().reportSourceRatio(segment.id, image.naturalWidth / image.naturalHeight); setLoaded(true); onStatus(segment.id, { status: 'ready', ratio: image.naturalWidth / image.naturalHeight }); }
      } catch { if (!cancelled) onStatus(segment.id, { status: 'failed' }); }
    };
    image.addEventListener('load', report);
    if (image.complete) report();
    return () => { cancelled = true; image.removeEventListener('load', report); };
  }, [segment.id, segment.sourceUrl, onStatus]);
  return <div style={style}>
    {!loaded && segment.thumbnailUrl && <img src={segment.thumbnailUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
    <img ref={ref} src={segment.sourceUrl || undefined} alt="" onError={() => onStatus(segment.id, { status: 'failed' })}
      style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: loaded ? 1 : 0 }} />
  </div>;
}
