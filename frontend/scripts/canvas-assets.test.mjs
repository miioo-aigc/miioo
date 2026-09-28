import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toCanvasAsset, applyCanvasAsset } from '../src/components/canvas/CanvasAssets.js';

test('资产回填使用原文件而不是缩略图，保留来源身份', () => {
  const asset = toCanvasAsset({ id: 'v1', asset_type: 'video', url: '/thumb.jpg', fileUrl: '/movie.mp4', posterUrl: '/poster.jpg' }, 'video');
  assert.equal(asset.url, '/movie.mp4');
  assert.equal(asset.posterUrl, '/poster.jpg');
  assert.equal(asset.id, 'v1');
});

test('拒绝错误类型、文本节点和仅有服务商引用的资产', () => {
  assert.equal(toCanvasAsset({ type: 'audio', url: '/sound.mp3' }, 'image'), null);
  assert.equal(toCanvasAsset({ type: 'image', url: '/a.png' }, 'text'), null);
  assert.equal(toCanvasAsset({ type: 'image', url: 'asset://123' }, 'image'), null);
  assert.equal(toCanvasAsset({ type: 'audio', fileUrl: 'asset://123', audioUrl: '/sound.mp3' }, 'audio').url, '/sound.mp3');
});
test('视频卡片接受三类素材并保留真实类型和原文件地址', () => {
  for (const type of ['image', 'video', 'audio']) {
    const asset = toCanvasAsset({ type, [`${type}Url`]: '/original', url: '/thumb' }, 'video');
    assert.equal(asset.asset_type, type);
    assert.equal(asset.url, '/original');
  }
});

test('只更新指定节点草稿，不改变提示词和其他节点', () => {
  const other = { id: 'other', type: 'image', data: {} };
  const nodes = [{ id: 'target', type: 'image', data: { prompt: '保留', persistenceState: 'saved' } }, other];
  const result = applyCanvasAsset(nodes, 'target', { id: 'a', type: 'image', url: '/a.png' });
  assert.equal(result[0].data.asset.url, '/a.png');
  assert.equal(result[0].data.prompt, '保留');
  assert.equal(result[0].data.persistenceState, 'draft');
  assert.equal(result[1], other);
  assert.equal(nodes[0].data.asset, undefined);
  assert.equal(applyCanvasAsset(nodes, 'missing', {}), nodes);
});

test('替换音频清理旧台词，本地来源不带台词，资产只有有效台词才显示', () => {
  const nodes = [{ id: 'a', type: 'audio', data: { transcript: '旧台词', prompt: '创作草稿' } }];
  const base = { type: 'audio', url: '/sound.mp3' };
  for (const asset of [base, { ...base, transcript: '   ' }, { ...base, source: 'local-preview', transcript: '不能显示' }, { ...base, prompt: '音乐描述' }]) {
    assert.equal(applyCanvasAsset(nodes, 'a', asset)[0].data.transcript, '');
  }
  const result = applyCanvasAsset(nodes, 'a', { ...base, transcript: ' 新台词 ' });
  assert.equal(result[0].data.transcript, '新台词');
  assert.equal(result[0].data.prompt, '创作草稿');
});

test('三个媒体节点有资产入口，文本没有；菜单禁止选择文字', () => {
  for (const type of ['Image', 'Video', 'Audio']) {
    const source = readFileSync(new URL(`../src/components/canvas/${type}CanvasNode.jsx`, import.meta.url), 'utf8');
    assert.match(source, /从资产库选择/);
    assert.match(source, /onSelectAsset/);
  }
  const text = readFileSync(new URL('../src/components/canvas/TextCanvasNode.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /从资产库选择/);
  const css = readFileSync(new URL('../src/components/canvas/canvas-nodes.css', import.meta.url), 'utf8');
  assert.match(css, /\.canvas-node-add-menu[^}]*user-select: none/);
});
