import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTestViteServer as createServer } from './lib/create-test-vite-server.mjs';
import react from '@vitejs/plugin-react';
import { getCanvasPromptFiles } from '../src/components/canvas/CanvasPromptReferences.js';

let server;
let ReferenceBar;
let CreationPanel;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false } });
  ReferenceBar = (await server.ssrLoadModule('/src/components/canvas/CanvasReferenceBar.jsx')).default;
  CreationPanel = (await server.ssrLoadModule('/src/components/canvas/CanvasCreationPanel.jsx')).default;
});
after(async () => { await server?.close(); });

test('文本输入框仅有参考时显示卡片，保留原文字输入控件', () => {
  const render = (refs) => renderToStaticMarkup(createElement(CreationPanel, {
    nodeId: 'target', nodeType: 'text', prompt: '继续创作', references: refs,
  }));
  const empty = render([]);
  assert.doesNotMatch(empty, /canvas-reference-bar/);
  assert.match(empty, /<textarea/);
  const linked = render([{ id: 'source', type: 'text', label: '文本1', content: '参考内容' }]);
  assert.match(linked, /canvas-reference-bar/);
  assert.match(linked, /引用文本1/);
  assert.match(linked, /<textarea/);
  assert.match(linked, /继续创作/);
  assert.doesNotMatch(linked, /添加参考素材/);
});

const references = ['image', 'video', 'audio'].map((type, slot) => ({
  id: `node-${type}`, slot, label: `素材${slot + 1}`,
  asset: { asset_type: type, url: `/test.${type}` },
}));

test('文本参考复用卡片外壳并提供移除入口，首尾帧模式不标记为未参与', () => {
  for (const mode of ['all', 'start_end', 'first_frame', 'text_to_video']) {
    const markup = renderToStaticMarkup(createElement(ReferenceBar, {
      nodeType: 'video', mode, collapsed: mode === 'text_to_video',
      references: [{ id: 'text', type: 'text', label: '场景说明', content: '雪山下的森林' }], onRemove() {},
    }));
    assert.match(markup, /canvas-reference-bar__item--text/);
    assert.match(markup, /aria-label="参考文本"/);
    assert.match(markup, /aria-label="移除参考文本"/);
    assert.doesNotMatch(markup, /title="场景说明/);
    assert.doesNotMatch(markup, /未参与|--inactive-video/);
  }
});

test('文本参考栏只有上游卡片及移除按钮，不展示媒体上传入口', () => {
  const markup = renderToStaticMarkup(createElement(ReferenceBar, {
    nodeType: 'text', references: [{ id: 'source', type: 'text', label: '文本1', content: '正文' }], onRemove() {},
  }));
  assert.match(markup, /aria-label="引用文本1"/);
  assert.match(markup, /aria-label="移除参考文本"/);
  assert.doesNotMatch(markup, /添加参考素材/);
  const source = readFileSync(new URL('../src/components/canvas/CanvasReferenceBar.jsx', import.meta.url), 'utf8');
  assert.match(source, /<Tooltip[^>]*label=\{reference.id \? reference.label \|\| label : label\}/);
});

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
  assert.match(markup, /<div role="button" tabindex="0"[^>]*aria-label="引用素材1" aria-disabled="false"/);
  for (const label of ['素材2', '素材3']) {
    assert.ok(markup.includes('aria-label="引用' + label + '" aria-disabled="true"'));
  }
  assert.match(markup, /<\/div><button[^>]*aria-label="移除参考素材"/);
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


test('当前视频显示参考卡片且没有移除按钮，首尾帧标记未参与并禁止引用', () => {
  const own = { id: 'current', isCurrentNode: true, label: '当前视频', slot: 0,
    asset: { asset_type: 'video', url: '/current.mp4', posterUrl: '/current.png' } };
  const render = (mode, insertableIds) => renderToStaticMarkup(createElement(ReferenceBar, {
    nodeType: 'video', references: [own], mode, insertableIds, onInsert() {},
  }));
  const full = render('all', ['current']);
  assert.match(full, /aria-label="引用当前视频" aria-disabled="false"/);
  assert.doesNotMatch(full, /aria-label="移除/);
  const frame = render('start_end', []);
  assert.match(frame, /canvas-reference-bar__slot--inactive-video/);
  assert.doesNotMatch(full, /canvas-reference-bar__slot--inactive-video/);
  assert.match(render('first_frame', []), /canvas-reference-bar__slot--inactive-video/);
  assert.match(frame, /未参与/);
  assert.match(frame, /aria-label="引用当前视频" aria-disabled="true"/);
  assert.doesNotMatch(frame, /aria-label="移除/);
});
