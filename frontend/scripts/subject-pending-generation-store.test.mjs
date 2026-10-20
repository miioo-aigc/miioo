import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/utils/subjectPendingGenerationStore.js', import.meta.url), 'utf8');
function fixture(raw = '[]') {
  const state = { raw, readFails: false, writeFails: false, silent: false, writes: 0, notices: [] };
  const storage = {
    getItem() { if (state.readFails) throw new Error('读取失败'); return state.raw; },
    setItem(_key, value) {
      state.writes++;
      if (state.writeFails) throw new Error('空间不足');
      if (!state.silent) state.raw = value;
    },
  };
  const api = new Function('localStorage', source.replace('export { pendingGenerations };', '').replaceAll('export function ', 'function ')
    + '\nreturn { createSubjectGenerationStore, getSubjectGenerationScope };')(storage);
  const store = api.createSubjectGenerationStore(() => storage);
  const scope = api.getSubjectGenerationScope('p', 'a', error => state.notices.push(error), store);
  return { state, scope, store, api };
}
for (const raw of ['{坏数据', '{}', '[null]', '[["x",null]]', '[["x",{"status":"unknown"}]]', '[["x",{"status":"pending","ownerId":"a","projectId":"p","subjectId":"s"}]]', '[["x",{"status":"pending"}],["x",{"status":"done"}]]']) {
  test(`损坏缓存不覆盖、不认领、不允许新提交：${raw}`, () => {
    const { state, scope } = fixture(raw);
    assert.throws(() => scope.assertReady(), { code: 'SUBJECT_GENERATION_STORAGE' });
    assert.throws(() => scope.set('s', { status: 'pending' }));
    assert.equal(state.raw, raw);
    assert.equal(state.writes, 0);
    assert.equal(scope.get('s'), undefined);
  });
}
test('归属不明旧任务保留，禁止新付费任务', () => {
  const raw = '[["old",{"status":"pending"}]]';
  const { state, scope } = fixture(raw);
  assert.throws(() => scope.assertReady());
  assert.deepEqual(scope.entries(), []);
  assert.equal(state.raw, raw);
});
for (const mode of ['readFails', 'writeFails', 'silent']) {
  test(`存储${mode}时不建立假占位`, () => {
    const { state, scope } = fixture();
    state[mode] = true;
    assert.throws(() => scope.set('s', { status: 'pending' }));
    assert.equal(scope.get('s'), undefined);
    assert.equal(scope.hasStorageError(), true);
  });
}
test('清理失败保留记录并提示，恢复后可再次清理', () => {
  const { state, scope } = fixture();
  scope.set('s', { status: 'pending' });
  const saved = state.raw;
  state.writeFails = true;
  assert.equal(scope.delete('s'), false);
  assert.equal(scope.get('s').status, 'pending');
  assert.equal(state.raw, saved);
  assert.equal(state.notices.length, 1);
  state.writeFails = false;
  assert.equal(scope.delete('s'), true);
  assert.equal(scope.get('s'), undefined);
});
test('完成结果落盘失败留在会话，恢复后补写；无故障读取保持对象身份', () => {
  const { state, scope } = fixture();
  scope.set('s', { status: 'pending' });
  const previous = scope.get('s');
  scope.assertReadable();
  assert.equal(scope.get('s'), previous);
  state.writeFails = true;
  assert.equal(scope.set('s', { status: 'done', rawUrl: '/image' }), false);
  assert.equal(scope.get('s').rawUrl, '/image');
  scope.assertReadable();
  assert.equal(scope.hasStorageError(), true);
  assert.equal(JSON.parse(state.raw)[0][1].status, 'pending');
  assert.equal(state.notices.length, 1);
  state.writeFails = false;
  scope.assertReady();
  assert.equal(JSON.parse(state.raw)[0][1].status, 'done');
});
test('不同账号项目不串任务，写入保留其他归属', () => {
  const { state, scope, store, api } = fixture();
  scope.set('s', { status: 'pending' });
  const other = api.getSubjectGenerationScope('q', 'b', undefined, store);
  assert.equal(other.get('s'), undefined);
  other.set('s', { status: 'pending' });
  assert.equal(JSON.parse(state.raw).length, 2);
  other.delete('s');
  assert.equal(scope.get('s').ownerId, 'a');
});

const page = readFileSync(new URL('../src/pages/SubjectPage.jsx', import.meta.url), 'utf8');
for (const timing of ['提交前检查', '创建占位记录']) {
  test(`实际页面提交入口：${timing}失败不进入生成及占位`, () => {
    const { state, scope } = fixture();
    state.writeFails = timing === '提交前检查';
    const start = page.indexOf('            if (!isSaveCurrent()) return;');
    const end = page.indexOf('            const genParams = buildSubjectGenerationParams', start);
    assert.ok(start >= 0 && end > start);
    let loading = 0;
    let images = 0;
    const notices = [];
    const bindings = {
      isSaveCurrent: () => true, ownerId: 'a', projectId: 'p',
      assertPendingTaskStorageReady() {}, pendingGenerations: scope,
      showToast: (...args) => notices.push(args),
      getPrimaryVersion: () => { if (timing === '创建占位记录') state.writeFails = true; return 1; },
      crypto: { randomUUID: () => 'placeholder' }, char: { id: 's' }, tabLabel: '角色',
      selectedModel: 'm', selectedRatio: '1:1', selectedResolution: '1k', promptText: '内容',
      generatedImages: [], persistedReferenceImages: [], mapReferenceImageIdsForModal: () => [],
      setBatchLoadingSubjects: () => { loading++; }, setGeneratedImages: () => { images++; },
    };
    new Function(...Object.keys(bindings), page.slice(start, end))(...Object.values(bindings));
    assert.equal(notices.length, 1);
    assert.equal(loading, 0);
    assert.equal(images, 0);
    assert.equal(scope.get('s'), undefined);
  });
}
