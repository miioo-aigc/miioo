/**
 * @file CanvasVideoPlayer.jsx
 * @structure-index
 * CanvasVideoPlayer L12：延迟悬停播放、媒体恢复及拖动区域。
 * 2026-10-23：有封面延迟300毫秒加载；失败恢复后仅点击播放。
 */
import { useEffect, useRef } from 'react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import MediaLoadStatus from '../feedback/MediaLoadStatus';
import AsyncImagePreview from '../AsyncImagePreview';

export default function CanvasVideoPlayer({ src, poster }) {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const media = useMediaPlayback(videoRef, src, { deferred: Boolean(poster) });
  const { pause, play } = media;
  const stop = () => { clearTimeout(timerRef.current); pause(); };
  useEffect(() => {
    const stopPlayback = () => { clearTimeout(timerRef.current); pause(); };
    document.addEventListener('pointerdown', stopPlayback, true);
    document.addEventListener('canvas-media-preview-open', stopPlayback);
    window.addEventListener('blur', stopPlayback);
    return () => {
      stopPlayback();
      document.removeEventListener('pointerdown', stopPlayback, true);
      document.removeEventListener('canvas-media-preview-open', stopPlayback);
      window.removeEventListener('blur', stopPlayback);
    };
  }, [pause]);
  function start(event) {
    stop();
    if (event.buttons || document.querySelector('[role="dialog"]')) return;
    timerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (!video || document.querySelector('[role="dialog"]')) return;
      if (!video.getAttribute('src')) { video.src = src; video.load(); }
      video.muted = false;
      void play({ automatic: true, mutedFallback: true });
    }, 300);
  }
  return <div className="canvas-video" onPointerEnter={start} onPointerLeave={stop}>
    <video ref={videoRef} className="canvas-node__media" src={poster ? undefined : src} poster={poster} playsInline preload={poster ? 'none' : 'metadata'} />
    {poster && media.status === 'idle' && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}><AsyncImagePreview plain decorative src={poster} /></div>}
    <div className="canvas-video__drag-surface" aria-hidden="true" />
    <MediaLoadStatus {...media} onPause={pause} onRetry={media.retry} onPlay={() => play()} />
  </div>;
}
