/**
 * @file CanvasVideoPlayer.jsx
 * @structure-index
 * CanvasVideoPlayer：管理延迟悬停播放及画面拖动区域，不显示卡片控制条。
 * 2026-10-10：优先有声播放，权限拦截后降级静音；移出、按下、失焦和打开详情暂停。
 */
import { useEffect, useRef } from 'react';

export default function CanvasVideoPlayer({ src, poster }) {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const stop = () => {
    clearTimeout(timerRef.current);
    attemptRef.current += 1;
    videoRef.current?.pause();
  };
  useEffect(() => {
    const video = videoRef.current;
    const pause = () => {
      clearTimeout(timerRef.current);
      attemptRef.current += 1;
      video.pause();
    };
    document.addEventListener('pointerdown', pause, true);
    document.addEventListener('canvas-media-preview-open', pause);
    window.addEventListener('blur', pause);
    return () => {
      pause();
      document.removeEventListener('pointerdown', pause, true);
      document.removeEventListener('canvas-media-preview-open', pause);
      window.removeEventListener('blur', pause);
    };
  }, []);
  const start = (event) => {
    stop();
    if (event.buttons || document.querySelector('[role="dialog"]')) return;
    const attempt = attemptRef.current;
    timerRef.current = setTimeout(async () => {
      const video = videoRef.current;
      if (!video || document.querySelector('[role="dialog"]')) return;
      video.muted = false;
      try { await video.play(); } catch (error) {
        if (attempt !== attemptRef.current || error.name !== 'NotAllowedError') return;
        video.muted = true;
        try { await video.play(); } catch { /* 保留静态画面。 */ }
      }
      if (attempt !== attemptRef.current) video.pause();
    }, 300);
  };
  return <div
    className="canvas-video"
    onPointerEnter={start}
    onPointerLeave={stop}
  >
    <video
      ref={videoRef}
      className="canvas-node__media"
      src={src}
      poster={poster}
      playsInline
      preload="metadata"
    />
    <div className="canvas-video__drag-surface" aria-hidden="true" />
  </div>;
}
