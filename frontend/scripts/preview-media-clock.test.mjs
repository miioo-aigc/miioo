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
