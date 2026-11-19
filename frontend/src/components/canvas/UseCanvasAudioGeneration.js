/** 音频创作请求、取消与五任务并发保护。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';
import { planCanvasAudioGeneration, beginCanvasAudioGeneration, acceptCanvasAudioSubmission, finishCanvasAudioGeneration } from './CanvasAudioGeneration';
import { dispatchCanvasAssetsChanged } from '../../utils/canvasAssetsEvents';

export function useCanvasAudioGeneration(nodes, setNodes, cancelPendingClicks, creationSessionId, canvasId, projectId) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {} }) => {
    if (!creationSessionId) {
      showGlobalToast('创作会话尚未加载，请稍后重试', 'error');
      return;
    }
    let plan;
    let controller;
    let begun = false;
    try {
      plan = planCanvasAudioGeneration(nodes, nodeId, prompt, model, params);
      controller = requests.start(plan);
      setNodes((current) => {
        const next = beginCanvasAudioGeneration(current, plan);
        begun = next !== current;
        return next;
      }, { origin: 'system' });
      if (!begun) throw new Error('当前音频节点状态已变化，已取消本次创作');
    } catch (error) {
      if (plan && begun) setNodes((current) => finishCanvasAudioGeneration(current, plan), { origin: 'system', record: false });
      if (controller && plan) requests.finish(plan.requestId);
      showGlobalToast(error.message, 'error'); return;
    }
    cancelPendingClicks();
    try {
      const files = plan.sources.filter((source) => source.type === 'audio' && source.asset?.url).map((source) => source.asset);
      const result = await apiGenerateCreation({ ...plan.params, genType: 'dubbing', prompt: plan.prompt,
        model: plan.model, files, canvasAudioReferences: true, project_id: projectId, session_id: creationSessionId }, { signal: controller.signal,
        onProgress: createCanvasProgressHandler(setNodes, plan.requestId, controller.signal),
        onTaskCreated: (task) => {
          if (controller.signal.aborted) return;
          plan.taskIds = [...new Set([...(plan.taskIds || []), ...(task?.taskIds || [task?.taskId]).filter(Boolean)])];
          setNodes((current) => acceptCanvasAudioSubmission(current, plan, task), { origin: 'system', record: false });
        } });
      const url = result?.audios?.[0];
      const assetId = result?.audioAssetIds?.[0];
      if (!url) throw new Error('音频生成未返回有效结果');
      if (!assetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
        throw new Error('音频生成未返回永久资产编号，旧结果已保留');
      }
      if (!controller.signal.aborted) {
        let wroteResult = false;
        const accepted = setNodes((current) => {
          const next = finishCanvasAudioGeneration(current, plan,
            { url, asset_id: assetId, asset_type: 'audio', source: 'ai-generated', transcript: plan.prompt });
          const target = next.find((node) => node.id === plan.nodeId);
          wroteResult = target?.data?.asset?.asset_id === assetId
            && target.data.nodeResults?.batches
              ?.some((batch) => batch.results.some((result) => result.assetId === assetId));
          return next;
        }, { origin: 'system', record: false });
        if (accepted !== false && wroteResult) dispatchCanvasAssetsChanged(canvasId);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`音频创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => finishCanvasAudioGeneration(current, plan), { origin: 'system', record: false });
      }
    } finally { requests.finish(plan.requestId); }
  }, [cancelPendingClicks, canvasId, creationSessionId, nodes, projectId, requests, setNodes]);
}
