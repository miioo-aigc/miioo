import test from 'node:test';
import assert from 'node:assert/strict';
import { durationTicks, formatTrimTime, parseTrimTime, updateTrimRange } from '../src/components/video-edit/TrimRange.js';

test('时长向下对齐十分秒，不越过视频末尾', () => {
  assert.equal(durationTicks(4.99), 49);
  assert.equal(durationTicks(0.09), 0);
  assert.equal(durationTicks(Infinity), 0);
});
test('时间文本在小时与分钟边界可逆', () => {
  for (const tick of [0, 1, 49, 599, 600, 35999, 36000, 1234567]) {
    assert.equal(parseTrimTime(formatTrimTime(tick)), tick);
  }
});
test('拒绝非法范围文本', () => {
  for (const text of ['', 'abc', '-00:00:00.1', '00:60:00.0', '00:00:60.0', '00:00:01.23']) assert.equal(parseTrimTime(text), null);
});
test('起点不越过终点，至少保留0.1秒', () => {
  assert.deepEqual(updateTrimRange({ start: 0, end: 49 }, 'start', 80, 100), { start: 48, end: 49 });
});
test('终点不越过视频末尾或起点', () => {
  assert.deepEqual(updateTrimRange({ start: 20, end: 49 }, 'end', 200, 100), { start: 20, end: 100 });
  assert.deepEqual(updateTrimRange({ start: 20, end: 49 }, 'end', 0, 100), { start: 20, end: 21 });
});
test('时长步进固定起点，不产生浮点累计误差', () => {
  let range = { start: 20, end: 49 };
  for (let i = 0; i < 10; i++) range = updateTrimRange(range, 'end', range.end + 1, 100);
  assert.deepEqual(range, { start: 20, end: 59 });
});
test('无效值不修改选区', () => {
  const range = { start: 0, end: 49 };
  assert.equal(updateTrimRange(range, 'end', NaN, 100), range);
  assert.equal(updateTrimRange(range, 'end', 1, 0), range);
});
test('连续随机端点更新始终只保留一个合法区间', () => {
  let range = { start: 0, end: 100 };
  for (let i = -100; i <= 200; i++) {
    range = updateTrimRange(range, i % 2 ? 'start' : 'end', i, 100);
    assert.ok(range.start >= 0 && range.end <= 100 && range.end - range.start >= 1);
  }
});
