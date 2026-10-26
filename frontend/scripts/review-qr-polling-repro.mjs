import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/utils/serialPolling.js', import.meta.url), 'utf8').replace('export function', 'function');
function setup() {
  const timers = new Map(); let id = 0;
  const doc = new EventTarget(); doc.hidden = false;
  const create = new Function('document', 'setTimeout', 'clearTimeout', source + '\nreturn createSerialPolling;')(doc, fn => { timers.set(++id, fn); return id; }, key => timers.delete(key));
  return { create, doc, tick() { const [key, fn] = timers.entries().next().value; timers.delete(key); return fn(); } };
}
{
  const h = setup(); let resolve, callbacks = 0;
  const poll = h.create({ task: () => new Promise(r => { resolve = r; }), onResult: () => callbacks++ });
  poll.start(); const pending = h.tick(); poll.stop(); resolve('old'); await pending;
  assert.equal(callbacks, 1);
  console.log('已复现：停止后旧请求仍发布结果。');
}
{
  const h = setup(); const resolves = []; let active = 0, max = 0;
  const poll = h.create({ task: () => { active++; max = Math.max(max, active); return new Promise(r => resolves.push(() => { active--; r(); })); } });
  poll.start(); const first = h.tick();
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange'));
  const second = h.tick(); assert.equal(max, 2);
  poll.stop(); resolves.forEach(r => r()); await Promise.all([first, second]);
  console.log('已复现：请求未结束时隐藏再显示页面，出现两条并发轮询。');
}
{
  let auth = readFileSync(new URL('../src/api/auth.js', import.meta.url), 'utf8');
  auth = auth.slice(auth.indexOf('export async function apiPollWechatQrCodeStatus'), auth.indexOf('// 3.', auth.indexOf('export async function apiPollWechatQrCodeStatus'))).replace('export async function','async function').replaceAll('import.meta.env.VITE_USE_MOCK', '"false"');
  let resolve; const writes = [];
  const poll = new Function('fetch','BASE','setTokens', auth+'\nreturn apiPollWechatQrCodeStatus;')(() => new Promise(r => { resolve = r; }), '', (...args) => writes.push(args));
  const pending = poll('old-session');
  // 模拟用户已关闭旧登录入口；接口没有取消/归属参数可用于阻止提交。
  resolve({ ok: true, json: async () => ({ status: 'confirmed', access_token: 'synthetic-test-only' }) });
  await pending; assert.equal(writes.length, 1);
  console.log('已复现：轮询接口收到令牌即写入，全程没有当前登录流程归属检查。');
}
