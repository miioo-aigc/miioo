import test from 'node:test';
import assert from 'node:assert/strict';
import { addCanvasReference, getCanvasReferences, getCanvasReferenceEdges, removeCanvasReference } from '../src/components/canvas/CanvasReferences.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';

const asset = { asset_type: 'image', url: '/reference.png' };
test('视频参考按真实类型创建节点和输出端口，首尾帧给非图片保留独立槽', () => {
  let nodes = [createCanvasNode('video', undefined, 'target')];
  for (const type of ['audio', 'video', 'image']) {
    nodes = addCanvasReference(nodes, 'target', { asset_type: type, url: `/${type}` }, 'frame');
    assert.equal(nodes.at(-1).type, type);
    assert.ok(getCanvasReferenceEdges(nodes).some((edge) => edge.sourceHandle === `${type}-output`));
  }
  const refs = getCanvasReferences(nodes, 'target');
  assert.equal(refs[0].asset.asset_type, 'image');
  assert.equal(refs[0].slot, 0);
  assert.ok(refs.slice(1).every((ref) => ref.slot >= 2));
});
test('参考图创建独立编号节点，目标保持展开，连线和缩略图来自同一引用', () => {
  const target = createCanvasNode('video', { x: 500, y: 200 }, 'target');
  const nodes = addCanvasReference([target], 'target', asset, 'frame');
  assert.equal(nodes.length, 2);
  assert.equal(nodes[1].type, 'image');
  assert.equal(nodes[1].data.label, '图片1');
  assert.equal(nodes[0].selected, true);
  assert.equal(nodes[1].selected, false);
  assert.equal(getCanvasReferences(nodes, 'target')[0].asset.url, asset.url);
  assert.equal(getCanvasReferenceEdges(nodes)[0].source, nodes[1].id);
  assert.equal(getCanvasReferenceEdges(nodes)[0].targetHandle, 'video-input');
});
test('首尾帧最多两张，删除首帧不改变尾帧身份，补充图片填回首帧', () => {
  let nodes = [createCanvasNode('video', undefined, 'target')];
  nodes = addCanvasReference(nodes, 'target', asset, 'frame');
  nodes = addCanvasReference(nodes, 'target', asset, 'frame');
  assert.equal(addCanvasReference(nodes, 'target', asset, 'frame'), nodes);
  const [first, last] = getCanvasReferences(nodes, 'target');
  nodes = removeCanvasReference(nodes, 'target', first.id);
  assert.equal(nodes.length, 3);
  assert.equal(getCanvasReferences(nodes, 'target')[0].slot, 1);
  nodes = addCanvasReference(nodes, 'target', asset, 'frame');
  assert.equal(getCanvasReferences(nodes, 'target')[1].id, last.id);
});
test('源节点删除或替换资源后缩略图同步，非法素材不新增节点', () => {
  let nodes = addCanvasReference([createCanvasNode('image', undefined, 'target')], 'target', asset);
  const sourceId = nodes[1].id;
  nodes = nodes.map((node) => node.id === sourceId ? { ...node, data: { ...node.data, asset: { ...asset, url: '/new.png' } } } : node);
  assert.equal(getCanvasReferences(nodes, 'target')[0].asset.url, '/new.png');
  nodes = nodes.filter((node) => node.id !== sourceId);
  assert.deepEqual(getCanvasReferenceEdges(nodes), []);
  assert.equal(addCanvasReference(nodes, 'missing', asset), nodes);
  assert.equal(addCanvasReference(nodes, 'target', { asset_type: 'video', url: '/a.mp4' }), nodes);
});
test('普通模式保留多图，首尾帧满额不新增，源节点不继承目标提示词', () => {
  const target = createCanvasNode('video', undefined, 'target');
  target.data.prompt = '目标描述';
  let nodes = [target];
  for (let i = 0; i < 3; i += 1) nodes = addCanvasReference(nodes, 'target', asset, 'all');
  assert.equal(getCanvasReferences(nodes, 'target').length, 3);
  assert.equal(addCanvasReference(nodes, 'target', asset, 'frame'), nodes);
  assert.equal(nodes[3].data.label, '图片3');
  assert.equal(nodes[3].data.prompt, '');
  assert.notDeepEqual(nodes[1].position, nodes[2].position);
});
