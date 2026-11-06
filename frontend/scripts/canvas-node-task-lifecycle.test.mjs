import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNodeTaskLifecycle } from '../src/components/canvas/CanvasNodeTaskLifecycle.js';

const plan = (nodeId = 'node', requestId = 'request', extra = {}) => ({
  canvasId: 'canvas', nodeId, requestId, upstreamNodeIds: [],
  snapshot: { prompt: '提示词', params: { count: 1 }, inputs: [] }, ...extra,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('快照独立深冻结，外部草稿与返回对象不能改变本次任务', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const input = plan('node', 'r', { upstreamNodeIds: ['upstream', 'upstream'] });
  const identity = tasks.start(input);
  input.snapshot.params.count = 9;
  input.upstreamNodeIds.push('other');
  const state = tasks.inspect('canvas', 'node');
  assert.equal(state.snapshot.params.count, 1);
  assert.equal(tasks.inspect('canvas', 'upstream').dependencyCount, 1);
  assert.equal(tasks.inspect('canvas', 'other').dependencyCount, 0);
  assert.ok(Object.isFrozen(identity));
  assert.throws(() => { state.snapshot.params.count = 8; }, TypeError);
  assert.throws(() => state.taskIds.push('fake'), TypeError);
  assert.equal(state.submissionLocked, true);
  assert.equal(state.outputLocked, true);
  assert.equal(state.deleteLocked, false);
});

test('纯数据校验拒绝访问器、循环、运行对象、危险键和异常数组且无副作用', () => {
  let calls = 0;
  const getter = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 1; } });
  const arrayGetter = Object.defineProperty([], '0', { enumerable: true, get() { calls++; return 1; } });
  const iterator = [1]; iterator[Symbol.iterator] = () => { calls++; return [1][Symbol.iterator](); };
  const cycle = {}; cycle.self = cycle;
  const arrayCycle = []; arrayCycle.push(arrayCycle);
  const extra = [1]; extra.extra = 2;
  const hidden = {}; Object.defineProperty(hidden, 'hidden', { value: 1 });
  const bad = [getter, arrayGetter, iterator, cycle, arrayCycle, extra, hidden, new Array(1),
    new Date(), { value: Infinity }, { fn() {} }, { controller: {} },
    JSON.parse('{"__proto__":{}}'), { constructor: 'bad' },
    { previewUrl: 'blob:local' }, { assetIds: ['https://example.test/a'] }];
  for (const snapshot of bad) {
    const tasks = createCanvasNodeTaskLifecycle();
    assert.throws(() => tasks.start(plan('node', 'r', { snapshot })));
    assert.equal(tasks.inspect('canvas', 'node').status, 'idle');
  }
  const tasks = createCanvasNodeTaskLifecycle();
  const input = Object.defineProperty(plan(), 'snapshot', { get() { calls++; return {}; } });
  assert.throws(() => tasks.start(input));
  assert.equal(calls, 0);
  const shared = { resultId: 'result' };
  tasks.start(plan('node', 'r', { snapshot: { values: [shared, shared], prompt: '分析 https://example.test' } }));
  const values = tasks.inspect('canvas', 'node').snapshot.values;
  assert.notStrictEqual(values[0], values[1]);
});

test('同节点互斥，不同节点和不同画布可并发，身份不可复用', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const first = tasks.start(plan());
  assert.throws(() => tasks.start(plan('node', 'second')), /正在创作/);
  tasks.start(plan('other'));
  tasks.start(plan('node', 'request', { canvasId: 'other-canvas' }));
  assert.equal(tasks.fail(first), true);
  assert.throws(() => tasks.start(plan()), /不能复用/);
  tasks.start(plan('node', 'second'));
  assert.equal(tasks.fail(first), false);
  assert.equal(tasks.inspect('canvas', 'node').identity.requestId, 'second');
});

test('直接上游提交和生成中都拦截下游，保留旧结果不构成例外', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const upstream = tasks.start(plan('upstream'));
  const downstream = plan('downstream', 'r', { upstreamNodeIds: ['upstream'],
    snapshot: { inputs: [{ resultId: 'old-result' }] } });
  assert.throws(() => tasks.start(downstream), /直接上游/);
  tasks.registerTaskIds(upstream, ['server']);
  tasks.accepted(upstream);
  assert.throws(() => tasks.start(downstream), /直接上游/);
  assert.equal(tasks.inspect('canvas', 'upstream').dependencyCount, 0);
  tasks.fail(upstream);
  tasks.start(downstream);
  assert.throws(() => tasks.start(plan('self', 'r', { upstreamNodeIds: ['self'] })), /自身引用/);
});

test('多下游引用计数独立释放，多图首个乃至多个编号都不推断受理完成', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const a = tasks.start(plan('a', 'a', { upstreamNodeIds: ['upstream'] }));
  const b = tasks.start(plan('b', 'b', { upstreamNodeIds: ['upstream'] }));
  const count = () => tasks.inspect('canvas', 'upstream').dependencyCount;
  assert.equal(count(), 2);
  tasks.registerTaskIds(a, ['a-1']);
  assert.equal(count(), 2);
  tasks.registerTaskIds(a, ['a-1', 'a-2']);
  assert.equal(tasks.inspect('canvas', 'a').submissionLocked, true);
  assert.equal(count(), 2);
  assert.throws(() => tasks.start(plan('upstream', 'new')), /操作可能导致下游丢失参考素材，请稍后再试/);
  assert.throws(() => tasks.delete('canvas', ['upstream']), /操作可能导致/);
  assert.equal(tasks.accepted(a), true);
  assert.equal(tasks.accepted(a), true);
  assert.equal(count(), 1);
  tasks.fail(b);
  assert.equal(count(), 0);
  tasks.start(plan('upstream', 'new'));
  assert.equal(tasks.inspect('canvas', 'a').outputLocked, true);
  assert.equal(tasks.inspect('canvas', 'a').submissionLocked, false);
  assert.deepEqual(tasks.inspect('canvas', 'a').taskIds, ['a-1', 'a-2']);
});

test('无真实编号不能受理或接受结果，受理后拒绝未知新增编号', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const identity = tasks.start(plan());
  assert.throws(() => tasks.accepted(identity), /真实服务端/);
  assert.equal(tasks.accept(identity, identity), false);
  tasks.registerTaskIds(identity, ['server']);
  assert.equal(tasks.accept(identity, identity), false);
  tasks.accepted(identity);
  assert.throws(() => tasks.registerTaskIds(identity, ['unexpected']), /不能新增/);
  assert.deepEqual(tasks.inspect('canvas', 'node').taskIds, ['server']);
  assert.equal(tasks.registerTaskIds(identity, ['server']), true);
});

test('接受终态必须画布、节点、请求全匹配，只消费一次且旧请求不影响新任务', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const identity = tasks.start(plan());
  tasks.registerTaskIds(identity, ['server']);
  tasks.accepted(identity);
  for (const field of ['canvasId', 'nodeId', 'requestId']) {
    assert.equal(tasks.accept(identity, { ...identity, [field]: 'other' }), false);
    assert.equal(tasks.accept({ ...identity, [field]: 'other' }, identity), false);
  }
  assert.equal(tasks.accept(identity, identity), true);
  assert.equal(tasks.accept(identity, identity), false);
  assert.equal(tasks.inspect('canvas', 'node').outputLocked, false);
  const next = tasks.start(plan('node', 'next'));
  assert.equal(tasks.accept(identity, next), false);
  assert.equal(tasks.fail(identity), false);
  assert.equal(tasks.inspect('canvas', 'node').identity.requestId, 'next');
});

test('删除无编号任务立即释放保护，晚到编号逐批补取消且去重', () => {
  const cancelled = [];
  const tasks = createCanvasNodeTaskLifecycle({ cancel: (identity) => cancelled.push(identity) });
  const identity = tasks.start(plan('node', 'r', { upstreamNodeIds: ['upstream'] }));
  assert.equal(tasks.delete('canvas', ['node']), 1);
  assert.equal(tasks.inspect('canvas', 'upstream').dependencyCount, 0);
  assert.equal(cancelled.length, 0);
  tasks.registerTaskIds(identity, ['server-1']);
  tasks.registerTaskIds(identity, ['server-1', 'server-2']);
  tasks.registerTaskIds(identity, ['server-2']);
  assert.deepEqual(cancelled, [{ ...identity, taskIds: ['server-1'] }, { ...identity, taskIds: ['server-2'] }]);
  assert.ok(Object.isFrozen(cancelled[0].taskIds));
  assert.equal(tasks.accepted(identity), false);
  assert.equal(tasks.accept(identity, identity), false);
  assert.equal(tasks.fail(identity), false);
  assert.equal(tasks.delete('canvas', ['node']), 0);
});

test('提交失败释放依赖但保留身份，失败后删除仍取消已知及晚到任务', () => {
  const cancelled = [];
  const tasks = createCanvasNodeTaskLifecycle({ cancel: (identity) => cancelled.push(identity) });
  const old = tasks.start(plan('node', 'old', { upstreamNodeIds: ['upstream'] }));
  tasks.registerTaskIds(old, ['known']);
  tasks.fail(old);
  assert.equal(tasks.inspect('canvas', 'upstream').dependencyCount, 0);
  assert.equal(tasks.accept(old, old), false);
  tasks.registerTaskIds(old, ['before-delete']);
  const current = tasks.start(plan('node', 'new'));
  assert.equal(tasks.accepted(old), false);
  assert.equal(tasks.delete('canvas', ['node']), 2);
  tasks.registerTaskIds(old, ['after-delete']);
  tasks.registerTaskIds(current, ['new-server']);
  assert.deepEqual(cancelled.map((item) => [item.requestId, item.taskIds]), [
    ['old', ['known', 'before-delete']], ['old', ['after-delete']], ['new', ['new-server']],
  ]);
  assert.equal(tasks.accept(current, current), false);
});

test('生成失败也释放互斥，迟到成功不会获得写入许可', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const identity = tasks.start(plan());
  tasks.registerTaskIds(identity, ['server']);
  tasks.accepted(identity);
  assert.equal(tasks.fail(identity), true);
  assert.equal(tasks.accept(identity, identity), false);
  tasks.start(plan('node', 'retry'));
});

test('批量删除先整体检查依赖，组内依赖也不绕过保护，且不跨画布取消', () => {
  const cancelled = [];
  const tasks = createCanvasNodeTaskLifecycle({ cancel: (identity) => cancelled.push(identity) });
  const child = tasks.start(plan('child', 'r', { upstreamNodeIds: ['upstream'] }));
  const other = tasks.start(plan('other'));
  const foreign = tasks.start(plan('other', 'request', { canvasId: 'foreign' }));
  tasks.registerTaskIds(child, ['child-server']);
  tasks.registerTaskIds(other, ['other-server']);
  tasks.registerTaskIds(foreign, ['foreign-server']);
  assert.throws(() => tasks.delete('canvas', ['other', 'child', 'upstream']), /操作可能导致/);
  assert.equal(cancelled.length, 0);
  assert.equal(tasks.inspect('canvas', 'other').status, 'submitting');
  tasks.accepted(child);
  assert.equal(tasks.delete('canvas', ['other', 'child', 'upstream', 'other']), 2);
  assert.deepEqual(cancelled.map((item) => item.taskIds), [['child-server'], ['other-server']]);
  assert.equal(tasks.inspect('foreign', 'other').status, 'submitting');
});

test('批量取消回调重入前全组已失效', () => {
  let second;
  let tasks;
  const permits = [];
  tasks = createCanvasNodeTaskLifecycle({ cancel: () => permits.push(tasks.accept(second, second)) });
  const first = tasks.start(plan('first'));
  second = tasks.start(plan('second'));
  for (const identity of [first, second]) {
    tasks.registerTaskIds(identity, [identity.nodeId + '-server']);
    tasks.accepted(identity);
  }
  tasks.delete('canvas', ['first', 'second']);
  assert.deepEqual(permits, [false, false]);
});

test('取消同步抛错及异步拒绝都静默且每个编号只尝试一次', async () => {
  for (const asynchronous of [false, true]) {
    let calls = 0;
    const tasks = createCanvasNodeTaskLifecycle({ cancel: () => {
      calls++;
      if (asynchronous) return Promise.reject(new Error('取消失败'));
      throw new Error('取消失败');
    } });
    const identity = tasks.start(plan());
    tasks.registerTaskIds(identity, ['one']);
    assert.doesNotThrow(() => tasks.delete('canvas', ['node']));
    tasks.registerTaskIds(identity, ['one', 'two']);
    tasks.registerTaskIds(identity, ['one', 'two']);
    tasks.delete('canvas', ['node']);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.equal(tasks.accept(identity, identity), false);
  }
});

test('异步交错：删除旧任务、新请求完成、旧编号和结果随后到达', async () => {
  const cancelled = [];
  const tasks = createCanvasNodeTaskLifecycle({ cancel: (identity) => cancelled.push(identity) });
  const old = tasks.start(plan('node', 'old'));
  const idGate = deferred();
  const resultGate = deferred();
  const lateIds = idGate.promise.then((ids) => tasks.registerTaskIds(old, ids));
  const lateResult = resultGate.promise.then(() => tasks.accept(old, old));
  tasks.delete('canvas', ['node']);
  const current = tasks.start(plan('node', 'new'));
  tasks.registerTaskIds(current, ['new-server']);
  tasks.accepted(current);
  idGate.resolve(['old-server']);
  resultGate.resolve();
  assert.deepEqual(await Promise.all([lateIds, lateResult]), [true, false]);
  assert.equal(tasks.inspect('canvas', 'node').identity.requestId, 'new');
  assert.equal(tasks.accept(current, current), true);
  assert.deepEqual(cancelled, [{ ...old, taskIds: ['old-server'] }]);
});

test('直接依赖不跨层传播，不按图片数量推断服务端编号数量', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  const child = tasks.start(plan('child', 'r', { upstreamNodeIds: ['middle'],
    snapshot: { params: { count: 4 }, inputs: [{ nodeId: 'middle', resultId: 'r' }] } }));
  assert.equal(tasks.inspect('canvas', 'ancestor').dependencyCount, 0);
  tasks.registerTaskIds(child, ['one-batch-task']);
  tasks.accepted(child);
  assert.equal(tasks.inspect('canvas', 'middle').dependencyCount, 0);
  assert.equal(tasks.accept(child, child), true);
});

test('无效参数与未知身份不能污染状态或误释放依赖', () => {
  const tasks = createCanvasNodeTaskLifecycle();
  assert.throws(() => createCanvasNodeTaskLifecycle({ cancel: true }));
  for (const input of [plan('', 'r'), plan('node', ''), plan('node', 'r', { canvasId: 'https://bad' }),
    plan('node', 'r', { upstreamNodeIds: [null] })]) assert.throws(() => tasks.start(input));
  const identity = tasks.start(plan('node', 'r', { upstreamNodeIds: ['upstream'] }));
  const unknown = { ...identity, requestId: 'unknown' };
  assert.equal(tasks.fail(unknown), false);
  assert.equal(tasks.accepted(unknown), false);
  assert.equal(tasks.registerTaskIds(unknown, ['server']), false);
  assert.throws(() => tasks.registerTaskIds(identity, ['valid', 'https://bad']));
  assert.deepEqual(tasks.inspect('canvas', 'node').taskIds, []);
  assert.equal(tasks.inspect('canvas', 'upstream').dependencyCount, 1);
});
