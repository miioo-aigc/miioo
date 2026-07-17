/**
 * @file useAssetPagination.js
 * @structure-index
 *
 * ─── 状态 ───────────────────────────────────────────────────────────
 *   pageMeta                         按项目与类别索引的游标分页状态
 *
 * ─── 状态转换 ───────────────────────────────────────────────────────
 *   startPage / markPageLoading      开始首屏或追加加载
 *   completeFirstPage                写入首屏分页结果
 *   completeMorePage                 写入追加分页结果
 *   failFirstPage / failMorePage    保留原有失败状态语义
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只管理分页状态转换，不调用 API、不创建观察器；请求和
 *   IntersectionObserver 生命周期仍由 ProjectAssetsPanel 持有。
 */

import { useCallback, useState } from 'react';

const EMPTY_PAGE = {
  cursor: null,
  hasMore: false,
  loading: false,
  rawList: [],
};

export function useAssetPagination() {
  const [pageMeta, setPageMeta] = useState({});

  const startPage = useCallback((key) => {
    setPageMeta((prev) => ({ ...prev, [key]: { ...EMPTY_PAGE, loading: true } }));
  }, []);

  const markPageLoading = useCallback((key) => {
    setPageMeta((prev) => ({ ...prev, [key]: { ...prev[key], loading: true } }));
  }, []);

  const completeFirstPage = useCallback((key, { cursor, hasMore, rawList }) => {
    setPageMeta((prev) => ({
      ...prev,
      [key]: { cursor, hasMore, loading: false, rawList },
    }));
  }, []);

  const completeMorePage = useCallback((key, { cursor, hasMore, rawList }) => {
    setPageMeta((prev) => ({
      ...prev,
      [key]: { cursor, hasMore, loading: false, rawList },
    }));
  }, []);

  const failFirstPage = useCallback((key) => {
    setPageMeta((prev) => ({ ...prev, [key]: { ...EMPTY_PAGE } }));
  }, []);

  const failMorePage = useCallback((key) => {
    setPageMeta((prev) => ({
      ...prev,
      [key]: { ...prev[key], loading: false },
    }));
  }, []);

  const removeFromRawList = useCallback((key, ids = []) => {
    const removedIds = new Set(ids.map((id) => String(id)));
    setPageMeta((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          rawList: (current.rawList || []).filter((asset) => !removedIds.has(String(asset.id))),
        },
      };
    });
  }, []);

  return {
    pageMeta,
    startPage,
    markPageLoading,
    completeFirstPage,
    completeMorePage,
    failFirstPage,
    failMorePage,
    removeFromRawList,
  };
}
