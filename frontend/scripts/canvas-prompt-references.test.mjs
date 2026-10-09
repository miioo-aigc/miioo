import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanvasPromptFiles, getCanvasPromptReferences } from '../src/components/canvas/CanvasPromptReferences.js';

test('引用候选合并已添加与已连线素材，排除未关联、文本和空素材', () => {
  const nodes = [
    { id: 'target', data: { imageSourceIds: ['a', 'b', 'text', 'empty'], referenceInputs: [{ sourceId: 'a', slot: 0 }] } },
    { id: 'a', type: 'image', data: { label: '图片1', asset: { url: '/a', asset_type: 'image' } } },
    { id: 'b', type: 'image', data: { label: '图片2', asset: { url: '/b', asset_type: 'image' } } },
    { id: 'text', type: 'text', data: { content: '文字' } },
    { id: 'empty', type: 'image', data: {} },
    { id: 'other', type: 'image', data: { asset: { url: '/other' } } },
  ];
  assert.deepEqual(getCanvasPromptReferences(nodes, 'target').map((item) => item.id), ['a', 'b']);
  assert.equal(getCanvasPromptReferences(nodes, 'missing').length, 0);
});

test('当前图片节点已有图片时，也自动作为自身素材引用', () => {
  const nodes = [
    { id: 'target', type: 'image', data: { asset: { url: '/target.png', asset_type: 'image' } } },
  ];
  assert.equal(getCanvasPromptReferences(nodes, 'target')[0].isCurrentNode, true);
  assert.deepEqual(getCanvasPromptFiles(getCanvasPromptReferences(nodes, 'target'), 'image', 'all').map((file) => file._uid), ['target']);
});

test('同名素材用源节点身份区分，首尾帧与图片模式限制可引用类型', () => {
  const refs = ['image', 'image', 'video', 'audio'].map((type, slot) => ({
    id: `node-${slot}`, slot, asset: { name: '同名素材', asset_type: type, url: `/${slot}` },
  }));
  assert.deepEqual(getCanvasPromptFiles(refs, 'image', 'all').map((file) => file._uid), ['node-0', 'node-1']);
  assert.equal(getCanvasPromptFiles(refs, 'video', 'all').length, 4);
  assert.equal(getCanvasPromptFiles(refs, 'video', 'frame').length, 2);
  assert.equal(getCanvasPromptFiles([{ id: 'empty', asset: {} }], 'image', 'all').length, 0);
});

test('复用创作编辑器并保留草稿、缩放定位、中文组词与失效引用清理', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasMediaPromptEditor.jsx', import.meta.url), 'utf8');
  assert.match(source, /<CreationPromptEditor/);
  assert.match(source, /useCreationPromptInteraction/);
  assert.match(source, /showFileCards=\{false\}/);
  assert.match(source, /editor\.mentionPos\.top \/ zoom/);
  assert.match(source, /onCompositionEnd/);
  assert.match(source, /ids\.has\(tag\.dataset\.fileRef\)/);
  assert.match(source, /restoreContent\(\{ text: prompt, html: snapshot\?\.html/);
  assert.match(source, /validateCanvasVideoMedia/);
  assert.match(source, /canInsertMention/);
  assert.match(source, /querySelectorAll\('\[data-file-ref\]'\)/);
  const interaction = readFileSync(new URL('../src/components/creation/useCreationPromptInteraction.js', import.meta.url), 'utf8');
  assert.match(interaction, /canInsertMention\(file, replacingFileRef, editorRef\.current\)/);
  const panel = readFileSync(new URL('../src/components/canvas/CanvasCreationPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /promptHTML: snapshot\?\.html/);
  assert.match(panel, /onPromptChange\?\.\(snapshot.requestText, snapshot\)/);
});

test('画布视频节点将模型模式占位符传给共享编辑器，图片节点保留原占位符', () => {
  const panel = readFileSync(new URL('../src/components/canvas/CanvasCreationPanel.jsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/components/canvas/CanvasMediaPromptEditor.jsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../src/components/creation/CreationPromptEditor.jsx', import.meta.url), 'utf8');
  assert.match(panel, /getCanvasVideoPromptPlaceholder\(c\?\.model, c\?\.refMode\)/);
  assert.match(panel, /placeholder=\{nodeType === 'video' \? placeholder : undefined\}/);
  assert.match(editor, /placeholderText=\{placeholder\}/);
  assert.match(shared, /customText=\{placeholderText\}/);
});
