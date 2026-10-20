import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mergeCreationRecoveryResults } from '../src/utils/CreationRecoveryResults.js';

test('多任务恢复：部分明确失败可保留其他成功媒体及编号', () => {
  const result = mergeCreationRecoveryResults([{ failed: true }, { images: ['a'], cardIds: ['1'] }, { images: ['b'], cardIds: ['2'] }]);
  assert.deepEqual(result.images, ['a', 'b']);
  assert.deepEqual(result.cardIds, ['1', '2']);
});
test('多任务恢复：任一结果未完整时不能消费整组快照', () => {
  assert.throws(() => mergeCreationRecoveryResults([{ images: ['a'] }, { images: [] }]), error => !error.taskFailed);
  assert.throws(() => mergeCreationRecoveryResults([{ failed: true }, { failed: true }]), error => error.taskFailed);
});
test('存储静默丢写也会暂停新提交', () => {
  const { state, store } = fixture();
  state.silent = true;
  assert.throws(() => store.save(record()));
  assert.throws(() => store.assertReady('a'));
  assert.equal(store.list('a').length, 1);
});

const storeSource = readFileSync(new URL('../src/utils/CreationPendingStore.js', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../src/components/creation/useCreationGeneration.js', import.meta.url), 'utf8');
function fixture(raw = '[]') {
  const state = { raw, fail: false, silent: false };
  const storage = {
    getItem: () => state.raw,
    setItem: (_key, value) => { if (state.fail) throw new Error('空间不足'); if (!state.silent) state.raw = value; },
  };
  const factory = new Function('localStorage', storeSource.replaceAll('export ', '') + '\nreturn createCreationPendingStore;')(storage);
  return { state, store: factory(() => storage) };
}
const record = (extra = {}) => ({ ownerId: 'a', genId: 'g', genType: 'image', tab: 'image', count: 1, ...extra });
for (const raw of ['{', '{}', '[null]', '[{"genId":"g","genType":"image","count":-1}]']) {
  test(`损坏记录不覆盖：${raw}`, () => {
    const { state, store } = fixture(raw);
    assert.throws(() => store.assertReady('a'));
    assert.throws(() => store.save(record()));
    assert.equal(state.raw, raw);
  });
}
test('未知提交只锁原账号，有编号允许独立任务', () => {
  const { store } = fixture();
  store.save(record());
  assert.throws(() => store.assertReady('a'));
  store.assertReady('b');
  assert.deepEqual(store.list('b'), []);
  store.save(record({ taskId: 't', taskIds: ['t', 't2'] }));
  store.assertReady('a');
  assert.deepEqual(store.list('a')[0].taskIds, ['t', 't2']);
});
test('旧记录无归属保留但不认领', () => {
  const { state, store } = fixture(JSON.stringify([record({ ownerId: undefined, taskId: 'old' })]));
  const raw = state.raw;
  assert.throws(() => store.assertReady('a'));
  assert.deepEqual(store.list('a'), []);
  assert.equal(state.raw, raw);
});
test('迟到编号写入失败驻留会话，清理失败不丢磁盘记录', () => {
  const { state, store } = fixture();
  store.save(record());
  state.fail = true;
  assert.throws(() => store.save(record({ taskId: 'late' })));
  assert.equal(store.list('a')[0].taskId, 'late');
  assert.throws(() => store.assertReady('a'));
  assert.throws(() => store.remove('a', 'g'));
  state.fail = false;
  store.save(store.list('a')[0]);
  store.assertReady('a');
  store.remove('a', 'g');
  assert.deepEqual(store.list('a'), []);
});

function hookFixture(generate, raw, updateShot = async () => {}, sessionId = null) {
  const { state, store } = fixture(raw);
  const cleanup = [];
  const rows = new Map();
  const notices = [];
  let active = 0;
  const hook = new Function('useCallback', 'useRef', 'useEffect', 'creationPendingStore', 'apiCreateShot', 'apiGenerateCreation', 'apiUpdateShot', 'normalizeImageUrl', 'AUDIO_EXTS_SET', 'isVideoFile',
    hookSource.replace(/import[\s\S]*?from\s*['"][^'"]+['"];\s*/g, '').replace('export function ', 'function ') + '\nreturn useCreationGeneration;')(
    callback => callback, current => ({ current }), callback => { cleanup.push(callback()); }, store,
    async () => ({ id: 'shot' }), generate, updateShot, value => value, new Set(), () => false,
  );
  const actions = hook({
    ownerId: 'a', isLoggedIn: true, activeTab: 'image', sessionIdRef: { current: sessionId },
    addGeneration: (_tab, row) => rows.set(row.id, row), storeDeleteGeneration: (_tab, id) => rows.delete(id),
    storeUpdateCardIds: () => {}, incrementActive: () => active++, decrementActive: () => active--,
    showToast: (...args) => notices.push(args),
  });
  return { state, store, rows, notices, actions, cleanup, get active() { return active; } };
}
test('已完成卡在关联保存等待期间离页仍保留，计数只减一次', async () => {
  let finishUpdate;
  const f = hookFixture(async () => ({ images: ['image'] }), undefined,
    () => new Promise(resolve => { finishUpdate = resolve; }), 'session');
  const running = f.actions.generateCreation({ genType: 'image', count: 1 });
  while (!finishUpdate) await new Promise(resolve => setImmediate(resolve));
  f.cleanup[0]();
  assert.equal(f.rows.size, 1);
  assert.equal([...f.rows.values()][0].cards[0].status, 'done');
  finishUpdate();
  await running;
  assert.equal(f.active, 0);
});
test('真实生成入口：存储失败不提交、不创建假占位', async () => {
  let calls = 0;
  const f = hookFixture(async () => { calls++; });
  f.state.fail = true;
  await f.actions.generateCreation({ genType: 'image', count: 1 });
  assert.equal(calls, 0);
  assert.equal(f.rows.size, 0);
  assert.equal(f.active, 0);
});
test('真实生成入口：轮询断网保留编号，未知受理阻止重发', async () => {
  const f = hookFixture(async (_params, { onTaskCreated }) => {
    onTaskCreated({ taskId: 'original', taskIds: ['original', 'second'] });
    throw new Error('断网');
  });
  await f.actions.generateCreation({ genType: 'image', count: 2 });
  assert.deepEqual(f.store.list('a')[0].taskIds, ['original', 'second']);
  assert.equal(f.rows.size, 0);
  assert.equal(f.active, 0);
  f.store.save(record({ genId: 'unknown' }));
  const before = f.state.raw;
  await f.actions.generateCreation({ genType: 'image', count: 1 });
  assert.equal(f.state.raw, before);
});
test('真实取消：迟到编号仍落盘，不写完成卡', async () => {
  let finish;
  const f = hookFixture((_params, { onTaskCreated }) => new Promise(resolve => {
    finish = () => { onTaskCreated({ taskId: 'late' }); resolve({ audios: ['/a.mp3'] }); };
  }));
  const promise = f.actions.generateCreation({ genType: 'dubbing', count: 1 });
  assert.equal(f.actions.cancelGeneration(), true);
  finish();
  await promise;
  assert.equal(f.store.list('a')[0].taskId, 'late');
  assert.equal(f.rows.size, 0);
  assert.equal(f.active, 0);
});
test('离页后响应只保存原账号编号，不写入结果、不重复减计数', async () => {
  let finish;
  const f = hookFixture((_params, { onTaskCreated }) => new Promise(resolve => {
    finish = () => { onTaskCreated({ taskId: 'late' }); resolve({ images: ['/a.png'] }); };
  }));
  const promise = f.actions.generateCreation({ genType: 'image', count: 1 });
  f.cleanup.forEach(callback => callback?.());
  finish();
  await promise;
  assert.equal(f.store.list('a')[0].taskId, 'late');
  assert.equal(f.rows.size, 0);
  assert.equal(f.active, 0);
});
