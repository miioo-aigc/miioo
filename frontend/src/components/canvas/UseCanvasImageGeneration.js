/** 图片节点原位创作；永久资产按稳定索引提交同一结果批次。
 * 2026-11-06：受理后登记真实任务编号，部分成功保留候选并提示数量。
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { ensureCanvasImageAsset } from '../../api/canvasAssets';
import { getAuthSessionGeneration } from '../../api/request';
import { showGlobalToast } from '../../stores/toastStore';
import { applyCanvasImageResult, beginCanvasImageGeneration, getCanvasImageGenerationSummary, getCanvasImageResultAssets, planCanvasImageGeneration, recoverCanvasImageGenerationFailure } from './CanvasImageGeneration';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';

export function useCanvasImageGeneration(nodes, setNodes, cancelPendingClicks, projectId) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {} }) => {
    const systemSetNodes = (update, options = {}) => setNodes(update, { ...options, origin: 'system' });
    let plan;
    let controller;
    try {
      plan = planCanvasImageGeneration(nodes, nodeId, prompt, model, params);
      controller = requests.start(plan);
    } catch (error) {
      showGlobalToast(error.message, 'error');
      return;
    }
    cancelPendingClicks();
    try {
      systemSetNodes((current) => beginCanvasImageGeneration(current, plan));
    } catch (error) {
      requests.finish(plan.requestId);
      showGlobalToast(error.message, 'error');
      return;
    }
    try {
      const session = getAuthSessionGeneration();
      const sources = await Promise.all(plan.sources.map(async (source) => {
        if (source.type !== 'image') return source;
        const asset = await ensureCanvasImageAsset(source.asset, { projectId });
        return { ...source, asset };
      }));
      controller.signal.throwIfAborted();
      if (session !== getAuthSessionGeneration()) return;
      plan.sources = sources;
      systemSetNodes((current) => current.map((node) => {
        const index = plan.sources.findIndex((source) => source.id === node.id && source.type === 'image' && source.asset?.url === node.data?.asset?.url);
        return index < 0 ? node : { ...node, data: { ...node.data, asset: { ...node.data.asset, ...sources[index].asset, file: undefined } } };
      }), { record: false });
      const imageReferences = sources.filter((source) => source.type === 'image').map((source) => source.asset);
      const referenceMaterials = sources.filter((source) => source.type === 'text' ? !plan.usesTextAsPrompt && source.content?.trim() : source.asset);
      const result = await apiGenerateCreation({ ...plan.params, canvasPartialResults: true, genType: 'image', prompt: plan.prompt, model: plan.model, files: imageReferences, referenceMaterials, project_id: projectId }, {
        signal: controller.signal, onProgress: createCanvasProgressHandler(systemSetNodes, plan.requestId, controller.signal),
        onTaskCreated: ({ taskIds } = {}) => {
          if (!Array.isArray(taskIds) || taskIds.length === 0
            || taskIds.some((taskId) => typeof taskId !== 'string' || !taskId.trim())) return;
          plan.taskIds = [...new Set(taskIds)];
          if (controller.signal.aborted || session !== getAuthSessionGeneration()) return;
          systemSetNodes((current) => current.map((node) => node.id === plan.nodeId && node.data.generationRequestId === plan.requestId
            ? { ...node, data: { ...node.data, generationTaskIds: plan.taskIds, submissionLocked: false } } : node), { record: false });
        },
      });
      const results = getCanvasImageResultAssets(result);
      const { successCount } = getCanvasImageGenerationSummary(plan, results);
      if (!successCount) throw new Error('图片生成未返回具有永久资产编号的有效结果');
      const assets = await Promise.all(results.map((asset) => asset ? prepareCanvasMediaAsset(asset) : null));
      if (!controller.signal.aborted && session === getAuthSessionGeneration()) {
        systemSetNodes((current) => applyCanvasImageResult(current, plan, assets), { record: false });
        if (successCount < plan.requestedCount) showGlobalToast(`本次成功生成 ${successCount} / ${plan.requestedCount} 张图片`, 'warning');
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`图片创作失败：${error.message || '请重试'}`, 'error');
        systemSetNodes((current) => recoverCanvasImageGenerationFailure(current, plan), { record: false });
      }
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, nodes, projectId, requests, setNodes]);
}
