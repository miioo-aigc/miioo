/** 视频在原节点提交和覆盖；真实任务编号在 API 受理后、轮询前通知。 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { showGlobalToast } from '../../stores/toastStore';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';
import { acceptCanvasVideoSubmission, getCanvasGeneratedVideoAsset, applyCanvasVideoResult, beginCanvasVideoGeneration, planCanvasVideoGeneration, recoverCanvasVideoGenerationFailure } from './CanvasVideoGeneration';
import { dispatchCanvasAssetsChanged } from '../../utils/canvasAssetsEvents';
import { validateSeedance20AudioReferences } from '../../utils/SeedanceAudioValidation';

export function useCanvasVideoGeneration(nodes, setNodes, cancelPendingClicks, creationSessionId, canvasId, projectId) {
  const [requests] = useState(createCanvasTextRequests);
  useEffect(() => () => requests.abortAll(), [requests]);
  useEffect(() => { requests.reconcile(nodes); }, [nodes, requests]);
  return useCallback(async ({ nodeId, prompt, model, params = {}, capabilities, generationMode, onAccepted, onRejected }) => {
    if (!creationSessionId) {
      showGlobalToast('创作会话尚未加载，请稍后重试', 'error');
      return;
    }
    const systemSetNodes = (updater, options = {}) => setNodes(updater, { ...options, origin: 'system' });
    let plan;
    let controller;
    try {
      plan = planCanvasVideoGeneration(nodes, nodeId, prompt, model, { ...params, capabilities, generationMode });
      // Seedance 2.0 家族的音频参考在点击生成时统一校验并提示；2.5 不限制。
      const audioValidation = await validateSeedance20AudioReferences(
        plan.sources.filter((source) => source.type === 'audio').map((source) => source.asset),
        { modelId: model, modelName: params.modelName },
      );
      if (!audioValidation.ok) throw new Error(audioValidation.message);
      controller = requests.start(plan);
    } catch (error) {
      onRejected?.(error.message);
      showGlobalToast(error.message, 'error');
      return;
    }
    cancelPendingClicks();
    try {
      systemSetNodes((current) => beginCanvasVideoGeneration(current, plan));
      const files = plan.sources.filter((source) => source.type !== 'text' && source.asset?.url).map((source) => source.asset);
      const referenceMaterials = plan.referenceMaterials;
      const result = await apiGenerateCreation({ genType: 'video', prompt: plan.prompt, model: plan.model, files, referenceMaterials, ...plan.params, project_id: projectId, session_id: creationSessionId }, {
        signal: controller.signal, onProgress: createCanvasProgressHandler(systemSetNodes, plan.requestId, controller.signal),
        onTaskCreated: (task) => {
          if (controller.signal.aborted) return;
          const taskIds = Array.isArray(task?.taskIds) && task.taskIds.length
            ? task.taskIds : [task?.taskId].filter(Boolean);
          plan.taskIds = [...new Set(taskIds)];
          systemSetNodes((current) => acceptCanvasVideoSubmission(current, plan, task), { record: false });
          if (taskIds.length) onAccepted?.();
        },
      });
      if (controller.signal.aborted) return;
      const asset = getCanvasGeneratedVideoAsset(result);
      onAccepted?.();
      if (!controller.signal.aborted) {
        let wroteResult = false;
        const accepted = systemSetNodes((current) => {
          const next = applyCanvasVideoResult(current, plan, asset);
          const target = next.find((node) => node.id === plan.resultId);
          wroteResult = target?.data?.asset?.asset_id === asset.asset_id
            && target.data.nodeResults?.batches
              ?.some((batch) => batch.results.some((result) => result.assetId === asset.asset_id));
          return next;
        }, { record: false });
        if (accepted !== false && wroteResult) dispatchCanvasAssetsChanged(canvasId);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        onRejected?.(error.message || '请重试');
        showGlobalToast(`视频创作失败：${error.message || '请重试'}`, 'error');
        systemSetNodes((current) => recoverCanvasVideoGenerationFailure(current, plan), { record: false });
      }
      controller.abort();
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, canvasId, creationSessionId, nodes, projectId, requests, setNodes]);
}
