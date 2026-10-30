import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
const server = await createTestViteServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { compositionAssetCoverUrls: covers } = await server.ssrLoadModule('/src/utils/CompositionAssetCover.js');
const { default: AssetCover } = await server.ssrLoadModule('/src/components/compositionEditor/AssetCover.jsx');
test('缩略图、视频封面优先，签名保留并去重', () => {
  assert.deepEqual(covers({ asset_type: 'video', thumbnail_url: '/small.webp?sig=1', video_thumbnail_url: '/poster.jpg', posterUrl: '/poster.jpg', file_url: '/original.mp4' }), ['/small.webp?sig=1', '/poster.jpg']);
});
test('兼容元数据与驼峰字段，原图不冒充小图', () => {
  assert.deepEqual(covers({ asset_type: 'image', thumbnailUrl: '/original.png', fileUrl: '/original.png', metadata_json: { thumbnail_url: '/tiny.webp' } }), ['/tiny.webp']);
});
test('有视频封面时只挂载图片，不挂载或请求原视频', () => {
  const markup = renderToStaticMarkup(createElement(AssetCover, { asset: { asset_type: 'video', thumbnailUrl: '/small.webp', fileUrl: '/original.mp4' } }));
  assert.match(markup, /<img/);
  assert.doesNotMatch(markup, /<video|original.mp4/);
});
test('没有封面时视频走原生首帧且不自动播放；图片回退原图', () => {
  const video = renderToStaticMarkup(createElement(AssetCover, { asset: { asset_type: 'video', fileUrl: '/original.mp4' } }));
  assert.match(video, /<video/);
  assert.match(video, /preload="metadata"/);
  assert.doesNotMatch(video, /autoPlay|autoplay/);
  const image = renderToStaticMarkup(createElement(AssetCover, { asset: { asset_type: 'image', fileUrl: '/original.png' } }));
  assert.match(image, /src="\/original.png"/);
});
