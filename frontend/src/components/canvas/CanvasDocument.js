import { createCanvasNode, CANVAS_NODE_TYPES } from './canvasNodeUtils.js';
import { orderParentsFirst } from './CanvasGroups.js';
import { readCanvasResultDocument } from './CanvasResultDocument.js';
import { projectCanvasCurrentResult, removeCanvasResultsByAssetIds } from './CanvasNodeResults.js';

const TRANSIENT_NODE_FIELDS = new Set([
  'selected', 'measured', 'dragging', 'resizing', 'creationPanelOpen', 'editing',
  'generating', 'generationPending', 'generationError', 'generationRequestId', 'canvasEditOperation',
  'submissionLocked', 'generationTaskIds', 'executionSourceIds', 'upstreamProtected', 'upstreamUpdated',
  'uploadError',
]);

const TRANSIENT_DATA_FIELDS = new Set([
  ...TRANSIENT_NODE_FIELDS,
  'onPromptChange', 'onModelChange', 'onImageReferenceLimitChange', 'onVideoCapabilitiesChange',
  'onGenerationModeChange', 'onContentChange', 'onCancelPendingClick', 'onEnterEditing',
  'onGenerate', 'onAssetChange', 'onSelectAsset', 'onRenameStart', 'onRename', 'onMore',
  'onPreview', 'onImageEdit', 'onVideoEdit', 'onUpstreamConnectStart', 'onPulseMeasure',
  'onAddReference', 'onRemoveReference', 'connectionPulses', 'references', 'viewportZoom',
  'connectionTarget', 'connectionTargetStatus', 'connectingType',
  'ports', 'asset', 'persistenceState', 'stackMembers', 'expandedWidth', 'expandedHeight',
  'nodeResults', 'resultAssetViews', 'onSelectResult', 'assetUnavailable', 'assetResolveError',
]);

const MEDIA_FIELDS = new Set([
  'fullUrl', 'assetRefUrl', 'src', 'url', 'file_url', 'fileUrl', 'preview_url', 'previewUrl', 'download_url', 'downloadUrl',
  'thumbnail_url', 'thumbnailUrl', 'poster_url', 'posterUrl', 'blob_url', 'blobUrl',
  'file_path', 'filePath', 'persistentUrl', 'original_url', 'originalUrl', 'sourceUrl', 'source_url', 'file',
]);
const SOURCE_FIELDS = ['referenceInputs', 'textSourceIds', 'imageSourceIds', 'videoSourceIds', 'audioSourceIds'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateSources(props) {
  if (SOURCE_FIELDS.some((field) => props[field] !== undefined && !Array.isArray(props[field]))) {
    throw new Error('画布引用字段必须是数组，已停止处理');
  }
}

function cleanObject(value, fields = new Set()) {
  if (typeof value === 'function' || typeof value === 'undefined') return undefined;
  if (typeof value === 'string' && /^(blob:|data:)/i.test(value)) return undefined;
  if (Array.isArray(value)) return value.map((item) => cleanObject(item)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !fields.has(key) && !MEDIA_FIELDS.has(key))
    .map(([key, item]) => [key, cleanObject(item)])
    .filter(([, item]) => item !== undefined));
}

function getUnavailableAssetIds(data) {
  const ids = new Set();
  for (const [id, view] of Object.entries(data?.resultAssetViews || {})) {
    if (['missing', 'forbidden'].includes(view?.availability)) ids.add(id);
  }
  if (['missing', 'forbidden'].includes(data?.asset?.availability) && data.asset.asset_id) {
    ids.add(data.asset.asset_id);
  }
  return ids;
}

const DROP_VALUE = Symbol('drop-unavailable-asset-reference');
const normalizeAssetId = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const getAssetIdFieldKind = (key) => {
  const normalized = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!normalized || normalized.startsWith('livematerial')) return null;
  if (normalized.endsWith('assetids')) return 'multiple';
  if (normalized.endsWith('assetid')) return 'single';
  return null;
};

/** 仅按素材编号字段删除失效引用；正文、节点编号及其他同形字符串保持原样。 */
function stripUnavailableAssetReferences(value, unavailable, field = '', ancestors = new WeakSet()) {
  if (typeof value === 'string') {
    return getAssetIdFieldKind(field) && unavailable.has(normalizeAssetId(value))
      ? { value: DROP_VALUE, changed: true, removedDirectAsset: true }
      : { value, changed: false, removedDirectAsset: false };
  }
  if (Array.isArray(value)) {
    const items = [];
    let changed = false, removedDirectAsset = false;
    for (const item of value) {
      const cleaned = stripUnavailableAssetReferences(item, unavailable, field, ancestors);
      if (cleaned.value === DROP_VALUE) {
        changed = true;
        removedDirectAsset = true;
        continue;
      }
      if (item && typeof item === 'object' && cleaned.removedDirectAsset) {
        changed = true;
        removedDirectAsset = true;
        continue;
      }
      if (cleaned.changed) changed = true;
      items.push(cleaned.value);
    }
    return { value: changed ? items : value, changed, removedDirectAsset };
  }
  if (!value || typeof value !== 'object') return { value, changed: false, removedDirectAsset: false };
  if (ancestors.has(value)) return { value, changed: false, removedDirectAsset: false };
  ancestors.add(value);
  const entries = [];
  let changed = false, removedDirectAsset = false;
  for (const [key, item] of Object.entries(value)) {
    const idFieldKind = getAssetIdFieldKind(key);
    if (idFieldKind === 'single' && typeof item === 'string' && unavailable.has(normalizeAssetId(item))) {
      changed = true;
      removedDirectAsset = true;
      continue;
    }
    const cleaned = stripUnavailableAssetReferences(item, unavailable, key, ancestors);
    if (cleaned.changed) changed = true;
    if (idFieldKind && cleaned.removedDirectAsset) removedDirectAsset = true;
    entries.push([key, cleaned.value]);
  }
  ancestors.delete(value);
  return {
    value: changed ? Object.fromEntries(entries) : value,
    changed,
    removedDirectAsset,
  };
}

function stripUnavailableNodeReferences(node, unavailable) {
  if (!node || !Array.isArray(unavailable)) return node;
  const ids = new Set(unavailable.map(normalizeAssetId).filter(Boolean));
  if (!ids.size) return node;
  const originalResults = readCanvasResultDocument(node.type, node.data);
  let nodeResults = originalResults;
  if (originalResults !== undefined) {
    const withoutUnavailableResults = removeCanvasResultsByAssetIds(originalResults, ids);
    const cleaned = stripUnavailableAssetReferences(withoutUnavailableResults, ids);
    nodeResults = cleaned.value;
  }

  const dataEntries = [];
  let dataChanged = false;
  for (const [key, value] of Object.entries(node.data || {})) {
    if (key === 'nodeResults') {
      if (nodeResults !== originalResults) dataChanged = true;
      if (nodeResults !== undefined) dataEntries.push([key, nodeResults]);
      continue;
    }
    if (key === 'resultAssetViews') {
      const views = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([assetId]) => !ids.has(normalizeAssetId(assetId))))
        : value;
      if (views !== value) dataChanged = true;
      dataEntries.push([key, views]);
      continue;
    }
    if (key === 'asset') {
      const replaceAsset = value && typeof value === 'object' && ids.has(normalizeAssetId(value.asset_id));
      const projection = nodeResults !== undefined && nodeResults !== originalResults
        ? projectCanvasCurrentResult(nodeResults)
        : null;
      const nextAsset = projection
        ? projection.asset ? {
          ...projection.asset,
          ...(value?.asset_id === projection.asset.asset_id && value.source ? { source: value.source } : {}),
        } : null
        : replaceAsset ? null : value;
      if (nextAsset !== value) dataChanged = true;
      dataEntries.push([key, nextAsset]);
      continue;
    }
    const cleaned = stripUnavailableAssetReferences(value, ids, key);
    if (cleaned.changed) dataChanged = true;
    dataEntries.push([key, cleaned.value]);
  }
  if (originalResults !== undefined && nodeResults !== originalResults) {
    const projection = projectCanvasCurrentResult(nodeResults);
    const contentEntry = dataEntries.find(([key]) => key === 'content');
    if (contentEntry) contentEntry[1] = projection.content;
    else dataEntries.push(['content', projection.content]);
  }
  return dataChanged ? { ...node, data: Object.fromEntries(dataEntries) } : node;
}

/** 后端返回的 asset_ids 是失效引用的权威清单；清理节点结果、快照及旧式素材字段，保留节点壳。 */
export function removeUnavailableCanvasReferences(nodes, assetIds) {
  if (!Array.isArray(nodes) || !Array.isArray(assetIds)) return nodes;
  const unavailable = [...new Set(assetIds.filter((value) => typeof value === 'string' && value.trim()))];
  if (!unavailable.length) return nodes;
  let changed = false;
  const next = nodes.map((node) => {
    const cleaned = stripUnavailableNodeReferences(node, unavailable);
    if (cleaned !== node) changed = true;
    return cleaned;
  });
  return changed ? next : nodes;
}

export function getCanvasUnavailableAssetIds(error) {
  if ((error?.code ?? error?.detail?.code) !== 'ASSET_UNAVAILABLE') return [];
  const assetIds = error?.detail?.asset_ids ?? error?.asset_ids;
  return Array.isArray(assetIds)
    ? [...new Set(assetIds.filter((value) => typeof value === 'string' && value.trim()))]
    : [];
}

export function serializeCanvasNode(node) {
  if (node.type !== 'canvasGroup' && !CANVAS_NODE_TYPES.includes(node.type)) throw new Error('画布包含不支持保存的节点类型');
  let nodeResults = readCanvasResultDocument(node.type, node.data);
  let content = node.data?.content;
  let asset = node.data?.asset;
  const unavailableAssetIds = getUnavailableAssetIds(node.data);
  if (nodeResults !== undefined && unavailableAssetIds.size) {
    const cleaned = removeCanvasResultsByAssetIds(nodeResults, unavailableAssetIds);
    if (cleaned !== nodeResults) {
      nodeResults = cleaned;
      const projection = projectCanvasCurrentResult(cleaned);
      content = projection.content;
      asset = projection.asset ? {
        ...projection.asset,
        ...(node.data.asset?.asset_id === projection.asset.asset_id && node.data.asset.source
          ? { source: node.data.asset.source } : {}),
      } : null;
    }
  }
  const props = cleanObject(node.data || {}, TRANSIENT_DATA_FIELDS);
  if (nodeResults !== undefined) {
    props.nodeResults = nodeResults;
    props.content = content ?? '';
  }
  // 这些字段由当前节点状态生成，不能沿用上次读取的协议副本。
  for (const field of ['assetId', 'liveMaterialAssetId', 'assetType', 'assetSource', 'parentId', 'groupWidth', 'groupHeight', 'textWidth', 'textHeight']) delete props[field];
  validateSources(props);
  if (asset && (asset.liveMaterialAssetId || !unavailableAssetIds.has(asset.asset_id))) {
    if (!UUID.test(asset.liveMaterialAssetId || asset.asset_id || '') || ['uploading', 'error'].includes(asset.uploadStatus)) {
      throw new Error('素材尚未取得有效的永久编号，不能保存画布');
    }
    props.assetId = asset.liveMaterialAssetId ? '' : asset.asset_id;
    if (asset.liveMaterialAssetId) props.liveMaterialAssetId = asset.liveMaterialAssetId;
    props.assetType = asset.asset_type || node.type;
    props.assetSource = asset.source;
  }
  if (props.assetId && !UUID.test(props.assetId)) throw new Error('素材永久编号不合法，不能保存画布');
  if (node.parentId) props.parentId = node.parentId;
  if (node.type === 'canvasGroup') {
    delete props.nodeType;
    props.groupWidth = node.style?.width;
    props.groupHeight = node.style?.height;
  } else props.nodeType = node.type;
  if (node.type === 'text') {
    if (Number.isFinite(node.width)) props.textWidth = node.width;
    if (Number.isFinite(node.height)) props.textHeight = node.height;
  }
  return {
    id: node.id, type: node.type === 'canvasGroup' ? 'canvasGroup' : 'free-canvas-node',
    x: node.position.x, y: node.position.y, props,
  };
}

export function serializeCanvasDocument(nodes, edges = [], viewport = { x: 0, y: 0, zoom: 1 }) {
  const records = orderParentsFirst(nodes).map(serializeCanvasNode);
  const businessBindings = [];
  const ids = new Set(nodes.map((node) => node.id));
  const add = (source, target, order = 0) => {
    if (!ids.has(source) || source === target || businessBindings.some((item) => item.fromId === source && item.toId === target)) return;
    const type = nodes.find((node) => node.id === source)?.type;
    businessBindings.push({ id: `binding:${JSON.stringify([source, target])}`, fromId: source, toId: target,
      role: type === 'text' ? 'prompt' : 'reference', order, enabled: true });
  };
  for (const record of records) {
    SOURCE_FIELDS.forEach((field) => (record.props[field] || []).forEach((source, index) => add(field === 'referenceInputs' ? source.sourceId : source, record.id, index)));
    if (!SOURCE_FIELDS.some((field) => Object.hasOwn(record.props, field))) {
      edges.filter((edge) => edge.target === record.id).forEach((edge, index) => add(edge.source, edge.target, index));
    }
  }
  return {
    schemaVersion: 1, engine: 'xyflow', engineVersion: '12.11.2', records, businessBindings, viewport,
  };
}

export function readCanvasDocument(item) {
  const document = item?.document || item || {};
  const viewport = document.viewport || { x: 0, y: 0, zoom: 1 };
  if (![viewport.x, viewport.y, viewport.zoom].every(Number.isFinite) || viewport.zoom <= 0) {
    throw new Error('画布视口数据不合法，已停止加载');
  }
  // 开发草稿兼容读取；正式写入始终使用 records 格式。
  if (Array.isArray(document.nodes) && document.schema_version === 1) {
    const nodes = document.nodes.map((node) => {
      const nodeResults = readCanvasResultDocument(node.type, node.data);
      if (nodeResults === undefined) return node;
      const data = { ...node.data, nodeResults };
      delete data.resultAssetViews;
      return { ...node, data };
    });
    return { nodes, edges: document.edges || [], viewport };
  }
  if ((item && Object.hasOwn(item, 'document') && !item.document) || Object.keys(document).length === 0) return { nodes: [], edges: [], viewport };
  if (document.engine !== 'xyflow' || document.schemaVersion !== 1 || !Array.isArray(document.records)) throw new Error('画布文档格式不符合约定，已停止加载以防覆盖原内容');
  if (document.businessBindings !== undefined && !Array.isArray(document.businessBindings)) throw new Error('画布绑定数据不合法，已停止加载');
  const ids = new Set();
  const nodes = document.records.map((record) => {
    const props = record.props;
    if (typeof record.id !== 'string' || !record.id || ids.has(record.id) || !Number.isFinite(record.x) || !Number.isFinite(record.y)
      || !props || Array.isArray(props) || typeof props !== 'object'
      || (record.type !== 'canvasGroup' && (record.type !== 'free-canvas-node' || !CANVAS_NODE_TYPES.includes(props.nodeType)))) {
      throw new Error('画布包含无法识别的节点，已停止加载');
    }
    ids.add(record.id);
    validateSources(props);
    if (props.assetId && !UUID.test(props.assetId)) throw new Error('画布素材永久编号不合法，已停止加载');
    if (props.liveMaterialAssetId && !UUID.test(props.liveMaterialAssetId)) throw new Error('虚拟认证素材编号不合法，已停止加载');
    const group = record.type === 'canvasGroup';
    const nodeResults = readCanvasResultDocument(group ? 'canvasGroup' : props.nodeType, props, { serialized: true });
    const node = group ? { id: record.id, type: 'canvasGroup', data: {} } : createCanvasNode(props.nodeType, undefined, record.id);
    return { ...node, position: { x: record.x, y: record.y }, selected: false,
      ...(props.nodeType === 'text' ? { width: Number.isFinite(props.textWidth) ? Math.max(180, props.textWidth) : 240, height: Number.isFinite(props.textHeight) ? Math.max(144, props.textHeight) : 264 } : {}),
      ...(props.parentId ? { parentId: props.parentId } : {}),
      ...(group ? { style: { width: props.groupWidth, height: props.groupHeight } } : {}),
      data: { ...node.data, ...cleanObject(props, TRANSIENT_DATA_FIELDS), creationPanelOpen: false,
        ...(nodeResults !== undefined ? { nodeResults, content: props.content ?? '' } : {}),
        asset: props.liveMaterialAssetId ? { liveMaterialAssetId: props.liveMaterialAssetId, asset_type: props.assetType || props.nodeType, source: props.assetSource } : props.assetId ? { asset_id: props.assetId, asset_type: props.assetType || props.nodeType, source: props.assetSource } : null },
    };
  });
  for (const node of nodes) {
    const visited = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      const parent = nodes.find((item) => item.id === parentId);
      if (!parent || parent.type !== 'canvasGroup' || visited.has(parentId)) throw new Error('画布组合关系不合法，已停止加载');
      visited.add(parentId);
      parentId = parent.parentId;
    }
    if (!SOURCE_FIELDS.some((field) => Object.hasOwn(node.data, field))) {
      const bindings = (document.businessBindings || []).filter((binding) => binding.toId === node.id && binding.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const binding of bindings) {
        const source = nodes.find((item) => item.id === binding.fromId);
        if (!source || source.id === node.id || source.type === 'canvasGroup') continue;
        if (['image', 'video'].includes(node.type) && ['image', 'video', 'audio'].includes(source.type)) {
          const inputs = node.data.referenceInputs || [];
          if (!inputs.some((input) => input.sourceId === source.id)) {
            let slot = source.type === 'image' ? 0 : 2;
            while (inputs.some((input) => input.slot === slot)) slot += 1;
            node.data.referenceInputs = [...inputs, { sourceId: source.id, slot }];
          }
        } else {
          const field = `${source.type}SourceIds`;
          node.data[field] = [...new Set([...(node.data[field] || []), source.id])];
        }
      }
    }
  }
  return { nodes: orderParentsFirst(nodes), edges: [], viewport };
}
