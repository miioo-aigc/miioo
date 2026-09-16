import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
let responses = [];
const context = vm.createContext({ fetch, File, Blob, setTimeout: (fn) => { fn(); }, Date });
const request = new vm.SyntheticModule(['authFetch'], function () {
  this.setExport('authFetch', async (url, options) => {
    calls.push({ url, body: options.body && JSON.parse(options.body) });
    assert.ok(responses.length, `未预期的请求：${url}`);
    const item = responses.shift();
    return { ok: item.ok !== false, status: item.status || 200, json: async () => item.data };
  });
}, { context });
const policy = new vm.SourceTextModule(await readFile(new URL('../src/utils/MediaEditPolicy.js', import.meta.url), 'utf8'), { context });
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEdit.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => name === './request' ? request : policy);
await module.evaluate();
const api = module.namespace;
const image = { id: 'result', original_url: 'https://example.com/result.png' };
await assert.rejects(api.apiSubmitImageEdit({ id: 'source' }, { mode: 'inpaint' }), /契约尚未接入/);
assert.equal(calls.length, 0);
assert.equal((await api.apiResolveImageEdit(image, 'inpaint')).id, 'result');
responses = [{ data: { status: 'completed', results: [{ success: true, asset_id: 'result' }] } }, { data: image }];
assert.equal((await api.apiResolveImageEdit({ task_id: 'task' }, 'eraser')).id, 'result');
assert.equal(calls.at(-2).url, '/api/tasks/task');
for (const status of ['failed', 'cancelled', 'partial']) {
  responses = [{ data: { status, results: [] } }];
  await assert.rejects(api.apiResolveImageEdit({ task_id: 'task' }, 'eraser'), (error) => error.terminal === true);
}
responses = [{ ok: false, status: 422, data: { detail: '参数无效' } }];
await assert.rejects(api.apiReadEditedImage('result'), /参数无效/);
responses = [{ data: { status: 'completed', images: [image] } }, { data: image }];
await api.apiResolveImageEdit({ task_id: 'expand' }, 'outpaint');
assert.equal(calls.at(-2).url, '/api/creation/tasks/expand');
assert.equal(api.normalizeEditedImage(image).creationAssetId, 'result');
await assert.rejects(api.apiPrepareEditSource({ id: 'subject-id', blob: new Blob(['image']) }), /真实源资产编号/);
assert.equal((await api.apiPrepareEditSource({ creationAssetId: 'existing', imageUrl: 'source' })).id, 'existing');
assert.ok(calls.every((call) => !call.url.includes('basic-edit')));
console.log('图片编辑接口分支测试通过');
