import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformRect, rectTransform, resizeRect, editorView } from '../src/utils/CompositionTransform.js';

test('默认铺满不变形，旧构图完整显示，手动坐标可跨视口复用', () => {
  const cover = transformRect({ mode: 'cover' }, 864 / 496, 1600, 900);
  assert.ok(cover.width >= 1600 && cover.height >= 900);
  assert.equal(cover.width / cover.height, 864 / 496);
  const legacy = transformRect(null, 864 / 496, 1600, 900);
  assert.ok(legacy.width <= 1600 && legacy.height <= 900);
  const manual = rectTransform({ x: -80, y: 40, width: 1800, height: 1200 }, 1600, 900);
  assert.deepEqual(transformRect(manual, 1, 800, 450), { x: -40.000000000000036, y: 20.00000000000003, width: 900, height: 600 });
});
test('角缩放固定对角并保持当前比例，边缩放可变形且不能翻转', () => {
  const rect = { x: 10, y: 20, width: 200, height: 100 };
  const corner = resizeRect(rect, 'nw', -40, -20);
  assert.equal(corner.width / corner.height, 2);
  assert.equal(corner.x + corner.width, 210);
  assert.equal(corner.y + corner.height, 120);
  const edge = resizeRect(rect, 'w', 400, 0);
  assert.ok(edge.width > 0);
  assert.equal(edge.height, 100);
  assert.equal(edge.x + edge.width, 210);
});
test('编辑视图同时容纳画布与越界素材', () => {
  const rect = { x: -500, y: -200, width: 2000, height: 1500 };
  const view = editorView(1000, 600, rect, { width: 800, height: 500 });
  assert.ok(view.left + rect.x * view.scale >= 23.9);
  assert.ok(view.top + (rect.y + rect.height) * view.scale <= 476.1);
});
