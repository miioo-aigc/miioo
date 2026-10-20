import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../src/utils/subjectAdapter.js', import.meta.url), 'utf8');
const mergeBody = adapter.match(/export function mergeSubjectItems\(existing = \[\], incoming = \[\]\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(mergeBody);
const mergeSubjectItems = new Function('existing', 'incoming', mergeBody);
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function harness() {
  const state = { items: [{ id: 1, name: 'edited' }], meta: { chars: { loading: false, hasMore: true, nextOffset: 20, rawList: [{ id: 1 }] } } };
  const requests = [];
  let session = 1;
  const deps = {
    activeProject: { id: 'a' }, subjectPageMeta: state.meta,
    subjectRequestVersions: { current: { chars: 0 } }, subjectInFlight: { current: {} },
    getAuthSessionGeneration: () => session,
    normalizeSubjects: (value) => value, mergeSubjectItems, console: { error() {} },
    apiGetSubjectsPage: (id, options) => { const pending = deferred(); requests.push({ id, options, ...pending }); return pending.promise; },
    setSubjectPageMeta: (fn) => { state.meta = fn(state.meta); deps.subjectPageMeta = state.meta; },
    setSharedChars: (value) => { state.items = typeof value === 'function' ? value(state.items) : value; },
    setSharedScenes() {}, setSharedProps() {},
  };
  deps.bumpSubjectRequest = (key) => ++deps.subjectRequestVersions.current[key];
  deps.isCurrentSubjectRequest = (key, version, projectId, ownerSession) => (
    deps.subjectRequestVersions.current[key] === version && deps.activeProject?.id === projectId && session === ownerSession
  );
  const compile = (name) => {
    const body = source.match(new RegExp(`const ${name} = async \\(type(?:, restart = false)?\\) => \\{([\\s\\S]*?)\\n  \\};`))?.[1];
    assert.ok(body);
    return (restart = false) => new Function(...Object.keys(deps), `return async (type, restart) => {${body}}`)(...Object.values(deps))('character', restart);
  };
  return { state, deps, requests, more: compile('loadMoreSubjects'), retry: compile('retrySubjects'), changeSession: () => session++ };
}
const page = { list: [{ id: 1, name: 'stale' }, { id: 2 }], hasMore: true, nextOffset: 40 };

test('同帧重复触底只请求一次，重叠项去重并保留已有编辑', async () => {
  const h = harness(); const pending = h.more(); await h.more();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve(page); await pending;
  assert.deepEqual(h.state.items, [{ id: 1, name: 'edited' }, { id: 2 }]);
  assert.equal(h.state.meta.chars.rawList.length, 2);
  assert.equal(h.state.meta.chars.nextOffset, 40);
});
test('分页失败保留卡片与游标，暂停自动补页并重试原页', async () => {
  const h = harness(); const pending = h.more(); h.requests[0].reject(Error('offline')); await pending;
  assert.equal(h.state.items.length, 1); assert.equal(h.state.meta.chars.retryOffset, 20);
  await h.more(); assert.equal(h.requests.length, 1);
  const retry = h.retry(); assert.equal(h.requests[1].options.offset, 20);
  h.requests[1].resolve(page); await retry;
  assert.equal(h.state.items.length, 2); assert.equal(h.state.meta.chars.error, false);
});
for (const boundary of ['project', 'session', 'unmount']) {
  for (const outcome of ['success', 'failure']) {
    test(`${boundary}变化后分页${outcome}不回写`, async () => {
      const h = harness(); const pending = h.more();
      if (boundary === 'session') h.changeSession(); else h.deps.activeProject = boundary === 'project' ? { id: 'b' } : null;
      const before = structuredClone(h.state);
      if (outcome === 'success') h.requests[0].resolve(page); else h.requests[0].reject(Error());
      await pending; assert.deepEqual(h.state, before);
    });
  }
}
test('旧分页结束不能释放新刷新持有的同步锁', async () => {
  const h = harness(); const pending = h.more();
  h.deps.bumpSubjectRequest('chars'); h.deps.subjectInFlight.current.chars = true;
  h.requests[0].resolve(page); await pending;
  assert.equal(h.deps.subjectInFlight.current.chars, true);
  assert.equal(h.state.items.length, 1);
});
test('首屏重试替换而不是追加旧卡片', async () => {
  const h = harness(); h.state.meta.chars.error = true;
  const pending = h.retry(); assert.equal(h.requests[0].options.offset, undefined);
  h.requests[0].resolve({ list: [{ id: 3 }], hasMore: false }); await pending;
  assert.deepEqual(h.state.items, [{ id: 3 }]);
});

test('子页面刷新取代在途分页并从首页重建游标', async () => {
  const h = harness(); const old = h.more(); const fresh = h.retry(true);
  assert.equal(h.requests[1].options.offset, null);
  h.requests[0].resolve(page); await old;
  assert.equal(h.deps.subjectInFlight.current.chars, true);
  assert.equal(h.state.items.length, 1);
  h.requests[1].resolve({ list: [{ id: 3 }], nextOffset: 20, hasMore: true }); await fresh;
  assert.deepEqual(h.state.items, [{ id: 3 }]);
  assert.equal(h.state.meta.chars.nextOffset, 20);
});
test('子页面刷新失败不能沿用旧的失败页位置', async () => {
  const h = harness(); h.state.meta.chars.retryOffset = 40;
  const fresh = h.retry(true); h.requests[0].reject(Error()); await fresh;
  assert.equal(h.state.meta.chars.retryOffset, null);
  assert.equal(h.state.items.length, 1);
  const retry = h.retry(); assert.equal(h.requests[1].options.offset, null);
  h.requests[1].resolve(page); await retry;
});
