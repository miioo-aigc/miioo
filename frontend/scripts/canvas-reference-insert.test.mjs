import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { getCanvasPromptFiles } from '../src/components/canvas/CanvasPromptReferences.js';

let server;
let ReferenceBar;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  ReferenceBar = (await server.ssrLoadModule('/src/components/canvas/CanvasReferenceBar.jsx')).default;
});
after(async () => { await server?.close(); });

const references = ['image', 'video', 'audio'].map((type, slot) => ({
  id: `node-${type}`, slot, label: `素材${slot + 1}`,
  asset: { asset_type: type, url: `/test.${type}` },
}));

test('图片仅允许图片引用，视频保留各类素材和源节点身份', () => {
  assert.deepEqual(getCanvasPromptFiles(references, 'image').map((file) => file._uid), ['node-image']);
  assert.deepEqual(getCanvasPromptFiles(references, 'video').map((file) => file._uid), references.map((reference) => reference.id));
  assert.equal(getCanvasPromptFiles([{ id: 'empty', asset: {} }], 'image').length, 0);
  assert.deepEqual(getCanvasPromptFiles(references, 'video', 'frame').map((file) => file._uid), ['node-image']);
});

test('参考卡片使用可访问按钮，未参与素材禁止引用，删除按钮在引用按钮之外', () => {
  const markup = renderToStaticMarkup(createElement(ReferenceBar, {
    nodeType: 'video', references, insertableIds: ['node-image'], onInsert() {},
  }));
  assert.match(markup, /<button[^>]*aria-label="引用素材1"[^>]*>/);
  assert.doesNotMatch(markup, /<button[^>]*aria-label="引用素材1"[^>]*disabled/);
  assert.match(markup, /<button[^>]*aria-label="引用素材2"[^>]*disabled/);
  assert.match(markup, /<button[^>]*aria-label="引用素材3"[^>]*disabled/);
  assert.match(markup, /<\/button><button[^>]*aria-label="移除参考素材"/);
});

// 单独执行适配器的命令体，验证校验和草稿同步的接线，不模拟共享编辑器的 DOM 实现。
const source = readFileSync(new URL('../src/components/canvas/CanvasMediaPromptEditor.jsx', import.meta.url), 'utf8');
const command = source.match(/useImperativeHandle\(ref, \(\) => \(\{([\s\S]*?)\n  \}\)\);/)?.[1];
assert.ok(command, '必须暴露卡片引用命令');
function createCommand({ composing = false, allowed = true } = {}) {
  const calls = [];
  const file = { _uid: 'node-image' };
  const element = {};
  const handle = runInNewContext(`({${command}})`, {
    composingRef: { current: composing }, files: [file], editorRef: { current: element },
    canInsertMention(...args) { calls.push(['validate', ...args]); return allowed; },
    editor: { insertFromCard(value) { calls.push(['insert', value]); } },
    sync() { calls.push(['sync']); },
  });
  return { handle, calls, file, element };
}

test('点击引用先校验，再复用创作卡片插入，最后同步草稿', () => {
  const { handle, calls, file, element } = createCommand();
  handle.insertReference('node-image');
  assert.deepEqual(calls, [['validate', file, '', element], ['insert', file], ['sync']]);
});

test('视频校验拒绝时不插入且不修改草稿', () => {
  const { handle, calls } = createCommand({ allowed: false });
  handle.insertReference('node-image');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'validate');
});

test('中文组词期间和已失效引用不执行插入', () => {
  const composing = createCommand({ composing: true });
  composing.handle.insertReference('node-image');
  assert.deepEqual(composing.calls, []);
  const stale = createCommand();
  stale.handle.insertReference('removed-node');
  assert.deepEqual(stale.calls, []);
});
