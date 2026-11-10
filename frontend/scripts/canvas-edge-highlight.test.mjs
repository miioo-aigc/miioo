import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveUpstreamEdgeIds, isCanvasNodeActive } from '../src/components/canvas/CanvasEdgeHighlight.js';

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

test('激活节点只点亮直接连入的连线，1 跳，不向上游祖先扩散', () => {
  const highlighted = getActiveUpstreamEdgeIds(nodesOf(['b']), edges);
  assert.deepEqual([...highlighted].sort(), ['a-b', 'd-b']);
  assert.equal(highlighted.has('b-c'), false);
});

test('激活下游节点不会点亮其流出连线', () => {
  const highlighted = getActiveUpstreamEdgeIds(nodesOf(['a']), edges);
  assert.equal(highlighted.size, 0);
});

test('无激活节点时不点亮任何连线', () => {
  assert.equal(getActiveUpstreamEdgeIds(nodesOf([]), edges).size, 0);
  assert.equal(getActiveUpstreamEdgeIds([], edges).size, 0);
});

test('多节点同时激活时合并各自的上游连线', () => {
  const highlighted = getActiveUpstreamEdgeIds(nodesOf(['a', 'd']), edges);
  assert.deepEqual([...highlighted].sort(), ['c-d']);
});

test('编辑中节点与选中节点同样视为激活', () => {
  assert.equal(isCanvasNodeActive({ id: 'b', selected: false, data: { editing: true } }), true);
  assert.equal(isCanvasNodeActive({ id: 'b', selected: true, data: {} }), true);
  assert.equal(isCanvasNodeActive({ id: 'b', selected: false, data: {} }), false);
  const highlighted = getActiveUpstreamEdgeIds(nodesOf([], ['c']), edges);
  assert.deepEqual([...highlighted].sort(), ['b-c']);
});
