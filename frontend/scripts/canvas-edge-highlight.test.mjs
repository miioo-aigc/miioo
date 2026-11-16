import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveAdjacentEdgeIds, isCanvasNodeActive } from '../src/components/canvas/CanvasEdgeHighlight.js';

const edges = [
  { id: 'a-b', source: 'a', target: 'b' },
  { id: 'b-c', source: 'b', target: 'c' },
  { id: 'c-d', source: 'c', target: 'd' },
  { id: 'd-b', source: 'd', target: 'b' },
];
const nodesOf = (selectedIds, editingIds = []) => ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  selected: selectedIds.includes(id),
  data: { editing: editingIds.includes(id) },
}));

test('激活节点点亮直接连入和流出的连线，不向相邻节点扩散', () => {
  const highlighted = getActiveAdjacentEdgeIds(nodesOf(['b']), edges);
  assert.deepEqual([...highlighted].sort(), ['a-b', 'b-c', 'd-b']);
});

test('激活节点只影响自身相邻连线', () => {
  const highlighted = getActiveAdjacentEdgeIds(nodesOf(['a']), edges);
  assert.deepEqual([...highlighted], ['a-b']);
});

test('无激活节点时不点亮任何连线', () => {
  assert.equal(getActiveAdjacentEdgeIds(nodesOf([]), edges).size, 0);
  assert.equal(getActiveAdjacentEdgeIds([], edges).size, 0);
});

test('多节点同时激活时合并各自相邻的连线', () => {
  const highlighted = getActiveAdjacentEdgeIds(nodesOf(['a', 'd']), edges);
  assert.deepEqual([...highlighted].sort(), ['a-b', 'c-d', 'd-b']);
});

test('编辑中节点与选中节点同样视为激活', () => {
  assert.equal(isCanvasNodeActive({ id: 'b', selected: false, data: { editing: true } }), true);
  assert.equal(isCanvasNodeActive({ id: 'b', selected: true, data: {} }), true);
  assert.equal(isCanvasNodeActive({ id: 'b', selected: false, data: {} }), false);
  const highlighted = getActiveAdjacentEdgeIds(nodesOf([], ['c']), edges);
  assert.deepEqual([...highlighted].sort(), ['b-c', 'c-d']);
});
