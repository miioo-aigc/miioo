import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const start = source.indexOf('    const pid = activeProject.id;', source.indexOf('// 订阅主体缓存更新'));
const end = source.indexOf('\n  }, [activeProject?.id', start);
const body = source.slice(start, end);
assert.ok(start > 0 && end > start);
function harness() {
  const callbacks = {};
  const requests = [];
  const state = { items: {}, meta: {} };
  let session = 1;
  let token = true;
  const versions = { current: { chars: 0, scenes: 0, props: 0 } };
  const locks = { current: {} };
  const owner = { current: { id: 'a', session: 1 } };
  const setter = key => value => { state.items[key] = value; };
  for (const key of Object.keys(versions.current)) {
    state.items[key] = [{ id: 'old' }];
    state.meta[key] = { nextOffset: 60, hasMore: true, rawList: [{ id: 'old' }] };
  }
  const deps = {
    activeProject: { id: 'a' }, getToken: () => token,
    getAuthSessionGeneration: () => session, projectDetailOwner: owner,
    subjectRequestVersions: versions, subjectInFlight: locks,
    bumpSubjectRequest: key => ++versions.current[key],
    isCurrentSubjectRequest: (key, version, id, generation) => token && session === generation
      && owner.current?.id === id && owner.current?.session === generation && versions.current[key] === version,
    setSharedChars: setter('chars'), setSharedScenes: setter('scenes'), setSharedProps: setter('props'),
    normalizeSubjects: value => value,
    setSubjectPageMeta: fn => { state.meta = fn(state.meta); },
    K: { subjects: (id, type) => type },
    subscribe: (key, cb) => { callbacks[key] = cb; return () => delete callbacks[key]; },
    apiGetSubjectsPage: (id, options) => new Promise((resolve, reject) => requests.push({ id, options, resolve, reject })),
  };
  const cleanup = new Function(...Object.keys(deps), body)(...Object.values(deps));
  return { state, callbacks, requests, versions, locks, owner, cleanup,
    logout: () => { token = false; }, changeSession: () => { session++; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const page = { list: [{ id: 'new' }], nextOffset: 20, hasMore: true };

test('多页缓存通知重新读首页，列表和游标同步且不影响其他类别', async () => {
  const h = harness(); h.callbacks.character([{ id: 'partial' }]);
  assert.deepEqual(h.state.items.chars, [{ id: 'old' }]);
  assert.equal(h.state.meta.chars.loading, true);
  assert.deepEqual(h.requests[0].options, { type: 'character', limit: 20 });
  h.requests[0].resolve(page); await flush();
  assert.deepEqual(h.state.items.chars, page.list);
  assert.deepEqual(h.state.meta.chars.rawList, page.list);
  assert.equal(h.state.meta.chars.nextOffset, 20);
  assert.equal(h.state.meta.scenes.nextOffset, 60);
  assert.equal(h.locks.current.chars, false);
});
test('空缓存也触发读取，成功空结果清空内容及分页', async () => {
  const h = harness(); h.callbacks.character([]);
  h.requests[0].resolve({ list: [], hasMore: false, nextOffset: null }); await flush();
  assert.deepEqual(h.state.items.chars, []);
  assert.equal(h.state.meta.chars.hasMore, false);
  assert.equal(h.state.meta.chars.nextOffset, null);
});
test('刷新失败保留旧卡片，重试从首页开始', async () => {
  const h = harness(); h.callbacks.character([]);
  h.requests[0].reject(Error()); await flush();
  assert.deepEqual(h.state.items.chars, [{ id: 'old' }]);
  assert.equal(h.state.meta.chars.error, true);
  assert.equal(h.state.meta.chars.loading, false);
  assert.equal(h.state.meta.chars.retryOffset, null);
});
for (const outcome of ['resolve', 'reject']) {
  test(`连续通知旧${outcome}不能回写或释放新锁`, async () => {
    const h = harness(); h.callbacks.character([]); h.callbacks.character([]);
    const before = structuredClone(h.state);
    h.requests[0][outcome](page); await flush();
    assert.deepEqual(h.state, before);
    assert.equal(h.locks.current.chars, true);
    h.requests[1].resolve(page); await flush();
    assert.equal(h.locks.current.chars, false);
  });
  for (const boundary of ['project', 'session', 'logout']) {
    test(`${boundary}变化后${outcome}不回写也不接受新通知`, async () => {
      const h = harness(); h.callbacks.character([]);
      if (boundary === 'project') h.owner.current = { id: 'b', session: 1 };
      else if (boundary === 'session') h.changeSession();
      else h.logout();
      const before = structuredClone(h.state);
      h.requests[0][outcome](page); await flush(); h.callbacks.character([]);
      assert.deepEqual(h.state, before); assert.equal(h.requests.length, 1);
    });
  }
}
test('步骤解锁只读取一条且绕过主体缓存，卸载取消订阅', () => {
  assert.match(source, /const anySubjects = await apiGetSubjects\(projectId, \{ type: 'character', limit: 1 \}\)/);
  const h = harness(); h.cleanup(); assert.deepEqual(Object.keys(h.callbacks), []);
});
