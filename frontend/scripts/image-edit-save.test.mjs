import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
const image = { id: 'saved', original_url: '/uploads/result.png', edit_type: 'basic', edit_mode: 'crop' };
let response = { ok: true, status: 201, json: async () => image };
const context = vm.createContext({ Blob, FormData });
const stub = (exports) => new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
}, { context });
const imports = {
  './request': stub({ authFetchForm: async (url, options) => { calls.push({ url, ...options }); return response; } }),
  './ImageEdit': stub({ apiReadEditedImage: () => { throw new Error('Unexpected read'); }, normalizeEditedImage: (value) => {
    assert.ok(value.id && value.original_url);
    return value;
  } }),
  './subject': stub({ apiAddSubjectImageFromAsset: () => {} }),
  './storyboard': stub({ apiCreateStoryboardMediaCandidate: () => {} }),
};
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEditSave.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => imports[name]);
await module.evaluate();
const { uploadImageEditFile } = module.namespace;
const file = new Blob(['pixels'], { type: 'image/png' });
for (const editMode of ['crop', 'flip']) {
  assert.equal(await uploadImageEditFile(file, { sourceAssetId: 'source', editMode }), image);
  const call = calls.at(-1);
  assert.equal(call.url, '/api/creation/images/edit-result');
  assert.equal(call.method, 'POST');
  assert.deepEqual([...call.body.keys()], ['file', 'source_asset_id', 'edit_mode']);
  assert.equal(call.body.get('source_asset_id'), 'source');
  assert.equal(call.body.get('edit_mode'), editMode);
  assert.equal(await call.body.get('file').text(), 'pixels');
}
await assert.rejects(uploadImageEditFile(file, { sourceAssetId: 'local-test', editMode: 'crop' }));
await assert.rejects(uploadImageEditFile(file, { sourceAssetId: 'source', editMode: 'erase' }));
await assert.rejects(uploadImageEditFile(new Blob(), { sourceAssetId: 'source', editMode: 'crop' }));
assert.equal(calls.length, 2);
response = { ok: false, status: 404, json: async () => ({ detail: 'missing source' }) };
await assert.rejects(uploadImageEditFile(file, { sourceAssetId: 'source', editMode: 'crop' }), (error) => error.terminal && error.message === 'missing source');
response = { ok: false, status: 500, json: async () => ({}) };
await assert.rejects(uploadImageEditFile(file, { sourceAssetId: 'source', editMode: 'flip' }), (error) => error.terminal === false);
console.log('image-edit-save: passed');
