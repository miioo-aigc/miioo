/** 图片节点创作任务；批量结果在请求前创建，按索引回填，失败保留空节点。
 * 2026-10-26：编号缺失保留可下载结果并明确提示无法保存。
 * 2026-10-26：完整接收多图，复用轻量预览尺寸探测后排布。
 */
import { useCallback, useEffect, useState } from 'react';
import { apiGenerateCreation } from '../../api/creation';
import { ensureCanvasImageAsset } from '../../api/canvasAssets';
import { getAuthSessionGeneration } from '../../api/request';
import { getImageReferenceId } from '../../api/ImageReferences';
import { showGlobalToast } from '../../stores/toastStore';
import { applyCanvasImageResult, beginCanvasImageGeneration, getCanvasImageResultAssets, planCanvasImageGeneration, recoverCanvasImageGenerationFailure } from './CanvasImageGeneration';
import { prepareCanvasMediaAsset } from './CanvasMediaSize';
import { createCanvasTextRequests } from './CanvasTextRequests';
import { createCanvasProgressHandler } from './CanvasGenerationProgress';

export function useCanvasImageGeneration(nodes, setNodes, cancelPendingClicks, projectId) {
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
    try {
      const session = getAuthSessionGeneration();
      const sources = await Promise.all(plan.sources.map(async (source) => {
        if (source.type !== 'image') return source;
        const asset = await ensureCanvasImageAsset(source.asset, { projectId });
        return { ...source, asset };
      }));
      controller.signal.throwIfAborted();
      if (session !== getAuthSessionGeneration()) return;
      setNodes((current) => current.map((node) => {
        const index = plan.sources.findIndex((source) => source.id === node.id && source.type === 'image' && source.asset?.url === node.data?.asset?.url);
        return index < 0 ? node : { ...node, data: { ...node.data, asset: { ...node.data.asset, ...sources[index].asset, file: undefined } } };
      }), { record: false });
      const imageReferences = sources.filter((source) => source.type === 'image').map((source) => source.asset);
      const referenceMaterials = sources.filter((source) => source.type === 'text' ? source.content?.trim() : source.asset);
      const result = await apiGenerateCreation({ ...plan.params, genType: 'image', prompt: plan.prompt, model: plan.model, files: imageReferences, referenceMaterials, project_id: projectId }, { signal: controller.signal, onProgress: createCanvasProgressHandler(setNodes, plan.requestId, controller.signal) });
      const results = getCanvasImageResultAssets(result);
      if (!results.some((asset) => asset?.url)) throw new Error('图片生成未返回有效结果');
      const assets = await Promise.all(results.map((asset) => asset ? prepareCanvasMediaAsset(asset) : null));
      if (!controller.signal.aborted) {
        setNodes((current) => applyCanvasImageResult(current, plan, assets), { record: false });
        if (assets.some((asset) => asset && !getImageReferenceId(asset))) {
          showGlobalToast('图片已生成，画布资产编号丢失，最新结果无法保存，请及时下载到本地', 'warning');
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        showGlobalToast(`图片创作失败：${error.message || '请重试'}`, 'error');
        setNodes((current) => recoverCanvasImageGenerationFailure(current, plan), { record: false });
      }
    } finally {
      requests.finish(plan.requestId);
    }
  }, [cancelPendingClicks, nodes, projectId, requests, setNodes]);
}
