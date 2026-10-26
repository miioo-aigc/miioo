import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCanvasNodes, getCanvasAbsolutePosition, setCanvasSelection, ungroupCanvasNodes } from '../src/components/canvas/CanvasGroups.js';
const item = { id: 'a', type: 'text', selected: true, position: { x: 100, y: 200 }, measured: { width: 240, height: 264 }, data: {} };
test('单节点组合保留坐标，解组恢复，空选择不创建组', () => {
  const initial = [item];
  const grouped = groupCanvasNodes(initial, 'g');
  assert.equal(grouped.length, 2);
  assert.equal(grouped[1].parentId, 'g');
  assert.deepEqual(getCanvasAbsolutePosition(grouped, grouped[1]), item.position);
  assert.deepEqual(grouped[1].position, { x: 8, y: 8 });
  const restored = ungroupCanvasNodes(grouped);
  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0].position, item.position);
  assert.equal(groupCanvasNodes(setCanvasSelection(initial, []), 'empty').length, 1);
});
test('单成员组内再次组合保留原父组与世界坐标', () => {
  const initial = groupCanvasNodes([item], 'outer');
  const nested = groupCanvasNodes(setCanvasSelection(initial, ['a']), 'inner');
  assert.equal(nested.find(n => n.id === 'inner').parentId, 'outer');
  assert.equal(nested.find(n => n.id === 'a').parentId, 'inner');
  assert.deepEqual(getCanvasAbsolutePosition(nested, nested.find(n => n.id === 'a')), item.position);
});
