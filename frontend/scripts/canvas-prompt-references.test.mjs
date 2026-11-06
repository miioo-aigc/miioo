import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanvasPromptFiles, getCanvasPromptReferences } from '../src/components/canvas/CanvasPromptReferences.js';
import { connectCanvasImage, disconnectCanvasImage, getCanvasImageEdges, planCanvasImageGeneration } from '../src/components/canvas/CanvasImageGeneration.js';
import { connectCanvasVideo, disconnectCanvasVideo, getCanvasVideoEdges, planCanvasVideoGeneration } from '../src/components/canvas/CanvasVideoGeneration.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectCanvasText, disconnectCanvasText, getCanvasTextEdges, planCanvasTextGeneration } from '../src/components/canvas/CanvasTextGeneration.js';

test('引用候选合并已添加与已连线素材，排除未关联和空素材', () => {
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

for (const type of ['text', 'image', 'video']) {
  test(`${type}节点显示有内容的文本参考，移除连线后不再参与生成`, () => {
    const connect = type === 'text' ? connectCanvasText : type === 'image' ? connectCanvasImage : connectCanvasVideo;
    const disconnect = type === 'text' ? disconnectCanvasText : type === 'image' ? disconnectCanvasImage : disconnectCanvasVideo;
    const edges = type === 'text' ? getCanvasTextEdges : type === 'image' ? getCanvasImageEdges : getCanvasVideoEdges;
    const plan = type === 'text' ? planCanvasTextGeneration : type === 'image' ? planCanvasImageGeneration : planCanvasVideoGeneration;
    const text = createCanvasNode('text', { x: 0, y: 0 }, 'text');
    text.data.content = '夕阳下的森林';
    const target = createCanvasNode(type, { x: 400, y: 0 }, 'target');
    target.data.generationMode = 'text_to_video';
    target.data.videoCapabilities = { supported_generation_modes: ['text_to_video'], generation_reference_mode_map: { text_to_video: null } };
    let nodes = connect([text, target], { source: 'text', target: 'target' });
    const refs = getCanvasPromptReferences(nodes, 'target');
    assert.equal(refs.length, 1);
    assert.equal(refs[0].type, 'text');
    assert.equal(refs[0].content, text.data.content);
    assert.equal(getCanvasPromptFiles(refs, type, 'all').length, 0);
    assert.equal(edges(nodes).length, 1);
    assert.ok(plan(nodes, 'target', '生成场景', 'model').sources.some((source) => source.id === 'text'));
    nodes = disconnect(nodes, 'target', 'text');
    assert.equal(edges(nodes).length, 0);
    assert.equal(getCanvasPromptReferences(nodes, 'target').length, 0);
    assert.ok(!plan(nodes, 'target', '生成场景', 'model').sources.some((source) => source.id === 'text'));
    assert.equal(nodes[0].data.content, text.data.content);
  });
}

test('文本参考只显示上游有正文节点，名称随源节点重命名同步，不显示自身', () => {
  const nodes = [
    { id: 'target', type: 'text', data: { content: '自己的正文', textSourceIds: ['source', 'empty', 'target'] } },
    { id: 'source', type: 'text', data: { label: '文本1', content: '参考正文' } },
    { id: 'empty', type: 'text', data: { label: '文本2', content: '  ' } },
  ];
  assert.deepEqual(getCanvasPromptReferences(nodes, 'target').map(({ id, label }) => ({ id, label })), [{ id: 'source', label: '文本1' }]);
  nodes[1].data.label = '场景设定';
  assert.equal(getCanvasPromptReferences(nodes, 'target')[0].label, '场景设定');
  nodes[0].data.textSourceIds = [];
  assert.deepEqual(getCanvasPromptReferences(nodes, 'target'), []);
});

test('空白文本不显示，文本不挤占首尾帧与自身素材槽位，实时读取正文', () => {
  const nodes = [
    { id: 'target', type: 'video', data: { videoSourceIds: ['text', 'empty', 'image'], asset: { url: '/self', asset_type: 'video' } } },
    { id: 'text', type: 'text', data: { label: '场景', content: '森林' } },
    { id: 'empty', type: 'text', data: { content: '  \n ' } },
    { id: 'image', type: 'image', data: { asset: { url: '/image', asset_type: 'image' } } },
  ];
  const refs = getCanvasPromptReferences(nodes, 'target');
  assert.deepEqual(refs.map((ref) => ref.id), ['text', 'image']);
  assert.equal(refs[1].slot, 0);
  assert.deepEqual(getCanvasPromptFiles(refs, 'video', 'first_frame').map((file) => file._uid), ['image']);
  nodes[1].data.content = '雪山';
  assert.equal(getCanvasPromptReferences(nodes, 'target')[0].content, '雪山');
});

for (const type of ['text', 'image', 'video']) {
  test(`${type}节点自身结果不进入提示词候选或文件，直接上游仍保留`, () => {
    const own = createCanvasNode(type, { x: 0, y: 0 }, 'target');
    own.data.asset = type === 'text' ? undefined : { url: `/target.${type === 'image' ? 'png' : 'mp4'}`, asset_type: type };
    own.data.content = type === 'text' ? '自己的正文' : undefined;
    own.data.referenceInputs = [{ sourceId: 'target', slot: 0 }];
    own.data.imageSourceIds = ['target'];
    own.data.videoSourceIds = ['target'];
    own.data.textSourceIds = ['target'];
    const upstream = createCanvasNode(type === 'text' ? 'text' : 'image', { x: 100, y: 0 }, 'upstream');
    if (type === 'text') upstream.data.content = '上游正文';
    else upstream.data.asset = { url: '/upstream.png', asset_type: 'image' };
    own.data.referenceInputs.push({ sourceId: 'upstream', slot: 0 });
    const refs = getCanvasPromptReferences([own, upstream], own.id);
    assert.deepEqual(refs.map((item) => item.id), ['upstream']);
    assert.equal(refs.some((item) => item.isCurrentNode), false);
    assert.deepEqual(getCanvasPromptFiles(refs, type, 'all').map((file) => file._uid), type === 'text' ? [] : ['upstream']);
  });
}

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


test('视频参考只包含外部参考，首尾帧模式按外部素材槽位过滤', () => {
  const nodes = [
    { id: 'image', type: 'image', data: { asset: { url: '/image.png', asset_type: 'image' } } },
    { id: 'video', type: 'video', data: { label: '视频2', videoSourceIds: ['image'], referenceInputs: [{ sourceId: 'image', slot: 0 }],
      asset: { url: '/video.mp4', posterUrl: '/poster.png', asset_type: 'video' } } },
  ];
  const refs = getCanvasPromptReferences(nodes, 'video');
  assert.deepEqual(refs.map(({ id, isCurrentNode }) => ({ id, isCurrentNode })), [
    { id: 'image', isCurrentNode: false },
  ]);
  assert.deepEqual(getCanvasPromptFiles(refs, 'video', 'all').map((file) => file._uid), ['image']);
  for (const mode of ['frame', 'start_end', 'first_frame']) {
    assert.deepEqual(getCanvasPromptFiles(refs, 'video', mode).map((file) => file._uid), ['image']);
  }
  assert.equal(nodes[1].data.referenceInputs.length, 1);
  nodes[1].data.referenceInputs.push({ sourceId: 'video', slot: 1 });
  assert.equal(getCanvasPromptReferences(nodes, 'video').filter((ref) => ref.id === 'video').length, 0);
  nodes[1].data.asset = null;
  assert.deepEqual(getCanvasPromptReferences(nodes, 'video').map((ref) => ref.id), ['image']);
});
