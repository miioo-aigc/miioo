/** 画布编辑历史：字段差异避免撤销位置时覆盖异步结果；运行态不进入历史。 */
import { syncCanvasAudioText } from './CanvasTextAudio.js';
import { stripCanvasNodeRuntimeData } from './CanvasNodeActions.js';
import { readCanvasResultDocument } from './CanvasResultDocument.js';
const HISTORY_LIMIT = 50;
const transient = new Set(['selected', 'measured', 'dragging', 'resizing', 'creationPanelOpen', 'editing',
  'generating', 'generationPending', 'generationError', 'generationRequestId', 'dragRelease', 'dragScaleX', 'dragScaleY']);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clean = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !transient.has(key)));
const resultFields = new Set(['nodeResults', 'content', 'asset']);
const hasResults = (node) => Object.hasOwn(node.data, 'nodeResults');
const snapshot = (nodes) => nodes.map((node) => {
  const nodeResults = readCanvasResultDocument(node.type, node.data);
  return { ...clean(stripCanvasNodeRuntimeData(node)), data: { ...clean(stripCanvasNodeRuntimeData(node.data)),
    ...(nodeResults !== undefined ? { nodeResults } : {}) } };
});

function changes(before, after) {
  const old = new Map(before.map((node) => [node.id, node]));
  const next = new Map(after.map((node) => [node.id, node]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap((id) => {
    const a = old.get(id), b = next.get(id);
    if (!a || !b) return [{ id, before: a, after: b }];
    const fields = [];
    for (const scope of ['node', 'data']) {
      const left = scope === 'data' ? a.data : a;
      const right = scope === 'data' ? b.data : b;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (scope === 'node' && key === 'data') continue;
        // 结果切换暂不进普通撤销：整体字段回滚会丢失稍后返回的异步批次。
        // 完整节点增删仍携带历史；存活节点的历史和合法当前投影始终保留。
        if (scope === 'data' && (hasResults(a) || hasResults(b)) && resultFields.has(key)) continue;
        if (!equal(left[key], right[key])) fields.push({ scope, key, before: left[key], after: right[key] });
      }
    }
    return fields.length ? [{ id, fields }] : [];
  });
}

function apply(nodes, patches, direction) {
  let next = nodes;
  for (const patch of patches) {
    if (!patch.fields) {
      next = next.filter((node) => node.id !== patch.id);
      const restored = patch[direction];
      if (restored) next = [...next, { ...restored, selected: false, data: { ...restored.data, creationPanelOpen: false } }];
    } else {
      next = next.map((node) => {
        if (node.id !== patch.id) return node;
        const updated = { ...node, data: { ...node.data } };
        for (const field of patch.fields) {
          // 旧正文编辑可能早于首次历史写入，不能用旧补丁覆盖新结果投影。
          if (field.scope === 'data' && hasResults(node) && resultFields.has(field.key)) continue;
          const target = field.scope === 'data' ? updated.data : updated;
          if (field[direction] === undefined) delete target[field.key];
          else target[field.key] = field[direction];
        }
        return updated;
      });
    }
  }
  // React Flow 要求父组在子节点之前。
  const ordered = [], visited = new Set(), byId = new Map(next.map((node) => [node.id, node]));
  const visit = (node) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    if (byId.has(node.parentId)) visit(byId.get(node.parentId));
    ordered.push(node);
  };
  next.forEach(visit);
  return ordered;
}

export function createCanvasHistory(initial = []) {
  let nodes = initial, past = [], future = [], transaction = null, lastEdit = null;
  let state = { nodes, canUndo: false, canRedo: false };
  const listeners = new Set();
  const previewUrls = new Set();
  const publish = () => {
    const retained = new Set();
    const collect = (value) => {
      if (!value || typeof value !== 'object') return;
      if (typeof value.url === 'string') retained.add(value.url);
      Object.values(value).forEach(collect);
    };
    collect([nodes, past, future, transaction]);
    for (const url of previewUrls) {
      if (!retained.has(url)) { URL.revokeObjectURL(url); previewUrls.delete(url); }
    }
    state = { nodes, canUndo: past.length > 0, canRedo: future.length > 0 };
    listeners.forEach((listener) => listener());
  };
  const record = (before, after) => {
    const delta = changes(before, after);
    if (!delta.length) return;
    const field = delta.length === 1 && delta[0].fields?.length === 1 ? delta[0].fields[0] : null;
    const key = field?.scope === 'data' && ['prompt', 'content'].includes(field.key) ? `${delta[0].id}:${field.key}` : null;
    if (key && lastEdit?.key === key && Date.now() - lastEdit.time < 750 && past.length) {
      past[past.length - 1][0].fields[0].after = field.after;
    } else past = [...past, delta].slice(-HISTORY_LIMIT);
    lastEdit = { key, time: Date.now() };
    future = [];
  };
  const end = () => {
    if (!transaction) return;
    record(transaction, snapshot(nodes));
    transaction = null;
    lastEdit = null;
    publish();
  };
  const travel = (undo, guard) => {
    end();
    const stack = undo ? past : future;
    if (!stack.length) return;
    const before = snapshot(nodes);
    const proposed = apply(nodes, stack.at(-1), undo ? 'before' : 'after');
    const next = guard ? guard(nodes, proposed) : proposed;
    if (next === nodes) return;
    next.forEach((node) => readCanvasResultDocument(node.type, node.data));
    nodes = next;
    const inverse = undo ? changes(snapshot(nodes), before) : changes(before, snapshot(nodes));
    if (undo) { past = past.slice(0, -1); future = [...future, inverse]; }
    else { future = future.slice(0, -1); past = [...past, inverse].slice(-HISTORY_LIMIT); }
    lastEdit = null;
    publish();
  };
  return {
    getSnapshot: () => state,
    getUndoToken: () => past.at(-1),
    getRedoToken: () => future.at(-1),
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    setNodes: (update, options = {}) => {
      // 来源正文与音频派生台词在同一历史步骤更新，撤销时不会再次触发同步。
      const next = syncCanvasAudioText(typeof update === 'function' ? update(nodes) : update);
      next.forEach((node) => readCanvasResultDocument(node.type, node.data));
      for (const node of next) {
        if (node.data.asset?.url?.startsWith('blob:')) previewUrls.add(node.data.asset.url);
      }
      if (options.record !== false && !transaction) record(snapshot(nodes), snapshot(next));
      if (transaction && options.record === false) {
        transaction = snapshot(apply(transaction, changes(snapshot(nodes), snapshot(next)), 'after'));
      }
      nodes = next;
      publish();
    },
    begin: () => {
      if (!transaction) { transaction = snapshot(nodes); lastEdit = null; }
    },
    end,
    undo: (guard) => travel(true, guard),
    redo: (guard) => travel(false, guard),
    dispose: () => { previewUrls.forEach((url) => URL.revokeObjectURL(url)); previewUrls.clear(); },
  };
}
