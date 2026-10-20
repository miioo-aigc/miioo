import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
const start = source.indexOf('    if (!projectId) return;', source.indexOf('// 订阅主体数据后台更新'));
const end = source.indexOf('\n  // 缓存订阅回调', start);
const body = source.slice(start, end);
assert.ok(start > 0 && end > start);
for (const controlled of [true, false]) {
  test(`缓存通知${controlled ? '不覆盖受控列表' : '仍更新非受控列表'}`, () => {
    const callbacks = {};
    const writes = [];
    const deps = {
      projectId: 'a', hasExternalChars: controlled, hasExternalScenes: controlled, hasExternalProps: controlled,
      K: { subjects: (id, type) => type }, normalizeSubjectList: list => list,
      subscribe: (key, callback) => { callbacks[key] = callback; return () => delete callbacks[key]; },
      setChars: list => writes.push(list), setScenes: list => writes.push(list), setProps: list => writes.push(list),
    };
    const cleanup = new Function(...Object.keys(deps), body)(...Object.values(deps));
    Object.values(callbacks).forEach(callback => callback([]));
    assert.equal(writes.length, controlled ? 0 : 3);
    cleanup(); assert.equal(Object.keys(callbacks).length, 0);
  });
}
test('批量失败的受控分支只委托父页面，不独立拉取覆盖列表', async () => {
  const branch = source.match(/if \(hasExternalChars && hasExternalScenes && hasExternalProps\) \{([\s\S]*?)\n        \} else \{/)[1];
  const calls = [];
  await new Function('onRefreshSubjects', 'projectId', 'batchSession', `return (async () => {${branch}})()`)(
    async (...args) => calls.push(args), 'a', 7,
  );
  assert.deepEqual(calls, [['a', 7]]);
  assert.match(source, /controller\.signal\.aborted \|\| !getToken\(\) \|\| batchSession !== getAuthSessionGeneration\(\)/);
});
