/**
 * @file CanvasVideoPlayer.jsx
 * @structure-index
 * CanvasVideoPlayer L20：卡片中央常驻播放按钮、激活自动播放、原生控制条、媒体恢复及拖动区域。
 * 2026-10-23：有封面延迟300毫秒加载；失败恢复后仅点击播放。
 * 2026-11-09：卡片激活（选中）即请求预览地址并自动播放；点击卡片自身不中断激活态播放，失活或点击卡片之外才停止。
 * 2026-11-09：原生控制条只在激活态出现，播放/暂停、进度、静音、音量全部交给用户手动操作，不再随鼠标移入移出自动播放或暂停。
 * 2026-11-09：视频自身标记 nodrag，控制条区域独立接管指针事件；拖动层只在控制条上方让位，其余区域仍可拖动卡片。
 * 2026-11-09：只有可见的模态对话框才阻断自动播放，画布常驻的收起 role="dialog" 面板不再让视频停在封面层。
 * 2026-11-09：卡片中央常驻 32×32 播放按钮（复用详情弹窗圆形徽标）；点击带用户手势发起播放并让卡片进入激活态，播放中收起；加载中转圈、失败可重载，不再叠加文字状态层。
 */
import { useEffect, useRef } from 'react';
import { LoaderCircle, Play, RotateCw } from 'lucide-react';
import { useMediaPlayback } from '../../hooks/useMediaPlayback';
import AsyncImagePreview from '../AsyncImagePreview';
import VideoCircleBadge from '../ui/VideoCircleBadge';
import { shouldPauseCanvasVideo } from './CanvasVideoInteraction';
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
  useEffect(() => {
    // 激活即请求预览地址并自动播放；useMediaPlayback 的会话在同一次提交中已就绪，失活时直接停止。
    if (!active) { pause(); return undefined; }
    if (hasBlockingDialog()) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    if (!video.getAttribute('src')) { video.src = src; video.load(); }
    video.muted = false;
    // 激活态显式有声播放；被浏览器策略拦截时保留点击播放，不静默降级为静音。
    void play({ automatic: true });
    return undefined;
  }, [active, src, pause, play]);
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
    if (failed) { retry(); return; }
    if (loading) { pause(); return; }
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
