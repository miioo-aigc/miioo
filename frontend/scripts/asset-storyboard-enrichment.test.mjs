import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/api/assets.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('async function enrichWithStoryboards('), source.indexOf('// 导出 groupByCategory'));
const asset = { id: 'asset', category: 'storyboard', asset_type: 'image', file_url: '/final.png', is_primary: false };
const candidate = { asset_id: 'asset', url: '/final.png', is_finalized: true };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture({ count = 1, page, candidates } = {}) {
  let auth = 0, current = true, pages = 0, calls = 0, active = 0, peak = 0;
  const bindings = {
    getAuthSessionGeneration: () => auth,
    normalizeImageUrl: value => typeof value === 'string' ? value : '',
    apiGetStoryboards: async (_id, options) => {
      pages++;
      return page ? page(options) : Array.from({ length: Math.max(0, Math.min(options.limit, count - options.offset)) }, (_, i) => ({ id: String(options.offset + i) }));
    },
    apiListStoryboardMediaCandidates: async (_id, id) => {
      calls++; active++; peak = Math.max(peak, active);
      try { return await (candidates ? candidates(id) : Promise.resolve([candidate])); } finally { active--; }
    },
  };
  const enrich = new Function(...Object.keys(bindings), body + '; return enrichWithStoryboards;')(...Object.values(bindings));
  return { run: (items = [asset], needed = true, options = { isCurrent: () => current }) => enrich('project', items, needed, options),
    stop: () => { current = false; }, switchAccount: () => { auth++; }, stats: () => ({ pages, calls, active, peak }) };
}
test('空输入和非分镜不发补全请求', async () => {
  const f = fixture({ count: 10000 });
  assert.deepEqual(await f.run([]), []);
  assert.deepEqual(await f.run([asset], false), [asset]);
  assert.deepEqual(f.stats(), { pages: 0, calls: 0, active: 0, peak: 0 });
});
test('万级非空输入保留完整读取但候选峰值不超过四个', async () => {
  const f = fixture({ count: 10000 });
  assert.equal((await f.run())[0].is_primary, true);
  assert.deepEqual(f.stats(), { pages: 1001, calls: 10000, active: 0, peak: 4 });
});
test('分镜请求失败向上抛错，不请求候选，重试可成功', async () => {
  let fail = true;
  const error = new Error('断网');
  const f = fixture({ page: () => { if (fail) throw error; return [{ id: 'shot' }]; } });
  await assert.rejects(f.run(), value => value === error);
  assert.equal(f.stats().calls, 0);
  fail = false;
  assert.equal((await f.run())[0].is_primary, true);
});
test('候选失败停止后续调度，等待已发请求收尾，不返回部分定稿', async () => {
  const requests = Array.from({ length: 4 }, deferred);
  const error = new Error('候选断网');
  const f = fixture({ count: 20, candidates: id => requests[Number(id)].promise });
  const pending = f.run();
  const rejected = assert.rejects(pending, value => value === error);
  await tick();
  assert.equal(f.stats().calls, 4);
  requests[0].reject(error); await tick();
  requests.slice(1).forEach(request => request.resolve([candidate]));
  await rejected;
  assert.equal(f.stats().calls, 4);
  assert.equal(f.stats().active, 0);
});
for (const action of ['stop', 'switchAccount']) {
  test('分镜读取中失效不翻页或读取候选：' + action, async () => {
    const request = deferred();
    const f = fixture({ page: () => request.promise });
    const pending = f.run();
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    f[action]();
    request.resolve(Array.from({ length: 10 }, (_, id) => ({ id })));
    await rejected;
    assert.equal(f.stats().pages, 1);
    assert.equal(f.stats().calls, 0);
  });
  test('候选读取中失效停止下一批：' + action, async () => {
    const request = deferred();
    const f = fixture({ count: 20, candidates: () => request.promise });
    const pending = f.run();
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await tick(); f[action](); request.resolve([candidate]);
    await rejected;
    assert.equal(f.stats().calls, 4);
  });
}
test('未传调用方检查时仍保护认证会话', async () => {
  const request = deferred();
  const f = fixture({ page: () => request.promise });
  const pending = f.run([asset], true, {});
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  f.switchAccount(); request.resolve([]); await rejected;
});
test('已失效调用不发请求', async () => {
  const f = fixture(); f.stop();
  await assert.rejects(f.run(), { name: 'AbortError' });
  assert.equal(f.stats().pages, 0);
});
for (const kind of ['page', 'candidates']) {
  test('异常响应不当成功空数据：' + kind, async () => {
    const f = fixture({ [kind]: () => null });
    await assert.rejects(f.run(), /响应格式异常/);
  });
}
test('保留原始主标记、主表匹配、候选匹配和其他分类，且不修改输入', async () => {
  const f = fixture({ page: () => [{ id: 'shot', image_url: '/legacy.png', ratio: '16:9' }], candidates: () => [candidate, { asset_id: 'video', url: '/video.mp4', media_type: 'video', isFinalized: true, ratio: '9:16' }] });
  const items = [asset, { ...asset, id: 'legacy', file_url: '/legacy.png' }, { ...asset, id: 'primary', file_url: '/other.png', is_primary: true }, { ...asset, id: 'none', file_url: '/none.png' }, { ...asset, id: 'video', asset_type: 'video', file_url: '/video.mp4' }, { ...asset, id: 'character', category: 'character' }];
  const before = structuredClone(items);
  const result = await f.run(items);
  assert.deepEqual(result.map(item => item.is_primary), [true, true, true, false, true, false]);
  assert.equal(result[1].ratio, '16:9');
  assert.equal(result[4].ratio, '9:16');
  assert.deepEqual(items, before);
});
test('成功空分镜保留原始资产主标记', async () => {
  const f = fixture({ count: 0 });
  assert.equal((await f.run([{ ...asset, is_primary: true }]))[0].is_primary, true);
  assert.equal(f.stats().calls, 0);
});
