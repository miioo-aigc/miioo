import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeCanvasNodes, getCanvasArrangement } from '../src/components/canvas/CanvasArrangement.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
const node = (id, x, y, width = 240, height = 264, extra = {}) => ({ id, type: 'text', position: { x, y }, measured: { width, height }, selected: true, data: { content: id }, ...extra });

test('三种排列适配不同尺寸、保留原点、重复执行不漂移', () => {
  const nodes = [node('a', 50, 100, 300, 400), node('b', 80, 500), node('c', 600, 800), node('d', 900, 900)];
  for (const mode of ['grid', 'horizontal', 'vertical']) {
    const next = arrangeCanvasNodes(nodes, mode);
    assert.deepEqual(next[0].position, { x: 50, y: 100 });
    assert.deepEqual(arrangeCanvasNodes(next, mode), next);
    for (let i = 0; i < next.length; i++) for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j];
      assert.ok(b.position.x >= a.position.x + a.measured.width + 32 || b.position.y >= a.position.y + a.measured.height + 32);
    }
  }
});

test('单组排列直接子节点，保持组原点和外部节点', () => {
  const group = node('g', 100, 200, 800, 800, { type: 'canvasGroup', style: { width: 800, height: 800 } });
  const outside = node('outside', 2000, 0, 240, 264, { selected: false });
  const nodes = [group, node('a', 20, 20, 240, 264, { selected: false, parentId: 'g' }), node('b', 300, 400, 240, 264, { selected: false, parentId: 'g' }), outside];
  const next = arrangeCanvasNodes(nodes, 'horizontal');
  assert.deepEqual(next[0].position, group.position);
  assert.deepEqual(next[0].style, { width: 552, height: 304 });
  assert.equal(next[3], outside);
  assert.equal(next[1].parentId, 'g');
});

test('跨父级、堆叠单组和提交锁禁止排列', () => {
  const cross = [node('a', 0, 0), node('b', 0, 0, 240, 264, { parentId: 'g' })];
  assert.equal(getCanvasArrangement(cross).reason, '请选择同一层级的节点');
  assert.equal(arrangeCanvasNodes(cross, 'grid'), cross);
  assert.equal(getCanvasArrangement([node('g', 0, 0, 312, 312, { type: 'canvasGroup', data: { stacked: true } })]).reason, '展开组后可排列');
  const locked = [node('a', 0, 0, 240, 264, { data: { submissionLocked: true } }), node('b', 1, 1)];
  assert.equal(arrangeCanvasNodes(locked, 'grid'), locked);
});

test('父子同时选择只移动根项，嵌套内容保持相对位置', () => {
  const nodes = [node('g', 0, 0, 500, 500, { type: 'canvasGroup', style: { width: 500, height: 500 } }), node('a', 20, 20, 240, 264, { parentId: 'g' }), node('b', 20, 800)];
  const next = arrangeCanvasNodes(nodes, 'horizontal');
  assert.equal(next[1], nodes[1]);
  assert.equal(next[2].position.x, 532);
});

test('一次排列可整体撤销和重做', () => {
  const nodes = [node('a', 0, 0), node('b', 600, 500)];
  const history = createCanvasHistory(nodes);
  history.setNodes((current) => arrangeCanvasNodes(current, 'horizontal'));
  history.undo();
  assert.deepEqual(history.getSnapshot().nodes.map((n) => n.position), nodes.map((n) => n.position));
  history.redo();
  assert.deepEqual(history.getSnapshot().nodes[1].position, { x: 272, y: 0 });
});

test('堆叠组作为整体按可见312px卡片排列，保留内部坐标', () => {
  const group = node('g', 100, 100, 900, 900, { type: 'canvasGroup', style: { width: 900, height: 900 }, data: { stacked: true, stackOffset: { x: 40, y: 50 } } });
  const child = node('child', 20, 20, 240, 264, { parentId: 'g', selected: false });
  const nodes = [group, child, node('b', 700, 700)];
  const next = arrangeCanvasNodes(nodes, 'horizontal');
  assert.equal(next[2].position.x, 484);
  assert.equal(next[2].position.y, 150);
  assert.equal(next[1], child);
  assert.deepEqual(arrangeCanvasNodes(next, 'horizontal'), next);
});
