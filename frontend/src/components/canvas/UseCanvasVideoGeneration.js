/** 画布视频生成任务：请求前创建结果节点，失败保留空节点并仅 Toast 提示。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { applyCanvasVideoResult, beginCanvasVideoGeneration, planCanvasVideoGeneration, recoverCanvasVideoGenerationFailure } from './CanvasVideoGeneration';

export function useCanvasVideoGeneration(nodes, setNodes, cancelPendingClicks) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {}, capabilities, generationMode }) => {
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
    setNodes((current) => beginCanvasVideoGeneration(current, plan));
    const files = plan.sources.filter((source) => source.type !== 'text' && source.asset?.url).map((source) => source.asset);
    const referenceMaterials = plan.sources.filter((source) => source.type === 'text' && source.content?.trim());
    try {
      const result = await apiGenerateCreation({ genType: 'video', prompt: plan.prompt, model: plan.model, files, referenceMaterials, ...plan.params }, { signal: controller.signal });
      const videoUrl = result?.videos?.[0] || result?.videoUrl || result?.url;
      const asset = videoUrl ? { url: videoUrl, asset_type: 'video', source: 'ai-generated', posterUrl: result?.posterUrl } : null;
      if (!asset?.url) throw new Error('视频生成未返回有效结果');
      if (!controller.signal.aborted) setNodes((current) => applyCanvasVideoResult(current, plan, asset), { record: false });
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`视频创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => recoverCanvasVideoGenerationFailure(current, plan), { record: false });
      }
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, nodes, requests, setNodes]);
}
