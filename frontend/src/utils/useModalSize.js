import { useState, useEffect, useCallback } from 'react';

/**
 * 详情图弹窗统一尺寸：保持 3:2，最大占视口 90%，最小为 1200×800。
 *
 * width/height 是弹窗的基准布局尺寸；scale 用于把基准内容整体等比缩放。
 */
export function useModalSize(baseWidth = 1200, baseHeight = 800) {
  const calc = useCallback(() => {
    const scale = Math.min(
      0.9 * window.innerWidth / baseWidth,
      0.9 * window.innerHeight / baseHeight,
    );
    const displayScale = Math.max(scale, 1);
    return {
      width: baseWidth,
      height: baseHeight,
      scale: displayScale,
    };
  }, [baseHeight, baseWidth]);
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const handler = () => setSize(calc());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [calc]);
  return size;
}
