/** 图片节点创作任务；结果节点在请求前创建，失败保留空节点。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { applyCanvasImageResult, beginCanvasImageGeneration, planCanvasImageGeneration, recoverCanvasImageGenerationFailure } from './CanvasImageGeneration';
import { createCanvasTextRequests } from './CanvasTextRequests';

export function useCanvasImageGeneration(nodes, setNodes, cancelPendingClicks) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {} }) => {
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
    setNodes((current) => beginCanvasImageGeneration(current, plan));
    const imageReferences = plan.sources.filter((source) => source.type === 'image').map((source) => source.asset).filter((asset) => asset?.url);
    try {
      const result = await apiGenerateCreation({ genType: 'image', prompt: plan.prompt, model: plan.model, files: imageReferences, referenceMaterials: plan.sources, ...plan.params }, { signal: controller.signal });
      const imageUrl = result?.images?.[0] || result?.imageDownloadUrls?.[0] || result?.imageOriginalUrls?.[0];
      const asset = imageUrl ? { url: imageUrl, asset_type: 'image', source: 'ai-generated' } : null;
      if (!asset?.url) throw new Error('图片生成未返回有效结果');
      if (!controller.signal.aborted) setNodes((current) => applyCanvasImageResult(current, plan, asset), { record: false });
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`图片创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => recoverCanvasImageGenerationFailure(current, plan), { record: false });
      }
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, nodes, requests, setNodes]);
}
