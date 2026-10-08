import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectTextToAudio, getTextAudioEdges, disconnectTextAudio, isTextAudioConnection } from '../src/components/canvas/CanvasTextAudio.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';

const updateContent = (history, id, content) => history.setNodes((current) => current.map((node) => node.id === id
  ? { ...node, data: { ...node.data, content } } : node));
const audioData = (history) => history.getSnapshot().nodes.find((node) => node.id === 'audio').data;

test('空文本先连线，后续正文及清空均同步，撤销重做包含音频台词', () => {
  const current = nodes();
  current[0].data.content = '';
  const history = createCanvasHistory(connectTextToAudio(current, { source: 'text', target: 'audio' }));
  updateContent(history, 'text', '后输入');
  assert.equal(audioData(history).prompt, '旧内容\n后输入');
  updateContent(history, 'text', '第二版');
  assert.equal(audioData(history).prompt, '旧内容\n第二版');
  history.undo();
  assert.equal(audioData(history).prompt, '旧内容\n后输入');
  history.redo();
  assert.equal(audioData(history).prompt, '旧内容\n第二版');
  updateContent(history, 'text', '');
  assert.equal(audioData(history).prompt, '旧内容');
});

test('音频台词独立编辑或添加高级标记后，不被上游更新覆盖', () => {
  for (const prompt of ['手动编辑', '{happy}正文{/happy}', '正文<#0.5#>', '']) {
    const history = createCanvasHistory(connectTextToAudio(nodes(), { source: 'text', target: 'audio' }));
    history.setNodes((current) => current.map((node) => node.id === 'audio' ? { ...node, data: { ...node.data, prompt } } : node));
    const version = audioData(history).promptImportVersion;
    updateContent(history, 'text', '新的上游文字');
    assert.equal(audioData(history).prompt, prompt);
    assert.equal(audioData(history).textSync.edited, true);
    assert.equal(audioData(history).promptImportVersion, version);
  }
});

test('多来源按连线顺序同步，断线及删除保留文字，重连追加', () => {
  const current = [...nodes(), { id: 'second', type: 'text', data: { content: '第二来源' } }];
  const history = createCanvasHistory(connectTextToAudio(connectTextToAudio(current,
    { source: 'text', target: 'audio' }), { source: 'second', target: 'audio' }));
  updateContent(history, 'text', '第一来源更新');
  assert.equal(audioData(history).prompt, '旧内容\n第一来源更新\n第二来源');
  history.setNodes((items) => disconnectTextAudio(items, 'audio', 'text'));
  updateContent(history, 'text', '断线后修改');
  assert.equal(audioData(history).prompt, '旧内容\n第一来源更新\n第二来源');
  history.setNodes((items) => connectTextToAudio(items, { source: 'text', target: 'audio' }));
  assert.equal(audioData(history).prompt, '旧内容\n第一来源更新\n第二来源\n断线后修改');
  history.setNodes((items) => items.filter((node) => node.id !== 'second'));
  updateContent(history, 'text', '重连后更新');
  assert.equal(audioData(history).prompt, '旧内容\n第一来源更新\n第二来源\n重连后更新');
});

test('占位状态使用实际配音正文，预填和后续编辑均检查且不将挂载当作用户修改', () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasAudioCreationPanel.jsx', import.meta.url), 'utf8');
  assert.match(source, /hasContent=\{hasText\}/);
  assert.match(source, /setHasText\(Boolean\(snapshot.requestText\?\.trim\(\)\)\)/);
  assert.match(source, /queueMicrotask\(\(\) => \{ if \(active\) syncDraft\(\); \}\)/);
  assert.match(source, /lastRequestTextRef.current !== snapshot.requestText/);
});

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
  assert.equal(result[1].data.prompt, '旧内容\n正文');
  assert.equal(result[1].data.promptImportVersion, 1);
  assert.equal(getTextAudioEdges(result)[0].sourceHandle, 'text-output');
  assert.equal(connectTextToAudio(result, { source: 'text', target: 'audio' }), result);
});
test('允许空文本建立连线但不追加，拒绝错误方向', () => {
  const current = nodes();
  assert.equal(isTextAudioConnection(current, { source: 'audio', target: 'text' }), false);
  current[0].data.content = '  ';
  assert.equal(connectTextToAudio(current, { source: 'text', target: 'audio' })[1].data.prompt, '旧内容');
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
  assert.equal(result[1].data.prompt, '旧内容\n正文');
  assert.equal(result[1].data.model, 'audio-model');
  assert.deepEqual(result[1].position, { x: 400, y: 200 });
  assert.equal(result[2].data.prompt, '保留文字');
  assert.equal(current[0].selected, true);
});
test('断线或删除源节点后保留提示词，重新连接可重新导入', () => {
  const connected = connectTextToAudio(nodes(), { source: 'text', target: 'audio' });
  const disconnected = disconnectTextAudio(connected, 'audio');
  assert.equal(disconnected[1].data.prompt, '旧内容\n正文');
  assert.deepEqual(getTextAudioEdges(disconnected), []);
  assert.deepEqual(getTextAudioEdges(connected.slice(1)), []);
  assert.equal(connectTextToAudio(disconnected, { source: 'text', target: 'audio' })[1].data.promptImportVersion, 2);
  assert.equal(connectTextToAudio(disconnected, { source: 'text', target: 'audio' })[1].data.prompt, '旧内容\n正文\n正文');
});
