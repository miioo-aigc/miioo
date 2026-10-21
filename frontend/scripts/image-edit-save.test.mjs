import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
const bindings = [];
const image = { id: 'saved', original_url: '/uploads/result.png', edit_type: 'basic', edit_mode: 'crop' };
let response = { ok: true, status: 201, json: async () => image };
let sourceImage;
const context = vm.createContext({ Blob, FormData });
const stub = (exports) => new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
}, { context });
const imports = {
  './request': stub({ authFetchForm: async (url, options) => { calls.push({ url, ...options }); return response; } }),
  './ImageEdit': stub({ apiReadEditedImage: async (id) => { assert.equal(id, 'source'); return sourceImage; }, normalizeEditedImage: (value) => {
    assert.ok(value.id && value.original_url);
    return { ...value, creationAssetId: value.id, originalUrl: value.original_url };
  } }),
  './subject': stub({ apiAddSubjectImageFromAsset: (...args) => { bindings.push({ kind: 'subject', args }); } }),
  './storyboard': stub({ apiCreateStoryboardMediaCandidate: (...args) => { bindings.push({ kind: 'storyboard', args }); } }),
};
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/ImageEditSave.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link((name) => imports[name]);
await module.evaluate();
const { uploadImageEditFile, prepareImageEditDestination, bindImageEditResult } = module.namespace;
for (const fields of [
  { session_id: 'session', shot_id: 'shot' },
  { sessionId: 'session', shotId: 'shot' },
  { metadata_json: { session_id: 'session', shot_id: 'shot' } },
  { metadata_json: JSON.stringify({ sessionId: 'session', shotId: 'shot' }) },
]) {
  sourceImage = { ...fields, projectId: 'project' };
  const destination = await prepareImageEditDestination('creation:owner:user:source', 'source');
  assert.equal(destination.session_id, 'session');
  assert.equal(destination.shot_id, 'shot');
  assert.equal(destination.project_id, 'project');
  assert.equal(await bindImageEditResult({ ...image, ...fields }, destination) !== null, true);
  await assert.rejects(bindImageEditResult({ ...image, sessionId: 'other', shotId: 'shot' }, destination), /未返回相同创作归属/);
}
sourceImage = {};
assert.equal((await prepareImageEditDestination('creation:source', 'source')).kind, 'creation');
// 真实故障结构：分镜视频选帧再裁剪，创作会话字段均为空。
sourceImage = {
  id: 'source', category: 'storyboard', source: 'creation_basic_edit', edit_mode: 'crop',
  session_id: null, sessionId: null, shot_id: null, shotId: null,
  metadata_json: { storyboard_id: 'historical-storyboard', parent_asset_id: 'frame-asset', root_asset_id: 'video-asset' },
};
const creationDestination = await prepareImageEditDestination('creation:owner:user:source', 'source');
assert.equal(creationDestination.kind, 'creation');
assert.equal(creationDestination.targetId, undefined);
assert.equal((await bindImageEditResult(image, creationDestination)).creationAssetId, 'saved');
assert.equal(bindings.length, 0, '创作入口不得因历史分镜来源绑定候选列表');
const storyboardDestination = await prepareImageEditDestination('storyboard:project:current-storyboard', 'source');
await bindImageEditResult(image, storyboardDestination);
assert.equal(bindings.length, 1);
assert.equal(bindings[0].kind, 'storyboard');
assert.equal(bindings[0].args[0], 'project');
assert.equal(bindings[0].args[1], 'current-storyboard');
assert.equal(bindings[0].args[2].asset_id, 'saved');
await assert.rejects(prepareImageEditDestination('storyboard:project:null', 'source'), /缺少原图片/);
sourceImage = { session_id: 'original', sessionId: 'alias' };
assert.equal((await prepareImageEditDestination('creation:source', 'source')).session_id, 'original');
sourceImage = { shotId: 'shot-only' };
assert.equal((await prepareImageEditDestination('creation:source', 'source')).shot_id, 'shot-only');
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
