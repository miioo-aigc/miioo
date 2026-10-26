import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareScriptChat, hasActiveScriptTurn } from '../src/components/script/PrepareScriptChat.js';
const busy = { script: { active_turn_id: 'old' }, active_turn: { status: 'running' } };
test('空闲工作区只读取，不停止任务', async () => {
  let stops = 0;
  await prepareScriptChat({ readWorkspace: async () => ({}), interrupt: async () => stops++, isCurrent: () => true });
  assert.equal(stops, 0);
});
test('旧任务停止并补读确认后才允许继续', async () => {
  const calls = []; let reads = 0;
  await prepareScriptChat({ readWorkspace: async () => { calls.push('read'); return reads++ ? {} : busy; }, interrupt: async () => calls.push('stop'), isCurrent: () => true });
  assert.deepEqual(calls, ['read', 'stop', 'read']);
});
test('停止失败阻止发送', async () => {
  await assert.rejects(prepareScriptChat({ readWorkspace: async () => busy, interrupt: async () => { throw new Error('停止失败'); }, isCurrent: () => true }), /停止失败/);
});
test('停止响应成功但任务仍活跃时阻止发送', async () => {
  await assert.rejects(prepareScriptChat({ readWorkspace: async () => busy, interrupt: async () => ({}), isCurrent: () => true }), /尚未停止/);
});
test('读取失败时不尝试停止或发送', async () => {
  let stops = 0;
  await assert.rejects(prepareScriptChat({ readWorkspace: async () => { throw new Error('断网'); }, interrupt: async () => stops++, isCurrent: () => true }), /断网/);
  assert.equal(stops, 0);
});
test('等待期间取消或切换项目后不再停止任务', async () => {
  let active = true, stops = 0;
  await assert.rejects(prepareScriptChat({ readWorkspace: async () => { active = false; return busy; }, interrupt: async () => stops++, isCurrent: () => active }), { name: 'AbortError' });
  assert.equal(stops, 0);
});
test('终态摘要不误判为运行中，兼容仅有任务编号', () => {
  assert.equal(hasActiveScriptTurn({ active_turn: { status: 'interrupted' } }), false);
  assert.equal(hasActiveScriptTurn({ script: { active_turn_id: 'old' } }), true);
});

const { readFileSync } = await import('node:fs');
const source = readFileSync(new URL('../src/pages/ScriptPage.jsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('  const handleSend ='), source.indexOf('  const handleRequestModifyScript ='));
for (const stopped of [{ status: 'interrupted' }, null]) test('本地生成中替换请求：' + (stopped ? '成功后发送' : '停止失败不发送'), async () => {
  const calls = [], oldScope = {}, refs = { pending: Promise.resolve(false), interrupt: null };
  const values = { replacingChatRef: { current: false }, reopenScopeRef: { current: oldScope }, getAuthSessionGeneration: () => 0,
    chatSendPromiseRef: { current: refs.pending }, chatInterruptPromiseRef: { current: null },
    handleStop: () => { calls.push('stop'); values.chatInterruptPromiseRef.current = Promise.resolve(stopped); },
    performSend: async text => { calls.push(text); return true; } };
  const send = new Function(...Object.keys(values), handler + ';return handleSend;')(...Object.values(values));
  assert.equal(await send('新要求'), Boolean(stopped));
  assert.deepEqual(calls, stopped ? ['stop', '新要求'] : ['stop']);
});
