import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { applyModelResult, validateModelResult } from '../src/utils/ModelConfigState.js';
import { publishModelConfig, subscribeModelConfig } from '../src/api/ModelConfigEvents.js';
const source = readFileSync(new URL('../src/components/ApiConfigModal.jsx', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const entity = { id: 'b', provider_id: 'q', category: 'image', name: '新模型', model_id: 'new', is_enabled: true, is_default: true };
test('跨服务商同步默认、删除副本，保留其他分类及草稿', () => {
  const tabs = { 图片模型: [{ id: 'a', isDefault: true }], 视频模型: [{ id: 'v', isDefault: true }] };
  const state = { onelinkProviderId: 'p', onelinkModelsByTab: tabs, activeOtherProviderId: 'q',
    editProviderModelsByTab: { 图片模型: [{ id: 'b' }] }, otherProviders: [{ id: 'q', modelsByTab: { 图片模型: [{ id: 'b' }] } }], draft: '保留' };
  const next = applyModelResult(state, '图片模型', 'q', 'b', entity, x => x);
  assert.equal(next.onelinkModelsByTab.图片模型[0].isDefault, false);
  assert.equal(next.onelinkModelsByTab.视频模型[0].isDefault, true);
  assert.equal(next.otherProviders[0].modelsByTab.图片模型[0].isDefault, true);
  assert.equal(next.draft, '保留');
  assert.equal(applyModelResult(next, '图片模型', 'q', 'b', null, x => x).otherProviders[0].modelsByTab.图片模型.length, 0);
});
test('异常编号、归属、分类和状态被拒绝；规范实体可采用', () => {
  assert.equal(validateModelResult(entity, 'q', 'image', 'b'), entity);
  for (const value of [null, {}, { ...entity, id: 'x' }, { ...entity, provider_id: 'p' }, { ...entity, category: 'video' }, { ...entity, is_default: undefined }]) {
    assert.throws(() => validateModelResult(value, 'q', 'image', 'b'));
  }
});
test('主配置等读取成功才打开，失败与失效不打开', async () => {
  const body = source.slice(source.indexOf('  const openOneLinkConfig ='), source.indexOf('  const openOtherProviderConfig ='));
  for (const mode of ['success', 'failure', 'closed']) {
    let current = true, state = { childView: null }, resolve, reject;
    const messages = [];
    const bindings = { readStatus: 'ready', primaryReadRequest: { current: null }, getPrimaryPending: () => null,
      modelScope: { current: 0 }, captureModelScope: () => () => current, pendingOtherModels: () => [],
      loadModelsFromBackend: () => new Promise((yes, no) => { resolve = yes; reject = no; }),
      setState: fn => { state = fn(state); }, showToast: (...args) => messages.push(args) };
    const open = new Function(...Object.keys(bindings), body + '; return openOneLinkConfig;')(...Object.values(bindings));
    const task = open(); await tick(); assert.equal(state.childView, null);
    if (mode === 'closed') current = false;
    if (mode === 'failure') reject(new Error()); else resolve(true);
    await task; assert.equal(state.childView, mode === 'success' ? 'onelink-config' : null);
    assert.equal(messages.length, mode === 'failure' ? 1 : 0);
  }
});
test('创作页配置通知采用新默认，乱序、账号切换及卸载隔离；失败清除不可确认列表', async () => {
  const page = readFileSync(new URL('../src/pages/CreationPage.jsx', import.meta.url), 'utf8');
  const body = page.slice(page.indexOf('  // Load model list from backend'), page.indexOf('  // Load params when model changes'));
  let cleanup, generation = 1, model = 'old', options = [];
  const calls = [], messages = [];
  const bindings = { useEffect: fn => { cleanup = fn(); }, genType: 'image', getAuthSessionGeneration: () => generation,
    subscribeModelConfig, apiListModels: args => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
    adaptModels: models => ({ modelOptions: models.map(m => ({ value: m.model_id })), capabilitiesMap: {} }),
    capabilitiesMapRef: { current: {} }, setCapabilitiesMap() {}, setModelOptions: value => { options = value; },
    setModel: value => { model = value; }, showGlobalToast: (...args) => messages.push(args) };
  new Function(...Object.keys(bindings), body)(...Object.values(bindings));
  publishModelConfig(1);
  calls[1].resolve([entity]); await tick(); assert.equal(model, 'new');
  assert.equal(calls[1].args.availableOnly, true);
  calls[0].resolve([{ ...entity, model_id: 'old' }]); await tick(); assert.equal(model, 'new');
  publishModelConfig(1); calls[2].reject(new Error()); await tick();
  assert.equal(model, ''); assert.deepEqual(options, []); assert.equal(messages.length, 1);
  publishModelConfig(1); generation = 2; calls[3].resolve([entity]); await tick(); assert.equal(model, '');
  cleanup(); publishModelConfig(2); assert.equal(calls.length, 4);
});
