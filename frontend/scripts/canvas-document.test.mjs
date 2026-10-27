import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCanvasDocument, readCanvasDocument } from '../src/components/canvas/CanvasDocument.js';
import { createCanvasNode } from '../src/components/canvas/canvasNodeUtils.js';
import { resolveCanvasDocumentAssets } from '../src/components/canvas/CanvasAssetResolver.js';
import { createCanvasSaveSession } from '../src/components/canvas/CanvasSaveSession.js';

const assetId = '12345678-1234-1234-1234-123456789abc';

test('刷新后下载原图优先于预览，并独立保留原图与缩略图', async () => {
  const nodes = [{ id: 'image', type: 'image', data: { asset: { asset_id: assetId } } }];
  const restored = await resolveCanvasDocumentAssets('canvas', nodes, async () => ({ items: [{
    asset_id: assetId, availability: 'ready', media_type: 'image',
    preview_url: '/preview.webp', thumbnail_url: '/thumb.webp', download_url: '/full.png',
  }] }));
  assert.equal(restored[0].data.asset.originalUrl, '/full.png');
  assert.equal(restored[0].data.asset.url, '/full.png');
  assert.equal(restored[0].data.asset.previewUrl, '/preview.webp');
  assert.equal(restored[0].data.asset.thumbnailUrl, '/thumb.webp');
});

test('四类节点、组合、完整业务参数和引用往返，媒体地址与运行态不持久化', () => {
  const nodes = ['text', 'image', 'video', 'audio'].map((type) => createCanvasNode(type, { x: 20, y: 30 }, type));
  nodes[1].parentId = 'group';
  nodes[1].data = { ...nodes[1].data, model: 'model', ratio: '16:9', referenceInputs: [{ sourceId: 'video', slot: 3 }],
    asset: { asset_id: assetId, url: 'https://private.test/file', source: 'upload' },
    settings: { file_url: 'https://private.test/file', enabled: true, nested: ['blob:secret', { previewUrl: 'secret', count: 2 }] } };
  nodes.push({ id: 'group', type: 'canvasGroup', position: { x: 50, y: 70 }, style: { width: 600, height: 400 }, data: { stacked: true, stackMembers: ['derived'] } });
  const before = JSON.stringify(nodes);
  const document = serializeCanvasDocument(nodes, [], { x: 1, y: 2, zoom: 0.5 });
  assert.equal(JSON.stringify(nodes), before);
  assert.ok(!JSON.stringify(document).includes('private.test'));
  assert.ok(!JSON.stringify(document).includes('blob:'));
  assert.ok(!JSON.stringify(document).includes('stackMembers'));
  const restored = readCanvasDocument({ document });
  const image = restored.nodes.find((node) => node.id === 'image');
  assert.equal(image.data.ratio, '16:9');
  assert.equal(image.data.asset.asset_id, assetId);
  assert.deepEqual(image.data.referenceInputs, [{ sourceId: 'video', slot: 3 }]);
  assert.equal(image.parentId, 'group');
  assert.equal(restored.nodes.find((node) => node.id === 'group').style.width, 600);
  assert.ok(restored.nodes.findIndex((node) => node.id === 'group') < restored.nodes.indexOf(image));
  assert.deepEqual(restored.viewport, { x: 1, y: 2, zoom: 0.5 });
});

test('非法素材、未知格式和错误引用拒绝处理，不静默丢内容', () => {
  const node = createCanvasNode('image');
  node.data.asset = { asset_id: 'temporary', url: 'blob:temp' };
  assert.throws(() => serializeCanvasDocument([node]), /永久编号/);
  assert.throws(() => readCanvasDocument({ document: { other: true } }), /文档格式/);
  node.data.asset = null;
  node.data.referenceInputs = {};
  assert.throws(() => serializeCanvasDocument([node]), /数组/);
});

test('恢复后移除素材或解散组合，再保存不复活旧协议身份', () => {
  const node = createCanvasNode('image', undefined, 'image');
  node.data.asset = { asset_id: assetId, asset_type: 'image' };
  node.parentId = 'group';
  const group = { id: 'group', type: 'canvasGroup', position: { x: 0, y: 0 }, data: {}, style: { width: 400, height: 300 } };
  const restored = readCanvasDocument({ document: serializeCanvasDocument([group, node]) }).nodes.find((item) => item.id === 'image');
  restored.data.asset = null;
  delete restored.parentId;
  const props = serializeCanvasDocument([restored]).records[0].props;
  assert.equal(props.assetId, undefined);
  assert.equal(props.assetType, undefined);
  assert.equal(props.parentId, undefined);
});

test('旧绑定恢复媒体引用，显式空引用不从绑定复活', () => {
  const document = serializeCanvasDocument([createCanvasNode('image', undefined, 'a'), createCanvasNode('video', undefined, 'b')]);
  document.businessBindings = [{ fromId: 'a', toId: 'b', order: 0 }];
  assert.deepEqual(readCanvasDocument({ document }).nodes[1].data.referenceInputs, [{ sourceId: 'a', slot: 0 }]);
  document.records[1].props.referenceInputs = [];
  assert.deepEqual(readCanvasDocument({ document }).nodes[1].data.referenceInputs, []);
  document.records[0].props.parentId = 'unknown';
  assert.throws(() => readCanvasDocument({ document }), /组合关系/);
});

test('素材按200个分批恢复，失效状态不泄露地址，缺项不静默成功', async () => {
  const nodes = Array.from({ length: 201 }, (_, index) => ({ id: String(index), data: { asset: { asset_id: String(index), asset_type: 'image' } } }));
  const batches = [];
  const restored = await resolveCanvasDocumentAssets('canvas', nodes, async (_, ids) => {
    batches.push(ids.length);
    return { items: ids.map((id) => ({ asset_id: id, availability: ['ready', 'trashed', 'forbidden', 'missing'][Number(id) % 4], original_url: 'https://private.test', title: 'private' })) };
  });
  assert.deepEqual(batches, [200, 1]);
  assert.equal(restored[0].data.asset.url, 'https://private.test');
  assert.equal(restored[1].data.asset.availability, 'trashed');
  assert.equal(restored[2].data.asset.url, undefined);
  assert.equal(restored[3].data.asset.name, undefined);
  await assert.rejects(resolveCanvasDocumentAssets('canvas', nodes, async () => ({ items: [] })), /可用状态/);
});

test('图片视频保存刷新后恢复相对媒体地址，保留永久编号且地址不写回文档', async () => {
  const nodes = ['image', 'video'].map((type) => {
    const node = createCanvasNode(type, undefined, type);
    node.data.asset = { asset_id: assetId, asset_type: type, source: 'upload', url: '/uploads/old' };
    return node;
  });
  const document = serializeCanvasDocument(nodes);
  const before = JSON.stringify(document);
  const restored = await resolveCanvasDocumentAssets('canvas', readCanvasDocument({ document }).nodes, async () => ({
    items: [{ asset_id: assetId, availability: 'ready', original_url: '/uploads/original.mp4?token=signed',
      preview_url: 'uploads/preview.mp4', poster_url: '/uploads/poster.jpg' }],
  }), { normalizeMediaUrl: (value) => `https://media.test${value}` });
  for (const node of restored) {
    assert.equal(node.data.asset.url, 'https://media.test/uploads/original.mp4?token=signed');
    assert.equal(node.data.asset.previewUrl, 'https://media.test/uploads/preview.mp4');
    assert.equal(node.data.asset.posterUrl, 'https://media.test/uploads/poster.jpg');
    assert.equal(node.data.asset.asset_id, assetId);
    assert.equal(node.data.asset.asset_type, node.type);
    assert.equal(node.data.asset.source, 'upload');
  }
  const saved = serializeCanvasDocument(restored);
  assert.equal(JSON.stringify(document), before);
  assert.ok(!JSON.stringify(saved).includes('media.test'));
  assert.ok(!JSON.stringify(saved).includes('/uploads/'));
  assert.equal(readCanvasDocument({ document: saved }).nodes[1].data.asset.asset_id, assetId);
});

test('素材恢复支持预览及受控下载相对地址，同时拒绝危险或缺失的可用地址', async () => {
  const nodes = [{ id: 'image', data: { asset: { asset_id: assetId } } }];
  const restore = (fields, availability = 'ready') => resolveCanvasDocumentAssets('canvas', nodes, async () => ({
    items: [{ asset_id: assetId, availability, ...fields }],
  }));
  for (const fields of [
    { original_url: 'javascript:alert(1)', preview_url: '/uploads/preview.jpg' },
    { download_url: '/api/media/downloads/token?expires=10' },
    { original_url: 'https://cdn.test/image.jpg?signed=1' },
  ]) {
    const [node] = await restore(fields);
    assert.equal(node.data.asset.url, fields.preview_url || fields.download_url || fields.original_url);
  }
  for (const original_url of [undefined, '', '  ', 'javascript:alert(1)', 'data:image/png;base64,abc', 'blob:temp', '//external.test/a', 'http://[invalid']) {
    await assert.rejects(restore({ original_url }), /缺少有效媒体地址/);
    await assert.rejects(restore({ original_url }, 'trashed'), /缺少有效媒体地址/);
  }
  const [hidden] = await restore({ original_url: '/uploads/private.jpg', poster_url: '/uploads/private.jpg' }, 'forbidden');
  assert.equal(hidden.data.asset.asset_id, assetId);
  assert.equal(hidden.data.asset.url, undefined);
  assert.equal(hidden.data.asset.posterUrl, undefined);
  assert.equal(nodes[0].data.asset.url, undefined);
});

test('丢响应后先重放原请求，新编辑在确认版本后以新幂等键提交', async () => {
  const calls = [];
  let fail = true;
  let counter = 0;
  const session = createCanvasSaveSession(async (_, body) => {
    calls.push(body);
    if (fail) { fail = false; throw new Error('network'); }
    return { revision: calls.length };
  }, () => `save-${++counter}`);
  await assert.rejects(session.save('c', 0, { content: 'a' }), /network/);
  await session.save('c', 0, { content: 'b' });
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[2].clientSaveId, 'save-2');
  assert.equal(calls[2].baseRevision, 2);
  await Promise.all([session.save('c', 0, { content: 'c' }), session.save('c', 0, { content: 'd' })]);
  assert.equal(calls[3].baseRevision, 3);
  assert.equal(calls[4].baseRevision, 4);
});

test('版本冲突不改用服务器版本覆盖原文档', async () => {
  const calls = [];
  const session = createCanvasSaveSession(async (_, body) => { calls.push(body); throw Object.assign(new Error('冲突'), { status: 409 }); }, () => 'fixed');
  await assert.rejects(session.save('c', 2, { value: 1 }), /冲突/);
  await assert.rejects(session.save('c', 9, { value: 2 }), /冲突/);
  assert.deepEqual(calls[0], calls[1]);
});
