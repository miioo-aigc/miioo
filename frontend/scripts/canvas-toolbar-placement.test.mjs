import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasToolbarNodePosition } from '../src/components/canvas/CanvasImportLayout.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { getCanvasStackPresentation } from '../src/components/canvas/CanvasNodeActions.js';

test('空画布在当前视口中心创建', () => {
  assert.deepEqual(getCanvasToolbarNodePosition([], { x: -500, y: 800 }), { x: -620, y: 668 });
});

test('连续新增文本图片视频始终向右，保留32px间距', () => {
  const nodes = [];
  let center = { x: 500, y: 300 };
  for (const type of ['text', 'image', 'video']) {
    const position = getCanvasToolbarNodePosition(nodes, center);
    assert.equal(position.x, 380 + nodes.length * 272);
    assert.equal(position.y, 168);
    nodes.push(createCanvasNode(type, position, type));
    center = { x: position.x + 120, y: position.y + 132 };
  }
});

test('考虑最右侧节点真实宽度及父组绝对坐标', () => {
  const nodes = [
    { id: 'g', type: 'canvasGroup', position: { x: 100, y: 0 }, style: { width: 600 }, data: {} },
    { ...createCanvasNode('image', { x: 500, y: 0 }, 'a'), parentId: 'g', measured: { width: 480 } },
    createCanvasNode('text', { x: -500, y: 0 }, 'b'),
  ];
  assert.deepEqual(getCanvasToolbarNodePosition(nodes, { x: 0, y: -100 }), { x: 1112, y: -232 });
});

test('堆叠组使用312px外框并排除隐藏成员', () => {
  const nodes = [
    { id: 'g', type: 'canvasGroup', position: { x: 100, y: 0 }, style: { width: 2000 }, data: { stacked: true } },
    { ...createCanvasNode('image', { x: 1500, y: 0 }, 'a'), parentId: 'g' },
  ];
  const presentation = getCanvasStackPresentation(nodes, []).nodes;
  assert.equal(getCanvasToolbarNodePosition(presentation, { x: 0, y: 0 }).x, 444);
});
