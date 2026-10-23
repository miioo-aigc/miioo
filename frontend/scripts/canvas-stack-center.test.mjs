import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasStackPresentation, restoreCanvasStackPositionChange, setCanvasGroupsStacked } from '../src/components/canvas/CanvasNodeActions.js';

const initial = [
  { id: 'parent', type: 'canvasGroup', position: { x: 100, y: 80 }, style: { width: 900, height: 700 }, data: {} },
  { id: 'group', parentId: 'parent', type: 'canvasGroup', position: { x: 30, y: 40 }, style: { width: 600, height: 500 }, data: {} },
  { id: 'card', parentId: 'group', type: 'text', position: { x: 8, y: 8 }, data: {} },
];

test('嵌套组以点击位置居中，展开恢复原位', () => {
  const stacked = setCanvasGroupsStacked(initial, ['group'], true, { x: 500, y: 400 });
  const view = getCanvasStackPresentation(stacked, []).nodes[1];
  assert.equal(view.position.x + 100 + 156, 500);
  assert.equal(view.position.y + 80 + 156, 400);
  const expanded = setCanvasGroupsStacked(stacked, ['group'], false);
  assert.deepEqual(expanded.map((node) => node.position), initial.map((node) => node.position));
});

test('拖动堆叠只平移展开布局，不累计堆叠偏移', () => {
  let nodes = setCanvasGroupsStacked(initial, ['group'], true, { x: 500, y: 400 });
  for (let step = 1; step <= 3; step++) {
    const view = getCanvasStackPresentation(nodes, []).nodes[1];
    const change = restoreCanvasStackPositionChange({ id: 'group', type: 'position', position: { x: view.position.x + 20, y: view.position.y - 10 } }, nodes);
    nodes = nodes.map((node) => node.id === 'group' ? { ...node, position: change.position } : node);
    assert.deepEqual(nodes[1].position, { x: 30 + step * 20, y: 40 - step * 10 });
  }
  assert.deepEqual(setCanvasGroupsStacked(nodes, ['group'], false)[1].position, { x: 90, y: 10 });
  assert.deepEqual(nodes[2].position, initial[2].position);
});

test('快捷键堆叠保持原定位，重复收起不覆盖中心', () => {
  const nodes = setCanvasGroupsStacked(initial, ['group'], true);
  assert.deepEqual(getCanvasStackPresentation(nodes, []).nodes[1].position, initial[1].position);
  const centered = setCanvasGroupsStacked(initial, ['group'], true, { x: 600, y: 500 });
  assert.deepEqual(setCanvasGroupsStacked(centered, ['group'], true)[1].data.stackOffset, centered[1].data.stackOffset);
});
