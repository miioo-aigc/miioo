import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { applyCanvasAsset, getCanvasPermanentAssetId } from '../src/components/canvas/CanvasAssets.js';
import { serializeCanvasDocument, readCanvasDocument, removeUnavailableCanvasReferences } from '../src/components/canvas/CanvasDocument.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';
import { createCanvasHistory } from '../src/components/canvas/CanvasHistory.js';
import { createCanvasNodeClipboard } from '../src/components/canvas/CanvasNodeClipboard.js';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
test('复制以及导入撤销重做保留虚拟身份', () => {
  const nodes = [imported('image'), imported('video')];
  const clipboard = createCanvasNodeClipboard();
  clipboard.write('project', 'session', nodes);
  const history = createCanvasHistory([]);
  history.setNodes(clipboard.read('project', 'session'));
  history.undo();
  assert.equal(history.getSnapshot().nodes.length, 0);
  history.redo();
  assert.ok(history.getSnapshot().nodes.every(node => node.data.asset.liveMaterialAssetId === id));
});
function imported(type) {
  const node = createCanvasNode(type);
  return applyCanvasAsset([node], node.id, { id, liveMaterialAssetId: id, asset_id: id, asset_type: type, url: 'https://example.test/live' })[0];
}
for (const type of ['image', 'video']) {
  test(`${type} 虚拟素材导入保存刷新身份往返且不保存地址`, async () => {
    const node = imported(type);
    assert.equal(getCanvasPermanentAssetId(node.data.asset), null);
    const document = serializeCanvasDocument([node]);
    assert.equal(document.records[0].props.liveMaterialAssetId, id);
    assert.equal(document.records[0].props.assetId, '');
    assert.ok(!JSON.stringify(document).includes('https:'));
    const restored = await resolveCanvasDocumentAssets('canvas', readCanvasDocument(document).nodes, async (_, ids, options) => {
      assert.deepEqual(ids, []);
      assert.deepEqual(options.liveMaterialAssetIds, [id]);
      return { live_material_items: [{ live_material_asset_id: id, media_type: type, availability: 'ready', preview_url: 'https://example.test/preview', original_url: 'https://example.test/original', poster_url: 'asset://bad' }] };
    });
    assert.equal(restored[0].data.asset.url, 'https://example.test/preview');
    assert.equal(restored[0].data.asset.posterUrl, undefined);
    assert.deepEqual(serializeCanvasDocument(restored), document);
  });
}
test('同编号普通和虚拟素材独立解析，普通失效清理不删除虚拟身份', async () => {
  const live = imported('image');
  const ordinary = createCanvasNode('image');
  ordinary.data.asset = { asset_id: id, asset_type: 'image' };
  const nodes = await resolveCanvasDocumentAssets('canvas', [live, ordinary], async (_, ids) => ids.length
    ? { items: [{ asset_id: id, availability: 'ready', media_type: 'image', original_url: 'https://example.test/normal' }] }
    : { live_material_items: [{ live_material_asset_id: id, availability: 'ready', media_type: 'image', preview_url: 'https://example.test/live' }] });
  assert.equal(nodes[0].data.asset.url, 'https://example.test/live');
  assert.equal(nodes[1].data.asset.url, 'https://example.test/normal');
  assert.equal(removeUnavailableCanvasReferences(nodes, [id])[0].data.asset.liveMaterialAssetId, id);
});
for (const availability of ['missing', 'forbidden', 'unavailable', 'request-error']) {
  test(`${availability} 保留身份并清除旧地址`, async () => {
    const nodes = await resolveCanvasDocumentAssets('canvas', [imported('video')], async () => {
      if (availability === 'request-error') throw new Error('网络异常');
      return { live_material_items: [{ live_material_asset_id: id, availability, preview_url: 'https://example.test/leak', title: '禁止显示' }] };
    });
    assert.equal(nodes[0].data.asset.liveMaterialAssetId, id);
    assert.equal(nodes[0].data.asset.url, undefined);
    assert.equal(nodes[0].data.asset.name, undefined);
    assert.equal(nodes[0].data.assetUnavailable, true);
    assert.equal(serializeCanvasDocument(nodes).records[0].props.liveMaterialAssetId, id);
  });
}
test('非法虚拟编号不回退普通编号，临时素材不能保存', () => {
  const node = imported('image');
  node.data.asset.liveMaterialAssetId = 'invalid';
  node.data.asset.asset_id = id;
  assert.throws(() => serializeCanvasDocument([node]), /永久编号/);
  node.data.asset = { url: 'blob:temporary', asset_type: 'image' };
  assert.throws(() => serializeCanvasDocument([node]), /永久编号/);
});
test('虚拟与普通素材相互替换可以保存且身份互斥', () => {
  const live = imported('image');
  const ordinary = applyCanvasAsset([live], live.id, { asset_id: id, asset_type: 'image', url: 'https://example.test/normal' })[0];
  assert.equal(serializeCanvasDocument([ordinary]).records[0].props.liveMaterialAssetId, undefined);
  const replaced = applyCanvasAsset([ordinary], ordinary.id, live.data.asset)[0];
  assert.equal(serializeCanvasDocument([replaced]).records[0].props.assetId, '');
});
