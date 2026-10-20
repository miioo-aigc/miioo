import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function getSubjectExtractionTaskKey'), source.indexOf('function readUnlockedSteps'));
const start = source.indexOf('  const handleExtractSubjects = useCallback(async () => {');
const end = source.indexOf('\n  }, [activeProjectIdForExtraction', start);
const body = source.slice(start + '  const handleExtractSubjects = useCallback(async () => {'.length, end);
function harness(saved, overrides = () => ({})) {
  const data = new Map();
  const state = { calls: [], errors: {}, loading: {}, messages: {}, toasts: [] };
  let session = 1;
  const localStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new Function('localStorage', 'SUBJECT_EXTRACTION_TASK_KEY_PREFIX', `${helpers}; return { readPendingSubjectExtraction, writePendingSubjectExtraction, clearPendingSubjectExtraction };`)(localStorage, 'task:');
  if (saved) store.writePendingSubjectExtraction('p', 'u', saved);
  const setter = key => fn => { state[key] = fn(state[key]); };
  const deps = {
    ...store, activeProjectIdForExtraction: 'p', activeProjectNameForExtraction: '项目', extractionOwnerId: 'u',
    getAuthSessionGeneration: () => session, getToken: () => true,
    extractionMountedRef: { current: true }, extractingSubjectsRef: { current: {} },
    currentProjectIdRef: { current: 'other' },
    setSubjectExtractionByProject: setter('loading'), setSubjectExtractionStatusByProject: setter('messages'), setExtractErrorByProject: setter('errors'),
    showToast: (...args) => state.toasts.push(args), console: { error() {} },
    apiGetScriptStructure: async () => ({ revision: 1 }),
    apiGetStorageUsage: async () => ({}),
    apiPublishScriptStructure: async () => { state.calls.push('publish'); return { task_id: 'pub', status: 'completed' }; },
    apiExtractSubjectsByEpisodes: async () => { state.calls.push('extract'); return { task_id: 'sub', status: 'completed' }; },
    apiGetScriptTask: async (_project, id) => { state.calls.push(id); return { task_id: id, status: 'completed' }; },
    setTimeout: fn => queueMicrotask(fn),
  };
  Object.assign(deps, overrides(state, () => { session++; }));
  return {
    state, store, data,
    run: () => new Function(...Object.keys(deps), `return (async () => {${body}})()`)(...Object.values(deps)),
    saved: () => store.readPendingSubjectExtraction('p', 'u'),
  };
}
test('已知任务查询失败保留编号，重试只查原任务', async () => {
  let fail = true;
  const h = harness({ phase: 'subject', taskId: 'sub' }, () => ({ apiGetScriptTask: async () => {
    if (fail) throw Error('断网');
    return { status: 'completed' };
  } }));
  await h.run();
  assert.equal(h.saved().taskId, 'sub');
  assert.equal(h.saved().status, 'paused');
  fail = false; await h.run();
  assert.equal(h.saved().phase, 'results');
  assert.deepEqual(h.state.calls, []);
});
test('结果阶段刷新失败后重试只读列表，不查询或重新提交抽取任务', async () => {
  let fail = true;
  let reads = 0;
  const versions = {};
  const h = harness({ phase: 'results', taskId: 'sub', status: 'paused' }, () => ({
    currentProjectIdRef: { current: 'p' },
    invalidate() {}, K: { subjectsPrefix: () => '', projectOverview: () => '' },
    setSharedChars() {}, setSharedScenes() {}, setSharedProps() {},
    bumpSubjectRequest: key => (versions[key] = (versions[key] || 0) + 1),
    subjectInFlight: { current: {} }, subjectRequestVersions: { current: versions },
    setSubjectPageMeta: fn => fn({}), isCurrentSubjectRequest: () => true,
    apiGetSubjectsPage: async () => {
      reads++;
      if (fail) throw Error('列表读取断网');
      return { list: [{ id: 'a' }], hasMore: false, nextOffset: null };
    },
    normalizeSubjects: list => list, setForceExtract() {},
  }));
  await h.run();
  assert.equal(h.saved().phase, 'results');
  assert.equal(h.saved().status, 'paused');
  fail = false;
  await h.run();
  assert.equal(reads, 6);
  assert.equal(h.saved(), null);
  assert.deepEqual(h.state.calls, []);
});
test('提交返回丢失时保留待确认记录，反复重试不再提交', async () => {
  const h = harness(null, state => ({ apiExtractSubjectsByEpisodes: async () => { state.calls.push('extract'); throw Error('断网'); } }));
  await h.run();
  assert.equal(h.saved().phase, 'subject');
  assert.equal(h.saved().status, 'unknown');
  await h.run();
  assert.deepEqual(h.state.calls, ['publish', 'extract']);
  assert.match(h.saved().error, /待确认/);
});
test('恢复发布任务时，抽取响应缺少编号不能借用发布编号', async () => {
  const h = harness({ phase: 'publish', taskId: 'pub', sourceRevision: 1 }, () => ({ apiExtractSubjectsByEpisodes: async () => ({}) }));
  await h.run();
  assert.equal(h.saved().status, 'unknown');
  assert.equal(h.saved().taskId, undefined);
});
test('发布请求期间会话失效，不继续抽取或覆盖持久记录', async () => {
  const h = harness(null, (state, expire) => ({ apiPublishScriptStructure: async () => {
    state.calls.push('publish'); expire(); return { task_id: 'pub', status: 'completed' };
  } }));
  await h.run();
  assert.deepEqual(h.state.calls, ['publish']);
  assert.equal(h.saved().status, 'submitting');
  assert.deepEqual(h.state.errors, {});
});
test('轮询连续三次失败暂停并保留原任务', async () => {
  let queries = 0;
  const h = harness({ phase: 'subject', taskId: 'sub' }, () => ({ apiGetScriptTask: async () => {
    queries++; if (queries > 1) throw Error('断网'); return { status: 'running' };
  } }));
  await h.run();
  assert.equal(queries, 4);
  assert.equal(h.saved().status, 'paused');
  assert.equal(h.saved().taskId, 'sub');
  assert.deepEqual(h.state.loading, {});
});
test('账号隔离且旧版归属不明记录不会自动恢复', () => {
  const h = harness({ phase: 'subject', taskId: 'sub' });
  assert.equal(h.store.readPendingSubjectExtraction('p', 'other'), null);
  h.data.set('task:legacy', JSON.stringify({ taskId: 'old' }));
  assert.equal(h.store.readPendingSubjectExtraction('legacy', 'u').status, 'unknown');
  assert.equal(h.store.readPendingSubjectExtraction('legacy', null), null);
});
test('损坏的持久记录阻止重新提交', async () => {
  const h = harness();
  h.data.set('task:u:p', '{');
  await h.run();
  assert.equal(h.saved().status, 'unknown');
  assert.deepEqual(h.state.calls, []);
});
test('发布提交响应丢失时不再自动发布', async () => {
  const h = harness(null, state => ({ apiPublishScriptStructure: async () => {
    state.calls.push('publish'); throw Error('断网');
  } }));
  await h.run(); await h.run();
  assert.deepEqual(h.state.calls, ['publish']);
  assert.equal(h.saved().phase, 'publish');
  assert.equal(h.saved().status, 'unknown');
});
test('轮询短暂断网后继续同一任务', async () => {
  let count = 0;
  const h = harness({ phase: 'subject', taskId: 'sub' }, () => ({ apiGetScriptTask: async () => {
    count++;
    if (count === 2) throw Error('断网');
    return { status: count === 1 ? 'running' : 'completed' };
  } }));
  await h.run();
  assert.equal(count, 3);
  assert.equal(h.saved().phase, 'results');
  assert.deepEqual(h.state.calls, []);
});
test('明确失败保留记录，下次允许重新提交', async () => {
  const h = harness({ phase: 'subject', taskId: 'old' }, () => ({ apiGetScriptTask: async () => ({ status: 'failed' }) }));
  await h.run();
  assert.equal(h.saved().status, 'failed');
  assert.equal(h.saved().taskId, 'old');
  await h.run();
  assert.deepEqual(h.state.calls, ['publish', 'extract']);
});
test('结构读取期间会话失效，不提交发布', async () => {
  const h = harness(null, (_state, expire) => ({ apiGetScriptStructure: async () => {
    expire(); return { revision: 1 };
  } }));
  await h.run();
  assert.deepEqual(h.state.calls, []);
  assert.equal(h.saved(), null);
});
test('持久化不可用时不发出提交请求', async () => {
  const h = harness(null, () => ({ writePendingSubjectExtraction: () => { throw Error('存储已满'); } }));
  await h.run();
  assert.deepEqual(h.state.calls, []);
  assert.deepEqual(h.state.loading, {});
});
test('不完整记录阻止自动重新提交', async () => {
  const h = harness();
  h.data.set('task:u:p', JSON.stringify({ ownerId: 'u', projectId: 'p' }));
  await h.run();
  assert.equal(h.saved().status, 'unknown');
  assert.deepEqual(h.state.calls, []);
});
