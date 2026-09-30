import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import {
  canConnectCanvasImage,
  connectCanvasImage,
  getCanvasImageReferenceStatus,
  getCanvasImageEdges,
  getCanvasImageConnectionError,
  getImageReferenceLimit,
  hasUnsupportedCanvasImageReferences,
  isCanvasImageConnection,
  planCanvasImageGeneration,
} from '../src/components/canvas/CanvasImageGeneration.js';
import { getCanvasReferenceNodePosition } from '../src/components/canvas/CanvasReferences.js';

const node = (type, id, imageSourceIds = [], content = '') => ({
  ...createCanvasNode(type, { x: 0, y: 0 }, id),
  data: { ...createCanvasNode(type, { x: 0, y: 0 }, id).data, imageSourceIds, content, asset: type === 'image' ? { url: `/${id}.png` } : null },
});

test('图片输入接受文本和图片，拒绝视频音频、反向连接和错误端口', () => {
  const nodes = [node('text', 'text'), node('image', 'image'), node('image', 'image-source'), node('video', 'video'), node('audio', 'audio')];
  assert.equal(isCanvasImageConnection(nodes, { source: 'text', target: 'image', sourceHandle: 'text-output', targetHandle: 'image-input' }), true);
  assert.equal(isCanvasImageConnection(nodes, { source: 'image-source', target: 'image', sourceHandle: 'image-output', targetHandle: 'image-input' }), true);
  assert.equal(isCanvasImageConnection(nodes, { source: 'video', target: 'image' }), false);
  assert.equal(isCanvasImageConnection(nodes, { source: 'image', target: 'text' }), false);
  assert.equal(isCanvasImageConnection(nodes, { source: 'text', target: 'image', targetHandle: 'text-input' }), false);
});

test('图片参考上限读取后端字段 max_reference_images', () => {
  assert.equal(getImageReferenceLimit({ max_reference_images: 2 }), 2);
  assert.equal(getImageReferenceLimit({ max_reference_images: 0 }), 0);
});

test('历史图片连线仍按直连素材识别，未声明能力按零张处理', () => {
  const nodes = [node('image', 'i1'), node('image', 'i2'), node('text', 't'), node('image', 'target', ['i1', 't', 'i2'])];
  assert.deepEqual(getCanvasImageReferenceStatus(nodes, 'target', 1), { imageSourceIds: ['i1', 'i2'], overflowSourceIds: ['i2'], canGenerate: false });
  assert.deepEqual(getCanvasImageReferenceStatus(nodes, 'target', undefined), { imageSourceIds: ['i1', 'i2'], overflowSourceIds: ['i1', 'i2'], canGenerate: false });
  assert.equal(getCanvasImageReferenceStatus(nodes, 'target', 2).canGenerate, true);
});

test('支持参考图时允许图片连线，文本连线不受图片数量限制', () => {
  const initial = [node('image', 'i1'), node('text', 't'), node('image', 'target', ['i1'])];
  assert.equal(canConnectCanvasImage(initial, { source: 'i1', target: 'target' }, 2), true);
  const withImage = connectCanvasImage(initial, { source: 'i1', target: 'target' }, 2);
  assert.deepEqual(withImage.find((item) => item.id === 'target').data.imageSourceIds, ['i1']);
  const withText = connectCanvasImage(initial, { source: 't', target: 'target' }, 2);
  assert.deepEqual(withText.find((item) => item.id === 'target').data.imageSourceIds, ['i1', 't']);
  assert.deepEqual(getCanvasImageEdges(withText).map((edge) => `${edge.source}->${edge.target}`), ['i1->target', 't->target']);
});

test('达到上限或未声明能力时拒绝图片连线并提供原因', () => {
  const nodes = [node('image', 'i1'), node('image', 'i2'), node('image', 'target', ['i1'])];
  assert.equal(canConnectCanvasImage(nodes, { source: 'i2', target: 'target' }, 1), false);
  assert.match(getCanvasImageConnectionError(nodes, { source: 'i2', target: 'target' }, 1), /最多支持 1 张/);
  assert.equal(canConnectCanvasImage(nodes, { source: 'i2', target: 'target' }), false);
  assert.match(getCanvasImageConnectionError(nodes, { source: 'i2', target: 'target' }), /不支持图片参考/);
});

test('未声明图片参考能力时，图片历史连线保留并阻止图片创作', () => {
  const nodes = [node('image', 'source'), node('image', 'target', ['source'])];
  assert.equal(hasUnsupportedCanvasImageReferences(nodes, 'target'), true);
  // 已存在的历史连线允许幂等连接；真正新增图片素材仍会被能力上限拦截。
  assert.equal(canConnectCanvasImage(nodes, { source: 'source', target: 'target' }), true);
  assert.throws(() => planCanvasImageGeneration(nodes, 'target', '生成一张图', 'image-model'), /参考图片数量超过当前模型上限/);
});

test('新增图片素材节点优先放在目标卡片左侧400px内且不重叠', () => {
  const nodes = [
    { ...node('image', 'target'), position: { x: 500, y: 500 } },
  ];
  const position = getCanvasReferenceNodePosition(nodes, nodes[0]);
  assert.equal(position.x, 180);
  assert.equal(position.y, 500);
});

test('左侧被占用时，在400px范围内优先选择上侧或左上斜向位置', () => {
  const target = { ...node('image', 'target'), position: { x: 500, y: 500 } };
  const occupiedLeft = { ...node('image', 'occupied-left'), position: { x: 180, y: 500 } };
  const position = getCanvasReferenceNodePosition([target, occupiedLeft], target);
  assert.deepEqual(position, { x: 500, y: 180 });
});

test('图片节点已有图片时，图片创作计划会把自身图片作为素材', () => {
  const target = node('image', 'target');
  const plan = planCanvasImageGeneration([target], 'target', '保持构图并优化细节', 'image-model', { imageReferenceLimit: 1 });
  assert.deepEqual(plan.sources.map((source) => source.id), ['target']);
  assert.deepEqual(plan.sources[0].asset, target.data.asset);
});
