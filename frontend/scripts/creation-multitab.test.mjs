import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createCreationPendingStore } from '../src/utils/CreationPendingStore.js';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function storage() {
  const data = new Map();
  return { get length() { return data.size; }, key: i => [...data.keys()][i],
    getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}
const record = genId => ({ genId, ownerId: 'a', genType: 'image', tab: 'image', count: 2 });
test('两个标签页独立保存、更新和结束，不覆盖彼此记录', () => {
  const disk = storage();
  const a = createCreationPendingStore(() => disk), b = createCreationPendingStore(() => disk);
  a.save(record('one')); b.save(record('two'));
  b.assertReady('a'); a.assertReady('a');
  a.save({ ...record('one'), taskId: 'late' });
  assert.equal(b.list('a').find(t => t.genId === 'one').taskId, 'late');
  b.remove('a', 'two');
  assert.deepEqual(a.list('a').map(t => t.genId), ['one']);
  assert.deepEqual(a.list('other'), []);
});
test('新标签页进入时无编号，编号到达后开始轮询，重复事件不重复查询', async () => {
  const source = read('../src/pages/CreationPage.jsx');
  const start = source.indexOf('    const controller = new AbortController();', source.indexOf('// 刷新恢复：'));
  const end = source.indexOf('  // 快照保留到轮询终态', start);
  const disk = storage(), a = createCreationPendingStore(() => disk), b = createCreationPendingStore(() => disk);
  a.save(record('one'));
  const listeners = new Map(), calls = [], rows = new Map();
  let active = 0, finish;
  const window = { addEventListener: (k, fn) => listeners.set(k, fn), removeEventListener: k => listeners.delete(k) };
  const poll = (type, id, timeout, { signal }) => { calls.push({ id, signal }); return new Promise(resolve => { finish = resolve; }); };
  const args = { ownerId: 'a', visitRef: { current: { isCurrent: () => true } }, creationPendingStore: b, window,
    normalizeCreationPendingTask: t => t.taskId ? t : null,
    storeDeleteGeneration: (_tab, id) => rows.delete(id), addGeneration: (_tab, row) => rows.set(row.genId, row),
    createCreationTaskPlaceholder: t => t, incrementActive: () => active++, decrementActive: () => active--,
    apiPollCreationTask: poll, apiPollCreationMusicTask: poll, getCreationTaskType: t => t,
    mergeCreationRecoveryResults: r => r[0], normalizeCreationTaskResult: (r, t) => ({ mediaUrls: r.images, generation: t }),
    storeUpdateCardIds: () => {}, invalidateHistory: () => {}, showToast: () => {},
    useCreationStore: { getState: () => ({ ownerId: 'a' }) } };
  const cleanup = new Function(...Object.keys(args), source.slice(start, end))(...Object.values(args));
  assert.equal(calls.length, 0);
  a.save({ ...record('one'), taskId: 'late' });
  listeners.get('storage')({ key: 'miioo_creation_task:one' });
  listeners.get('storage')({ key: 'miioo_creation_task:one' });
  assert.equal(calls.length, 1);
  assert.equal(rows.get('one').count, 2);
  a.remove('a', 'one');
  listeners.get('storage')({ key: 'miioo_creation_task:one' });
  assert.equal(calls[0].signal.aborted, false);
  finish({ images: ['done'] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(active, 0);
  cleanup();
  assert.equal(listeners.size, 0);
});
test('连续临时查询失败超过旧五次限制，仍能返回最终结果', async () => {
  const source = read('../src/api/creation.js');
  const helpers = source.slice(source.indexOf('function createAbortError'), source.indexOf('function getImageUrls'));
  const begin = source.indexOf('export async function apiPollCreationMusicTask');
  const fn = source.slice(begin, source.indexOf('export async function apiGenerateShotAudio', begin)).replace('export ', '');
  let calls = 0;
  const poll = new Function('authFetch', 'BASE', 'CREATION_POLL_INTERVAL_MS', 'CREATION_POLL_TRANSIENT_STATUSES', 'getSeedance20AudioReferenceErrorMessage', 'extractMusicResultUrl', 'console', helpers + fn + '\nreturn apiPollCreationMusicTask;')(
    async () => { calls++; if (calls <= 7) throw new TypeError('离线'); return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'done', url: 'audio' }) }; },
    '', 0, new Set([503]), () => null, data => data.url, { warn() {} });
  assert.deepEqual((await poll('task')).audios, ['audio']);
  assert.equal(calls, 8);
});
