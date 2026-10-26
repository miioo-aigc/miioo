import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const start = source.indexOf('    const generation =', source.indexOf('const handleGoToAdmin'));
const body = source.slice(start, source.indexOf('  }, [showToast])', start));
assert.ok(start > 0 && body.includes('finally'));

function fixture() {
  let generation = 0;
  const pending = [], users = [], views = [], toasts = [];
  const handler = new Function('getAuthSessionGeneration', 'adminRequestRef',
    'apiGetCurrentUser', 'setAdminUser', 'setAdminView', 'showToast',
    'return async () => {' + body + '}')(
    () => generation, { current: null },
    () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    user => users.push(user), view => views.push(view), (...args) => toasts.push(args),
  );
  return { handler, pending, users, views, toasts, switchAccount: () => generation++ };
}

for (const is_admin of [true, false]) {
  test('有效身份进入管理台，保留管理员标识：' + is_admin, async () => {
    const f = fixture(), user = { id: 'user-a', is_admin };
    const task = f.handler(); f.pending[0].resolve(user); await task;
    assert.deepEqual(f.users, [null, user]);
    assert.deepEqual(f.views, [true]);
    assert.equal(f.toasts.length, 0);
  });
}
test('失败留在首页，再次点击可以恢复', async () => {
  const f = fixture();
  const task = f.handler(); f.pending[0].reject(new Error('断网')); await task;
  assert.deepEqual(f.views, []);
  assert.deepEqual(f.toasts, [['身份读取失败，请重试', 'error']]);
  const retry = f.handler(); f.pending[1].resolve({ id: 'user-a' }); await retry;
  assert.deepEqual(f.views, [true]);
});
test('同会话请求未结束时重复点击不再发请求', async () => {
  const f = fixture(), task = f.handler();
  await f.handler(); assert.equal(f.pending.length, 1);
  f.pending[0].resolve({ id: 'user-a' }); await task;
});
for (const fails of [false, true]) {
  test('切换账号后忽略旧响应且不释放新请求锁：' + fails, async () => {
    const f = fixture(), oldTask = f.handler();
    f.switchAccount(); const newTask = f.handler();
    if (fails) f.pending[0].reject(new Error('旧请求失败'));
    else f.pending[0].resolve({ id: 'old' });
    await oldTask; await f.handler();
    assert.equal(f.pending.length, 2);
    assert.deepEqual(f.views, []); assert.deepEqual(f.toasts, []);
    f.pending[1].resolve({ id: 'new' }); await newTask;
    assert.deepEqual(f.users, [null, null, { id: 'new' }]);
    assert.deepEqual(f.views, [true]);
  });
}
test('退出账号后旧成功响应不跳转', async () => {
  const f = fixture(), task = f.handler(); f.switchAccount();
  f.pending[0].resolve({ id: 'old' }); await task;
  assert.deepEqual(f.views, []); assert.deepEqual(f.toasts, []);
});
test('无效身份响应按读取失败处理，不沿用旧用户', async () => {
  for (const user of [null, {}, { id: '' }, { id: 1 }, { id: ' ' }]) {
    const f = fixture(), task = f.handler();
    f.pending[0].resolve(user); await task;
    assert.deepEqual(f.users, [null]); assert.deepEqual(f.views, []);
    assert.equal(f.toasts.length, 1);
  }
});
