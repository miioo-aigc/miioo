import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
test('可用模型目录隔离乱序、失败、空列表、账号切换和卸载', async () => {
  let state, cleanup, notify, generation = 1;
  const calls = [];
  const source = read('src/hooks/useAvailableModels.js').split(String.fromCharCode(10)).filter(line => !line.startsWith('import ')).join(String.fromCharCode(10)).replace('export function', 'function');
  const hook = new Function('useEffect', 'useState', 'apiListModels', 'getAuthSessionGeneration', 'subscribeModelConfig', source + '; return useAvailableModels;')(
    fn => { cleanup = fn(); }, initial => [initial, next => { state = next; }],
    args => new Promise((resolve, reject) => calls.push({ args, resolve, reject })),
    () => generation, fn => { notify = fn; return () => { notify = null; }; });
  hook('image'); notify(1);
  assert.deepEqual(calls[0].args, { category: 'image', fresh: true, availableOnly: true });
  calls[1].resolve([{ model_id: 'new', is_enabled: true }, { model_id: 'off', is_enabled: false }]); await tick();
  calls[0].resolve([{ model_id: 'old', is_enabled: true }]); await tick();
  assert.deepEqual(state.models.map(m => m.model_id), ['new']);
  notify(1); assert.equal(state.loading, true); assert.deepEqual(state.models, []);
  calls[2].reject(new Error('offline')); await tick(); assert.ok(state.error);
  notify(1); calls[3].resolve([]); await tick(); assert.equal(state.error, ''); assert.deepEqual(state.models, []);
  notify(1); generation = 2; calls[4].resolve([{ model_id: 'stale', is_enabled: true }]); await tick(); assert.deepEqual(state.models, []);
  cleanup(); hook('image'); cleanup(); calls[5].resolve([{ model_id: 'late', is_enabled: true }]); await tick(); assert.deepEqual(state.models, []);
});
test('剧本发送守卫保留草稿，成功发送保持原有流程', async () => {
  const source = read('src/components/script/InputCard.jsx');
  const body = source.slice(source.indexOf('  const handleSend ='), source.indexOf('  const handleStop ='));
  for (const [loading, models, selected, expected] of [[true, [], 'a', 0], [false, [], 'a', 0], [false, [{ model_id: 'a' }], 'stale', 0], [false, [{ model_id: 'a' }], 'a', 1]]) {
    let text = '我的草稿', count = 0;
    const send = new Function('hasText', 'modelsLoading', 'models', 'selectedModel', 'text', 'onSend', 'setText', 'episodeCount', 'episodeDuration', body + '; return handleSend;')(true, loading, models, selected, text, async () => { count++; }, value => { text = value; }, 1, 10);
    await send(); assert.equal(count, expected); assert.equal(text, expected ? '' : '我的草稿');
  }
});
test('画布按钮和键盘发送守卫阻止不可用模型', () => {
  for (const path of ['src/components/canvas/CanvasCreationPanel.jsx', 'src/components/canvas/CanvasAudioCreationPanel.jsx']) {
    const source = read(path), start = source.indexOf('  const send =');
    const body = source.slice(start, source.indexOf(String.fromCharCode(10) + '  };', start) + 5);
    const send = new Function('modelAvailable', 'generating', 'composingRef', 'mediaSnapshotRef', body + '; return send;')(false, false, { current: false }, { current: {} });
    assert.doesNotThrow(() => send());
    assert.ok(source.includes('disabled={') && source.includes('!modelAvailable}'));
  }
});
