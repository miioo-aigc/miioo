import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speedOf, audioTargetTime, audioTimelineTime, pickActiveAudioWindow, adoptAudioCursor } from '../src/components/compositionEditor/PreviewAudioClock.js';
const seg = { type: 'audio', offset: 0, speed: 1 };
const adopt = (patch = {}) => adoptAudioCursor({ prevCursor: 3, prevMediaTime: 3, mediaTime: 3.1, seg, windowStart: 0, dt: 0.1, ...patch });
test('缺省与非法倍速回退为一，图片忽略倍速', () => {
  for (const speed of [undefined, 0, -1, NaN, Infinity, 'bad']) assert.equal(speedOf({ speed }), 1);
  assert.equal(speedOf({ type: 'image', speed: 2 }), 1);
});
test('合法倍速保留', () => assert.equal(speedOf({ speed: 1.5 }), 1.5));
test('偏移和倍速正反换算互逆', () => {
  const args = { seg: { offset: 4, speed: 2 }, windowStart: 5 };
  assert.equal(audioTargetTime({ ...args, cursor: 7 }), 8);
  assert.equal(audioTimelineTime({ ...args, mediaTime: 8 }), 7);
});
test('源时间不小于零', () => assert.equal(audioTargetTime({ seg, windowStart: 4, cursor: 0 }), 0));
test('窗口左闭右开', () => {
  const windows = [{ start: 0, end: 1 }, { start: 1, end: 2 }];
  assert.equal(pickActiveAudioWindow(windows, 0), windows[0]);
  assert.equal(pickActiveAudioWindow(windows, 1), windows[1]);
  assert.equal(pickActiveAudioWindow(windows, 2), null);
});
test('间隙和空窗口无命中', () => {
  assert.equal(pickActiveAudioWindow([{ start: 2, end: 3 }], 1), null);
  assert.equal(pickActiveAudioWindow([], 0), null);
});
test('媒体时间不可用时墙钟继续', () => assert.deepEqual(adopt({ mediaTime: NaN }), { next: 3.1, resyncTo: null }));
test('换算时间不可用时墙钟继续', () => assert.deepEqual(adopt({ windowStart: NaN }), { next: 3.1, resyncTo: null }));
test('明显回退优先于未前进判定', () => assert.deepEqual(adopt({ mediaTime: 1 }), { next: 3.1, resyncTo: 3 }));
test('短暂未前进不定位', () => assert.deepEqual(adopt({ mediaTime: 3 }), { next: 3.1, resyncTo: null }));
test('异常前跳限幅并定位', () => assert.deepEqual(adopt({ mediaTime: 5 }), { next: 3.25, resyncTo: 3.25 }));
test('正常时采用音频时间', () => assert.deepEqual(adopt(), { next: 3.1, resyncTo: null }));
test('缺少上一帧时间仍采用有效媒体时间', () => assert.deepEqual(adopt({ prevMediaTime: undefined }), { next: 3.1, resyncTo: null }));
