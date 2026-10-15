import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { createProjectSaveQueue, applyProjectSave } from '../src/utils/ProjectSaveQueue.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function loadHook(path, react) {
  const module = new SourceTextModule(readFileSync(new URL(path, import.meta.url), 'utf8'));
  await module.link(() => new SyntheticModule(Object.keys(react), function () {
    for (const [key, value] of Object.entries(react)) this.setExport(key, value);
  }));
  await module.evaluate();
  return module.namespace;
}

test('最新读取生效，旧响应与卸载后响应失效', async () => {
  let cleanup;
  const hook = await loadHook('../src/hooks/useLatestRequest.js', {
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: (effect) => { cleanup = effect(); },
  });
  const begin = hook.default();
  const old = begin();
  const latest = begin();
  assert.equal(old(), false);
  assert.equal(latest(), true);
  cleanup();
  assert.equal(latest(), false);
});

test('分页失败保留列表和游标，区分首读与追加重试', async () => {
  let state = {};
  const hook = await loadHook('../src/hooks/useAssetPagination.js', {
    useCallback: (fn) => fn,
    useState: () => [state, (update) => { state = update(state); }],
  });
  const page = hook.useAssetPagination();
  page.completeFirstPage('a', { cursor: 'next', hasMore: true, rawList: [{ id: 1 }] });
  page.markPageLoading('a');
  page.failMorePage('a');
  assert.equal(state.a.cursor, 'next');
  assert.equal(state.a.rawList.length, 1);
  assert.equal(state.a.failedPhase, 'more');
  assert.equal(state.a.loading, false);
  page.startPage('a');
  assert.equal(state.a.error, '');
  assert.equal(state.a.rawList.length, 1);
  page.failFirstPage('a');
  assert.equal(state.a.failedPhase, 'first');
  page.startPage('b');
  assert.equal(state.b.rawList.length, 0);
  assert.equal(state.a.rawList.length, 1);
});

test('project saves serialize per project and recover after failure', async () => {
  const enqueue = createProjectSaveQueue();
  const first = deferred();
  const calls = [];
  const a = enqueue('a', () => { calls.push('a1'); return first.promise; });
  const failure = assert.rejects(a);
  const b = enqueue('a', () => calls.push('a2'));
  await enqueue('b', () => calls.push('b'));
  assert.deepEqual(calls, ['a1', 'b']);
  first.reject(new Error('offline'));
  await failure;
  await b;
  assert.deepEqual(calls, ['a1', 'b', 'a2']);
});

test('late project save cannot change another project or reopen a closed project', () => {
  const b = { id: 'b', name: 'B' };
  assert.equal(applyProjectSave(b, 'a', { name: 'A' }), b);
  assert.equal(applyProjectSave(null, 'a', { name: 'A' }), null);
  assert.deepEqual(applyProjectSave({ id: 'a' }, 'a', { name: 'A' }), { id: 'a', name: 'A' });
});

async function recovery(type, fetchTask) {
  const cleanups = [];
  const removed = [];
  const recovered = [];
  const notices = [];
  const task = { taskId: 'task', shotId: 'shot', type };
  const dependencies = {
    react: { useRef: (value) => ({ current: value }), useEffect: (effect) => { cleanups.push(effect()); } },
    '../api/storyboard': { apiGetTask: fetchTask },
    '../components/storyboard/storyboardControlUtils': { getEpisodeId: (episode) => episode.id },
    '../utils/taskPersistence': { getPendingTasks: () => [task], removePendingTask: (...args) => removed.push(args) },
    '../utils/storyboardTaskAdapter': {
      getStoryboardTaskStatus: (value) => value.status,
      getStoryboardTaskErrorMessage: (value) => value.message,
      extractStoryboardImageUrl: (value) => value.url,
      extractStoryboardVideoUrl: (value) => value.url,
      hasStoryboardImageTaskResult: (value) => Boolean(value.url),
      hasStoryboardVideoTaskResult: (value) => Boolean(value.url),
      isStoryboardTaskInProgress: (value) => value.status === 'running',
    },
  };
  const module = new SourceTextModule(readFileSync(new URL('../src/hooks/useStoryboardTaskRecovery.js', import.meta.url), 'utf8'));
  await module.link((name) => {
    const exports = dependencies[name];
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  const noop = () => {};
  module.namespace.default({
    projectId: 'p', episode: { id: 'e' }, pollTask: fetchTask,
    showToast: (...args) => notices.push(args),
    setIsGenerating: noop, setEpisodeGenerationError: noop,
    setGeneratingVideoShotIds: noop, setGeneratingImageShotIds: noop,
    addPendingCandidate: noop, removePendingCandidate: noop,
    setGenVideoHistoryMap: noop, setGenImageHistoryMap: noop,
    onStoryboardRecovered: (...args) => recovered.push(args),
    onVideoRecovered: (...args) => recovered.push(args),
    onImageRecovered: (...args) => recovered.push(args),
  });
  return { removed, recovered, notices, leave: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

for (const type of ['storyboard', 'video', 'image']) {
  test(`${type}: temporary read failure preserves recovery record`, async () => {
    const state = await recovery(type, async () => { throw new Error('offline'); });
    await flush();
    assert.equal(state.removed.length, 0);
    assert.equal(state.notices.length, 1);
  });
  test(`${type}: successful recovery clears record`, async () => {
    const state = await recovery(type, async () => ({ status: 'completed', url: 'test-image' }));
    await flush();
    assert.equal(state.recovered.length, 1);
    assert.equal(state.removed.length, 1);
  });
  test(`${type}: late response after leaving cannot write or clear record`, async () => {
    const request = deferred();
    const state = await recovery(type, () => request.promise);
    state.leave();
    request.resolve({ status: 'completed', url: 'test-image' });
    await flush();
    assert.equal(state.recovered.length, 0);
    assert.equal(state.removed.length, 0);
  });
  test(`${type}: confirmed terminal failure clears record and reports failure`, async () => {
    const state = await recovery(type, async () => ({ status: 'failed', message: 'failed' }));
    await flush();
    assert.equal(state.removed.length, 1);
    assert.equal(state.notices.length, 1);
  });
}
