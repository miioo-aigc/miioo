import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';

const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { compositionMediaSource } = await server.ssrLoadModule('/src/utils/CompositionMediaSource.js');
const { finalizedMediaToAsset, resolveFinalizedStoryboardAssets, selectFinalizedStoryboardAssets, getMissingCompositionAssets } = await server.ssrLoadModule('/src/utils/FinalizedStoryboardAssets.js');
const { useCompositionEditorStore: store, serializeTimeline } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const original = 'https://example.test/original-1280x720.mp4?signature=preserved';
const preview = 'https://example.test/preview-864x496.mp4';
const shot = { id: 'shot', episode_id: 'episode', shot_number: 1 };

test('视频使用原文件并保留签名，图片仍用文件地址', () => {
  for (const download of [{ download_url: original }, { downloadUrl: original }]) {
    assert.equal(compositionMediaSource({ asset_type: 'video', file_url: preview, ...download }), original);
    const asset = finalizedMediaToAsset({ shot, media: { asset_id: 'asset', media_type: 'video', url: preview, ...download } });
    assert.equal(asset.file_url, original);
    assert.equal(asset.metadata_json.storyboard_media_url, preview);
  }
  assert.equal(compositionMediaSource({ asset_type: 'image', file_url: '/image.png', download_url: '/attachment' }), '/image.png');
  assert.equal(compositionMediaSource({ asset_type: 'video', file_url: '/uploaded.mp4' }), '/uploaded.mp4');
});

test('旧候选补查详情、失败不使用预览，原地址变化不丢失定稿筛选', async () => {
  const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage };
  globalThis.localStorage = { getItem: () => 'test-only' };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json(String(url).endsWith('/broken') ? { detail: '不存在' }
      : { id: 'legacy', asset_type: 'video', file_url: preview, download_url: original });
  };
  try {
    const media = { mediaType: 'video', url: preview, metadata: { asset_id: 'legacy' } };
    const result = await resolveFinalizedStoryboardAssets('project', [
      { shot, media }, { shot, media: { ...media, asset_id: 'broken' } },
      { shot, media: { ...media, asset_id: 'ready', downloadUrl: original } },
    ]);
    assert.equal(result.unavailable, 1);
    assert.deepEqual(result.assets.map((a) => a.file_url), [original, original]);
    assert.equal(calls.length, 2);
    assert.equal(selectFinalizedStoryboardAssets(result.assets.map((a) => ({ ...a, fileUrl: a.file_url })), [{ shot, media }], 'episode').length, 1);
    const missing = await getMissingCompositionAssets([{ clip_id: 'legacy' }], []);
    assert.equal(compositionMediaSource(missing[0]), original);
  } finally { Object.assign(globalThis, previous); }
});

test('新加轨道与旧草稿恢复都读取原文件，保留时间线参数', async () => {
  const asset = { id: 'asset', asset_type: 'video', duration: 10, fileUrl: original, videoUrl: original };
  store.setState({ ...store.getInitialState(), album: [asset] });
  store.getState().addAsset(asset);
  assert.equal(store.getState().segments[0].sourceUrl, original);
  const timeline = [{ clip_id: 'asset', type: 'video', track: 'V1', start: 0, duration: 4, offset: 2, speed: 1 }];
  await store.getState().init({ projectId: 'project', compId: 'draft', episodeId: 'episode', compositions: [{ id: 'draft', episodeId: 'episode', timeline }] });
  const segment = store.getState().segments[0];
  assert.equal(segment.sourceUrl, original);
  assert.equal(segment.offset, 2);
  assert.equal(segment.duration, 4);
  const serialized = serializeTimeline([segment])[0];
  assert.equal(serialized.clip_id, 'asset');
  assert.equal(serialized.offset, 2);
  assert.equal('sourceUrl' in serialized, false);
});

test('受控原文件经登录请求读取，外部直链不附加登录头，错误不退回预览', async () => {
  const { isProtectedCompositionSource, loadCompositionMediaBlob } = await server.ssrLoadModule('/src/api/CompositionMediaPlayback.js');
  const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  globalThis.window = { location: { origin: 'https://app.test' } };
  globalThis.localStorage = { getItem: () => 'test-only' };
  const source = '/api/projects/p/storyboards/s/media-candidates/m/download';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, source);
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    return new Response('original-video', { headers: { 'Content-Type': 'video/mp4' } });
  };
  try {
    assert.equal(isProtectedCompositionSource(source), true);
    assert.equal(isProtectedCompositionSource('https://outside.test' + source), false);
    assert.equal(isProtectedCompositionSource(original), false);
    assert.equal((await loadCompositionMediaBlob(source)).type, 'video/mp4');
    globalThis.fetch = async () => new Response('failure', { status: 500 });
    await assert.rejects(loadCompositionMediaBlob(source), /500/);
    globalThis.fetch = async () => Response.json({ detail: '不可用' });
    await assert.rejects(loadCompositionMediaBlob(source), /无效/);
  } finally { Object.assign(globalThis, previous); }
});
