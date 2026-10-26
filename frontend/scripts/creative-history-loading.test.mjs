import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCreationHistoryPage } from '../src/api/CreationHistoryRead.js';
import { createCreationHistoryVisit } from '../src/utils/CreationHistoryScope.js';

const source = readFileSync(new URL('../src/components/assets/AssetsCreativePanel.jsx', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture() {
  let setup;
  const requests = [];
  const meta = { current: { image: { page: 0, hasMore: true, loading: false, initialized: false } } };
  const locks = { current: new Map() }, visitRef = { current: null };
  let generations = { image: [] };
  const bindings = {
    useLayoutEffect: fn => { setup = fn; }, ownerId: '甲', getAuthSessionGeneration: () => 1,
    useCreationStore: { getState: () => ({ ownerId: '甲' }) }, createCreationHistoryVisit, visitRef,
    historyRequestTabsRef: locks, creationHistoryMetaRef: meta,
    useCallback: fn => fn, isLoggedIn: true,
    setCreationHistoryMeta: fn => { meta.current = fn(meta.current); },
    calcCreativePageSize: () => 10, AbortController,
    readCreationHistoryPage: (load, options) => readCreationHistoryPage(load, { ...options, timeoutMs: 30 }),
    apiListCreationImages: () => { const request = deferred(); requests.push(request); return request.promise; },
    apiListCreationVideos: () => {}, apiListCreationAudios: () => {},
    dedupeCreationHistoryList: list => list, normalizeHistoryItem: item => ({ cards: [item] }),
    creationGenerationsRef: { get current() { return generations; } },
    getCreativeMediaAliases: () => [], dedupeByMediaAliases: value => value,
    setCreationGenerationsByTab: fn => { generations = fn(generations); }, storeSyncFavorites: () => {},
  };
  const lifecycle = source.slice(source.indexOf('  useLayoutEffect('), source.indexOf('  const videoEditTasks'));
  const read = source.slice(source.indexOf('  const loadHistoryPage ='), source.indexOf('  // 登录后 / 切换 tab'));
  const load = new Function(...Object.keys(bindings), lifecycle + read + String.fromCharCode(10) + 'return loadHistoryPage;')(...Object.values(bindings));
  return { setup: () => setup(), load: () => load('image'), requests, locks,
    snapshot: () => ({ ...meta.current.image }), get generations() { return generations; } };
}

test('严格模式初始化重放后旧回执不抢新锁，新请求能够结束读取', async () => {
  const f = fixture(); const cleanup = f.setup();
  const old = f.load(); await tick(); cleanup(); f.setup();
  const current = f.load(); await tick(); await old;
  assert.equal(f.requests.length, 2); assert.equal(f.locks.current.size, 1);
  f.requests[0].resolve({ list: [{ id: '旧' }], has_more: false });
  f.requests[1].resolve({ list: [{ id: '新' }], has_more: false }); await current;
  assert.equal(f.snapshot().loading, false);
  assert.equal(f.snapshot().initialized, true);
  assert.equal(f.generations.image[0].cards[0].id, '新');
});

test('永不返回的请求超时释放锁，重试同一页成功且旧响应不能覆盖', async () => {
  const f = fixture(); f.setup(); await f.load();
  assert.match(f.snapshot().error, /超时/);
  assert.equal(f.snapshot().loading, false); assert.equal(f.snapshot().page, 0);
  const retry = f.load(); await tick();
  f.requests[1].resolve({ list: [{ id: '重试' }], has_more: false }); await retry;
  f.requests[0].resolve({ list: [{ id: '迟到' }], has_more: false }); await tick();
  assert.equal(f.generations.image[0].cards[0].id, '重试'); assert.equal(f.snapshot().error, '');
});

test('错误对象不能伪装成空资产，真正空列表正常完成', async () => {
  const f = fixture(); f.setup(); const pending = f.load(); await tick();
  f.requests[0].resolve({ detail: '服务不可用' }); await pending;
  assert.match(f.snapshot().error, /失败/);
  const retry = f.load(); await tick(); f.requests[1].resolve({ list: [], has_more: false }); await retry;
  assert.equal(f.snapshot().hasMore, false); assert.equal(f.snapshot().error, '');
});

test('持续点击不并发，卸载取消读取且迟到响应不写状态', async () => {
  const f = fixture(); const cleanup = f.setup(); const pending = f.load(); await tick(); await f.load();
  assert.equal(f.requests.length, 1); cleanup(); await pending;
  f.requests[0].resolve({ list: [{ id: '旧' }] }); await tick();
  assert.deepEqual(f.generations.image, []); assert.equal(f.locks.current.size, 0);
});

test('超时向底层传递取消信号', async () => {
  let signal;
  await assert.rejects(readCreationHistoryPage(value => { signal = value; return new Promise(() => {}); }, { timeoutMs: 5 }), /超时/);
  assert.equal(signal.aborted, true);
});
