import test from 'node:test';
import assert from 'node:assert/strict';
import { commitCanvasNodeOutput, selectCanvasNodeOutput } from '../src/components/canvas/CanvasResultMutations.js';
import { readCanvasResultDocument } from '../src/components/canvas/CanvasResultDocument.js';
import { copyCanvasNodes, pasteCanvasNodes } from '../src/components/canvas/CanvasNodeActions.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';

const types = ['text', 'image', 'video'];
const assetId = (index) => `12345678-1234-1234-1234-${String(index).padStart(12, '0')}`;
const emptyNode = (type) => ({ id: 'node', type, data: { content: '', asset: null } });
const batch = (type, index = 0) => ({ id: `batch-${index}`, source: 'generation',
  requestedCount: 1, submittedAt: index, completedAt: index,
  results: [{ id: `result-${index}`, index: 0, type,
    ...(type === 'text' ? { content: `正文${index}` } : { assetId: assetId(index) }) }],
});
const views = (type, index) => type === 'text' ? {} : {
  [assetId(index)]: { asset_id: assetId(index), asset_type: type, url: `/assets/${index}`, availability: 'ready' },
};
function withHistory(type) {
  let node = emptyNode(type);
  for (const index of [0, 1]) node = commitCanvasNodeOutput(node, batch(type, index), views(type, index));
  return node;
}

test('共享写入拒绝所有跨节点类型的批次，空节点和已有历史均不被修改', () => {
  for (const type of types) for (const other of types.filter((value) => value !== type)) {
    for (const node of [emptyNode(type), withHistory(type)]) {
      const before = structuredClone(node);
      assert.throws(() => commitCanvasNodeOutput(node, batch(other, 2)), /节点类型与结果类型不一致/);
      assert.deepEqual(node, before);
    }
  }
});

test('共享写入保留全部批次并生成可保存的三类当前投影，重复批次不追加', () => {
  for (const type of types) {
    const node = withHistory(type);
    assert.equal(node.data.nodeResults.batches.length, 2);
    assert.equal(node.data.nodeResults.currentResultId, 'result-1');
    assert.doesNotThrow(() => readCanvasResultDocument(type, node.data));
    assert.equal(commitCanvasNodeOutput(node, batch(type, 1), views(type, 1)), node);
  }
});

test('共享写入保留图片部分成功索引，全失败不覆盖既有历史与投影', () => {
  const node = withHistory('image');
  const partial = { ...batch('image', 2), requestedCount: 3, results: [
    { index: 0, status: 'failed' },
    { ...batch('image', 2).results[0], index: 1 },
    { index: 2, status: 'failed' },
  ] };
  const updated = commitCanvasNodeOutput(node, partial, views('image', 2));
  assert.equal(updated.data.nodeResults.batches.length, 3);
  assert.equal(updated.data.nodeResults.batches.at(-1).status, 'partial');
  assert.equal(updated.data.nodeResults.batches.at(-1).results[0].index, 1);
  assert.doesNotThrow(() => readCanvasResultDocument('image', updated.data));
  assert.equal(commitCanvasNodeOutput(updated, { ...batch('image', 3), results: [{ index: 0, status: 'failed' }] }), updated);
});

test('共享切换拒绝所有任务保护状态，不修改原历史与当前投影', () => {
  for (const type of types) for (const flag of ['generating', 'generationPending', 'editing',
    'submissionLocked', 'upstreamProtected', 'outputLocked']) {
    const node = withHistory(type);
    node.data[flag] = true;
    const before = structuredClone(node);
    assert.throws(() => selectCanvasNodeOutput(node, 'result-0'), /任务保护/);
    assert.deepEqual(node, before);
  }
});

test('解除保护后共享切换保留全部历史并恢复可保存的当前投影', () => {
  for (const type of types) {
    const node = withHistory(type);
    node.data.generationPending = false;
    node.data.outputLocked = false;
    const selected = selectCanvasNodeOutput(node, 'result-0');
    assert.equal(selected.data.nodeResults.currentResultId, 'result-0');
    assert.deepEqual(selected.data.nodeResults.batches, node.data.nodeResults.batches);
    assert.equal(node.data.nodeResults.currentResultId, 'result-1');
    assert.doesNotThrow(() => readCanvasResultDocument(type, selected.data));
    if (type !== 'text') assert.equal(selected.data.asset.url, '/assets/0');
  }
});

test('共享切换拒绝缺少预览地址或不可用的历史素材', () => {
  for (const type of ['image', 'video']) for (const view of [{},
    { url: '/assets/0', availability: 'missing' }, { url: '/assets/0', availability: 'forbidden' }]) {
    const node = withHistory(type);
    node.data.resultAssetViews[assetId(0)] = view;
    const before = structuredClone(node);
    assert.throws(() => selectCanvasNodeOutput(node, 'result-0'), /素材不可用/);
    assert.deepEqual(node, before);
  }
});

test('媒体副本保持可保存协议，解析全部历史资产后才能切换历史预览', async () => {
  for (const type of ['image', 'video']) {
    const original = { ...withHistory(type), selected: true, position: { x: 0, y: 0 } };
    const [copy] = pasteCanvasNodes([], copyCanvasNodes([original]), { x: 10, y: 10 }, () => 'copy');
    assert.equal(copy.data.asset.url, undefined);
    assert.equal(copy.data.resultAssetViews, undefined);
    assert.doesNotThrow(() => readCanvasResultDocument(type, copy.data));
    assert.throws(() => selectCanvasNodeOutput(copy, 'result-0'), /素材不可用/);
    let requested;
    const [restored] = await resolveCanvasDocumentAssets('canvas', [copy], async (canvasId, ids) => {
      assert.equal(canvasId, 'canvas');
      requested = ids;
      return { items: ids.map((id) => ({ asset_id: id, media_type: type, availability: 'ready',
        original_url: `/resolved/${id}` })) };
    });
    assert.deepEqual(requested, [assetId(0), assetId(1)]);
    assert.equal(restored.data.asset.url, `/resolved/${assetId(1)}`);
    const selected = selectCanvasNodeOutput(restored, 'result-0');
    assert.equal(selected.data.asset.url, `/resolved/${assetId(0)}`);
    assert.deepEqual(selected.data.nodeResults.batches, original.data.nodeResults.batches);
    assert.doesNotThrow(() => readCanvasResultDocument(type, selected.data));
    assert.equal(original.data.nodeResults.currentResultId, 'result-1');
  }
});
