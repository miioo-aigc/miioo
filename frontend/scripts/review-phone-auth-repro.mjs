// 缺陷证据断言；修复后应改为回归断言。不调用真实接口。
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const auth = readFileSync('src/api/auth.js', 'utf8');
const ui = readFileSync('src/components/LoginModal.jsx', 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const readResponse = auth.slice(auth.indexOf('async function readAuthResponse'), auth.indexOf('export async function apiSendCode'));
for (const name of ['apiLogin', 'apiVerifyCodeLogin', 'apiRegister']) {
  test(`${name}：身份变化后旧响应仍覆盖凭证`, async () => {
    const start = auth.indexOf('export async function ' + name);
    const body = auth.slice(start, auth.indexOf('\nexport ', start + 1)).replace('export async', 'async');
    const pending = deferred(); let token = '旧会话'; let generation = 1;
    const fn = new Function('fetch', 'BASE', 'setTokens', 'getAuthSessionGeneration', readResponse + body + '\nreturn ' + name)(() => pending.promise, '', value => { token = value; generation++; }, () => generation);
    const request = fn({ phone: '测试号码', code: '测试验证码' });
    token = '新会话'; generation++;
    pending.resolve({ ok: true, json: async () => ({ access_token: '迟到的测试凭证' }) });
    await request;
    assert.equal(token, '迟到的测试凭证');
  });
}
function extract(name, result) {
  const start = ui.indexOf('function ' + name + '(');
  return ui.slice(start, ui.indexOf('\n  return (', start)) + '\nreturn ' + result + ';\n}';
}
test('手机视图旧成功仍调用父成功回调', async () => {
  const pending = deferred(); let successes = 0;
  const values = [false, '13800000000', '123456', true, false, false, false];
  const fn = new Function('useRef', 'useState', 'loginWithPhone', extract('PhoneLoginView', 'handleLogin') + '\nreturn PhoneLoginView;')(v => ({current:v}), () => [values.shift(), () => {}], () => pending.promise);
  const submit = fn({ onLogin: () => successes++, onShowToast: () => {} });
  const request = submit();
  // 源码无卸载清理；此处仅证明延迟处理器会调用成功，不模拟浏览器卸载。
  pending.resolve({ access_token: '测试凭证' }); await request;
  assert.equal(successes, 1);
});
test('短信响应未到时两次点击会发送两次请求', async () => {
  const pending = deferred(); let sends = 0;
  const fn = new Function('useRef', 'useState', 'useEffect', 'sendVerificationCode', extract('SendCodeButton', 'handleClick') + '\nreturn SendCodeButton;')(v => ({current:v}), v => [v, () => {}], () => {}, () => { sends++; return pending.promise; });
  const click = fn({phone:'测试号码',disabled:false});
  const first = click(); const second = click();
  assert.equal(sends, 2); pending.resolve({}); await Promise.all([first,second]);
});
