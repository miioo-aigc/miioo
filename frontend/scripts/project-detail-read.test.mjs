import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const body = source.match(/const loadProjectDetails = async \(projectId, requestedStep = null\) => \{([\s\S]*?)\n  \};/)?.[1];
assert.ok(body);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function harness(overrides = {}) {
  const state = {};
  const deps = {
    projectRouteRestore: { cancel() {} }, projectDetailVersion: { current: 0 },
    projectDetailOwner: { current: null }, getAuthSessionGeneration: () => 1,
    scriptEditVersion: { current: 0 },
    subjectRequestVersions: { current: { chars: 0, scenes: 0, props: 0 } },
    subjectInFlight: { current: {} },
    invalidate() {}, K: new Proxy({}, { get: () => () => '' }), MEDIUM: {}, peekCache: () => null,
    generateErrorProjectId: null, readUnlockedSteps: () => new Set(['subject']),
    localStorage: { getItem: () => null }, normalizeSubjects: (value) => value,
    buildEpisodeStatusMap: () => ({}), console: { error() {}, warn() {} },
    apiGetProject: async (id) => ({ id }), apiGetSubjects: async () => [],
    apiGetScriptWorkspace: async () => ({ content: 'new-script' }),
    apiGetSubjectsPage: async () => ({ list: [], hasMore: false }),
    apiGetEpisodes: async () => [], apiGetProjectOverview: async () => ({}),
    apiGetStoryboards: async () => [], ...overrides,
  };
  deps.bumpSubjectRequest = (key) => ++deps.subjectRequestVersions.current[key];
  deps.isCurrentSubjectRequest = (key, version, projectId, session) => (
    deps.subjectRequestVersions.current[key] === version
    && deps.getAuthSessionGeneration() === session
    && deps.projectDetailOwner.current?.id === projectId
    && deps.projectDetailOwner.current?.session === session
  );
  for (const name of new Set(body.match(/\bset[A-Z]\w*/g))) {
    deps[name] = (value) => { state[name] = typeof value === 'function' ? value(state[name]) : value; };
  }
  const read = new Function(...Object.keys(deps), `return async (projectId, requestedStep = null) => {${body}}`)(...Object.values(deps));
  return { state, deps, read };
}

test('甲详情迟到不覆盖乙，也不结束乙的加载', async () => {
  const a = deferred(); const b = deferred();
  const h = harness({ apiGetProject: (id) => id === 'a' ? a.promise : b.promise });
  const first = h.read('a'); const second = h.read('b');
  a.resolve({ id: 'a' }); await first;
  assert.equal(h.state.setActiveProject, null);
  assert.equal(h.state.setIsLoadingProject, true);
  b.resolve({ id: 'b' }); await second;
  assert.equal(h.state.setActiveProject.id, 'b');
  assert.equal(h.state.setProjectRead.loading, false);
});
test('同项目刷新失败保留内容及重试目标', async () => {
  let fail = false;
  const h = harness({ apiGetProject: async (id) => { if (fail) throw Error('offline'); return { id }; } });
  await h.read('a', 'storyboard'); fail = true;
  await h.read('a', 'storyboard');
  assert.equal(h.state.setActiveProject.id, 'a');
  assert.equal(h.state.setScriptContent, 'new-script');
  assert.equal(h.state.setProjectRead.requestedStep, 'storyboard');
  assert.ok(h.state.setProjectRead.error);
  fail = false; await h.read('a', 'storyboard');
  assert.equal(h.state.setProjectRead.error, '');
});
test('剧本分集失败不会把已有数据写空', async () => {
  let fail = false;
  const h = harness({
    apiGetScriptWorkspace: async () => { if (fail) throw Error(); return { content: 'old' }; },
    apiGetEpisodes: async () => { if (fail) throw Error(); return [{ id: 'episode' }]; },
  });
  await h.read('a'); fail = true; await h.read('a');
  assert.equal(h.state.setScriptContent, 'old');
  assert.equal(h.state.setScriptEpisodes.length, 1);
  assert.ok(h.state.setProjectRead.error);
});
test('详情等待期间页面更新剧本，旧响应不覆盖正文和分集', async () => {
  const batch = deferred();
  const h = harness({ apiGetScriptWorkspace: () => batch.promise });
  const pending = h.read('a');
  await new Promise((resolve) => setImmediate(resolve));
  h.deps.scriptEditVersion.current++;
  h.state.setScriptContent = 'edited';
  h.state.setScriptEpisodes = [{ id: 'edited-episode' }];
  batch.resolve({ content: 'stale' });
  await pending;
  assert.equal(h.state.setScriptContent, 'edited');
  assert.deepEqual(h.state.setScriptEpisodes, [{ id: 'edited-episode' }]);
});
for (const boundary of ['导航或卸载', '换号']) {
  test(`${boundary}后批量子请求不能回写`, async () => {
    const batch = deferred(); let session = 1;
    const h = harness({ apiGetScriptWorkspace: () => batch.promise, getAuthSessionGeneration: () => session });
    const pending = h.read('a');
    await new Promise((resolve) => setImmediate(resolve));
    if (boundary === '换号') session++; else h.deps.projectDetailVersion.current++;
    const before = { ...h.state };
    batch.resolve({ content: 'stale' }); await pending;
    assert.deepEqual(h.state, before);
  });
}

test('详情批量等待期间新主体刷新不被旧首屏覆盖', async () => {
  const batch = deferred();
  const h = harness({ apiGetScriptWorkspace: () => batch.promise });
  const pending = h.read('a');
  await new Promise((resolve) => setImmediate(resolve));
  h.deps.bumpSubjectRequest('chars');
  h.state.setSharedChars = [{ id: 'new' }];
  h.state.setSubjectPageMeta.chars = { loading: true, rawList: [{ id: 'new' }] };
  batch.resolve({ content: 'script' }); await pending;
  assert.deepEqual(h.state.setSharedChars, [{ id: 'new' }]);
  assert.equal(h.state.setSubjectPageMeta.chars.loading, true);
});
