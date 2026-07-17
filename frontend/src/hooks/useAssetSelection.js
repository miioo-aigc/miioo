/**
 * @file useAssetSelection.js
 * @structure-index
 *
 * ─── 状态 ───────────────────────────────────────────────────────────
 *   batchMode / selected       批量模式与当前选中项
 *
 * ─── 操作 ───────────────────────────────────────────────────────────
 *   enterBatch / toggleSelect / selectAll / exitBatch
 *
 * ─── 数据边界 ───────────────────────────────────────────────────────
 *   只管理资产列表的通用选中状态，不调用 API、不读取业务 Store，
 *   批量删除、下载和确认弹窗仍由页面或业务区块负责。
 */

import { useCallback, useState } from 'react';

export function useAssetSelection() {
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const enterBatch = useCallback(() => setBatchMode(true), []);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids = []) => {
    setSelected((prev) => {
      const normalizedIds = [...ids];
      const isAllSelected = normalizedIds.length > 0
        && normalizedIds.every((id) => prev.has(id));
      return isAllSelected ? new Set() : new Set(normalizedIds);
    });
  }, []);

  const exitBatch = useCallback(() => {
    setBatchMode(false);
    setSelected(new Set());
  }, []);

  return {
    batchMode,
    selected,
    selectedCount: selected.size,
    enterBatch,
    toggleSelect,
    selectAll,
    exitBatch,
  };
}
