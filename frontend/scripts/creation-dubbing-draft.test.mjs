import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveDubbingDraftState, saveCreationDraft, readCreationDraft, clearCreationDrafts } from '../src/components/creation/CreationDraftStorage.js';

test('保存并恢复高级模式、情绪正文和效果', async () => {
  const draft = { dubbingAdvancedEnabled: true, prompt: '你好', promptHTML: '<span data-emotion="true">你好</span>', dubbingEffects: { toneValues: { brightness: 3 }, selectedEffects: ['test-effect'] } };
  await saveCreationDraft('dubbing', draft);
  const restored = await readCreationDraft('dubbing');
  assert.equal(restored.promptHTML, draft.promptHTML);
  assert.deepEqual(resolveDubbingDraftState(restored), { advancedEnabled: true, effects: { toneValues: { brightness: 3, softness: 0, clarity: 0 }, selectedEffects: ['test-effect'] } });
  await clearCreationDrafts();
  assert.equal(await readCreationDraft('dubbing'), null);
});

test('旧情绪和停顿草稿恢复为高级模式，普通文本不误判', () => {
  for (const attr of ['data-emotion', 'data-dubbing-inline-tag']) {
    assert.equal(resolveDubbingDraftState({ promptHTML: '<span ' + attr + '="true">你好</span>' }).advancedEnabled, true);
  }
  for (const draft of [null, {}, { promptHTML: '普通文本 data-emotion' }, { promptHTML: '<span data-emotion-label="true">标签</span>' }]) {
    assert.equal(resolveDubbingDraftState(draft).advancedEnabled, false);
  }
});

test('明确关闭优先于旧标签推断，关闭后不恢复效果', () => {
  const state = resolveDubbingDraftState({ dubbingAdvancedEnabled: false, promptHTML: '<span data-emotion="true">你好</span>', dubbingEffects: { toneValues: { brightness: 3 }, selectedEffects: ['test-effect'] } });
  assert.equal(state.advancedEnabled, false);
  assert.deepEqual(state.effects, { toneValues: { brightness: 0, softness: 0, clarity: 0 }, selectedEffects: [] });
});

test('空高级草稿仍保持开关打开，效果恢复不共享可变数组', () => {
  const draft = { dubbingAdvancedEnabled: true, dubbingEffects: { selectedEffects: ['test-effect'] } };
  const state = resolveDubbingDraftState(draft);
  assert.equal(state.advancedEnabled, true);
  state.effects.selectedEffects.push('new');
  assert.deepEqual(draft.dubbingEffects.selectedEffects, ['test-effect']);
});

test('实际保存回调在恢复状态提交前不写入，提交后正常保存', () => {
  const source = readFileSync(new URL('../src/components/creation/CreationInputCard.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const persistDraft = useCallback((force = false) => {');
  const end = source.indexOf('\n  }, [', start);
  const body = source.slice(source.indexOf('{', start) + 1, end);
  const effects = { toneValues: {}, selectedEffects: [] };
  const pending = { current: { advancedEnabled: true, effects } };
  const writes = [];
  const run = (enabled, currentEffects, force = false) => new Function('pendingDubbingRestoreRef', 'genType', 'dubbingAdvancedEnabled', 'dubbingEffects', 'hydratedGenTypeRef', 'force', 'saveCreationDraft', 'createDraftSnapshot', body)(pending, 'dubbing', enabled, currentEffects, { current: 'dubbing' }, force, (_type, draft) => writes.push(draft), () => ({ dubbingAdvancedEnabled: enabled }));
  run(false, effects, true);
  run(true, {}, true);
  assert.equal(writes.length, 0);
  run(true, effects);
  assert.equal(pending.current, null);
  assert.deepEqual(writes, [{ dubbingAdvancedEnabled: true }]);
  run(false, effects);
  assert.deepEqual(writes[1], { dubbingAdvancedEnabled: false });
});
