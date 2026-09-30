import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectCanvasTextVideo, disconnectCanvasTextVideo, getCanvasTextVideoEdges, isCanvasTextVideoConnection } from '../src/components/canvas/CanvasTextVideo.js';

test('文本到视频只保存素材连线，不回填视频提示词', () => {
  const text = createCanvasNode('text', undefined, 'text');
  const video = createCanvasNode('video', undefined, 'video');
  text.data.content = '参考正文';
  let nodes = connectCanvasTextVideo([text, video], { source: 'text', target: 'video', sourceHandle: 'text-output', targetHandle: 'video-input' });
  assert.deepEqual(nodes[1].data.textSourceIds, ['text']);
  assert.equal(nodes[1].data.prompt, '');
  assert.equal(getCanvasTextVideoEdges(nodes)[0].target, 'video');
  nodes = disconnectCanvasTextVideo(nodes, 'video', 'text');
  assert.deepEqual(nodes[1].data.textSourceIds, []);
});

test('文本到视频只接受正确方向和端口', () => {
  const nodes = [createCanvasNode('text', undefined, 'text'), createCanvasNode('video', undefined, 'video')];
  assert.equal(isCanvasTextVideoConnection(nodes, { source: 'text', target: 'video' }), true);
  assert.equal(isCanvasTextVideoConnection(nodes, { source: 'video', target: 'text' }), false);
  assert.equal(isCanvasTextVideoConnection(nodes, { source: 'text', target: 'video', targetHandle: 'text-input' }), false);
});
