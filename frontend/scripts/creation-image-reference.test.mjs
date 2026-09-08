import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
after(() => server.close());
const { buildCreationImageReferencePrefill } = await server.ssrLoadModule('/src/utils/creationDetailAdapter.js');
const { normalizeCreationHistoryItem } = await server.ssrLoadModule('/src/utils/creationHistoryAdapter.js');
const { normalizeCreationTaskResult } = await server.ssrLoadModule('/src/utils/creationTaskAdapter.js');
const preview = '/uploads/derived/assets/preview/example-preview_contain.avif';
const original = '/uploads/images/example.png';

test('历史卡片提交原图，同时保留预览与资产身份', () => {
  const history = normalizeCreationHistoryItem({
    id: 'image-id', asset_id: 'asset-id', preview_url: preview,
    original_url: original, download_url: '/api/media/downloads/test-only', prompt: '参考素材',
  }, 'image');
  const result = buildCreationImageReferencePrefill(history.cards[0]);
  assert.equal(result.appendFiles[0].url, original);
  assert.equal(result.appendFiles[0].previewUrl, preview);
  assert.equal(result.appendFiles[0].assetId, 'asset-id');
});

test('只有派生预览的历史卡片不能回退提交预览', () => {
  const history = normalizeCreationHistoryItem({ preview_url: preview }, 'image');
  assert.equal(buildCreationImageReferencePrefill(history.cards[0]), null);
});

test('拒绝带查询参数的 AVIF 与绝对地址派生图片', () => {
  for (const url of ['/uploads/image.avif?version=1', `https://example.com${preview}`, '/uploads/derived/assets/preview/example.png']) {
    assert.equal(buildCreationImageReferencePrefill({ originalUrl: url, imageUrl: url }), null);
  }
});

test('兼容展示地址本身就是原图的旧卡片', () => {
  const result = buildCreationImageReferencePrefill({ imageUrl: original });
  assert.equal(result.appendFiles[0].url, original);
});

test('无图片地址时拒绝添加，只有原图时使用原图展示', () => {
  assert.equal(buildCreationImageReferencePrefill({}), null);
  const result = buildCreationImageReferencePrefill({ originalUrl: original });
  assert.equal(result.appendFiles[0].previewUrl, original);
});

test('驼峰原图字段不会被下载地址覆盖', () => {
  const history = normalizeCreationHistoryItem({
    originalUrl: original, downloadUrl: '/api/media/downloads/test-only', previewUrl: preview,
  }, 'image');
  assert.equal(buildCreationImageReferencePrefill(history.cards[0]).appendFiles[0].url, original);
});

test('旧缓存中的受控下载入口不能作为参考素材', () => {
  for (const url of ['/api/media/downloads/test-only', 'https://example.com/api/media/downloads/test-only']) {
    assert.equal(buildCreationImageReferencePrefill({ originalUrl: url, imageUrl: preview }), null);
  }
});

test('任务恢复同时存在原图与下载字段时始终选原图', () => {
  const task = { genType: 'image' };
  for (const result of [
    { images: [{ preview_url: preview, original_url: original, download_url: '/api/media/downloads/test-only' }] },
    { images: [preview], imageOriginalUrls: [original], imageDownloadUrls: ['/api/media/downloads/test-only'] },
  ]) {
    const { generation } = normalizeCreationTaskResult(result, task);
    assert.equal(buildCreationImageReferencePrefill(generation.cards[0]).appendFiles[0].url, original);
  }
});
