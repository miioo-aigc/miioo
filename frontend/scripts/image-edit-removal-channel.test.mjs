import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageEditRemovalChannel } from '../src/utils/ImageEditRemovalChannel.js';

test('通知只唤醒核验，前台补查去重，释放监听', async () => {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  let channel, checks = 0, reconciles = 0, release;
  const bridge = createImageEditRemovalChannel({
    verify: async (scope, id) => { assert.equal(scope, 'scope'); assert.equal(id, 'id'); checks++; },
    reconcile: () => { reconciles++; return new Promise(resolve => { release = resolve; }); },
    onError: assert.fail,
  }, { window, document, BroadcastChannel: class {
    constructor() { channel = this; }
    postMessage(data) { this.last = data; }
    close() { this.closed = true; }
  } });
  bridge.notify('scope', 'id');
  assert.deepEqual(channel.last, { type: 'removed', scope: 'scope', id: 'id' });
  channel.onmessage({ data: { type: 'removed', id: 42 } });
  channel.onmessage({ data: channel.last });
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(checks, 1);
  assert.equal(reconciles, 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
  bridge.dispose();
  window.dispatchEvent(new Event('focus'));
  assert.equal(reconciles, 1);
  assert.equal(channel.closed, true);
});

test('广播不可用仍能前台核验，读取失败报告但不自动删除', async () => {
  const window = new EventTarget(), document = new EventTarget();
  document.visibilityState = 'hidden';
  let calls = 0, errors = 0;
  const bridge = createImageEditRemovalChannel({ verify() {}, reconcile() { calls++; throw new Error('读取失败'); }, onError() { errors++; } }, { window, document });
  bridge.notify('scope', 'id');
  window.dispatchEvent(new Event('focus'));
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(errors, 1);
  bridge.dispose();
});
