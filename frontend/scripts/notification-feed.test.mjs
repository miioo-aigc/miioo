import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { notificationKey, mergeConfirmedReads } from '../src/utils/NotificationReadState.js';

async function mount(fetchPage, activeTab = 'system') {
  const states = [], effects = [], calls = [];
  const context = createContext({ AbortController, Map });
  const stub = (values) => new SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const request = async (params) => { calls.push(params); return fetchPage(params); };
  const modules = {
    react: stub({
      useState(value) { const i = states.length; states.push(value); return [value, (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
      useRef: (current) => ({ current }), useCallback: (fn) => fn,
      useEffect: (fn) => effects.push(fn),
    }),
    '../api/user': stub({ apiGetNotifications: request, apiGetUserAnnouncements: request }),
    '../utils/NotificationReadState': stub({ notificationKey, mergeConfirmedReads }),
  };
  const module = new SourceTextModule(await readFile(new URL('../src/hooks/useNotificationFeed.js', import.meta.url), 'utf8'), { context });
  await module.link((name) => modules[name]);
  await module.evaluate();
  const confirmedReads = { current: new Set() };
  const feed = module.namespace.default({ open: true, userId: 'u', activeTab, confirmedReads });
  const cleanup = effects[0]();
  return { feed, states, calls, cleanup, confirmedReads };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('公告每次请求10条，追加去重并保留已读，末页停止请求', async () => {
  const h = await mount(async ({ page }) => ({ list: page === 1 ? [{ id: 'a', kind: 'announcement', unread: true }] : [{ id: 'a', kind: 'announcement' }, { id: 'b' }], total: 11 }));
  await flush();
  h.confirmedReads.current.add('announcement:a');
  await h.feed.loadNotifications();
  await h.feed.loadNotifications();
  assert.deepEqual(h.calls.map(({ page, pageSize }) => [page, pageSize]), [[1, 10], [2, 10]]);
  assert.equal(h.states[0].length, 2);
  assert.equal(h.states[0][0].unread, false);
  h.cleanup();
});

test('创作日志下一页失败保留内容，重试同页', async () => {
  let fail = true;
  const h = await mount(async ({ page }) => {
    if (page === 2 && fail) { fail = false; throw new Error('失败'); }
    return { list: [{ id: String(page) }], hasMore: page === 1 };
  }, 'creation');
  await flush();
  await h.feed.loadNotifications();
  assert.equal(h.states[0].length, 1);
  assert.equal(h.states[2], true);
  await h.feed.loadNotifications();
  assert.deepEqual(h.calls.map(({ page }) => page), [1, 2, 2]);
  assert.equal(h.calls[0].type, 'creation_log');
  assert.equal(h.states[0].length, 2);
  h.cleanup();
});

test('在途重复触发不重复请求，卸载取消且不回写', async () => {
  let resolve;
  const h = await mount(() => new Promise((done) => { resolve = done; }));
  await h.feed.loadNotifications();
  assert.equal(h.calls.length, 1);
  h.cleanup();
  assert.equal(h.calls[0].signal.aborted, true);
  resolve({ list: [{ id: 'old' }], total: 1 });
  await flush();
  assert.equal(h.states[0].length, 0);
});
