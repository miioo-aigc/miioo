import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture({ queue = { hasPending: () => false }, mutations = () => [] } = {}) {
  let generation = 0, state = { otherProviders: [] };
  const reads = [], statuses = [], messages = [];
  const modelScope = { current: 0 };
  const bindings = {
    useCallback: fn => fn, getToken: () => 'test',
    captureModelScope: () => { const g = generation, s = modelScope.current; return () => g === generation && s === modelScope.current; },
    modelScope, modelRevision: { current: 0 }, initializationRequest: { current: null }, otherProviderRequest: { current: null },
    providerEnableQueue: queue, pendingOtherModels: mutations,
    otherModelPending: new Map(), getAuthSessionGeneration: () => generation,
    setReadStatus: value => statuses.push(value), setBannerData() {},
    apiGetBanner: () => new Promise(() => {}), apiGetCardVisibility: async () => [],
    apiListProviders: () => { const d = deferred(); reads.push(d); return d.promise; },
    apiListModels: () => { const d = deferred(); reads.push(d); return d.promise; },
    createDefaultState: () => ({ onelinkCreatedAt: '---' }), createEmptyModelsByTab: () => ({ chat: [] }), createEmptyModelDraft: () => ({}),
    MODEL_TABS: ['chat'], CARD_KEY_NAMES: {}, MODEL_DESCRIPTION: '', getCategoryTab: value => value, sortModels: value => value,
    setState: fn => { state = fn(state); }, showToast: (...args) => messages.push(args), console: { warn() {} },
  };
  const extract = (start, end, name, extras = {}) => {
    const values = { ...bindings, ...extras };
    return new Function(...Object.keys(values), source.slice(source.indexOf(start), source.indexOf(end)) + '; return ' + name)(...Object.values(values));
  };
  return { reads, statuses, messages, state: () => state, close: () => modelScope.current++, switchAccount: () => generation++,
    initialize: extract('  const initializeFromBackend =', '  const testConnection =', 'initializeFromBackend'),
    open: extract('  const openOtherProviderConfig =', '  // 通过 card_key', 'openOtherProviderConfig', { readStatus: 'ready', state: { otherProviders: [{ id: 'a', configured: true }, { id: 'b', configured: true }] } }),
  };
}
test('关闭重开时等待服务商队列确认后再读取卡片状态', async () => {
  const waiting = deferred();
  const f = fixture({ queue: { hasPending: () => true, wait: () => waiting.promise } });
  f.initialize(); assert.equal(f.reads.length, 1);
  waiting.resolve(); await tick(); assert.equal(f.reads.length, 2);
  f.reads[0].resolve([]); f.reads[1].resolve([]); await tick(); assert.equal(f.statuses.at(-1), 'ready');
});
test('重开时等待其他服务商模型写入结束，再读取模型及服务商', async () => {
  const waiting = deferred();
  const f = fixture({ queue: { hasPending: () => false, wait: async () => {} }, mutations: () => [waiting.promise] });
  f.initialize(); assert.equal(f.reads.length, 0);
  waiting.resolve(); await tick(); assert.equal(f.reads.length, 2);
  f.reads[0].resolve([]); f.reads[1].resolve([]); await tick(); assert.equal(f.statuses.at(-1), 'ready');
});
test('初始化的等待集合实际包含当前账号主服务商请求，隔离其他账号', async () => {
  const body = source.slice(source.indexOf('const primaryPending ='), source.indexOf('const TAB_SLIDE_DURATION ='));
  let generation = 0;
  const values = new Function('getAuthSessionGeneration', 'createProviderEnableQueue', 'apiUpdateProvider', 'apiListProviders', 'otherModelPending',
    body + '; return { pendingOtherModels, acquirePrimaryRequest };')(() => generation, () => ({}), () => {}, () => {}, new Map());
  const request = values.acquirePrimaryRequest(() => true);
  assert.deepEqual(values.pendingOtherModels(), [request.done]);
  generation++; assert.deepEqual(values.pendingOtherModels(), []);
  generation--; request.finish(); await request.done; assert.deepEqual(values.pendingOtherModels(), []);
});
test('初始化关键请求失败显示错误、不发布空配置，重试成功且不等广告', async () => {
  const f = fixture(); f.initialize(); f.initialize(); assert.equal(f.reads.length, 2);
  f.reads[0].reject(new Error('断网')); f.reads[1].resolve([]); await tick();
  assert.deepEqual(f.statuses, ['loading', 'error']); assert.deepEqual(f.state(), { otherProviders: [] });
  f.initialize(); f.reads[2].resolve([]); f.reads[3].resolve([]); await tick();
  assert.equal(f.statuses.at(-1), 'ready'); assert.equal(f.state().mainConfigured, false);
});
test('初始化异常结构不当空配置', async () => {
  const f = fixture(); f.initialize(); f.reads[0].resolve({}); f.reads[1].resolve([]); await tick();
  assert.equal(f.statuses.at(-1), 'error');
});
for (const action of ['close', 'switchAccount']) {
  test('初始化迟到结果失效：' + action, async () => {
    const f = fixture(); f.initialize(); f[action]();
    f.reads[0].resolve([]); f.reads[1].resolve([]); await tick();
    assert.deepEqual(f.statuses, ['loading']);
  });
  test('其他服务商迟到结果不打开弹窗：' + action, async () => {
    const f = fixture(); f.open('a'); f[action](); f.reads[0].resolve([]); await tick();
    assert.equal(f.state().childView, undefined);
  });
}
test('空模型也能打开，重复点击不重复请求，切换服务商只采用最新响应', async () => {
  const f = fixture(); f.open('a'); f.open('a'); assert.equal(f.reads.length, 1);
  f.open('b'); f.reads[1].resolve([]); await tick();
  assert.equal(f.state().activeOtherProviderId, 'b');
  f.reads[0].resolve([]); await tick();
  assert.equal(f.state().activeOtherProviderId, 'b');
  assert.equal(f.state().childView, 'other-provider-config');
});
test('其他服务商失败提示且允许再次点击重试', async () => {
  const f = fixture(); f.open('a'); f.reads[0].reject(new Error('断网')); await tick();
  assert.equal(f.messages.length, 1); assert.equal(f.state().childView, undefined);
  f.open('a'); f.reads[1].resolve([]); await tick(); assert.equal(f.state().activeOtherProviderId, 'a');
});
test('读取状态接入现有反馈，关闭主弹窗卸载会话', () => {
  assert.ok(source.includes("readStatus !== 'ready' ? ("));
  assert.match(source, /<RemoteReadStatus/);
  assert.ok(source.includes('return <ApiConfigSession'));
});
