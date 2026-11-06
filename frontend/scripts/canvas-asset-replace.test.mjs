import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasReplacementPending, createCanvasReplacementSnapshot, beginCanvasReplacement, validateCanvasAssetReplacement, isCanvasReplacementTargetCurrent } from '../src/components/canvas/CanvasAssetReplace.js';
import { applyCanvasAsset, finishCanvasPendingUpload } from '../src/components/canvas/CanvasAssets.js';

const image = { id: 'target', type: 'image', position: { x: 40, y: 60 }, data: { asset: { asset_type: 'image', url: '/old.png' }, nodeResults: { currentResultId: 'old' } } };
const audio = { id: 'audio', type: 'audio', data: { asset: { asset_type: 'audio', url: '/old.mp3' } } };

test('替换仅接受一个同类型有效素材', () => {
  const nodes = [image, audio];
  assert.equal(validateCanvasAssetReplacement(nodes, 'target', 'image', [{ asset_type: 'image', url: '/new.png' }]).url, '/new.png');
  assert.equal(validateCanvasAssetReplacement(nodes, 'target', 'image', [{ asset_type: 'video', url: '/new.mp4' }]), null);
  assert.equal(validateCanvasAssetReplacement(nodes, 'target', 'image', [{ asset_type: 'image', url: '/a' }, { asset_type: 'image', url: '/b' }]), null);
  assert.equal(validateCanvasAssetReplacement(nodes, 'target', 'video', [{ asset_type: 'video', url: '/new.mp4' }]), null);
  assert.equal(validateCanvasAssetReplacement(nodes, 'missing', 'image', [{ asset_type: 'image', url: '/new.png' }]), null);
});

test('异步准备期间节点被替换或锁定时拒绝旧目标写回', () => {
  const snapshot = createCanvasReplacementSnapshot(image);
  assert.equal(isCanvasReplacementTargetCurrent([image, audio], snapshot), true);
  assert.equal(isCanvasReplacementTargetCurrent([{ ...image, data: { ...image.data, asset: { asset_type: 'image', url: '/other.png' } } }, audio], snapshot), false);
  assert.equal(isCanvasReplacementTargetCurrent([{ ...image, data: { ...image.data, generating: true } }, audio], snapshot), false);
  for (const data of [
    { generationPending: true }, { upstreamProtected: true },
    { asset: { ...image.data.asset, uploadStatus: 'uploading' } },
    { pendingCanvasUpload: { asset: { uploadStatus: 'uploading' } } },
  ]) {
    assert.equal(validateCanvasAssetReplacement([{ ...image, data: { ...image.data, ...data } }, audio], 'target', 'image', [{ asset_type: 'image', url: '/new.png' }]), null);
  }
  const refreshed = { ...image, data: { ...image.data, asset: { ...image.data.asset, url: '/refreshed.png' } } };
  assert.equal(isCanvasReplacementTargetCurrent([refreshed, audio], snapshot), false);
  assert.equal(isCanvasReplacementTargetCurrent([{ ...image, data: { ...image.data, nodeResults: { currentResultId: 'new' } } }, audio], snapshot), false);
  const protectedNodes = [image, { id: 'run', type: 'video', data: { submissionLocked: true, executionSourceIds: ['target'] } }, audio];
  assert.equal(validateCanvasAssetReplacement(protectedNodes, 'target', 'image', [{ asset_type: 'image', url: '/new.png' }]), null);
});

test('真实执行替换 pending begin/finish：空节点与旧永久结果均提交唯一历史并保留单节点', () => {
  const permanentId = '11111111-1111-4111-8111-111111111111';
  for (const initial of [
    { id: 'target', type: 'image', position: { x: 40, y: 60 }, data: {} },
    { ...image, data: { ...image.data, asset: { asset_id: permanentId, asset_type: 'image', url: '/old.png' },
      nodeResults: undefined } },
  ]) {
    const nodes = [initial, audio];
    const snapshot = createCanvasReplacementSnapshot(initial);
    const local = { asset_type: 'image', url: 'blob:new', name: 'new.png', source: 'local-upload', uploadStatus: 'uploading', file: {} };
    const pending = createCanvasReplacementPending(initial, local);
    assert.equal(pending.owner, 'page-replace');
    let active = beginCanvasReplacement(nodes, snapshot, pending);
    assert.notEqual(active, nodes);
    assert.equal(active.length, nodes.length);
    assert.equal(active[0].data.asset, initial.data.asset);
    const uploaded = { ...local, id: '22222222-2222-4222-8222-222222222222', asset_id: '22222222-2222-4222-8222-222222222222', url: '/new.png', uploadStatus: 'ready' };
    active = finishCanvasPendingUpload(active, initial.id, pending, uploaded);
    const result = active[0];
    assert.equal(result.data.pendingCanvasUpload, undefined);
    assert.equal(result.data.nodeResults.currentResultId, `${pending.operationId}-result`);
    assert.equal(result.data.nodeResults.batches.length, initial.data.asset ? 2 : 1);
    assert.equal(result.data.asset.url, '/new.png');
    assert.deepEqual(result.position, initial.position);
    assert.equal(active.length, nodes.length);
    assert.deepEqual(finishCanvasPendingUpload(active, initial.id, pending, uploaded), active);
  }
});

test('替换入口本地上传保留默认及自定义名称，其他上传仍按文件名命名', () => {
  for (const type of ['image', 'video', 'audio']) {
    for (const label of ['默认节点1', '用户命名']) {
      for (const replacement of [true, false]) {
        const initial = { id: 'target', type, data: { label } };
        const asset = { asset_type: type, url: 'blob:upload', name: 'new.png', source: 'local-upload', uploadStatus: 'uploading', file: {} };
        const pending = createCanvasReplacementPending(initial, asset);
        if (!replacement) delete pending.owner;
        const active = [{ ...initial, data: { ...initial.data, pendingCanvasUpload: pending } }];
        const uploaded = { asset_type: type, asset_id: '22222222-2222-4222-8222-222222222222', url: '/new', name: 'new.png' };
        const [result] = finishCanvasPendingUpload(active, initial.id, pending, uploaded);
        assert.equal(result.data.label, replacement ? label : 'new');
        assert.equal(result.data.asset.name, 'new.png');
        assert.equal(result.data.asset.url, '/new');
      }
    }
  }
});

test('真实pending失败会清理占用并允许重试，源节点变化时拒绝迟到成功', () => {
  const initial = { id: 'target', type: 'image', data: {} };
  const pending = createCanvasReplacementPending(initial, { asset_type: 'image', url: 'blob:upload', uploadStatus: 'uploading', file: {} });
  const active = beginCanvasReplacement([initial], createCanvasReplacementSnapshot(initial), pending);
  const failed = finishCanvasPendingUpload(active, initial.id, pending, null, new Error('failed'));
  assert.equal(failed[0].data.pendingCanvasUpload, undefined);
  assert.equal(validateCanvasAssetReplacement(failed, initial.id, 'image', [{ asset_type: 'image', url: '/retry.png' }]).url, '/retry.png');
  const changed = active.map((node) => ({ ...node, data: { ...node.data, nodeResults: { currentResultId: 'newer' } } }));
  const rejected = finishCanvasPendingUpload(changed, initial.id, pending, { asset_id: '22222222-2222-4222-8222-222222222222', asset_type: 'image', url: '/late.png' });
  assert.equal(rejected[0].data.pendingCanvasUpload, undefined);
  assert.equal(rejected[0].data.nodeResults.currentResultId, 'newer');
});

test('资产库永久素材直接替换节点，不创建上传pending；临时素材身份按URL检测', () => {
  const legacy = { ...image, data: { ...image.data, nodeResults: undefined } };
  const selected = { asset_type: 'image', id: '33333333-3333-4333-8333-333333333333', url: '/library.png' };
  assert.ok(selected.id);
  const nodes = [legacy];
  const next = applyCanvasAsset(nodes, legacy.id, selected);
  assert.notEqual(next, nodes);
  assert.equal(next.length, 1);
  assert.equal(next[0].data.asset.url, '/library.png');
  assert.equal(next[0].data.pendingCanvasUpload, undefined);
  const snapshot = createCanvasReplacementSnapshot(legacy);
  const refreshed = { ...legacy, data: { ...legacy.data, asset: { ...legacy.data.asset, url: '/refreshed.png' } } };
  const changed = { ...legacy, data: { ...legacy.data, asset: { asset_type: 'image', url: '/different.png' } } };
  assert.equal(isCanvasReplacementTargetCurrent([refreshed], createCanvasReplacementSnapshot(refreshed)), true);
  assert.equal(isCanvasReplacementTargetCurrent([changed], snapshot), false);
});
