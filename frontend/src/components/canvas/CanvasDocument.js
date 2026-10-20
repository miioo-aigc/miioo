import { createCanvasNode, CANVAS_NODE_TYPES } from './canvasNodeUtils.js';
import { orderParentsFirst } from './CanvasGroups.js';

const TRANSIENT_NODE_FIELDS = new Set([
  'selected', 'measured', 'dragging', 'resizing', 'creationPanelOpen', 'editing',
  'generating', 'generationPending', 'generationError', 'generationRequestId',
  'dragRelease', 'dragScaleX', 'dragScaleY', 'uploadError',
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
]);

const MEDIA_FIELDS = new Set([
  'src', 'url', 'file_url', 'fileUrl', 'preview_url', 'previewUrl', 'download_url', 'downloadUrl',
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

export function serializeCanvasNode(node) {
  if (node.type !== 'canvasGroup' && !CANVAS_NODE_TYPES.includes(node.type)) throw new Error('画布包含不支持保存的节点类型');
  const props = cleanObject(node.data || {}, TRANSIENT_DATA_FIELDS);
  // 这些字段由当前节点状态生成，不能沿用上次读取的协议副本。
  for (const field of ['assetId', 'assetType', 'assetSource', 'parentId', 'groupWidth', 'groupHeight']) delete props[field];
  validateSources(props);
  const asset = node.data?.asset;
  if (asset) {
    if (!UUID.test(asset.asset_id || '') || ['uploading', 'error'].includes(asset.uploadStatus)) {
      throw new Error('素材尚未取得有效的永久编号，不能保存画布');
    }
    props.assetId = asset.asset_id;
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
  if (Array.isArray(document.nodes) && document.schema_version === 1) return { nodes: document.nodes, edges: document.edges || [], viewport };
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
    const group = record.type === 'canvasGroup';
    const node = group ? { id: record.id, type: 'canvasGroup', data: {} } : createCanvasNode(props.nodeType, undefined, record.id);
    return { ...node, position: { x: record.x, y: record.y }, selected: false,
      ...(props.parentId ? { parentId: props.parentId } : {}),
      ...(group ? { style: { width: props.groupWidth, height: props.groupHeight } } : {}),
      data: { ...node.data, ...cleanObject(props, TRANSIENT_DATA_FIELDS), creationPanelOpen: false,
        asset: props.assetId ? { asset_id: props.assetId, asset_type: props.assetType || props.nodeType, source: props.assetSource } : null },
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
