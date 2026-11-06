import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../src/api/creation.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/export /g, '')
  .replaceAll('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://test.invalid'));

function loadApi(authFetch) {
  return runInNewContext(source + ';({apiHideCreationHistory, apiListCreationVideos})', {
    authFetch, URLSearchParams,
    throwResponseError: async () => { throw new Error('请求失败'); },
  });
}

test('清空覆盖整个视频分区，仅请求隐藏接口；创作历史过滤、资产库仍可读取', async () => {
  let hidden = false;
  const assets = [{ id: 'video-a' }, { id: 'video-b' }];
  const calls = [];
  const api = loadApi(async (url, options = {}) => {
    calls.push({ url, options });
    const parsed = new URL(url);
    if (parsed.pathname === '/api/creation/history/hide') {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { tab: 'video' });
      hidden = true;
      return Response.json({ success: true, hidden_count: 2, hiddenCount: 2, tab: 'video' });
    }
    assert.equal(parsed.pathname, '/api/creation/videos');
    return Response.json({ items: hidden && parsed.searchParams.get('exclude_hidden') === 'true' ? [] : assets });
  });
  await api.apiHideCreationHistory('video');
  assert.deepEqual((await api.apiListCreationVideos({ page: 1, exclude_hidden: true })).items, []);
  assert.deepEqual((await api.apiListCreationVideos({ page: 2, exclude_hidden: true })).items, []);
  assert.equal((await api.apiListCreationVideos({ page: 1 })).items.length, 2);
  assert.equal(calls.filter(({ options }) => options.method === 'DELETE').length, 0);
});

test('后端失败或未明确确认成功时拒绝清空', async () => {
  for (const response of [Response.json({ success: false }), Response.json({}), Response.json({ success: true }, { status: 500 })]) {
    const api = loadApi(async () => response);
    await assert.rejects(api.apiHideCreationHistory('video'));
  }
});

test('页面首屏和后续分页均过滤隐藏记录，成功后使旧请求与缓存失效', () => {
  const page = readFileSync(new URL('../src/pages/CreationPage.jsx', import.meta.url), 'utf8');
  assert.equal((page.match(/requestParams.exclude_hidden = true/g) || []).length, 2);
  assert.doesNotMatch(page, /if \(tab !== 'video'\) requestParams.exclude_hidden/);
  const start = page.indexOf('async function handleClearHistory');
  const handler = page.slice(start, page.indexOf('generateCreation: handleGenerate', start));
  assert.match(handler, /await apiHideCreationHistory\(activeTab\)/);
  assert.match(handler, /if \(!visit.isCurrent\(\)\) return/);
  assert.match(handler, /invalidateHistory\(activeTab\)/);
  assert.match(page, /historyRequestsRef.current\[tab\] = null/);
});
