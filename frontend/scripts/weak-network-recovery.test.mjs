import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule, runInNewContext } from 'node:vm';
import { buildStoryboardCandidatePayload, normalizeSavedStoryboardCandidate } from '../src/utils/storyboardCandidateAdapter.js';
import { mergeStoryboardMediaItems } from '../src/utils/storyboardMediaDedup.js';
import { createProjectSaveQueue, applyProjectSave } from '../src/utils/ProjectSaveQueue.js';
import { createStoryboardGenerationTracker } from '../src/utils/StoryboardGenerationTracker.js';

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

async function recovery(type, fetchTask, options = {}) {
  const cleanups = [];
  const removed = [];
  const recovered = [];
  const notices = [];
  const task = { taskId: 'task', shotId: 'shot', type, ownerId: 'owner' };
  const history = { image: options.history ?? {}, video: options.history ?? {} };
  const generating = { image: new Set(), video: new Set() };
  const removedCandidates = [];
  const updateHistory = (media) => (update) => { history[media] = update(history[media]); };
  const updateGenerating = (media) => (update) => { generating[media] = update(generating[media]); };
  const beginMediaTask = createStoryboardGenerationTracker({
    image: updateGenerating('image'), video: updateGenerating('video'),
  });
  const dependencies = {
    react: { useRef: (value) => ({ current: value }), useEffect: (effect) => { cleanups.push(effect()); } },
    '../api/storyboard': { apiGetTask: fetchTask },
    '../components/storyboard/storyboardControlUtils': { getEpisodeId: (episode) => episode.id },
    '../utils/taskPersistence': {
      getPendingTasks: () => {
        if (options.readError) throw new Error('任务记录读取失败');
        return options.tasks?.map((task) => ({ ownerId: 'owner', ...task })) ?? [task];
      },
      removePendingTask: (...args) => {
        if (options.removeError) throw new Error('任务记录清理失败');
        removed.push(args);
      },
    },
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
    ownerId: 'owner', captureGenerationScope: () => options.isCurrent ?? (() => true),
    showToast: (...args) => notices.push(args),
    setIsGenerating: noop, setEpisodeGenerationError: noop,
    beginMediaTask,
    addPendingCandidate: noop, removePendingCandidate: (...args) => removedCandidates.push(args),
    setGenVideoHistoryMap: updateHistory('video'), setGenImageHistoryMap: updateHistory('image'),
    onStoryboardRecovered: (...args) => recovered.push(args),
    onVideoRecovered: (...args) => { recovered.push(args); return options.onVideoRecovered?.(...args); },
    onImageRecovered: (...args) => { recovered.push(args); return options.onImageRecovered?.(...args); },
  });
  return { removed, recovered, notices, history, generating, removedCandidates, beginMediaTask, leave: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

function instantGeneration(type, batch, beginMediaTask, request, overrides = {}) {
  const source = readFileSync(new URL('../src/pages/StoryboardPage.jsx', import.meta.url), 'utf8');
  const name = type === 'image' ? 'startBatchGenImages' : 'startBatchGenVideos';
  let code;
  if (batch) {
    const start = source.indexOf(`  async function ${name}(`);
    const end = source.indexOf('\n  }', start) + '\n  }'.length;
    code = `${source.slice(start, end)}; ${name}`;
  } else {
    const start = source.indexOf('onGenerate={async (params) => {', source.indexOf(type === 'image' ? '<GenerateImagePanel' : '<GenerateVideoPanel'));
    const end = source.indexOf('\n      />', start);
    code = `(${source.slice(start + 'onGenerate={'.length, end).trim().slice(0, -1)})`;
  }
  const noop = () => {};
  return runInNewContext(code, {
    beginMediaTask, generatingImages: false, generatingVideos: false,
    isGenerating: false, homeIsGenerating: false,
    ownerId: 'owner', captureGenerationScope: () => () => true,
    shotsRef: { current: [{ id: 'shot' }] },
    setGeneratingImages: noop, setGeneratingVideos: noop,
    episode: { id: 'e' }, getEpisodeId: (episode) => episode.id,
    projectId: 'p', projectRatio: '16:9', shots: [{ id: 'shot' }],
    imagePanel: { shot: { id: 'shot' } }, videoPanel: { shot: { id: 'shot' } },
    addPendingCandidate: () => 'client', removePendingCandidate: noop,
    removePendingTask: noop, assertPendingTaskStorageReady: noop, showToast: noop, console: { error: noop },
    toSafeStoryboardReferenceUrls: () => [],
    toAbsoluteUrl: (url) => url,
    apiGenerateStoryboardImage: request, apiGenerateStoryboardVideo: request,
    getSeedance20AudioReferenceErrorMessage: () => '',
    ...overrides,
  });
}

for (const type of ['image', 'video']) {
  for (const batch of [false, true]) {
    test(`${type} ${batch ? '批量' : '单独'}：提交前存储不可写，不生成占位或请求`, async () => {
      let requests = 0;
      let placeholders = 0;
      const notices = [];
      const generate = instantGeneration(type, batch, () => () => {}, async () => { requests++; }, {
        assertPendingTaskStorageReady: () => { throw new Error('任务记录保存或清理失败'); },
        addPendingCandidate: () => { placeholders++; },
        showToast: (...args) => notices.push(args),
      });
      const running = generate({ uiReferenceMode: 'frame', refImages: [] });
      if (batch) await running;
      else await assert.rejects(running, /任务记录/);
      assert.equal(requests, 0);
      assert.equal(placeholders, 0);
      if (batch) assert.match(notices[0][0], /任务记录/);
    });
  }

  test(`${type} 批量：首条编号保存失败停止后续提交，不提示全部完成`, async () => {
    let requests = 0;
    let blocked = false;
    const notices = [];
    const generate = instantGeneration(type, true, () => () => {}, async () => { requests++; return { id: 'task' }; }, {
      shots: [{ id: 'first' }, { id: 'second' }],
      assertPendingTaskStorageReady: () => { if (blocked) throw new Error('任务编号未保存'); },
      getStoryboardTaskId: (task) => task.id,
      addPendingTask: () => { blocked = true; throw new Error('编号保存失败'); },
      showToast: (...args) => notices.push(args),
    });
    await generate({ uiReferenceMode: 'frame', refImages: [] });
    assert.equal(requests, 1);
    assert.ok(notices.some(([message]) => message.includes('任务编号未保存')));
    assert.ok(notices.every(([message]) => !message.includes('生成完成')));
  });
}

for (const type of ['image', 'video']) {
  for (const batch of [false, true]) {
    for (const stage of ['submit', 'poll', 'save']) {
      test(`${type} ${batch ? '批量' : '单独'}：${stage}期间离开保留原归属，不写新页面或追加提交`, async () => {
        const waiting = deferred();
        const entered = deferred();
        let active = true;
        let requests = 0;
        let writes = 0;
        const persisted = [];
        const removed = [];
        const pause = async (value) => { entered.resolve(); await waiting.promise; return value; };
        const generate = instantGeneration(type, batch, () => () => {}, async () => {
          requests++;
          return stage === 'submit' ? pause({ id: 'task' }) : { id: 'task' };
        }, {
          captureGenerationScope: () => () => active,
          shots: [{ id: 'shot' }, { id: 'second' }],
          getStoryboardTaskId: (task) => task.id,
          addPendingTask: (...args) => persisted.push(args),
          removePendingTask: (...args) => removed.push(args),
          bindPendingCandidate: () => {},
          pollTask: async () => stage === 'poll' ? pause({ status: 'completed', url: 'result' }) : { status: 'completed', url: 'result' },
          getStoryboardTaskStatus: (task) => task.status,
          getStoryboardTaskError: () => '失败',
          hasStoryboardImageTaskResult: (task) => Boolean(task.url),
          hasStoryboardVideoTaskResult: (task) => Boolean(task.url),
          extractStoryboardImageUrl: (task) => task.url,
          extractStoryboardVideoUrl: (task) => task.url,
          normalizeImageUrl: (url) => url,
          saveGeneratedCandidateMedia: async () => stage === 'save' ? pause({ id: 'candidate' }) : { id: 'candidate' },
          setShots: () => { writes++; },
          apiUpdateStoryboard: async () => { writes++; },
          showToast: () => { writes++; },
        });
        const running = generate({ uiReferenceMode: 'frame', refImages: [] });
        await entered.promise;
        const writesBeforeLeaving = writes;
        active = false;
        waiting.resolve();
        await running;
        assert.equal(requests, 1);
        assert.equal(writes, writesBeforeLeaving);
        assert.equal(removed.length, 0);
        assert.equal(persisted.length, 1);
        assert.equal(persisted[0][0], 'p');
        assert.equal(persisted[0][1].ownerId, 'owner');
        assert.equal(persisted[0][1].episodeId, 'e');
      });
    }
  }
  test(`${type}恢复不查询其他账号或无账号归属的历史任务`, async () => {
    let reads = 0;
    const state = await recovery(type, async () => { reads++; return { status: 'completed', url: 'result' }; }, {
      tasks: [
        { taskId: 'other', type, shotId: 'shot', ownerId: 'other' },
        { taskId: 'legacy', type, shotId: 'shot', ownerId: undefined },
      ],
    });
    await flush();
    assert.equal(reads, 0);
    assert.equal(state.removed.length, 0);
  });
}

test('生成访问身份：离开后返回不能复活旧回调，会话变更立即失效，刷新令牌不误停', async () => {
  let ref;
  let cleanup;
  let session = 1;
  let token = 'token';
  const dependencies = {
    react: {
      useRef: (value) => ref ??= { current: value },
      useCallback: (callback) => callback,
      useLayoutEffect: (effect) => { cleanup?.(); cleanup = effect(); },
    },
    '../api/request': { getAuthSessionGeneration: () => session, getToken: () => token },
  };
  const module = new SourceTextModule(readFileSync(new URL('../src/hooks/useStoryboardGenerationScope.js', import.meta.url), 'utf8'));
  await module.link((name) => new SyntheticModule(Object.keys(dependencies[name]), function () {
    for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
  }));
  await module.evaluate();
  const visit = (episode) => module.namespace.default('owner', 'p', episode)();
  const first = visit('a');
  assert.equal(first(), true);
  token = 'refreshed';
  assert.equal(first(), true);
  const second = visit('b');
  assert.equal(first(), false);
  const returned = visit('a');
  assert.equal(first(), false);
  assert.equal(second(), false);
  assert.equal(returned(), true);
  session++;
  assert.equal(returned(), false);
  const latest = visit('a');
  cleanup();
  assert.equal(latest(), false);
});

for (const type of ['image', 'video']) {
  for (const batch of [false, true]) {
    for (const scenario of ['offline', 'timeout', 'unknown', 'missing-result', 'save-failure', 'failed', 'success']) {
      test(`${type} ${batch ? '批量' : '单独'}：${scenario}按确认结果保留或清理任务`, async () => {
        const removed = [];
        const removedCandidates = [];
        const persisted = [];
        const notices = [];
        let requests = 0;
        let saves = 0;
        const state = { image: new Set(), video: new Set() };
        const begin = createStoryboardGenerationTracker(Object.fromEntries(['image', 'video'].map((media) => [
          media, (update) => { state[media] = update(state[media]); },
        ])));
        const generate = instantGeneration(type, batch, begin, async () => { requests++; return { id: 'new-task' }; }, {
          getStoryboardTaskId: (task) => task.id,
          bindPendingCandidate: () => {},
          addPendingTask: (...args) => persisted.push(args),
          removePendingTask: (...args) => removed.push(args),
          removePendingCandidate: (...args) => removedCandidates.push(args),
          showToast: (...args) => notices.push(args),
          pollTask: async () => {
            if (scenario === 'offline' || scenario === 'timeout') throw new Error(scenario);
            return { status: scenario === 'failed' ? 'failed' : scenario === 'unknown' ? 'unknown' : 'completed',
              url: ['success', 'save-failure'].includes(scenario) ? 'result' : undefined };
          },
          getStoryboardTaskStatus: (task) => task.status,
          getStoryboardTaskError: () => '明确失败',
          hasStoryboardImageTaskResult: (task) => Boolean(task.url),
          hasStoryboardVideoTaskResult: (task) => Boolean(task.url),
          extractStoryboardImageUrl: (task) => task.url,
          extractStoryboardVideoUrl: (task) => task.url,
          normalizeImageUrl: (url) => url,
          setShots: (update) => update([{ id: 'shot' }]),
          apiUpdateStoryboard: async () => ({}),
          saveGeneratedCandidateMedia: async () => { saves++; if (scenario === 'save-failure') throw new Error('save failed'); return {}; },
        });
        const running = generate({ uiReferenceMode: 'frame', refImages: [] });
        if (!batch && scenario !== 'success') await assert.rejects(running);
        else await running;
        const settled = ['success', 'failed'].includes(scenario);
        assert.equal(requests, 1, '不得自动重新提交生成');
        assert.equal(persisted.length, 1);
        assert.equal(removed.length, settled ? 1 : 0);
        assert.equal(state[type].has('shot'), !settled);
        if (!['success', 'save-failure'].includes(scenario)) assert.equal(removedCandidates.length, settled ? 1 : 0);
        assert.equal(saves, ['success', 'save-failure'].includes(scenario) ? 1 : 0);
        if (batch && !settled) assert.match(notices[0][0], /保留任务/);
      });
    }
  }
  test(`${type}恢复候选保存失败保留记录，离页后不得清理`, async () => {
    const saved = deferred();
    const state = await recovery(type, async () => ({ status: 'completed', url: 'result' }), {
      [type === 'image' ? 'onImageRecovered' : 'onVideoRecovered']: () => saved.promise,
    });
    await flush();
    state.leave();
    saved.reject(new Error('offline'));
    await flush();
    assert.equal(state.removed.length, 0);
    assert.equal(state.generating[type].has('shot'), true);
  });
}

for (const type of ['image', 'video']) {
  for (const batch of [false, true]) {
    for (const first of ['recovery', 'instant']) {
      test(`${type} ${batch ? '批量' : '单独'}入口：${first}先结束不清其他任务标记`, async () => {
        const restored = deferred();
        const submitted = deferred();
        const state = await recovery(type, () => restored.promise);
        // Frame-reference mode skips unrelated reference enrichment before the request.
        const generate = instantGeneration(type, batch, state.beginMediaTask, () => submitted.promise);
        const running = generate({ uiReferenceMode: 'frame', refImages: [] });
        const completion = batch ? running : assert.rejects(running, /submit failed/);
        const finishInstant = async () => {
          submitted.reject(new Error('submit failed'));
          await completion;
        };
        const finishRecovery = async () => {
          restored.resolve({ status: 'completed', url: 'result' });
          await flush();
        };
        if (first === 'recovery') await finishRecovery();
        else await finishInstant();
        assert.equal(state.generating[type].has('shot'), true);
        if (first === 'recovery') await finishInstant();
        else await finishRecovery();
        assert.equal(state.generating[type].has('shot'), false);
      });
    }
  }
  test(`${type}：重复恢复注册幂等，新任务独立，其他分镜和类型隔离`, () => {
    const state = { image: new Set(), video: new Set() };
    const begin = createStoryboardGenerationTracker(Object.fromEntries(['image', 'video'].map((media) => [
      media, (update) => { state[media] = update(state[media]); },
    ])));
    begin(type, 'shot', 'restored');
    const finishRestored = begin(type, 'shot', 'restored');
    const finishNew = begin(type, 'shot');
    const finishOther = begin(type, 'other');
    const otherType = type === 'image' ? 'video' : 'image';
    const finishOtherType = begin(otherType, 'shot');
    finishRestored();
    finishRestored();
    assert.equal(state[type].has('shot'), true);
    finishNew();
    assert.equal(state[type].has('shot'), false);
    assert.equal(state[type].has('other'), true);
    assert.equal(state[otherType].has('shot'), true);
    finishOther();
    finishOtherType();
    assert.equal(state.image.size + state.video.size, 0);
  });
}

function videoRecoveryCallback(save) {
  const source = readFileSync(new URL('../src/pages/StoryboardPage.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const recoverVideoTask = useCallback(');
  const end = source.indexOf('\n  const recoverImageTask', start);
  let candidates = {};
  let history = {};
  const unexpected = () => { assert.fail('恢复不得修改当前视频、定稿状态或分镜字段'); };
  const callback = runInNewContext(`${source.slice(start, end)}; recoverVideoTask`, {
    useCallback: (fn) => fn,
    projectId: 'p', normalizeImageUrl: (url) => url,
    buildStoryboardCandidatePayload, normalizeSavedStoryboardCandidate, mergeStoryboardMediaItems,
    apiCreateStoryboardMediaCandidate: save,
    setCandidateMediaMap: (update) => { candidates = update(candidates); },
    setGenVideoHistoryMap: (update) => { history = update(history); },
    setShots: unexpected, apiUpdateStoryboard: unexpected, setFinalizedMediaMap: unexpected,
  });
  return { callback, candidates: () => candidates, history: () => history };
}

for (const outcome of ['success', 'failure', 'leave']) {
  test(`图片恢复实际保存回调：${outcome}必须等待候选落盘`, async () => {
    const source = readFileSync(new URL('../src/pages/StoryboardPage.jsx', import.meta.url), 'utf8');
    const start = source.indexOf('  const recoverImageTask = useCallback(');
    const end = source.indexOf('\n  useStoryboardTaskRecovery(', start);
    const saving = deferred();
    let writes = 0;
    const callback = runInNewContext(`${source.slice(start, end)}; recoverImageTask`, {
      useCallback: (fn) => fn, projectId: 'p', normalizeImageUrl: (url) => url,
      buildStoryboardCandidatePayload, normalizeSavedStoryboardCandidate, mergeStoryboardMediaItems,
      apiCreateStoryboardMediaCandidate: () => saving.promise,
      setCandidateMediaMap: () => { writes++; }, setShots: () => { writes++; },
      setGenImageHistoryMap: () => { writes++; },
    });
    const state = await recovery('image', async () => ({ status: 'completed', url: 'result' }), { onImageRecovered: callback });
    await flush();
    assert.equal(writes, 0);
    assert.equal(state.removed.length, 0);
    if (outcome === 'leave') state.leave();
    if (outcome === 'failure') saving.reject(new Error('save failed'));
    else saving.resolve({ id: 'candidate', is_finalized: false });
    await flush();
    assert.equal(state.removed.length, outcome === 'success' ? 1 : 0);
    assert.equal(writes, outcome === 'success' ? 3 : 0);
  });
}

test('生成候选严格保存：空返回不得按成功收尾，保留任务编号元数据', async () => {
  const source = readFileSync(new URL('../src/pages/StoryboardPage.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  async function saveGeneratedCandidateMedia(');
  const end = source.indexOf('\n  async function saveExtractedFrame', start);
  let result = null;
  let payload;
  const save = runInNewContext(`${source.slice(start, end)}; saveGeneratedCandidateMedia`, {
    saveCandidateMedia: async (_shotId, media) => { payload = media; return result; },
  });
  await assert.rejects(save('shot', { metadata: { prompt: 'p' } }, 'task'), /保留任务/);
  assert.equal(payload.metadata.task_id, 'task');
  assert.equal(payload.metadata.prompt, 'p');
  result = { id: 'saved' };
  assert.equal(await save('shot', {}, 'task'), result);
});

test('视频恢复只保存候选，重复恢复去重，不自动填充或覆盖当前视频', async () => {
  const calls = [];
  const page = videoRecoveryCallback(async (...args) => {
    calls.push(args);
    return { id: 'candidate-id', is_finalized: false };
  });
  for (let i = 0; i < 2; i++) {
    const state = await recovery('video', async () => ({ status: 'completed', url: 'result.mp4' }), {
      onVideoRecovered: page.callback,
    });
    await flush();
    assert.equal(state.removed.length, 1);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0][2].media_type, 'video');
  assert.equal(calls[0][2].url, 'result.mp4');
  assert.equal('is_finalized' in calls[0][2], false);
  assert.equal(page.candidates().shot.length, 1);
  assert.equal(page.candidates().shot[0].is_finalized, false);
  assert.equal(page.history().shot.length, 1);
  assert.equal(page.history().shot[0].settled, false);
});

for (const outcome of ['success', 'failure', 'leave']) {
  test(`视频候选延迟保存：${outcome} 时正确保留或收尾恢复任务`, async () => {
    const saving = deferred();
    const page = videoRecoveryCallback(() => saving.promise);
    const state = await recovery('video', async () => ({ status: 'completed', url: 'result.mp4' }), {
      onVideoRecovered: page.callback,
    });
    await flush();
    assert.equal(state.removed.length, 0);
    assert.equal(state.generating.video.has('shot'), true);
    assert.equal(page.candidates().shot, undefined);
    if (outcome === 'leave') state.leave();
    if (outcome === 'failure') saving.reject(new Error('候选保存断网'));
    else saving.resolve({ id: 'candidate-id', is_finalized: false });
    await flush();
    assert.equal(state.removed.length, outcome === 'success' ? 1 : 0);
    assert.equal(state.removedCandidates.length, outcome === 'success' ? 1 : 0);
    assert.equal(Boolean(page.candidates().shot), outcome === 'success');
    assert.equal(Boolean(page.history().shot), outcome === 'success');
    if (outcome === 'failure') {
      assert.equal(state.generating.video.has('shot'), true);
      assert.match(state.notices[0][0], /候选保存暂时失败/);
    }
  });
}

for (const type of ['video', 'image']) {
  for (const firstStatus of ['completed', 'failed']) {
    test(`${type}: ${firstStatus} task settles alone while another task is pending`, async () => {
      const first = deferred();
      const second = deferred();
      const state = await recovery(type, (id) => id === 'first' ? first.promise : second.promise, {
        history: { shot: [{ id: 'existing', url: 'existing-result' }] },
        tasks: ['first', 'second'].map((taskId) => ({ taskId, shotId: 'shot', type })),
      });
      first.resolve({ status: firstStatus, url: firstStatus === 'completed' ? 'first-result' : undefined });
      await flush();
      assert.deepEqual(state.history[type].shot.map((item) => item.id), ['existing', 'pending-resume-second']);
      assert.equal(state.generating[type].has('shot'), true);
      assert.deepEqual(state.removed, [['p', 'first', 'owner']]);
      assert.deepEqual(state.removedCandidates, [['first', 'shot']]);
      if (firstStatus === 'completed') assert.deepEqual(state.recovered[0].slice(0, 3), ['shot', 'first-result', 'first']);
      second.resolve({ status: 'completed', url: 'second-result' });
      await flush();
      assert.deepEqual(state.history[type].shot.map((item) => item.id), ['existing']);
      assert.equal(state.generating[type].has('shot'), false);
      assert.equal(state.removed.length, 2);
    });
  }
  test(`${type}: temporary failure keeps its placeholder and generating marker after another task completes`, async () => {
    const first = deferred();
    const second = deferred();
    const state = await recovery(type, (id) => id === 'first' ? first.promise : second.promise, {
      tasks: ['first', 'second'].map((taskId) => ({ taskId, shotId: 'shot', type })),
    });
    second.reject(new Error('offline'));
    await flush();
    first.resolve({ status: 'completed', url: 'first-result' });
    await flush();
    assert.deepEqual(state.history[type].shot.map((item) => item.id), ['pending-resume-second']);
    assert.equal(state.generating[type].has('shot'), true);
    assert.deepEqual(state.removed, [['p', 'first', 'owner']]);
  });
  test(`${type}: recovery preserves candidates and other pending tasks without duplicate placeholders`, async () => {
    const request = deferred();
    const candidate = { id: 'existing', url: 'saved-result', settled: false };
    const otherShot = [{ id: 'other', url: 'other-result' }];
    const state = await recovery(type, () => request.promise, {
      history: {
        shot: [candidate, { id: 'pending-resume-task-1', url: null, settled: false }],
        other: otherShot,
      },
      tasks: ['task-1', 'task-2'].map((taskId) => ({ taskId, shotId: 'shot', type })),
    });
    assert.deepEqual(state.history[type].shot.map((item) => item.id), [
      'existing', 'pending-resume-task-1', 'pending-resume-task-2',
    ]);
    assert.equal(state.history[type].shot[0], candidate);
    assert.equal(state.history[type].other, otherShot);
    state.leave();
    request.resolve({ status: 'completed', url: 'late-result' });
    await flush();
    assert.equal(state.recovered.length, 0);
    assert.equal(state.removed.length, 0);
  });
}

for (const type of ['storyboard', 'video', 'image']) {
  test(`${type}：存储读取失败提示后暂停恢复，不查询任务`, async () => {
    let queries = 0;
    const state = await recovery(type, async () => { queries++; }, { readError: true });
    await flush();
    assert.equal(queries, 0);
    assert.equal(state.removed.length, 0);
    assert.match(state.notices[0][0], /读取失败/);
  });
  test(`${type}：恢复清理失败不产生未处理异常，保留任务占位`, async () => {
    const state = await recovery(type, async () => ({ status: 'completed', url: 'result' }), { removeError: true });
    await flush();
    assert.equal(state.removed.length, 0);
    assert.equal(state.removedCandidates.length, 0);
    if (type !== 'storyboard') assert.equal(state.generating[type].has('shot'), true);
    assert.match(state.notices[0][0], /清理失败/);
  });
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
