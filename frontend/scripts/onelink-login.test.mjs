import test from 'node:test';
import assert from 'node:assert/strict';
import { captureOnelinkCallback, CALLBACK_MESSAGES } from '../src/utils/OnelinkLoginFlow.js';
import { encryptOnelinkPayload, buildOnelinkAuthorizeUrl } from '../src/utils/OnelinkAuthorize.js';
const keyString = 'k'.repeat(32);
const payload = {clientType:'web',clientName:'miioo',name:'miioo',url:'https://app.example',callback:'https://app.example/api/auth/callback/onelink?state=server-state',timestamp:123456,state:'server-state'};
test('保留后端时间戳、回调与状态，加密结果可按协议解密', async () => {
  const url = new URL(await buildOnelinkAuthorizeUrl({authorizeUrl:'https://scenic.wanlian.cloud/authorize',allowedOrigin:'https://scenic.wanlian.cloud',payload,keyString}));
  const [iv,tag,cipher]=url.searchParams.get('enc').split(':').map(v=>Buffer.from(v,'base64'));
  assert.equal(iv.length,12); assert.equal(tag.length,16);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(keyString),'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,Buffer.concat([cipher,tag]));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(plain)),payload);
});
test('不再自动补齐或截取密钥', async()=>{
  for (const key of ['', 'short', 'x'.repeat(33)]) await assert.rejects(encryptOnelinkPayload(payload,key));
});
test('拒绝错误授权来源与回调状态', async()=>{
  for(const override of [{authorizeUrl:'https://other.example/authorize'},{payload:{...payload,state:'wrong'}},{payload:{...payload,callback:'https://app.example/callback'}}]) {
    await assert.rejects(buildOnelinkAuthorizeUrl({authorizeUrl:'https://scenic.wanlian.cloud/authorize',allowedOrigin:'https://scenic.wanlian.cloud',payload,keyString,...override}));
  }
});
for(const status of ['continue',...Object.keys(CALLBACK_MESSAGES),'unknown']) test('回调状态 '+status,()=>{
  let cleared=false;
  const result=captureOnelinkCallback({location:{pathname:'/onelink/callback',href:'https://app.example/onelink/callback?status='+status},history:{replaceState(){cleared=true;}}});
  assert.ok(cleared);
  if(status==='continue') assert.equal(result.status,status); else assert.ok(result.error);
});
test('拒绝重复状态和旧凭证回调，清理地址',()=>{
 for(const query of ['status=continue&status=continue','status=continue&access_token=secret','']) {
  const result=captureOnelinkCallback({location:{pathname:'/onelink/callback',href:'https://app.example/onelink/callback?'+query},history:{replaceState(){}}});
  assert.ok(result.error);
 }
 assert.equal(captureOnelinkCallback({location:{pathname:'/'}}),null);
});
