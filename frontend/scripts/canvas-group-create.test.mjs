import test from 'node:test';
import assert from 'node:assert/strict';
import { appendCanvasNode, createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';

const group = (id, position, parentId) => ({ id, type: 'canvasGroup', parentId, position, style: { width: 500, height: 500 }, data: {} });

test('四类节点在嵌套组右键位置创建，保持已有成员世界坐标及输入不变', () => {
  for (const type of ['text', 'image', 'video', 'audio']) {
    const nodes = [group('outer', { x: 100, y: 200 }), group('inner', { x: 20, y: 30 }, 'outer'),
      { ...createCanvasNode(type, { x: 8, y: 8 }, 'old'), parentId: 'inner' }];
    const before = structuredClone(nodes);
    const point = { x: 580, y: 680 };
    const next = appendCanvasNode(nodes, createCanvasNode(type, point, 'new'), 'inner');
    const added = next.find((n) => n.id === 'new');
    assert.equal(added.parentId, 'inner');
    assert.equal(added.data.sequence, 2);
    assert.equal(added.data.creationPanelOpen, true);
    assert.deepEqual(next.filter((n) => n.selected).map((n) => n.id), ['new']);
    assert.deepEqual(getCanvasAbsolutePosition(next, added), point);
    assert.deepEqual(getCanvasAbsolutePosition(next, next.find((n) => n.id === 'old')), { x: 128, y: 238 });
    assert.deepEqual(nodes, before);
  }
});

test('组内创建与组边界调整可一次撤销重做；折叠或失效目标不能创建', () => {
  const nodes = [group('g', { x: 100, y: 200 })];
  const node = createCanvasNode('text', { x: 550, y: 650 }, 'new');
  const history = createCanvasHistory(nodes);
  history.setNodes((current) => appendCanvasNode(current, node, 'g'));
  const created = history.getSnapshot().nodes;
  history.undo();
  assert.deepEqual(history.getSnapshot().nodes.map((item) => item.id), ['g']);
  history.redo();
  const restored = history.getSnapshot().nodes;
  assert.deepEqual(restored.map((item) => [item.id, item.parentId, item.position, item.style]), created.map((item) => [item.id, item.parentId, item.position, item.style]));
  history.dispose();
  const stacked = [{ ...nodes[0], data: { stacked: true } }];
  assert.equal(appendCanvasNode(stacked, node, 'g'), stacked);
  assert.equal(appendCanvasNode(nodes, node, 'missing'), nodes);
  assert.equal(appendCanvasNode(nodes, node).find((n) => n.id === 'new').parentId, undefined);
});
