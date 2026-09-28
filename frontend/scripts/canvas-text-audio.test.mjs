import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectTextToAudio, getTextAudioEdges, disconnectTextAudio, isTextAudioConnection } from '../src/components/canvas/CanvasTextAudio.js';

const nodes = () => [
  { id: 'text', type: 'text', data: { content: '正文', prompt: '不是正文' } },
  { id: 'audio', type: 'audio', data: { prompt: '旧内容' } },
];
test('音频关闭上传入口，导入版本刷新编辑器并废弃旧文本快照', () => {
  const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  assert.match(read('components/canvas/CanvasAudioCreationPanel.jsx'), /allowDocumentUpload=\{false\}/);
  const shell = read('components/canvas/CanvasNodeShell.jsx');
  assert.match(shell, /key=\{data\?\.promptImportVersion \|\| 0\}/);
  assert.match(shell, /snapshot: undefined/);
  assert.match(read('pages/CanvasPage.jsx'), /onConnect=\{referenceGraph.onConnect\}/);
});
test('连接复制卡片正文，增加导入版本，生成真实端口连线', () => {
  const result = connectTextToAudio(nodes(), { source: 'text', target: 'audio' });
  assert.equal(result[1].data.prompt, '正文');
  assert.equal(result[1].data.promptImportVersion, 1);
  assert.equal(getTextAudioEdges(result)[0].sourceHandle, 'text-output');
  assert.equal(connectTextToAudio(result, { source: 'text', target: 'audio' }), result);
});
test('仅允许文本到音频，拒绝空正文和错误方向', () => {
  const current = nodes();
  assert.equal(isTextAudioConnection(current, { source: 'audio', target: 'text' }), false);
  current[0].data.content = '  ';
  assert.equal(connectTextToAudio(current, { source: 'text', target: 'audio' }), current);
});
test('导入时独占展开目标音频面板，保留节点位置和其他草稿', () => {
  const current = nodes();
  current[0].selected = true;
  current[0].data.creationPanelOpen = true;
  current[1].position = { x: 400, y: 200 };
  current[1].data.model = 'audio-model';
  current.push({ id: 'other', type: 'audio', selected: true, data: { prompt: '保留文字', creationPanelOpen: true } });
  const result = connectTextToAudio(current, { source: 'text', target: 'audio' });
  assert.deepEqual(result.map((node) => node.selected), [false, true, false]);
  assert.deepEqual(result.map((node) => node.data.creationPanelOpen), [false, true, false]);
  assert.equal(result[1].data.prompt, '正文');
  assert.equal(result[1].data.model, 'audio-model');
  assert.deepEqual(result[1].position, { x: 400, y: 200 });
  assert.equal(result[2].data.prompt, '保留文字');
  assert.equal(current[0].selected, true);
});
test('断线或删除源节点后保留提示词，重新连接可重新导入', () => {
  const connected = connectTextToAudio(nodes(), { source: 'text', target: 'audio' });
  const disconnected = disconnectTextAudio(connected, 'audio');
  assert.equal(disconnected[1].data.prompt, '正文');
  assert.deepEqual(getTextAudioEdges(disconnected), []);
  assert.deepEqual(getTextAudioEdges(connected.slice(1)), []);
  assert.equal(connectTextToAudio(disconnected, { source: 'text', target: 'audio' })[1].data.promptImportVersion, 2);
});
