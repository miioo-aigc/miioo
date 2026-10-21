import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
let responses = [];
const context = vm.createContext({ fetch, File, Blob, AbortController, DOMException, TextDecoder, clearTimeout, setTimeout: (fn) => { fn(); }, Date });
const request = new vm.SyntheticModule(['authFetch', 'authFetchStream'], function () {
  this.setExport('authFetchStream', async () => ({ ok: false }));
  this.setExport('authFetch', async (url, options) => {
    calls.push({ url, body: options.body && JSON.parse(options.body) });
    assert.ok(responses.length, `未预期的请求：${url}`);
    const item = responses.shift();
    return { ok: item.ok !== false, status: item.status || 200, json: async () => item.data };
  });
}, { context });
const policy = new vm.SourceTextModule(await readFile(new URL('../src/utils/MediaEditPolicy.js', import.meta.url), 'utf8'), { context });
const session = new vm.SyntheticModule(['imageEditSessionCheck'], function () {
  this.setExport('imageEditSessionCheck', () => () => {});
}, { context });
const tasks = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEditTasks.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await tasks.link(name => name === './ImageEditSession' ? session : request);
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEdit.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => name === './request' ? request : name === './ImageEditTasks' ? tasks : name === './ImageEditSession' ? session : policy);
await module.evaluate();
const api = module.namespace;
const image = { id: 'result', original_url: 'https://example.com/result.png' };
await assert.rejects(api.apiSubmitImageEdit({ id: 'source' }, { mode: 'inpaint' }), /蒙版/);
assert.equal(calls.length, 0);
const source = { id: 'source', url: 'https://example.com/source.png' };
responses = [{ data: image }];
await api.apiSubmitImageEdit(source, { mode: 'erase', mask: 'data:image/png;base64,test', prompt: '不得发送' });
assert.equal(calls.at(-1).body.prompt, undefined);
assert.equal(calls.at(-1).body.model, 'gpt-image-2');
assert.equal(calls.at(-1).body.mask_data_url, 'data:image/png;base64,test');
responses = [{ data: image }];
await api.apiSubmitImageEdit(source, { mode: 'inpaint', mask: 'data:image/png;base64,test', prompt: ' 戴帽子 ' });
assert.equal(calls.at(-1).body.prompt, '戴帽子');
for (const quality of ['2K', '3K', '4K']) {
  responses = [{ data: { task_id: 'upscale' } }];
  await api.apiSubmitImageEdit(source, { mode: 'upscale', target_resolution: quality });
  assert.equal(calls.at(-1).body.resolution, quality);
  assert.equal(calls.at(-1).body.model, 'doubao-seedream-5.0-lite');
}
responses = [{ data: { task_id: 'expand' } }];
await api.apiSubmitImageEdit(source, { mode: 'outpaint', ratio: 'original', resolution: '4K', expandOptions: {
  up_expansion_ratio: 0, down_expansion_ratio: 0, left_expansion_ratio: 0.5, right_expansion_ratio: 0.5,
} });
assert.equal(calls.at(-1).body.generation_mode, 'outpainting');
assert.equal(Object.keys(calls.at(-1).body.expand_options).length, 4);
assert.equal(calls.at(-1).body.resolution, undefined);
assert.equal(calls.at(-1).body.aspect_ratio, undefined);
responses = [{ data: { task_id: 'multi-angle' } }];
await api.apiSubmitImageEdit(source, { mode: 'multi_angle', internal_prompt: '基于输入图片进行相机视角编辑', multi_angle_options: { horizontal: 90, vertical: 0 } });
assert.equal(calls.at(-1).url, '/api/creation/images/generate');
assert.equal(calls.at(-1).body.edit_type, 'image_edit');
assert.equal(calls.at(-1).body.edit_mode, 'multi_angle');
assert.equal(calls.at(-1).body.model, 'gpt-image-2');
assert.equal(calls.at(-1).body.internal_prompt, '基于输入图片进行相机视角编辑');
assert.deepEqual(calls.at(-1).body.multi_angle_options, { horizontal: 90, vertical: 0 });
assert.equal(calls.at(-1).body.prompt, undefined);
assert.equal((await api.apiResolveImageEdit(image, 'inpaint')).id, 'result');
responses = [{ data: { status: 'completed', results: [{ success: true, asset_id: 'result' }] } }, { data: image }];
assert.equal((await api.apiResolveImageEdit({ task_id: 'task' }, 'eraser')).id, 'result');
assert.equal(calls.at(-2).url, '/api/tasks/task');
for (const status of ['failed', 'cancelled', 'partial']) {
  responses = [{ data: { status, results: [] } }];
  await assert.rejects(api.apiResolveImageEdit({ task_id: 'task' }, 'eraser'), (error) => status === 'partial' ? !error.terminal : error.terminal === true);
}
responses = [{ ok: false, status: 422, data: { detail: '参数无效' } }];
await assert.rejects(api.apiReadEditedImage('result'), /参数无效/);
responses = [{ data: { status: 'completed', images: [image] } }, { data: image }];
await api.apiResolveImageEdit({ task_id: 'expand' }, 'outpaint');
assert.equal(calls.at(-2).url, '/api/tasks/expand');
responses = [{ data: { status: 'completed', resource_ids: ['result'] } }, { data: image }];
assert.equal((await api.apiResolveImageEdit({ task_id: 'task' }, 'upscale')).id, 'result');
assert.equal(api.normalizeEditedImage(image).creationAssetId, 'result');
await assert.rejects(api.apiPrepareEditSource({ id: 'subject-id', blob: new Blob(['image']) }), /真实源资产编号/);
assert.equal((await api.apiPrepareEditSource({ creationAssetId: 'existing', imageUrl: 'source' })).id, 'existing');
assert.ok(calls.every((call) => !call.url.includes('basic-edit')));
console.log('图片编辑接口分支测试通过');
