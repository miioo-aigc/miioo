import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// 直接检查组件中的纯计算函数，无需浏览器或额外测试运行器。
const source = readFileSync(new URL('../src/components/image-edit/OutpaintModal.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function getAreaLimitWidth(');
const end = source.indexOf('function getDisplayState(', start);
assert.ok(start >= 0 && end > start);
const getAreaLimitWidth = new Function(`${source.slice(start, end)}; return getAreaLimitWidth;`)();
const resizeStart = source.indexOf('function getNextCanvas(');
const resizeEnd = source.indexOf('function RatioButton(', resizeStart);
assert.ok(resizeStart >= 0 && resizeEnd > resizeStart);
const getNextCanvas = new Function(`${source.slice(resizeStart, resizeEnd)}; return getNextCanvas;`)();

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

for (const [width, height] of [[948, 1659], [1659, 948], [1000, 1000]]) {
  test(`原比例 ${width}x${height}：默认框合法，面积上限为三倍`, () => {
    const ratio = width / height;
    const maximum = getAreaLimitWidth(ratio, { width, height });
    assert.ok(maximum > width * 1.5);
    close(maximum, width * Math.sqrt(3));
    close(maximum ** 2 / ratio / (width * height), 3);
  });
}

test('显示图片缩放后，上限同比变化', () => {
  const ratio = 948 / 1659;
  const base = getAreaLimitWidth(ratio, { width: 948, height: 1659 });
  for (const zoom of [0.5, 0.9, 1.1, 2, 4]) {
    close(getAreaLimitWidth(ratio, { width: 948 * zoom, height: 1659 * zoom }), base * zoom);
  }
});

test('固定比例保留面积上限和既有宽度因子限制', () => {
  for (const ratio of [16 / 9, 9 / 16, 4 / 3, 3 / 4, 1]) {
    const width = getAreaLimitWidth(ratio, { width: 948, height: 1659 });
    close(width, Math.min(948 * 3, Math.sqrt(3 * ratio * 948 * 1659)));
    assert.ok(width ** 2 / ratio <= 3 * 948 * 1659 + 1e-8);
  }
});

test('八方向向内越过最小边界时保持尺寸并标记裁剪提示', () => {
  for (const [handle, dx, dy] of [
    ['e', -100, 0], ['w', 100, 0], ['n', 0, 100], ['s', 0, -100],
    ['ne', -100, 100], ['nw', 100, 100], ['se', -100, -100], ['sw', 100, -100],
  ]) {
    const next = getNextCanvas({ width: 150 }, handle, dx, dy, 1, 100, 200);
    assert.deepEqual(next.canvas, { width: 100, height: 100 });
    assert.equal(next.crossedMinimum, true);
    assert.equal(next.reachedMaximum, false);
  }
});

test('恰好贴边、静止和向外拖动不标记裁剪提示', () => {
  for (const [width, dx] of [[150, -25], [100, 0], [100, 10], [150, 100]]) {
    assert.equal(getNextCanvas({ width }, 'e', dx, 0, 1, 100, 200).crossedMinimum, false);
  }
  assert.equal(getNextCanvas({ width: 100 }, 'e', -1, 0, 1, 100, 200).crossedMinimum, true);
});
