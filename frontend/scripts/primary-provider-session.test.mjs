import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyModelResult, validateModelResult } from '../src/utils/ModelConfigState.js';
const entity = (id, fields = {}) => ({ id, provider_id: 'p', category: 'chat', name: id, model_id: id, is_enabled: true, is_default: false, ...fields });
const source = readFileSync(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(fromServer = false) {
  let scope = 0, auth = 0;
  let state = { onelinkKeyIsFromServer: fromServer, onelinkProviderId: 'p', onelinkApiKeyActual: '模拟密钥',
    apiTested: true, activeModelTab: 'chat', onelinkModelDraft: { identifier: 'old', name: '', note: '' },
    onelinkModelsByTab: { chat: [{ id: 'a', enabled: true }] } };
  const pending = [], messages = [], refreshes = [];
  const locks = new Function('getAuthSessionGeneration', section('const primaryPending =', 'const providerEnableQueue =')
    + '; return { getPrimaryPending, acquirePrimaryRequest };')(() => auth);
  const call = kind => (...args) => new Promise((resolve, reject) => pending.push({ kind, args, resolve: value => resolve(kind === 'update' ? entity(args[0], args[1]) : kind === 'create' ? entity(value.id) : value), reject }));
  let refresh;
  const bindings = { applyModelResult, validateModelResult, pendingOtherModels: () => [], ...locks, useCallback: fn => fn, oneLinkTestRequest: { current: 0 }, primaryMutation: { current: null },
    modelRevision: { current: 0 }, modelScope: { get current() { return scope; }, set current(v) { scope = v; } },
    providerEnableQueue: { has: () => false }, captureModelScope: () => { const s = scope, a = auth; return () => scope === s && auth === a; },
    setState: fn => { state = fn(state); }, showToast: (...args) => messages.push(args),
    apiTestConnection: call('test'), apiOneClickSetup: call('setup'), apiUpdateModel: call('update'),
    apiDeleteModel: call('delete'), apiCreateModel: call('create'), getTabCategory: v => v, sortModels: v => v,
    MODEL_DESCRIPTION: '', createEmptyModelDraft: () => ({ identifier: '', name: '', note: '' }), onConfigured() {},
    loadModelsFromBackend: (...args) => { refreshes.push(args); return new Promise((resolve, reject) => { refresh = { resolve, reject }; }); } };
  const get = (start, end, name) => { const b = { ...bindings, state };
    return new Function(...Object.keys(b), section(start, end) + '; return ' + name)(...Object.values(b)); };
  return { pending, messages, refreshes, state: () => state, locks,
    run: () => get('  const testConnection =', '  const requestDelete =', 'testConnection')(),
    mutate: () => get('  const mutateOnelinkModel =', '  // const setDefaultCustomProviderModel', 'mutateOnelinkModel')('a', 'toggle'),
    add: () => get('  const addOnelinkModelWithValidation =', '  // const addCustomProviderModel =', 'addOnelinkModelWithValidation')(),
    save: () => get('  const saveOneLinkConfig =', '  // const saveCustomProviderModelConfig', 'saveOneLinkConfig')(),
    close: () => { scope++; bindings.oneLinkTestRequest.current++; }, account: () => auth++,
    input: () => { bindings.oneLinkTestRequest.current++; }, edit: draft => { state = { ...state, onelinkModelDraft: draft }; },
    refresh: () => refresh };
}
test('重复测试和模型写入互斥，补读完成前保存不会退出', async () => {
  const f = fixture(), task = f.run(); await f.run(); await f.mutate(); f.save();
  assert.equal(f.pending.length, 1); assert.equal(f.state().childView, undefined);
  f.pending[0].resolve({ test_success: true, provider: { id: 'fresh' } }); await tick();
  assert.equal(f.refreshes[0][0], 'fresh'); assert.ok(f.locks.getPrimaryPending());
  f.save(); assert.equal(f.state().childView, undefined);
  f.refresh().resolve(); await task; assert.equal(f.locks.getPrimaryPending(), undefined);
  f.save(); assert.equal(f.state().childView, null);
});
for (const invalidate of ['close', 'account', 'input']) {
  for (const fail of [false, true]) {
    test('测试迟到结果隔离：' + invalidate + (fail ? '失败' : '成功'), async () => {
      const f = fixture(), task = f.run(); f[invalidate](); const before = f.state();
      if (fail) f.pending[0].reject(new Error('模拟异常'));
      else f.pending[0].resolve({ test_success: true, provider: { id: 'p' } });
      await task; assert.equal(f.state(), before); assert.equal(f.messages.length, 0); assert.equal(f.refreshes.length, 0);
    });
  }
}
test('关闭再进入仍拦截重复配置，切账号可独立请求，旧结束不释放新锁', async () => {
  const f = fixture(), old = f.run(); f.close(); await f.run(); assert.equal(f.pending.length, 1);
  f.account(); const next = f.run(); assert.equal(f.pending.length, 2);
  f.pending[0].resolve({}); await old; assert.ok(f.locks.getPrimaryPending());
  f.pending[1].resolve({ test_success: false, provider: { id: 'p' } }); await next;
  assert.equal(f.locks.getPrimaryPending(), undefined);
});
test('一键配置仅采用正式字段，异常编号或缺结果不显示通过', async () => {
  for (const response of [{ test_success: true }, { test_success: true, provider: { id: ' ' } },
    { success: true, provider: { id: 'p' } }, { success: true, test_success: false, provider: { id: 'p' } }]) {
    const f = fixture(), task = f.run(); f.pending[0].resolve(response); await task;
    assert.equal(f.state().apiTested, false); assert.equal(f.refreshes.length, 0); assert.equal(f.messages.at(-1)[0], 'error');
  }
});
test('已存密钥走独立测试，严格按 success 判定', async () => {
  for (const response of [{ success: true }, { test_success: true }, {}]) {
    const f = fixture(true), task = f.run(); assert.equal(f.pending[0].kind, 'test');
    f.pending[0].resolve(response); await task; assert.equal(f.state().apiTested, response.success === true);
  }
});
test('模型补读失败单独提示，通过结果保留且释放锁', async () => {
  const f = fixture(), task = f.run(); f.pending[0].resolve({ test_success: true, provider: { id: 'p' } }); await tick();
  f.refresh().reject(new Error('模拟断网')); await task;
  assert.equal(f.state().apiTested, true); assert.match(f.messages.at(-1)[1], /模型列表读取失败/);
  assert.equal(f.locks.getPrimaryPending(), undefined);
});
test('补读期间输入失效后不发旧成功提示，等待者在请求结束释放', async () => {
  const f = fixture(), task = f.run(); f.pending[0].resolve({ test_success: true, provider: { id: 'p' } }); await tick();
  let completed = false; const waiting = f.locks.getPrimaryPending().done.then(() => { completed = true; });
  f.input(); assert.equal(f.refreshes[0][1](), false); assert.equal(completed, false);
  f.refresh().resolve(); await task; await waiting; assert.equal(completed, true); assert.equal(f.messages.length, 0);
});
test('模型写入中测试及保存不抢占会话，确认后再保存', async () => {
  const f = fixture(), task = f.mutate(); await f.run(); f.save(); assert.equal(f.pending.length, 1);
  f.pending[0].resolve({}); await task; assert.equal(f.state().onelinkModelsByTab.chat[0].enabled, false);
  f.save(); assert.equal(f.state().childView, null);
});
test('新增保留提交后草稿，关闭后旧成功不清新内容', async () => {
  for (const close of [false, true]) {
    const f = fixture(), task = f.add(), draft = { identifier: 'new', name: '', note: '' };
    f.edit(draft); if (close) f.close(); f.pending[0].resolve({ id: 'created' }); await task;
    assert.equal(f.state().onelinkModelDraft, draft); assert.equal(f.state().childView, undefined);
    assert.equal(f.state().onelinkModelsByTab.chat.length, close ? 1 : 2);
  }
});
