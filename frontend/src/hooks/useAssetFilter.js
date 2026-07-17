/**
 * @file useAssetFilter.js
 * @structure-index
 *
 * ─── 状态 ───────────────────────────────────────────────────────────
 *   activeCategory / favoriteOnly       资产类别与收藏筛选状态
 *
 * ─── 操作 ───────────────────────────────────────────────────────────
 *   handleCategoryChange                 切换类别并清理收藏筛选
 *   filterAssets                         根据筛选状态返回展示列表
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只负责资产列表筛选状态和纯列表过滤，不调用 API、不读取 Store，
 *   项目资产加载和业务副作用仍由 AssetsPage 持有。
 */

import { useCallback, useState } from 'react';

export function useAssetFilter(initialCategory) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const handleCategoryChange = useCallback((category) => {
    setActiveCategory(category);
    setFavoriteOnly(false);
  }, []);

  const filterAssets = useCallback((assets = []) => {
    if (!favoriteOnly) return assets;
    return assets.filter((asset) => asset.starred);
  }, [favoriteOnly]);

  return {
    activeCategory,
    favoriteOnly,
    setFavoriteOnly,
    handleCategoryChange,
    filterAssets,
  };
}
