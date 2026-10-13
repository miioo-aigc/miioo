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
]);

function cleanObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !fields.has(key))
    .map(([key, item]) => [key, cleanObject(item, new Set())]));
}

export function serializeCanvasNode(node) {
  const data = Object.fromEntries(Object.entries(node.data || {})
    .filter(([key]) => !TRANSIENT_DATA_FIELDS.has(key)));
  const asset = data.asset;
  if (data.asset) delete data.asset.file;
  if (asset?.uploadStatus === 'uploading' || asset?.uploadStatus === 'error' || !asset?.asset_id) {
    if (asset) data.asset = { ...asset, url: undefined, persistentUrl: undefined, previewUrl: undefined };
  } else {
    data.asset = cleanObject({ ...asset, url: undefined, previewUrl: undefined }, new Set());
  }
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    ...(node.style ? { style: node.style } : {}),
    data,
  };
}

export function serializeCanvasDocument(nodes, edges, viewport = { x: 0, y: 0, zoom: 1 }) {
  return {
    schema_version: 1,
    nodes: nodes.map(serializeCanvasNode),
    edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
      id, source, target, ...(sourceHandle ? { sourceHandle } : {}), ...(targetHandle ? { targetHandle } : {}),
    })),
    viewport,
  };
}

export function readCanvasDocument(item) {
  const document = item?.document || item || {};
  return {
    nodes: Array.isArray(document.nodes) ? document.nodes : [],
    edges: Array.isArray(document.edges) ? document.edges : [],
    viewport: document.viewport || { x: 0, y: 0, zoom: 1 },
  };
}
