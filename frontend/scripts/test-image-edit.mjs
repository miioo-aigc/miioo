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
const creation = new vm.SyntheticModule(['apiUploadCreationImage'], function () {
  this.setExport('apiUploadCreationImage', async () => ({ asset_id: 'uploaded', uploaded_url: 'https://example.com/source.png' }));
}, { context });
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEdit.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => name === './request' ? request : creation);
await module.evaluate();
const api = module.namespace;
const image = { id: 'result', original_url: 'https://example.com/result.png' };
responses = [{ data: image }];
const accepted = await api.apiSubmitImageEdit({ id: 'source' }, { mode: 'inpaint', mask: 'data:image/png;base64,mask', prompt: '重绘' });
assert.equal(calls.at(-1).url, '/api/creation/images/source/erase');
assert.equal(calls.at(-1).body.mask_data_url, 'data:image/png;base64,mask');
assert.equal((await api.apiResolveImageEdit(accepted, 'inpaint')).id, 'result');
responses = [{ data: { status: 'completed', results: [{ success: true, asset_id: 'result' }] } }, { data: image }];
assert.equal((await api.apiResolveImageEdit({ task_id: 'task' }, 'eraser')).id, 'result');
assert.equal(calls.at(-2).url, '/api/tasks/task');
for (const status of ['failed', 'cancelled', 'partial']) {
  responses = [{ data: { status, results: [] } }];
  await assert.rejects(api.apiResolveImageEdit({ task_id: 'task' }, 'eraser'), (error) => error.terminal === true);
}
responses = [{ ok: false, status: 422, data: { detail: '参数无效' } }];
await assert.rejects(api.apiSubmitImageEdit({ id: 'source' }, { mode: 'eraser' }), /参数无效/);
responses = [{ data: { task_id: 'expand' } }];
await api.apiSubmitImageEdit({ url: 'https://example.com/source.png' }, { mode: 'outpaint', model: 'supported', expandOptions: { left_expansion_ratio: 0.25 } });
assert.equal(calls.at(-1).body.generation_mode, 'outpainting');
assert.equal(calls.at(-1).body.reference_images.length, 1);
responses = [{ data: { status: 'completed', images: [image] } }, { data: image }];
await api.apiResolveImageEdit({ task_id: 'expand' }, 'outpaint');
assert.equal(calls.at(-2).url, '/api/creation/tasks/expand');
assert.equal(api.normalizeEditedImage(image).creationAssetId, 'result');
assert.equal((await api.apiPrepareEditSource({ id: 'subject-id', blob: new Blob(['image']) })).id, 'uploaded');
assert.equal((await api.apiPrepareEditSource({ creationAssetId: 'existing', imageUrl: 'source' })).id, 'existing');
assert.ok(calls.every((call) => !call.url.includes('basic-edit')));
console.log('图片编辑接口分支测试通过');
