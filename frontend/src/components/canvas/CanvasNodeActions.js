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

export function pasteCanvasNodes(nodes, clipboard, position, makeId = () => crypto.randomUUID(), options = {}) {
  if (!clipboard.length) return nodes;
  const mapping = new Map(clipboard.map((node) => [node.id, `canvas-${node.type}-${makeId()}`]));
  const roots = clipboard.filter((node) => !node.parentId);
  const origin = { x: Math.min(...roots.map((node) => node.position.x)), y: Math.min(...roots.map((node) => node.position.y)) };
  const copies = clipboard.map((node) => ({ ...node, id: mapping.get(node.id),
    parentId: mapping.get(node.parentId),
    position: node.parentId ? { ...node.position } : { x: node.position.x - origin.x + position.x, y: node.position.y - origin.y + position.y },
    data: { ...remapSources(structuredClone(node.data), (id) => mapping.get(id)),
      label: options.preserveLabels ? node.data.label : `${node.data.label} 副本`, creationPanelOpen: false, persistenceState: 'draft' },
  }));
  return setCanvasSelection([...nodes, ...copies], copies.filter((node) => !node.parentId).map((node) => node.id));
}

/** 原地副本保留根节点的父组；剪贴板粘贴仍使用画布坐标。 */
export function duplicateCanvasNodes(nodes, makeId = () => crypto.randomUUID()) {
  const contents = copyCanvasNodes(nodes);
  const roots = contents.filter((node) => !node.parentId);
  if (!roots.length) return nodes;
  const position = {
    x: Math.min(...roots.map((node) => node.position.x)) + 32,
    y: Math.min(...roots.map((node) => node.position.y)) + 32,
  };
  const pasted = pasteCanvasNodes(nodes, contents, position, makeId);
  const originals = new Map(nodes.map((node) => [node.id, node]));
  const copies = pasted.slice(nodes.length).map((node, index) => {
    if (contents[index].parentId) return node;
    const source = originals.get(contents[index].id);
    return { ...node, parentId: source.parentId,
      position: { x: source.position.x + 32, y: source.position.y + 32 } };
  });
  const ancestors = new Set();
  roots.forEach((root) => {
    let parent = originals.get(originals.get(root.id)?.parentId);
    while (parent && !ancestors.has(parent.id)) {
      ancestors.add(parent.id);
      parent = originals.get(parent.parentId);
    }
  });
  return fitCanvasGroups([...pasted.slice(0, nodes.length), ...copies], ancestors);
}

/** 删除组时同时检查嵌套成员，排队中的结果同样需要确认。 */
export function hasCanvasDeletionTasks(nodes, ids) {
  const removed = canvasDescendantIds(nodes, ids);
  return nodes.some((node) => removed.has(node.id) && (node.data?.generating || node.data?.generationPending));
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

export function setCanvasGroupsStacked(nodes, ids, stacked, center) {
  const selected = new Set(ids);
  const members = canvasDescendantIds(nodes, nodes.filter((node) => selected.has(node.id) && node.type === 'canvasGroup').map((node) => node.id));
  return nodes.map((node) => selected.has(node.id) && node.type === 'canvasGroup'
    ? { ...node, data: { ...node.data, stacked, ...(stacked && !node.data.stacked ? {
      stackOffset: center ? {
        x: center.x - getCanvasAbsolutePosition(nodes, node).x - 156,
        y: center.y - getCanvasAbsolutePosition(nodes, node).y - 156,
      } : { x: 0, y: 0 },
    } : {}) } }
    : stacked && members.has(node.id) ? { ...node, selected: false, data: { ...node.data, creationPanelOpen: false } } : node);
}

/** 拖动展示位置时扣除堆叠偏移，历史中的展开布局只跟随实际拖动距离。 */
export function restoreCanvasStackPositionChange(change, nodes) {
  const node = nodes.find((item) => item.id === change.id);
  if (change.type !== 'position' || !change.position || !node?.data.stacked || !node.data.stackOffset) return change;
  return { ...change, position: {
    x: change.position.x - node.data.stackOffset.x,
    y: change.position.y - node.data.stackOffset.y,
  } };
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
  const members = new Map(nodes.filter((node) => node.type === 'canvasGroup')
    .map((node) => [node.id, canvasDescendantIds(nodes, [node.id])]));
  return {
    nodes: nodes.map((node) => ({ ...node, hidden: Boolean(owners.get(node.id)),
      ...(node.type === 'canvasGroup' ? {
        // React Flow 选中会提升1000层；组仍须低于连线，避免背景模糊遮住连线。
        zIndex: -2000,
        ...(node.data.stacked ? { position: {
          x: node.position.x + (node.data.stackOffset?.x || 0),
          y: node.position.y + (node.data.stackOffset?.y || 0),
        }, style: { ...node.style, width: 312, height: 312 }, measured: { width: 312, height: 312 } } : {}),
        data: { ...node.data, expandedWidth: node.style?.width, expandedHeight: node.style?.height,
          stackMembers: nodes.filter((child) => members.get(node.id).has(child.id) && child.type !== 'canvasGroup').map((child) => {
            const position = getCanvasAbsolutePosition(nodes, child);
            const origin = getCanvasAbsolutePosition(nodes, node);
            return { id: child.id, type: child.type, label: child.data.label, asset: child.data.asset, content: child.data.content,
              x: position.x - origin.x, y: position.y - origin.y + 24,
              width: child.measured?.width || 240, height: Math.max(1, (child.measured?.height || 264) - 24) };
          }) },
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
