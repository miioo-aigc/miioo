/** 画布资产适配：保留来源信息，仅回填当前节点的前端草稿。 */
import { planCanvasImportPositions } from './CanvasImportLayout.js';
import { getCanvasAssetNodeSize } from './CanvasMediaSize.js';
export function getCanvasAudioTranscript(asset) {
  if (!asset || asset.source === 'local-preview') return '';
  return typeof asset.transcript === 'string' ? asset.transcript.trim() : '';
}

export function toCanvasAsset(asset, nodeType) {
  if (!asset || !['image', 'video', 'audio'].includes(nodeType)) return null;
  const type = String(asset.asset_type || asset.assetType || asset.type || '').toLowerCase().split('/')[0];
  if (!['image', 'video', 'audio'].includes(type) || (nodeType !== 'video' && type !== nodeType)) return null;
  const urls = [asset.fileUrl, asset.file_url, asset[`${type}Url`], asset[`${type}_url`], asset.sourceUrl, asset.source_url, asset.url];
  const url = urls.find((value) => typeof value === 'string' && /^(https?:\/\/|blob:|\/)/i.test(value));
  if (!url) return null;
  return { ...asset, asset_type: type, url, name: asset.name || '未命名素材' };
}

export function applyCanvasAsset(nodes, nodeId, selectedAsset) {
  const node = nodes.find((item) => item.id === nodeId);
  const asset = toCanvasAsset(selectedAsset, node?.type);
  if (!asset) return nodes;
  return nodes.map((item) => item.id === nodeId
    ? { ...item, data: { ...item.data, asset, ...(item.type === 'audio' ? { transcript: getCanvasAudioTranscript(asset) } : {}), persistenceState: 'draft' } }
    : item);
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
