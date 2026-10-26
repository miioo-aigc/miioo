import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('  const runOtherProviderTest ='), source.indexOf('  const beginOtherModelMutation ='));
function fixture({ configured = true, saved = false, pending = new Set() } = {}) {
  let active = true;
  let state = { otherProviders: [{ id: 'p', cardKey: 'vendor', configured }], activeOtherProviderId: 'p',
    editProviderApiKeyActual: 'test-key', editProviderApiKey: 'masked', editProviderKeyIsFromServer: saved,
    editProviderApiTested: true, editProviderModelsByTab: { chat: [{ id: 'old' }] } };
  const calls = [], messages = [], input = { current: 0 }, revision = { current: 0 };
  const request = kind => (...args) => new Promise((resolve, reject) => calls.push({ kind, args, resolve, reject }));
  const bindings = { state, providerTestPending: pending, getAuthSessionGeneration: () => 0,
    modelRevision: revision, otherModelPending: new Map(),
    captureModelScope: () => () => active, providerInputRevision: input,
    setState: fn => { state = fn(state); }, showToast: (...args) => messages.push(args),
    apiUpdateProvider: request('save'), apiCreateProvider: request('create'), apiTestConnection: request('test'), apiListModels: request('models'),
    createEmptyModelsByTab: () => ({ chat: [] }), getCategoryTab: x => x, sortModels: x => x, MODEL_DESCRIPTION: '' };
  const run = new Function(...Object.keys(bindings), body + '; return runOtherProviderTest;')(...Object.values(bindings));
  return { run, calls, messages, revision, state: () => state, invalidate: () => { active = false; }, edit: () => input.current++ };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('连接测试的迟到模型补读不覆盖更新版本', async () => {
  const f = fixture({ saved: true }), task = f.run('p');
  f.calls[0].resolve({ success: true }); await tick();
  f.revision.current++; f.calls[1].resolve([]); await task;
  assert.equal(f.state().editProviderModelsByTab.chat[0].id, 'old');
  assert.equal(f.state().editProviderApiTested, true);
  assert.match(f.messages.at(-1)[1], /保留当前列表/);
});
test('保存失败立即停止，不测试旧密钥、不保留通过状态', async () => {
  const f = fixture(), task = f.run('p');
  f.calls[0].reject(new Error('断网')); await task;
  assert.deepEqual(f.calls.map(c => c.kind), ['save']);
  assert.equal(f.state().editProviderApiTested, false);
  assert.match(f.messages[0][1], /保存结果未能确认/);
});
for (const result of [{ success: false }, {}, { test_success: true }, null]) {
  test('非明确成功不能通过：' + JSON.stringify(result), async () => {
    const f = fixture({ saved: true }), task = f.run('p');
    f.calls[0].resolve(result); await task;
    assert.equal(f.state().editProviderApiTested, false); assert.equal(f.messages[0][0], 'error');
  });
}
test('新建成功使用真实编号测试，合法空列表清空旧数据', async () => {
  const f = fixture({ configured: false }), task = f.run('p');
  f.calls[0].resolve({ id: 'new' }); await tick();
  assert.deepEqual(f.calls[1].args, ['new']);
  f.calls[1].resolve({ success: true }); await tick();
  f.calls[2].resolve([]); await task;
  assert.equal(f.state().activeOtherProviderId, 'new');
  assert.equal(f.state().editProviderApiTested, true);
  assert.deepEqual(f.state().editProviderModelsByTab, { chat: [] });
});
test('连接通过但模型读取失败单独提示，保留旧模型', async () => {
  const f = fixture({ saved: true }), task = f.run('p');
  f.calls[0].resolve({ success: true }); await tick();
  f.calls[1].reject(new Error('断网')); await task;
  assert.equal(f.state().editProviderApiTested, true);
  assert.equal(f.state().editProviderModelsByTab.chat[0].id, 'old');
  assert.match(f.messages[0][1], /连接已通过，但模型列表读取失败/);
});
for (const action of ['edit', 'invalidate']) {
  test('输入或会话失效后旧保存不启动测试：' + action, async () => {
    const f = fixture(), task = f.run('p'); f[action]();
    f.calls[0].resolve({}); await task;
    assert.equal(f.calls.length, 1); assert.equal(f.messages.length, 0);
  });
}
test('重复点击及关闭重开共享锁，旧请求完成后释放', async () => {
  const pending = new Set(), f = fixture({ pending }), task = f.run('p');
  await f.run('p'); assert.equal(f.calls.length, 1); f.invalidate();
  const g = fixture({ pending }); await g.run('p'); assert.equal(g.calls.length, 0);
  f.calls[0].resolve({}); await task;
  const next = g.run('p'); g.calls[0].reject(new Error('断网')); await next;
  assert.equal(pending.size, 0);
});
test('卡片测试也严格判定成功且不写密钥', async () => {
  const f = fixture(), task = f.run('p', true);
  assert.equal(f.calls[0].kind, 'test'); f.calls[0].resolve({ success: false }); await task;
  assert.equal(f.messages[0][0], 'error');
});
