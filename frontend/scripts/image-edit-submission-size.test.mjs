import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('上传结果保留后端尺寸，缺少尺寸时使用本地尺寸，重试不重复上传', async () => {
  for (const backendSize of [{ width: 800, height: 600 }, {}, { width: Infinity, height: 600 }]) {
    let uploads = 0;
    const saved = [];
    const stages = [];
    const context = vm.createContext({});
    const stubs = {
      react: { useRef: (current) => ({ current }), useState: (initial) => {
        let value = initial;
        return [initial, (next) => { value = typeof next === 'function' ? next(value) : next; if (typeof value === 'string') stages.push(value); }];
      } },
      '../utils/MediaEditRequest': { buildImageEditRequest: (_, options) => ({ file: options.file, edit_mode: options.mode }) },
      '../stores/toastStore': { showGlobalToast() {} },
      '../api/ImageEdit': { apiPrepareEditSource: async () => ({ id: 'source' }), apiSubmitImageEdit() { throw Error('unexpected generation'); } },
      '../api/ImageEditSave': { prepareImageEditDestination: async () => ({ kind: 'creation' }), uploadImageEditFile: async () => { uploads++; return { id: 'result', ...backendSize }; } },
      '../api/ImageEditSession': { imageEditSessionCheck: () => () => {} },
      '../stores/ImageEditSubmissionJournal': { imageEditSubmissionOwner: () => 'account', reserveImageEditSubmission: async () => 'journal', recordImageEditReceipt: async () => {}, finishImageEditSubmission: async () => {} },
    };
    const module = new vm.SourceTextModule(await readFile(new URL('../src/hooks/useImageEditSubmission.js', import.meta.url), 'utf8'), { context });
    await module.link((name) => new vm.SyntheticModule(Object.keys(stubs[name]), function () {
      Object.entries(stubs[name]).forEach(([key, value]) => this.setExport(key, value));
    }, { context }));
    await module.evaluate();
    const hook = module.namespace.default({ card: {}, onSave: { scope: 'creation:source', pending: async (payload) => {
      saved.push(payload.image);
      if (saved.length === 1) throw Error('local save failed');
      return payload.image;
    } } });
    const options = { mode: 'crop', file: {}, outputSize: { width: 700, height: 220 } };
    await hook.submit(options);
    await hook.submit(options);
    assert.equal(uploads, 1);
    assert.equal(saved.length, 2);
    for (const image of saved) {
      assert.equal(image.width, backendSize.width === 800 ? 800 : 700);
      assert.equal(image.height, backendSize.width === 800 ? 600 : 220);
    }
    assert.deepEqual(stages.slice(0, 4), ['正在准备保存', '正在上传图片', '正在保存并更新', '']);
  }
});
