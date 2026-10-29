import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transformRect, rectTransform, resizeRect, fitAxisTransform, scaleVisualTransform, visualScalePercent } from '../src/utils/CompositionTransform.js';

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
test('按宽高铺满恢复原始比例并居中，使用已有手动构图协议', () => {
  for (const axis of ['width', 'height']) {
    const result = fitAxisTransform(4 / 3, 16 / 9, axis);
    const rect = transformRect(result, 4 / 3, 1600, 900);
    assert.equal(rect.width / rect.height, 4 / 3);
    assert.equal(rect.x + rect.width / 2, 800);
    assert.equal(rect.y + rect.height / 2, 450);
    assert.equal(axis === 'width' ? rect.width : rect.height, axis === 'width' ? 1600 : 900);
  }
  assert.equal(fitAxisTransform(null, 16 / 9, 'width'), null);
});

test('尺寸滑杆固定基准，保留拉伸并以画布中心缩放偏移', () => {
  const original = { version: 1, mode: 'manual', width: 1, height: 0.5, center_x: 0.7, center_y: 0.4 };
  assert.equal(visualScalePercent({ mode: 'cover' }, 16 / 9, 16 / 9), 100);
  const enlarged = scaleVisualTransform(original, 16 / 9, 16 / 9, 200);
  assert.equal(enlarged.width, 2);
  assert.equal(enlarged.height, 1);
  assert.ok(Math.abs(enlarged.center_x - 0.9) < 1e-9);
  assert.ok(Math.abs(enlarged.center_y - 0.3) < 1e-9);
  const restored = scaleVisualTransform(enlarged, 16 / 9, 16 / 9, 100);
  assert.equal(restored.width, original.width);
  assert.equal(restored.height, original.height);
  assert.equal(scaleVisualTransform(original, 16 / 9, 16 / 9, 1).width, 0.01);
});
