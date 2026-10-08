import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCanvasLeftConnection } from '../src/components/canvas/CanvasLeftConnection.js';
import { isTextAudioConnection, connectTextToAudio } from '../src/components/canvas/CanvasTextAudio.js';

const text = { id: 'text', type: 'text', data: { content: '正文' } };
const audio = { id: 'audio', type: 'audio', data: { prompt: '旧内容' } };
const nodes = [text, audio];
const validate = (connection) => isTextAudioConnection(nodes, connection);

test('文本左侧拖到音频，反向建立文本到音频并追加正文', () => {
  const connection = resolveCanvasLeftConnection(text, audio, validate);
  assert.deepEqual(connection, { source: 'text', sourceHandle: 'text-output', target: 'audio', targetHandle: 'audio-input' });
  assert.equal(connectTextToAudio(nodes, connection)[1].data.prompt, '旧内容\n正文');
});
test('音频左侧拖到文本仍优先添加文本上游', () => {
  assert.equal(resolveCanvasLeftConnection(audio, text, validate).source, 'text');
});
test('两向合法时优先上游，保留实际端口标识', () => {
  const target = { ...audio, data: { ports: { input: { id: 'custom-input' } } } };
  const connection = resolveCanvasLeftConnection(target, text, () => true);
  assert.equal(connection.source, 'text');
  assert.equal(connection.targetHandle, 'custom-input');
});
test('两向都不合法时不连接，不绕过能力校验', () => {
  assert.equal(resolveCanvasLeftConnection(text, audio, () => false), null);
  const image = { id: 'image', type: 'image', data: {} };
  assert.equal(resolveCanvasLeftConnection(audio, image, (c) => isTextAudioConnection([audio, image], c)), null);
});
test('忽略空白和自身', () => {
  assert.equal(resolveCanvasLeftConnection(text, null, () => true), null);
  assert.equal(resolveCanvasLeftConnection(text, text, () => true), null);
});
