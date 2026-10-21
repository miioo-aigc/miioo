import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCreationHistoryVisit, creationHistoryPrefix } from '../src/utils/CreationHistoryScope.js';

const source = readFileSync(new URL('../src/pages/CreationPage.jsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/stores/creationStore.js', import.meta.url), 'utf8');
function createStore() {
  let state;
  const create = init => {
    state = init(update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; });
    return { getState: () => state };
  };
  return new Function('create', 'dedupeByMediaAliases', 'getCreationAssetMediaAliases',
    storeSource.replace(/^import .*;\n/gm, '').replace('export const', 'const') + '\nreturn useCreationStore;')(
    create, items => items, () => [],
  );
}
function fixture(api) {
  const store = createStore();
  store.getState().setAccount('甲');
  let session = 1;
  const visit = createCreationHistoryVisit('甲', session, () => store.getState().ownerId, () => session);
  const requests = {};
  const cache = new Map();
  const start = source.indexOf('  const loadHistoryPage = useCallback(');
  const end = source.indexOf('  // 登录后 / 切换 tab', start);
  const load = new Function('useCallback', 'visitRef', 'historyRequestsRef', 'isLoggedIn', 'ownerId',
    'useCreationStore', 'updateHistoryMeta', 'creationHistoryPrefix', 'peekCacheEntry', 'getCreationHistoryList',
    'apiListCreationImages', 'apiListCreationVideos', 'apiListCreationAudios', 'buildCreationHistoryCachePayload',
    'setCache', 'syncHistoryFavorites', 'dedupeCreationHistoryList', 'normalizeCreationHistoryItem',
    'setHistoryPage1', 'mergeHistoryGenerations', 'console',
    source.slice(start, end) + '\nreturn loadHistoryPage;')(
    fn => fn, { current: visit }, { current: requests }, true, '甲', store,
    (...args) => store.getState().updateHistoryMeta(...args), creationHistoryPrefix, key => cache.get(key),
    response => response.items, api, api, api, (_tab, response) => response,
    (key, data) => cache.set(key, { d: data }), () => {}, items => items, item => item,
    (...args) => store.getState().setHistoryPage1(...args),
    (...args) => store.getState().mergeHistoryGenerations(...args), { error() {} },
  );
  return { store, visit, cache, requests, load, changeSession: () => session++ };
}
const row = id => ({ id, cards: [{ id, status: 'done' }] });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('账号键不认领旧键，不同账号及特殊字符不碰撞', () => {
  assert.notEqual(creationHistoryPrefix('甲', 'image'), creationHistoryPrefix('乙', 'image'));
  assert.notEqual(creationHistoryPrefix('a:b', 'image'), creationHistoryPrefix('a%3Ab', 'image'));
  assert.throws(() => creationHistoryPrefix(null, 'image'));
});
test('换账号清除结果、收藏、等待及分页，同账号不重置', () => {
  const store = createStore();
  store.getState().setAccount('甲');
  store.getState().addGeneration('image', row('甲的图片'));
  store.getState().toggleFavorite('甲的收藏');
  store.getState().updateHistoryMeta('video', { page: 8, loading: true, error: '旧错误' });
  store.getState().setAccount('甲');
  assert.equal(store.getState().generationsByTab.image.length, 1);
  store.getState().setAccount('乙');
  assert.deepEqual(store.getState().generationsByTab, { image: [], video: [], dubbing: [], music: [] });
  assert.equal(store.getState().favorites.size, 0);
  assert.equal(store.getState().pendingFavoriteToggles.size, 0);
  assert.deepEqual(store.getState().historyMeta.video, { page: 0, loading: false, initialized: false, hasMore: true });
  store.getState().setAccount(null);
  assert.equal(store.getState().ownerId, null);
});
for (const tab of ['image', 'video', 'dubbing']) {
  test(tab + ' 真实分页入口：换账号后迟到首页不写缓存和列表', async () => {
    const pending = deferred();
    const f = fixture(() => pending.promise);
    const running = f.load(tab);
    f.store.getState().setAccount('乙');
    pending.resolve({ items: [row('甲的记录')], has_more: true });
    await running;
    assert.equal(f.cache.size, 0);
    assert.deepEqual(f.store.getState().generationsByTab[tab], []);
    assert.equal(f.store.getState().historyMeta[tab].page, 0);
  });
}
test('退出再回原账号，旧访问仍不可写', async () => {
  const pending = deferred();
  const f = fixture(() => pending.promise);
  const running = f.load('image');
  f.visit.stop();
  f.store.getState().setAccount(null);
  f.store.getState().setAccount('甲');
  pending.resolve({ items: [row('过期结果')] });
  await running;
  assert.equal(f.cache.size, 0);
});
test('认证会话变化但账号未变，也禁止旧响应回写', async () => {
  const pending = deferred();
  const f = fixture(() => pending.promise);
  const running = f.load('image');
  f.changeSession();
  pending.resolve({ items: [row('旧会话')] });
  await running;
  assert.equal(f.cache.size, 0);
});
test('旧账号迟到错误不污染新账号分页状态', async () => {
  const pending = deferred();
  const f = fixture(() => pending.promise);
  const running = f.load('image');
  f.store.getState().setAccount('乙');
  pending.reject(new Error('断网'));
  await running;
  assert.equal(f.store.getState().historyMeta.image.error, undefined);
});
test('当前账号失败保留页码，重试仍请求原分页', async () => {
  const pages = [];
  let fail = true;
  const f = fixture(async params => { pages.push(params.page); if (fail) throw new Error('断网'); return { items: [row('有效')] }; });
  await f.load('image');
  assert.equal(f.store.getState().historyMeta.image.page, 0);
  assert.ok(f.store.getState().historyMeta.image.error);
  fail = false;
  await f.load('image');
  assert.deepEqual(pages, [1, 1]);
  assert.equal(f.store.getState().historyMeta.image.page, 1);
  assert.ok(f.cache.has(creationHistoryPrefix('甲', 'image') + 'page1'));
});
test('清空或删除期间作废分页，迟到结果不能复活旧卡', async () => {
  const pending = deferred();
  const f = fixture(() => pending.promise);
  const running = f.load('image');
  f.requests.image = null;
  f.store.getState().clearHistoryTab('image');
  pending.resolve({ items: [row('已清空')] });
  await running;
  assert.deepEqual(f.store.getState().generationsByTab.image, []);
  assert.equal(f.cache.size, 0);
});
test('同一分页并发触发只发一次请求', async () => {
  const pending = deferred();
  let count = 0;
  const f = fixture(() => { count++; return pending.promise; });
  const running = f.load('image');
  await f.load('image');
  assert.equal(count, 1);
  pending.resolve({ items: [] });
  await running;
  assert.equal(f.store.getState().historyMeta.image.hasMore, false);
});
