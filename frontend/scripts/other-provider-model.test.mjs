import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { applyModelResult, validateModelResult } from '../src/utils/ModelConfigState.js';
const entity = (id, fields = {}) => ({ id, provider_id: 'p', category: 'chat', name: id, model_id: id, is_enabled: true, is_default: false, ...fields });
const source = readFileSync(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('  const beginOtherModelMutation ='), source.indexOf('  const saveOneLinkConfig ='));
function fixture({ locks = new Map(), configured = true } = {}) {
  let scope = 0, auth = 0;
  let state = { activeOtherProviderId: 'p', activeModelTab: 'chat', otherProviders: [{ id: 'p', cardKey: 'vendor', configured }],
    editProviderModelsByTab: { chat: [{ id: 'a', enabled: true, isDefault: true }, { id: 'b', enabled: false }] },
    editProviderModelDraft: { name: '', identifier: 'new', note: '' }, childView: 'edit-other-provider-model' };
  const calls = [], messages = [], tests = new Set(), revision = { current: 0 };
  const request = kind => (...args) => new Promise((resolve, reject) => calls.push({ kind, args, resolve: value => resolve(kind === 'update' ? entity(args[0], { is_enabled: args[0] === 'a', is_default: args[0] === 'a', ...args[1] }) : kind === 'create' ? entity(value.id) : value), reject }));
  const bindings = { applyModelResult, validateModelResult, pendingOtherModels: () => [], state, otherModelPending: locks, providerTestPending: tests, providerEnableQueue: { has: () => false },
    getAuthSessionGeneration: () => auth, modelRevision: revision,
    captureModelScope: () => { const s = scope, a = auth; return () => s === scope && a === auth; },
    apiUpdateModel: request('update'), apiDeleteModel: request('delete'), apiCreateModel: request('create'),
    setState: fn => { state = fn(state); }, showToast: (...args) => messages.push(args),
    getTabCategory: x => x, sortModels: x => x, createEmptyModelDraft: () => ({}), MODEL_DESCRIPTION: '' };
  const actions = new Function(...Object.keys(bindings), body + '; return { mutateOtherProviderModel, addEditProviderModelWithValidation };')(...Object.values(bindings));
  return { calls, messages, locks, tests, revision, state: () => state,
    close: () => scope++, switchAccount: () => auth++, changeProvider: () => { scope++; state = { ...state, activeOtherProviderId: 'q' }; },
    edit: () => { state = { ...state, editProviderModelDraft: { identifier: 'later' } }; },
    mutate: actions.mutateOtherProviderModel,
    run: action => action === 'add' ? actions.addEditProviderModelWithValidation() : actions.mutateOtherProviderModel('a', action) };
}
for (const action of ['toggle', 'default', 'delete', 'add']) {
  test(action + '：等待期间不更新，重复点击只发一次，失败保留状态并释放锁', async () => {
    const f = fixture(), before = f.state(), done = f.run(action); await f.run(action);
    assert.equal(f.calls.length, 1); assert.equal(f.state(), before);
    f.calls[0].reject(new Error()); await done;
    assert.equal(f.state(), before); assert.equal(f.locks.size, 0); assert.match(f.messages.at(-1)[1], /未能确认/);
    const retry = f.run(action); f.calls[1].resolve({ id: 'new' }); await retry; assert.notEqual(f.state(), before);
  });
  for (const boundary of ['close', 'switchAccount', 'changeProvider']) {
    test(action + '：' + boundary + ' 后迟到结果不写入、不清草稿、不显示旧提示', async () => {
      const f = fixture(), done = f.run(action); f[boundary](); const before = f.state();
      f.calls[0].resolve({ id: 'new' }); await done;
      assert.equal(f.state(), before); assert.equal(f.messages.length, 0); assert.equal(f.locks.size, 0);
    });
  }
}
test('取消默认只清除目标默认，保留其他模型状态', async () => {
  const f = fixture(), done = f.run('default'); f.calls[0].resolve({}); await done;
  assert.equal(f.state().editProviderModelsByTab.chat[0].isDefault, false);
  assert.equal(f.state().editProviderModelsByTab.chat[1].enabled, false);
});
test('跨弹窗共享锁防止同服务商重复新增，旧请求结束才可再提交', async () => {
  const locks = new Map(), old = fixture({ locks }), latest = fixture({ locks });
  const done = old.run('add'); old.close(); await latest.run('add'); assert.equal(latest.calls.length, 0);
  old.calls[0].resolve({ id: 'new' }); await done;
  const next = latest.run('add'); latest.calls[0].resolve({ id: 'new2' }); await next;
  assert.equal(latest.state().editProviderModelsByTab.chat.at(-1).id, 'new2');
});
test('提交期间继续编辑草稿，成功不清除后续输入、不跳转', async () => {
  const f = fixture(), done = f.run('add'); f.edit(); f.calls[0].resolve({ id: 'new' }); await done;
  assert.deepEqual(f.state().editProviderModelDraft, { identifier: 'later' });
  assert.equal(f.state().childView, 'edit-other-provider-model');
});
test('未配置服务商及保存测试在途不能提交模型', async () => {
  const f = fixture({ configured: false }); await f.run('add'); assert.equal(f.calls.length, 0);
  const g = fixture(); g.tests.add('0:vendor'); await g.run('toggle'); assert.equal(g.calls.length, 0);
});
test('设置停用模型为默认时自动启用并清除旧默认，停用默认模型时清除默认', async () => {
  const f = fixture(), done = f.mutate('b', 'default');
  assert.deepEqual(f.calls[0].args, ['b', { is_default: true, is_enabled: true }]);
  f.calls[0].resolve({}); await done;
  assert.deepEqual(f.state().editProviderModelsByTab.chat.map(m => [m.enabled, m.isDefault]), [[true, false], [true, true]]);
  const g = fixture(), disable = g.run('toggle');
  assert.deepEqual(g.calls[0].args, ['a', { is_enabled: false, is_default: false }]);
  g.calls[0].resolve({}); await disable; assert.equal(g.state().editProviderModelsByTab.chat[0].isDefault, false);
});
