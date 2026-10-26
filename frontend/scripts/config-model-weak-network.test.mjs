import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyModelResult, validateModelResult } from '../src/utils/ModelConfigState.js';
const entity = (id, fields = {}) => ({ id, provider_id: 'p', category: 'chat', name: id, model_id: id, is_enabled: true, is_default: false, ...fields });

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('src/components/ApiConfigModal.jsx');
const primarySource = source.slice(source.indexOf('const primaryPending ='), source.indexOf('const providerEnableQueue ='));
function primaryBindings(getAuthSessionGeneration) {
  return new Function('getAuthSessionGeneration', primarySource + '; return { getPrimaryPending, acquirePrimaryRequest };')(getAuthSessionGeneration);
}
const body = source.slice(source.indexOf('  const mutateOnelinkModel ='), source.indexOf('  // const setDefaultCustomProviderModel'));
function fixture() {
  let scope = 0, auth = 0;
  let state = { activeModelTab: 'chat', onelinkProviderId: 'p', onelinkModelsByTab: { chat: [
    { id: 'a', enabled: true, isDefault: true }, { id: 'b', enabled: false, isDefault: false },
  ] } };
  const pending = [], messages = [];
  const bindings = {
    ...primaryBindings(() => auth), providerEnableQueue: { has: () => false },
    applyModelResult, validateModelResult, getTabCategory: x => x, pendingOtherModels: () => [],
    state, primaryMutation: { current: null }, modelRevision: { current: 0 },
    captureModelScope: () => { const s = scope, a = auth; return () => scope === s && auth === a; },
    apiDeleteModel: id => new Promise((resolve, reject) => pending.push({ id, resolve, reject })),
    apiUpdateModel: (id, update) => new Promise((resolve, reject) => pending.push({ id, update, resolve: () => resolve(entity(id, { is_default: id === 'a', is_enabled: id === 'a', ...update })), reject })),
    setState: fn => { state = fn(state); }, sortModels: list => list,
    showToast: (...args) => messages.push(args),
  };
  const run = new Function(...Object.keys(bindings), body + '; return mutateOnelinkModel;')(...Object.values(bindings));
  return { run, pending, messages, state: () => state, close: () => scope++, switchAccount: () => auth++ };
}
for (const action of ['delete', 'toggle', 'default']) {
  test(action + '：请求未完成或失败时保留列表，允许重试', async () => {
    const f = fixture(), before = f.state(), task = f.run('a', action);
    await f.run('a', action); assert.equal(f.pending.length, 1);
    assert.equal(f.state(), before);
    f.pending[0].reject(new Error('断网')); await task;
    assert.equal(f.state(), before); assert.equal(f.messages.at(-1)[0], 'error');
    const retry = f.run('a', action); f.pending[1].resolve({}); await retry;
    assert.notEqual(f.state(), before);
  });
  for (const invalidate of ['close', 'switchAccount']) {
    test(action + '：' + invalidate + ' 后旧结果不写回或释放新请求锁', async () => {
      const f = fixture(), before = f.state(), old = f.run('a', action);
      f[invalidate]();
      if (invalidate === 'close') {
        await f.run('b', action); assert.equal(f.pending.length, 1);
        f.pending[0].resolve({}); await old; assert.equal(f.state(), before);
        const latest = f.run('b', action); f.pending[1].resolve({}); await latest;
        return;
      }
      const latest = f.run('b', action);
      f.pending[0].resolve({}); await old;
      assert.equal(f.state(), before);
      await f.run('a', action); assert.equal(f.pending.length, 2);
      f.pending[1].resolve({}); await latest;
      assert.equal(f.messages.some(message => message[0] === 'error'), false);
    });
  }
}
test('关闭启用时清除默认；设默认时自动启用并清除旧默认', async () => {
  const f = fixture(), task = f.run('a', 'toggle');
  assert.deepEqual(f.pending[0].update, { is_enabled: false, is_default: false });
  f.pending[0].resolve({}); await task;
  assert.equal(f.state().onelinkModelsByTab.chat[0].isDefault, false);
  const g = fixture(), next = g.run('b', 'default');
  assert.deepEqual(g.pending[0].update, { is_default: true, is_enabled: true });
  g.pending[0].resolve({}); await next;
  assert.deepEqual(g.state().onelinkModelsByTab.chat.map(m => [m.enabled, m.isDefault]), [[true, false], [true, true]]);
});
const apiSource = read('src/api/config.js');
test('主模型读取：成功空列表清空，失败保留，迟到读取不覆盖写入', async () => {
  const readBody = source.slice(source.indexOf('  const loadModelsFromBackend ='), source.indexOf('  const initializeFromBackend ='));
  let state = { onelinkProviderId: 'p', onelinkModelsByTab: { chat: [{ id: 'old' }] } };
  let active = true;
  const pending = [], messages = [], revision = { current: 0 };
  const bindings = { useCallback: fn => fn, primaryMutation: { current: null }, modelRevision: revision,
    captureModelScope: () => () => active,
    apiListModels: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    setState: fn => { state = fn(state); }, createEmptyModelsByTab: () => ({ chat: [] }),
    getCategoryTab: value => value, sortModels: value => value, MODEL_DESCRIPTION: '',
    showToast: (...args) => messages.push(args), console: { error() {} } };
  const run = new Function(...Object.keys(bindings), readBody + '; return loadModelsFromBackend;')(...Object.values(bindings));
  const tick = () => new Promise(resolve => setImmediate(resolve));
  run(); pending[0].reject(new Error('断网')); await tick();
  assert.equal(state.onelinkModelsByTab.chat[0].id, 'old'); assert.equal(messages.length, 1);
  run(); revision.current++; pending[1].resolve([]); await tick();
  assert.equal(state.onelinkModelsByTab.chat[0].id, 'old');
  run(); pending[2].resolve([]); await tick(); assert.deepEqual(state.onelinkModelsByTab.chat, []);
  run(); active = false; pending[3].reject(new Error('迟到失败')); await tick();
  assert.equal(messages.length, 1);
});
test('主模型新增：重复提交拦截，关闭后不插入或重开弹窗', async () => {
  const addBody = source.slice(source.indexOf('  const addOnelinkModelWithValidation ='), source.indexOf('  // const addCustomProviderModel ='));
  let active = true;
  const pending = [], writes = [], messages = [];
  const bindings = { state: { onelinkModelDraft: { identifier: 'model', name: '', note: '' }, activeModelTab: 'chat', onelinkProviderId: 'p' },
    ...primaryBindings(() => 0), providerEnableQueue: { has: () => false },
    pendingOtherModels: () => [], applyModelResult, validateModelResult,
    primaryMutation: { current: null }, modelRevision: { current: 0 }, captureModelScope: () => () => active,
    getTabCategory: value => value, apiCreateModel: () => new Promise(resolve => pending.push(resolve)),
    setState: fn => writes.push(fn), showToast: (...args) => messages.push(args),
    MODEL_DESCRIPTION: '', sortModels: value => value, createEmptyModelDraft: () => ({}) };
  const run = new Function(...Object.keys(bindings), addBody + '; return addOnelinkModelWithValidation;')(...Object.values(bindings));
  const task = run(); await run(); assert.equal(pending.length, 1);
  active = false; pending[0]({ id: 'new' }); await task;
  assert.equal(writes.length, 0); assert.equal(messages.some(message => message[0] === 'error' || message[0] === 'success'), false);
});
const apiBody = apiSource.slice(apiSource.indexOf('export async function apiListModels'), apiSource.indexOf('export async function apiUpdateModel')).replaceAll('export ', '');
function apiFixture(ok, data) {
  return new Function('authFetch', 'BASE', 'invalidate', 'cached', 'K', 'TTL', 'MEDIUM', apiBody + '; return { apiListModels, apiCreateModel };')(
    async () => ({ ok, json: async () => data }), '', () => {}, async (_key, fn) => fn(),
    { models: () => 'models' }, { STATIC: 1 }, { STATIC: 1 });
}
test('读取和新增的错误状态抛错，不冒充空列表或成功', async () => {
  for (const data of [{ message: '错误' }, []]) {
    const api = apiFixture(false, data);
    await assert.rejects(api.apiListModels({ fresh: true }));
    await assert.rejects(api.apiCreateModel({}));
  }
});
test('合法空列表和兼容列表成功；异常响应及无编号新增抛错', async () => {
  for (const data of [[], { items: [] }, { models: [] }]) {
    assert.deepEqual(await apiFixture(true, data).apiListModels(), []);
  }
  for (const data of [null, {}, { message: '错误' }]) {
    const api = apiFixture(true, data);
    await assert.rejects(api.apiListModels()); await assert.rejects(api.apiCreateModel({}));
  }
  assert.deepEqual(await apiFixture(true, { id: 'm' }).apiCreateModel({}), { id: 'm' });
});
