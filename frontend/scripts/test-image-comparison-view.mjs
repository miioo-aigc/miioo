import assert from 'node:assert/strict';
import { clampComparisonView, INITIAL_COMPARISON_VIEW, zoomComparisonView } from '../src/components/image-edit/ComparisonView.js';

const anchor = { x: 0.2, y: -0.3 };
const zoomed = zoomComparisonView(INITIAL_COMPARISON_VIEW, -200, anchor);
assert.ok(zoomed.zoom > 1);
for (const axis of ['x', 'y']) {
  assert.ok(Math.abs((anchor[axis] - zoomed[axis]) / zoomed.zoom - anchor[axis]) < 1e-12);
}
assert.deepEqual(zoomComparisonView(zoomed, 10000, anchor), INITIAL_COMPARISON_VIEW);
assert.equal(zoomComparisonView(zoomed, -10000, anchor).zoom, 8);
assert.deepEqual(clampComparisonView({ zoom: 2, x: 20, y: -20 }), { zoom: 2, x: 0.5, y: -0.5 });
assert.deepEqual(zoomComparisonView({ zoom: 8, x: 0.1, y: 0.2 }, -20, anchor), { zoom: 8, x: 0.1, y: 0.2 });
console.log('对比图缩放测试通过：鼠标锚点稳定、倍率边界、平移边界、缩小复位');
