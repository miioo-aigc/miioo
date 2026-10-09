import test from 'node:test';
import assert from 'node:assert/strict';
import { canMoveCanvasNodesInto, moveCanvasNodesInto } from '../src/components/canvas/CanvasGroupTransfer.js';
import { getCanvasStackPresentation } from '../src/components/canvas/CanvasNodeActions.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';

const group = (id, parentId, stacked = false) => ({ id, parentId, type: 'canvasGroup', position: { x: 0, y: 0 }, style: { width: 300, height: 300 }, data: { label: id, stacked } });
const node = (id, parentId) => ({ id, parentId, type: 'text', position: { x: 8, y: 8 }, data: { label: id } });
const fixture = () => [group('a'), node('a1', 'a'), group('b', undefined, true), node('b1', 'b'), node('free')];

test('禁止自身和后代目标，无变化的当前父组不可选', () => {
  const nodes = [...fixture(), group('child', 'a')];
  for (const target of ['a', 'child', 'missing', 'free']) {
    assert.equal(canMoveCanvasNodesInto(nodes, ['a'], target), false);
    assert.equal(moveCanvasNodesInto(nodes, ['a'], target), nodes);
  }
  assert.equal(canMoveCanvasNodesInto(nodes, ['a1'], 'a'), false);
  assert.equal(canMoveCanvasNodesInto(nodes, ['a1', 'free'], 'a'), true);
});

test('选中父子项仅移动父项，保留内部层级和堆叠目标状态', () => {
  const nodes = fixture();
  const before = structuredClone(nodes);
  const next = moveCanvasNodesInto(nodes, ['a', 'a1', 'free'], 'b');
  assert.equal(next.find((n) => n.id === 'a1').parentId, 'a');
  assert.equal(next.find((n) => n.id === 'a').parentId, 'b');
  assert.equal(next.find((n) => n.id === 'free').parentId, 'b');
  assert.equal(next.find((n) => n.id === 'b').data.stacked, true);
  assert.ok(next.findIndex((n) => n.id === 'b') < next.findIndex((n) => n.id === 'a'));
  const view = getCanvasStackPresentation(next, [{ source: 'free', target: 'external' }]);
  assert.equal(view.nodes.find((n) => n.id === 'free').hidden, true);
  assert.equal(view.edges[0].source, 'b');
  assert.deepEqual(nodes, before);
});

test('清理移空旧组，保留引用，可一次撤销和重做', () => {
  const nodes = fixture();
  nodes.find((n) => n.id === 'free').data.textSourceIds = ['a1'];
  const history = createCanvasHistory(nodes);
  history.setNodes((current) => moveCanvasNodesInto(current, ['a1', 'free'], 'b'));
  const next = history.getSnapshot().nodes;
  assert.equal(next.some((n) => n.id === 'a'), false);
  assert.deepEqual(next.find((n) => n.id === 'free').data.textSourceIds, ['a1']);
  history.undo();
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'a1').parentId, 'a');
  history.redo();
  assert.equal(history.getSnapshot().nodes.find((n) => n.id === 'a1').parentId, 'b');
  history.dispose();
});
