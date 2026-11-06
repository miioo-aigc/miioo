import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCanvasAsset, commitCanvasMediaOutput, finishCanvasPendingUpload } from '../src/components/canvas/CanvasAssets.js';
import { appendCanvasImageEdit } from '../src/components/canvas/CanvasImageEdits.js';
import { readCanvasResultDocument } from '../src/components/canvas/CanvasResultDocument.js';

const original = { asset_id: '10000000-0000-0000-0000-000000000001', asset_type: 'image', url: '/original' };
const edited = { asset_id: '20000000-0000-0000-0000-000000000001', asset_type: 'image', url: '/edited' };
const source = () => ({ id: 'source', type: 'image', data: { asset: original, prompt: '保留提示词' } });

test('正式替换提交永久资产历史并保留旧结果和可用视图', () => {
  const node = source();
  const next = applyCanvasAsset([node], node.id, edited)[0];
  assert.equal(next.data.nodeResults.batches.length, 2);
  assert.equal(next.data.nodeResults.batches[1].source, 'upload');
  assert.equal(next.data.nodeResults.batches[1].results[0].assetId, edited.asset_id);
  assert.equal(next.data.resultAssetViews[original.asset_id].url, original.url);
  assert.equal(next.data.prompt, node.data.prompt);
  readCanvasResultDocument('image', next.data);
});

test('预览不建批次，替换上传暂存文件且不覆盖旧投影', () => {
  const preview = { asset_type: 'image', url: 'blob:preview', source: 'local-preview' };
  const empty = { id: 'empty', type: 'image', data: {} };
  const first = applyCanvasAsset([empty], empty.id, preview)[0];
  assert.equal(first.data.nodeResults, undefined);
  const node = applyCanvasAsset([source()], 'source', edited)[0];
  assert.equal(applyCanvasAsset([node], node.id, preview)[0], node);
  const file = new File(['图片'], '图片.png');
  const pending = { ...preview, source: 'local-upload', file, uploadStatus: 'uploading' };
  const next = applyCanvasAsset([node], node.id, pending)[0];
  assert.equal(next.data.asset, node.data.asset);
  assert.equal(next.data.nodeResults, node.data.nodeResults);
  assert.equal(next.data.pendingCanvasUpload.asset.file, file);
  readCanvasResultDocument('image', next.data);
});

test('初次预览上传成功可转正式历史，不把临时地址迁入历史', () => {
  const node = { id: 'source', type: 'image', data: { asset: { asset_type: 'image', url: 'blob:first' } } };
  const next = applyCanvasAsset([node], node.id, edited)[0];
  assert.equal(next.data.nodeResults.batches.length, 1);
  assert.equal(next.data.nodeResults.batches[0].source, 'upload');
});

test('源删除不复活，资产身份或历史选择变化不接收迟到结果', () => {
  const node = source();
  const deleted = [];
  assert.equal(appendCanvasImageEdit(deleted, node, edited, 'result'), deleted);
  for (const live of [
    { ...node, data: { ...node.data, asset: edited } },
    commitCanvasMediaOutput(node, original, 'upload'),
  ]) {
    const nodes = [live];
    assert.equal(appendCanvasImageEdit(nodes, node, edited, 'result'), nodes);
  }
});

test('生成和上游保护等状态拒绝上传和编辑回写', () => {
  for (const flag of ['generating', 'generationPending', 'editing', 'submissionLocked', 'upstreamProtected', 'outputLocked']) {
    const node = source();
    node.data[flag] = true;
    const nodes = [node];
    assert.equal(applyCanvasAsset(nodes, node.id, edited), nodes);
    assert.equal(appendCanvasImageEdit(nodes, node, edited, 'result'), nodes);
  }
});

test('编辑本地记录编号不当作永久资产，兼容真实资产别名', () => {
  const node = source();
  const nodes = [node];
  assert.equal(appendCanvasImageEdit(nodes, node, { ...edited, asset_id: undefined, id: 'pending-edit:record' }, 'result'), nodes);
  const next = appendCanvasImageEdit(nodes, node, { ...edited, asset_id: undefined, creationAssetId: edited.asset_id }, 'result');
  assert.equal(next[0].data.asset.asset_id, edited.asset_id);
});

test('替换上传成功才提交；失败、源变化、并发替换和删除均不覆盖旧结果', () => {
  const node = source();
  const preview = { asset_type: 'image', url: 'blob:replace', source: 'local-upload',
    file: new File(['图片'], '替换.png'), uploadStatus: 'uploading' };
  const pendingNode = applyCanvasAsset([node], node.id, preview)[0];
  const pending = pendingNode.data.pendingCanvasUpload;
  const success = finishCanvasPendingUpload([pendingNode], node.id, pending, edited)[0];
  assert.equal(success.data.pendingCanvasUpload, undefined);
  assert.equal(success.data.nodeResults.batches.length, 2);
  assert.equal(success.data.asset.asset_id, edited.asset_id);
  readCanvasResultDocument('image', success.data);
  const failure = finishCanvasPendingUpload([pendingNode], node.id, pending, null, new Error('上传失败'))[0];
  assert.equal(failure.data.asset, original);
  assert.equal(failure.data.pendingCanvasUpload.asset.uploadStatus, 'error');
  assert.equal(failure.data.pendingCanvasUpload.asset.uploadError, '上传失败');
  assert.equal(failure.data.pendingCanvasUpload.asset.file, preview.file);
  const retry = applyCanvasAsset([failure], node.id, preview)[0];
  assert.equal(retry.data.pendingCanvasUpload.asset.uploadStatus, 'uploading');
  assert.equal(retry.data.asset, original);
  const retried = finishCanvasPendingUpload([retry], node.id, retry.data.pendingCanvasUpload, edited)[0];
  assert.equal(retried.data.asset.asset_id, edited.asset_id);
  assert.equal(retried.data.nodeResults.batches.length, 2);
  for (const data of [{ ...pendingNode.data, asset: edited }, { ...pendingNode.data, upstreamProtected: true }]) {
    const next = finishCanvasPendingUpload([{ ...pendingNode, data }], node.id, pending, edited)[0];
    assert.equal(next.data.asset, data.asset);
    assert.equal(next.data.nodeResults, undefined);
  }
  const newer = applyCanvasAsset([pendingNode], node.id, { ...preview, url: 'blob:newer' })[0];
  const newerResult = finishCanvasPendingUpload([newer], node.id, pending, edited)[0];
  assert.equal(newerResult.data.asset.asset_id, edited.asset_id);
  assert.equal(newerResult.data.pendingCanvasUpload, undefined);
  assert.deepEqual(finishCanvasPendingUpload([], node.id, pending, edited), []);
});
