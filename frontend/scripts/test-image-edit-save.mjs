import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
let source = { id: 'source', metadata_json: { session_id: 'session', shot_id: 'shot' } };
const context = vm.createContext({ URLSearchParams, FormData });
const dependencies = {
  './request': { authFetchForm: async () => { throw new Error('本测试不应上传'); } },
  './ImageEdit': { apiReadEditedImage: async () => source,
    normalizeEditedImage: (image) => ({ creationAssetId: image.id, originalUrl: image.original_url }) },
  './subject': { apiAddSubjectImageFromAsset: async (...args) => calls.push(['subject', ...args]) },
  './storyboard': { apiCreateStoryboardMediaCandidate: async (...args) => calls.push(['storyboard', ...args]) },
};
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEditSave.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => new vm.SyntheticModule(Object.keys(dependencies[name]), function () {
  for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
}, { context }));
await module.evaluate();
const api = module.namespace;
const image = { id: 'new-image', original_url: 'https://example.com/new.png' };
for (const kind of ['subject', 'storyboard']) {
  const destination = await api.prepareImageEditDestination(`${kind}:project:target`, 'source');
  await api.bindImageEditResult(image, destination);
  assert.equal(calls.at(-1)[0], kind);
  assert.equal(calls.at(-1)[1], 'project');
  assert.equal(calls.at(-1)[2], 'target');
}
assert.equal(calls.at(-1)[3].asset_id, 'new-image');
assert.equal(calls.at(-1)[3].is_primary, undefined);
const destination = await api.prepareImageEditDestination('creation:source', 'source');
await assert.rejects(api.bindImageEditResult(image, destination), /相同创作归属/);
await api.bindImageEditResult({ ...image, metadata_json: { session_id: 'session', shot_id: 'shot' } }, destination);
await assert.rejects(api.prepareImageEditDestination('subject:undefined:target', 'source'), /缺少/);
source = { id: 'source' };
await assert.rejects(api.prepareImageEditDestination('creation:source', 'source'), /未返回创作/);
console.log('图片编辑云端归属测试通过');
