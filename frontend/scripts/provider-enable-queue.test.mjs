import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderEnableQueue } from '../src/api/ProviderEnableQueue.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let generation = 0;
  const calls = [], changes = [], errors = [];
  const request = kind => (...args) => new Promise((resolve, reject) => calls.push({ kind, args, resolve, reject }));
  const queue = createProviderEnableQueue({ update: request('write'), read: request('read'), getGeneration: () => generation });
  return { queue, calls, changes, errors, switchAccount: () => generation++,
    toggle: (id = 'p', confirmed = false) => queue.toggle(id, confirmed, value => changes.push(value), message => errors.push(message)) };
}
test('连续点击立即变化，串行写入并合并中间意图', async () => {
  const f = fixture(), done = f.toggle();
  await tick();
  f.toggle(); f.toggle(); f.toggle();
  assert.deepEqual(f.changes, [true, false, true, false]);
  assert.equal(f.calls.length, 1);
  f.calls[0].resolve({ id: 'p', is_enabled: true }); await tick();
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].args, ['p', { is_enabled: false }]);
  f.calls[1].resolve({ id: 'p', is_enabled: false }); await done;
  assert.equal(f.changes.at(-1), false); assert.equal(f.queue.has('p'), false);
});
test('保存失败后读取服务器校正，不盲目反向恢复', async () => {
  const f = fixture(), done = f.toggle(); await tick();
  f.calls[0].reject(new Error('响应丢失')); await tick();
  assert.equal(f.calls[1].kind, 'read');
  f.calls[1].resolve([{ id: 'p', is_enabled: true }]); await done;
  assert.equal(f.changes.at(-1), true); assert.match(f.errors[0], /已按服务器/);
});
test('核对也失败时恢复最后确认状态并说明无法确认', async () => {
  const f = fixture(), done = f.toggle(); await tick();
  f.calls[0].reject(new Error()); await tick(); f.calls[1].reject(new Error()); await done;
  assert.equal(f.changes.at(-1), false); assert.match(f.errors[0], /未能确认/);
});
test('失败核对期间的新意图不会被旧结果覆盖，随后串行提交', async () => {
  const f = fixture(), done = f.toggle(); await tick();
  f.calls[0].reject(new Error()); await tick(); f.toggle();
  f.calls[1].resolve({ items: [{ id: 'p', is_enabled: true }] }); await tick();
  assert.deepEqual(f.changes, [true, false]);
  assert.equal(f.calls[2].kind, 'write');
  f.calls[2].resolve({ id: 'p', is_enabled: false }); await done;
  assert.equal(f.errors.length, 0); assert.equal(f.changes.at(-1), false);
});
test('账号切换后不发送排队请求、不读取新账号、不提示旧错误', async () => {
  const f = fixture(), done = f.toggle(); await tick(); f.toggle(); f.switchAccount();
  f.calls[0].reject(new Error()); await done;
  assert.equal(f.calls.length, 1); assert.equal(f.errors.length, 0); assert.equal(f.changes.length, 2);
});
test('等待队列结束后才允许重开读取，不同服务商独立处理', async () => {
  const f = fixture(), a = f.toggle(), b = f.toggle('q'); await tick();
  let ready = false; const wait = f.queue.wait().then(() => { ready = true; });
  f.calls[0].resolve({ id: 'p', is_enabled: true }); await a;
  assert.equal(ready, false); assert.equal(f.queue.has('q'), true);
  f.calls[1].resolve({ id: 'q', is_enabled: true }); await b; await wait; assert.equal(ready, true);
});
test('重新打开后的回调接管最新意图，旧回调不覆盖新视图', async () => {
  const f = fixture(), done = f.toggle(); await tick(); const next = [];
  f.queue.toggle('p', false, value => next.push(value), () => {});
  f.calls[0].resolve({ id: 'p', is_enabled: true }); await tick();
  assert.deepEqual(f.changes, [true]);
  f.calls[1].resolve({ id: 'p', is_enabled: false }); await done; assert.deepEqual(next, [false, false]);
});
test('写入响应错误编号或缺状态不冒充成功，按服务器读取核对', async () => {
  for (const result of [{}, { id: 'wrong', is_enabled: true }]) {
    const f = fixture(), done = f.toggle(); await tick(); f.calls[0].resolve(result); await tick();
    f.calls[1].resolve({ providers: [{ id: 'p', is_enabled: false }] }); await done;
    assert.equal(f.changes.at(-1), false); assert.equal(f.errors.length, 1);
  }
});
test('账号在排队请求发出前切换，不向新账号发写入', async () => {
  const f = fixture(), done = f.toggle(); f.switchAccount(); await done;
  assert.equal(f.calls.length, 0); assert.equal(f.errors.length, 0);
});
