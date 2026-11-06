/** 画布资产适配：保留来源信息，仅回填当前节点的前端草稿。 */
import { getCanvasFileName } from './CanvasFileName.js';
import { planCanvasImportPositions } from './CanvasImportLayout.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';
import { commitCanvasNodeOutput } from './CanvasResultMutations.js';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';
import { getCanvasResultAudioTranscript } from './CanvasNodeResults.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function getCanvasPermanentAssetId(asset) {
  return [asset?.asset_id, asset?.creationAssetId, asset?.assetId, asset?.backendId, asset?.id]
    .find((value) => typeof value === 'string' && UUID.test(value)) || null;
}

export function isCanvasOutputProtected(node) {
  return Boolean(node?.data && ['generating', 'generationPending', 'editing', 'submissionLocked', 'upstreamProtected', 'outputLocked']
    .some((key) => node.data[key]));
}

export function commitCanvasMediaOutput(node, asset, source, operationId = `${source}-${getCanvasPermanentAssetId(asset)}`) {
  const assetId = getCanvasPermanentAssetId(asset);
  if (!assetId || asset.asset_type !== node.type || !['image', 'video', 'audio'].includes(node.type)) return node;
  const view = { ...asset, asset_id: assetId };
  const previous = node.data.nodeResults?.batches?.find((batch) => batch.id === operationId);
  if (previous) {
    if (node.data.nodeResults.currentResultId !== `${operationId}-result`) return node;
    const resultAssetViews = { ...node.data.resultAssetViews, [assetId]: view };
    return { ...node, data: { ...node.data, resultAssetViews, asset: view } };
  }
  const now = Date.now();
  const oldId = getCanvasPermanentAssetId(node.data.asset);
  const base = oldId && node.data.asset.asset_id !== oldId
    ? { ...node, data: { ...node.data, asset: { ...node.data.asset, asset_id: oldId } } } : node;
  const committed = commitCanvasNodeOutput(base, { id: operationId, source, requestedCount: 1,
    results: [{ id: `${operationId}-result`, index: 0, type: node.type, assetId }],
    submittedAt: now, completedAt: now }, { [assetId]: view });
  return committed === base && base === node ? node : { ...committed, data: { ...committed.data, asset: view } };
}

export function finishCanvasPendingUpload(nodes, nodeId, pending, uploaded, error) {
  return nodes.map((node) => {
    if (node.id !== nodeId || node.data.pendingCanvasUpload !== pending) return node;
    const data = { ...node.data };
    delete data.pendingCanvasUpload;
    const clean = { ...node, data };
    if (error) return pending.owner === 'page-replace' ? clean : { ...clean, data: { ...data, pendingCanvasUpload: { ...pending,
      asset: { ...pending.asset, uploadStatus: 'error', uploadError: error.message } } } };
    if (isCanvasOutputProtected(node) || data.asset?.uploadStatus === 'uploading'
      || getCanvasOperationLocks(nodes).upstreamProtected.has(nodeId)
      || getCanvasPermanentAssetId(data.asset) !== pending.sourceAssetId
      || (!pending.sourceAssetId && (data.asset?.url || null) !== (pending.sourceUrl || null))
      || (data.nodeResults?.currentResultId || null) !== (pending.sourceResultId || null)) return clean;
    if (!uploaded || uploaded.asset_type !== node.type || !getCanvasPermanentAssetId(uploaded)) {
      const message = '上传结果缺少匹配类型或永久素材编号';
      return { ...clean, data: { ...data, ...(pending.owner !== 'page-replace' ? { pendingCanvasUpload: { ...pending,
        asset: { ...pending.asset, uploadStatus: 'error', uploadError: message } } } : {}) } };
    }
    const resultAsset = uploaded;
    const updated = commitCanvasMediaOutput(clean, resultAsset, 'upload', pending.operationId);
    if (updated === clean) return clean;
    return { ...updated, data: { ...updated.data,
      ...(pending.owner !== 'page-replace' && getCanvasFileName(resultAsset?.name) ? { label: getCanvasFileName(resultAsset.name) } : {}),
      ...(node.type === 'audio' ? { transcript: getCanvasAudioTranscript(resultAsset) } : {}) } };
  });
}
export function getCanvasAudioTranscript(asset, nodeResults) {
  return getCanvasResultAudioTranscript(nodeResults, asset);
}

export function toCanvasAsset(asset, nodeType) {
  if (!asset || !['image', 'video', 'audio'].includes(nodeType)) return null;
  const type = String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase().split('/')[0];
  if (!['image', 'video', 'audio'].includes(type) || (nodeType !== 'video' && type !== nodeType)) return null;
  const urls = [asset.fileUrl, asset.file_url, asset[`${type}Url`], asset[`${type}_url`], asset.sourceUrl, asset.source_url, asset.url];
  const url = urls.find((value) => typeof value === 'string' && /^(https?:\/\/|blob:|\/)/i.test(value));
  if (!url) return null;
  const thumbnailUrl = asset.thumbnailUrl || asset.thumbnail_url
    || (asset.fileUrl && asset.url !== url ? asset.url : undefined);
  return { ...asset, thumbnailUrl, asset_type: type, url, name: asset.name || '未命名素材' };
}

export function applyCanvasAsset(nodes, nodeId, selectedAsset) {
  const node = nodes.find((item) => item.id === nodeId);
  const asset = toCanvasAsset(selectedAsset, node?.type);
  if (!asset || asset.asset_type !== node.type || isCanvasOutputProtected(node)
    || node.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') return nodes;
  const preview = asset.source === 'local-preview' || ['uploading', 'error'].includes(asset.uploadStatus)
    || !getCanvasPermanentAssetId(asset);
  // 旧输出仍是当前投影；替换上传单独暂存，由编辑 Hook 接管上传。
  if (preview && ['image', 'video', 'audio'].includes(node.type) && (node.data.asset || node.data.nodeResults?.batches.length)) {
    if (node.data.pendingCanvasUpload?.asset?.uploadStatus === 'uploading') return nodes;
    if (node.data.pendingCanvasUpload?.asset?.uploadStatus === 'error') {
      const pending = { ...node.data.pendingCanvasUpload, asset, operationId: 'upload-' + crypto.randomUUID() };
      return nodes.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, pendingCanvasUpload: pending } } : item);
    }
    if (node.data.asset?.url === asset.url && !node.data.nodeResults) {
      return nodes.map((item) => item.id === nodeId ? { ...item, data: { ...item.data,
        ...(asset.source === 'local-upload' && getCanvasFileName(asset.name) ? { label: getCanvasFileName(asset.name) } : {}) } } : item);
    }
    if (!asset.file || asset.uploadStatus !== 'uploading' || !['image', 'video', 'audio'].includes(node.type)) return nodes;
    const pending = { asset, operationId: `upload-${crypto.randomUUID()}`, sourceAssetId: getCanvasPermanentAssetId(node.data.asset),
      sourceUrl: node.data.asset?.url, sourceResultId: node.data.nodeResults?.currentResultId };
    return nodes.map((item) => item.id === nodeId ? { ...item, data: { ...item.data, pendingCanvasUpload: pending } } : item);
  }
  if (!preview && !node.data.nodeResults && node.data.asset && !getCanvasPermanentAssetId(node.data.asset)) {
    // 临时首传不是旧结果，不能迁移成永久历史。
    return applyCanvasAsset(nodes.map((item) => item.id === nodeId
      ? { ...item, data: { ...item.data, asset: null } } : item), nodeId, asset);
  }
  let updated = preview ? { ...node, data: { ...node.data, asset } }
    : commitCanvasMediaOutput(node, asset, 'upload');
  updated = { ...updated, data: { ...updated.data,
    ...(asset.source === 'local-upload' && getCanvasFileName(asset.name) ? { label: getCanvasFileName(asset.name) } : {}),
    ...(node.type === 'audio' ? { transcript: getCanvasAudioTranscript(asset) } : {}), persistenceState: 'draft' } };
  return nodes.map((item) => item.id === nodeId ? updated : item);
}

export function planCanvasAssetImport(assets, center, nodes = []) {
  const valid = assets.map((asset) => toCanvasAsset(asset, 'video')).filter(Boolean);
  const positions = valid.length > 1 ? planCanvasImportPositions(valid.length, center, nodes, valid.map(getCanvasAssetNodeSize)) : [{ x: center.x - 120, y: center.y - 100 }];
  return valid.map((asset, index) => ({
    asset,
    type: asset.asset_type,
    position: positions[index],
  }));
}
