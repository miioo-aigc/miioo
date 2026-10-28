import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestViteServer } from './lib/create-test-vite-server.mjs';
const server = await createTestViteServer({ server: { middlewareMode:true, hmr:false, ws:false }, appType:'custom' });
after(() => server.close());
const { normalizeAssetWaveform, apiGetAssetWaveform, apiEnsureAssetWaveform } = await server.ssrLoadModule('/src/api/AssetWaveforms.js');
test('真实峰值校验拒绝畸形ready，静音合法，各终态保留', () => {
  assert.equal(normalizeAssetWaveform({ status:'ready',peaks:[0,0],duration_seconds:2 }).status,'ready');
  for(const peaks of [[],[NaN],[-1],[2],['0.5']]) assert.equal(normalizeAssetWaveform({ status:'ready',peaks,duration_seconds:2 }).status,'failed');
  for(const status of ['pending','failed','missing_source','no_audio','unsupported']) assert.equal(normalizeAssetWaveform({status}).status,status);
  assert.equal(normalizeAssetWaveform(null).status,'failed');
});
test('波形GET与重试POST沿用鉴权并传递取消信号', async () => {
  const oldFetch=globalThis.fetch; const oldStorage=globalThis.localStorage;
  const oldWindow=globalThis.window; globalThis.window={dispatchEvent:()=>{}};
  const calls=[]; const controller=new AbortController();
  globalThis.localStorage={getItem:(key)=>key === 'token' ? 'test-only-token' : null};
  globalThis.fetch=async (url,options)=>{calls.push({url,options});return Response.json({status:'ready',peaks:[0,1],duration_seconds:2});};
  try {
    assert.equal((await apiGetAssetWaveform('asset',controller.signal)).status,'ready');
    await apiEnsureAssetWaveform('asset',controller.signal);
    assert.ok(calls[0].url.endsWith('/api/assets/asset/waveform'));
    assert.equal(calls[0].options.method,'GET');
    assert.equal(calls[0].options.signal,controller.signal);
    assert.ok(calls[1].url.endsWith('/ensure-media-derivatives'));
    assert.equal(calls[1].options.method,'POST');
    await assert.rejects(apiGetAssetWaveform('',controller.signal));
  } finally {globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;globalThis.window=oldWindow;}
});
