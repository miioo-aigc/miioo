import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasSearchParts, filterCanvasSearchNodes, revealCanvasSearchNode, getCanvasSearchFocus } from '../src/components/canvas/CanvasSearch.js';

const nodes = [
  { id: 'g', type: 'canvasGroup', position: { x: 100, y: 200 }, style: { width: 700, height: 400 }, data: { label: '组合', stacked: true } },
  { id: 'inner', parentId: 'g', type: 'canvasGroup', position: { x: 10, y: 20 }, data: { label: '子组', stacked: true } },
  { id: 'a', parentId: 'inner', type: 'image', position: { x: 30, y: 40 }, measured: { width: 240, height: 264 }, data: { label: '图片Ab图片' } },
  { id: 'b', type: 'video', position: { x: 0, y: 0 }, selected: true, data: { label: '视频', creationPanelOpen: true } },
];

test('名称搜索包含折叠成员，忽略大小写和首尾空格，支持类型及分组筛选', () => {
  assert.deepEqual(filterCanvasSearchNodes(nodes, ' ab ', 'all').map((n) => n.id), ['a']);
  assert.equal(filterCanvasSearchNodes(nodes, '', 'canvasGroup').length, 2);
  assert.equal(filterCanvasSearchNodes(nodes, '图片', 'video').length, 0);
  assert.equal(filterCanvasSearchNodes(nodes, '', 'all').length, 4);
});

test('高亮所有字面匹配，不把特殊字符作为正则表达式', () => {
  assert.deepEqual(canvasSearchParts('图片Ab图片', '图片'), [
    { text: '图片', match: true }, { text: 'Ab', match: false }, { text: '图片', match: true },
  ]);
  assert.deepEqual(canvasSearchParts('A[B', '['), [
    { text: 'A', match: false }, { text: '[', match: true }, { text: 'B', match: false },
  ]);
  assert.deepEqual(canvasSearchParts('Ab', ' '), [{ text: 'Ab', match: false }]);
});

test('定位成员展开所有祖先且仅选中目标，不进入编辑，不改变原始数据', () => {
  const next = revealCanvasSearchNode(nodes, 'a');
  assert.equal(next[0].data.stacked, false);
  assert.equal(next[1].data.stacked, false);
  assert.deepEqual(next.filter((n) => n.selected).map((n) => n.id), ['a']);
  assert.ok(next.every((n) => !n.data.creationPanelOpen));
  assert.equal(nodes[0].data.stacked, true);
  assert.equal(revealCanvasSearchNode(nodes, 'missing'), nodes);
});

test('绝对坐标居中且保留缩放，堆叠组使用呈现尺寸', () => {
  const viewport = { width: 1200, height: 900 };
  assert.deepEqual(getCanvasSearchFocus(nodes, 'a', viewport, 1), { x: 260, y: 392, zoom: 1 });
  assert.deepEqual(getCanvasSearchFocus(nodes, 'g', viewport, 1), { x: 250, y: 350, zoom: 1 });
  assert.equal(getCanvasSearchFocus(nodes, 'missing', viewport, 1), null);
  assert.ok(getCanvasSearchFocus(nodes, 'a', { width: 200, height: 300 }, 1).zoom < 1);
});
