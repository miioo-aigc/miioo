/**
 * @file ScriptActionLoadingOverlay.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   展示剧本 AI 操作期间保留的模糊遮罩和品牌加载动画
 *   不管理请求、不调用 API，只负责反馈层视觉
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-22  新增分集重排和本集重写共用的加载遮罩
 *   2026-07-27  加载时限制在剧本内容区，保留顶部和左侧导航可见
 */
import { useEffect, useState } from 'react';
import LoadingAnimation from '../LoadingAnimation';

function getBounds(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export default function ScriptActionLoadingOverlay({ containerRef }) {
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    const element = containerRef?.current;
    if (!element) return undefined;

    let frameId = null;
    const updateBounds = () => {
      frameId = null;
      setBounds(getBounds(element));
    };
    const scheduleUpdate = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateBounds);
    };

    updateBounds();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(element);

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [containerRef]);

  if (!bounds) return null;

  return (
    <div
      role="status"
      aria-label="正在处理"
      style={{
        position: 'fixed',
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <LoadingAnimation width={200} />
    </div>
  );
}
