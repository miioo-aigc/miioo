import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCanvasAssetLibraryDevelopment } from '../src/api/CanvasAssetLibraryDevelopment.js';
import { canvasLibraryAudioUrl, canvasLibrarySelectLoaded, canvasLibraryToggleSelection } from '../src/components/assets/CanvasLibraryItems.js';

test('画布资产侧栏使用仅画布集合接口，不读取混合项目集合', () => {
  const api = readFileSync(new URL('../src/api/CanvasAssetLibrary.js', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/components/assets/UseCanvasCollections.js', import.meta.url), 'utf8');
  assert.match(api, /\/api\/canvas-assets/);
  assert.match(api, /canvasCollections/);
  assert.match(hook, /api\.canvasCollections\(\{ limit: 60 \}/);
  assert.match(hook, /api\.canvasCollections\(\{ cursor: page\.next_cursor/);
  assert.match(hook, /api\.canvasCollections\(\{ cursor: state\.cursor/);
  assert.doesNotMatch(hook, /api\.collections\(/);
});

test('目录全选只覆盖已加载条目，逐项取消不会改变其余选择', () => {
  const loaded = [{ type: 'folder', id: 'folder-a' }, { type: 'entry', id: 'image-a' }, { type: 'entry', id: 'audio-a' }];
  const selected = canvasLibrarySelectLoaded(loaded);
  const remaining = canvasLibraryToggleSelection(selected, 'folder:folder-a');
  assert.deepEqual([...remaining], ['entry:image-a', 'entry:audio-a']);
  assert.equal(selected.size, 3);
  loaded.push({ type: 'entry', id: 'next-page' });
  assert.equal(remaining.has('entry:next-page'), false);
  assert.equal(canvasLibrarySelectLoaded(loaded).size, 4);
  assert.equal(canvasLibraryToggleSelection(remaining, 'folder:folder-a').size, 3);
  assert.equal(canvasLibrarySelectLoaded(loaded, false).size, 0);
  assert.deepEqual([...canvasLibrarySelectLoaded([{ type: 'entry', id: 'inside-folder' }])], ['entry:inside-folder']);
});

test('音频播放兼容原件、来源及预览地址，空白地址继续回退', () => {
  for (const field of ['original_url', 'originalUrl', 'audio_url', 'audioUrl', 'url', 'file_url', 'fileUrl', 'source_url', 'sourceUrl', 'preview_url', 'previewUrl']) {
    assert.equal(canvasLibraryAudioUrl({ [field]: ' /audio.mp3 ' }), '/audio.mp3');
  }
  assert.equal(canvasLibraryAudioUrl({ original_url: '  ', file_url: null, preview_url: '/preview.mp3' }), '/preview.mp3');
  assert.equal(canvasLibraryAudioUrl({ original_url: '/original.mp3', preview_url: '/preview.mp3' }), '/original.mp3');
  assert.equal(canvasLibraryAudioUrl(), '');
});

test('资产库不提供手动添加素材或引用入口', () => {
  const contents = readFileSync(new URL('../src/components/assets/CanvasLibraryContents.jsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/api/CanvasAssetLibrary.js', import.meta.url), 'utf8');
  assert.doesNotMatch(contents, /本地上传|上传素材|type="file"|api\.upload/);
  assert.doesNotMatch(contents, /添加素材|添加引用|onReference|AssetPickerModal|CanvasLibrarySourceDialog/);
  assert.doesNotMatch(contents, /api\.references/);
  assert.doesNotMatch(api, /async upload\(|\/uploads/);
});

const setup = (t) => {
  const api = createCanvasAssetLibraryDevelopment();
  t.after(() => api.dispose());
  return api;
};
const upload = (api, folder) => api.seedAsset(new File(['image'], '角色.png', { type: 'image/png' }), folder.id);
const remove = async (api, item) => api.commit(await api.preview({ selection: [item] }));
const root = (api, name) => {
  const item = api.seedCollection({ name, defaults: false });
  return { id: item.root_folder_id, collection_id: item.id, type: 'folder' };
};
const list = async (api, folder, params = {}) => api.list({ collection_id: folder.collection_id, parent_id: folder.id, ...params });

test('详情和收藏使用真实素材编号，收藏结果可重新读取', async (t) => {
  const api = setup(t);
  const folder = root(api, '收藏测试');
  await upload(api, folder);
  const entry = (await list(api, folder)).items[0];
  const assetId = entry.asset_id ?? entry.asset.id;
  assert.notEqual(assetId, entry.id);
  await api.favorite(assetId, true);
  assert.equal((await api.detail(assetId)).is_starred, true);
  await api.favorite(assetId, false);
  assert.equal((await api.detail(assetId)).is_starred, false);
  await assert.rejects(api.favorite(entry.id, true), { code: 'ASSET_UNAVAILABLE' });
});

test('初始无目录、支持重名、多层目录和目录优先分页', async (t) => {
  const api = setup(t);
  assert.deepEqual((await api.collections()).items, []);
  await assert.rejects(api.create({ name: '项目' }), { code: 'ROOT_FOLDER_CREATION_FORBIDDEN' });
  const a = root(api, '项目');
  const b = root(api, '项目');
  assert.notEqual(a.id, b.id);
  await upload(api, a);
  const child = await api.create({ name: '角色', parent_id: a.id });
  const page = await list(api, a, { limit: 1 });
  assert.equal(page.items[0].id, child.id);
  assert.equal((await list(api, a, { cursor: page.next_cursor })).items[0].type, 'entry');
  assert.equal((await api.folder(child.id)).ancestors[0].id, a.id);
});

test('删除引用仅移除收录；删除原生素材使所有收录失效', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  const b = root(api, '乙');
  const original = await upload(api, a);
  await api.seedReferences({ folder_id: b.id, asset_ids: [original.asset_id] });
  await remove(api, (await list(api, b)).items[0]);
  assert.equal((await list(api, a)).items.length, 1);
  await api.seedReferences({ folder_id: b.id, asset_ids: [original.asset_id] });
  const result = await remove(api, original);
  assert.deepEqual(result.invalidated_asset_ids, [original.asset_id]);
  assert.equal((await list(api, b)).items.length, 0);
});

test('递归删除目录不会追删外部原件；移动出目录的原件保留', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  const b = root(api, '乙');
  const sibling = await api.create({ name: '保留', parent_id: a.id });
  const child = await api.create({ name: '子目录', parent_id: a.id });
  const external = await upload(api, b);
  const moved = await upload(api, child);
  await api.seedReferences({ folder_id: child.id, asset_ids: [external.asset_id] });
  await api.move({ selection: [moved], target_folder_id: sibling.id });
  await remove(api, child);
  assert.equal((await list(api, b)).items.length, 1);
  assert.equal((await list(api, { ...a, id: sibling.id })).items.length, 1);
  await assert.rejects(api.folder(child.id), { code: 'FOLDER_NOT_FOUND' });
});

test('项目根锁定、目录防循环、禁止素材移动到首页、检查版本', async (t) => {
  const api = setup(t);
  const project = root(api, '项目');
  const a = await api.create({ name: '甲', parent_id: project.id });
  const child = await api.create({ name: '子', parent_id: a.id });
  await assert.rejects(api.rename({ ...project, name: '改名' }), { code: 'PROJECT_FOLDER_LOCKED' });
  await assert.rejects(api.move({ selection: [project], target_folder_id: a.id }), { code: 'PROJECT_FOLDER_LOCKED' });
  await assert.rejects(api.move({ selection: [a], target_folder_id: child.id }), { code: 'FOLDER_CYCLE' });
  const media = await upload(api, a);
  const other = root(api, '另一个项目');
  await assert.rejects(api.move({ selection: [media], target_folder_id: other.id }), { code: 'CROSS_COLLECTION_MOVE_FORBIDDEN' });
  await assert.rejects(api.move({ selection: [media], target_folder_id: null }), { code: 'TARGET_NOT_FOUND' });
  await assert.rejects(api.move({ selection: [{ ...media, base_revision: -1 }], target_folder_id: child.id }), { code: 'REVISION_CONFLICT' });
});

test('删除预检在范围变动或过期时拒绝提交，不能重放', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  const preview = await api.preview({ selection: [a] });
  await upload(api, a);
  await assert.rejects(api.commit(preview), { code: 'DELETE_SCOPE_CHANGED' });
  const next = await api.preview({ selection: [a] });
  const now = Date.now;
  t.mock.method(Date, 'now', () => now() + 61000);
  await assert.rejects(api.commit(next), { code: 'DELETE_PREVIEW_EXPIRED' });
});

test('原生素材测试数据仅允许图片视频音频', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  await assert.rejects(api.seedAsset(new File(['text'], '文本.txt', { type: 'text/plain' }), a.id), { code: 'UNSUPPORTED_MEDIA_TYPE' });
});

test('集合倒序分页、默认类型目录可删改、复制集合素材独立', async (t) => {
  const api = setup(t);
  const a = api.seedCollection({ name: '甲' });
  const b = api.seedCollection({ name: '乙' });
  const page = await api.collections({ limit: 1 });
  assert.equal(page.items[0].id, b.id);
  assert.equal((await api.collections({ cursor: page.next_cursor })).items[0].id, a.id);
  const directory = (await api.list({ collection_id: a.id, parent_id: a.root_folder_id })).items[0];
  await api.rename({ ...directory, name: '人物' });
  await remove(api, directory);
  const original = await upload(api, { id: a.root_folder_id });
  await api.seedReferences({ folder_id: b.root_folder_id, asset_ids: [original.asset_id] });
  const copy = await api.copyCollection(b.id);
  const collection = (await api.collections()).items.find((item) => item.id === copy.collection_id);
  assert.equal(collection.name, '乙-副本');
  const copied = (await api.list({ collection_id: collection.id, parent_id: collection.root_folder_id })).items.find((item) => item.type === 'entry');
  assert.notEqual(copied.asset_id, original.asset_id);
  assert.equal(copied.relation, 'native');
  await remove(api, { type: 'collection', id: a.id });
  assert.equal((await api.list({ collection_id: collection.id, parent_id: collection.root_folder_id })).items.some((item) => item.id === copied.id), true);
  assert.equal((await fetch(copied.asset.url)).ok, true);
  const renamed = await api.renameCollection(collection.id, { name: '改名', base_revision: collection.revision });
  assert.equal(renamed.name, '改名');
});

test('服务端全选快照覆盖未加载条目并在目录变动后失效', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  await upload(api, a); await upload(api, a); await upload(api, a);
  const page = await list(api, a, { limit: 1 });
  assert.equal(page.items.length, 1);
  const selection = await api.selection({ collection_id: a.collection_id, parent_id: a.id, scope: 'directory_children' });
  assert.equal(selection.count, 3);
  const preview = await api.preview({ selection_token: selection.selection_token });
  assert.equal(preview.impact.native_asset_count, 3);
  await api.commit(preview);
  assert.equal((await list(api, a)).items.length, 0);
  await assert.rejects(api.preview({ selection_token: selection.selection_token }), { code: 'SELECTION_SCOPE_CHANGED' });
});

test('路径导航在根目录不追加空项，子目录过滤无编号和重复项', async () => {
  const { canvasLibraryPath } = await import('../src/components/assets/CanvasLibraryItems.js');
  const root = { id: 1, name: '根目录' };
  const parent = { id: 2, name: '父目录' };
  const current = { id: 3, name: '当前目录', ancestors: [root, {}, null, parent, parent] };
  assert.deepEqual(canvasLibraryPath({}, 1, 1), []);
  assert.deepEqual(canvasLibraryPath(root, 1, 1), []);
  assert.deepEqual(canvasLibraryPath(current, 3, 1), [parent, current]);
  assert.deepEqual(canvasLibraryPath(null, 3, 1), []);
});

const apiSource = readFileSync(new URL('../src/api/CanvasAssetLibrary.js', import.meta.url), 'utf8');
function collectionApi(fetcher, development = null) {
  const start = apiSource.indexOf('async function requestCanvasCollections');
  const end = apiSource.indexOf('export const canvasAssetLibrary', start);
  return new Function('authFetch', 'development', 'canvasCollectionsBase', apiSource.slice(start, end) + '; return requestCanvasCollections;')(fetcher, development, 'https://example.test/api/canvas-assets');
}
test('实际请求使用专用地址，保留游标、取消信号和服务端空结果', async () => {
  const signal = new AbortController().signal;
  const page = { items: [], next_cursor: null };
  const calls = [];
  const read = collectionApi(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => page }; });
  assert.deepEqual(await read({ limit: 60, cursor: 'a+b/=' }, signal), page);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/api/canvas-assets/collections');
  assert.equal(url.searchParams.get('cursor'), 'a+b/=');
  assert.equal(url.searchParams.get('limit'), '60');
  assert.equal(calls[0].options.signal, signal);
});
test('专用接口失败不回退到混合集合', async () => {
  let calls = 0;
  const read = collectionApi(async () => { calls++; return { ok: false, status: 404, json: async () => ({ message: '接口未部署' }) }; });
  await assert.rejects(read(), { message: '接口未部署', status: 404 });
  assert.equal(calls, 1);
});
test('开发数据按画布类型先过滤再分页，工作流集合不占页数', async (t) => {
  const model = setup(t);
  const a = model.seedCollection({ name: '画布甲', kind: 'canvas' });
  model.seedCollection({ name: '工作流', kind: 'project' });
  const b = model.seedCollection({ name: '画布乙', kind: 'canvas' });
  model.seedCollection({ name: '历史', kind: 'historical' });
  const read = collectionApi(() => { throw Error('不应联网'); }, model);
  const first = await read({ limit: 1 });
  assert.deepEqual(first.items.map(item => item.id), [b.id]);
  const second = await read({ limit: 1, cursor: first.next_cursor });
  assert.deepEqual(second.items.map(item => item.id), [a.id]);
  assert.equal(second.next_cursor, null);
});
