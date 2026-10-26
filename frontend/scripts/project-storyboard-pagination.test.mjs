import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/assets/AssetsProjectPanel.jsx', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('  const loadStoryboardPageCards ='), source.indexOf('\n  useEffect(() => {\n    apiGetProjects()'));
function fixture(total, media = async (_project, id) => [{ id, url: 'image', media_type: 'image' }]) {
  const pageMeta = {}, generation = { current: 0 }, requests = [];
  let assets = {};
  const complete = (key, value) => { pageMeta[key] = { ...value, loading: false }; };
  const bindings = {
    useCallback: fn => fn, listGeneration: generation, morePending: { current: null }, visiblePageKey: { current: null },
    pageMeta, setAssetsMap: fn => { assets = typeof fn === 'function' ? fn(assets) : fn; }, setAssetsOwnerKey() {},
    getAssetPageKey: (id, category) => id + category, invalidate() {}, K: { projectAssets: id => id },
    startPage: key => { pageMeta[key] = { ...pageMeta[key], loading: true }; },
    markPageLoading: key => { pageMeta[key].loading = true; },
    completeFirstPage: complete, completeMorePage: complete,
    failFirstPage: key => { pageMeta[key] = { ...pageMeta[key], loading: false, error: true }; },
    failMorePage: key => { pageMeta[key] = { ...pageMeta[key], loading: false, error: true, failedPhase: 'more' }; },
    applySubjectMeta() {}, normalizeStoryboard: shot => shot,
    apiGetEpisodes: async () => [], apiListStoryboardMediaCandidates: media,
    apiGetStoryboards: async (_id, options) => {
      requests.push(options);
      return Array.from({ length: Math.max(0, Math.min(options.limit, total - options.offset)) }, (_, i) => ({ id: options.offset + i }));
    }, console: { error() {} },
  };
  const actions = new Function(...Object.keys(bindings), body + '\nreturn { loadFirstPage, loadMorePage };')(...Object.values(bindings));
  return { first: () => actions.loadFirstPage('p', 'storyboard'), more: () => actions.loadMorePage('p', 'storyboard'),
    stop: () => generation.current++, requests, state: () => ({ cards: assets.storyboard || [], meta: pageMeta.pstoryboard }) };
}
test('超过200条可加载后续页且结束', async () => {
  const f = fixture(401); await f.first(); await f.more(); await f.more(); await f.more();
  assert.equal(f.state().cards.length, 401);
  assert.deepEqual(f.requests.map(r => r.offset), [0, 200, 400]);
  assert.equal(f.state().meta.hasMore, false);
});
test('满页需探测下一页，不能提前结束', async () => {
  const f = fixture(200); await f.first(); assert.equal(f.state().meta.hasMore, true);
  await f.more(); assert.equal(f.state().meta.hasMore, false);
});
test('没有媒体的页仍按原始分镜数前进', async () => {
  const f = fixture(201, async (_p, id) => id < 200 ? [] : [{ id, url: 'image' }]);
  await f.first(); assert.equal(f.state().cards.length, 0); assert.equal(f.state().meta.hasMore, true);
  await f.more(); assert.equal(f.state().cards[0].id, 200);
});
test('候选失败保留原页及偏移，重试不漏页', async () => {
  let fail = true;
  const f = fixture(201, async (_p, id) => { if (id === 200 && fail) throw new Error('网络'); return [{ id, url: 'image' }]; });
  await f.first(); await f.more();
  assert.equal(f.state().cards.length, 200); assert.equal(f.state().meta.cursor, 200);
  assert.equal(f.state().meta.failedPhase, 'more');
  fail = false; await f.more(); assert.equal(f.state().cards.length, 201);
});
test('并发最多4，切换访问后不继续派发或写回', async () => {
  const pending = [];
  const f = fixture(201, (_p, id) => new Promise(resolve => pending.push(() => resolve([{ id, url: 'image' }]))));
  const read = f.first(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(pending.length, 4); f.stop(); pending.forEach(resolve => resolve()); await read;
  assert.equal(pending.length, 4); assert.equal(f.state().cards.length, 0);
});
