/**
 * @file HomeBackground.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   HomeBackground                                               首页背景视频、遮罩和非首页底色
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   仅通过 isHome、videoRef、videoSrc 和 onVideoEnded 接收页面状态与事件；
 *   不读取导航、认证或业务数据；只管理媒体可见性和资源释放，不负责视频切换。
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-11-02  隐藏页面暂停播放，返回恢复，卸载显式释放媒体资源
 *   2026-07-16  从 Home.jsx 抽离背景展示层；页面继续负责视频索引和切换回调
 */

import { useEffect } from 'react';

export default function HomeBackground({ isHome, videoRef, videoSrc, onVideoEnded }) {
  useEffect(() => {
    const video = videoRef.current;
    if (!isHome || !video) return;
    if (!video.hasAttribute('src')) video.src = videoSrc;
    const syncPlayback = () => {
      if (document.hidden) video.pause();
      else video.play().catch(() => {});
    };
    const pause = () => video.pause();
    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', syncPlayback);
    syncPlayback();
    return () => {
      document.removeEventListener('visibilitychange', syncPlayback);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', syncPlayback);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [isHome, videoRef, videoSrc]);

  return (
    <>
      {isHome ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            preload="metadata"
            muted
            playsInline
            onEnded={onVideoEnded}
            className="absolute inset-0 object-cover"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(ellipse 52.305% 69.61% at 50% 44.45% in oklab, oklab(0% 0 0 / 0%) 0%, 24.46%, oklab(0% 0 0 / 10%) 43.6%, 77.4%, oklab(0% 0 0 / 60%) 100%)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-neutral-400" />
      )}
    </>
  );
}
