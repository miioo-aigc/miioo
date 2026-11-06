/** 同型编辑回原节点；跨类型选帧保留独立工具行为。 */
import { commitCanvasMediaOutput, getCanvasPermanentAssetId, isCanvasOutputProtected } from './CanvasAssets.js';
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { getCanvasAbsolutePosition } from './CanvasGroups.js';
import { planCanvasImportPositions, preserveCanvasImportPanels } from './CanvasImportLayout.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';
import { getCanvasOperationLocks } from './CanvasOperationGuards.js';

export function beginCanvasMediaEdit(nodes, source, operation) {
  const current = nodes.find((node) => node.id === source.id);
  if (!current || isCanvasOutputProtected(current) || getCanvasOperationLocks(nodes).upstreamProtected.has(source.id)
    || getCanvasPermanentAssetId(current.data.asset) !== getCanvasPermanentAssetId(source.data.asset)
    || current.data.nodeResults?.currentResultId !== source.data.nodeResults?.currentResultId) return nodes;
  return nodes.map((node) => node.id === source.id
    ? { ...node, data: { ...node.data, editing: true, canvasEditOperation: operation } } : node);
}

export function finishCanvasMediaEdit(nodes, sourceId, operation) {
  return nodes.map((node) => {
    if (node.id !== sourceId || node.data.canvasEditOperation !== operation) return node;
    const data = { ...node.data };
    delete data.canvasEditOperation;
    delete data.editing;
    return { ...node, data };
  });
}

export function canvasImageEditCard(asset) {
  const imageUrl = asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url;
  return { ...asset, imageUrl, originalUrl: imageUrl };
}

export function appendCanvasImageEdit(nodes, source, asset, resultId, operation) {
  return appendCanvasMediaEdit(nodes, source, asset, resultId, 'image', operation);
}

export function appendCanvasMediaEdit(nodes, source, asset, resultId, type, operation) {
  if (operation) {
    if (nodes.find((node) => node.id === source.id)?.data.canvasEditOperation !== operation) return nodes;
    const clean = finishCanvasMediaEdit(nodes, source.id, operation);
    const result = appendCanvasMediaEdit(clean, source, asset, resultId, type);
    return result === clean ? nodes : result;
  }
  const currentSource = nodes.find((node) => node.id === source.id);
  if (!currentSource || isCanvasOutputProtected(currentSource) || getCanvasOperationLocks(nodes).upstreamProtected.has(source.id) || !getCanvasPermanentAssetId(asset)
    || asset.asset_type !== type) return nodes;
  const identity = (node) => getCanvasPermanentAssetId(node.data?.asset) || node.data?.asset?.url;
  if (identity(currentSource) !== identity(source)
    || currentSource.data.nodeResults?.currentResultId !== source.data.nodeResults?.currentResultId) return nodes;
  if (currentSource.type === type) {
    const updated = commitCanvasMediaOutput(currentSource, asset, 'edit', `edit-${resultId}`);
    return updated === currentSource ? nodes : nodes.map((node) => node.id === source.id ? updated : node);
  }
  if (currentSource.type !== 'video' || type !== 'image' || nodes.some((node) => node.id === resultId)) return nodes;
  const anchor = getCanvasAbsolutePosition(nodes, currentSource);
  const position = planCanvasImportPositions(1, anchor,
    nodes.map((node) => ({ ...node, selected: node.id === source.id })), [getCanvasAssetNodeSize(asset)])[0];
  const result = createCanvasNode(type, position, resultId);
  result.data = { ...result.data, editSourceNodeId: source.id };
  return preserveCanvasImportPanels(nodes, appendCanvasNode(nodes, commitCanvasMediaOutput(result, asset, 'edit', `edit-${resultId}`)));
}
