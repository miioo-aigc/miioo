import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanvasUnavailableAssetIds,
  removeUnavailableCanvasReferences,
  serializeCanvasDocument,
  readCanvasDocument,
} from '../src/components/canvas/CanvasDocument.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { createCanvasNodeResults, commitCanvasResultBatch, selectCanvasNodeResult, projectCanvasCurrentResult } from '../src/components/canvas/CanvasNodeResults.js';

const assetId = (index) => `12345678-1234-1234-1234-${String(index).padStart(12, '0')}`;
function fixture(type = 'image', count = 2) {
  let state = createCanvasNodeResults();
  for (let index = 0; index < count; index += 1) {
    state = commitCanvasResultBatch(state, { id: `batch-${index}`, source: 'generation', requestedCount: 1,
      submittedAt: index, completedAt: index, taskIds: [`task-${index}`], snapshot: { prompt: '草稿', inputIds: ['node-a'] },
      results: [{ id: `result-${index}`, index: 0, type,
        ...(type === 'text' ? { content: index ? 'blob:正文不是媒体地址' : '第一版正文' } : { assetId: assetId(index) }) }] });
  }
  const node = createCanvasNode(type, undefined, `node-${type}`);
  node.data = { ...node.data, nodeResults: state, ...projectCanvasCurrentResult(state) };
  return node;
}
const save = (node) => serializeCanvasDocument([node]);
const restore = (document) => readCanvasDocument(document).nodes[0];
const ready = (ids) => ({ items: ids.map((id) => ({ asset_id: id, availability: 'ready', original_url: `/assets/${id}` })) });

test('文本图片视频完整历史往返，选择旧结果不丢新批次，白名单复制不共享引用', () => {
  for (const type of ['text', 'image', 'video']) {
    const node = fixture(type);
    node.data.nodeResults = selectCanvasNodeResult(node.data.nodeResults, 'result-0');
    Object.assign(node.data, projectCanvasCurrentResult(node.data.nodeResults));
    node.data.nodeResults.extra = { url: '/secret' };
    node.data.nodeResults.batches[0].controller = new AbortController();
    node.data.nodeResults.batches[0].results[0].url = 'blob:secret';
    node.data.resultAssetViews = { secret: { url: '/secret' } };
    const before = node.data.nodeResults.batches[0].snapshot;
    const document = save(node);
    assert.equal(document.schemaVersion, 1);
    assert.equal(JSON.stringify(document).includes('/secret'), false);
    assert.equal(document.records[0].props.resultAssetViews, undefined);
    assert.equal(document.records[0].props.nodeResults.extra, undefined);
    assert.equal(document.records[0].props.nodeResults.batches[0].controller, undefined);
    assert.equal(document.records[0].props.nodeResults.batches[0].results[0].url, undefined);
    const restored = restore(document);
    assert.deepEqual(restored.data.nodeResults, document.records[0].props.nodeResults);
    assert.notEqual(restored.data.nodeResults, document.records[0].props.nodeResults);
    assert.notEqual(document.records[0].props.nodeResults.batches[0].snapshot, before);
    assert.equal(restored.data.nodeResults.currentResultId, 'result-0');
    restored.data.nodeResults.batches[0].snapshot.inputIds.push('new');
    assert.deepEqual(before.inputIds, ['node-a']);
    assert.deepEqual(document.records[0].props.nodeResults.batches[0].snapshot.inputIds, ['node-a']);
  }
});

test('正文中的地址样式字符串不被通用媒体清理静默删除', () => {
  const node = fixture('text');
  assert.equal(restore(save(node)).data.content, node.data.content);
  assert.deepEqual(save(restore(save(node))), save(node));
});

test('当前素材、正文、类型及空历史投影冲突在保存和读取时均拒绝', () => {
  const mutations = [
    (node) => { node.data.asset.asset_id = assetId(99); },
    (node) => { node.data.asset.asset_type = 'video'; },
    (node) => { node.data.asset = null; },
    (node) => { node.data.content = '意外正文'; },
    (node) => { node.data.nodeResults = createCanvasNodeResults(); },
    (node) => { node.data.nodeType = 'video'; },
  ];
  for (const mutate of mutations) {
    const node = fixture();
    mutate(node);
    assert.throws(() => save(node), /不一致/);
  }
  for (const patch of [{ assetId: assetId(99) }, { assetType: 'video' }, { assetId: null }, { content: '冲突' }]) {
    const document = save(fixture());
    Object.assign(document.records[0].props, patch);
    assert.throws(() => restore(document), /不一致/);
  }
  const text = fixture('text');
  text.data.content = '其他正文';
  assert.throws(() => save(text), /不一致/);
  const document = save(fixture('text'));
  document.records[0].props.content = '其他正文';
  assert.throws(() => restore(document), /不一致/);
});

test('非法历史永久编号、节点类型和空协议均拒绝，非当前历史同样校验', () => {
  for (const invalid of ['temporary', 'https://example.test/a', '', null]) {
    const node = fixture();
    node.data.nodeResults.batches[0].results[0].assetId = invalid;
    assert.throws(() => save(node), /永久资产编号/);
    const document = save(fixture());
    document.records[0].props.nodeResults = node.data.nodeResults;
    assert.throws(() => restore(document), /永久资产编号/);
  }
  for (const type of ['audio', 'canvasGroup', 'video']) {
    const node = fixture();
    node.type = type;
    assert.throws(() => save(node), /类型/);
  }
  for (const value of [undefined, null, {}, { version: 2 }]) {
    const node = fixture();
    node.data.nodeResults = value;
    assert.throws(() => save(node), /协议/);
  }
});

test('旧节点不自动创建结果，空历史保持空且禁止投影带出素材', () => {
  for (const type of ['text', 'image', 'video', 'audio']) {
    const node = createCanvasNode(type);
    assert.equal(Object.hasOwn(restore(save(node)).data, 'nodeResults'), false);
  }
  const node = fixture('image', 0);
  assert.deepEqual(restore(save(node)).data.nodeResults, createCanvasNodeResults());
});

test('开发草稿读取校验新增协议并深复制剥离映射，未附结果的旧节点保持原行为', () => {
  const node = fixture();
  node.data.resultAssetViews = { [assetId(1)]: { url: '/secret' } };
  const old = createCanvasNode('audio');
  const document = { schema_version: 1, nodes: [node, old], edges: [] };
  const { nodes } = readCanvasDocument(document);
  assert.equal(nodes[1], old);
  assert.equal(nodes[0].data.resultAssetViews, undefined);
  assert.notEqual(nodes[0].data.nodeResults, node.data.nodeResults);
  node.data.asset = null;
  assert.throws(() => readCanvasDocument(document), /不一致/);
});

test('全部历史与旧节点资产全局去重按200分批，映射按资产编号而非结果编号', async () => {
  const node = fixture('image', 201);
  const old = createCanvasNode('image');
  old.data.asset = { asset_id: assetId(0) };
  const duplicate = fixture('image', 1);
  const batches = [];
  const controller = new AbortController();
  const before = JSON.stringify(node);
  const restored = await resolveCanvasDocumentAssets('canvas', [node, old, duplicate], async (canvas, ids, options) => {
    assert.equal(canvas, 'canvas');
    assert.equal(options.signal, controller.signal);
    batches.push(ids);
    return ready(ids);
  }, { signal: controller.signal, normalizeMediaUrl: (url) => `https://media.test${url}` });
  assert.deepEqual(batches.map((ids) => ids.length), [200, 1]);
  assert.equal(new Set(batches.flat()).size, 201);
  assert.equal(Object.keys(restored[0].data.resultAssetViews).length, 201);
  assert.equal(restored[0].data.resultAssetViews[assetId(0)].url, `https://media.test/assets/${assetId(0)}`);
  assert.equal(restored[0].data.resultAssetViews['result-0'], undefined);
  assert.equal(restored[1].data.resultAssetViews, undefined);
  assert.equal(JSON.stringify(node), before);
  assert.equal(JSON.stringify(save(restored[0])).includes('media.test'), false);
  assert.deepEqual(save(restored[0]), save(node));
});

test('明确失效状态清理不可保存历史并回退到可用定稿，回收站状态仍保留', async () => {
  for (const availability of ['missing', 'forbidden', 'trashed']) {
    const node = fixture();
    node.data.asset.url = '/stale';
    node.data.resultAssetViews = { stale: { url: '/stale' } };
    const [restored] = await resolveCanvasDocumentAssets('canvas', [node], async (_, ids) => ({
      items: ids.map((id, index) => ({ asset_id: id, media_type: 'image', availability: index ? availability : 'ready',
        original_url: '/private', title: '隐私标题' })),
    }));
    assert.equal(restored.data.asset.asset_id, assetId(1));
    assert.equal(restored.data.asset.availability, availability);
    assert.equal(restored.data.nodeResults.currentResultId, 'result-1');
    assert.equal(restored.data.resultAssetViews.stale, undefined);
    assert.deepEqual(restored.data.nodeResults, node.data.nodeResults);
    if (availability !== 'trashed') {
      assert.equal(restored.data.asset.url, undefined);
      assert.equal(restored.data.resultAssetViews[assetId(1)].url, undefined);
      assert.equal(restored.data.resultAssetViews[assetId(1)].name, undefined);
      const saved = save(restored);
      assert.equal(saved.records[0].props.nodeResults.batches.length, 1);
      assert.deepEqual(saved.records[0].props.nodeResults.batches[0].results.map((result) => result.assetId), [assetId(0)]);
      assert.equal(saved.records[0].props.nodeResults.currentResultId, 'result-0');
      assert.equal(saved.records[0].props.assetId, assetId(0));
    } else {
      assert.deepEqual(save(restored), save(node));
    }
  }
});

test('仅清理失效的非当前历史，保留可用结果、当前定稿和未受影响的批次', () => {
  const node = fixture('image', 3);
  node.data.resultAssetViews = {
    [assetId(0)]: { availability: 'ready' },
    [assetId(1)]: { availability: 'missing' },
    [assetId(2)]: { availability: 'ready' },
  };
  const saved = save(node).records[0].props;
  assert.deepEqual(saved.nodeResults.batches.map((batch) => batch.id), ['batch-0', 'batch-2']);
  assert.equal(saved.nodeResults.currentResultId, 'result-2');
  assert.equal(saved.assetId, assetId(2));
  assert.equal(node.data.nodeResults.batches.length, 3);
});

test('后端失效清单清理结果、历史快照和旧式素材字段，同时保留节点及普通文本', () => {
  const node = fixture('image', 3);
  node.data.nodeResults.currentResultId = 'result-1';
  node.data.nodeResults.selections.push({ resultId: 'result-1', reason: 'select' });
  Object.assign(node.data, projectCanvasCurrentResult(node.data.nodeResults));
  node.data.nodeResults.batches[0].snapshot.inputs = [
    { nodeId: 'source-missing', type: 'image', assetId: assetId(1) },
    { nodeId: 'source-ready', type: 'image', assetId: assetId(0) },
  ];
  node.data.resultAssetViews = {
    [assetId(0)]: { availability: 'ready' },
    [assetId(1)]: { availability: 'missing' },
    [assetId(2)]: { availability: 'ready' },
  };
  node.data.prompt = `正文保留 ${assetId(1)}`;
  node.data.settings = {
    sourceAssetId: assetId(1),
    keepAssetId: assetId(0),
    linkedId: assetId(1),
    imageAssetIds: [assetId(1), assetId(0)],
  };

  const nodes = removeUnavailableCanvasReferences([node], [assetId(1).toUpperCase()]);

  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].id, node.id);
  assert.equal(nodes[0].data.prompt, node.data.prompt);
  assert.deepEqual(nodes[0].data.nodeResults.batches.map((batch) => batch.id), ['batch-0', 'batch-2']);
  assert.equal(nodes[0].data.nodeResults.currentResultId, 'result-2');
  assert.equal(nodes[0].data.asset.asset_id, assetId(2));
  assert.deepEqual(nodes[0].data.nodeResults.batches[0].snapshot.inputs, [
    { nodeId: 'source-ready', type: 'image', assetId: assetId(0) },
  ]);
  assert.equal(nodes[0].data.resultAssetViews[assetId(1)], undefined);
  assert.equal(nodes[0].data.settings.sourceAssetId, undefined);
  assert.equal(nodes[0].data.settings.imageAssetIds.includes(assetId(1)), false);
  assert.equal(nodes[0].data.settings.keepAssetId, assetId(0));
  assert.equal(nodes[0].data.settings.linkedId, assetId(1));
});

test('失效素材错误只在 ASSET_UNAVAILABLE 时返回权威清单', () => {
  assert.deepEqual(getCanvasUnavailableAssetIds({
    code: 'ASSET_UNAVAILABLE', detail: { asset_ids: [assetId(1), assetId(1), ''] },
  }), [assetId(1)]);
  assert.deepEqual(getCanvasUnavailableAssetIds({
    status: 404, detail: { code: 'OTHER', asset_ids: [assetId(1)] },
  }), []);
});

test('旧节点当前素材丢失或无权时只保存节点壳，可用状态仍保留素材编号', () => {
  for (const availability of ['ready', 'trashed', 'missing', 'forbidden']) {
    const node = createCanvasNode('image', undefined, `legacy-${availability}`);
    node.data.asset = { asset_id: assetId(7), asset_type: 'image', availability };
    const props = save(node).records[0].props;
    assert.equal(props.assetId, ['missing', 'forbidden'].includes(availability) ? undefined : assetId(7));
    assert.equal(props.nodeType, 'image');
  }
});

test('响应漏掉非当前历史、历史可用地址无效或类型冲突均拒绝恢复', async () => {
  const node = fixture();
  await assert.rejects(resolveCanvasDocumentAssets('c', [node], async () => ready([assetId(1)])), /可用状态/);
  await assert.rejects(resolveCanvasDocumentAssets('c', [node], async (_, ids) => ({
    items: ids.map((id) => ({ asset_id: id, availability: 'ready', original_url: id === assetId(0) ? 'blob:bad' : '/good' })),
  })), /有效媒体地址/);
  await assert.rejects(resolveCanvasDocumentAssets('c', [node], async (_, ids) => ({
    items: ids.map((id) => ({ asset_id: id, availability: 'ready', media_type: 'video', original_url: '/good' })),
  })), /类型/);
});

test('解析前校验全部历史，不向接口发送非法编号或投影冲突节点', async () => {
  for (const mutate of [
    (node) => { node.data.nodeResults.batches[0].results[0].assetId = 'temporary'; },
    (node) => { node.data.asset.asset_id = assetId(99); },
  ]) {
    const node = fixture();
    mutate(node);
    await assert.rejects(resolveCanvasDocumentAssets('c', [node], async () => assert.fail('不应调用接口')));
  }
});

test('文本和空历史无需资产请求，运行态映射为空且不能保存', async () => {
  const nodes = [fixture('text'), fixture('image', 0)];
  const restored = await resolveCanvasDocumentAssets('c', nodes, async () => assert.fail('无需解析'));
  for (const node of restored) {
    assert.deepEqual(node.data.resultAssetViews, {});
    assert.equal(save(node).records[0].props.resultAssetViews, undefined);
  }
});

test('多图部分成功保留稳定空位和改选，读取也剥离注入的运行态及地址', async () => {
  const node = fixture('image', 1);
  node.data.nodeResults = commitCanvasResultBatch(node.data.nodeResults, {
    id: 'partial', source: 'generation', requestedCount: 4, submittedAt: 10, completedAt: 11,
    results: [{ index: 0, status: 'failed' },
      { id: 'candidate-1', index: 1, type: 'image', assetId: assetId(10) },
      { index: 2, status: 'failed' },
      { id: 'candidate-3', index: 3, type: 'image', assetId: assetId(11) }],
  });
  node.data.nodeResults = selectCanvasNodeResult(node.data.nodeResults, 'candidate-3');
  Object.assign(node.data, projectCanvasCurrentResult(node.data.nodeResults));
  const document = save(node);
  document.records[0].props.resultAssetViews = { private: { url: '/private' } };
  document.records[0].props.nodeResults.batches[1].results[0].previewUrl = '/private';
  const loaded = restore(document);
  assert.equal(loaded.data.resultAssetViews, undefined);
  assert.equal(loaded.data.nodeResults.batches[1].results[0].previewUrl, undefined);
  assert.deepEqual(loaded.data.nodeResults.batches[1].results.map((result) => result.index), [1, 3]);
  assert.equal(loaded.data.nodeResults.batches[1].status, 'partial');
  const [resolved] = await resolveCanvasDocumentAssets('c', [loaded], async (_, ids) => {
    assert.deepEqual(ids, [assetId(0), assetId(10), assetId(11)]);
    return ready(ids);
  });
  assert.equal(resolved.data.asset.asset_id, assetId(11));
  assert.equal(resolved.data.nodeResults.currentResultId, 'candidate-3');
  assert.deepEqual(save(resolved), save(node));
});
