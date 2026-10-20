import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runStoryboardEpisodeGeneration } from '../src/utils/StoryboardEpisodeGeneration.js';

function fixture(overrides = {}) {
  const events = [];
  return {
    events,
    options: {
      submit: async () => ({ task_id: 'original', status: 'pending' }),
      persist: (id) => events.push(['persist', id]),
      poll: async () => ({ status: 'completed' }),
      readResult: async () => ['new'],
      applyResult: (rows) => events.push(['apply', rows]),
      remove: (id) => events.push(['remove', id]),
      isCurrent: () => true,
      ...overrides,
    },
  };
}

test('成功回读后才替换旧数据并清任务', async () => {
  const { events, options } = fixture();
  assert.equal((await runStoryboardEpisodeGeneration(options)).settled, true);
  assert.deepEqual(events, [['persist', 'original'], ['apply', ['new']], ['remove', 'original']]);
});

for (const phase of ['poll', 'readResult']) {
  test(`${phase}断网保留任务和旧数据`, async () => {
    const { events, options } = fixture({ [phase]: async () => { throw new Error('offline'); } });
    await assert.rejects(runStoryboardEpisodeGeneration(options), (error) => {
      assert.equal(error.generationSettled, false);
      assert.equal(error.generationTaskId, 'original');
      return true;
    });
    assert.deepEqual(events, [['persist', 'original']]);
  });
}

test('离页后到达的提交仍保存编号但不轮询或回填', async () => {
  const { events, options } = fixture({ isCurrent: () => false });
  await runStoryboardEpisodeGeneration(options);
  assert.deepEqual(events, [['persist', 'original']]);
});

test('明确失败解除任务锁，允许后续重新提交', async () => {
  const { events, options } = fixture({ poll: async () => ({ status: 'failed' }) });
  await assert.rejects(runStoryboardEpisodeGeneration(options), (error) => error.generationSettled === true);
  assert.deepEqual(events, [['persist', 'original'], ['remove', 'original']]);
});

test('未知状态不能冒充完成', async () => {
  const { events, options } = fixture({ poll: async () => ({ status: 'unknown' }) });
  await assert.rejects(runStoryboardEpisodeGeneration(options));
  assert.deepEqual(events, [['persist', 'original']]);
});

test('部分失败不能静默当作完全成功', async () => {
  const { events, options } = fixture({ poll: async () => ({ status: 'partial', fail_count: 1 }) });
  await assert.rejects(runStoryboardEpisodeGeneration(options), (error) => error.generationSettled === true);
  assert.deepEqual(events, [['persist', 'original'], ['remove', 'original']]);
});

test('编号持久化失败不继续轮询且保留错误中的原编号', async () => {
  const { events, options } = fixture({ persist: () => { throw new Error('storage'); } });
  await assert.rejects(runStoryboardEpisodeGeneration(options), (error) => error.generationTaskId === 'original' && !error.generationSettled);
  assert.deepEqual(events, []);
});

test('回读期间切换归属不回填不删除任务', async () => {
  let current = true;
  const { events, options } = fixture({
    isCurrent: () => current,
    readResult: async () => { current = false; return ['new']; },
  });
  await runStoryboardEpisodeGeneration(options);
  assert.deepEqual(events, [['persist', 'original']]);
});

test('提交无响应不能宣称取得任务编号', async () => {
  const { events, options } = fixture({ submit: async () => { throw new Error('timeout'); } });
  await assert.rejects(runStoryboardEpisodeGeneration(options), (error) => error.generationTaskId === null && !error.generationSettled);
  assert.deepEqual(events, []);
});
