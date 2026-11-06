import { cloneCanvasNodeResults } from './CanvasResultCompatibility.js';
import { projectCanvasCurrentResult } from './CanvasNodeResults.js';

/** 只校验已附加的结果，不为旧节点创建历史，也不修正冲突投影。 */
export function readCanvasResultDocument(type, data, { serialized = false } = {}) {
  if (!data || !Object.hasOwn(data, 'nodeResults')) return undefined;
  if (!['text', 'image', 'video', 'audio'].includes(type)
    || (data.nodeType !== undefined && data.nodeType !== type)) {
    throw new Error('节点类型不支持结果历史或与结果类型不一致');
  }
  const state = cloneCanvasNodeResults(data.nodeResults);
  if (state.batches.some((batch) => batch.results.some((result) => result.type !== type))) {
    throw new Error('节点类型与结果类型不一致');
  }
  const projection = projectCanvasCurrentResult(state);
  const asset = serialized
    ? (data.assetId === undefined || data.assetId === null ? null : { asset_id: data.assetId, asset_type: data.assetType })
    : data.asset;
  if ((data.content ?? '') !== projection.content
    || (projection.asset ? !asset || asset.asset_id !== projection.asset.asset_id : asset != null)
    || (asset && asset.asset_type !== undefined && asset.asset_type !== type)
    || (asset && ['uploading', 'error'].includes(asset.uploadStatus))) {
    throw new Error('节点当前投影与结果历史不一致，已停止处理以防丢失内容');
  }
  return state;
}
