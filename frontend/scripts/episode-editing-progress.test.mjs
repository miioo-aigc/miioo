import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { episodeDisplayStatus, isEpisodeEditingUnlocked, resolveEpisodeSteps } from '../src/utils/EpisodeEditingProgress.js';
import { buildEpisodeStatusMap } from '../src/utils/episodeStatusAdapter.js';

test('仅第一集进入剪辑：跨设备重建得到相同状态，其他分集不解锁', () => {
  const episodes = [{ id: 'a', status: 'editing' }, { id: 'b', status: 'storyboarded' }, { id: 'c', status: 'scripted' }];
  assert.deepEqual(buildEpisodeStatusMap(null, episodes), { 0: 'generated', 1: 'storyboarded', 2: 'pending' });
  assert.deepEqual(episodes.filter(isEpisodeEditingUnlocked).map(e => e.id), ['a']);
  assert.equal(resolveEpisodeSteps([], episodes).has('edit'), true);
});
test('旧浏览器 edit 解锁与生成视频不能使任何分集进入剪辑', () => {
  const episodes = [{ status: 'storyboarded' }, { status: 'generated' }, { status: 'videos_ready' }];
  assert.equal(resolveEpisodeSteps(['edit'], episodes).has('edit'), false);
  assert.deepEqual(episodes.map(episodeDisplayStatus), ['storyboarded', 'storyboarded', 'storyboarded']);
});
test('概览顺序不同或状态过期，不覆盖分集列表的权威进度', () => {
  const episodes = [{ id: 'a', status: 'editing' }, { id: 'b', status: 'storyboarded' }];
  const overview = { episode_progress: [{ episode_id: 'b', status: 'editing' }, { episode_id: 'a', status: 'storyboarded' }] };
  assert.deepEqual(buildEpisodeStatusMap(overview, episodes), { 0: 'generated', 1: 'storyboarded' });
});
test('完成状态保持完成且可进入剪辑，缺少状态不能借数量解锁剪辑', () => {
  assert.equal(episodeDisplayStatus({ status: 'edited' }), 'edited');
  assert.equal(isEpisodeEditingUnlocked({ status: 'edited' }), true);
  assert.equal(isEpisodeEditingUnlocked({ storyboard_count: 10 }), false);
});
const apiSource = readFileSync(new URL('../src/api/EpisodeEditing.js', import.meta.url), 'utf8');
function loadApi(response) {
  const body = apiSource.slice(apiSource.indexOf('export async function')).replace('export ', '').replaceAll('import.meta.env.VITE_API_BASE_URL', '""');
  const invalidations = [];
  const factory = new Function('authFetch', 'throwResponseError', 'invalidate', 'K', 'isEpisodeEditingUnlocked', body + '; return apiStartEpisodeEditing;');
  const calls = [];
  const start = factory(async (url, options) => { calls.push({ url, options }); return response; }, async () => { throw Error('保存失败'); }, key => invalidations.push(key), { episodes: id => 'episodes:' + id, projectOverview: id => 'overview:' + id }, isEpisodeEditingUnlocked);
  return { start, calls, invalidations };
}
test('写入确认后失效缓存；请求包含准确项目与分集', async () => {
  const episode = { id: 'e', project_id: 'p', status: 'editing' };
  const api = loadApi({ ok: true, json: async () => episode });
  assert.deepEqual(await api.start('p', 'e'), episode);
  assert.equal(api.calls[0].url, '/api/projects/p/episodes/e/start-edit');
  assert.equal(api.calls[0].options.method, 'POST');
  assert.deepEqual(api.invalidations, ['episodes:p', 'overview:p']);
});
test('后端未部署、返回未推进或其他分集时拒绝解锁', async () => {
  for (const response of [
    { ok: false },
    { ok: true, json: async () => ({ id: 'e', project_id: 'p', status: 'storyboarded' }) },
    { ok: true, json: async () => ({ id: 'other', project_id: 'p', status: 'editing' }) },
  ]) {
    const api = loadApi(response);
    await assert.rejects(api.start('p', 'e'));
    assert.deepEqual(api.invalidations, []);
  }
});
const homeSource = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
function enterHarness() {
  const from = homeSource.indexOf('  const handleStartEpisodeEdit = async');
  const to = homeSource.indexOf('  // 加载更多主体', from);
  const body = homeSource.slice(from, to) + '; return handleStartEpisodeEdit;';
  const events = [];
  const owner = { current: { id: 'p' } }, version = { current: 1 }, pending = { current: new Set() };
  let finish;
  const response = new Promise(resolve => { finish = resolve; });
  const args = { activeProject: { id: 'p' }, getAuthSessionGeneration: () => 1, projectDetailVersion: version,
    projectDetailOwner: owner, episodeEditPending: pending,
    apiStartEpisodeEditing: async () => { events.push('save'); return response; },
    setScriptEpisodes: update => { events.push(update([{ id: 'e', status: 'storyboarded' }, { id: 'other', status: 'storyboarded' }])); },
    prepareOnlineEditing: async () => { events.push('draft'); return { draft: null, skipped: 0 }; },
    window: { history: { pushState: (...args) => events.push(args[2]) } }, URLSearchParams,
    setEditEntry: () => events.push('entry'), setActiveStep: () => events.push('navigate'), showToast: () => {},
  };
  const enter = new Function(...Object.keys(args), body)(...Object.values(args));
  return { enter, finish, events, owner, pending };
}
test('进入剪辑等待保存，同集重复点击只提交一次，只回写该集', async () => {
  const h = enterHarness();
  const running = h.enter('e');
  await h.enter('e');
  assert.deepEqual(h.events, ['save']);
  h.finish({ id: 'e', project_id: 'p', status: 'editing' });
  await running;
  assert.deepEqual(h.events[1].map(e => e.status), ['editing', 'storyboarded']);
  assert.equal(h.events[2], 'draft');
  assert.equal(h.events.at(-1), 'navigate');
  assert.equal(h.pending.current.size, 0);
});
test('保存期间切换项目，旧响应不回写、不创建草稿、不导航', async () => {
  const h = enterHarness();
  const running = h.enter('e');
  h.owner.current = { id: 'another' };
  h.finish({ id: 'e', project_id: 'p', status: 'editing' });
  await running;
  assert.deepEqual(h.events, ['save']);
  assert.equal(h.pending.current.size, 0);
});
