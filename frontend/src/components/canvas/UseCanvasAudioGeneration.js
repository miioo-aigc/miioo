/** 音频创作请求、取消与五任务并发保护。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';
import { planCanvasAudioGeneration, beginCanvasAudioGeneration, finishCanvasAudioGeneration } from './CanvasAudioGeneration';

export function useCanvasAudioGeneration(nodes, setNodes, cancelPendingClicks) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {} }) => {
    let plan;
    let controller;
    try {
      plan = planCanvasAudioGeneration(nodes, nodeId, prompt, model, params);
      controller = requests.start(plan);
    } catch (error) { showGlobalToast(error.message, 'error'); return; }
    cancelPendingClicks();
    setNodes((current) => beginCanvasAudioGeneration(current, plan));
    try {
      const files = plan.sources.filter((source) => source.type === 'audio' && source.asset?.url).map((source) => source.asset);
      const result = await apiGenerateCreation({ ...plan.params, genType: 'dubbing', prompt: plan.prompt,
        model: plan.model, files, canvasAudioReferences: true }, { signal: controller.signal, onProgress: createCanvasProgressHandler(setNodes, plan.requestId, controller.signal) });
      const url = result?.audios?.[0];
      if (!url) throw new Error('音频生成未返回有效结果');
      if (!controller.signal.aborted) setNodes((current) => finishCanvasAudioGeneration(current, plan,
        { url, asset_type: 'audio', source: 'ai-generated', transcript: plan.prompt }), { record: false });
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`音频创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => finishCanvasAudioGeneration(current, plan), { record: false });
      }
    } finally { requests.finish(plan.requestId); }
  }, [cancelPendingClicks, nodes, requests, setNodes]);
}
