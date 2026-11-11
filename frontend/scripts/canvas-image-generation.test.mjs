import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  data: { ...createCanvasNode(type, { x: 0, y: 0 }, id).data, imageSourceIds, content, asset: type === 'image' ? { url: `/${id}.png`, asset_id: '11111111-1111-4111-8111-111111111111', asset_type: 'image' } : null },
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
  assert.equal(getImageReferenceLimit({}), undefined);
  assert.equal(getImageReferenceLimit(), undefined);
});

test('历史图片连线仍按直连素材识别，能力未声明时按未知处理不标红', () => {
  const nodes = [node('image', 'i1'), node('image', 'i2'), node('text', 't'), node('image', 'target', ['i1', 't', 'i2'])];
  nodes.at(-1).data.asset = null;
  assert.deepEqual(getCanvasImageReferenceStatus(nodes, 'target', 1), { imageSourceIds: ['i1', 'i2'], overflowSourceIds: ['i2'], canGenerate: false });
  assert.deepEqual(getCanvasImageReferenceStatus(nodes, 'target', undefined), { imageSourceIds: ['i1', 'i2'], overflowSourceIds: [], canGenerate: true });
  assert.deepEqual(getCanvasImageReferenceStatus(nodes, 'target'), { imageSourceIds: ['i1', 'i2'], overflowSourceIds: [], canGenerate: true });
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

test('达到上限时拒绝图片连线并提供原因，能力未知时放行', () => {
  const nodes = [node('image', 'i1'), node('image', 'i2'), node('image', 'target', ['i1'])];
  assert.equal(canConnectCanvasImage(nodes, { source: 'i2', target: 'target' }, 1), false);
  assert.match(getCanvasImageConnectionError(nodes, { source: 'i2', target: 'target' }, 1), /最多支持 1 张/);
  assert.equal(canConnectCanvasImage(nodes, { source: 'i2', target: 'target' }), true);
  assert.equal(getCanvasImageConnectionError(nodes, { source: 'i2', target: 'target' }), '');
});

test('真实上限为 0 时仍标红并拒绝新增图片参考', () => {
  const nodes = [node('image', 'i1'), node('image', 'i2'), node('image', 'target', ['i1'])];
  nodes.at(-1).data.imageReferenceLimit = 0;
  const status = getCanvasImageReferenceStatus(nodes, 'target');
  assert.deepEqual(status.overflowSourceIds, ['i1']);
  assert.equal(status.canGenerate, false);
  assert.equal(getCanvasImageEdges(nodes).find((edge) => edge.source === 'i1').className, 'canvas-edge--overflow');
  assert.equal(canConnectCanvasImage(nodes, { source: 'i2', target: 'target' }), false);
  assert.match(getCanvasImageConnectionError(nodes, { source: 'i2', target: 'target' }), /不支持图片参考/);
});

test('未声明图片参考能力时保留图片历史连线，不因未知拦截创作', () => {
  const nodes = [node('image', 'source'), node('image', 'target', ['source'])];
  assert.equal(hasUnsupportedCanvasImageReferences(nodes, 'target'), true);
  // 已存在的历史连线允许幂等连接；真正新增图片素材仍会被能力上限拦截。
  assert.equal(canConnectCanvasImage(nodes, { source: 'source', target: 'target' }), true);
  assert.doesNotThrow(() => planCanvasImageGeneration(nodes, 'target', '生成一张图', 'image-model'));
  // 真实上限为 0 时仍拦截创作。
  const blocked = [node('image', 'source'), node('image', 'target', ['source'])];
  blocked.at(-1).data.imageReferenceLimit = 0;
  assert.throws(() => planCanvasImageGeneration(blocked, 'target', '生成一张图', 'image-model'), /参考图片数量超过当前模型上限/);
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

const generation = await import('../src/components/canvas/CanvasImageGeneration.js');
const { groupCanvasNodes } = await import('../src/components/canvas/CanvasGroups.js');
const { createCanvasTextRequests } = await import('../src/components/canvas/CanvasTextRequests.js');
const assetId = (index) => '11111111-1111-4111-8111-' + String(index).padStart(12, '0');
const asset = (index) => ({ asset_id: assetId(index), asset_type: 'image', url: '/result-' + index });
const targetNode = () => { const target = node('image', 'target'); target.data.asset = asset(100); return target; };

test('自身结果及显式自引用均不参与输入，也不占参考名额', () => {
  const target = targetNode(); target.data.imageSourceIds = ['target'];
  const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { imageReferenceLimit: 0 });
  assert.deepEqual(plan.sources, []);
  assert.equal(plan.resultId, target.id);
  assert.equal(plan.createsResult, false);
});
for (const count of [1, 2, 3, 4, 6, 9]) {
  test('批量生成 ' + count + ' 张只更新同一节点并保留位置分组连线', () => {
    const target = targetNode(); target.data.imageSourceIds = ['text'];
    const initial = groupCanvasNodes([target], 'group'); initial.push(node('text', 'text', [], '参考正文'));
    const before = structuredClone(initial);
    const plan = planCanvasImageGeneration(initial, target.id, '生成', 'model', { count });
    const pending = generation.beginCanvasImageGeneration(initial, plan);
    assert.equal(pending.length, initial.length);
    const running = pending.find((item) => item.id === target.id);
    assert.deepEqual(running.data.asset, target.data.asset);
    assert.equal(running.data.submissionLocked, true);
    assert.deepEqual(running.data.executionSourceIds, ['text']);
    assert.equal(running.data.nodeResults, undefined);
    plan.taskIds = ['real-server-task'];
    const done = generation.applyCanvasImageResult(pending, plan, Array.from({ length: count }, (_, i) => asset(i)));
    const output = done.find((item) => item.id === target.id);
    assert.equal(output.data.asset.asset_id, assetId(0));
    assert.equal(output.data.nodeResults.batches.length, 2);
    assert.equal(output.data.nodeResults.batches[0].source, 'legacy');
    assert.equal(output.data.nodeResults.batches[1].results.length, count);
    assert.deepEqual(output.data.nodeResults.batches[1].taskIds, ['real-server-task']);
    assert.equal(output.data.submissionLocked, false);
    assert.equal(output.data.executionSourceIds, undefined);
    assert.equal(output.data.generating, false);
    assert.deepEqual(output.position, running.position);
    assert.equal(output.parentId, running.parentId);
    assert.deepEqual(output.data.imageSourceIds, ['text']);
    assert.equal(done[0], initial[0]); assert.equal(done.at(-1), initial.at(-1));
    assert.deepEqual(initial, before);
  });
}
test('部分成功按稳定索引选第一有效UUID，不拿记录编号替代资产', () => {
  const target = targetNode();
  const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { count: 4 });
  const assets = generation.getCanvasImageResultAssets({ images: ['/invalid', null, '/two', '/three'],
    imageAssetIds: [null, null, assetId(2), assetId(3)], cardIds: [assetId(1)] });
  assert.equal(generation.getCanvasImageGenerationSummary(plan, assets).successCount, 2);
  const [done] = generation.applyCanvasImageResult(generation.beginCanvasImageGeneration([target], plan), plan, assets);
  assert.equal(done.data.asset.asset_id, assetId(2));
  assert.deepEqual(done.data.nodeResults.batches[1].results.map((result) => result.index), [2, 3]);
  assert.equal(done.data.nodeResults.batches[1].status, 'partial');
});
test('全部失败或无永久编号保留旧结果与历史，不创建失败批次', () => {
  for (const assets of [[], [null], [{ url: '/not-durable', asset_id: 'temporary' }]]) {
    const target = targetNode();
    const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { count: 3 });
    const [done] = generation.applyCanvasImageResult(generation.beginCanvasImageGeneration([target], plan), plan, assets);
    assert.deepEqual(done.data.asset, target.data.asset);
    assert.equal(done.data.nodeResults, undefined);
    assert.equal(done.data.generating, false); assert.equal(done.data.submissionLocked, false);
  }
});
test('删除节点取消本地请求，迟到和重复结果不复活或重复追加', () => {
  const target = targetNode(); const plan = planCanvasImageGeneration([target], target.id, '生成', 'model');
  const requests = createCanvasTextRequests(); const controller = requests.start(plan);
  const pending = generation.beginCanvasImageGeneration([target], plan);
  requests.reconcile(pending); assert.equal(controller.signal.aborted, false);
  assert.throws(() => requests.start({ ...plan, requestId: 'another' }), /正在创作/);
  requests.reconcile([]); assert.equal(controller.signal.aborted, true);
  assert.deepEqual(generation.applyCanvasImageResult([], plan, [asset(0)]), []);
  const done = generation.applyCanvasImageResult(pending, plan, [asset(0)]);
  assert.equal(generation.applyCanvasImageResult(done, plan, [asset(1)]), done);
});
test('起始更新用最新状态拒绝自身及被执行快照引用的节点', () => {
  const target = targetNode(); const plan = planCanvasImageGeneration([target], target.id, '生成', 'model');
  assert.throws(() => generation.beginCanvasImageGeneration([{ ...target, data: { ...target.data, generating: true } }], plan), /下游丢失参考素材/);
  assert.throws(() => generation.beginCanvasImageGeneration([{ ...target, data: { ...target.data, submissionLocked: true } }], plan), /下游丢失参考素材/);
  const downstream = { ...node('image', 'downstream'), data: { ...node('image', 'downstream').data, submissionLocked: true, executionSourceIds: ['target'] } };
  assert.throws(() => generation.beginCanvasImageGeneration([target, downstream], plan), /下游丢失参考素材/);
  assert.throws(() => generation.beginCanvasImageGeneration([], plan), /下游丢失参考素材/);
});
test('只读直接输入及空提示词正文合并，快照不随草稿变化', () => {
  const target = targetNode(); target.data.referenceInputs = [{ sourceId: 'a', slot: 0 }, { sourceId: 'b', slot: 1 }];
  const a = node('text', 'a', ['ancestor'], '甲'), b = node('text', 'b', [], '乙');
  const params = { nested: { enabled: true } };
  const plan = planCanvasImageGeneration([target, a, b], target.id, '', 'model', params);
  assert.equal(plan.prompt, '甲\n\n乙'); assert.equal(plan.usesTextAsPrompt, true);
  a.data.content = '后来草稿'; params.nested.enabled = false;
  assert.equal(plan.sources[0].content, '甲'); assert.equal(plan.params.nested.enabled, true);
  assert.deepEqual(plan.sources.map((source) => source.id), ['a', 'b']);
});
test('无效直接上游和执行中节点拒绝，旧URL结果不能静默丢失', () => {
  const target = targetNode(); target.data.imageSourceIds = ['missing'];
  assert.throws(() => planCanvasImageGeneration([target], target.id, '生成', 'model'), /失效/);
  target.data.imageSourceIds = ['text']; const text = node('text', 'text', [], '');
  assert.throws(() => planCanvasImageGeneration([target, text], target.id, '生成', 'model'), /有效结果/);
  text.data.content = '正文'; text.data.generating = true;
  assert.throws(() => planCanvasImageGeneration([target, text], target.id, '生成', 'model'), /正在创作/);
  target.data.imageSourceIds = []; target.data.asset = { url: '/legacy-no-id' };
  assert.throws(() => planCanvasImageGeneration([target], target.id, '生成', 'model'), /永久资产编号/);
});
test('同节点多候选序列化重读完整保留历史和当前投影', async () => {
  const { serializeCanvasDocument, readCanvasDocument } = await import('../src/components/canvas/CanvasDocument.js');
  const target = targetNode(); const plan = planCanvasImageGeneration([target], target.id, '生成', 'model', { count: 3 });
  const done = generation.applyCanvasImageResult(generation.beginCanvasImageGeneration([target], plan), plan, [null, asset(1), asset(2)]);
  const restored = readCanvasDocument(serializeCanvasDocument(done)).nodes[0];
  assert.deepEqual(restored.data.nodeResults, done[0].data.nodeResults);
  assert.equal(restored.data.asset.asset_id, assetId(1)); assert.deepEqual(restored.position, target.position);
});

test('真实图片Hook登记任务编号并解锁，启用部分成功并提示数量', async () => {
  const source = readFileSync(new URL('../src/components/canvas/UseCanvasImageGeneration.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function useCanvasImageGeneration')).replace('export function', 'function');
  let nodes = [targetNode()];
  const toasts = [];
  const writeOptions = [];
  let activeRequests = 0;
  const requestFactory = () => {
    const requests = createCanvasTextRequests();
    const start = requests.start; const finish = requests.finish;
    requests.start = (...args) => { activeRequests++; return start(...args); };
    requests.finish = (...args) => { activeRequests--; return finish(...args); };
    return requests;
  };
  let latestNodes = nodes;
  let omitTaskIdList = false;
  let fullBatch = false;
  let apiCallCount = 0;
  const setNodes = (update, options) => {
    writeOptions.push(options);
    latestNodes = update(latestNodes);
    nodes = latestNodes;
  };
  const dependencies = {
    useCallback: (fn) => fn, useEffect: () => {}, useState: (init) => [init()],
    createCanvasTextRequests: requestFactory, getAuthSessionGeneration: () => 1,
    ensureCanvasImageAsset: async (value) => value, prepareCanvasMediaAsset: async (value) => value,
    createCanvasProgressHandler: () => () => {},
    showGlobalToast: (...args) => toasts.push(args), ...generation,
    apiGenerateCreation: async (params, options) => {
      apiCallCount++;
      assert.equal(params.canvasPartialResults, true);
      assert.equal(params.files.length, 0);
      assert.equal(latestNodes[0].data.submissionLocked, true);
      if (omitTaskIdList) {
        options.onTaskCreated({ taskId: 'real-a' });
        assert.equal(latestNodes[0].data.submissionLocked, true);
        assert.deepEqual(latestNodes[0].data.generationTaskIds, []);
      } else {
        options.onTaskCreated({ taskIds: ['real-a', 'real-b'], taskId: 'real-a' });
        assert.equal(latestNodes[0].data.submissionLocked, false);
        assert.deepEqual(latestNodes[0].data.generationTaskIds, ['real-a', 'real-b']);
      }
      return fullBatch ? { images: ['/one', '/two'], imageAssetIds: [assetId(1), assetId(2)] }
        : { images: [null, '/two'], imageAssetIds: [null, assetId(2)] };
    },
  };
  const hints = [];
  const hint = (nodeId, count) => hints.push([nodeId, count]);
  const hook = new Function(...Object.keys(dependencies), body + '; return useCanvasImageGeneration;')(...Object.values(dependencies));
  await hook(nodes, setNodes, () => {}, 'project', hint)({ nodeId: 'target', prompt: '生成', model: 'model', params: { count: 2 } });
  assert.equal(nodes[0].data.asset.asset_id, assetId(2));
  assert.equal(nodes[0].data.generating, false);
  assert.deepEqual(nodes[0].data.nodeResults.batches[1].taskIds, ['real-a', 'real-b']);
  assert.deepEqual(toasts, [['本次成功生成 1 / 2 张图片', 'warning']]);
  assert.ok(writeOptions.length > 0 && writeOptions.every((options) => options?.origin === 'system'));
  assert.deepEqual(hints, []);
  toasts.length = 0;
  omitTaskIdList = true;
  await hook(nodes, setNodes, () => {}, 'project', hint)({ nodeId: 'target', prompt: '无完整任务数组', model: 'model', params: { count: 2 } });
  assert.equal(nodes[0].data.submissionLocked, false);
  assert.deepEqual(nodes[0].data.nodeResults.batches.at(-1).taskIds, []);
  assert.deepEqual(hints, []);
  fullBatch = true;
  await hook(nodes, setNodes, () => {}, 'project', hint)({ nodeId: 'target', prompt: '一次生成两张', model: 'model', params: { count: 2 } });
  assert.deepEqual(hints, [['target', 2]]);
  assert.deepEqual(toasts, [['本次成功生成 1 / 2 张图片', 'warning']]);
  const staleNodes = nodes;
  latestNodes = [...nodes, { ...node('image', 'downstream'), data: { ...node('image', 'downstream').data,
    submissionLocked: true, executionSourceIds: ['target'] } }];
  const beforeRejectedStart = latestNodes;
  const callsBeforeRejectedStart = apiCallCount;
  const rejectedRequestHook = new Function(...Object.keys(dependencies), body + '; return useCanvasImageGeneration;')(...Object.values(dependencies));
  await rejectedRequestHook(staleNodes, setNodes, () => {}, 'project', hint)({ nodeId: 'target', prompt: '并发生成', model: 'model' });
  assert.equal(latestNodes, beforeRejectedStart);
  assert.equal(apiCallCount, callsBeforeRejectedStart);
  assert.equal(activeRequests, 0);
  assert.deepEqual(toasts.at(-1), ['操作可能导致下游丢失参考素材，请稍后再试', 'error']);
});
