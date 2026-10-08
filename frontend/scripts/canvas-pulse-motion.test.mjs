import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasPulseTiming, getCanvasPulseTravel } from '../src/components/canvas/CanvasPulseMotion.js';

test('连线与卡片每一层均以相同的真实路径像素速度前进', () => {
  for (const cardLength of [240, 460, 780]) {
    for (const edgeLength of [20, 300, 2000, 10000]) {
      const timing = getCanvasPulseTiming(edgeLength, cardLength);
      for (const tail of [10, 7, 4, 1]) {
        const edge = getCanvasPulseTravel(edgeLength, tail, timing.speed);
        const card = getCanvasPulseTravel(cardLength, tail, timing.speed);
        assert.ok(Math.abs(card.duration - 600) < 1e-8);
        assert.ok(Math.abs((edge.from - edge.to) / edge.duration - (card.from - card.to) / card.duration) < 1e-8);
        assert.equal(edge.duration, timing.edgeDuration);
      }
    }
  }
});

test('严格匀速不限制极短和极长连线时长；无效测量不启动', () => {
  assert.equal(getCanvasPulseTiming(10, 600).edgeDuration, 10);
  assert.equal(getCanvasPulseTiming(10000, 600).edgeDuration, 10000);
  for (const value of [0, -1, NaN, Infinity, undefined]) {
    assert.equal(getCanvasPulseTiming(value, 600), null);
    assert.equal(getCanvasPulseTiming(600, value), null);
  }
});
