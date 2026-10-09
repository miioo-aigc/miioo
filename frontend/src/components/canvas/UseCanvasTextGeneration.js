/** 独立文本任务生命周期；最多5个，同源可并发，删除结果或切换页面时中止。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCanvasText } from '../../api/llm';
import { showGlobalToast } from '../../stores/toastStore';
import { applyCanvasTextResult, beginCanvasTextGeneration, planCanvasTextGeneration, recoverCanvasTextGenerationFailure } from './CanvasTextGeneration';
import { createCanvasTextRequests } from './CanvasTextRequests';

export function useCanvasTextGeneration(nodes, setNodes, canvasId, cancelPendingClicks) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => {
    return () => requests.abortAll();
  }, [canvasId, requests]);
  useEffect(() => {
    requests.reconcile(nodes);
  }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model }) => {
    let plan;
    let controller;
    try {
      plan = planCanvasTextGeneration(nodes, nodeId, prompt, model);
      controller = requests.start(plan);
    }
    catch (error) { showGlobalToast(error.message, 'error'); return; }
    cancelPendingClicks();
    setNodes((current) => beginCanvasTextGeneration(current, plan));
    try {
      const output = await apiGenerateCanvasText({ ...plan, signal: controller.signal });
      if (!controller.signal.aborted) {
        setNodes((current) => applyCanvasTextResult(current, plan, output), { record: false });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`文本创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => recoverCanvasTextGenerationFailure(current, plan), { record: false });
      }
    } finally {
      requests.finish(plan.requestId);
    }
  }, [nodes, setNodes, requests, cancelPendingClicks]);
}
