import test from 'node:test';
import assert from 'node:assert/strict';
import { framePointerPosition } from '../src/components/video-edit/FramePointer.js';
test('点击坐标在缩放、边框及滚动下精确还原，保留帧内位置', () => {
  for (const scale of [0.6, 0.85, 1, 1.25]) {
    for (const scroll of [0, 230, 800]) {
      const expected = scroll + 37.25;
      const result = framePointerPosition(100 + (37.25 + 1) * scale, { left: 100, width: 1000 * scale }, 1000, 1, scroll, 100, 30);
      assert.ok(Math.abs(result.position - expected) < 1e-9);
      assert.equal(result.index, Math.floor(expected / 100));
    }
  }
});
test('轨道两端限制在实际帧范围内', () => {
  assert.deepEqual(framePointerPosition(-50, { left: 0, width: 100 }, 100, 1, 0, 50, 4), { position: 0, index: 0 });
  assert.deepEqual(framePointerPosition(500, { left: 0, width: 100 }, 100, 1, 0, 50, 4), { position: 200, index: 3 });
});
