/**
 * 视频节点：单击选中自动播放、原生控制条、媒体恢复及独立拖动区域。
 * 2026-11-11：区分单击选中和拖动选中，拖动不触发自动播放；失活仍暂停。
 */
import { useEffect, useRef } from 'react';
import { LoaderCircle, Play, RotateCw } from 'lucide-react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import AsyncImagePreview from '../AsyncImagePreview';
import VideoCircleBadge from '../ui/VideoCircleBadge';
import { shouldPauseCanvasVideo } from './CanvasVideoInteraction';
import { useCanvasVideoAutoplay } from './UseCanvasVideoAutoplay';
import { hasBlockingDialog } from './CanvasModalGuard';

export default function CanvasVideoPlayer({ src, poster, active = false }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const media = useMediaPlayback(videoRef, src, { deferred: Boolean(poster) });
  const { pause, play, retry } = media;
  const playing = media.status === 'playing';
  const loading = media.status === 'loading';
  const failed = media.status === 'error';
  const centerActionLabel = failed ? '重新加载视频' : loading ? '正在加载，点击取消等待' : '播放视频';
  useCanvasVideoAutoplay(videoRef, containerRef, active, src, play, pause);
  useEffect(() => {
    const stopPlayback = (event) => {
      if (!shouldPauseCanvasVideo(active, containerRef.current, event?.target)) return;
      pause();
    };
    document.addEventListener('pointerdown', stopPlayback, true);
    document.addEventListener('canvas-media-preview-open', stopPlayback);
    window.addEventListener('blur', stopPlayback);
    return () => {
      document.removeEventListener('pointerdown', stopPlayback, true);
      document.removeEventListener('canvas-media-preview-open', stopPlayback);
      window.removeEventListener('blur', stopPlayback);
    };
  }, [active, pause]);
  // 中央按钮沿用真实点击手势发起播放（不受自动播放策略限制），点击继续冒泡让卡片进入激活态。
  const startFromCenterButton = () => {
    if (hasBlockingDialog()) return;
    if (failed) { retry(); return; }
    if (loading) { pause(); return; }
    const video = videoRef.current;
    if (!video) return;
    if (!video.getAttribute('src')) { video.src = src; video.load(); }
    video.muted = false;
    void play();
  };
  return <div ref={containerRef} className="canvas-video">
    <video ref={videoRef} className="canvas-node__media nodrag nopan nowheel" src={poster ? undefined : src} poster={poster} controls={active} playsInline preload={poster ? 'none' : 'metadata'} />
    {poster && media.status === 'idle' && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}><AsyncImagePreview plain decorative src={poster} /></div>}
    <div className="canvas-video__drag-surface" data-controls={active ? 'true' : undefined} aria-hidden="true" />
    {!playing && <button type="button" className="canvas-video__play nodrag nopan" onClick={startFromCenterButton} aria-label={centerActionLabel} title={centerActionLabel}>
      <VideoCircleBadge size={32}>{loading ? <LoaderCircle size={16} className="animate-spin" /> : failed ? <RotateCw size={16} /> : <Play size={16} fill="currentColor" />}</VideoCircleBadge>
    </button>}
  </div>;
}
