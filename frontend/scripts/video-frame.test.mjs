import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { orderedFrameTimes, frameAtTime } from '../src/components/video-edit/FrameIndex.js';

test('原画下载按预览时间读取原视频，保留原尺寸并释放资源', async () => {
  const source = await readFile(new URL('../src/components/video-edit/FrameDecoderWorker.js', import.meta.url), 'utf8');
  const urls = [];
  const messages = [];
  let closed = false;
  let disposed = false;
  const context = vm.createContext({
    self: { postMessage: (data) => messages.push(data) }, URL, ALL_FORMATS: [],
    toVideoMediaUrl: (url) => url,
    createFrameMediaSource: async (url) => { urls.push(url); return {}; },
    Input: class {
      async getPrimaryVideoTrack() { return { canDecode: async () => true }; }
      dispose() { disposed = true; }
    },
    VideoSampleSink: class {
      async getSample(time) {
        assert.equal(time, 1.25);
        return { displayWidth: 3840, displayHeight: 2160, draw() {}, close() { closed = true; } };
      }
    },
    OffscreenCanvas: class {
      constructor(width, height) { assert.equal(width, 3840); assert.equal(height, 2160); }
      getContext() { return {}; }
      async convertToBlob(options) { assert.equal(options.type, 'image/png'); return 'original-png'; }
    },
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
  vm.runInContext("previewSourceUrl = 'https://example.com/preview.mp4'; times = [1.25]; selected = 0; canvas = {};", context);
  assert.equal(urls.length, 0);
  await context.self.onmessage({ data: { type: 'export', index: 0, originalUrl: '/original.mp4', baseUrl: 'https://example.com/' } });
  assert.deepEqual(urls, ['https://example.com/original.mp4']);
  assert.equal(messages[0].blob, 'original-png');
  assert.ok(closed && disposed);
});

test('选帧等待五分钟超时，关闭弹窗仍清理计时器并终止解码', async () => {
  const source = await readFile(new URL('../src/components/video-edit/useFrameSelection.js', import.meta.url), 'utf8');
  assert.match(source, /\}, 5 \* 60 \* 1000\);/);
  assert.doesNotMatch(source, /\}, 30000\);/);
  assert.match(source, /return \(\) => \{[\s\S]*clearTimeout\(watchdog\);\s*decoder\.terminate\(\);/);
});

test('presentation order differs from decode order and retains variable frame durations', () => {
  assert.deepEqual(orderedFrameTimes([{ timestamp: 0 }, { timestamp: 0.12 }, { timestamp: 0.04 }, { timestamp: 0.09 }]), [0, 0.04, 0.09, 0.12]);
});
test('timeline uses actual frame timestamps rather than assumed frame rate', () => {
  const times = [0.2, 0.24, 0.31, 0.4];
  assert.equal(frameAtTime(times, 0), 0);
  assert.equal(frameAtTime(times, 0.3), 1);
  assert.equal(frameAtTime(times, 0.31), 2);
  assert.equal(frameAtTime(times, 99), 3);
});
test('invalid and duplicate timestamps do not create phantom frames', () => {
  assert.deepEqual(orderedFrameTimes([{ timestamp: 0 }, { timestamp: NaN }, { timestamp: 0 }, { timestamp: Infinity }]), [0]);
});

test('worker resolves relative media URLs against the page before creating the decoder source', async () => {
  const source = await readFile(new URL('../src/components/video-edit/FrameDecoderWorker.js', import.meta.url), 'utf8');
  const received = [];
  const self = { VideoDecoder() {}, OffscreenCanvas() {}, postMessage() {} };
  const context = vm.createContext({
    self, URL, ALL_FORMATS: [],
    toVideoMediaUrl: (url) => url,
    createFrameMediaSource: async (url) => { received.push(url); return {}; },
    Input: class { async getPrimaryVideoTrack() { return null; } },
  });
  // Run the real worker entry point without browser globals or network/codec dependencies.
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
  await self.onmessage({ data: { type: 'open', url: '/api/media/downloads/test', baseUrl: 'https://app.example/creation' } });
  await self.onmessage({ data: { type: 'open', url: 'https://cdn.example/original.mp4', baseUrl: 'https://app.example/creation' } });
  assert.deepEqual(received, ['https://app.example/api/media/downloads/test', 'https://cdn.example/original.mp4']);
});

test('连续缩略帧按真实时间解码且不覆盖选中画布，失败不影响大图', async () => {
  const source = await readFile(new URL('../src/components/video-edit/FrameDecoderWorker.js', import.meta.url), 'utf8');
  const messages = [], sampled = [], closed = [];
  const context = vm.createContext({
    self: { postMessage: value => messages.push(value) },
    OffscreenCanvas: class {
      constructor(width, height) { this.width = width; this.height = height; }
      getContext() { return {}; }
      async convertToBlob() { return { width: this.width, height: this.height }; }
    },
    mockSink: { async getSample(time) {
      sampled.push(time);
      if (time === 0.09) throw new Error('decode');
      return { displayWidth: 406, displayHeight: 720, draw() {}, close() { closed.push(time); } };
    } },
  });
  vm.runInContext(source.split(String.fromCharCode(10)).filter(line => !line.startsWith('import ')).join(String.fromCharCode(10)), context);
  vm.runInContext('times = [0, 0.04, 0.09, 0.12]; sink = mockSink; canvas = { original: true }; selected = 3; thumbnails = [0, 1, 2].map(index => ({ type: "thumbnail", index }));', context);
  await context.drain();
  assert.deepEqual(sampled, [0, 0.04, 0.09]);
  assert.deepEqual(closed, [0, 0.04]);
  assert.equal(messages[0].blob.height, 120);
  assert.equal(messages[0].blob.width, 68);
  assert.ok(messages.every(message => message.type === 'thumbnail'));
  assert.equal(messages[2].error, true);
  assert.equal(vm.runInContext('selected', context), 3);
  assert.equal(vm.runInContext('canvas.original', context), true);
});
