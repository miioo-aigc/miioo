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
  return getCanvasMediaSize(asset) || (resolved?.source === asset ? resolved.size : null);
}
