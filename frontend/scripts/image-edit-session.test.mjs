import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function fixture({ task = { status: 'completed', resource_ids: ['图片'] }, changeAt } = {}) {
  let session = 1;
  const calls = [];
  const context = vm.createContext({ DOMException, AbortController, TextDecoder, clearTimeout,
    setTimeout: fn => { queueMicrotask(fn); return 0; } });
  const stub = exports => new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
  const request = stub({ getAuthSessionGeneration: () => session,
    authFetchStream: async () => ({ ok: false }),
    authFetch: async url => {
      calls.push(url);
      return { ok: true, json: async () => {
        if (changeAt === 'json') session++;
        return url.includes('/api/tasks/') ? task : { id: '图片', original_url: '/result.png' };
      } };
    } });
  const load = async path => new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    context, initializeImportMeta: meta => { meta.env = { VITE_API_BASE_URL: '' }; },
  });
  const guard = await load('../src/api/ImageEditSession.js');
  await guard.link(() => request);
  const tasks = await load('../src/api/ImageEditTasks.js');
  await tasks.link(name => name === './ImageEditSession' ? guard : request);
  const policy = stub({ mayShowEditPrompt: () => true, readEditMetadata: () => ({}), validateExpansion() {} });
  const api = await load('../src/api/ImageEdit.js');
  await api.link(name => ({ './request': request, './ImageEditSession': guard, './ImageEditTasks': tasks,
    '../utils/MediaEditPolicy': policy })[name]);
  await api.evaluate();
  return { calls, api: api.namespace, guard: guard.namespace, change: () => session++ };
}
test('真实会话检查拒绝退出后重新登录，不发任务请求', async () => {
  const f = await fixture();
  const checkSession = f.guard.imageEditSessionCheck(); f.change();
  await assert.rejects(f.api.apiResolveImageEdit({ task_id: '任务' }, 'inpaint', { checkSession }), { name: 'AbortError' });
  assert.equal(f.calls.length, 0);
});
test('任务响应解析期间换账号，不读取最终资产', async () => {
  const f = await fixture({ changeAt: 'json' });
  await assert.rejects(f.api.apiResolveImageEdit({ task_id: '任务' }, 'inpaint'), { name: 'AbortError' });
  assert.equal(f.calls.length, 1);
});
test('轮询等待后换账号，不再发下一次查询', async () => {
  const f = await fixture({ task: { status: 'running' } });
  let checks = 0;
  const original = f.guard.imageEditSessionCheck();
  const checkSession = () => { if (++checks === 5) f.change(); original(); };
  await assert.rejects(f.api.apiResolveImageEdit({ task_id: '任务' }, 'inpaint', { checkSession }), { name: 'AbortError' });
  assert.equal(f.calls.length, 1);
});
test('完成但缺资产不视为明确失败，可继续原任务', async () => {
  const f = await fixture({ task: { status: 'completed' } });
  await assert.rejects(f.api.apiResolveImageEdit({ task_id: '任务' }, 'inpaint'), error => !error.terminal);
});
test('后端明确失败才标记终态', async () => {
  const f = await fixture({ task: { status: 'failed' } });
  await assert.rejects(f.api.apiResolveImageEdit({ task_id: '任务' }, 'inpaint'), error => error.terminal === true);
});
