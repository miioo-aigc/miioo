import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCanvasTextWheel } from '../src/components/canvas/CanvasTextWheel.js';

function run(deltaX, deltaY, options = {}) {
  const pans = [];
  let prevented = false;
  let stopped = false;
  let position = options.position ?? 50;
  const element = {
    dataset: { textPreview: String(!options.editing) },
    clientHeight: 238,
    get scrollTop() { return position; },
    set scrollTop(value) { position = Math.max(0, Math.min(100, value)); },
  };
  handleCanvasTextWheel({
    deltaX, deltaY, deltaMode: options.deltaMode ?? 0, ctrlKey: options.ctrlKey ?? false,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  }, element, (delta) => pans.push(delta));
  const isolated = !options.ctrlKey || Boolean(options.editing);
  assert.equal(prevented, isolated);
  assert.equal(stopped, isolated);
  return { pans, position };
}

test('横向主手势只左右平移画布，丢弃纵向噪声', () => {
  assert.deepEqual(run(40, 9), { pans: [{ x: -20, y: 0 }], position: 50 });
  assert.deepEqual(run(-40, -9), { pans: [{ x: 20, y: 0 }], position: 50 });
});
test('纵向主手势只上下滚动正文，等量斜向归纵向', () => {
  assert.deepEqual(run(9, 20), { pans: [], position: 70 });
  assert.deepEqual(run(-9, -20), { pans: [], position: 30 });
  assert.deepEqual(run(10, 10), { pans: [], position: 60 });
});
test('正文到达顶部或底部仍不传给画布', () => {
  assert.deepEqual(run(0, -20, { position: 0 }), { pans: [], position: 0 });
  assert.deepEqual(run(0, 20, { position: 100 }), { pans: [], position: 100 });
});
test('兼容行与页滚动单位', () => {
  assert.deepEqual(run(2, 0, { deltaMode: 1 }), { pans: [{ x: -20, y: 0 }], position: 50 });
  assert.deepEqual(run(0, 1, { deltaMode: 2 }), { pans: [], position: 100 });
});
test('预览捏合冒泡给画布，不滚正文或平移；编辑状态继续隔离', () => {
  assert.deepEqual(run(0, -20, { ctrlKey: true }), { pans: [], position: 50 });
  assert.deepEqual(run(0, 20, { ctrlKey: true }), { pans: [], position: 50 });
  assert.deepEqual(run(40, 20, { ctrlKey: true, editing: true }), { pans: [], position: 50 });
});
