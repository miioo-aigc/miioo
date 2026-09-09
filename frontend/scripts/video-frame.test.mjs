import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { orderedFrameTimes, frameAtTime } from '../src/components/video-edit/FrameIndex.js';

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
    UrlSource: class { constructor(url) { received.push(url); } },
    Input: class { async getPrimaryVideoTrack() { return null; } },
  });
  // Run the real worker entry point without browser globals or network/codec dependencies.
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
  await self.onmessage({ data: { type: 'open', url: '/api/media/downloads/test', baseUrl: 'https://app.example/creation' } });
  await self.onmessage({ data: { type: 'open', url: 'https://cdn.example/original.mp4', baseUrl: 'https://app.example/creation' } });
  assert.deepEqual(received, ['https://app.example/api/media/downloads/test', 'https://cdn.example/original.mp4']);
});
