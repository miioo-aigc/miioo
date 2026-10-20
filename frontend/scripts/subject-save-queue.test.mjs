import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
function queue(commit) {
  let current = true;
  const deps = {
    isSaveCurrent: () => current,
    draftDirtyRef: { current: true }, draftRef: { current: { name: 'A' } },
    draftFieldsRef: { current: new Set(['name']) }, draftVersionsRef: { current: { name: 1 } },
    saveChainRef: { current: Promise.resolve() }, onCommit: commit, showToast: () => {}, console: { error() {} },
  };
  const body = source.match(/const enqueueDraftSave = useCallback\(\(\) => \{([\s\S]*?)\n  \},/)[1];
  return { deps, enqueue: new Function(...Object.keys(deps), `return () => {${body}}`)(...Object.values(deps)), invalidate: () => { current = false; } };
}
test('旧保存成功不清除请求期间的新输入', async () => {
  let resolve;
  const q = queue(() => new Promise(r => { resolve = r; }));
  const saved = q.enqueue();
  await new Promise(r => setImmediate(r));
  q.deps.draftVersionsRef.current.name++;
  q.deps.draftRef.current = { name: 'B' };
  resolve();
  await saved;
  assert.equal(q.deps.draftDirtyRef.current, true);
});
test('旧任务失败后新任务成功可以清除待存，不恢复旧值', async () => {
  const values = [];
  const q = queue(async draft => { values.push(draft.name); if (draft.name === 'A') throw Error('失败'); });
  q.enqueue();
  q.deps.draftVersionsRef.current.name++;
  q.deps.draftRef.current = { name: 'B' };
  await q.enqueue();
  assert.deepEqual(values, ['A', 'B']);
  assert.equal(q.deps.draftDirtyRef.current, false);
});
test('失败保留待存字段供关闭重试', async () => {
  const q = queue(async () => { throw Error('失败'); });
  await q.enqueue();
  assert.equal(q.deps.draftDirtyRef.current, true);
  assert.deepEqual([...q.deps.draftFieldsRef.current], ['name']);
});
test('失效会话或卸载后不执行排队提交', async () => {
  let calls = 0;
  const q = queue(async () => { calls++; });
  const saved = q.enqueue();
  q.invalidate();
  await saved;
  assert.equal(calls, 0);
  assert.match(source, /saveSession === getAuthSessionGeneration\(\)/);
});
for (const type of ['Char', 'Scene', 'Prop']) {
  test(`${type} 保存成功后只回写本次字段，失败或失效不回写`, async () => {
    const bodies = [...source.matchAll(/onCommit=\{async \(draft, fields, isCurrent\) => \{([\s\S]*?)\n        \}\}/g)];
    const body = bodies[['Char', 'Scene', 'Prop'].indexOf(type)][1];
    for (const outcome of ['success', 'failure', 'stale']) {
      let list = [{ id: 1, name: 'old', desc: 'keep', prompt: 'keep' }];
      let selected = list[0];
      let current = true;
      const deps = {
        [`selected${type}`]: selected, projectId: 2,
        apiUpdateSubject: async () => {
          assert.equal(list[0].name, 'old');
          if (outcome === 'failure') throw Error('失败');
          if (outcome === 'stale') current = false;
        },
        [`set${type === 'Char' ? 'Chars' : type === 'Scene' ? 'Scenes' : 'Props'}`]: fn => { list = fn(list); },
        [`setSelected${type}`]: fn => { selected = fn(selected); },
      };
      const commit = new Function(...Object.keys(deps), `return async (draft, fields, isCurrent) => {${body}}`)(...Object.values(deps));
      await commit({ name: 'new', description: 'stale', prompt: 'stale' }, new Set(['name']), () => current).catch(() => {});
      assert.deepEqual(list[0], { id: 1, name: outcome === 'success' ? 'new' : 'old', desc: 'keep', prompt: 'keep' });
    }
  });
}
