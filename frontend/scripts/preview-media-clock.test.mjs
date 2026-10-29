import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PreviewMediaClock, mediaTime, timelineTime } from '../src/components/compositionEditor/PreviewMediaClock.js';

function media() {
  return { src: 'test.mp3', currentTime: 0, readyState: 4, paused: true, seeking: false, ended: false,
    plays: 0, seeks: 0, listeners: new Map(),
    getAttribute() { return this.src; },
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name) { this.listeners.delete(name); },
    pause() { this.paused = true; },
    play() { this.plays++; this.paused = false; this.listeners.get('playing')?.(); return Promise.resolve(); },
  };
}
const window = { start: 0, end: 10, seg: { type: 'audio', sourceUrl: 'test.mp3', offset: 0, speed: 1 } };

test('尚未注册的预览和外部加载门控冻结指针与声音，取消播放后不会自动续播', async () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  const cleanup = clock.register('A1', audio, window, true, true, () => 2);
  await Promise.resolve();
  await Promise.resolve();
  clock.require(['A1', 'video-new']);
  assert.equal(clock.tick(2, 1, 1000, 10), 2);
  assert.equal(audio.paused, true);
  clock.require(['A1']);
  clock.setBlocked(true);
  assert.equal(clock.tick(2, 1, 2000, 10), 2);
  cleanup();
  clock.register('A1', audio, window, true, false, () => 2);
  clock.setBlocked(false);
  clock.tick(2, 1, 3000, 10);
  assert.equal(audio.paused, true);
});

test('offset and speed conversions are inverse', () => {
  const item = { start: 3, seg: { offset: 2, speed: 1.5 } };
  assert.equal(mediaTime(item, 5), 5);
  assert.equal(timelineTime(item, 5), 5);
});
test('normal playback reads media time without repeated play or seek', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  clock.register('A1', audio, window, true, true, () => 0);
  let time = 0;
  Object.defineProperty(audio, 'currentTime', { get: () => time, set(value) { this.seeks++; time = value; } });
  for (let i = 1; i <= 30; i++) {
    time = i / 60;
    assert.equal(clock.tick((i - 1) / 60, 1 / 60, i * 16, 10), i / 60);
  }
  assert.equal(audio.plays, 1);
  assert.equal(audio.seeks, 0);
});
test('media failure reports once and does not retry play on every frame', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  let failures = 0;
  clock.register('A1', audio, window, true, true, () => 0, () => failures++);
  audio.listeners.get('error')();
  for (let i = 0; i < 60; i++) assert.equal(clock.tick(0, 1 / 60, i * 16, 10), 0);
  assert.equal(failures, 1);
  assert.equal(audio.plays, 1);
});
test('muted audio is not master and exceptional jumps are rate limited', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  clock.register('A1', audio, window, false, true, () => 0);
  assert.equal(clock.tick(0, 0.1, 0, 10), 0.1);
  clock.register('A1', audio, window, true, true, () => 0);
  audio.currentTime = 5;
  assert.equal(clock.tick(0, 0.1, 0, 10), 0.25);
  assert.equal(audio.currentTime, 0.25);
  assert.equal(clock.tick(0.25, 0.1, 16, 10), 0.25);
  assert.equal(audio.currentTime, 0.25);
});
test('缓冲时冻结全部轨道，全部就绪后采用音频时钟', async () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  const follower = media();
  clock.register('A2', audio, window, true, true, () => 0);
  clock.register('video', follower, { ...window, seg: { ...window.seg, type: 'video' } }, false, true, () => 0);
  await Promise.resolve();
  await Promise.resolve();
  audio.readyState = 2;
  assert.equal(clock.tick(0, 0.1, 100, 10), 0);
  assert.equal(follower.paused, true);
  audio.readyState = 4;
  audio.currentTime = 0.1;
  assert.equal(clock.tick(0, 0.1, 200, 10), 0);
  assert.equal(follower.paused, false);
});
test('gaps retain source and use wall time bounded by next segment', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  clock.register('A1', audio, null, false, true, () => 0);
  assert.equal(audio.src, 'test.mp3');
  assert.equal(audio.paused, true);
  assert.equal(clock.tick(1, 0.5, 100, 1.2), 1.2);
});
test('explicit seek positions once, same source reuses buffer and metadata uses latest cursor', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  const cleanup = clock.register('A1', audio, window, true, false, () => 3);
  assert.equal(audio.currentTime, 3);
  cleanup();
  let cursor = 4;
  clock.register('A1', audio, { ...window, seg: { ...window.seg, sourceUrl: 'new.mp3' } }, true, false, () => cursor);
  cursor = 5;
  audio.listeners.get('loadedmetadata')();
  assert.equal(audio.currentTime, 5);
});
test('master cannot advance past a clip boundary and ended media advances to its end', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  clock.register('A1', audio, window, true, true, () => 0);
  audio.currentTime = 0.3;
  assert.equal(clock.tick(0, 0.3, 300, 0.2), 0.2);
  audio.ended = true;
  assert.equal(clock.tick(9.9, 0.1, 10000, 10), 10);
});

test('冷加载直到真实播放才采用媒体时间，定位期间不重复纠偏', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  audio.src = 'old.mp3';
  audio.play = function () { this.plays++; this.paused = false; return Promise.resolve(); };
  clock.register('A1', audio, window, true, true, () => 0);
  audio.listeners.get('loadedmetadata')();
  audio.currentTime = 2;
  assert.equal(clock.tick(0, 0.1, 100, 10), 0);
  audio.listeners.get('playing')();
  assert.equal(clock.tick(0.1, 0.1, 200, 10), 0.35);
  audio.seeking = true;
  assert.equal(clock.tick(0.35, 0.1, 216, 10), 0.35);
  assert.equal(audio.currentTime, 0.35);
  assert.equal(audio.plays, 1);
});
test('缓冲较久恢复后仍从冻结位置同步启动', async () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  const follower = media();
  clock.register('A1', audio, window, true, true, () => 0);
  clock.register('A2', follower, window, true, true, () => 0);
  await Promise.resolve();
  await Promise.resolve();
  audio.readyState = 2;
  assert.equal(clock.tick(0, 1, 1000, 10), 0);
  assert.equal(follower.paused, true);
  audio.readyState = 4;
  assert.equal(clock.tick(0, 0.1, 1100, 10), 0);
  assert.equal(audio.currentTime, 0);
  assert.equal(follower.plays, 2);
});
test('附加音轨缓冲恢复事件按最新游标对齐', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  let cursor = 0;
  clock.register('A2', audio, window, true, true, () => cursor);
  audio.listeners.get('waiting')();
  cursor = 2;
  audio.listeners.get('playing')();
  assert.equal(audio.currentTime, 2);
  audio.currentTime = 2.2;
  audio.listeners.get('playing')();
  assert.equal(audio.currentTime, 2.2);
});


test('图片就绪且没有视频或音频时，时间线连续推进', () => {
  const clock = new PreviewMediaClock();
  clock.setBlocked(true);
  assert.equal(clock.tick(0, 0.1, 100, 3), 0);
  clock.setBlocked(false);
  let cursor = 0;
  for (let i = 0; i < 30; i++) cursor = clock.tick(cursor, 0.1, i * 100, 3);
  assert.equal(cursor, 3);
});

test('音频跨域加载失败上报，替换为同源地址后可恢复播放', () => {
  const clock = new PreviewMediaClock();
  const audio = media();
  audio.readyState = 0;
  let failures = 0;
  const cleanup = clock.register('A1', audio, window, true, true, () => 0, () => failures++);
  audio.listeners.get('error')();
  assert.equal(failures, 1);
  assert.equal(clock.tick(0, 0.1, 100, 10), 0);
  cleanup();
  audio.readyState = 4;
  clock.register('A1', audio, { ...window, seg: { ...window.seg, sourceUrl: '/__dev-media/media/origin/audio.mp3' } }, true, true, () => 0);
  clock.tick(0, 0.1, 200, 10);
  audio.currentTime = 0.1;
  assert.equal(clock.tick(0, 0.1, 300, 10), 0.1);
});

for (const type of ['audio', 'video']) test(type + '自然结束后不重新启动旧素材，穿过空档并接续下一段', async () => {
  const clock = new PreviewMediaClock();
  const el = media();
  el.play = function () {
    if (this.ended) { this.ended = false; this.currentTime = 0; }
    this.plays++; this.paused = false; this.listeners.get('playing')?.();
    return Promise.resolve();
  };
  let cursor = 9.95;
  const cleanup = clock.register('track', el, { ...window, seg: { ...window.seg, type } }, true, true, () => cursor);
  await new Promise(resolve => setImmediate(resolve));
  el.currentTime = 10; el.ended = true; el.paused = true; el.readyState = 2;
  clock.require(['track']);
  assert.equal(clock.tick(cursor, 0.05, 100, 10), 10);
  assert.equal(el.plays, 1);
  cleanup();
  clock.register('track', el, null, false, true, () => cursor);
  clock.require([]);
  cursor = 10;
  for (let i = 0; i < 10; i++) cursor = clock.tick(cursor, 0.5, 200 + i * 500, 15);
  assert.equal(cursor, 15);
  assert.equal(el.plays, 1);
  const next = media();
  clock.register('track', next, { ...window, start: 15, end: 25, seg: { ...window.seg, type } }, true, true, () => cursor);
  clock.require(['track']);
  next.currentTime = 0.1;
  assert.equal(clock.tick(cursor, 0.1, 6000, 25), 15.1);
});

test('片段自然结束后就绪状态正常也不能重播，其他音轨继续推进', async () => {
  const clock = new PreviewMediaClock();
  const ended = media();
  const other = media();
  clock.register('A1', ended, window, true, true, () => 5);
  clock.register('A2', other, window, true, true, () => 5);
  await new Promise(resolve => setImmediate(resolve));
  ended.ended = true; ended.paused = true;
  other.currentTime = 5.1;
  assert.equal(clock.tick(5, 0.1, 100, 10), 5.1);
  assert.equal(ended.plays, 1);
});
