import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatEastEightDateTime } from '../src/utils/formatTime.js';

test('UTC 和显式时区转换到东八区，省略毫秒', () => {
  assert.equal(formatEastEightDateTime('2026-10-13T06:34:53.519Z'), '2026-10-13 14:34:53');
  assert.equal(formatEastEightDateTime('2026-10-13T14:34:53+08:00'), '2026-10-13 14:34:53');
  assert.equal(formatEastEightDateTime('2026-10-13T02:34:53-04:00'), '2026-10-13 14:34:53');
});

test('无时区的接口时间按东八区处理', () => {
  assert.equal(formatEastEightDateTime('2026-10-13 14:34:53'), '2026-10-13 14:34:53');
  assert.equal(formatEastEightDateTime('2026-10-13T14:34:53.519'), '2026-10-13 14:34:53');
});

test('跨年和午夜不受本机时区影响', () => {
  assert.equal(formatEastEightDateTime('2026-12-31T16:00:00Z'), '2027-01-01 00:00:00');
});

test('空值和无法解析的时间安全兜底', () => {
  for (const value of [null, undefined, '', 'invalid', '2026-13-13T06:34:53Z']) {
    assert.equal(formatEastEightDateTime(value), '未知');
  }
});

test('主体图片详情使用东八区格式化函数', async () => {
  const source = await readFile(new URL('../src/components/assets/SubjectAssetDetailModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /formatEastEightDateTime\(currentImg.created_at\)/);
});
