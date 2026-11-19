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

test('画布媒体输入组字时隐藏占位提示，结束后恢复真实空态且不提交中间拼音', () => {
  const media = readFileSync(new URL('../src/components/canvas/CanvasMediaPromptEditor.jsx', import.meta.url), 'utf8');
  let composing = false, hasContent = false, handled = 0, synced = 0;
  const state = { current: false };
  const start = media.match(/onCompositionStart=\{\(\) => \{([^]*?)\}\}/)[1];
  const end = media.match(/onCompositionEnd=\{\(\) => \{([^]*?)\}\}/)[1];
  const deps = {composingRef:state,setIsComposing:value=>{composing=value;},editor:{handleInput:()=>{handled++;}},sync:()=>{synced++;}};
  const run = code => new Function(...Object.keys(deps),code)(...Object.values(deps));
  run(start);
  const visibleContent = new Function('isComposing','editor','return '+media.match(/hasContent=\{([^}]+)\}/)[1]);
  assert.equal(visibleContent(composing,{hasContent}),true);
  assert.equal(state.current,true);assert.equal(handled,0);assert.equal(synced,0);
  run(end);
  assert.equal(visibleContent(composing,{hasContent}),false); // 取消组字可恢复提示。
  hasContent=true;
  assert.equal(visibleContent(composing,{hasContent}),true);
  assert.equal(state.current,false);assert.equal(handled,1);assert.equal(synced,1);
  assert.match(media,/onInput=\{\(\) => \{ if \(!composingRef.current\)/);
});
