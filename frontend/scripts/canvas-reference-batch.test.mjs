import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { planCanvasReferenceBatch } from '../src/components/canvas/CanvasReferenceBatch.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { getCanvasMediaFileType } from '../src/components/canvas/CanvasLocalMedia.js';

const image = (id) => ({ asset_type: 'image', url: `/image-${id}.png` });
test('图片批量参考参与生成，整批撤销重做', () => {
  const target = createCanvasNode('image', { x: 0, y: 0 }, 'target');
  target.data.imageReferenceLimit = 3;
  const history = createCanvasHistory([target]);
  const result = planCanvasReferenceBatch([target], target.id, [image(1), image(2)]);
  assert.equal(result.allowed, true);
  assert.equal(result.nodes.length, 3);
  assert.equal(result.nodes.find((node) => node.id === target.id).data.imageSourceIds.length, 2);
  history.setNodes(result.nodes);
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, 1);
  history.redo();
  assert.equal(history.getSnapshot().nodes.length, 3);
  history.dispose();
});
test('参考超量整批拒绝，计入当前素材和手动连线', () => {
  const target = createCanvasNode('image', { x: 0, y: 0 }, 'target');
  target.data.imageReferenceLimit = 2;
  target.data.asset = image(0);
  const nodes = [target];
  const result = planCanvasReferenceBatch(nodes, target.id, [image(1), image(2)]);
  assert.equal(result.allowed, false);
  assert.equal(result.nodes, nodes);
  target.data.imageReferenceLimit = 0;
  assert.equal(planCanvasReferenceBatch(nodes, target.id, [image(1)]).allowed, false);
});
test('视频逐项累加类型和总数限制', () => {
  const target = createCanvasNode('video', { x: 0, y: 0 }, 'target');
  target.data.videoCapabilities = { max_reference_images: 3, max_reference_audios: 1, max_total_attachments: 2 };
  const audio = { asset_type: 'audio', url: '/audio.mp3' };
  assert.equal(planCanvasReferenceBatch([target], target.id, [image(1), audio]).allowed, true);
  assert.equal(planCanvasReferenceBatch([target], target.id, [image(1), image(2), audio]).allowed, false);
  assert.equal(planCanvasReferenceBatch([target], target.id, [audio, audio]).allowed, false);
});
test('首尾帧拒绝第三张图片，本地入口识别混合类型', () => {
  const target = createCanvasNode('video', { x: 0, y: 0 }, 'target');
  target.data.videoCapabilities = { max_reference_images: 9 };
  assert.equal(planCanvasReferenceBatch([target], target.id, [image(1), image(2)], 'frame').allowed, true);
  assert.equal(planCanvasReferenceBatch([target], target.id, [image(1), image(2), image(3)], 'frame').allowed, false);
  for (const type of ['image', 'video', 'audio']) {
    const name = type === 'audio' ? 'sound.mp3' : 'file';
    assert.equal(getCanvasMediaFileType({ name, size: 10, type: `${type}/test` }, 'all'), type);
  }
});
