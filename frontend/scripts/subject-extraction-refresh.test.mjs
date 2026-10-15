import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const start = source.indexOf('      const SUBJECT_LIMIT = 20;', source.indexOf('await pollScriptTask(subjectTaskResponse'));
const end = source.indexOf('\n    } catch (err)', start);
assert.ok(start > 0 && end > start);
const body = source.slice(start, end);
function harness() {
  const state = { lists: {}, meta: {}, cleared: 0, toasts: 0, force: true };
  const requests = [];
  let current = true;
  const versions = { current: { chars: 0, scenes: 0, props: 0 } };
  const locks = { current: {} };
  const deps = {
    projectId: 'a', projectName: '甲', extractionSession: 1,
    subjectRequestVersions: versions, subjectInFlight: locks,
    bumpSubjectRequest: key => ++versions.current[key],
    isCurrentSubjectRequest: (key, version) => current && versions.current[key] === version,
    normalizeSubjects: list => list,
    setSharedChars: list => { state.lists.chars = list; },
    setSharedScenes: list => { state.lists.scenes = list; },
    setSharedProps: list => { state.lists.props = list; },
    setSubjectPageMeta: fn => { state.meta = fn(state.meta); },
    setForceExtract: value => { state.force = value; },
    clearPendingSubjectExtraction: () => state.cleared++,
    showToast: () => state.toasts++,
    setTimeout: fn => { current = false; fn(); },
    apiGetSubjectsPage: (id, options) => new Promise((resolve, reject) => requests.push({ id, options, resolve, reject })),
  };
  const run = () => new Function(...Object.keys(deps), `return (async () => {${body}})()`)(...Object.values(deps));
  const resolve = (list = [{ id: 1 }]) => requests.forEach(req => req.resolve({ list, hasMore: true, nextOffset: 20 }));
  return { state, requests, versions, locks, run, resolve, leave: () => { current = false; } };
}
test('抽取完成刷新同时更新三类列表及分页状态，并释放锁', async () => {
  const h = harness(); const pending = h.run();
  assert.equal(h.requests.length, 3); assert.equal(h.state.meta.chars.loading, true);
  h.resolve(); await pending;
  assert.equal(Object.keys(h.state.lists).length, 3);
  assert.equal(h.state.meta.chars.nextOffset, 20);
  assert.equal(h.state.cleared, 1); assert.equal(h.state.toasts, 1);
  assert.equal(h.locks.current.chars, false);
});
for (const result of ['success', 'failure']) {
  test(`归属失效后迟到${result}不更新列表、分页、任务记录或提示`, async () => {
    const h = harness(); const pending = h.run(); h.leave();
    const before = structuredClone(h.state);
    if (result === 'success') h.resolve(); else h.requests[0].reject(Error('断网'));
    await pending; assert.deepEqual(h.state, before);
  });
}
test('某类别被新刷新取代时，只更新其他类别且不释放新锁', async () => {
  const h = harness(); const pending = h.run();
  h.versions.current.chars++; h.resolve(); await pending;
  assert.equal(h.state.lists.chars, undefined);
  assert.equal(h.state.lists.scenes.length, 1);
  assert.equal(h.locks.current.chars, true);
});
test('当前读取失败保留列表，结束等待并登记首屏重试', async () => {
  const h = harness(); h.state.lists.chars = [{ id: 'old' }];
  const pending = h.run(); h.requests[0].reject(Error('断网'));
  await assert.rejects(pending, /断网/);
  assert.deepEqual(h.state.lists.chars, [{ id: 'old' }]);
  assert.equal(h.state.meta.chars.loading, false);
  assert.equal(h.state.meta.chars.error, true);
  assert.equal(h.state.meta.chars.retryOffset, null);
  assert.equal(h.locks.current.chars, false);
});
test('空结果重试间离开时不再发送下一轮请求', async () => {
  const h = harness(); const pending = h.run(); h.resolve([]); await pending;
  assert.equal(h.requests.length, 3); assert.equal(h.state.cleared, 0);
});
