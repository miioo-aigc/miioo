import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SUBTITLE_MASK, resizeSubtitleMask } from '../src/components/video-edit/SubtitleMaskGeometry.js';

test('默认遮罩覆盖底部且不超出视频', () => {
  assert.equal(DEFAULT_SUBTITLE_MASK.x, 0);
  assert.equal(DEFAULT_SUBTITLE_MASK.width, 1);
  assert.equal(DEFAULT_SUBTITLE_MASK.y + DEFAULT_SUBTITLE_MASK.height, 1);
});

for (const direction of ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw']) {
  test(`${direction} 自由缩放且始终限制在视频内`, () => {
    const start = { x: 0.2, y: 0.3, width: 0.5, height: 0.4 };
    for (const dx of [-3, -0.1, 0, 0.1, 3]) {
      for (const dy of [-3, -0.1, 0, 0.1, 3]) {
        const result = resizeSubtitleMask(start, direction, dx, dy);
        assert.ok(result.x >= 0 && result.y >= 0);
        assert.ok(result.x + result.width <= 1.000001 && result.y + result.height <= 1.000001);
        assert.ok(result.width >= 0.019999 && result.height >= 0.019999);
        if (!direction.includes('n')) assert.equal(result.y, start.y);
        if (!direction.includes('w')) assert.equal(result.x, start.x);
      }
    }
  });
}
