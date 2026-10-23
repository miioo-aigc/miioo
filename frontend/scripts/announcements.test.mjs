import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

async function load(body, status = 200, filename = 'Announcements.js') {
  const calls = [];
  const invalidated = [];
  const context = createContext({ URLSearchParams, console });
  const stub = (exports) => new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
  const modules = {
    './request.js': stub({ authFetch: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(body), { status }); } }),
    './error.js': stub({ getDisplayErrorMessage: (data, fallback) => data?.detail || fallback }),
    '../utils/cache.js': stub({ invalidate: (key) => invalidated.push(key) }),
    '../utils/cacheKeys.js': stub({ K: { adminAnnouncementsPrefix: () => 'admin-announcements:', announcementPopupPrefix: () => 'announcement:latest-popup:' } }),
  };
  const source = await readFile(new URL(`../src/api/${filename}`, import.meta.url), 'utf8');
  const api = new SourceTextModule(source, { context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: 'https://example.test' }; } });
  await api.link((specifier) => modules[specifier]);
  await api.evaluate();
  return { api: api.namespace, calls, invalidated };
}

test('公告列表保留分页元数据、过滤无编号项，未读读取不缓存', async () => {
  const state = await load({ list: [{ id: '1', content: '正文', is_read: false }, {}], total: 41, page: 2, page_size: 20 });
  const result = await state.api.apiGetUserAnnouncements({ page: 2 });
  assert.equal(result.total, 41);
  assert.equal(result.page, 2);
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].unread, true);
  await state.api.apiGetUserAnnouncements({ page: 2 });
  assert.equal(state.calls.length, 2);
  assert.match(state.calls[0].url, /page=2&page_size=20/);
});
test('公告部分更新仅传显式字段并失效缓存', async () => {
  const state = await load({ id: '1' });
  await state.api.apiUpdateAdminAnnouncement('a/b', { isActive: false });
  assert.deepEqual(JSON.parse(state.calls[0].options.body), { is_active: false });
  assert.match(state.calls[0].url, /a%2Fb$/);
  assert.equal(state.invalidated.length, 2);
});
test('公告已读错误透传且不失效缓存', async () => {
  const state = await load({ detail: '公告不存在或未发布' }, 404);
  await assert.rejects(state.api.apiMarkAnnouncementRead('1'), /公告不存在或未发布/);
  assert.equal(state.invalidated.length, 0);
});
test('最新弹窗无候选正常返回空', async () => {
  const state = await load({ announcement: null });
  assert.equal(await state.api.apiGetLatestAnnouncementPopup(), null);
  assert.match(state.calls[0].url, /force=false/);
});
test('操作日志保留重复动作、秒级时间、分页和中文筛选标签', async () => {
  const state = await load({ list: [{ id: 'log-1', action_label: '生成图片' }, {}], total: 41, page: 2, page_size: 20,
    filter_options: { actions: [{ value: 'generate', label: '生成' }, {}] } }, 200, 'OperationLogs.js');
  const result = await state.api.apiGetAdminOperationLogs({ page: 2, action: ['generate', 'delete'], start: '2026-10-13 08:30:00', end: '2026-10-13 09:30:00' });
  const query = new URL(state.calls[0].url).searchParams;
  assert.deepEqual(query.getAll('action'), ['generate', 'delete']);
  assert.equal(query.get('start'), '2026-10-13 08:30:00');
  assert.equal(query.get('end'), '2026-10-13 09:30:00');
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].actionLabel, '生成图片');
  assert.equal(result.filterOptions.actions[0].label, '生成');
  assert.equal(result.filterOptions.actions.length, 1);
  assert.equal(result.total, 41);
  assert.equal(result.hasMore, true);
});
test('操作日志接口错误不伪装为空列表', async () => {
  const state = await load({ detail: '无管理员权限' }, 403, 'OperationLogs.js');
  await assert.rejects(state.api.apiGetAdminOperationLogs(), /无管理员权限/);
});
