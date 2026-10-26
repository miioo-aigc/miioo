import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createImagePreviewLoad } from '../src/utils/ImagePreviewLoad.js';
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const delay = ms => new Promise(r => setTimeout(r, ms));
function setup(resolveSrc, timeoutMs = 30000) {
  const network = new EventTarget(); network.navigator = { onLine: true };
  const states = [];
  const session = createImagePreviewLoad({ src: 'asset://a', resolveSrc, timeoutMs, network, onChange: s => states.push(s) });
  const emit = name => { network.navigator.onLine = name === 'online'; network.dispatchEvent(new Event(name)); };
  return { session, states, emit, get state() { return states.at(-1); } };
}
test('手动重试创建新代次，旧图片事件不能覆盖新结果', async () => {
  let calls = 0; const h = setup(() => '/image?signature=' + ++calls);
  try {
    h.session.start(); await tick(); const old = h.state;
    old.onError(); assert.equal(h.state.status, 'error');
    h.session.retry(); h.session.retry(); await tick(); assert.equal(calls, 2);
    h.state.onLoad(); old.onError(); assert.equal(h.state.status, 'loaded');
    assert.equal(h.state.resolvedSrc, '/image?signature=2');
  } finally { h.session.dispose(); }
});
test('解析超时取消，迟到结果不回写；手动重试可成功', async () => {
  let resolve, signal; const h = setup((src, options) => { signal = options.signal; return new Promise(r => { resolve = r; }); }, 15);
  try {
    h.session.start(); await tick(); const first = resolve; const firstSignal = signal;
    await delay(30); assert.equal(h.state.message, '图片加载超时'); assert.equal(firstSignal.aborted, true);
    h.session.retry(); await tick(); first('/old'); await tick(); assert.equal(h.state.resolvedSrc, '');
    resolve('/new'); await tick(); h.state.onLoad(); assert.equal(h.state.status, 'loaded');
  } finally { h.session.dispose(); }
});
test('图片文件挂起也有等待上限', async () => {
  const h = setup(() => '/image', 10);
  try { h.session.start(); await tick(); await delay(25); assert.equal(h.state.status, 'error'); } finally { h.session.dispose(); }
});
test('联网事件不会无条件重试，断网恢复仅自动一次，之后仍可手动', async () => {
  let calls = 0; const h = setup(() => { calls++; throw Error('断网'); });
  try {
    h.session.start(); await tick(); h.emit('online'); await delay(20); assert.equal(calls, 1);
    h.emit('offline'); h.emit('online'); h.emit('online'); await delay(1100); assert.equal(calls, 2);
    h.emit('offline'); h.emit('online'); await delay(1100); assert.equal(calls, 2);
    h.session.retry(); await tick(); assert.equal(calls, 3);
  } finally { h.session.dispose(); }
});
test('恢复时请求尚未失败，后续失败也可消费一次恢复机会', async () => {
  const h = setup(() => '/image');
  try { h.session.start(); await tick(); h.emit('offline'); h.emit('online'); h.state.onError(); await delay(1100); assert.equal(h.state.attempt, 2); } finally { h.session.dispose(); }
});
test('成功图片不随联网刷新，卸载清理监听与迟到回执', async () => {
  const h = setup(() => '/image'); h.session.start(); await tick(); h.state.onLoad(); h.emit('offline'); h.emit('online');
  await delay(1100); assert.equal(h.state.attempt, 1);
  h.session.dispose(); const count = h.states.length; h.emit('offline'); h.emit('online'); h.state.onError(); h.session.start(); await tick(); assert.equal(h.states.length, count);
});
test('严格模式清理后的启动不发解析请求', async () => {
  let calls = 0; const h = setup(() => { calls++; }); h.session.dispose(); h.session.start(); await tick(); assert.equal(calls, 0);
});
const source = readFileSync(new URL('../src/api/liveMaterials.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export async function apiGetLiveMaterialPreviewByRef'), source.indexOf('/** 删除真人素材 */')).replace('export ', '');
function resolver(groups, assets, preview = async () => ({ previewUrl: '/ok' })) {
  return new Function('apiListLiveMaterialGroups', 'apiListLiveMaterialAssets', 'apiGetLiveMaterialPreview', body + String.fromCharCode(10) + 'return apiGetLiveMaterialPreviewByRef;')(groups, assets, preview);
}
test('素材组临时失败不变成空结果缓存，恢复可重新解析', async () => {
  let fail = true, calls = 0;
  const read = resolver(async () => [{ id: 'g' }], async () => { calls++; if (fail) throw Error('断网'); return [{ id: 'a', asset_ref_url: 'asset://a' }]; });
  await assert.rejects(read('asset://a'), /断网/); fail = false; assert.equal(await read('asset://a'), '/ok'); assert.equal(calls, 2);
});
test('真正未找到不缓存；成功短时地址也会重新获取', async () => {
  let found = false, count = 0;
  const read = resolver(async () => [{ id: 'g' }], async () => found ? [{ id: 'a', asset_ref_url: 'asset://a' }] : [], async () => ({ previewUrl: '/signed/' + ++count }));
  assert.equal(await read('asset://a'), null); found = true;
  assert.equal(await read('asset://a'), '/signed/1'); assert.equal(await read('asset://a'), '/signed/2');
});
test('其他组失败不阻断已找到素材；异常列表拒绝', async () => {
  const read = resolver(async () => [{ id: 1 }, { id: 2 }], async id => { if (id === 1) throw Error('故障'); return [{ id: 'a', asset_ref_url: 'asset://a' }]; });
  assert.equal(await read('asset://a'), '/ok');
  await assert.rejects(resolver(async () => ({}), async () => [])('asset://a'), /响应异常/);
});

test('缩略图失败自动回退原图，旧缩略图回执不覆盖原图', async () => {
  const network = new EventTarget(); network.navigator = { onLine: true };
  let state;
  const h = createImagePreviewLoad({ src: '/thumb', fallbackSrc: '/original', network, onChange: s => { state = s; } });
  try {
    h.start(); await tick(); const old = state; assert.equal(state.resolvedSrc, '/thumb');
    old.onError(); await tick(); assert.equal(state.resolvedSrc, '/original');
    old.onLoad(); assert.equal(state.status, 'loading'); state.onLoad(); assert.equal(state.status, 'loaded');
  } finally { h.dispose(); }
});
test('原图也失败后停止回退，手动重试继续原图，相同地址不循环', async () => {
  const network = new EventTarget(); network.navigator = { onLine: true };
  let state;
  const h = createImagePreviewLoad({ src: '/same', fallbackSrc: '/same', network, onChange: s => { state = s; } });
  try { h.start(); await tick(); state.onError(); await tick(); assert.equal(state.status, 'error'); assert.equal(state.attempt, 1); h.retry(); await tick(); assert.equal(state.resolvedSrc, '/same'); } finally { h.dispose(); }
});

test('缩略图和原图均失败后不会循环，重试仍用原图', async () => {
  const network = new EventTarget(); network.navigator = { onLine: true }; let state;
  const h = createImagePreviewLoad({ src: '/thumb', fallbackSrc: '/full', network, onChange: s => { state = s; } });
  try { h.start(); await tick(); state.onError(); await tick(); state.onError(); await tick(); assert.equal(state.status, 'error'); assert.equal(state.attempt, 2); h.retry(); await tick(); assert.equal(state.resolvedSrc, '/full'); } finally { h.dispose(); }
});
