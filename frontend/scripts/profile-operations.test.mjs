import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('绑定成功实际父回调只发布绑定字段，重开使用已同步资料', () => {
  const start = source.indexOf('  const handleBindSuccess = useCallback');
  const body = source.slice(start, source.indexOf('  const handleUnbindWechat', start));
  let parent = { nickname: '未保存草稿以外的正式昵称', wechat_bound: false }, local;
  const fn = new Function('useCallback', 'profileUpdatedRef', 'setBoundWechat', 'setWechatView', body + '\nreturn handleBindSuccess;')(
    fn => fn, { current: patch => { parent = { ...parent, ...patch }; } }, value => { local = value; }, () => {}
  );
  fn({ id: 'u', nickname: '迟到快照', wechat: '微信标识', wechat_nickname: '微信昵称', wechat_bound: true });
  assert.equal(parent.wechat_bound, true); assert.equal(parent.nickname, '未保存草稿以外的正式昵称'); assert.equal(local, '微信昵称');
  assert.equal(parent.wechat_bound ? parent.wechat : null, '微信标识');
});


function qrHarness(readUser = async () => ({ id: 'user', wechat_bound: true })) {
  const requests = [], polls = [], states = [], cleanups = [];
  let generation = 1;
  const start = source.indexOf('function WechatBindView(');
  const body = source.slice(start, source.indexOf('  const isExpiredOrError', start));
  const factory = new Function('useState', 'useRef', 'useCallback', 'useEffect', 'getAuthSessionGeneration', 'apiGetWechatQrCode', 'apiPollWechatBind', 'createSerialPolling', 'apiGetCurrentUser', body + 'return { loadQrCode, invalidate }; } return WechatBindView;');
  let bound = 0, pollCalls = 0;
  const view = factory(v => [v, next => states.push(next)], v => ({ current: v }), fn => fn, fn => cleanups.push(fn()), () => generation,
    () => { const d = deferred(); requests.push(d); return d.promise; },
    async () => { pollCalls++; return { status: 'confirmed' }; },
    options => { const poll = { options, started: false, start() { this.started = true; }, stop() {} }; polls.push(poll); return poll; }, readUser
  )({ onBindSuccess: () => bound++ });
  return { ...view, requests, polls, states, cleanup: () => cleanups.forEach(fn => fn()), switchAccount: () => generation++, bound: () => bound, pollCalls: () => pollCalls };
}
const qr = { ticket: 'local-ticket', qrCodeValue: 'local-qr' };
test('绑定确认后读取权威资料，读取失败不发布成功', async () => {
  let fails = true;
  const h = qrHarness(async () => { if (fails) throw new Error('读取失败'); return { id: 'user', wechat_bound: true }; });
  h.requests[0].resolve(qr); await Promise.resolve(); await Promise.resolve();
  await assert.rejects(h.polls[0].options.task()); assert.equal(h.bound(), 0);
  fails = false;
  const result = await h.polls[0].options.task();
  assert.equal(result.user.wechat_bound, true);
  h.polls[0].options.onResult(result); assert.equal(h.bound(), 1);
});
test('二维码卸载后迟到响应不启动轮询', async () => {
  const h = qrHarness(); h.cleanup(); h.requests[0].resolve(qr);
  await Promise.resolve(); await Promise.resolve(); assert.equal(h.polls.length, 0);
});
test('二维码乱序响应仅保留最新轮询，旧回执失效', async () => {
  const h = qrHarness(); const latest = h.loadQrCode();
  h.requests[1].resolve(qr); await latest;
  h.requests[0].resolve(qr); await Promise.resolve();
  assert.equal(h.polls.length, 1);
  h.invalidate(); h.polls[0].options.onResult({ status: 'confirmed' });
  assert.equal(h.bound(), 0);
});
test('微信轮询切换账号后既不写回也不发下一轮请求', async () => {
  const h = qrHarness(); h.requests[0].resolve(qr); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.polls.length, 1); h.switchAccount();
  h.polls[0].options.onResult({ status: 'confirmed' });
  await h.polls[0].options.task();
  assert.equal(h.bound(), 0); assert.equal(h.pollCalls(), 0);
});


const hookSource = readFileSync(new URL('../src/hooks/useProfileOperation.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace('export function', 'function');
const source = readFileSync(new URL('../src/components/ProfileModal.jsx', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  const slots = [], effects = [], toasts = [];
  let index = 0, generation = 1;
  const useRef = value => { const i = index++; return slots[i] ??= { current: value }; };
  const useState = value => { const i = index++; slots[i] ??= value; return [slots[i], v => { slots[i] = v; }]; };
  const useCallback = fn => fn;
  const useEffect = (fn, deps) => { const i = index++; const old = effects[i]; if (!old || old.deps[0] !== deps[0]) { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; } };
  const getAuthSessionGeneration = () => generation;
  const showGlobalToast = (...args) => toasts.push(args);
  const hook = new Function('useRef', 'useState', 'useCallback', 'useEffect', 'getAuthSessionGeneration', 'showGlobalToast', hookSource + '\nreturn useProfileOperation;')(useRef, useState, useCallback, useEffect, getAuthSessionGeneration, showGlobalToast);
  return { render: id => { index = 0; return hook(id); }, unmount: () => effects.forEach(e => e?.cleanup?.()), switchAccount: () => generation++, toasts };
}
for (const boundary of ['取消', '卸载', '切换账号', '修改输入']) {
  test(boundary + '使等待中的回执失效并保持在途防重', async () => {
    const h = harness(), op = h.render('a'), d = deferred();
    let writes = 0;
    const first = op.run(async current => { await d.promise; if (current()) writes++; });
    if (boundary === '取消') op.cancel();
    if (boundary === '卸载') h.unmount();
    if (boundary === '切换账号') h.switchAccount();
    if (boundary === '修改输入') h.render('b');
    await op.run(async () => { writes++; });
    d.resolve(); await first;
    assert.equal(writes, 0);
    assert.equal(h.toasts.length, 0);
  });
}
test('同一事件周期连点仅执行一次，完成后可再次提交', async () => {
  const h = harness(), op = h.render(), d = deferred(); let calls = 0;
  const first = op.run(async () => { calls++; await d.promise; });
  await op.run(async () => { calls++; });
  assert.equal(calls, 1); d.resolve(); await first;
  await op.run(async () => { calls++; }); assert.equal(calls, 2);
});
test('已发送写入的取消明确提示结果需核对', async () => {
  const h = harness(), op = h.render(), d = deferred();
  const pending = op.run(async (current, markSent) => { markSent(); await d.promise; });
  op.cancel(); h.unmount();
  assert.equal(h.toasts.length, 1); assert.match(h.toasts[0][1], /不能撤回/);
  d.resolve(); await pending;
});
test('请求失败提示错误且释放提交锁', async () => {
  const h = harness(), op = h.render();
  await op.run(async () => { throw Object.assign(new Error('断网'), { isNetworkError: true }); });
  assert.match(h.toasts[0][1], /输入已保留/);
  let done = false; await op.run(async () => { done = true; }); assert.equal(done, true);
});
function deleteHandler(op, verify, confirm) {
  const body = source.slice(source.indexOf('  const handleConfirm = async () => {', source.indexOf('function DeleteVerifyDialog')), source.indexOf('\n  return (', source.indexOf('function DeleteVerifyDialog')));
  return new Function('run', 'apiVerifyPhoneCode', 'onConfirm', 'setCodeError', 'code', 'maskedPhone', body + '\nreturn handleConfirm;')(op.run, verify, confirm, () => {}, '123456', '13800000000');
}
test('实际注销验证回调：取消后不调用注销接口', async () => {
  const h = harness(), op = h.render(), d = deferred(); let deletes = 0;
  const fn = deleteHandler(op, () => d.promise, async () => { deletes++; });
  const pending = fn(); op.cancel(); d.resolve({ valid: true }); await pending;
  assert.equal(deletes, 0);
});
for (const failure of [false, true]) {
  test('实际注销接线：' + (failure ? '接口失败不退出' : '成功仅注销并退出一次'), async () => {
    const h = harness(), op = h.render(); let deletes = 0, logouts = 0;
    const start = source.indexOf('onConfirm={async (current, markSent) => {');
    const body = source.slice(start + 'onConfirm={'.length, source.indexOf('\n          }}', start) + 12);
    const confirm = new Function('apiDeleteAccount', 'setDeleteStep', 'onLogout', 'return (' + body + ');')(async () => { deletes++; if (failure) throw new Error('服务失败'); }, () => {}, () => { logouts++; });
    const fn = deleteHandler(op, async () => ({ valid: true }), confirm);
    await Promise.all([fn(), fn()]);
    assert.equal(deletes, 1); assert.equal(logouts, failure ? 0 : 1);
  });
}

