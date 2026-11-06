import test from 'node:test';
import assert from 'node:assert/strict';
import { finishCanvasPendingUpload } from '../src/components/canvas/CanvasAssets.js';
import { createCanvasReplacementPending } from '../src/components/canvas/CanvasAssetReplace.js';

const oldAsset = { asset_id: '10000000-0000-4000-8000-000000000001', asset_type: 'audio', url: '/old.mp3' };
const uploaded = { asset_id: '10000000-0000-4000-8000-000000000002', asset_type: 'audio', url: '/new.mp3', name: '新音频.mp3' };
function begin(asset = null) {
  const original = { id: 'audio', type: 'audio', position: { x: 12, y: 34 }, data: { asset, prompt: '保留提示词' } };
  const pending = createCanvasReplacementPending(original, { asset_type: 'audio', url: 'blob:upload', uploadStatus: 'uploading' });
  return { original, pending, node: { ...original, data: { ...original.data, pendingCanvasUpload: pending } } };
}

for (const asset of [null, oldAsset]) {
  test(`音频${asset ? '已有结果' : '空节点'}等待时保持原内容，成功只更新原节点并提交历史`, async () => {
    const { original, pending, node } = begin(asset);
    let resolve;
    const request = new Promise((done) => { resolve = done; });
    const completed = request.then((result) => finishCanvasPendingUpload([node], node.id, pending, result));
    assert.equal(node.data.asset, original.data.asset);
    resolve(uploaded);
    const result = await completed;
    assert.equal(result.length, 1);
    assert.equal(result[0].id, original.id);
    assert.deepEqual(result[0].position, original.position);
    assert.equal(result[0].data.prompt, original.data.prompt);
    assert.equal(result[0].data.asset.asset_id, uploaded.asset_id);
    assert.equal(result[0].data.nodeResults.currentResultId, `${pending.operationId}-result`);
    assert.equal(result[0].data.nodeResults.batches.length, asset ? 2 : 1);
    assert.equal(result[0].data.pendingCanvasUpload, undefined);
  });
}
test('永久音频地址刷新不阻止回填，失败和目标变化均保留原内容', () => {
  const { pending, node } = begin(oldAsset);
  const refreshed = { ...node, data: { ...node.data, asset: { ...oldAsset, url: '/refreshed.mp3' } } };
  assert.equal(finishCanvasPendingUpload([refreshed], node.id, pending, uploaded)[0].data.asset.asset_id, uploaded.asset_id);
  const failed = finishCanvasPendingUpload([node], node.id, pending, null, new Error('上传失败'));
  assert.equal(failed[0].data.asset, oldAsset);
  for (const data of [{ generating: true }, { nodeResults: { currentResultId: 'changed' } }, { asset: uploaded }]) {
    const changed = { ...node, data: { ...node.data, ...data } };
    assert.equal(finishCanvasPendingUpload([changed], node.id, pending, uploaded)[0].data.asset, changed.data.asset);
  }
});

test('生成待定、编辑、提交锁、上游保护及两类上传锁均拒绝替换完成', () => {
  const { pending, node } = begin(oldAsset);
  for (const data of [
    { generationPending: true }, { editing: true }, { submissionLocked: true },
    { upstreamProtected: true }, { outputLocked: true },
  ]) {
    const changed = { ...node, data: { ...node.data, ...data } };
    const [result] = finishCanvasPendingUpload([changed], node.id, pending, uploaded);
    assert.equal(result.data.asset, node.data.asset);
  }
});

test('上传资产无永久编号或类型不符时清理pending且旧投影保留', () => {
  const { pending, node } = begin(oldAsset);
  for (const result of [{ ...uploaded, asset_id: undefined }, { ...uploaded, asset_type: 'video' }]) {
    const [next] = finishCanvasPendingUpload([node], node.id, pending, result);
    assert.equal(next.data.asset, oldAsset);
    assert.equal(next.data.nodeResults, undefined);
    assert.equal(next.data.pendingCanvasUpload, undefined);
  }
});
