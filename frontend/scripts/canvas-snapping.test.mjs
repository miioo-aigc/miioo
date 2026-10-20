import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getSnapBox, snapCanvasNodes } from '../src/components/canvas/CanvasSnapping.js';
import { measureCanvasSnapFrames } from '../src/components/canvas/CanvasSnapMeasurements.js';

const card = (id, x, y, extra = {}) => ({ id, type: 'image', position: { x, y }, measured: { width: 240, height: 264 }, data: {}, ...extra });

test('正文测量不读取节点整体尺寸或输入框，缩放不改变布局尺寸', () => {
  const frames = measureCanvasSnapFrames({ querySelectorAll(selector) {
    assert.equal(selector, '.react-flow__node');
    return [{ dataset: { id: 'a' }, querySelector(frameSelector) {
      assert.equal(frameSelector, ':scope > .canvas-node > .canvas-node__frame');
      return { offsetLeft: 0, offsetTop: 24, offsetWidth: 240, offsetHeight: 135 };
    } }];
  } });
  assert.deepEqual(frames.get('a'), { x: 0, y: 24, width: 240, height: 135 });
});

test('向下拖动以正文底边吸附，双方输入框开关不改变落点', () => {
  const frames = new Map(['a', 'b'].map((id) => [id, { x: 0, y: 24, width: 240, height: 240 }]));
  for (const height of [264, 620]) {
    const nodes = [card('a', 0, 97, { measured: { width: 240, height } }),
      card('b', 300, 100, { measured: { width: 240, height } })];
    const result = snapCanvasNodes(nodes, ['a'], 1, {}, frames);
    assert.equal(result.nodes[0].position.y, 100);
    assert.equal(getSnapBox(result.nodes, result.nodes[0], frames).height, 240);
    assert.ok(result.guides.some((line) => line.axis === 'y' && [124, 364].includes(line.value)));
  }
});

test('正文底边可对齐目标顶边，不吸附输入框底边', () => {
  const frames = new Map(['a', 'b'].map((id) => [id, { x: 0, y: 24, width: 240, height: 240 }]));
  const nodes = [card('a', 0, 97, { measured: { width: 240, height: 600 } }), card('b', 300, 340)];
  const result = snapCanvasNodes(nodes, ['a'], 1, {}, frames);
  assert.equal(result.nodes[0].position.y, 100);
  assert.ok(result.guides.some((line) => line.axis === 'y' && line.value === 364));
});

test('空白区域正文左上角吸附16网格，不修改输入', () => {
  const nodes = [card('a', 19, 19)];
  const result = snapCanvasNodes(nodes, ['a']);
  assert.deepEqual(result.nodes[0].position, { x: 24.5, y: 16.5 });
  assert.deepEqual(nodes[0].position, { x: 19, y: 19 });
  assert.deepEqual(result.guides, []);
});

test('右边缘吸附邻近左边缘优先于网格；释放距离大于进入距离', () => {
  const nodes = [card('a', 57, 300), card('b', 300, 0)];
  const first = snapCanvasNodes(nodes, ['a']);
  assert.equal(first.nodes[0].position.x, 60);
  assert.ok(first.guides.some((line) => line.axis === 'x' && line.value === 300));
  const moved = [card('a', 52, 300), nodes[1]];
  assert.equal(snapCanvasNodes(moved, ['a'], 1, first).nodes[0].position.x, 60);
  assert.equal(snapCanvasNodes(moved, ['a']).guides.some((line) => line.axis === 'x'), false);
});

test('吸附阈值使用屏幕像素；远处卡片不参与', () => {
  const nodes = [card('a', 50, 300), card('b', 300, 0)];
  assert.equal(snapCanvasNodes(nodes, ['a'], 0.5).nodes[0].position.x, 60);
  assert.equal(snapCanvasNodes(nodes, ['a'], 2).guides.some((line) => line.axis === 'x'), false);
  assert.equal(snapCanvasNodes([nodes[0], card('b', 290, 2000)], ['a']).guides.length, 0);
});

test('多选统一位移，组和后代不会双重移动', () => {
  const nodes = [card('a', 19, 19), card('b', 319, 419)];
  const result = snapCanvasNodes(nodes, ['a', 'b']).nodes;
  assert.equal(result[1].position.x - result[0].position.x, 300);
  assert.equal(result[1].position.y - result[0].position.y, 400);
  const group = card('g', 19, 19, { type: 'canvasGroup' });
  const child = card('c', 8, 8, { parentId: 'g' });
  assert.deepEqual(snapCanvasNodes([group, child], ['g', 'c']).nodes[1].position, child.position);
});

test('堆叠偏移和组内绝对位置参与计算，隐藏成员不参与', () => {
  const group = card('g', 100, 100, { type: 'canvasGroup', data: { stacked: true, stackOffset: { x: 20, y: 30 } } });
  const child = card('c', 8, 8, { parentId: 'g' });
  assert.deepEqual(getSnapBox([group, child], group), { x: 120, y: 130, width: 312, height: 312 });
  const nodes = [card('a', 109, 700), group, child];
  assert.equal(snapCanvasNodes(nodes, ['a']).guides.length, 0);
  const expanded = { ...group, data: {} };
  assert.equal(getSnapBox([expanded, child], child).x, 108);
});

test('工具栏开关位于地图与分享之间，默认关闭并守卫吸附入口', () => {
  const toolbar = readFileSync(new URL('../src/components/canvas/CanvasToolbar.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/components/canvas/UseCanvasSnapping.js', import.meta.url), 'utf8');
  assert.match(toolbar, /key: 'map'[\s\S]*key: 'snap'[\s\S]*key: 'share'/);
  assert.match(hook, /\[enabled, setEnabled\] = useState\(false\)/);
  assert.match(hook, /if \(!enabled\) return nodes/);
});
