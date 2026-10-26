import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const text = readFileSync(new URL('../src/api/auth.js', import.meta.url), 'utf8');
for (const name of ['apiPollWechatQrCodeStatus','apiConfirmWechatLogin','apiCompleteWechatCallback']) {
  const a=text.indexOf('export async function '+name), next=text.indexOf('\nexport ',a+1);
  const code=text.slice(a,next<0?undefined:next).replace('export async function','async function').replaceAll('import.meta.env.VITE_USE_MOCK','"false"');
  for (const reason of ['关闭','换账号','有效']) test(name+'：'+reason+'时校验令牌写入',async()=>{
    let resolve; let generation=1; let current=true; let writes=0;
    const fn=new Function('fetch','BASE','setTokens','getAuthSessionGeneration',code+'\nreturn '+name)(()=>new Promise(r=>resolve=r),'',()=>{writes++; generation++;},()=>generation);
    const request=fn(name==='apiPollWechatQrCodeStatus'?'test':{session_id:'test',code:'test',state:'test'},{isCurrent:()=>current});
    if(reason==='关闭') current=false; if(reason==='换账号') generation++;
    resolve({ok:true,json:async()=>({access_token:'synthetic-test-only'})});
    if(reason==='有效') await request; else await assert.rejects(request,{name:'AbortError'});
    assert.equal(writes,reason==='有效'?1:0);
  });
}
