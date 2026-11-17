import { useEffect, useRef } from 'react';
import { getAssetFolderGridSizing } from './AssetFolderGridSizing';

/** 按最小宽度确定列数，均分空间并限制上限；数量不足时仍保留空列。 */
export default function AssetFolderGrid({
  children,
  className = '',
  gap = 16,
  minCardWidth = 216,
  maxCardWidth = 270,
}) {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { columns, cardWidth } = getAssetFolderGridSizing(
        entry.contentRect.width,
        gap,
        minCardWidth,
        maxCardWidth,
      );
      grid.style.setProperty('--asset-folder-columns', `repeat(${columns}, ${cardWidth}px)`);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gap, maxCardWidth, minCardWidth]);

  const maxTrack = Number.isFinite(maxCardWidth) ? `${maxCardWidth}px` : '1fr';

  return (
    <div
      ref={gridRef}
      className={`grid items-start justify-start ${className}`}
      style={{ gridTemplateColumns: `var(--asset-folder-columns, repeat(auto-fill, minmax(min(${minCardWidth}px, 100%), ${maxTrack})))`, gap }}
    >
      {children}
    </div>
  );
}
