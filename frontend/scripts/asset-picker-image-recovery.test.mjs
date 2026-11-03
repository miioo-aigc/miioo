import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createImagePreviewLoad, reportImagePreviewReady } from '../src/utils/ImagePreviewLoad.js';
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const network = new EventTarget();
  network.navigator = { onLine: true };
  network.document = new EventTarget();
  network.document.visibilityState = 'visible';
  const states = [];
  const session = createImagePreviewLoad({ src: '/thumb?signature=keep', fallbackSrc: '/original?signature=keep', automaticRecovery: true, network, onChange: s => states.push(s), ...options });
  t.after(() => session.dispose());
  return { session, network, states, get state() { return states.at(-1); }, async advance(ms) { t.mock.timers.tick(ms); await tick(); } };
}
test('自动回退原图、限次重建图片，保留签名并隔离旧回执', async t => {
  const h = setup(t);
  h.session.start(); await tick(); const old = h.state;
  old.onError(); await tick(); assert.equal(h.state.resolvedSrc, '/original?signature=keep');
  h.state.onError(); await h.advance(1300); assert.equal(h.state.attempt, 3);
  h.state.onError(); await h.advance(2900); assert.equal(h.state.attempt, 4);
  h.state.onError(); await h.advance(10000); assert.equal(h.state.attempt, 4);
  old.onLoad(); assert.equal(h.state.status, 'error');
});
test('切回页面自动恢复，连续聚焦合并，成功后不刷新', async t => {
  const h = setup(t, { fallbackSrc: null, retryDelays: [] });
  h.session.start(); await tick(); h.state.onError();
  h.network.document.dispatchEvent(new Event('visibilitychange'));
  h.network.dispatchEvent(new Event('focus'));
  await h.advance(600); assert.equal(h.state.attempt, 2);
  h.state.onLoad();
  await h.advance(31000); h.network.dispatchEvent(new Event('focus'));
  await h.advance(600); assert.equal(h.state.attempt, 2);
});
test('其他预览成功通知使用成功地址恢复失败卡片', async t => {
  const h = setup(t, { retryDelays: [] });
  h.session.start(); await tick(); h.state.onError(); await tick(); h.state.onError();
  reportImagePreviewReady('/unrelated', h.network); await h.advance(600); assert.equal(h.state.attempt, 2);
  reportImagePreviewReady('/original?signature=keep', h.network);
  await h.advance(600); assert.equal(h.state.resolvedSrc, '/original?signature=keep');
  assert.equal(h.state.attempt, 3);
});
test('离线停止重试、联网恢复，关闭后清理所有恢复任务及事件', async t => {
  const h = setup(t, { fallbackSrc: null });
  h.session.start(); await tick();
  h.network.navigator.onLine = false; h.state.onError();
  await h.advance(5000); assert.equal(h.state.attempt, 1);
  h.network.navigator.onLine = true; h.network.dispatchEvent(new Event('online'));
  await h.advance(600); assert.equal(h.state.attempt, 2);
  h.state.onError(); h.session.dispose(); const count = h.states.length;
  await h.advance(40000); h.network.dispatchEvent(new Event('focus'));
  reportImagePreviewReady('/thumb?signature=keep', h.network);
  await h.advance(1000); assert.equal(h.states.length, count);
});
test('挂起图片超时后自动恢复', async t => {
  const h = setup(t, { fallbackSrc: null, timeoutMs: 100 });
  h.session.start(); await tick(); await h.advance(100);
  assert.equal(h.state.status, 'error');
  await h.advance(1300); assert.equal(h.state.attempt, 2);
});
test('重复唤醒有冷却，冷却结束后失败图片仍可自动恢复', async t => {
  const h = setup(t, { fallbackSrc: null, retryDelays: [] });
  h.session.start(); await tick(); h.state.onError();
  h.network.dispatchEvent(new Event('focus')); await h.advance(600);
  h.state.onError(); h.network.dispatchEvent(new Event('focus'));
  await h.advance(600); assert.equal(h.state.attempt, 2);
  await h.advance(30000); h.network.dispatchEvent(new Event('focus'));
  await h.advance(600); assert.equal(h.state.attempt, 3);
});
test('排队后断网不继续请求，相同备用地址不循环', async t => {
  const h = setup(t, { fallbackSrc: '/thumb?signature=keep' });
  h.session.start(); await tick(); h.state.onError();
  h.network.navigator.onLine = false;
  await h.advance(1300); assert.equal(h.state.attempt, 1);
  h.network.navigator.onLine = true; h.network.dispatchEvent(new Event('online'));
  await h.advance(600); assert.equal(h.state.attempt, 2);
});
