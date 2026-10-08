import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const records = new Map();
let state, binds = 0, resolves = 0, failures = 0, failGeneration = false, release;
const indexedDB = { open() {
  const request = {};
  queueMicrotask(() => {
    request.result = { transaction() {
      const transaction = { objectStore() {
        function result(value) {
          const request = { result: value };
          queueMicrotask(() => transaction.oncomplete());
          return request;
        }
        return {
          index: () => ({ getAll: (scope) => result([...records.values()].filter((item) => item.scope === scope)) }),
          get: (id) => result(records.get(id)),
          put: (record) => { records.set(record.id, structuredClone(record)); return result(record.id); },
          delete: (id) => { records.delete(id); return result(undefined); },
        };
      } };
      return transaction;
    } };
    request.onsuccess();
  });
  return request;
} };
const context = vm.createContext({ indexedDB, Blob, URL, crypto, setTimeout: (fn) => queueMicrotask(fn) });
const dependencies = {
  './CreationImageEdits': { syncCreationImageEdit() {}, removeCreationImageEdit() {} },
  zustand: { create: (init) => {
    state = init();
    return { getState: () => state, setState: (update) => { state = { ...state, ...update(state) }; } };
  } },
  '../api/ImageEdit': {
    apiResolveImageEdit: async () => {
      resolves++;
      if (release) await new Promise((resolve) => { release = resolve; });
      if (failGeneration) throw new Error('生成失败');
      return { id: 'image' };
    },
    normalizeEditedImage: (image) => image,
  },
  './toastStore': { showGlobalToast() {} },
  '../utils/downloadFeedback': { downloadUrlWithFeedback() {} },
  '../api/ImageEditSave': { bindImageEditResult: async () => {
    binds++;
    if (binds <= failures) throw new Error('保存失败');
    return { remoteUrl: 'https://example.com/image.png' };
  } },
};
const module = new vm.SourceTextModule(await readFile(new URL('../src/stores/LocalImageEdits.js', import.meta.url), 'utf8'), { context });
await module.link((name) => new vm.SyntheticModule(Object.keys(dependencies[name]), function () {
  for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
}, { context }));
await module.evaluate();
const api = module.namespace;
const scope = 'subject:p:s';
const submit = (id) => api.savePendingImage(scope, { accepted: { task_id: id }, destination: {}, mode: 'inpaint' });
release = true;
const first = submit('first');
while (release === true) await new Promise((resolve) => setImmediate(resolve));
assert.equal(state.byScope[scope][0].status, 'loading');
const placeholderId = state.byScope[scope][0].id;
release(); release = null;
await first;
assert.equal(state.byScope[scope][0].id, placeholderId);
assert.equal(state.byScope[scope][0].status, 'done');
binds = 0; failures = 4;
await submit('retry-success');
assert.equal(binds, 5);
assert.equal(resolves, 2);
binds = 0; failures = 10;
await assert.rejects(submit('give-up'), (error) => error.terminal && /5 次/.test(error.message));
assert.equal(binds, 5);
assert.equal(state.byScope[scope].length, 2);
assert.equal([...records.values()].some((item) => item.pending), false);
failGeneration = true;
await assert.rejects(submit('generation-failure'), /生成失败/);
assert.equal(state.byScope[scope].length, 2);
assert.equal(binds, 5);
console.log('编辑占位测试通过：原位替换、五次上限、重试不生图、失败移除');
