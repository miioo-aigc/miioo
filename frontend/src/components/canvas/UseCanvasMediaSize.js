import { useEffect, useState } from 'react';
import { getCanvasMediaSize, prepareCanvasMediaAsset } from './CanvasMediaSize';

export function useCanvasMediaSize(asset) {
  const [resolved, setResolved] = useState(null);
  useEffect(() => {
    let active = true;
    prepareCanvasMediaAsset(asset).then((value) => {
      if (active) setResolved({ source: asset, size: getCanvasMediaSize(value) });
    });
    return () => { active = false; };
  }, [asset]);
  // 原图探测完成后覆盖历史宽高，也修复重新打开的旧节点。
  return (resolved?.source === asset ? resolved.size : null) || getCanvasMediaSize(asset);
}
