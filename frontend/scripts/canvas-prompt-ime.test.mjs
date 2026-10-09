import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/canvas/CanvasCreationPanel.jsx', import.meta.url), 'utf8');

test('创作描述在中文组词期间使用本地草稿，结束后同步', () => {
  assert.match(source, /value=\{draft\}/);
  assert.match(source, /onCompositionStart=/);
  assert.match(source, /onCompositionEnd=/);
  assert.match(source, /if \(!composingRef.current\) onPromptChange/);
});

test('输入按键不冒泡到画布，且不阻止输入法默认行为', () => {
  const textarea = source.match(/<textarea[^]*?\/>/)[0];
  assert.match(textarea, /onKeyDown=\{\(event\) => event.stopPropagation\(\)\}/);
  assert.match(textarea, /onKeyUp=\{\(event\) => event.stopPropagation\(\)\}/);
  assert.doesNotMatch(textarea, /preventDefault/);
});
