import { useEffect, useRef } from 'react';
import { getAssetFolderGridSizing } from './AssetFolderGridSizing';

/** 按最小宽度确定列数，均分空间并限制上限；数量不足时仍保留空列。 */
export default function AssetFolderGrid({ children, className = '', gap = 16 }) {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { columns, cardWidth } = getAssetFolderGridSizing(entry.contentRect.width, gap);
      grid.style.setProperty('--asset-folder-columns', `repeat(${columns}, ${cardWidth}px)`);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gap]);

  return (
    <div
      ref={gridRef}
      className={`grid items-start justify-start ${className}`}
      style={{ gridTemplateColumns: 'var(--asset-folder-columns, repeat(auto-fill, minmax(min(216px, 100%), 270px)))', gap }}
    >
      {children}
    </div>
  );
}
