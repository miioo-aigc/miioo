import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOperationLogTime } from './OperationLogTime.js';

test('操作日志时间补齐秒且不转换北京时间', () => {
  assert.equal(formatOperationLogTime('2026-10-13T09:05'), '2026-10-13 09:05:00');
  assert.equal(formatOperationLogTime('2026-10-13T09:05:37'), '2026-10-13 09:05:37');
  assert.equal(formatOperationLogTime('2026-10-13 09:05:37'), '2026-10-13 09:05:37');
  assert.equal(formatOperationLogTime(''), '');
});
