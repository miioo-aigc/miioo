/** 同节点覆盖；文本接口仅返回终态正文，无服务端任务编号，提交锁保留到终态。 */
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
    try {
      setNodes((current) => beginCanvasTextGeneration(current, plan), { origin: 'system' });
      const output = await apiGenerateCanvasText({ ...plan, signal: controller.signal });
      if (!controller.signal.aborted) {
        setNodes((current) => applyCanvasTextResult(current, plan, output), { record: false, origin: 'system' });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`文本创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => recoverCanvasTextGenerationFailure(current, plan), { record: false, origin: 'system' });
      }
      controller.abort();
    } finally {
      requests.finish(plan.requestId);
    }
  }, [nodes, setNodes, requests, cancelPendingClicks]);
}
