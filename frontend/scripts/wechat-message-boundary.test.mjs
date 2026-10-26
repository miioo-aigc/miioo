import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createWechatCallbackNotice, isCurrentWechatNotice } from '../src/utils/WechatCallbackMessage.js';
test('通知白名单去掉所有凭证和后端文案', () => {
  assert.deepEqual(createWechatCallbackNotice({ session_id: 'current', status: 'confirmed', access_token: 'test', refresh_token: 'test', bind_token: 'test', message: 'private' }), { type: 'wechat-callback-complete', payload: { session_id: 'current', status: 'confirmed' } });
  assert.equal(createWechatCallbackNotice({ status: 'confirmed' }), null);
  assert.equal(createWechatCallbackNotice({ session_id: 'current', status: 'error' }), null);
});
test('仅同源、当前iframe、当前会话的通知可唤醒轮询', () => {
  const source = {}, context = { origin: 'https://app.invalid', source, sessionId: 'current' };
  const event = { origin: context.origin, source, data: createWechatCallbackNotice({ session_id: 'current', status: 'confirmed' }) };
  assert.equal(isCurrentWechatNotice(event, context), true);
  for (const patch of [{ origin: 'https://other.invalid' }, { source: {} }, { source: null }, { data: createWechatCallbackNotice({ session_id: 'old', status: 'confirmed' }) }]) assert.equal(isCurrentWechatNotice({ ...event, ...patch }, context), false);
  assert.equal(isCurrentWechatNotice(event, { ...context, sessionId: '' }), false);
});
test('iframe回调完成不提交本地令牌', async () => {
  const text = readFileSync(new URL('../src/api/auth.js', import.meta.url), 'utf8');
  const start=text.indexOf('export async function apiCompleteWechatCallback'),end=text.indexOf('// 4.',start);
  const code=text.slice(start,end).replace('export async function','async function').replaceAll('import.meta.env.VITE_USE_MOCK','"false"');
  let writes=0;
  const complete=new Function('fetch','BASE','setTokens','getAuthSessionGeneration',code+'\nreturn apiCompleteWechatCallback;')(async()=>({ok:true,json:async()=>({status:'confirmed',access_token:'test-only'})}),'',()=>writes++,()=>1);
  await complete({code:'test',state:'test'},{commitTokens:false,isCurrent:()=>true});
  assert.equal(writes,0);
});
