import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/api/subject.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export async function apiBatchGenerateStream'), source.indexOf('export async function apiUpdateSubjectCompat'));

function setup({ stream, tasks = [], signal } = {}) {
  const events = [];
  let queries = 0;
  let releases = 0;
  const response = stream === undefined
    ? { ok: true, headers: new Headers(), json: async () => ({ task_id: 'task-1' }) }
    : { ok: true, headers: new Headers({ 'content-type': 'text/event-stream' }), body: {
      getReader: () => ({ read: async () => stream.length ? { value: new TextEncoder().encode(stream.shift()), done: false } : { done: true }, releaseLock: () => releases++ }),
    } };
  const run = new Function('authFetchStream', 'authFetch', 'invalidateSubjects', 'BASE', 'isBatchSubjectTaskTerminal', 'setTimeout',
    `${body.replace('export async function', 'async function')} return apiBatchGenerateStream;`)(
    async () => response,
    async () => {
      queries++;
      const next = tasks.shift() ?? { status: 'running' };
      if (next instanceof Error) throw next;
      return { ok: next.httpError !== true, status: 503, json: async () => next };
    },
    () => events.push('invalidate'), '', status => ['completed', 'failed'].includes(status), resolve => resolve(),
  );
  return {
    events, queries: () => queries, releases: () => releases,
    run: () => run('project-1', {}, {
      signal,
      onTaskCreated: id => events.push(['task', id]),
      onComplete: () => events.push('complete'),
      onSubjectImage: id => events.push(['image', id]),
      onSubjectError: id => events.push(['error', id]),
    }),
  };
}

test('连续三次查询失败暂停，不发送完成或缓存失效', async () => {
  const harness = setup({ tasks: [{ httpError: true }, new Error('断网'), { httpError: true }] });
  await assert.rejects(harness.run(), /连续失败/);
  assert.equal(harness.queries(), 3);
  assert.deepEqual(harness.events, [['task', 'task-1']]);
});

test('达到查询上限不冒充任务完成', async () => {
  const harness = setup();
  await assert.rejects(harness.run(), /超时/);
  assert.equal(harness.queries(), 200);
  assert.ok(!harness.events.includes('complete'));
});

test('短暂失败后恢复，结果去重且普通说明不是错误', async () => {
  const result = { subject_id: 's1', image_url: '/image.png', message: '已生成' };
  const harness = setup({ tasks: [new Error('断网'), { status: 'running', results: [result] }, { status: 'completed', results: [result] }] });
  await harness.run();
  assert.deepEqual(harness.events, [['task', 'task-1'], ['image', 's1'], 'invalidate', 'complete']);
});

test('流连接无完成标记断开不冒充成功', async () => {
  const harness = setup({ stream: ['data: {"subject_id":"s1","image_url":"/image.png"}\n'] });
  await assert.rejects(harness.run(), /连接已中断/);
  assert.ok(!harness.events.includes('complete'));
  assert.equal(harness.releases(), 1);
});

test('流任务查询错误向调用方传播，释放锁仅一次', async () => {
  const harness = setup({ stream: ['data: {"type":"task","task_id":"task-1"}\n'], tasks: Array.from({ length: 3 }, () => new Error('断网')) });
  await assert.rejects(harness.run(), /连续失败/);
  assert.equal(harness.releases(), 1);
  assert.ok(!harness.events.includes('complete'));
});

test('明确的流结束标记才完成', async () => {
  const harness = setup({ stream: ['data: [DONE]\n'] });
  await harness.run();
  assert.deepEqual(harness.events, ['invalidate', 'complete']);
});

test('取消后不查询也不完成', async () => {
  const controller = new AbortController();
  controller.abort();
  const harness = setup({ signal: controller.signal });
  await assert.rejects(harness.run(), { name: 'AbortError' });
  assert.equal(harness.queries(), 0);
  assert.ok(!harness.events.includes('complete'));
});
