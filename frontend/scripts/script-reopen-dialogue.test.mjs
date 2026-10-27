import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const page = readFileSync(new URL('../src/pages/ScriptPage.jsx', import.meta.url), 'utf8');
const handler = page.slice(page.indexOf('  const handleBackToConversation ='), page.indexOf('  const handleBackToScriptOutline ='));
function fixture(outlineIsSnapshot = false) {
  const calls = [], state = {}, scope = { pending: false }, scopeRef = { current: scope };
  let session = 0;
  const values = { outlineIsSnapshot, setOutlineIsSnapshot: x => { state.snapshot = x; }, normalizeScriptStructure: x => x, projectId: 'p', episodeActionLoading: false, reopenScopeRef: scopeRef,
    workspaceReadVersionRef: { current: 0 }, getAuthSessionGeneration: () => session,
    useCallback: fn => fn, crypto: { randomUUID: () => 'request-id' },
    apiGetScriptWorkspace: (...args) => new Promise((resolve, reject) => calls.push({ kind: 'read', args, resolve, reject })),
    apiReopenScriptDialogue: (...args) => new Promise((resolve, reject) => calls.push({ kind: 'reopen', args, resolve, reject })),
    normalizeScriptMessages: x => x, clearStoredScriptOperation: () => { state.cleared = true; },
    showGlobalToast: message => { state.error = message; } };
  for (const name of ['ReopeningDialogue', 'Messages', 'ScriptContent', 'HasStarted', 'Phase', 'ScriptOutlineData', 'ScriptOutlineTaskId', 'ScriptOutlineError', 'WorkspaceError', 'ScriptOutlineMode']) values['set' + name] = value => { state[name] = value; };
  const run = new Function(...Object.keys(values), handler + '; return handleBackToConversation;')(...Object.values(values));
  return { run, calls, state, leave: () => { scopeRef.current = null; }, switchAccount: () => session++ };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const workspace = { script: { content: '新稿', workflow_stage: 'dialogue' }, messages: [{ content: '历史消息' }] };
test('等待服务端解锁后才返回，携带新鲜版本，重复点击只请求一次', async () => {
  const f = fixture(), task = f.run(); await f.run();
  assert.equal(f.calls.length, 1); assert.equal(f.state.ScriptOutlineMode, undefined);
  f.calls[0].resolve({ script: { draft_revision: 7 } }); await tick();
  assert.equal(f.calls[1].args[1].expected_draft_revision, 7);
  assert.equal(f.state.ScriptOutlineMode, undefined);
  f.calls[1].resolve(workspace); await task;
  assert.equal(f.state.ScriptOutlineMode, false); assert.equal(f.state.ScriptContent, '新稿');
  assert.equal(f.state.ScriptOutlineData, undefined); assert.equal(f.state.snapshot, true); assert.equal(f.state.HasStarted, true);
});
test('解锁失败保留编排页和内容，解除忙碌状态', async () => {
  const f = fixture(), task = f.run(); f.calls[0].resolve({ script: {} }); await tick();
  f.calls[1].reject(new Error('阶段冲突')); await task;
  assert.equal(f.state.ScriptOutlineMode, undefined); assert.equal(f.state.ScriptContent, undefined);
  assert.equal(f.state.error, '阶段冲突'); assert.equal(f.state.ReopeningDialogue, false);
});
for (const action of ['leave', 'switchAccount']) test(action + '后忽略旧请求结果', async () => {
  const f = fixture(), task = f.run(); f.calls[0].resolve({ script: {} }); await tick();
  f[action](); f.calls[1].resolve(workspace); await task;
  assert.equal(f.state.ScriptContent, undefined); assert.equal(f.state.ScriptOutlineMode, undefined);
});
const api = readFileSync(new URL('../src/api/subject.js', import.meta.url), 'utf8');
test('返回时保留服务端旧结构快照', async () => {
  const f = fixture(), task = f.run();
  f.calls[0].resolve({ script: { draft_revision: 7 }, structure: { episodes: [{ id: 'old' }] } }); await tick();
  f.calls[1].resolve(workspace); await task;
  assert.equal(f.state.ScriptOutlineData.episodes[0].id, 'old');
  assert.equal(f.state.snapshot, true);
});
test('查看旧解构后返回仅切换视图，不覆盖对话', async () => {
  const f = fixture(true); await f.run();
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.ScriptOutlineMode, false);
  assert.equal(f.state.ScriptContent, undefined);
});
const apiBody = api.slice(api.indexOf('export async function apiReopenScriptDialogue'), api.indexOf('export async function apiConfirmScriptWorkspace')).replace('export ', '');
test('接口拒绝错误项目和未解锁的成功响应', async () => {
  for (const script of [{ project_id: 'other', workflow_stage: 'dialogue' }, { project_id: 'p', workflow_stage: 'structured' }]) {
    const run = new Function('authFetch', 'invalidate', 'K', 'readScriptWorkspaceResponse', 'BASE', apiBody + ';return apiReopenScriptDialogue;')(
      async () => ({}), () => {}, { script: x => x, projectOverview: x => x }, async () => ({ script }), '');
    await assert.rejects(run('p'), /尚未确认恢复对话/);
  }
});
