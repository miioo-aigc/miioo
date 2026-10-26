import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { planCanvasReferenceBatch } from '../src/components/canvas/CanvasReferenceBatch.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { getCanvasMediaFileType } from '../src/components/canvas/CanvasLocalMedia.js';
import { getCanvasAbsolutePosition } from '../src/components/canvas/CanvasGroups.js';

const image = (id) => ({ asset_type: 'image', url: `/image-${id}.png` });
test('组内图片和视频批量新增参考素材继承直属组，原节点位置不变且整批可撤销', () => {
  for (const type of ['image', 'video']) {
    const group = (id, parentId, position) => ({ id, type: 'canvasGroup', parentId, position, style: { width: 500, height: 500 }, data: {} });
    const target = { ...createCanvasNode(type, { x: 30, y: 40 }, 'target'), parentId: 'inner' };
    target.data.imageReferenceLimit = 3;
    target.data.videoCapabilities = { max_reference_images: 3, max_total_attachments: 3 };
    const nodes = [group('outer', undefined, { x: 100, y: 200 }), group('inner', 'outer', { x: 20, y: 30 }), target];
    const before = structuredClone(nodes);
    const result = planCanvasReferenceBatch(nodes, target.id, [image(1), image(2)]);
    assert.equal(result.allowed, true);
    const added = result.nodes.filter((node) => !nodes.some((old) => old.id === node.id));
    assert.equal(added.length, 2);
    assert.ok(added.every((node) => node.parentId === 'inner'));
    assert.deepEqual(getCanvasAbsolutePosition(result.nodes, result.nodes.find((node) => node.id === target.id)), { x: 150, y: 270 });
    assert.equal(result.nodes.find((node) => node.id === target.id).data.referenceInputs.length, 2);
    assert.deepEqual(nodes, before);
    for (const child of result.nodes.filter((node) => node.parentId)) {
      const parent = result.nodes.find((node) => node.id === child.parentId);
      assert.ok(child.position.x >= 0 && child.position.y >= 0);
      assert.ok(child.position.x + (child.style?.width || 240) <= parent.style.width);
      assert.ok(child.position.y + (child.style?.height || 264) <= parent.style.height);
    }
    const history = createCanvasHistory(nodes);
    history.setNodes(result.nodes);
    history.undo();
    assert.deepEqual(history.getSnapshot().nodes.map((node) => node.id), nodes.map((node) => node.id));
    history.redo();
    assert.ok(history.getSnapshot().nodes.filter((node) => added.some((item) => item.id === node.id)).every((node) => node.parentId === 'inner'));
    history.dispose();
  }
});
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
