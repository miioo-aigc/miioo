import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { copyCanvasNodes, pasteCanvasNodes, duplicateCanvasNodes, deleteCanvasNodes, hasCanvasDeletionTasks, moveCanvasNodesOut, setCanvasGroupsStacked } from '../src/components/canvas/CanvasNodeActions.js';
import { getCanvasGroupFocus } from '../src/components/canvas/CanvasGroupFocus.js';
import { getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';
import { getCanvasOperationLocks, guardCanvasNodeChanges, guardCanvasNodeUpdate, guardCanvasSystemUpdate, getCanvasNodeSourceIds } from '../src/components/canvas/CanvasOperationGuards.js';
import { canMoveCanvasNodesInto, canvasTransferRoots, moveCanvasNodesInto } from '../src/components/canvas/CanvasGroupTransfer.js';

function mount({ nodes, accepted = true } = {}) {
  const writes = [], toasts = [];
  const source = readFileSync(new URL('../src/components/canvas/UseCanvasNodeActions.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/mg, '').replace(/export /g, '');
  const api = runInNewContext(source + ';useCanvasNodeActions', {
    useCallback: (fn) => fn, useEffect: () => {}, useRef: (current) => ({ current }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    copyCanvasNodes, pasteCanvasNodes, duplicateCanvasNodes, deleteCanvasNodes, hasCanvasDeletionTasks,
    moveCanvasNodesOut, setCanvasGroupsStacked, getCanvasGroupFocus, getCanvasAbsolutePosition,
    canMoveCanvasNodesInto, canvasTransferRoots, moveCanvasNodesInto,
    showGlobalToast: (...args) => toasts.push(args), requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    downloadUrlWithFeedback: () => {},
  });
  const setNodes = (update) => {
    writes.push(update);
    if (accepted === false) return false;
    if (typeof update === 'function') nodes = update(nodes);
    else nodes = update;
    return accepted;
  };
  const result = api({ nodes, setNodes, undo: () => {}, redo: () => {}, getUndoToken: () => ({}),
    enabled: true, cancelPendingClicks: () => {}, flowInstance: null, containerRef: { current: null },
    dialog: null, setDialog: () => {} });
  return { result, writes, toasts, get nodes() { return nodes; } };
}

const groupFixture = () => [
  { id: 'group-a', type: 'canvasGroup', position: { x: 0, y: 0 }, style: { width: 100, height: 100 }, data: { label: '甲组' } },
  { id: 'group-b', type: 'canvasGroup', position: { x: 300, y: 0 }, style: { width: 100, height: 100 }, data: { label: '乙组' } },
  { id: 'child', type: 'text', parentId: 'group-a', position: { x: 8, y: 8 }, selected: true, data: { label: '文本' } },
];

test('拒绝的删除不报成功且不展示撤销入口', () => {
  const hook = mount({ nodes: groupFixture(), accepted: false });
  hook.result.execute('delete');
  assert.equal(hook.writes.length, 1);
  assert.deepEqual(hook.toasts.map(([message, type, options]) => ({ message, type, undo: Boolean(options?.action) })), [
    { message: '操作可能导致下游丢失参考素材，请稍后再试', type: 'warning', undo: false },
  ]);
});

test('移入和移出被拒绝时仅提示稍后重试，不报告成功', () => {
  const movingInto = mount({ nodes: groupFixture(), accepted: false });
  movingInto.result.execute('moveInto', 'group-b');
  assert.deepEqual(movingInto.toasts.map(([message, type]) => [message, type]), [
    ['操作可能导致下游丢失参考素材，请稍后再试', 'warning'],
  ]);

  const movingOut = mount({ nodes: groupFixture(), accepted: false });
  movingOut.result.execute('moveOut');
  assert.deepEqual(movingOut.toasts.map(([message, type]) => [message, type]), [
    ['操作可能导致下游丢失参考素材，请稍后再试', 'warning'],
  ]);
});

test('旧 setNodes stub 返回 undefined 时仍按成功路径展示原反馈', () => {
  const hook = mount({ nodes: groupFixture(), accepted: undefined });
  hook.result.execute('delete');
  assert.equal(hook.toasts[0][0], 'success');
  assert.equal(hook.toasts[0][1], '删除成功，可以撤销 ⌘Z 找回');
  assert.equal(hook.toasts[0][2].action.label, '撤销');

  const movingInto = mount({ nodes: groupFixture(), accepted: undefined });
  movingInto.result.execute('moveInto', 'group-b');
  assert.equal(movingInto.toasts[0][0], '文本已经移入乙组');
  assert.equal(movingInto.toasts[0][1], 'success');

  const movingOut = mount({ nodes: groupFixture(), accepted: undefined });
  movingOut.result.execute('moveOut');
  assert.equal(movingOut.toasts[0][0], '文本已经移出甲组');
  assert.equal(movingOut.toasts[0][1], 'success');
});
