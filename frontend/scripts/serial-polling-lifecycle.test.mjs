import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/utils/serialPolling.js', import.meta.url), 'utf8').replace('export function', 'function');
function setup() {
  const timers = new Map(); let id = 0;
  const doc = new EventTarget(); doc.hidden = false;
  const create = new Function('document', 'setTimeout', 'clearTimeout', source + '\nreturn createSerialPolling;')(doc, fn => { timers.set(++id, fn); return id; }, key => timers.delete(key));
  return { create, timers, visibility(hidden) { doc.hidden = hidden; doc.dispatchEvent(new Event('visibilitychange')); }, tick() { const [key, fn] = timers.entries().next().value; timers.delete(key); return fn(); } };
}
for (const rejected of [false, true]) test('停止后抑制迟到' + (rejected ? '错误' : '结果'), async () => {
  const h = setup(); let resolve, reject, calls = 0;
  const p = h.create({ task: () => new Promise((a,b) => { resolve=a; reject=b; }), onResult: () => calls++, onError: () => calls++ });
  p.start(); const request = h.tick(); p.stop(); if (rejected) reject(Error()); else resolve(); await request;
  assert.equal(calls, 0); assert.equal(h.timers.size, 0);
});
test('显隐与重启均等待正在执行的请求结束，旧结果不发布', async () => {
  const h = setup(); const resolves=[]; let calls=0;
  const p=h.create({task:()=>new Promise(r=>resolves.push(r)),onResult:()=>calls++});
  p.start(); const request=h.tick(); h.visibility(true); h.visibility(false); assert.equal(h.timers.size,0);
  p.stop(); p.start(); assert.equal(h.timers.size,0); resolves[0](); await request;
  assert.equal(calls,0); assert.equal(h.timers.size,1);
  const next=h.tick(); resolves[1](); await next; assert.equal(calls,1); p.stop();
});
test('隐藏不发请求，恢复安排一轮，结果回调主动停止后不重排', async () => {
  const h=setup(); h.visibility(true);
  const p=h.create({task:async()=>1,onResult:()=>p.stop()}); p.start(); assert.equal(h.timers.size,0);
  h.visibility(false); assert.equal(h.timers.size,1); await h.tick(); assert.equal(h.timers.size,0);
});
