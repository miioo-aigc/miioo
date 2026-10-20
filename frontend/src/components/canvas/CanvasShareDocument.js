import { getCanvasMediaSize } from './CanvasMediaSize.js';
import { readCanvasDocument } from './CanvasDocument.js';
import { getCanvasAbsolutePosition } from './CanvasGroups.js';

export function safeCanvasMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, 'https://canvas.invalid');
    return ['https:', 'http:'].includes(url.protocol) ? value : undefined;
  } catch { return undefined; }
}

export function readCanvasShareDocument(payload) {
  const doc = payload?.document;
  if (!doc || doc.engine !== 'xyflow' || doc.schemaVersion !== 1 || !Array.isArray(doc.records)) {
    throw new Error('此画布的文档格式暂不支持，需后端提供约定的公开文档');
  }
  const assets = new Map((Array.isArray(payload.assets) ? payload.assets : []).map((asset) => [asset.asset_id, asset]));
  // 只读分享将组合成员换算为绝对坐标，不引入编辑态组合组件及其动作。
  const restored = readCanvasDocument(payload).nodes;
  const ids = new Set();
  const nodes = doc.records.filter((record) => record.type !== 'canvasGroup').map((record) => {
    if (record.type !== 'free-canvas-node' || typeof record.id !== 'string' || !record.id || ids.has(record.id)
      || !Number.isFinite(record.x) || !Number.isFinite(record.y) || !record.props || typeof record.props !== 'object') {
      throw new Error('分享画布包含无法识别的节点，请联系画布所有者');
    }
    ids.add(record.id);
    const props = record.props;
    const asset = assets.get(props.assetId);
    const mediaType = asset?.media_type || props.assetType || props.nodeType;
    const size = getCanvasMediaSize({ ...asset, asset_type: mediaType }) || { width: mediaType === 'audio' ? 320 : 280, height: 200 };
    return {
      id: record.id, type: 'shared', position: getCanvasAbsolutePosition(restored, restored.find((node) => node.id === record.id)),
      data: { ...props, asset, mediaType, mediaSize: size }, style: { width: size.width },
    };
  });
  const edges = [];
  const pairs = new Set();
  const add = (source, target) => {
    if (!ids.has(source) || !ids.has(target) || source === target) return;
    const key = JSON.stringify([source, target]);
    if (pairs.has(key)) return;
    pairs.add(key);
    edges.push({ id: `share:${key}`, source, target, type: 'smoothstep', style: { stroke: 'var(--color-text-hint)' } });
  };
  const fields = ['referenceInputs', 'textSourceIds', 'imageSourceIds', 'videoSourceIds', 'audioSourceIds'];
  for (const node of nodes) {
    for (const field of fields) {
      const values = node.data[field];
      if (values !== undefined && !Array.isArray(values)) throw new Error('分享画布的连线数据格式不正确');
      for (const value of values || []) add(field === 'referenceInputs' ? value?.sourceId : value, node.id);
    }
    // 明确的空数组也代表节点字段存在，不从旧绑定重新恢复已删除的连线。
    if (!fields.some((field) => Object.hasOwn(node.data, field))) {
      for (const binding of doc.businessBindings || []) {
        if (binding.toId === node.id && binding.enabled !== false) add(binding.fromId, node.id);
      }
    }
  }
  return { nodes, edges };
}
