import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNodeResults, commitCanvasResultBatch, normalizeCanvasResultBatch,
  selectCanvasNodeResult, getCanvasCurrentResult, projectCanvasCurrentResult,
  collectCanvasResultAssetIds, getCanvasResultHistory, validateCanvasNodeResults,
} from '../src/components/canvas/CanvasNodeResults.js';
import { migrateLegacyCanvasResults, cloneCanvasNodeResults } from '../src/components/canvas/CanvasResultCompatibility.js';

const assetId = '12345678-1234-1234-1234-123456789abc';
const image = (id, index = 0) => ({ id, index, type: 'image', assetId });
const batch = (id, results = [image(id + '-result')], extra = {}) => ({
  id, source: 'generation', requestedCount: 1, results, submittedAt: 10, completedAt: 20, ...extra,
});
const initial = () => commitCanvasResultBatch(createCanvasNodeResults(), batch('first'));
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('成功覆盖且不可变，失败批次保持同一状态', () => {
  const before = freeze(initial());
  const next = commitCanvasResultBatch(before, freeze(batch('second')));
  assert.equal(before.currentResultId, 'first-result');
  assert.equal(next.currentResultId, 'second-result');
  assert.equal(next.batches.length, 2);
  assert.strictEqual(commitCanvasResultBatch(next, batch('failed', [{ index: 0, status: 'failed' }])), next);
  assert.strictEqual(commitCanvasResultBatch(createCanvasNodeResults(), batch('failed', [] )).currentResultId, null);
});

test('多图按稳定索引选择第一有效项，空位不移位', () => {
  const state = commitCanvasResultBatch(createCanvasNodeResults(), batch('multi', [
    image('third', 2), { index: 0, status: 'failed' }, image('second', 1),
  ], { requestedCount: 4 }));
  assert.equal(state.currentResultId, 'second');
  assert.equal(state.batches[0].status, 'partial');
  assert.deepEqual(state.batches[0].results.map((item) => item.index), [1, 2]);
  assert.deepEqual(collectCanvasResultAssetIds(state), [assetId]);
});

test('重复终态幂等且不覆盖用户选择，冲突编号拒绝', () => {
  const input = batch('multi', [image('a'), image('b', 1)], { requestedCount: 2 });
  const state = selectCanvasNodeResult(commitCanvasResultBatch(createCanvasNodeResults(), input), 'b');
  assert.strictEqual(commitCanvasResultBatch(state, input), state);
  assert.throws(() => commitCanvasResultBatch(state, { ...input, results: [image('c')] }), /批次编号/);
  assert.throws(() => commitCanvasResultBatch(state, batch('other', [image('a')])), /跨批次/);
});

test('历史浏览独立，显式甲乙甲选择可追溯，不改变批次排序', () => {
  const state = commitCanvasResultBatch(initial(), batch('second', undefined, { submittedAt: 30, completedAt: 40 }));
  const restored = selectCanvasNodeResult(state, 'first-result');
  assert.deepEqual(restored.selections.map((item) => item.resultId), ['first-result', 'second-result', 'first-result']);
  assert.deepEqual(getCanvasResultHistory(restored).map((item) => item.id), ['second', 'first']);
  const history = getCanvasResultHistory(restored);
  history[0].results[0].id = 'mutated';
  const current = getCanvasCurrentResult(restored);
  current.id = 'mutated';
  assert.equal(restored.currentResultId, 'first-result');
  assert.equal(restored.batches[1].results[0].id, 'second-result');
  assert.throws(() => selectCanvasNodeResult(restored, 'missing'), /不存在/);
});

test('文本与视频投影只来自当前结果，不拼接正文或带入地址', () => {
  for (const type of ['text', 'video']) {
    const result = type === 'text' ? { id: 'r', index: 0, type, content: '正文' } : { ...image('r'), type, url: 'blob:preview' };
    const state = commitCanvasResultBatch(createCanvasNodeResults(), batch(type, [result]));
    const projection = projectCanvasCurrentResult(state);
    assert.deepEqual(projection, type === 'text' ? { asset: null, content: '正文' }
      : { asset: { asset_id: assetId, asset_type: 'video' }, content: '' });
    assert.ok(!JSON.stringify(state).includes('blob:'));
  }
});

test('全部历史资产必须合法，非当前结果非法也拒绝', () => {
  const state = commitCanvasResultBatch(initial(), batch('second'));
  state.batches[0].results[0].assetId = 'https://example.test/image';
  assert.throws(() => collectCanvasResultAssetIds(state), /永久资产编号/);
  assert.throws(() => normalizeCanvasResultBatch(batch('url-only', [{ id: 'r', index: 0, type: 'image', url: 'blob:preview' }])), /永久资产编号/);
});

test('索引、身份、类型、时间与悬空当前引用校验', () => {
  for (const results of [[image('a', -1)], [image('a', 1)], [image('a'), image('b')]]) {
    assert.throws(() => normalizeCanvasResultBatch(batch('bad', results)), /索引/);
  }
  assert.throws(() => normalizeCanvasResultBatch(batch('https://bad')), /身份/);
  assert.throws(() => normalizeCanvasResultBatch(batch('bad', undefined, { completedAt: 1 })), /时间/);
  assert.throws(() => normalizeCanvasResultBatch(batch('bad', undefined, { submittedAt: null })), /时间/);
  assert.throws(() => validateCanvasNodeResults({ ...initial(), currentResultId: 'missing' }), /引用/);
  assert.throws(() => commitCanvasResultBatch(initial(), batch('text', [{ id: 't', index: 0, type: 'text', content: '正文' }])), /类型/);
});

test('快照深复制且纯JSON，循环、危险键、访问器和地址身份拒绝', () => {
  const snapshot = { inputs: [{ resultId: 'upstream-result', assetId }], params: { count: 1 } };
  const state = commitCanvasResultBatch(createCanvasNodeResults(), batch('snapshot', undefined, { snapshot }));
  snapshot.params.count = 9;
  assert.equal(state.batches[0].snapshot.params.count, 1);
  const cycle = {}; cycle.self = cycle;
  for (const invalid of [cycle, JSON.parse('{"__proto__":{}}'), { constructor: 'bad' },
    { resultId: 'https://example.test' }, { assetIds: ['blob:local'] }, { nested: { previewUrl: 'https://example.test' } },
    { controller: {} }, { date: new Date() }, { value: Infinity }, { callback: () => {} },
    Object.defineProperty({}, 'value', { enumerable: true, get() { throw new Error('不应执行'); } }),
  ]) assert.throws(() => normalizeCanvasResultBatch(batch('invalid', undefined, { snapshot: invalid })));
  assert.doesNotThrow(() => normalizeCanvasResultBatch(batch('prompt', undefined, { snapshot: { prompt: '分析 https://example.test' } })));
});

test('旧素材与正文迁移不伪造生成任务或时间，空节点仍为空', () => {
  for (const type of ['image', 'video', 'text']) {
    const data = type === 'text' ? { content: '旧正文' } : { asset: { asset_id: assetId, url: 'https://example.test' } };
    const state = migrateLegacyCanvasResults({ type, data }, { batchId: 'legacy', resultId: 'legacy-result' });
    assert.equal(state.batches[0].source, 'legacy');
    assert.equal(state.batches[0].submittedAt, null);
    assert.deepEqual(state.batches[0].taskIds, []);
    assert.equal(state.batches[0].snapshot, null);
    assert.deepEqual(migrateLegacyCanvasResults({ type, data: {} }), createCanvasNodeResults());
  }
  assert.throws(() => migrateLegacyCanvasResults({ type: 'image', data: { asset: { url: 'blob:legacy' } } }, { batchId: 'legacy', resultId: 'r' }), /永久资产编号/);
});

test('复制全历史独立且剥离运行态，保留历史任务出处', () => {
  const state = commitCanvasResultBatch(initial(), batch('second', undefined, { taskIds: ['server-task'], snapshot: { params: { count: 1 } } }));
  state.task = { id: 'live' }; state.generating = true;
  state.batches[1].controller = new AbortController();
  state.batches[1].results[0].url = 'blob:live';
  const copied = cloneCanvasNodeResults(state);
  assert.equal(copied.task, undefined);
  assert.equal(copied.generating, undefined);
  assert.equal(copied.batches[1].controller, undefined);
  assert.equal(copied.batches[1].results[0].url, undefined);
  assert.deepEqual(copied.batches[1].taskIds, ['server-task']);
  copied.batches[1].snapshot.params.count = 7;
  copied.selections[0].reason = 'select';
  assert.equal(state.batches[1].snapshot.params.count, 1);
  assert.equal(state.selections[0].reason, 'success');
  assert.deepEqual(migrateLegacyCanvasResults({ type: 'image', data: { nodeResults: state } }), cloneCanvasNodeResults(state));
});

test('状态拒绝失败项注入，读取、资产校验与复制保持一致', () => {
  const text = commitCanvasResultBatch(createCanvasNodeResults(), batch('text', [{ id: 'r', index: 0, type: 'text', content: '正文' }]));
  text.batches[0].results[0].assetId = 'bad';
  assert.deepEqual(collectCanvasResultAssetIds(text), []);
  assert.deepEqual(getCanvasCurrentResult(text), cloneCanvasNodeResults(text).batches[0].results[0]);
  const state = commitCanvasResultBatch(createCanvasNodeResults(), batch('partial', [image('r')], { requestedCount: 2 }));
  state.batches[0].results.unshift({ id: 'r', index: 1, status: 'failed', type: 'image', assetId: 'bad' });
  for (const read of [validateCanvasNodeResults, getCanvasCurrentResult, projectCanvasCurrentResult, collectCanvasResultAssetIds, cloneCanvasNodeResults]) {
    assert.throws(() => read(state), /成功结果/);
  }
});

test('仅图片生成允许请求多结果，其他来源和媒体类型拒绝', () => {
  for (const source of ['upload', 'edit', 'legacy']) {
    assert.throws(() => normalizeCanvasResultBatch(batch('multi', [image('r')], { source, requestedCount: 2 })), /仅图片生成/);
  }
  for (const type of ['text', 'video']) {
    const result = type === 'text' ? { id: 'r', index: 0, type, content: '正文' } : { ...image('r'), type };
    assert.throws(() => normalizeCanvasResultBatch(batch('partial', [result], { requestedCount: 2 })), /仅图片生成/);
    assert.throws(() => normalizeCanvasResultBatch(batch('complete', [result, { ...result, id: 'r2', index: 1 }], { requestedCount: 2 })), /仅图片生成/);
  }
});

test('已有结果同样检查节点类型，旧正文类型错误明确报告', () => {
  for (const type of [undefined, 'audio', 'text', 'video']) {
    assert.throws(() => migrateLegacyCanvasResults({ type, data: { nodeResults: initial() } }), /类型/);
  }
  for (const content of [null, 3, {}, []]) {
    assert.throws(() => migrateLegacyCanvasResults({ type: 'text', data: { content } }), /旧文本正文必须是字符串/);
  }
});

test('快照数组拒绝访问器、迭代器、稀疏、额外属性与循环且不执行用户代码', () => {
  let calls = 0;
  const getter = Object.defineProperty([], '0', { enumerable: true, get() { calls += 1; return 'value'; } });
  const iterator = ['value'];
  iterator[Symbol.iterator] = () => { calls += 1; throw new Error('不应执行'); };
  const extra = ['value']; extra.extra = true;
  const hidden = ['value']; Object.defineProperty(hidden, 'hidden', { value: true });
  const cycle = []; cycle.push(cycle);
  for (const values of [getter, iterator, new Array(1), extra, hidden, cycle]) {
    assert.throws(() => normalizeCanvasResultBatch(batch('array', undefined, { snapshot: { values } })), /执行快照/);
  }
  assert.equal(calls, 0);
  const shared = { resultId: 'r' };
  const normalized = normalizeCanvasResultBatch(batch('dense', undefined, { snapshot: { values: [shared, shared] } }));
  assert.deepEqual(normalized.snapshot.values, [shared, shared]);
  assert.notStrictEqual(normalized.snapshot.values[0], normalized.snapshot.values[1]);
});
