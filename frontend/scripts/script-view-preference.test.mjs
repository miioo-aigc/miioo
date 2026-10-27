import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberScriptView, restoreScriptView } from '../src/utils/ScriptViewPreference.js';

test('离开后按项目恢复对话和解构，未记录时解构优先', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(restoreScriptView('a', true, storage), true);
  assert.equal(restoreScriptView('a', false, storage), false);
  rememberScriptView('a', false, storage);
  assert.equal(restoreScriptView('a', true, storage), false);
  assert.equal(restoreScriptView('b', true, storage), true);
  rememberScriptView('a', true, storage);
  assert.equal(restoreScriptView('a', true, storage), true);
  assert.equal(restoreScriptView('a', false, storage), false);
});

test('存储不可用时仍能切页，并按解构可用性兜底', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.doesNotThrow(() => rememberScriptView('a', false, storage));
  assert.equal(restoreScriptView('a', true, storage), true);
  assert.equal(restoreScriptView('a', false, storage), false);
});
