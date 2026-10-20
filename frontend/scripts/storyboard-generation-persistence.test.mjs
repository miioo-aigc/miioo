import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStoryboardGenerationPersistence } from '../src/utils/StoryboardGenerationPersistence.js';

const key = 'miioo:pending_storyboard_generation:u:p';
function setup() {
  const data = new Map();
  const storage = {
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => data.set(name, value),
    removeItem: (name) => data.delete(name),
  };
  return { data, storage, store: createStoryboardGenerationPersistence(() => storage) };
}

const source = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
const start = source.indexOf('  const handleGenerateStoryboards = async ');
const end = source.indexOf('\n  const handleRetryGenerateStoryboards', start);
function homeHarness() {
  const { store, storage, data } = setup();
  const state = { calls: [], locked: false };
  const noop = () => {};
  const deps = {
    captureStoryboardScope: () => () => true,
    activeProject: { id: 'p' }, extractionOwnerId: 'u', scriptContent: '',
    generatingStoryboardsRef: { current: false },
    setIsGeneratingStoryboards: value => { state.locked = value; },
    setCompletedEpisodesCount: noop, setStoryboardStatusMessage: noop,
    setGenerateError: value => { state.error = value; }, setGenerateErrorProjectId: noop,
    readPendingStoryboardGeneration: store.read, writePendingStoryboardGeneration: store.write,
    clearPendingStoryboardGeneration: store.clear,
    apiGetEpisodes: async () => { state.calls.push('episodes'); return [{ id: 'e' }]; },
    apiGenerateStoryboardsFromFinalScript: async () => { state.calls.push('submit'); return { task_id: 'original', status: 'completed' }; },
    apiGetTask: async id => { state.calls.push(`query:${id}`); return { task_id: id, status: 'completed' }; },
    getStoryboardTaskId: t => t.task_id, getStoryboardTaskStatus: t => t.status,
    getStoryboardTaskStatusMessage: () => '', isStoryboardTaskInProgress: () => false,
    apiGetStoryboards: async () => [], invalidate: noop, K: { storyboards: noop, storyboardPagePrefix: noop },
    setScriptEpisodes: noop, showToast: noop, console: { error: noop },
  };
  const run = (...args) => new Function(...Object.keys(deps), `${source.slice(start, end)}; return handleGenerateStoryboards;`)(...Object.values(deps))(...args);
  return { store, storage, data, state, deps, run };
}

test('首页损坏记录与归属缺失在任何请求前阻止生成', async () => {
  for (const missingOwner of [false, true]) {
    const h = homeHarness();
    if (missingOwner) h.deps.extractionOwnerId = null;
    else h.data.set(key, '{');
    await h.run();
    assert.deepEqual(h.state.calls, []);
    assert.equal(h.state.locked, true);
    assert.equal(h.deps.generatingStoryboardsRef.current, false);
  }
});

test('首页提交前落盘失败不发生成请求且保留保护锁', async () => {
  const h = homeHarness();
  h.storage.setItem = () => { throw new Error('quota'); };
  await h.run();
  assert.deepEqual(h.state.calls, ['episodes']);
  assert.equal(h.state.locked, true);
});

test('首页编号落盘失败后重试只查原任务，成功回读清理后解锁', async () => {
  const h = homeHarness();
  const originalSet = h.storage.setItem;
  h.deps.apiGenerateStoryboardsFromFinalScript = async () => {
    h.state.calls.push('submit');
    h.storage.setItem = () => { throw new Error('quota'); };
    return { task_id: 'original', status: 'completed' };
  };
  await h.run();
  assert.equal(h.state.locked, true);
  assert.equal(h.store.read('p', 'u').taskId, 'original');
  h.storage.setItem = originalSet;
  await h.run();
  assert.equal(h.state.calls.filter(v => v === 'submit').length, 1);
  assert.equal(h.state.calls.includes('query:original'), true);
  assert.equal(h.state.locked, false);
  assert.equal(h.store.read('p', 'u'), null);
});

test('首页失败记录清理异常不会提交，恢复后明确重试可生成', async () => {
  const h = homeHarness();
  h.store.write('p', 'u', { status: 'failed', taskId: 'old' });
  const originalRemove = h.storage.removeItem;
  h.storage.removeItem = () => { throw new Error('denied'); };
  await h.run(undefined, true);
  assert.deepEqual(h.state.calls, []);
  assert.equal(h.deps.generatingStoryboardsRef.current, false);
  h.storage.removeItem = originalRemove;
  await h.run(undefined, true);
  assert.equal(h.state.calls.includes('submit'), true);
  assert.equal(h.state.calls.includes('query:old'), false);
  assert.equal(h.store.read('p', 'u'), null);
});

test('空存储可提交，正常任务写入、恢复、清理完整闭环', () => {
  const { store } = setup();
  assert.equal(store.read('p', 'u'), null);
  store.write('p', 'u', { status: 'submitting' });
  store.write('p', 'u', { status: 'running', taskId: 't' });
  assert.equal(store.read('p', 'u').taskId, 't');
  store.clear('p', 'u');
  assert.equal(store.read('p', 'u'), null);
});

for (const raw of ['{', 'null', '[]', 'false', '{}',
  JSON.stringify({ ownerId: 'other', status: 'failed' }),
  JSON.stringify({ ownerId: 'u', projectId: 'other', status: 'failed' }),
  JSON.stringify({ ownerId: 'u', status: 'running' }),
  JSON.stringify({ ownerId: 'u', status: 'failed', taskId: {} }),
  JSON.stringify({ ownerId: 'u', status: 'completed' })]) {
  test(`异常原文保留且禁止覆写和清理：${raw}`, () => {
    const { store, data } = setup();
    data.set(key, raw);
    assert.equal(store.read('p', 'u').blocked, true);
    assert.throws(() => store.write('p', 'u', { status: 'submitting' }));
    assert.throws(() => store.clear('p', 'u'));
    assert.equal(data.get(key), raw);
  });
}

test('旧无账号记录阻止新提交且不自动认领', () => {
  const { store, data } = setup();
  data.set('miioo:pending_storyboard_generation:p', '{}');
  assert.equal(store.read('p', 'u').blocked, true);
  assert.throws(() => store.write('p', 'u', { status: 'submitting' }));
  assert.equal(data.has(key), false);
});

test('兼容旧的有账号键和账号字段但无项目字段记录', () => {
  const { store, data } = setup();
  data.set(key, JSON.stringify({ ownerId: 'u', status: 'running', taskId: 'original' }));
  assert.equal(store.read('p', 'u').taskId, 'original');
  store.write('p', 'u', { status: 'running', taskId: 'original' });
  assert.equal(JSON.parse(data.get(key)).projectId, 'p');
});

test('归属缺失与读取抛错不能被当成没有任务', () => {
  const { store, storage } = setup();
  assert.equal(store.read('p', null).blocked, true);
  assert.throws(() => store.write('p', null, { status: 'submitting' }));
  storage.getItem = () => { throw new Error('denied'); };
  assert.equal(store.read('p', 'u').blocked, true);
  assert.throws(() => store.write('p', 'u', { status: 'submitting' }));
});

test('取得存储对象失败也保守锁定', () => {
  const store = createStoryboardGenerationPersistence(() => { throw new Error('denied'); });
  assert.equal(store.read('p', 'u').blocked, true);
});

for (const mode of ['throw', 'silent']) {
  test(`编号保存失败后会话保留原编号并隔离账号项目：${mode}`, () => {
    const { store, storage } = setup();
    store.write('p', 'u', { status: 'submitting' });
    const originalSet = storage.setItem;
    storage.setItem = () => { if (mode === 'throw') throw new Error('quota'); };
    assert.throws(() => store.write('p', 'u', { status: 'running', taskId: 'original' }));
    assert.equal(store.read('p', 'u').taskId, 'original');
    assert.equal(store.read('p', 'other'), null);
    assert.equal(store.read('other', 'u'), null);
    // 刷新后丢失内存时，磁盘占位仍阻止重复提交。
    assert.equal(createStoryboardGenerationPersistence(() => storage).read('p', 'u').status, 'submitting');
    storage.setItem = originalSet;
    store.write('p', 'u', { status: 'running', taskId: 'original' });
    assert.equal(createStoryboardGenerationPersistence(() => storage).read('p', 'u').taskId, 'original');
  });

  test(`清理失败保留任务，恢复存储后才能清理：${mode}`, () => {
    const { store, storage } = setup();
    store.write('p', 'u', { status: 'running', taskId: 'original' });
    const originalRemove = storage.removeItem;
    storage.removeItem = () => { if (mode === 'throw') throw new Error('denied'); };
    assert.throws(() => store.clear('p', 'u'));
    assert.equal(store.read('p', 'u').taskId, 'original');
    storage.removeItem = originalRemove;
    store.clear('p', 'u');
    assert.equal(store.read('p', 'u'), null);
  });
}
