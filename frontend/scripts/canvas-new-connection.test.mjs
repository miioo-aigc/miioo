import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { connectCanvasImage, getCanvasImageEdges, planCanvasImageGeneration } from '../src/components/canvas/CanvasImageGeneration.js';
import { connectCanvasVideo, getCanvasVideoEdges } from '../src/components/canvas/CanvasVideoGeneration.js';
import { getCanvasNewConnectionError } from '../src/components/canvas/CanvasNewConnection.js';

const node = (type, id) => createCanvasNode(type, { x: 0, y: 0 }, id);
const connection = { source: 'source', target: 'target' };
const options = { retainInvalid: true };

test('图片拖线新建保留关系，等待能力再提示；普通接线仍拦截', () => {
  const initial = [node('image', 'source'), node('image', 'target')];
  assert.equal(connectCanvasImage(initial, connection), initial);
  const connected = connectCanvasImage(initial, connection, undefined, options);
  assert.equal(getCanvasImageEdges(connected).length, 1);
  assert.equal(getCanvasNewConnectionError(connected, connection), null);
  connected[1].data.imageReferenceLimit = 0;
  assert.match(getCanvasNewConnectionError(connected, connection), /不支持图片参考/);
  assert.equal(getCanvasImageEdges(connected)[0].data.overflow, true);
  assert.throws(() => planCanvasImageGeneration(connected, 'target', '测试', 'model'), /参考/);
  connected[1].data.imageReferenceLimit = 1;
  assert.equal(getCanvasNewConnectionError(connected, connection), '');
  assert.equal(getCanvasImageEdges(connected)[0].data.overflow, false);
});

for (const type of ['image', 'video', 'audio']) {
  test(`${type}拖线新建视频保留关系，能力更新后重新判定红线`, () => {
    const initial = [node(type, 'source'), node('video', 'target')];
    assert.equal(connectCanvasVideo(initial, connection), initial);
    const connected = connectCanvasVideo(initial, connection, undefined, options);
    assert.equal(getCanvasVideoEdges(connected).length, 1);
    assert.equal(getCanvasNewConnectionError(connected, connection), null);
    connected[1].data.videoCapabilities = {};
    assert.match(getCanvasNewConnectionError(connected, connection), /不支持/);
    assert.equal(getCanvasVideoEdges(connected)[0].data.overflow, true);
    connected[1].data.videoCapabilities = { max_reference_images: 1, max_reference_videos: 1, max_reference_audios: 1 };
    assert.equal(getCanvasNewConnectionError(connected, connection), '');
    assert.equal(getCanvasVideoEdges(connected)[0].data.overflow, false);
  });
}

test('保留连线不绕过节点类型和端口方向规则，删除关系后不再提示', () => {
  const initial = [node('video', 'source'), node('image', 'target')];
  assert.equal(connectCanvasImage(initial, connection, undefined, options), initial);
  assert.equal(connectCanvasVideo(initial, { ...connection, targetHandle: 'text-input' }, undefined, options), initial);
  assert.equal(getCanvasNewConnectionError(initial, connection), '');
  assert.equal(getCanvasNewConnectionError([], connection), '');
});
