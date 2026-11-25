import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/api/OnelinkAuth.js', import.meta.url), 'utf8');
async function setup(responses) {
  const calls = [], saved = [];
  globalThis.__ssoTest = { saved };
  globalThis.fetch = async (url, options) => {
    calls.push({url,...options,body:JSON.parse(options.body)});
    const [status,body] = responses.shift();
    return new Response(JSON.stringify(body),{status});
  };
  const transformed = source.replace(/^import .*;$/gm, '')
    .replaceAll('import.meta.env.VITE_API_BASE_URL', "''")
    .replaceAll('import.meta.env.VITE_ONELINK_AUTHORIZE_ORIGIN', "'https://scenic.wanlian.cloud'")
    .replaceAll('import.meta.env.VITE_DECRYPTION_KEY', "'k'.repeat(32)");
  const mocks = 'const getAuthSessionGeneration=()=>0; const getToken=()=>null; const setTokens=(a,b)=>globalThis.__ssoTest.saved.push([a,b]); const buildOnelinkAuthorizeUrl=async()=>"https://scenic.wanlian.cloud/authorize?enc=test";';
  const api=await import('data:text/javascript;base64,'+Buffer.from(mocks+transformed+'\n//'+Math.random()).toString('base64'));
  return {api,calls,saved};
}
test('完成请求携带 Cookie，严格模式只请求一次',async()=>{
 const {api,calls,saved}=await setup([[200,{status:'authenticated',access_token:'app-access',refresh_token:'app-refresh',phone_bound:false}]]);
 const a=api.completeOnelinkLogin({status:'continue'}), b=api.completeOnelinkLogin({status:'continue'});
 assert.equal(a,b); assert.deepEqual(await a,{next:'phone_bind'});
 assert.equal(calls.length,1); assert.equal(calls[0].credentials,'include');
 assert.equal(calls[0].url,'/api/auth/onelink/complete'); assert.deepEqual(calls[0].body,{});
 assert.deepEqual(saved,[['app-access','app-refresh']]);
});
test('首次选择后提交关联验证码，不提前写登录态',async()=>{
 const {api,calls,saved}=await setup([[409,{detail:{code:'ONELINK_ACCOUNT_CHOICE_REQUIRED'}}],[200,{status:'authenticated',access_token:'a',refresh_token:'r',phone_bound:true}]]);
 assert.deepEqual(await api.completeOnelinkLogin({status:'continue'}),{next:'choice'});
 assert.equal(saved.length,0);
 const choice={choice:'link_existing',phone:'13800138000',smsCode:'123456'};
 assert.deepEqual(await api.completeOnelinkLogin({status:'continue'},choice),{next:'home'});
 assert.deepEqual(calls[1].body,choice);
});
test('错误保留错误码和追踪编号，绑定成功不覆盖凭证',async()=>{
 const {api,saved}=await setup([[400,{detail:{code:'ONELINK_SMS_CODE_INVALID',message:'验证码错误',traceId:'test-trace'}}],[200,{status:'bound'}]]);
 await assert.rejects(api.completeOnelinkLogin({status:'continue'},{choice:'link_existing'}),e=>e.code==='ONELINK_SMS_CODE_INVALID'&&e.traceId==='test-trace');
 assert.deepEqual(await api.completeOnelinkLogin({status:'continue'},{choice:'create'}),{next:'bound'});
 assert.equal(saved.length,0);
});
test('发起请求使用后端契约，过期调用不跳转',async()=>{
 const {api,calls}=await setup([[200,{authorizeUrl:'https://scenic.wanlian.cloud/authorize',payload:{}}]]);
 await api.startOnelinkLogin({isCurrent:()=>false});
 assert.equal(calls[0].url,'/api/auth/onelink/start');
 assert.deepEqual(calls[0].body,{intent:'login'}); assert.equal(calls[0].credentials,'include');
});
test('并发及跳转后的重复发起只发送一次请求', async () => {
 const {api,calls}=await setup([[200,{authorizeUrl:'https://scenic.wanlian.cloud/authorize',payload:{}}]]);
 let redirects=0;
 globalThis.window={location:{assign(){redirects++;}}};
 try {
  const first=api.startOnelinkLogin();
  assert.equal(api.startOnelinkLogin(),first);
  assert.deepEqual(await first,{redirecting:true});
  await api.startOnelinkLogin();
  assert.equal(calls.length,1); assert.equal(redirects,1);
 } finally { delete globalThis.window; }
});
test('发起失败后允许重新尝试', async () => {
 const {api,calls}=await setup([[503,{detail:'暂时不可用'}],[200,{authorizeUrl:'https://scenic.wanlian.cloud/authorize',payload:{}}]]);
 await assert.rejects(api.startOnelinkLogin());
 await api.startOnelinkLogin({isCurrent:()=>false});
 assert.equal(calls.length,2);
});
