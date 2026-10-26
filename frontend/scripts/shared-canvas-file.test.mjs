import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeSharedCanvasFile } from '../src/components/canvas/SharedCanvasFile.js';
import { parseCanvasFile, mergeCanvasFile } from '../src/components/canvas/CanvasFile.js';
const assetId = '11111111-1111-4111-8111-111111111111';
const payload = { title: '测试画布', document: { engine: 'xyflow', schemaVersion: 1, records: [
  { id: 'g', type: 'canvasGroup', x: 100, y: 200, props: { label: '组', stacked: true, groupWidth: 600, groupHeight: 400 } },
  { id: 't', type: 'free-canvas-node', x: 8, y: 8, props: { nodeType: 'text', label: '文本', parentId: 'g', content: '# 标题' } },
  { id: 'i', type: 'free-canvas-node', x: 300, y: 8, props: { nodeType: 'image', label: '图片', parentId: 'g', assetId } },
], businessBindings: [{ fromId: 't', toId: 'i', enabled: true }] }, assets: [{ asset_id: assetId, availability: 'ready', original_url: '/image.png', preview_url: '/preview.png', width: 800, height: 600 }] };
test('分享导出兼容现有导入，保留折叠、位置、正文、素材和绑定并重映射编号', async () => {
  const before = structuredClone(payload);
  const text = await serializeSharedCanvasFile(payload, 'https://example.com');
  const nodes = parseCanvasFile(text);
  assert.equal(nodes[0].data.stacked, true);
  assert.deepEqual(nodes[0].position, { x: 100, y: 200 });
  assert.equal(nodes[1].data.content, '# 标题');
  assert.equal(nodes[2].type, 'image');
  assert.equal(nodes[2].data.asset.url, 'https://example.com/image.png');
  assert.equal(nodes[2].data.asset.width, 800);
  let id = 0;
  const merged = mergeCanvasFile([], nodes, () => String(++id));
  assert.equal(merged[1].parentId, merged[0].id);
  assert.deepEqual(merged[2].data.textSourceIds, [merged[1].id]);
  assert.deepEqual(payload, before);
});
test('不可用素材不导出地址，非法文档拒绝导出', async () => {
  const missing = structuredClone(payload);
  missing.assets[0].availability = 'forbidden';
  const nodes = parseCanvasFile(await serializeSharedCanvasFile(missing, 'https://example.com'));
  assert.equal(nodes[2].data.asset.url, undefined);
  await assert.rejects(serializeSharedCanvasFile({ document: { engine: 'invalid' } }, 'https://example.com'));
});
