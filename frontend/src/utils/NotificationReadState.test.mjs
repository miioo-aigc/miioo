import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfirmedReads, notificationKey } from './NotificationReadState.js';

test('迟到未读列表不会覆盖已确认的已读状态，公告和普通通知编号隔离', () => {
  const item = { kind: 'announcement', id: '1', unread: true };
  const confirmed = new Set([notificationKey(item)]);
  const result = mergeConfirmedReads([item, { id: '1', unread: true }], confirmed);
  assert.equal(result[0].unread, false);
  assert.equal(result[1].unread, true);
  assert.equal(item.unread, true);
});
test('写已读失败不加入确认集合，列表仍然未读；新账号集合为空', () => {
  const item = { kind: 'announcement', id: '1', unread: true };
  assert.equal(mergeConfirmedReads([item], new Set())[0].unread, true);
});
