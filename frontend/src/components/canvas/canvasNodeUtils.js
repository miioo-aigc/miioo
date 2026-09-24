export const CANVAS_NODE_TYPES = ['text', 'image', 'video', 'audio'];

const NODE_LABELS = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
};

const NODE_PORTS = {
  text: { input: 'text-input', output: 'text-output' },
  image: { input: 'image-input', output: 'image-output' },
  video: { input: 'video-input', output: 'video-output' },
  audio: { input: 'audio-input', output: 'audio-output' },
};

function createId(type) {
  return `canvas-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createCanvasNode(type, position = { x: 0, y: 0 }, id = createId(type)) {
  if (!CANVAS_NODE_TYPES.includes(type)) throw new Error(`不支持的节点类型：${type}`);

  const ports = NODE_PORTS[type];
  return {
    id,
    type,
    position,
    selected: true,
    data: {
      nodeType: type,
      label: NODE_LABELS[type],
      ports: { input: { id: ports.input }, output: { id: ports.output } },
      creationPanelOpen: true,
      persistenceState: 'draft',
      prompt: '',
      content: '',
      asset: null,
    },
  };
}

export function getCreationPanelVisibility(node, selectedNodeId) {
  return Boolean(node?.selected && node?.id === selectedNodeId && node?.data?.creationPanelOpen);
}

export function updateSelectedNode(nodes, selectedNodeId) {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
    data: { ...node.data, creationPanelOpen: node.id === selectedNodeId },
  }));
}

export function getCanvasNodeMenuPosition(event, viewport, menuSize = { width: 160, height: 176 }) {
  const maxLeft = Math.max(8, viewport.width - menuSize.width - 8);
  const maxTop = Math.max(8, viewport.height - menuSize.height - 8);
  return {
    left: Math.min(Math.max(8, event.clientX), maxLeft),
    top: Math.min(Math.max(8, event.clientY), maxTop),
  };
}
