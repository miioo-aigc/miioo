/** 图片节点的有向素材连线、模型上限和生成快照规则。
 * 2026-11-06：图片批次原位提交，候选按返回索引保留，不创建结果节点。
 */
import { setCanvasSelection } from './CanvasGroups.js';
import { migrateLegacyCanvasResults } from './CanvasResultCompatibility.js';
import { commitCanvasNodeOutput } from './CanvasResultMutations.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function directSourceIds(target) {
  return [...new Set([...(target?.data?.referenceInputs || []).map((input) => input.sourceId),
    ...(target?.data?.imageSourceIds || []), ...(target?.data?.textSourceIds || [])])]
    .filter((id) => id !== target?.id);
}

function findNode(nodes, id) {
  return nodes.find((node) => node.id === id);
}

function imageReferenceLimit(node) {
  const value = node?.data?.imageReferenceLimit;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getImageReferenceLimit(capabilities) {
  // 图片模型能力由后端以 snake_case 返回；保留旧字段仅用于兼容历史草稿。
  const value = capabilities?.max_reference_images ?? capabilities?.maxReferenceImages;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isCanvasImageConnection(nodes, connection) {
  const source = findNode(nodes, connection.source);
  const target = findNode(nodes, connection.target);
  return ['text', 'image'].includes(source?.type) && target?.type === 'image' && source.id !== target.id
    && (!connection.sourceHandle || connection.sourceHandle === `${source.type}-output`)
    && (!connection.targetHandle || connection.targetHandle === 'image-input');
}

export function getCanvasImageReferenceStatus(nodes, targetId, limit) {
  const target = findNode(nodes, targetId);
  const sourceIds = directSourceIds(target)
    .filter((id) => ['text', 'image'].includes(findNode(nodes, id)?.type));
  const imageSourceIds = sourceIds.filter((id) => findNode(nodes, id)?.type === 'image');
  const effectiveLimit = Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target);
  const overflowSourceIds = imageSourceIds.slice(effectiveLimit);
  return { imageSourceIds, overflowSourceIds, canGenerate: imageSourceIds.length <= effectiveLimit };
}

export function hasUnsupportedCanvasImageReferences(nodes, targetId) {
  return getCanvasImageReferenceStatus(nodes, targetId).imageSourceIds.length > 0;
}

export function canConnectCanvasImage(nodes, connection, limit) {
  if (!isCanvasImageConnection(nodes, connection)) return false;
  const target = findNode(nodes, connection.target);
  const sourceIds = directSourceIds(target);
  if (sourceIds.includes(connection.source)) return true;
  if (findNode(nodes, connection.source)?.type !== 'image') return true;
  return getCanvasImageReferenceStatus(nodes, target.id, limit).imageSourceIds.length < (Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target));
}

export function getCanvasImageConnectionError(nodes, connection, limit) {
  if (!isCanvasImageConnection(nodes, connection)) return '该节点不接受此类型的连线';
  if (findNode(nodes, connection.source)?.type !== 'image') return '';
  const target = findNode(nodes, connection.target);
  const effectiveLimit = Number.isInteger(limit) && limit >= 0 ? limit : imageReferenceLimit(target);
  if (effectiveLimit === 0) return '当前图片模型不支持图片参考，无法连接图片节点';
  if (!canConnectCanvasImage(nodes, connection, effectiveLimit)) return `当前图片模型最多支持 ${effectiveLimit} 张参考图，无法继续连接`;
  return '';
}

export function connectCanvasImage(nodes, connection, limit, { retainInvalid = false } = {}) {
  if (!isCanvasImageConnection(nodes, connection)
    || (!retainInvalid && !canConnectCanvasImage(nodes, connection, limit))) return nodes;
  return setCanvasSelection(nodes.map((node) => node.id === connection.target ? {
    ...node,
    data: { ...node.data, imageSourceIds: [...new Set([...(node.data.imageSourceIds || []), connection.source])], persistenceState: 'draft' },
  } : node), [connection.target], true);
}

export function disconnectCanvasImage(nodes, target, source) {
  return nodes.map((node) => node.id === target ? {
    ...node,
    data: { ...node.data, imageSourceIds: (node.data.imageSourceIds || []).filter((id) => id !== source), persistenceState: 'draft' },
  } : node);
}

export function getCanvasImageEdges(nodes) {
  return nodes.filter((target) => target.type === 'image').flatMap((target) => [...new Set(target.data.imageSourceIds || [])]
    .map((sourceId) => ({ source: findNode(nodes, sourceId), target }))
    .filter(({ source }) => ['text', 'image'].includes(source?.type))
    .map(({ source, target }) => ({
      id: `image-material:${source.id}:${target.id}`,
      source: source.id,
      target: target.id,
      sourceHandle: `${source.type}-output`,
      targetHandle: 'image-input',
      data: { overflow: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) },
      className: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) ? 'canvas-edge--overflow' : undefined,
      style: { stroke: getCanvasImageReferenceStatus(nodes, target.id).overflowSourceIds.includes(source.id) ? 'var(--color-text-danger)' : 'var(--color-stroke-accent)', strokeWidth: 2 },
    })));
}

export function planCanvasImageGeneration(nodes, nodeId, prompt, model, params = {}) {
  if (nodes.find(node => node.id === nodeId)?.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') throw new Error('素材正在替换上传，请稍后再试');
  const target = findNode(nodes, nodeId);
  if (!target || target.type !== 'image') throw new Error('图片节点已不存在');
  if (target.data.generating || target.data.submissionLocked || target.data.editing || target.data.upstreamProtected) throw new Error('该节点正在创作或受到任务保护，请稍后再试');
  if (!model) throw new Error('请选择可用的图片模型');
  // 在发送前检查旧结果可迁移性；只有成功提交新结果才实际建立历史。
  migrateLegacyCanvasResults(target, { batchId: 'legacy-' + target.id, resultId: 'legacy-result-' + target.id });
  const status = getCanvasImageReferenceStatus(nodes, nodeId, params.imageReferenceLimit);
  if (!status.canGenerate) throw new Error('参考图片数量超过当前模型上限，请删除超出的参考图后再创作');
  const sources = directSourceIds(target).map((id) => {
    const source = findNode(nodes, id);
    if (!source || !['text', 'image'].includes(source.type)) throw new Error('直接参考节点已失效，请检查参考素材');
    if (source.data.generating || source.data.submissionLocked || source.data.editing) throw new Error('直接上游正在创作，请稍后再试');
    if (source.type === 'text' ? !source.data.content?.trim()
      : !source.data.asset?.url || ['missing', 'forbidden'].includes(source.data.asset.availability)) throw new Error('直接参考没有有效结果，请检查参考素材');
    return { id: source.id, type: source.type, label: source.data.label,
      ...(source.type === 'text' ? { content: source.data.content } : { asset: { ...source.data.asset } }),
      resultId: source.data.nodeResults?.currentResultId || null };
  });
  const effectivePrompt = prompt?.trim() ? prompt : sources.filter((source) => source.type === 'text').map((source) => source.content).join('\n\n');
  if (!effectivePrompt?.trim()) throw new Error('请输入创作提示词或连接有效文本');
  const mediaParams = structuredClone(params);
  delete mediaParams.imageReferenceLimit;
  const requestedCount = Math.max(1, Number.parseInt(params.count, 10) || 1);
  mediaParams.count = requestedCount;
  const requestId = crypto.randomUUID();
  return { nodeId, prompt: effectivePrompt, usesTextAsPrompt: !prompt?.trim(), model, params: mediaParams, sources,
    requestId, batchId: 'batch-' + requestId, requestedCount, submittedAt: Date.now(), taskIds: [],
    resultId: nodeId, resultIds: [nodeId], createsResult: false };
}

export function beginCanvasImageGeneration(nodes, plan) {
  if (nodes.find(node => node.id === plan.nodeId)?.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') throw new Error('素材正在替换上传，请稍后再试');
  const target = findNode(nodes, plan.nodeId);
  const protectedAsUpstream = nodes.some((node) => node.id !== plan.nodeId && node.data?.submissionLocked
    && (node.data.executionSourceIds || []).includes(plan.nodeId));
  if (!target || target.data.generating || target.data.submissionLocked || protectedAsUpstream) {
    throw new Error('操作可能导致下游丢失参考素材，请稍后再试');
  }
  return nodes.map((node) => node.id === plan.nodeId ? { ...node, data: { ...node.data,
    creationPanelOpen: false, generating: true, submissionLocked: true,
    executionSourceIds: plan.sources.map((source) => source.id), generationTaskIds: [],
    generationError: '', generationRequestId: plan.requestId,
  } } : node);
}

export function recoverCanvasImageGenerationFailure(nodes, plan) {
  return nodes.map((node) => node.id === plan.nodeId && node.data.generationRequestId === plan.requestId
    ? { ...node, data: { ...node.data, generating: false, submissionLocked: false,
      executionSourceIds: undefined, generationTaskIds: undefined, generationError: '', generationRequestId: undefined } } : node);
}

export function getCanvasImageGenerationSummary(plan, assets) {
  if (assets.length > plan.requestedCount) throw new Error('图片返回数量超过请求数量，已停止写入');
  const valid = (asset) => asset?.url && UUID.test(asset.asset_id || '')
    && (!asset.asset_type || asset.asset_type === 'image') && !['uploading', 'error'].includes(asset.uploadStatus);
  const results = Array.from({ length: plan.requestedCount }, (_, index) => valid(assets[index])
    ? { id: plan.batchId + '-result-' + index, index, type: 'image', assetId: assets[index].asset_id }
    : { index, status: 'failed' });
  return { results, successCount: results.filter((result) => result.status !== 'failed').length };
}

export function applyCanvasImageResult(nodes, plan, asset) {
  if (!nodes.some((node) => node.id === plan.nodeId && node.data.generationRequestId === plan.requestId)) return nodes;
  const assets = Array.isArray(asset) ? asset : [asset];
  const { results, successCount } = getCanvasImageGenerationSummary(plan, assets);
  if (!successCount) return recoverCanvasImageGenerationFailure(nodes, plan);
  const views = Object.fromEntries(results.filter((result) => result.assetId).map((result) => [result.assetId, assets[result.index]]));
  return recoverCanvasImageGenerationFailure(nodes.map((node) => {
    if (node.id !== plan.nodeId || node.data.generationRequestId !== plan.requestId) return node;
    return commitCanvasNodeOutput(node, { batchId: plan.batchId, id: plan.batchId, source: 'generation',
      requestedCount: plan.requestedCount, results, submittedAt: plan.submittedAt,
      completedAt: Date.now(), taskIds: plan.taskIds,
      snapshot: { prompt: plan.prompt, model: plan.model, params: plan.params,
        inputs: plan.sources.map((source) => ({ nodeId: source.id, type: source.type, resultId: source.resultId,
          ...(source.type === 'text' ? { content: source.content } : { assetId: source.asset.asset_id }) })) },
    }, views);
  }), plan);
}

export function getCanvasImageResultAssets(result) {
  const count = Math.max(result?.images?.length || 0, result?.imageDownloadUrls?.length || 0, result?.imageOriginalUrls?.length || 0, result?.imageAssetIds?.length || 0);
  return Array.from({ length: count }, (_, index) => {
    const previewUrl = result.images?.[index];
    const originalUrl = result.imageOriginalUrls?.[index] || result.imageDownloadUrls?.[index];
    const url = originalUrl || previewUrl;
    return url ? { url, previewUrl, originalUrl, asset_id: result.imageAssetIds?.[index], asset_type: 'image', source: 'ai-generated' } : null;
  });
}
