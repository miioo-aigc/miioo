import { getCanvasMediaSize, prepareCanvasMediaAsset } from './CanvasMediaSize.js';
import { readCanvasDocument } from './CanvasDocument.js';

export function safeCanvasMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, 'https://canvas.invalid');
    return ['https:', 'http:'].includes(url.protocol) ? value : undefined;
  } catch { return undefined; }
}

// 公开素材缺少宽高时，沿用本地素材探测；首次适应画布前同步节点宽度和卡片尺寸。
export async function prepareCanvasShareMedia(graph) {
  const nodes = await Promise.all(graph.nodes.map(async (node) => {
    const { asset, mediaType } = node.data;
    if (asset?.availability !== 'ready' || !['image', 'video'].includes(mediaType)) return node;
    const url = mediaType === 'image'
      ? safeCanvasMediaUrl(asset.thumbnail_url) || safeCanvasMediaUrl(asset.preview_url) || safeCanvasMediaUrl(asset.original_url)
      : safeCanvasMediaUrl(asset.preview_url);
    const prepared = await prepareCanvasMediaAsset({ ...asset, asset_type: mediaType, url });
    const size = getCanvasMediaSize(prepared);
    if (!size) return node;
    return { ...node, data: { ...node.data, mediaSize: size }, style: { ...node.style, width: size.width } };
  }));
  return { ...graph, nodes };
}

export function readCanvasShareDocument(payload) {
  const doc = payload?.document;
  if (!doc || doc.engine !== 'xyflow' || doc.schemaVersion !== 1 || !Array.isArray(doc.records)) {
    throw new Error('此画布的文档格式暂不支持，需后端提供约定的公开文档');
  }
  const assets = new Map((Array.isArray(payload.assets) ? payload.assets : []).map((asset) => [asset.asset_id, asset]));
  // 保留组层级与作者保存的折叠状态；展开仅属于分享页临时浏览状态。
  const restored = readCanvasDocument(payload).nodes;
  const ids = new Set();
  const nodes = doc.records.map((record) => {
    const restoredNode = restored.find((node) => node.id === record.id);
    if (record.type === 'canvasGroup') return { ...restoredNode, data: { ...restoredNode.data, readOnly: true } };
    if (record.type !== 'free-canvas-node' || typeof record.id !== 'string' || !record.id || ids.has(record.id)
      || !Number.isFinite(record.x) || !Number.isFinite(record.y) || !record.props || typeof record.props !== 'object') {
      throw new Error('分享画布包含无法识别的节点，请联系画布所有者');
    }
    ids.add(record.id);
    const props = record.props;
    const asset = assets.get(props.assetId);
    const mediaType = asset?.media_type || props.assetType || props.nodeType;
    const size = getCanvasMediaSize({ ...asset, asset_type: mediaType }) || { width: 240, height: 240 };
    return {
      id: record.id, type: 'shared', position: restoredNode.position,
      ...(restoredNode.parentId ? { parentId: restoredNode.parentId } : {}),
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
    edges.push({ id: `share:${key}`, source, target, type: 'default', style: { stroke: 'var(--color-stroke-accent)' } });
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
  const ordered = [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const appended = new Set();
  const append = (node) => {
    if (appended.has(node.id)) return;
    if (node.parentId) append(byId.get(node.parentId));
    appended.add(node.id);
    ordered.push(node);
  };
  nodes.forEach(append);
  return { nodes: ordered, edges };
}
