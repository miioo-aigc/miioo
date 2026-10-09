import test from 'node:test';
import assert from 'node:assert/strict';
import { planCanvasImportPositions, getCanvasImportBounds, preserveCanvasImportPanels } from '../src/components/canvas/CanvasImportLayout.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { planCanvasReferenceBatch } from '../src/components/canvas/CanvasReferenceBatch.js';

test('按数量形成紧凑网格，不创建空节点', () => {
  for (const [count, columns, rows] of [[2, 2, 1], [3, 2, 2], [4, 2, 2], [6, 3, 2], [9, 3, 3], [10, 4, 3]]) {
    const positions = planCanvasImportPositions(count, { x: 0, y: 0 });
    assert.equal(positions.length, count);
    assert.equal(new Set(positions.map((p) => p.x)).size, columns);
    assert.equal(new Set(positions.map((p) => p.y)).size, rows);
  }
});
test('避让中央大型组合和组内节点，整批边界留出间距', () => {
  const group = { id: 'group', type: 'canvasGroup', position: { x: -500, y: -500 }, style: { width: 1000, height: 1000 }, data: {} };
  const child = { ...createCanvasNode('image', { x: 1800, y: 100 }, 'child'), parentId: group.id, measured: { width: 400, height: 500 } };
  const nodes = [group, child];
  const original = structuredClone(nodes);
  const bounds = getCanvasImportBounds(planCanvasImportPositions(9, { x: 0, y: 0 }, nodes));
  for (const rect of [{ x: -500, y: -500, width: 1000, height: 1000 }, { x: 1300, y: -400, width: 400, height: 500 }]) {
    assert.ok(bounds.x >= rect.x + rect.width + 32);
  }
  assert.deepEqual(nodes, original);
});
test('选中项优先且阻挡时只向右避让，横纵间距32px', () => {
  const anchor = { ...createCanvasNode('image', { x: 100, y: 200 }, 'a'), selected: true };
  const obstacle = { ...createCanvasNode('image', { x: 400, y: 200 }, 'b'), selected: false };
  const far = { ...createCanvasNode('image', { x: 3000, y: -2000 }, 'c'), selected: false };
  const positions = planCanvasImportPositions(4, { x: -1000, y: -1000 }, [anchor, obstacle, far]);
  assert.deepEqual(positions[0], { x: 672, y: 200 });
  assert.equal(positions[1].x - positions[0].x, 240 + 32);
  assert.equal(positions[2].y - positions[0].y, 264 + 32);
});
test('没有选中项时从全部内容右边缘导入，空画布保持居中', () => {
  const nodes = [
    { ...createCanvasNode('image', { x: 100, y: 200 }, 'a'), selected: false },
    { ...createCanvasNode('image', { x: 3000, y: -2000 }, 'b'), selected: false },
  ];
  assert.deepEqual(planCanvasImportPositions(1, { x: 0, y: 0 }, nodes), [{ x: 3272, y: -2000 }]);
  const bounds = getCanvasImportBounds(planCanvasImportPositions(4, { x: 500, y: 300 }));
  assert.equal(bounds.x + bounds.width / 2, 500);
  assert.equal(bounds.y + bounds.height / 2, 300);
});
test('连续批次避让上次新节点', () => {
  const positions = planCanvasImportPositions(6, { x: 0, y: 0 });
  const nodes = positions.map((p, i) => createCanvasNode('image', p, String(i)));
  const first = getCanvasImportBounds(positions);
  const second = getCanvasImportBounds(planCanvasImportPositions(6, { x: 0, y: 0 }, nodes));
  assert.ok(first.x + first.width <= second.x || second.x + second.width <= first.x
    || first.y + first.height <= second.y || second.y + second.height <= first.y);
});
test('不同高度的卡片每列独立接续，纵向间距始终32px', () => {
  const sizes = [160, 320, 264, 120, 480, 200].map((height) => ({ width: 240, height }));
  const positions = planCanvasImportPositions(6, { x: 0, y: 0 }, [], sizes);
  for (let index = 3; index < positions.length; index += 1) {
    assert.equal(positions[index].x, positions[index - 3].x);
    assert.equal(positions[index].y - positions[index - 3].y - sizes[index - 3].height, 32);
  }
  assert.notEqual(positions[3].y, positions[4].y);
  const bounds = getCanvasImportBounds(positions.map((position, index) => ({ ...position, ...sizes[index] })));
  assert.equal(bounds.y + bounds.height / 2, 0);
});
test('批量参考保留原输入框状态；单选继续打开目标', () => {
  for (const open of [false, true]) {
    const target = createCanvasNode('image', { x: 0, y: 0 }, 'target');
    target.data.imageReferenceLimit = 3;
    target.data.creationPanelOpen = open;
    target.selected = open;
    const assets = [1, 2].map((i) => ({ asset_type: 'image', url: `/image-${i}.png` }));
    const result = planCanvasReferenceBatch([target], target.id, assets);
    assert.equal(result.nodes.find((n) => n.id === target.id).data.creationPanelOpen, open);
    assert.ok(result.nodes.filter((n) => n.id !== target.id).every((n) => !n.data.creationPanelOpen && !n.selected));
    assert.equal(planCanvasReferenceBatch([target], target.id, assets.slice(0, 1)).nodes.find((n) => n.id === target.id).data.creationPanelOpen, true);
    assert.equal(preserveCanvasImportPanels([], result.nodes).some((n) => n.data.creationPanelOpen), false);
  }
});
