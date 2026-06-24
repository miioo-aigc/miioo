import { useState, useEffect } from 'react';

/**
 * 根据当前视口尺寸计算弹窗尺寸。
 * 基准分辨率 1920×1080 对应基准弹窗 1200×800，按比例缩放，不超过 1.0 倍。
 * 最小尺寸：800×600。
 *
 * @param {number} baseWidth  基准宽度，默认 1200
 * @param {number} baseHeight 基准高度，默认 800
 * @returns {{ width: number, height: number }}
 */
export function useModalSize(baseWidth = 1200, baseHeight = 800) {
  const calc = () => {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080, 1.0);
    return {
      width: Math.max(Math.round(baseWidth * scale), 800),
      height: Math.max(Math.round(baseHeight * scale), 600),
    };
  };
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const handler = () => setSize(calc());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}
