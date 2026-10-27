import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasOriginalImage, getCanvasImagePreview, getCanvasVideoPoster } from '../src/components/canvas/CanvasMediaSources.js';
import { prepareCanvasMediaAsset } from '../src/components/canvas/CanvasMediaSize.js';
import { toCanvasAsset } from '../src/components/canvas/CanvasAssets.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('卡片优先缩略图，兼容预览图及缺失回退，保留原文件', () => {
  const asset = { thumbnail_url: '/thumb.jpg', previewUrl: '/preview.jpg', url: '/original.jpg' };
  assert.equal(getCanvasImagePreview(asset), '/thumb.jpg');
  assert.equal(getCanvasImagePreview({ preview_url: '/preview.jpg', url: '/original.jpg' }), '/preview.jpg');
  assert.equal(getCanvasImagePreview({ url: '/original.jpg' }), '/original.jpg');
  assert.equal(asset.url, '/original.jpg');
  assert.equal(getCanvasVideoPoster({ thumbnail_url: '/thumb.jpg', posterUrl: '/poster.jpg', url: '/video.mp4' }), '/thumb.jpg');
  assert.equal(getCanvasVideoPoster({ url: '/video.mp4' }), undefined);
  const imported = toCanvasAsset({ assetType: 'video', fileUrl: '/video.mp4', url: '/thumb.jpg' }, 'video');
  assert.equal(imported.url, '/video.mp4');
  assert.equal(getCanvasVideoPoster(imported), '/thumb.jpg');
});

test('缺少尺寸时使用缩略图或封面探测，不额外读取原图和视频', async (t) => {
  const previous = globalThis.Image;
  const requests = [];
  globalThis.Image = class {
    set src(value) {
      requests.push(value);
      this.naturalWidth = 1600;
      this.naturalHeight = 900;
      queueMicrotask(() => this.onload());
    }
  };
  t.after(() => { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; });
  for (const asset_type of ['image', 'video']) {
    const asset = { asset_type, thumbnailUrl: '/thumb.jpg', url: '/original' };
    const prepared = await prepareCanvasMediaAsset(asset);
    assert.equal(prepared.url, '/original');
    assert.equal(prepared.width, 1600);
    assert.equal(prepared.height, 900);
  }
  assert.deepEqual(requests, ['/thumb.jpg', '/thumb.jpg']);
});

test('视频悬停延迟结束后才挂载地址，快速移出取消加载', async () => {
  const source = readFileSync(new URL('../src/components/canvas/CanvasVideoPlayer.jsx', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('  const videoRef'), source.indexOf('  return <div'));
  let pending;
  let loads = 0;
  let plays = 0;
  const video = { getAttribute: () => video.src, load: () => loads++, play: async () => plays++, pause() {} };
  const factory = vm.runInNewContext('(function(src, poster) {' + body + '; return { start, stop, videoRef }; })', {
    useRef: (current) => ({ current }), useEffect() {}, useMediaPlayback: ref => ({ pause: () => ref.current?.pause(), play: () => ref.current?.play() }), document: { querySelector: () => null },
    setTimeout: (callback) => { pending = callback; }, clearTimeout: () => { pending = undefined; },
  });
  const player = factory('/original.mp4');
  player.videoRef.current = video;
  assert.equal(video.src, undefined);
  player.start({ buttons: 0 });
  assert.equal(loads, 0);
  player.stop();
  assert.equal(pending, undefined);
  player.start({ buttons: 0 });
  await pending();
  assert.equal(video.src, '/original.mp4');
  assert.equal(loads, 1);
  assert.equal(plays, 1);
  player.start({ buttons: 0 });
  await pending();
  assert.equal(loads, 1);
});

test('详情优先原图及文件地址，卡片继续使用缩略图', () => {
  for (const key of ['originalUrl', 'original_url', 'fileUrl', 'file_url', 'persistentUrl', 'uploaded_url']) {
    const asset = { [key]: '/full.png', url: '/preview.webp', thumbnailUrl: '/thumb.webp' };
    assert.equal(getCanvasOriginalImage(asset), '/full.png');
    assert.equal(getCanvasImagePreview(asset), '/thumb.webp');
  }
});
