/** 编辑结果只新增节点；保存原图、来源及其他节点的激活状态。 */
import { appendCanvasNode, createCanvasNode } from './canvasNodeUtils.js';
import { getCanvasAbsolutePosition } from './CanvasGroups.js';
import { planCanvasImportPositions, preserveCanvasImportPanels } from './CanvasImportLayout.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';

export function canvasImageEditCard(asset) {
  const imageUrl = asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.url;
  return { ...asset, imageUrl, originalUrl: imageUrl };
}

export function appendCanvasImageEdit(nodes, source, asset, resultId) {
  return appendCanvasMediaEdit(nodes, source, asset, resultId, 'image');
}

export function appendCanvasMediaEdit(nodes, source, asset, resultId, type) {
  if (nodes.some((node) => node.id === resultId)) return nodes;
  const currentSource = nodes.find((node) => node.id === source.id) || source;
  const anchor = getCanvasAbsolutePosition(nodes, currentSource);
  const position = planCanvasImportPositions(1, anchor,
    nodes.map((node) => ({ ...node, selected: node.id === source.id })), [getCanvasAssetNodeSize(asset)])[0];
  const result = createCanvasNode(type, position, resultId);
  result.data = { ...result.data, asset, editSourceNodeId: source.id };
  return preserveCanvasImportPanels(nodes, appendCanvasNode(nodes, result));
}
