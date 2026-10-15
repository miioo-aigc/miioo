import { create } from 'zustand';
import { waitForAssetTask } from '../api/tasks';
import { apiGetCompositions, invalidateCompositionDependents } from '../api/compositions';
import { getErrorMessage } from '../api/error';

export function exportProgress(task) {
  const value = task?.progress ?? task?.progress_percent;
  return value == null || value === '' || !Number.isFinite(Number(value))
    ? null : Math.max(0, Math.min(100, Number(value)));
}

export const useCompositionExportStore = create((set, get) => ({
  tasks: [],
  dismiss: (taskId) => set((state) => ({ tasks: state.tasks.filter((task) => task.taskId !== taskId || task.status === 'exporting') })),
  watch: async (record, onUpdate) => {
    if (get().tasks.some((task) => task.taskId === record.taskId)) return;
    const initial = { ...record, status: 'exporting', progress: null };
    set((state) => ({ tasks: [...state.tasks, initial] }));
    const update = (patch) => {
      set((state) => ({ tasks: state.tasks.map((task) => task.taskId === record.taskId ? { ...task, ...patch } : task) }));
      onUpdate?.(get().tasks.find((task) => task.taskId === record.taskId));
    };
    update({});
    try {
      const task = await waitForAssetTask(record.taskId, {
        source: 'composition-export', metadata: { projectId: record.projectId, compositionId: record.compositionId },
        onUpdate: (value) => update({ progress: exportProgress(value) }),
      });
      if (String(task.status).toLowerCase() === 'partial') throw new Error('成片导出未全部完成，请检查任务后重试');
      const result = task.results?.find((item) => item.success !== false && (item.asset_id || item.url)) || {};
      let outputUrl = result.url || task.output_url || task.outputUrl;
      try {
        await invalidateCompositionDependents(record.projectId);
        const list = await apiGetCompositions(record.projectId);
        const draft = list.find((item) => item.id === record.compositionId);
        outputUrl = draft?.outputUrl || draft?.output_url || outputUrl;
      } catch { /* 详情刷新失败仍保留任务结果。 */ }
      const assetId = result.asset_id || result.assetId || task.asset_id;
      if (!assetId && !outputUrl) throw new Error('导出任务已结束，但未返回成片文件，请检查任务');
      update({ status: 'completed', progress: 100, assetId, outputUrl });
    } catch (error) {
      update({ status: 'failed', error: getErrorMessage(error, '导出状态读取失败，请检查任务') });
    }
  },
}));
