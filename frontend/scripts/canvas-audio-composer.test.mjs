import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
test('发送优先补选音色，其次用公共轻提示校验台词，最后校验模型', () => {
  const source = read('canvas/CanvasAudioCreationPanel.jsx');
  const body = source.match(/const send = \(\) => \{([\s\S]*?)\n  \};/)[1];
  const run = (voice, text, model) => {
    const events = [];
    const send = new Function('getPromptSnapshot', 'voice', 'controls', 'setVoiceOpen', 'setFeedback', 'showGlobalToast', 'onGenerate', 'nodeId', 'effects', body);
    send(() => ({ requestText: text }), voice, { model },
      (open) => events.push(['voice', open]), (message) => { if (message) events.push(['feedback', message]); },
      (...args) => events.push(['toast', ...args]), () => events.push(['generate']), 'audio-1', {});
    return events;
  };
  assert.deepEqual(run(null, '', null), [['voice', true]]);
  assert.deepEqual(run(null, '台词', 'model'), [['voice', true]]);
  assert.deepEqual(run({ id: 'voice' }, '  ', null), [['toast', 'warning', '请先输入台词']]);
  assert.deepEqual(run({ id: 'voice' }, '台词', null), [['feedback', '请先选择模型']]);
  assert.deepEqual(run({ id: 'voice' }, '台词', 'model'), [['generate']]);
  const confirm = source.slice(source.indexOf('onConfirm='));
  assert.match(confirm, /setVoiceOpen\(false\)/);
  assert.doesNotMatch(confirm, /\bsend\(|onGenerate/);
});
test('音频使用独立高级创作组件，草稿状态保留在常驻节点外壳', () => {
  assert.match(read('canvas/CanvasCreationPanel.jsx'), /<CanvasAudioCreationPanel/);
  assert.match(read('canvas/CanvasNodeShell.jsx'), /audioDraft/);
});
test('音频发送不置灰，点击时校验文字和模型', () => {
  const source = read('canvas/CanvasAudioCreationPanel.jsx');
  assert.match(source, /<CreationSendButton onClick=\{send\} \/>/);
  assert.match(source, /if \(!snapshot\.requestText\?\.trim\(\)\)/);
  assert.match(source, /if \(!controls\.model\)/);
});
test('音频空编辑区光标让开音色卡片12px，非空保留绕排', () => {
  const source = read('canvas/CanvasAudioCreationPanel.jsx');
  const editor = read('creation/CreationPromptEditor.jsx');
  const css = read('canvas/canvas-nodes.css');
  assert.match(source, /voiceWrapGap=\{12\}/);
  assert.match(editor, /data-empty=\{!hasContent\}/);
  assert.match(css, /\.canvas-audio-creation-panel \.creation-prompt-editor--voice-wrap\[data-empty='true'\]\s*\{[^}]*padding-left: var\(--creation-voice-wrap-width\)/s);
  assert.match(css, /\.canvas-audio-creation-panel \.creation-prompt-editor--voice-wrap\[data-empty='true'\]::before\s*\{\s*display: none;/s);
});
test('复用高级编辑、音色弹窗和工具栏，不新增模式开关', () => {
  assert.ok(existsSync(new URL('../src/components/canvas/CanvasAudioCreationPanel.jsx', import.meta.url)));
  const source = read('canvas/CanvasAudioCreationPanel.jsx');
  for (const component of ['CreationPromptEditor', 'CreationDubbingAdvancedToolbar', 'DubbingVoiceModal', 'useCreationPromptInteraction']) assert.ok(source.includes(component));
  assert.match(source, /dubbingAdvancedEnabled: true/);
  assert.match(source, /getPromptSnapshot/);
  assert.match(source, /currentVoice=\{voice\?\.id\}/);
  assert.match(source, /handleFileSelect:/);
  assert.doesNotMatch(source, /onAdvancedChange/);
});
test('音频底栏固定两行，高级操作与发送同行，正文高度不变', () => {
  const source = read('canvas/CanvasAudioCreationPanel.jsx');
  const css = read('canvas/canvas-nodes.css');
  assert.match(source, /<CanvasMediaControls[^>]*\/>\s*<div className="canvas-audio-creation-panel__advanced-row">\s*<CreationDubbingAdvancedToolbar/s);
  assert.match(source, /<CreationSendButton[^>]*\/>\s*<\/div>/s);
  assert.match(css, /canvas-audio-creation-panel[^}]*width: max-content/s);
  assert.match(css, /\.canvas-audio-creation-panel \.composer-surface__toolbar\s*\{[^}]*flex-direction: column;[^}]*align-items: stretch;/s);
  assert.match(css, /\.canvas-audio-creation-panel__advanced-row\s*\{[^}]*justify-content: space-between;[^}]*gap: var\(--spacing-32\);/s);
  assert.doesNotMatch(css, /\.canvas-audio-creation-panel__controls\s*\{/);
  assert.match(css, /canvas-audio-creation-panel[^}]*height: 120px/s);
});
