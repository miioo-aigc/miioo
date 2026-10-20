import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storeSource = readFileSync(new URL('../src/utils/subjectPendingGenerationStore.js', import.meta.url), 'utf8');
function store(saved = []) {
  let data = JSON.stringify(saved);
  return new Function('localStorage', storeSource.replace('export { pendingGenerations };', '').replaceAll('export function ', 'function ') + '\nreturn { pendingGenerations, getSubjectGenerationScope, saved: () => JSON.parse(localStorage.getItem()) };')({
    getItem: () => data, setItem: (_key, value) => { data = value; },
  });
}
test('同主体编号按账号和项目隔离，旧记录保留但不自动恢复', () => {
  const api = store([['subject', { status: 'pending' }]]);
  const a = api.getSubjectGenerationScope('p', 'a');
  a.set('subject', { status: 'pending' });
  assert.equal(a.get('subject').ownerId, 'a');
  assert.equal(api.getSubjectGenerationScope('p', 'b').get('subject'), undefined);
  assert.equal(api.getSubjectGenerationScope('q', 'a').entries().length, 0);
  assert.equal(api.getSubjectGenerationScope('p', null).entries().length, 0);
  assert.equal(api.pendingGenerations.has('subject'), true);
  const restored = store(api.saved());
  assert.equal(restored.getSubjectGenerationScope('p', 'a').get('subject').status, 'pending');
  a.delete('subject');
  assert.equal(api.pendingGenerations.has('subject'), true);
});

const page = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
for (const scenario of ['离页', '账号切换', '编号保存失败']) {
  test(`单主体实际提交收尾：${scenario}保留原归属编号，不错误清除占位`, async () => {
    const start = page.indexOf('            let acceptedTaskId = null;');
    const code = page.slice(start, page.indexOf('\n          }}', start));
    const saved = [];
    const notices = [];
    let failures = 0;
    const bindings = {
      apiGenerateSubjectImage: async () => ({ taskId: 'accepted' }),
      projectId: 'original-project', ownerId: 'original-owner', char: { id: 's' }, genParams: {},
      extractSubjectImageResult: (result) => result,
      addPendingTask: (...args) => {
        saved.push(args);
        if (scenario === '编号保存失败') throw new Error('编号保存失败');
      },
      tab: 'char', placeholder: 'placeholder', primaryVersion: 1,
      isGenerationPageCurrent: () => scenario !== '离页',
      getToken: () => true, saveSession: 1,
      getAuthSessionGeneration: () => scenario === '账号切换' ? 2 : 1,
      showToast: (...args) => notices.push(args),
      handleGenError: () => { failures++; },
    };
    await new Function(...Object.keys(bindings), `return (async () => { ${code} })();`)(...Object.values(bindings));
    assert.equal(saved.length, 1);
    assert.equal(saved[0][0], 'original-project');
    assert.equal(saved[0][1].ownerId, 'original-owner');
    assert.equal(saved[0][1].taskId, 'accepted');
    assert.equal(failures, 0);
    assert.equal(notices.length, scenario === '编号保存失败' ? 1 : 0);
  });
}
const section = page.slice(page.indexOf('// ── 恢复跨刷新挂起的单主体生成任务'));
const effect = section.slice(section.indexOf('useEffect(() => {') + 'useEffect(() => {'.length, section.indexOf('  // setChars/setScenes/setProps'));
async function recover(query, { detail = async () => null, cancelDuringQuery = false, covered = true } = {}) {
  const task = { type: 'subject-single', taskId: 'task', subjectId: 's', projectId: 'p', ownerId: 'a', placeholderId: 'placeholder' };
  const api = store();
  const scope = api.getSubjectGenerationScope('p', 'a');
  scope.set('s', { status: 'pending', placeholderId: 'placeholder' });
  const state = { removed: [], images: [], toasts: [], subjects: [{ id: 's' }], loading: {} };
  let cleanup;
  let calls = 0;
  const setter = update => { state.subjects = update(state.subjects); };
  const bindings = {
    projectId: 'p', ownerId: 'a', pendingGenerations: scope,
    getPendingTasks: () => covered ? [task] : [],
    belongsToSubjectOwner: (record, project, owner) => record.projectId === project && record.ownerId === owner,
    getAuthSessionGeneration: () => 1, getToken: () => true,
    setBatchLoadingSubjects: update => { state.loading = update(state.loading); },
    setSubjectDetailRefreshToken: update => update(0),
    apiGetTask: async () => { calls++; await Promise.resolve(); if (cancelDuringQuery) cleanup(); return query(calls); },
    apiGetSubjectDetail: detail,
    getSubjectTaskResult: response => response?.item,
    extractSubjectImageResult: response => ({ rawUrl: response?.url }),
    getSubjectGenerationErrorMessage: response => response?.error || '',
    isSubjectTaskTerminal: response => response?.done,
    findPendingSubjectImage: response => response?.image,
    normalizeImageUrl: url => url,
    getPendingGenTabSetter: () => setter, setChars: setter, setScenes: setter, setProps: setter,
    canApplyAutomaticPrimary: () => true,
    appendBatchGeneratedImage: (...args) => state.images.push(args),
    getGeneratedSubjectImageId: () => 'image', getGeneratedSubjectReferenceImages: () => [],
    removePendingTask: (_project, id) => state.removed.push(id),
    showGlobalToast: (...args) => state.toasts.push(args),
    PENDING_GEN_STALE_MS: 900000,
    setTimeout: callback => { queueMicrotask(callback); },
    console: { error() {} },
  };
  cleanup = new Function(...Object.keys(bindings), effect)(...Object.values(bindings));
  await new Promise(resolve => setImmediate(resolve));
  cleanup?.();
  return { ...state, calls, pending: scope.get('s') };
}
test('任务查询短暂失败后成功，写入结果并清理对应记录', async () => {
  const result = await recover(n => { if (n === 1) throw new Error('网络中断'); return { item: { url: '/image' } }; });
  assert.equal(result.calls, 2);
  assert.equal(result.subjects[0].imageUrl, '/image');
  assert.deepEqual(result.removed, ['task']);
  assert.equal(result.pending, undefined);
});
test('连续三次查询失败暂停，保留记录并提示，不永久加载', async () => {
  const result = await recover(() => { throw new Error('网络中断'); });
  assert.equal(result.calls, 3);
  assert.equal(result.pending.status, 'pending');
  assert.deepEqual(result.removed, []);
  assert.equal(result.toasts.length, 1);
  assert.equal(result.loading.s, undefined);
});
test('任务终态但详情补查失败，不把查询错误当作生成失败清记录', async () => {
  const result = await recover(() => ({ done: true }), { detail: async () => { throw new Error('超时'); } });
  assert.equal(result.calls, 3);
  assert.equal(result.pending.status, 'pending');
  assert.deepEqual(result.removed, []);
});
test('中间结果尚无图片时继续查询，而非提前完成', async () => {
  const result = await recover(n => n === 1 ? { item: {} } : { item: { url: '/image' } });
  assert.equal(result.calls, 2);
  assert.equal(result.images.length, 1);
});
test('请求期间离开页面，迟到结果不写回也不清记录', async () => {
  const result = await recover(() => ({ item: { url: '/image' } }), { cancelDuringQuery: true });
  assert.equal(result.calls, 1);
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.removed, []);
  assert.equal(result.pending.status, 'pending');
});
