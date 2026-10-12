import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('缩略帧渐进显示、五分钟等待、缓存命中和资源释放', async () => {
  const source = await readFile(new URL('../src/components/video-edit/useVideoThumbnails.js', import.meta.url), 'utf8');
  const videos = [];
  const updates = [];
  const delays = [];
  let effect;
  const context = vm.createContext({
    useState: () => [{ key: '', frames: [] }, (value) => updates.push(value)],
    useEffect: (callback) => { effect = callback; },
    toVideoMediaUrl: (url) => url,
    setTimeout: (callback, delay) => { delays.push(delay); return 1; },
    clearTimeout() {}, queueMicrotask,
    document: { createElement(type) {
      if (type === 'canvas') return { getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,test' };
      const video = { duration: 6, currentTime: 0, readyState: 2, removeAttribute() { this.released = true; }, load() {} };
      videos.push(video);
      return video;
    } },
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default ', ''), context);
  context.useVideoThumbnails('/preview.mp4', 60);
  const cleanup = effect();
  videos[0].onloadeddata();
  videos[0].onseeked();
  assert.equal(updates.at(-1).frames.length, 1);
  for (let i = 1; i < 24; i++) videos[0].onseeked();
  assert.equal(updates.at(-1).frames.length, 24);
  assert.ok(videos[0].released);
  assert.ok(delays.every((delay) => delay === 300000));
  cleanup();
  assert.equal(context.useVideoThumbnails('/preview.mp4', 60).frames.length, 24);
  effect();
  assert.equal(videos.length, 1);
  context.useVideoThumbnails('/preview.mp4', 70);
  const cleanupOther = effect();
  assert.equal(videos.length, 2);
  cleanupOther();
  assert.ok(videos[1].released);
});

test('剪辑播放和缩略帧统一使用预览地址，保持固定24格宽度', async () => {
  const modal = await readFile(new URL('../src/components/video-edit/VideoTrimModal.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/components/video-edit/VideoTrim.css', import.meta.url), 'utf8');
  assert.match(modal, /sourceAsset\?\.preview_video_url \|\| sourceAsset\?\.previewVideoUrl \|\| videoUrl/);
  assert.match(modal, /src=\{previewUrl\}/);
  assert.match(modal, /VideoTrimTimeline videoUrl=\{previewUrl\}/);
  assert.match(css, /flex: 0 0 calc\(100% \/ 24\)/);
});
