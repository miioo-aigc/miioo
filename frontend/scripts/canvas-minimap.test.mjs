import test from 'node:test';
import assert from 'node:assert/strict';
import { getMiniMapRects, getMiniMapView } from '../src/components/canvas/CanvasMiniMapGeometry.js';

const frame = { x: 0, y: 24, width: 240, height: 240 };
const frames = new Map([['a', frame]]);
const node = { id: 'a', type: 'text', x: 100, y: 700, width: 240, height: 264 };
const viewport = { x: 0, y: 0, width: 800, height: 600 };

test('输入框展开不改变正文轮廓或小地图范围，包括视口外的节点', () => {
  const before = getMiniMapRects([node], frames);
  const after = getMiniMapRects([{ ...node, height: 600 }], frames);
  assert.deepEqual(before, [{ id: 'a', x: 100, y: 724, width: 240, height: 240 }]);
  assert.deepEqual(after, before);
  assert.deepEqual(getMiniMapView(before, viewport), getMiniMapView(after, viewport));
});

test('媒体正文实际尺寸变化正常更新，隐藏和未测量节点不绘制', () => {
  const measured = new Map([['a', { ...frame, width: 480, height: 120 }]]);
  assert.equal(getMiniMapRects([node], measured)[0].height, 120);
  assert.deepEqual(getMiniMapRects([{ ...node, hidden: true }], measured), []);
  assert.deepEqual(getMiniMapRects([node], new Map()), []);
});

test('组合使用原外框，不叠加正文偏移', () => {
  assert.deepEqual(getMiniMapRects([{ ...node, type: 'canvasGroup', width: 312, height: 312 }], frames),
    [{ id: 'a', x: 100, y: 700, width: 312, height: 312 }]);
});

test('空画布不包含坐标原点，显示范围保持地图比例并覆盖视口', () => {
  const view = getMiniMapView([], { x: 1000, y: 1000, width: 800, height: 600 });
  assert.ok(view.x > 0 && view.y > 0);
  assert.equal(view.width / view.height, 174 / 124);
  assert.ok(view.width >= 800 && view.height >= 600);
});
