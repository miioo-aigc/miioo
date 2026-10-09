/** 节点编辑纯函数；剪贴板仅保存草稿内容，不携带运行态。 */
import { fitCanvasGroups, getCanvasAbsolutePosition, setCanvasSelection } from './CanvasGroups.js';

const sourceLists = ['textSourceIds', 'imageSourceIds', 'videoSourceIds', 'audioSourceIds'];
const transient = new Set(['generating', 'generationPending', 'generationError', 'generationRequestId',
  'creationPanelOpen', 'editing', 'dragging', 'dragRelease', 'dragScaleX', 'dragScaleY']);

export function canvasDescendantIds(nodes, ids) {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((node) => {
      if (result.has(node.parentId) && !result.has(node.id)) { result.add(node.id); changed = true; }
    });
  }
  return result;
}

function remapSources(data, resolve) {
  const next = { ...data };
  sourceLists.forEach((key) => { if (next[key]) next[key] = next[key].map(resolve).filter(Boolean); });
  if (next.textSourceId) next.textSourceId = resolve(next.textSourceId) || null;
  if (next.referenceInputs) next.referenceInputs = next.referenceInputs.flatMap((input) => {
    const sourceId = resolve(input.sourceId);
    return sourceId ? [{ ...input, sourceId }] : [];
  });
  if (next.textSync) next.textSync = { ...next.textSync,
    parts: next.textSync.parts.map((part) => ({ ...part, sourceId: resolve(part.sourceId) || null })) };
  return next;
}

export function copyCanvasNodes(nodes) {
  const ids = canvasDescendantIds(nodes, nodes.filter((node) => node.selected).map((node) => node.id));
  return nodes.filter((node) => ids.has(node.id)).map((node) => ({
    id: node.id, type: node.type,
    parentId: ids.has(node.parentId) ? node.parentId : undefined,
    position: ids.has(node.parentId) ? { ...node.position } : getCanvasAbsolutePosition(nodes, node),
    ...(node.style ? { style: { ...node.style } } : {}),
    data: structuredClone(Object.fromEntries(Object.entries(node.data)
      .filter(([key, value]) => !transient.has(key) && typeof value !== 'function'))),
  }));
}

export function pasteCanvasNodes(nodes, clipboard, position, makeId = () => crypto.randomUUID()) {
  if (!clipboard.length) return nodes;
  const mapping = new Map(clipboard.map((node) => [node.id, `canvas-${node.type}-${makeId()}`]));
  const roots = clipboard.filter((node) => !node.parentId);
  const origin = { x: Math.min(...roots.map((node) => node.position.x)), y: Math.min(...roots.map((node) => node.position.y)) };
  const copies = clipboard.map((node) => ({ ...node, id: mapping.get(node.id),
    parentId: mapping.get(node.parentId),
    position: node.parentId ? { ...node.position } : { x: node.position.x - origin.x + position.x, y: node.position.y - origin.y + position.y },
    data: { ...remapSources(structuredClone(node.data), (id) => mapping.get(id)),
      label: `${node.data.label} 副本`, creationPanelOpen: false, persistenceState: 'draft' },
  }));
  return setCanvasSelection([...nodes, ...copies], copies.filter((node) => !node.parentId).map((node) => node.id));
}

export function deleteCanvasNodes(nodes, ids) {
  const removed = canvasDescendantIds(nodes, ids);
  let next = nodes.filter((node) => !removed.has(node.id));
  // 删除最后一个成员时移除空组，逐层清理嵌套空组。
  let empty;
  while ((empty = next.find((node) => node.type === 'canvasGroup' && !next.some((child) => child.parentId === node.id)))) {
    next = next.filter((node) => node.id !== empty.id);
  }
  return fitCanvasGroups(next.map((node) => ({ ...node, data: remapSources(node.data, (id) => removed.has(id) ? null : id) })));
}

export function moveCanvasNodesOut(nodes, ids) {
  const selected = new Set(ids);
  const next = nodes.map((node) => selected.has(node.id) && node.parentId ? {
    ...node, parentId: undefined, position: getCanvasAbsolutePosition(nodes, node),
  } : node);
  return deleteCanvasNodes(next, []);
}

export function setCanvasGroupsStacked(nodes, ids, stacked) {
  const selected = new Set(ids);
  const members = canvasDescendantIds(nodes, nodes.filter((node) => selected.has(node.id) && node.type === 'canvasGroup').map((node) => node.id));
  return nodes.map((node) => selected.has(node.id) && node.type === 'canvasGroup'
    ? { ...node, data: { ...node.data, stacked } }
    : stacked && members.has(node.id) ? { ...node, selected: false, data: { ...node.data, creationPanelOpen: false } } : node);
}

/** 堆叠仅在渲染层折叠成员，历史中保留真实坐标与尺寸。 */
export function getCanvasStackPresentation(nodes, edges) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const owner = (node) => {
    let result = null;
    let parent = byId.get(node.parentId);
    while (parent) {
      if (parent.data.stacked) result = parent.id;
      parent = byId.get(parent.parentId);
    }
    return result;
  };
  const owners = new Map(nodes.map((node) => [node.id, owner(node)]));
  return {
    nodes: nodes.map((node) => ({ ...node, hidden: Boolean(owners.get(node.id)),
      ...(node.type === 'canvasGroup' && node.data.stacked ? {
        style: { ...node.style, width: 270, height: 180 },
        measured: { width: 270, height: 180 },
        data: { ...node.data, stackMembers: nodes.filter((child) => owners.get(child.id) === node.id && child.type !== 'canvasGroup').map((child) => ({ id: child.id, type: child.type, label: child.data.label, asset: child.data.asset, content: child.data.content })) },
      } : {}),
    })),
    edges: edges.map((edge) => {
      const source = owners.get(edge.source), target = owners.get(edge.target);
      return { ...edge, source: source || edge.source, target: target || edge.target,
        sourceHandle: source ? 'stack-output' : edge.sourceHandle,
        targetHandle: target ? 'stack-input' : edge.targetHandle,
        hidden: Boolean(source && source === target),
        ...(source || target ? { data: { ...edge.data, pulses: [] } } : {}),
      };
    }),
  };
}
