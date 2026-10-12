import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let state;
const storeModule = new vm.SourceTextModule(await readFile(new URL('../src/stores/creationStore.js', import.meta.url), 'utf8'));
const dependencies = {
  zustand: { create: (init) => {
    const store = { getState: () => state, setState: (update) => { state = { ...state, ...update(state) }; } };
    state = init(store.setState);
    return store;
  } },
  'zustand/middleware': { persist: (init) => init },
  '../utils/creationHistoryAdapter': {
    dedupeByMediaAliases: (items) => items,
    getCreationAssetMediaAliases: () => [],
  },
};
await storeModule.link((name) => new vm.SyntheticModule(Object.keys(dependencies[name]), function () {
  for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
}));
await storeModule.evaluate();
const edits = new vm.SourceTextModule(await readFile(new URL('../src/stores/CreationImageEdits.js', import.meta.url), 'utf8'));
await edits.link(() => storeModule);
await edits.evaluate();
const { syncCreationImageEdit: sync, removeCreationImageEdit: remove } = edits.namespace;
const pending = { id: 'task', scope: 'creation:source', pending: true, status: 'loading', created_at: '2026-10-08T01:00:00Z' };
const result = { ...pending, pending: false, status: 'done', backendId: 'result', originalUrl: '/original.png', imageUrl: '/original.png' };
state.addGeneration('image', { id: 'source', cards: [{ id: 'source', status: 'done' }] });
sync(pending);
assert.equal(state.generationsByTab.image.at(-1).id, 'image-edit:task');
state.addGeneration('image', { id: 'later', cards: [{ status: 'loading' }] });
sync(result);
assert.deepEqual(Array.from(state.generationsByTab.image, (item) => item.id), ['source', 'image-edit:task', 'later']);
assert.equal(state.generationsByTab.image[1].cards[0].status, 'done');
sync(result);
assert.equal(state.generationsByTab.image.length, 3);
remove(result);
assert.equal(state.generationsByTab.image.length, 2);
state.addGeneration('image', { id: 'history', cards: [{ id: 'result', status: 'done', imageUrl: '/thumbnail.webp' }] });
sync(result);
assert.equal(state.generationsByTab.image.length, 3);
sync({ ...pending, scope: 'subject:source' });
assert.equal(state.generationsByTab.image.length, 3);
sync(pending);
remove(pending);
assert.equal(state.generationsByTab.image.length, 3);
console.log('创作编辑接入测试通过：复用新增入口、倒序首位、完成原位更新、后续普通创作顺序、刷新去重、失败移除和入口隔离');

const videoPending = { id: 'video-edit-task', cards: [{ id: null, type: 'video', status: 'loading' }] };
state.addGeneration('video', { id: 'source-video', cards: [{ id: 'source-video', status: 'done' }] });
state.replaceGeneration('video', videoPending.id, videoPending);
state.setHistoryPage1('video', [{ id: 'source-video', cards: [{ id: 'source-video', status: 'done' }] }]);
assert.equal(state.generationsByTab.video[1].id, videoPending.id);
state.addGeneration('video', { id: 'later-task', cards: [{ status: 'loading' }] });
state.replaceGeneration('video', videoPending.id, { ...videoPending, cards: [{ id: 'result-video', status: 'done' }] });
assert.deepEqual(Array.from(state.generationsByTab.video, (item) => item.id), ['source-video', 'video-edit-task', 'later-task']);
assert.equal(state.generationsByTab.video[1].cards[0].id, 'result-video');
console.log('视频占位原位替换与历史加载保留测试通过');
