import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/components/canvas/UseCanvasVideoAutoplay.js', import.meta.url), 'utf8');
function setup() {
  const refs = [];
  let index = 0, cleanup, plays = 0;
  const listeners = new Map();
  const target = {};
  const node = { contains: (value) => value === target };
  const video = { getAttribute: () => video.src, load() {} };
  const run = vm.runInNewContext(source.replace(/^import .*;$/gm, '').replace('export function', 'function') + '; useCanvasVideoAutoplay', {
    useRef: (value) => refs[index++] ||= { current: value },
    useEffect: (fn) => { cleanup?.(); cleanup = fn(); },
    hasBlockingDialog: () => false,
    document: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: (key) => listeners.delete(key) },
    window: { addEventListener() {}, removeEventListener() {} },
  });
  return {
    render(active) { index = 0; run({ current: video }, { current: { closest: () => node } }, active, '/video.mp4', () => { plays++; }, () => {}); },
    event(type, x = 0, outside = false) { listeners.get(type)?.({ target: outside ? {} : target, button: 0, pointerId: 1, clientX: x, clientY: 0 }); },
    plays: () => plays,
  };
}
test('单击选中松开后播放，按下选中时不提前播放', () => {
  const player = setup(); player.render(false); player.event('pointerdown'); player.render(true);
  assert.equal(player.plays(), 0);
  player.event('pointerup'); assert.equal(player.plays(), 1);
});
test('拖动选中和移回原位都不触发播放，取消手势也不播放', () => {
  for (const cancel of [false, true]) {
    const player = setup(); player.render(false); player.event('pointerdown'); player.render(true);
    player.event('pointermove', 20); player.event(cancel ? 'pointercancel' : 'pointerup', 0);
    assert.equal(player.plays(), 0);
  }
});
test('键盘选中仍自动播放，已选中后拖动不重新启动播放', () => {
  const player = setup(); player.render(true); assert.equal(player.plays(), 1);
  player.event('pointerdown'); player.event('pointermove', 20); player.event('pointerup', 20);
  assert.equal(player.plays(), 1);
});

test('框选中及释放后更新选中态都不播放，之后单击仍能播放', () => {
  for (const afterRelease of [false, true]) {
    const player = setup();
    player.render(false);
    player.event('pointerdown', 0, true);
    player.event('pointermove', 50, true);
    if (afterRelease) player.event('pointerup', 50, true);
    player.render(true);
    if (!afterRelease) player.event('pointerup', 50, true);
    assert.equal(player.plays(), 0);
    player.render(false);
    player.event('pointerdown');
    player.render(true);
    player.event('pointerup');
    assert.equal(player.plays(), 1);
  }
});
test('框选后通过键盘重新选中可自动播放', () => {
  const player = setup(); player.render(false);
  player.event('pointerdown', 0, true); player.event('pointerup', 50, true);
  player.render(true); assert.equal(player.plays(), 0);
  player.render(false); player.event('keydown'); player.render(true);
  assert.equal(player.plays(), 1);
});
