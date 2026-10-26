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
  nodes.at(-1).data.asset = null;
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
  assert.throws(() => planCanvasImageGeneration([target], 'target', '创作', 'image-model', { imageReferenceLimit: 0 }), /超过/);
  const empty = node('image', 'empty');
  empty.data.asset = null;
  target.data.imageSourceIds = ['empty'];
  assert.equal(canConnectCanvasImage([target, empty, node('image', 'new')], { source: 'new', target: 'target' }, 2), false);
  assert.deepEqual(getCanvasImageReferenceStatus([target, empty], 'target', 1).overflowSourceIds, ['empty']);
  assert.throws(() => planCanvasImageGeneration([target, empty], 'target', '创作', 'image-model', { imageReferenceLimit: 1 }), /超过/);
});

const generation = await import('../src/components/canvas/CanvasImageGeneration.js');
const { getCanvasAbsolutePosition, groupCanvasNodes } = await import('../src/components/canvas/CanvasGroups.js');
const { createCanvasTextRequests } = await import('../src/components/canvas/CanvasTextRequests.js');

for (const count of [1, 2, 3, 4, 6, 9]) {
  test('批量生成 ' + count + ' 张：卡片数量、排列和共同上游一致', () => {
    const target = node('image', 'empty', ['ref', 'text']);
    target.data.asset = null;
    target.data.imageReferenceLimit = 2;
    const initial = [node('image', 'ref'), node('text', 'text', [], '参考文字'), target];
    const plan = planCanvasImageGeneration(initial, target.id, '生成', 'model', { count, ratio: '9:16' });
    const pending = generation.beginCanvasImageGeneration(initial, plan);
    const results = plan.resultIds.map((id) => pending.find((item) => item.id === id));
    assert.equal(results.length, count);
    assert.equal(pending.length, initial.length + count - 1);
    for (const result of results) {
      assert.deepEqual(result.data.imageSourceIds, ['ref', 'text']);
      assert.equal(result.data.generating, true);
    }
    if (count < 4) assert.equal(new Set(results.map((item) => item.position.x)).size, 1);
    else {
      assert.equal(new Set(results.map((item) => item.position.x)).size, Math.ceil(Math.sqrt(count)));
      assert.ok(new Set(results.map((item) => item.position.y)).size > 1);
    }
    const assets = Array.from({ length: count }, (_, i) => ({ url: '/result-' + i, asset_type: 'image', width: 900, height: 1600 }));
    const done = generation.applyCanvasImageResult(pending, plan, assets);
    plan.resultIds.forEach((id, i) => {
      const result = done.find((item) => item.id === id);
      assert.equal(result.data.asset.url, assets[i].url);
      assert.equal(result.data.generating, false);
      assert.deepEqual(generation.getCanvasImageEdges(done).filter((edge) => edge.target === id).map((edge) => edge.source), ['ref', 'text']);
    });
  });
}

test('已有图片生成多张时保留原图，新增结果都归组且连接原图与其他参考', () => {
  const target = node('image', 'target', ['text']);
  target.data.imageReferenceLimit = 2;
  const initial = groupCanvasNodes([target], 'group');
  initial.push(node('text', 'text', [], '参考文字'));
  const before = getCanvasAbsolutePosition(initial, initial.find((item) => item.id === 'target'));
  const plan = planCanvasImageGeneration(initial, 'target', '生成', 'model', { count: 4 });
  const pending = generation.beginCanvasImageGeneration(initial, plan);
  assert.equal(pending.length, initial.length + 4);
  assert.equal(pending.find((item) => item.id === 'target').data.asset.url, '/target.png');
  assert.deepEqual(getCanvasAbsolutePosition(pending, pending.find((item) => item.id === 'target')), before);
  plan.resultIds.forEach((id) => {
    const result = pending.find((item) => item.id === id);
    assert.equal(result.parentId, 'group');
    assert.deepEqual(result.data.imageSourceIds, ['text', 'target']);
  });
});

test('删除首个结果不取消剩余任务，结果按原索引写入；全部删除才取消', () => {
  const target = node('image', 'empty');
  target.data.asset = null;
  const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { count: 3 });
  const requests = createCanvasTextRequests();
  const controller = requests.start(plan);
  const pending = generation.beginCanvasImageGeneration([target], plan).filter((item) => item.id !== plan.resultId);
  requests.reconcile(pending);
  assert.equal(controller.signal.aborted, false);
  const done = generation.applyCanvasImageResult(pending, plan, [{ url: '/1' }, { url: '/2' }, { url: '/3' }]);
  assert.equal(done.find((item) => item.id === plan.resultIds[1]).data.asset.url, '/2');
  requests.reconcile([]);
  assert.equal(controller.signal.aborted, true);
});

test('少返回图片时保留空卡片并提示，失败及迟到结果不覆盖已重试节点', () => {
  const target = node('image', 'empty');
  target.data.asset = null;
  const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { count: 3 });
  const pending = generation.beginCanvasImageGeneration([target], plan);
  const done = generation.applyCanvasImageResult(pending, plan, [{ url: '/1' }]);
  assert.match(done[1].data.generationError, /未返回/);
  assert.ok(done.every((item) => !item.data.generating));
  assert.deepEqual(generation.applyCanvasImageResult(done, plan, [{ url: '/late' }]), done);
  assert.ok(generation.recoverCanvasImageGenerationFailure(pending, plan).every((item) => !item.data.generating));
});

test('批量地址按索引保留预览与原图，不因缺失地址错配', () => {
  const assets = generation.getCanvasImageResultAssets({ images: ['/preview1', null, '/preview3'], imageOriginalUrls: ['/original1', null, '/original3'] });
  assert.equal(assets[0].url, '/original1');
  assert.equal(assets[0].previewUrl, '/preview1');
  assert.equal(assets[1], null);
  assert.equal(assets[2].url, '/original3');
});

test('混合成品比例排布不重叠，已有节点避让且不影响无关组', () => {
  const target = node('image', 'target');
  target.data.imageReferenceLimit = 1;
  const unrelated = { id: 'other-group', type: 'canvasGroup', position: { x: 9000, y: 9000 }, style: { width: 800, height: 800 }, data: {} };
  const obstacle = { ...node('image', 'obstacle'), position: { x: 320, y: 0 } };
  const initial = [target, obstacle, unrelated];
  const plan = planCanvasImageGeneration(initial, 'target', '生成', 'model', { count: 4 });
  const pending = generation.beginCanvasImageGeneration(initial, plan);
  assert.ok(pending.find((item) => item.id === plan.resultId).position.y > 264);
  const assets = [
    { width: 1600, height: 900 }, { width: 900, height: 1600 },
    { width: 5000, height: 100 }, { width: 100, height: 5000 },
  ].map((size, i) => ({ ...size, asset_type: 'image', url: '/' + i }));
  const done = generation.applyCanvasImageResult(pending, plan, assets);
  const { getCanvasAssetNodeSize } = awaitSize;
  const rects = plan.resultIds.map((id) => {
    const item = done.find((value) => value.id === id);
    return { ...item.position, ...getCanvasAssetNodeSize(item.data.asset) };
  });
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
  }
  assert.deepEqual(done.find((item) => item.id === unrelated.id), { ...unrelated, selected: false, data: { creationPanelOpen: false } });
});
const awaitSize = await import('../src/components/canvas/CanvasMediaSize.js');

test('图生图两张结果保存再恢复：资产编号、组归属、位置和上游完整保留', async () => {
  const { serializeCanvasDocument, readCanvasDocument } = await import('../src/components/canvas/CanvasDocument.js');
  const { resolveCanvasDocumentAssets } = await import('../src/components/canvas/CanvasAssetResolver.js');
  const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
  const target = node('image', 'target', ['text']);
  target.data.asset.asset_id = ids[0];
  target.data.imageReferenceLimit = 2;
  const initial = groupCanvasNodes([target], 'group');
  initial.push(node('text', 'text', [], '参考文字'));
  const plan = planCanvasImageGeneration(initial, 'target', '生成', 'model', { count: 2 });
  const assets = generation.getCanvasImageResultAssets({images:['/p1','/p2'],imageOriginalUrls:['/o1','/o2'],imageAssetIds:ids.slice(1),cardIds:['record1','record2']});
  const done = generation.applyCanvasImageResult(generation.beginCanvasImageGeneration(initial,plan),plan,assets);
  const document = serializeCanvasDocument(done);
  const read = readCanvasDocument({document:JSON.parse(JSON.stringify(document))});
  const restored = await resolveCanvasDocumentAssets('canvas',read.nodes,async(_,assetIds)=>({items:assetIds.map(asset_id=>({asset_id,availability:'ready',media_type:'image',original_url:'/restored/'+asset_id}))}));
  plan.resultIds.forEach((id,index)=>{
    const before=done.find(n=>n.id===id), after=restored.find(n=>n.id===id);
    assert.equal(after.data.asset.asset_id,ids[index+1]);
    assert.equal(after.parentId,'group');
    assert.deepEqual(after.position,before.position);
    assert.deepEqual(after.data.imageSourceIds,['text','target']);
    assert.ok(after.data.asset.url.startsWith('/restored/'));
  });
});

test('资产编号空位不移位，也不能拿创作记录编号冒充', async () => {
 const { serializeCanvasDocument }=await import('../src/components/canvas/CanvasDocument.js');
 const id='22222222-2222-4222-8222-222222222222';
 const assets=generation.getCanvasImageResultAssets({images:['/one','/two'],imageAssetIds:[null,id],cardIds:[id,id]});
 assert.equal(assets[0].asset_id,null); assert.equal(assets[1].asset_id,id);
 const target=node('image','result');target.data.asset=assets[0];
 assert.throws(()=>serializeCanvasDocument([target]),/永久编号/);
});
