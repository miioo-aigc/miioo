import assert from 'node:assert/strict';
import test from 'node:test';
import { installVideoControlDragGuard } from '../src/utils/VideoControlDragGuard.js';
function drag(path) {
  const event = new Event('dragstart', { cancelable: true });
  event.composedPath = () => path;
  return event;
}
test('视频控件拖放被取消，后续监听器不收到事件，卸载后恢复', () => {
  const target = new EventTarget();
  const dispose = installVideoControlDragGuard(target);
  let received = false;
  target.addEventListener('dragstart', () => { received = true; });
  const event = drag([{ tagName: 'VIDEO', controls: true }]);
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(received, false);
  dispose();
  const next = drag([{ tagName: 'VIDEO', controls: true }]);
  target.dispatchEvent(next);
  assert.equal(next.defaultPrevented, false);
  assert.equal(received, true);
});
test('内部控件事件路径和动态开启的播放控件受到保护', () => {
  const target = new EventTarget();
  installVideoControlDragGuard(target);
  const video = { tagName: 'VIDEO', controls: false };
  const before = drag([{}, video]);
  target.dispatchEvent(before);
  assert.equal(before.defaultPrevented, false);
  video.controls = true;
  const after = drag([{}, video]);
  target.dispatchEvent(after);
  assert.equal(after.defaultPrevented, true);
});
test('不影响图片与卡片拖放，也不取消视频指针及键盘操作', () => {
  const target = new EventTarget();
  installVideoControlDragGuard(target);
  for (const tagName of ['IMG', 'DIV', 'A']) {
    const event = drag([{ tagName }]);
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'click', 'keydown']) {
    const event = new Event(type, { cancelable: true });
    event.composedPath = () => [{ tagName: 'VIDEO', controls: true }];
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
});
