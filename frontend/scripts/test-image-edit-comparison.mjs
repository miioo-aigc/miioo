import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let slots = [], cursor = 0, calls = [], saves = [], closeCount = 0, failSave = false, terminal = false;
let release;
const context = vm.createContext({});
const dependencies = {
  react: {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
  },
  '../utils/MediaEditRequest': { buildImageEditRequest: (card, options) => ({ ...options, edit_mode: options.mode, sourceId: card.id }) },
  '../stores/toastStore': { showGlobalToast() {} },
  '../api/ImageEdit': {
    apiPrepareEditSource: async (card) => ({ id: card.id }),
    apiSubmitImageEdit: async (source, options) => { calls.push({ source, options }); return { task_id: `task-${calls.length}` }; },
  },
  '../api/ImageEditSave': {
    prepareImageEditDestination: async () => ({ scope: 'subject:p:s' }),
    uploadImageEditFile: async () => ({ id: 'upload' }),
  },
};
const module = new vm.SourceTextModule(await readFile(new URL('../src/hooks/useImageEditSubmission.js', import.meta.url), 'utf8'), { context });
await module.link((name) => new vm.SyntheticModule(Object.keys(dependencies[name]), function () {
  for (const [key, value] of Object.entries(dependencies[name])) this.setExport(key, value);
}, { context }));
await module.evaluate();
const onSave = Object.assign(() => {}, { scope: 'subject:p:s', pending: async (work) => {
  if (release) await new Promise((resolve) => { release = resolve; });
  if (failSave) throw Object.assign(new Error('保存失败'), { terminal });
  const result = { imageUrl: work.accepted?.task_id || 'upload' };
  saves.push(result);
  return result;
} });
function render(card = { id: 'original' }, keepOpen = true) {
  cursor = 0;
  return module.namespace.default({ card, onSave, keepOpen, onComplete: () => { closeCount++; } });
}
await render().submit({ mode: 'outpaint', prompt: '第一轮' });
assert.equal(render().comparison.result.imageUrl, 'task-1');
assert.equal(closeCount, 0);
await render({ id: 'changed-parent' }).submit({ mode: 'outpaint', prompt: '第二轮' });
assert.equal(calls[1].source.id, 'original');
assert.equal(calls[1].options.prompt, '第二轮');
assert.equal(saves.length, 2);
assert.equal(render().comparison.result.imageUrl, 'task-2');

failSave = true;
await render().submit({ mode: 'outpaint' });
assert.equal(render().comparison.result.imageUrl, 'task-2');
assert.equal(render().comparison.retrySave, true);
failSave = false;
await render().submit();
assert.equal(calls.length, 3);
assert.equal(render().comparison.result.imageUrl, 'task-3');

failSave = true; terminal = true;
await render().submit({ mode: 'outpaint' });
assert.equal(render().comparison.retrySave, false);
failSave = false;
await render().submit({ mode: 'outpaint', prompt: '终态失败后的新尝试' });
assert.equal(calls.length, 5);

release = true;
const pending = render().submit({ mode: 'upscale' });
while (release === true) await Promise.resolve();
assert.equal(render().busy, true);
assert.equal(render().comparison.active, true);
await render().submit({ mode: 'upscale' });
assert.equal(calls.length, 6);
// 不再渲染弹窗，已启动的保存仍会完成。
release(); release = null;
await pending;
assert.equal(saves.length, 5);
slots = [];
await render({ id: 'crop' }, false).submit({ mode: 'crop', file: {} });
assert.equal(closeCount, 1);
console.log('左右对比流程测试通过：固定原图、连续生成、历史保留、保存重试、终态失败、防重复、关闭后保存及裁剪兼容');
