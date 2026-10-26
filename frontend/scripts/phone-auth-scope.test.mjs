// 手机认证归属与短信防连点回归，不调用真实接口。
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const auth = readFileSync('src/api/auth.js', 'utf8');
const ui = readFileSync('src/components/LoginModal.jsx', 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const readResponse = auth.slice(auth.indexOf('async function readAuthResponse'), auth.indexOf('export async function apiSendCode'));
for (const name of ['apiLogin', 'apiVerifyCodeLogin', 'apiRegister']) {
  test(`${name}：身份变化后旧响应不覆盖凭证`, async () => {
    const start = auth.indexOf('export async function ' + name);
    const body = auth.slice(start, auth.indexOf('\nexport ', start + 1)).replace('export async', 'async');
    const pending = deferred(); let token = '旧会话'; let generation = 1;
    const fn = new Function('fetch', 'BASE', 'setTokens', 'getAuthSessionGeneration', readResponse + body + '\nreturn ' + name)(() => pending.promise, '', value => { token = value; generation++; }, () => generation);
    const request = fn({ phone: '测试号码', code: '测试验证码' });
    token = '新会话'; generation++;
    pending.resolve({ ok: true, json: async () => ({ access_token: '迟到的测试凭证' }) });
    await assert.rejects(request, {name:'AbortError'});
    assert.equal(token, '新会话');
  });
}
function extract(name, result) {
  const start = ui.indexOf('function ' + name + '(');
  return ui.slice(start, ui.indexOf('\n  return (', start)) + '\nreturn ' + result + ';\n}';
}
for (const outcome of ['成功', '失败']) for (const cancel of [false, true]) test('手机登录：'+outcome+'，取消='+cancel, async () => {
  let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;});
  let successes=0, errors=0; const effects=[]; const cancelRef={current:null};
  const values=[false,'13800000000','123456',true,false,false,false];
  const fn=new Function('useRef','useState','useEffect','getAuthSessionGeneration','loginWithPhone',extract('PhoneLoginView','handleLogin')+'\nreturn PhoneLoginView;')(v=>({current:v}),()=>[values.shift(),()=>{}],f=>effects.push(f),()=>1,()=>promise);
  const submit=fn({cancelRef,onLogin:()=>successes++,onShowToast:()=>errors++});
  const cleanups=effects.map(f=>f()); const request=submit();
  if(cancel) cancelRef.current();
  if(outcome==='成功') resolve({access_token:'测试凭证'}); else reject(new Error('测试错误'));
  await request;
  assert.equal(successes,!cancel&&outcome==='成功'?1:0);
  assert.equal(errors,!cancel&&outcome==='失败'?1:0);
  cleanups.forEach(f=>f?.());
});
for (const cancel of [false,true]) test('短信防连点与卸载隔离：'+cancel,async()=>{
  const pending=deferred(); let sends=0; const effects=[]; const changes=[];
  const fn=new Function('useRef','useState','useEffect','getAuthSessionGeneration','sendVerificationCode',extract('SendCodeButton','handleClick')+'\nreturn SendCodeButton;')(v=>({current:v}),v=>[v,x=>changes.push(x)],f=>effects.push(f),()=>1,()=>{sends++;return pending.promise;});
  const click=fn({phone:'测试号码',disabled:false,isCurrent:()=>true});
  const cleanups=effects.map(f=>f()); const first=click(); const second=click();
  assert.equal(sends,1); if(cancel) cleanups.forEach(f=>f?.());
  pending.resolve({}); await Promise.all([first,second]);
  assert.equal(changes.includes(60),!cancel);
});

for (const cancel of [false,true]) test('验证码API流程取消='+cancel,async()=>{
  const start=auth.indexOf('export async function apiVerifyCodeLogin');
  const body=auth.slice(start,auth.indexOf('\nexport ',start+1)).replace('export async','async');
  const pending=deferred(); let current=true,writes=0;
  const fn=new Function('fetch','BASE','setTokens','getAuthSessionGeneration',readResponse+body+'\nreturn apiVerifyCodeLogin;')(()=>pending.promise,'',()=>writes++,()=>1);
  const request=fn({phone:'测试号码',code:'测试验证码'},{isCurrent:()=>current});
  if(cancel) current=false;
  pending.resolve({ok:true,json:async()=>({access_token:'测试凭证'})});
  if(cancel) await assert.rejects(request,{name:'AbortError'}); else await request;
  assert.equal(writes,cancel?0:1);
});
