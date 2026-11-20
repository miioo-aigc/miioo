import test from 'node:test';
import assert from 'node:assert/strict';
import { canMoveCanvasNodesInto, moveCanvasNodesInto } from '../src/components/canvas/CanvasGroupTransfer.js';
import { getCanvasStackPresentation } from '../src/components/canvas/CanvasNodeActions.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';

const group = (id, parentId, stacked = false) => ({ id, parentId, type: 'canvasGroup', position: { x: 0, y: 0 }, style: { width: 300, height: 300 }, data: { label: id, stacked } });
const node = (id, parentId) => ({ id, parentId, type: 'text', position: { x: 8, y: 8 }, data: { label: id } });
const fixture = () => [group('a'), node('a1', 'a'), group('b', undefined, true), node('b1', 'b'), node('free')];
test('多选整体平移，保留相对布局并展开目标祖先', () => {
  const nodes = [group('outer', undefined, true), group('target', 'outer', true), node('member', 'target'),
    { ...node('x'), position: { x: 5000, y: 3000 } },
    { ...node('y'), position: { x: 5300, y: 3400 } }];
  const next = moveCanvasNodesInto(nodes, ['x', 'y'], 'target');
  const x = getCanvasAbsolutePosition(next, next.find((n) => n.id === 'x'));
  const y = getCanvasAbsolutePosition(next, next.find((n) => n.id === 'y'));
  assert.deepEqual({ x: y.x - x.x, y: y.y - x.y }, { x: 300, y: 400 });
  assert.equal(next.find((n) => n.id === 'outer').data.stacked, false);
  assert.equal(next.find((n) => n.id === 'target').data.stacked, false);
});
test('远处节点归拢右侧，展开目标且保留原成员位置', () => {
  const nodes = [group('target', undefined, true), node('member', 'target'),
    { ...node('free'), position: { x: -6000, y: -4000 } }];
  const next = moveCanvasNodesInto(nodes, ['free'], 'target');
  const member = getCanvasAbsolutePosition(next, next.find((n) => n.id === 'member'));
  const moved = getCanvasAbsolutePosition(next, next.find((n) => n.id === 'free'));
  assert.deepEqual(member, { x: 8, y: 8 });
  assert.deepEqual(moved, { x: member.x + 272, y: member.y });
  assert.equal(next.find((n) => n.id === 'target').data.stacked, false);
  assert.ok(next.find((n) => n.id === 'target').style.width < 1000);
});

test('禁止自身和后代目标，无变化的当前父组不可选', () => {
  const nodes = [...fixture(), group('child', 'a')];
  for (const target of ['a', 'child', 'missing', 'free']) {
    assert.equal(canMoveCanvasNodesInto(nodes, ['a'], target), false);
    assert.equal(moveCanvasNodesInto(nodes, ['a'], target), nodes);
  }
  assert.equal(canMoveCanvasNodesInto(nodes, ['a1'], 'a'), false);
  assert.equal(canMoveCanvasNodesInto(nodes, ['a1', 'free'], 'a'), true);
});

test('选中父子项仅移动父项，保留内部层级并展开目标', () => {
  const nodes = fixture();
  const before = structuredClone(nodes);
  const next = moveCanvasNodesInto(nodes, ['a', 'a1', 'free'], 'b');
  assert.equal(next.find((n) => n.id === 'a1').parentId, 'a');
  assert.equal(next.find((n) => n.id === 'a').parentId, 'b');
  assert.equal(next.find((n) => n.id === 'free').parentId, 'b');
  assert.equal(next.find((n) => n.id === 'b').data.stacked, false);
  assert.ok(next.findIndex((n) => n.id === 'b') < next.findIndex((n) => n.id === 'a'));
  const view = getCanvasStackPresentation(next, [{ source: 'free', target: 'external' }]);
  assert.equal(view.nodes.find((n) => n.id === 'free').hidden, false);
  assert.equal(view.edges[0].source, 'free');
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
