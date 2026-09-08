import { create } from 'zustand';

// 按来源记录隔离结果，来源卡片卸载后任务仍能写回；不改动原始资产。
export const useMultiAngleStore = create((set) => ({
  resultsBySource: {},
  update: (source, transform) => set((state) => ({ resultsBySource: { ...state.resultsBySource, [source]: transform(state.resultsBySource[source] || []) } })),
}));
