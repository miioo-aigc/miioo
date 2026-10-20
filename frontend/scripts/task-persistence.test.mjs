import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTaskPersistence } from '../src/utils/taskPersistence.js';

const key = 'miioo:pending_tasks';
const task = (extra = {}) => ({ taskId: 't', projectId: 'p', ownerId: 'a', episodeId: 'e', shotId: 's', type: 'image', ...extra });
function fixture(raw = null) {
  const state = { raw, writes: 0, readError: false, writeError: false, silent: false, mismatch: false };
  const store = createTaskPersistence(() => ({
    getItem(name) {
      assert.equal(name, key);
      if (state.readError) throw new Error('不可读');
      return state.raw;
    },
    setItem(name, value) {
      assert.equal(name, key);
      state.writes++;
      if (state.writeError) throw new Error('空间不足');
      if (!state.silent) state.raw = state.mismatch ? ' []' : value;
    },
  }));
  return { state, store };
}

for (const raw of ['{', '{}', 'null', '[null]', JSON.stringify([task({ type: 'bad' })]), JSON.stringify([task(), task()])]) {
  test(`损坏或结构错误不覆盖原文：${raw}`, () => {
    const { state, store } = fixture(raw);
    assert.throws(() => store.getPendingTasks('p', 'e'), /任务记录/);
    assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /任务记录/);
    assert.throws(() => store.addPendingTask('p', task()), /任务记录/);
    assert.equal(state.raw, raw);
    assert.equal(state.writes, 0);
  });
}

test('读取权限异常不能当空列表，也不尝试写入', () => {
  const { state, store } = fixture();
  state.readError = true;
  assert.throws(() => store.getPendingTasks('p', 'e'), /读取失败/);
  assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /读取失败/);
  assert.equal(state.writes, 0);
});

for (const mode of ['writeError', 'silent', 'mismatch']) {
  test(`${mode}：已受理编号会话保留，暂停新提交，恢复保存后才能解锁`, () => {
    const { state, store } = fixture();
    state[mode] = true;
    assert.throws(() => store.addPendingTask('p', task()), /保存或清理失败/);
    assert.equal(store.getPendingTasks('p', 'e')[0].taskId, 't');
    assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /未保存/);
    state[mode] = false;
    store.addPendingTask('p', task());
    store.assertPendingTaskStorageReady('p', 'a');
    assert.equal(JSON.parse(state.raw).length, 1);
    store.removePendingTask('p', 't', 'a');
    assert.deepEqual(store.getPendingTasks('p', 'e'), []);
  });
}

test('提交前写入失败直接阻止生成', () => {
  const { state, store } = fixture();
  state.writeError = true;
  assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /保存或清理失败/);
  assert.equal(state.raw, null);
});

for (const mode of ['writeError', 'mismatch']) {
  test(`${mode}：清理失败仍保留编号，确认清理成功后解除锁定`, () => {
    const { state, store } = fixture(JSON.stringify([task()]));
    state[mode] = true;
    assert.throws(() => store.removePendingTask('p', 't', 'a'), /保存或清理失败/);
    assert.equal(store.getPendingTasks('p', 'e')[0].taskId, 't');
    assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /未保存或清理未确认/);
    state[mode] = false;
    store.removePendingTask('p', 't', 'a');
    store.assertPendingTaskStorageReady('p', 'a');
    assert.equal(state.raw, '[]');
  });
}

test('同编号跨账号和项目隔离；查询只返回指定分集；旧无归属保留并阻止该项目提交', () => {
  const tasks = [task(), task({ ownerId: 'b' }), task({ projectId: 'q' }), task({ taskId: 'other', episodeId: 'f' }), task({ taskId: 'legacy', ownerId: undefined })];
  const { state, store } = fixture(JSON.stringify(tasks));
  assert.equal(store.getPendingTasks('p', 'e').length, 3);
  assert.throws(() => store.removePendingTask('p', 't'), /账号归属/);
  store.removePendingTask('p', 't', 'a');
  assert.equal(JSON.parse(state.raw).length, 4);
  assert.ok(store.getPendingTasks('p', 'e').some((t) => t.ownerId === 'b'));
  assert.throws(() => store.assertPendingTaskStorageReady('p', 'a'), /旧任务/);
  store.assertPendingTaskStorageReady('q', 'a');
  assert.ok(JSON.parse(state.raw).some((t) => t.taskId === 'legacy'));
});

test('新增任务必须完整，结构不完整时不污染原记录', () => {
  const { state, store } = fixture();
  for (const bad of [{ shotId: null }, { type: 'subject-single' }, { type: 'batch-subject', tab: 'char', subjectIds: ['s'], expectedSubjectIds: ['other'] }]) {
    assert.throws(() => store.addPendingTask('p', task(bad)), /结构异常/);
  }
  assert.equal(state.writes, 0);
  assert.deepEqual(store.getPendingTasks('p', 'e'), []);
});

test('项目清理只清指定账号，保留其他任务', () => {
  const { store } = fixture(JSON.stringify([task(), task({ ownerId: 'b' }), task({ projectId: 'q' })]));
  store.clearProjectPendingTasks('p', 'a');
  assert.deepEqual(store.getPendingTasks('p', 'e').map((t) => t.ownerId), ['b']);
  assert.equal(store.getPendingTasks('q', 'e').length, 1);
});
