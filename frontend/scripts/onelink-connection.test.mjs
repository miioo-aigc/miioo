import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const connectionBody = source.match(/const testConnection = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/)[1];
const saveBody = source.match(/const saveOneLinkConfig = \(\) => \{([\s\S]*?)\n  \};/)[1];
const changeBody = source.match(/onApiChange=\{\(event\) => \{([\s\S]*?)\n            \}\}/)[1];

function setup({ saved = false, result = { success: false }, request } = {}) {
  let state = {
    onelinkApiKeyActual: 'test-key', onelinkKeyIsFromServer: saved,
    onelinkProviderId: saved ? 'provider-id' : null,
    apiTested: saved, childView: 'onelink-config',
  };
  const toasts = [];
  let configured = 0;
  const context = vm.createContext({
    state,
    oneLinkTestRequest: { current: 0 },
    setState(update) { state = update(state); context.state = state; },
    showToast: (...args) => toasts.push(args),
    apiTestConnection: request || (async () => result),
    apiOneClickSetup: request || (async () => result),
    loadModelsFromBackend() {},
    onConfigured() { configured += 1; },
    console: { error() {} },
  });
  return {
    run: () => vm.runInContext(`(async () => {${connectionBody}})()`, context),
    save: () => vm.runInContext(`(() => {${saveBody}})()`, context),
    change(value) {
      context.event = { target: { value } };
      vm.runInContext(`(() => {${changeBody}})()`, context);
    },
    get state() { return state; },
    get configured() { return configured; },
    toasts,
  };
}

test('已保存密钥返回 success false 时提示失败并禁止保存', async () => {
  const app = setup({ saved: true, result: { success: false, message: '当前模型不可用，请更换其他模型后重试' } });
  await app.run();
  assert.deepEqual(app.toasts, [['error', '当前key不可用']]);
  assert.equal(app.state.apiTested, false);
  app.save();
  assert.equal(app.configured, 0);
});

test('已保存且未修改的密钥允许直接保存', () => {
  const app = setup({ saved: true });
  app.save();
  assert.equal(app.configured, 1);
});

test('新密钥未测试不能保存，清空也不能保存', () => {
  const app = setup();
  app.save();
  assert.equal(app.configured, 0);
  app.change('   ');
  app.save();
  assert.equal(app.configured, 0);
});

test('新密钥测试失败不能因返回模型列表而放行', async () => {
  const app = setup({ result: { test_success: false, models: [{ id: 'model' }] } });
  await app.run();
  assert.equal(app.state.apiTested, false);
  assert.deepEqual(app.toasts, [['error', '当前key不可用']]);
});

for (const result of [{}, { success: 'true' }, { success: false, test_success: true }]) {
  test(`已保存密钥异常或失败响应不能放行 ${JSON.stringify(result)}`, async () => {
    const app = setup({ saved: true, result });
    await app.run();
    assert.equal(app.state.apiTested, false);
  });
}

test('新密钥测试成功可以保存，修改后必须重新测试', async () => {
  const app = setup({ result: { test_success: true, provider: { id: 'new-provider' } } });
  await app.run();
  assert.equal(app.state.apiTested, true);
  assert.equal(app.state.onelinkProviderId, 'new-provider');
  app.change('another-key');
  assert.equal(app.state.apiTested, false);
  app.save();
  assert.equal(app.configured, 0);
  await app.run();
  app.save();
  assert.equal(app.configured, 1);
});

test('已保存密钥明确返回 success true 才算测试通过', async () => {
  const app = setup({ saved: true, result: { success: true, message: '连接成功' } });
  await app.run();
  assert.equal(app.state.apiTested, true);
  assert.deepEqual(app.toasts, [['success', '连接成功！']]);
});

test('测试中禁止保存，修改密钥后忽略旧请求成功结果', async () => {
  let resolve;
  const app = setup({ saved: true, request: () => new Promise(r => { resolve = r; }) });
  const pending = app.run();
  app.save();
  assert.equal(app.configured, 0);
  app.change('another-key');
  resolve({ success: true });
  await pending;
  assert.equal(app.state.apiTested, false);
  assert.equal(app.toasts.length, 0);
});

test('请求异常清除原先的通过状态', async () => {
  const app = setup({ saved: true, request: async () => { throw new Error('网络失败'); } });
  await app.run();
  assert.equal(app.state.apiTested, false);
  app.save();
  assert.equal(app.configured, 0);
});

test('重复测试只采用最后一次结果', async () => {
  const resolvers = [];
  const app = setup({ saved: true, request: () => new Promise(resolve => resolvers.push(resolve)) });
  const first = app.run();
  const second = app.run();
  resolvers[1]({ success: false });
  await second;
  resolvers[0]({ success: true });
  await first;
  assert.equal(app.state.apiTested, false);
  assert.deepEqual(app.toasts, [['error', '当前key不可用']]);
});

test('新密钥优先尊重 success false，不被旧字段或模型列表放行', async () => {
  const app = setup({ result: { success: false, test_success: true, models: [{}] } });
  await app.run();
  assert.equal(app.state.apiTested, false);
  assert.deepEqual(app.toasts, [['error', '当前key不可用']]);
});

test('新密钥明确返回 success true 可以保存', async () => {
  const app = setup({ result: { success: true } });
  await app.run();
  app.save();
  assert.equal(app.configured, 1);
});

test('保存按钮与保存函数共用非空且测试通过的条件', () => {
  assert.ok(source.includes('saveDisabled={!state.onelinkApiKeyActual.trim() || !state.apiTested}'));
});
