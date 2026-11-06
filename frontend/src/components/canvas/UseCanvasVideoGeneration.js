/** 视频在原节点提交和覆盖；真实任务编号在 API 受理后、轮询前通知。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';
import { acceptCanvasVideoSubmission, getCanvasGeneratedVideoAsset, applyCanvasVideoResult, beginCanvasVideoGeneration, planCanvasVideoGeneration, recoverCanvasVideoGenerationFailure } from './CanvasVideoGeneration';

export function useCanvasVideoGeneration(nodes, setNodes, cancelPendingClicks) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {}, capabilities, generationMode }) => {
    const systemSetNodes = (updater, options = {}) => setNodes(updater, { ...options, origin: 'system' });
    let plan;
    let controller;
    try {
      plan = planCanvasVideoGeneration(nodes, nodeId, prompt, model, { ...params, capabilities, generationMode });
      controller = requests.start(plan);
    } catch (error) {
      showGlobalToast(error.message, 'error');
      return;
    }
    cancelPendingClicks();
    try {
      systemSetNodes((current) => beginCanvasVideoGeneration(current, plan));
      const files = plan.sources.filter((source) => source.type !== 'text' && source.asset?.url).map((source) => source.asset);
      const referenceMaterials = plan.referenceMaterials;
      const result = await apiGenerateCreation({ genType: 'video', prompt: plan.prompt, model: plan.model, files, referenceMaterials, ...plan.params }, {
        signal: controller.signal, onProgress: createCanvasProgressHandler(systemSetNodes, plan.requestId, controller.signal),
        onTaskCreated: (task) => {
          if (controller.signal.aborted) return;
          const taskIds = Array.isArray(task?.taskIds) && task.taskIds.length
            ? task.taskIds : [task?.taskId].filter(Boolean);
          plan.taskIds = [...new Set(taskIds)];
          systemSetNodes((current) => acceptCanvasVideoSubmission(current, plan, task), { record: false });
        },
      });
      if (controller.signal.aborted) return;
      const asset = getCanvasGeneratedVideoAsset(result);
      if (!controller.signal.aborted) systemSetNodes((current) => applyCanvasVideoResult(current, plan, asset), { record: false });
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`视频创作失败：${error.message || '请重试'}`, 'error');
        systemSetNodes((current) => recoverCanvasVideoGenerationFailure(current, plan), { record: false });
      }
      controller.abort();
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, nodes, requests, setNodes]);
}
