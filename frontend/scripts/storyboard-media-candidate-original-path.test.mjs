import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';

const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());

const { resolveOriginalMediaPath } = await server.ssrLoadModule('/src/utils/imageUrl.js');
const { buildStoryboardCandidatePayload } = await server.ssrLoadModule('/src/utils/storyboardCandidateAdapter.js');

// 来自真实 422 报错的受控下载 token：url 长 715，负载里的原路径是 /uploads/creation/global/image-edits/...png。
const tokenPayload = 'eyJhY2Nlc3NfbGV2ZWwiOiJjb250cm9sbGVkX2Rvd25sb2FkIiwiZG93bmxvYWRfdXJsIjoiL3VwbG9hZHMvY3JlYXRpb24vZ2xvYmFsL2ltYWdlLWVkaXRzL2VmMTMxYWU5MTMzZjQzYjhiYzc0OTE0NGFhM2EzZGU3LnBuZyIsImV4cGlyZXNfYXQiOjE3OTUwODQ3NjUsImlzc3VlZF9hdCI6MTc5NTA4MTE2NSwibm9uY2UiOiJnbU00Skg4dHFJbyIsInByb2plY3RfaWQiOiIxY2IyNDQ1OC01ZGI3LTRmOTctYjQ2MC0zMDMxMDZiN2I4MDciLCJyZXNvdXJjZV9pZCI6IjVlMTUzMGFiLTQ1YTQtNDQwNS1hZmExLTY5NWIzNDkzNGZhYyIsInN0b3JhZ2VfYnVja2V0IjpudWxsLCJzdG9yYWdlX2tleSI6ImNyZWF0aW9uL2dsb2JhbC9pbWFnZS1lZGl0cy9lZjEzMWFlOTEzM2Y0M2I4YmM3NDkxNDRhYTNhM2RlNy5wbmciLCJzdG9yYWdlX21vZGUiOiJtYW5hZ2VkX3VwbG9hZCIsInVzZXJfaWQiOiJkYmQ4YTJiMy05YTEzLTQ4YzMtYjMyYi0wM2Y3Y2I1NDA3MzMifQ';
const controlledUrl = `/api/media/downloads/${tokenPayload}.GQdeygk_RKSv-JXD0mf6Mxahlhu0WYe9GZxL0cFSRYY`;
const originalPath = '/uploads/creation/global/image-edits/ef131ae9133f43b8bc749144aa3a3de7.png';

test('受控下载地址还原为原始媒体路径', () => {
  assert.equal(controlledUrl.length, 715);
  assert.equal(resolveOriginalMediaPath(controlledUrl), originalPath);
  assert.equal(resolveOriginalMediaPath(`http://localhost:5174${controlledUrl}`), originalPath);
});

test('原始路径与普通地址不被改写', () => {
  assert.equal(resolveOriginalMediaPath(originalPath), originalPath);
  assert.equal(resolveOriginalMediaPath('/uploads/storyboards/image.png'), '/uploads/storyboards/image.png');
  assert.equal(resolveOriginalMediaPath('https://cdn.example.test/a.png'), 'https://cdn.example.test/a.png');
  assert.equal(resolveOriginalMediaPath(null), null);
  assert.equal(resolveOriginalMediaPath(undefined), undefined);
});

test('候选媒体 payload 提交原始路径而非受控 token', () => {
  const { payload, mediaUrl } = buildStoryboardCandidatePayload({
    url: controlledUrl,
    media_type: 'image',
    source: 'asset-library',
    thumbnail_url: controlledUrl,
    download_url: controlledUrl,
  });
  assert.equal(mediaUrl, originalPath);
  assert.equal(payload.url, originalPath);
  assert.equal(payload.thumbnail_url, originalPath);
  assert.equal(payload.download_url, originalPath);
  assert.ok(payload.url.length <= 500);
});
