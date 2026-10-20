import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
const section = page.slice(page.indexOf('// ── 恢复跨刷新挂起的批量生成任务'));
const effect = section.slice(section.indexOf('useEffect(() => {') + 'useEffect(() => {'.length, section.indexOf('  // setChars/setScenes/setProps'));
const task = (id, extra = {}) => ({ type: 'batch-subject', taskId: id, projectId: 'p', ownerId: 'a', tab: 'char', subjectIds: [id], primaryVersions: { [id]: 0 }, ...extra });
async function recover(tasks, query, { cancel = false, manual = false } = {}) {
  const state = { removed: [], images: [], toasts: [], loading: { single: true }, tabs: {}, subjects: tasks.flatMap(t => (t.subjectIds || []).map(id => ({ id }))) };
  const calls = {};
  let cleanup;
  const setter = update => { state.subjects = update(state.subjects); };
  const bindings = {
    projectId: 'p', ownerId: 'a', getPendingTasks: () => tasks,
    belongsToSubjectOwner: (record, project, owner) => record.projectId === project && record.ownerId === owner,
    getToken: () => true, getAuthSessionGeneration: () => 1,
    batchRecoveryRef: { current: new Set() },
    setBatchGeneratingByTab: update => { state.tabs = update(state.tabs); },
    setBatchLoadingSubjects: update => { state.loading = update(state.loading); },
    setSubjectDetailRefreshToken: update => update(0),
    getPendingGenTabSetter: () => setter, setChars: setter, setScenes: setter, setProps: setter,
    apiGetTask: async id => { calls[id] = (calls[id] || 0) + 1; await Promise.resolve(); if (cancel) cleanup(); return query(id, calls[id]); },
    getSubjectTaskResults: response => response.results,
    extractSubjectImageResult: response => ({ rawUrl: response.url }),
    getSubjectGenerationErrorMessage: response => response.error || '',
    normalizeImageUrl: url => url, canApplyAutomaticPrimary: () => !manual,
    appendBatchGeneratedImage: (...args) => state.images.push(args),
    getGeneratedSubjectImageId: () => 'image', getGeneratedSubjectReferenceImages: () => [],
    isSubjectTaskTerminal: response => response.done,
    removePendingTask: (_project, id) => state.removed.push(id),
    showGlobalToast: (...args) => state.toasts.push(args),
    sleep: async () => {}, PENDING_GEN_STALE_MS: 900000, console: { error() {} },
  };
  cleanup = new Function(...Object.keys(bindings), effect)(...Object.values(bindings));
  await new Promise(resolve => setImmediate(resolve));
  cleanup?.();
  return { ...state, calls };
}
const done = id => ({ done: true, results: [{ subject_id: id, url: '/image' }] });
test('恢复所有归属匹配任务，不恢复其他账号及无归属旧记录', async () => {
  const result = await recover([task('a'), task('b'), task('other', { ownerId: 'b' }), task('old', { ownerId: undefined })], done);
  assert.deepEqual(Object.keys(result.calls).sort(), ['a', 'b']);
  assert.deepEqual(result.removed.sort(), ['a', 'b']);
  assert.equal(result.loading.single, true);
  assert.equal(result.loading.a, undefined);
  assert.equal(result.tabs.char, undefined);
});
test('连续三次失败暂停且保留任务记录，不永久加载', async () => {
  const result = await recover([task('a')], () => { throw new Error('断网'); });
  assert.equal(result.calls.a, 3);
  assert.deepEqual(result.removed, []);
  assert.equal(result.toasts.length, 1);
  assert.equal(result.loading.a, undefined);
});
test('短暂查询失败后恢复，重复结果只入缓存一次', async () => {
  const result = await recover([task('a')], (id, n) => {
    if (n === 1) throw new Error('断网');
    return { ...done(id), done: n >= 3 };
  });
  assert.equal(result.calls.a, 3);
  assert.equal(result.images.length, 1);
  assert.deepEqual(result.removed, ['a']);
});
test('请求期间离页，迟到结果不回写、不删记录', async () => {
  const result = await recover([task('a')], done, { cancel: true });
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.removed, []);
});
test('手动定稿版本变化或旧任务缺少版本，只加候选图不改封面', async () => {
  for (const [record, manual] of [[task('a'), true], [task('a', { primaryVersions: undefined }), false]]) {
    const result = await recover([record], done, { manual });
    assert.equal(result.subjects[0].imageUrl, undefined);
    assert.equal(result.images.length, 1);
  }
});
test('任务结果包含其他主体时不写回', async () => {
  const result = await recover([task('a')], () => done('unknown'));
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.removed, []);
  assert.equal(result.calls.a, 5);
});

test('终态先到、结果后到时补查原任务，完整后才删除记录', async () => {
  const result = await recover([task('a')], (id, n) => n < 3 ? { done: true, results: [] } : done(id));
  assert.equal(result.calls.a, 3);
  assert.deepEqual(result.removed, ['a']);
});
test('只等待预计生成主体，已有定稿图的跳过项不算缺失', async () => {
  const result = await recover([task('a', { subjectIds: ['a', 'b'], expectedSubjectIds: ['a'] })], done);
  assert.deepEqual(result.removed, ['a']);
  assert.equal(result.calls.a, 1);
});

const submitSection = page.slice(page.indexOf('  const handleBatchGenerate = async (params) => {'));
const submit = submitSection.slice(submitSection.indexOf('{') + 1, submitSection.indexOf('\n  const [confirmStoryboardOpen')).replace(/};\s*$/, '');
async function generate({ switchScope = false, manual = false, missing = false, query } = {}) {
  const state = { subjects: [{ id: 'a' }], images: [], removed: [], pending: [], toasts: [], loading: {}, tabs: {} };
  const scope = { current: {} };
  const setter = update => { state.subjects = update(state.subjects); };
  const bindings = {
    params: {}, projectId: 'p', ownerId: 'a', getToken: () => true, getAuthSessionGeneration: () => 1,
    showBatchToast: (...args) => state.toasts.push(args), activeTab: 'char', chars: state.subjects, scenes: [], props: [],
    batchAbortRef: { current: null }, batchRecoveryRef: { current: new Set() }, batchScopeRef: scope,
    batchLoadingSubjects: {}, getPendingTasks: () => [], assertPendingTaskStorageReady: () => {}, belongsToSubjectOwner: () => true,
    setBatchGenOpen() {}, getPrimaryVersion: () => 0, canApplyAutomaticPrimary: () => !manual,
    setChars: setter, setScenes: setter, setProps: setter, prevCoverUrlsRef: { current: {} },
    setBatchLoadingSubjects: update => { state.loading = typeof update === 'function' ? update(state.loading) : update; },
    setBatchGeneratingByTab: update => { state.tabs = update(state.tabs); },
    apiBatchGenerateStream: async (_project, _params, callbacks) => {
      callbacks.onTaskCreated('task');
      if (switchScope) scope.current = {};
      if (!missing) callbacks.onSubjectImage('a', '/image', {});
      if (!missing) callbacks.onSubjectImage('a', '/image', {});
      callbacks.onSubjectImage('foreign', '/foreign', {});
      callbacks.onComplete();
    },
    addPendingTask: (_project, record) => state.pending.push(record),
    removePendingTask: (_project, id) => state.removed.push(id),
    normalizeImageUrl: url => url, getGeneratedSubjectImageId: () => 'image', getGeneratedSubjectReferenceImages: () => [],
    appendBatchGeneratedImage: (...args) => state.images.push(args),
    sleep: async () => {},
    apiGetTask: async id => { state.queries = (state.queries || 0) + 1; return query?.(id, state.queries) || { results: [] }; },
    getSubjectTaskResults: response => response.results,
    extractSubjectImageResult: response => ({ rawUrl: response.url }),
    getSubjectGenerationErrorMessage: response => response.error || '',
  };
  await new Function(...Object.keys(bindings), `return (async () => {${submit}})();`)(...Object.values(bindings));
  return state;
}
test('即时终态缺结果时只补查原任务，回填成功才清记录', async () => {
  const result = await generate({ missing: true, query: () => done('a') });
  assert.equal(result.queries, 1);
  assert.equal(result.pending.length, 1);
  assert.equal(result.images.length, 1);
  assert.deepEqual(result.removed, ['task']);
});
test('补查五次仍不完整时保留原任务且不提示完成', async () => {
  const result = await generate({ missing: true });
  assert.equal(result.queries, 5);
  assert.deepEqual(result.removed, []);
  assert.match(result.toasts[0][0], /尚未完整/);
});
test('即时结果去重并校验主体范围，新任务保存归属和定稿版本', async () => {
  const result = await generate();
  assert.equal(result.images.length, 1);
  assert.equal(result.subjects[0].imageUrl, '/image');
  assert.equal(result.pending[0].ownerId, 'a');
  assert.deepEqual(result.pending[0].primaryVersions, { a: 0 });
  assert.deepEqual(result.loading, {});
  assert.deepEqual(result.removed, ['task']);
});
test('即时任务切换归属后不回填、不清记录、不提示完成', async () => {
  const result = await generate({ switchScope: true });
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.toasts, []);
});
test('即时任务期间手动定稿后保留封面，仍接收候选图', async () => {
  const result = await generate({ manual: true });
  assert.equal(result.subjects[0].imageUrl, undefined);
  assert.equal(result.images.length, 1);
});
