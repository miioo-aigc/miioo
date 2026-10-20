import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../src/components/subject/SubjectPrimaryCoordinator.js', import.meta.url), 'utf8');
function setup(storage = new Map()) {
  const localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  return new Function('localStorage', `${source.replace(/export /g, '')}; return { getPrimaryVersion, beginManualPrimary, canApplyAutomaticPrimary, saveAutomaticPrimary };`)(localStorage);
}
test('手动设置或取消后，旧任务不能补封面，新任务仍可采用新版本', () => {
  const c = setup();
  assert.equal(c.canApplyAutomaticPrimary('p', 's', 0), true);
  for (let i = 0; i < 2; i++) {
    const old = c.getPrimaryVersion('p', 's');
    c.beginManualPrimary('p', 's');
    assert.equal(c.canApplyAutomaticPrimary('p', 's', old), false);
    assert.equal(c.canApplyAutomaticPrimary('p', 's', old + 1), true);
  }
});
test('关闭重开及刷新恢复仍拒绝旧版本，不影响其他主体和项目', () => {
  const storage = new Map();
  setup(storage).beginManualPrimary('p', 's');
  const restored = setup(storage);
  assert.equal(restored.canApplyAutomaticPrimary('p', 's'), false);
  assert.equal(restored.canApplyAutomaticPrimary('q', 's'), true);
  assert.equal(restored.canApplyAutomaticPrimary('p', 't'), true);
});
test('自动保存已发出时，手动操作等它结束后再提交', async () => {
  const c = setup(), order = [];
  let resolve;
  const automatic = c.saveAutomaticPrimary('p', 's', 0, () => new Promise(r => { resolve = r; order.push('自动发出'); }));
  const wait = c.beginManualPrimary('p', 's');
  const manual = wait.then(() => order.push('手动发出'));
  assert.deepEqual(order, ['自动发出']);
  resolve();
  await Promise.all([automatic, manual]);
  assert.deepEqual(order, ['自动发出', '手动发出']);
});
test('排队中的旧自动保存被丢弃，失败也不会阻塞手动操作', async () => {
  const c = setup();
  let reject, calls = 0;
  const first = c.saveAutomaticPrimary('p', 's', 0, () => new Promise((_, r) => { reject = r; }));
  const second = c.saveAutomaticPrimary('p', 's', 0, () => { calls++; });
  const wait = c.beginManualPrimary('p', 's');
  reject(Error('模拟失败'));
  await assert.rejects(first);
  await Promise.all([wait, second]);
  assert.equal(calls, 0);
});
