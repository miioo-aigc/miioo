import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasAssetLibraryDevelopment } from '../src/api/CanvasAssetLibraryDevelopment.js';

const setup = (t) => {
  const api = createCanvasAssetLibraryDevelopment();
  t.after(() => api.dispose());
  return api;
};
const upload = (api, folder) => api.upload(new File(['image'], '角色.png', { type: 'image/png' }), folder.id);
const remove = async (api, item) => api.commit(await api.preview({ selection: [item] }));
const root = (api, name) => {
  const item = api.seedCollection({ name, defaults: false });
  return { id: item.root_folder_id, collection_id: item.id, type: 'folder' };
};
const list = async (api, folder, params = {}) => api.list({ collection_id: folder.collection_id, parent_id: folder.id, ...params });

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
  await api.references({ folder_id: b.id, asset_ids: [original.asset_id] });
  await remove(api, (await list(api, b)).items[0]);
  assert.equal((await list(api, a)).items.length, 1);
  await api.references({ folder_id: b.id, asset_ids: [original.asset_id] });
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
  await api.references({ folder_id: child.id, asset_ids: [external.asset_id] });
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

test('仅允许图片视频音频上传', async (t) => {
  const api = setup(t);
  const a = root(api, '甲');
  await assert.rejects(api.upload(new File(['text'], '文本.txt', { type: 'text/plain' }), a.id), { code: 'UNSUPPORTED_MEDIA_TYPE' });
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
  await api.references({ folder_id: b.root_folder_id, asset_ids: [original.asset_id] });
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
