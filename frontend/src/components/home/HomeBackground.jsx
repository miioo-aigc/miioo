/**
 * @file HomeBackground.jsx
 * @structure-index
 *
 * ─── 展示层 ─────────────────────────────────────────────────────
 *   HomeBackground                                               首页背景视频、遮罩和非首页底色
 *
 * ─── 依赖边界 ──────────────────────────────────────────────────
 *   仅通过 isHome、videoRef、videoSrc 和 onVideoEnded 接收页面状态与事件；
 *   不读取导航、认证或业务数据，不执行视频切换副作用。
 *
 * ─── 更新记录 ──────────────────────────────────────────────────
 *   2026-07-16  从 Home.jsx 抽离背景展示层；页面继续负责视频索引和切换回调
 */

export default function HomeBackground({ isHome, videoRef, videoSrc, onVideoEnded }) {
  return (
    <>
      {isHome ? (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
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
