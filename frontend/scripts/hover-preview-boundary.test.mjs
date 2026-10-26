import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/hooks/useHoverPreviewBoundary.js', import.meta.url), 'utf8');
const create = new Function('useRef', source.slice(source.indexOf('/**')).replace('export function', 'function') + '\nreturn useHoverPreviewBoundary;')(value => ({ current: value }));
test('正常移出关闭，失败锁定允许跨越卡片与浮层间隙', () => {
  let closes = 0; const b = create(() => closes++);
  b.enter(); b.leave(); assert.equal(closes, 1);
  b.enter(); b.pin(true); b.leave(); assert.equal(closes, 1);
  b.dismiss(); assert.equal(closes, 2);
});
test('恢复成功后，保留原卡片悬停；离开原卡片则关闭', () => {
  let closes = 0; const b = create(() => closes++);
  b.enter(); b.pin(true); b.pin(false); assert.equal(closes, 0);
  b.pin(true); b.leave(); b.pin(false); assert.equal(closes, 1);
});
test('切换卡片清除旧锁定，关闭后新预览正常退出', () => {
  let closes = 0; const b = create(() => closes++);
  b.enter(); b.pin(true); b.leave(); b.enter(); b.leave(); assert.equal(closes, 1);
  b.enter(); b.pin(true); b.dismiss(); b.enter(); b.leave(); assert.equal(closes, 3);
});
