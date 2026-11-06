import { getCanvasOperationLocks } from './CanvasOperationGuards.js';
import { getCanvasPermanentAssetId, toCanvasAsset } from './CanvasAssets.js';

const isUploading = (node) => node?.data?.asset?.uploadStatus === 'uploading'
  || node?.data?.pendingCanvasUpload?.asset?.uploadStatus === 'uploading';
const isLocked = (node, locks) => locks.upstreamProtected.has(node.id)
  || ['generating', 'generationPending', 'editing', 'submissionLocked', 'upstreamProtected', 'outputLocked'].some((key) => node.data?.[key])
  || isUploading(node);

export function createCanvasReplacementSnapshot(node) {
  if (!node) return null;
  return {
    id: node.id,
    type: node.type,
    assetIdentity: getCanvasPermanentAssetId(node.data?.asset) || node.data?.asset?.url || null,
    currentResultId: node.data?.nodeResults?.currentResultId,
    pendingCanvasUpload: node.data?.pendingCanvasUpload || null,
  };
}

export function validateCanvasAssetReplacement(nodes, nodeId, nodeType, assets) {
  if (!Array.isArray(assets) || assets.length !== 1) return null;
  const node = nodes.find((item) => item.id === nodeId);
  if (!node || node.type !== nodeType || isLocked(node, getCanvasOperationLocks(nodes))) return null;
  const asset = toCanvasAsset(assets[0], nodeType);
  return asset?.asset_type === nodeType ? asset : null;
}

export function isCanvasReplacementTargetCurrent(nodes, snapshot) {
  const node = nodes.find((item) => item.id === snapshot?.id);
  if (!node || node.type !== snapshot.type) return false;
  const locks = getCanvasOperationLocks(nodes);
  if (isLocked(node, locks)) return false;
  const current = createCanvasReplacementSnapshot(node);
  return current.assetIdentity === snapshot.assetIdentity
    && current.currentResultId === snapshot.currentResultId
    && current.pendingCanvasUpload === snapshot.pendingCanvasUpload;
}

export function beginCanvasReplacement(nodes, snapshot, pending) {
  if (!isCanvasReplacementTargetCurrent(nodes, snapshot) || !pending || pending.owner !== 'page-replace') return nodes;
  return nodes.map((node) => node.id === snapshot.id
    ? { ...node, data: { ...node.data, pendingCanvasUpload: pending } } : node);
}

export function createCanvasReplacementPending(node, asset) {
  const snapshot = createCanvasReplacementSnapshot(node);
  if (!snapshot || !asset) return null;
  const operationId = `replace-${crypto.randomUUID()}`;
  return { owner: 'page-replace', operationId, sourceAssetId: getCanvasPermanentAssetId(node.data?.asset),
    sourceUrl: node.data?.asset?.url, sourceResultId: node.data?.nodeResults?.currentResultId, asset };
}

