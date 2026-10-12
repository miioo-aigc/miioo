import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { create } from 'zustand';

const saved = [];
const toasts = [];
const storage = new Map();
let submits = 0;
let reads = 0;
let finish;
let fail;
const context = vm.createContext({
  console,
  sessionStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  window: { dispatchEvent: () => {} },
  CustomEvent: class {},
});
const exports = {
  openVideoFrameDestination: () => {},
  create,
  validateSourceAsset: (source) => { if (!source?.asset_id) throw new Error('缺少资产'); return source.asset_id; },
  videoEditPayload: (options) => { if (options.duration < 3) throw new Error('时长不足'); },
  submitVideoEdit: async () => { submits++; return { task_id: 'task' }; },
  resolveVideoEdit: () => { reads++; return new Promise((resolve, reject) => { finish = resolve; fail = reject; }); },
  showGlobalToast: (...args) => toasts.push(args),
  invalidate: () => {},
  useCreationStore: { getState: () => ({
    addGeneration: (...args) => saved.push(args), updateHistoryMeta: () => {},
    deleteGeneration: (type, id) => {
      const index = saved.findIndex(([tab, item]) => tab === type && item.id === id);
      if (index >= 0) saved.splice(index, 1);
    },
    replaceGeneration: (type, id, generation) => {
      const index = saved.findIndex(([tab, item]) => tab === type && item.id === id);
      if (index < 0) saved.push([type, generation]);
      else saved[index] = [type, generation];
    },
  }) },
  normalizeCreationHistoryItem: (result) => result,
};
const dependency = new vm.SyntheticModule(Object.keys(exports), function () {
  for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
}, { context });
const module = new vm.SourceTextModule(await readFile(new URL('../src/stores/videoEditStore.js', import.meta.url), 'utf8'), { context });
await module.link(() => dependency);
await module.evaluate();
const { runVideoEdit, useVideoEditStore, videoEditKey } = module.namespace;
const source = { asset_id: 'source' };
const options = { mode: 'upscale', resolution: '1080P', duration: 4 };
const key = videoEditKey(source, 'upscale');
await runVideoEdit(source, { ...options, duration: 2 });
assert.equal(submits, 0);
assert.equal(saved.length, 0);
assert.equal(useVideoEditStore.getState().tasks[key], undefined);
let notifications = 0;
const unsubscribe = useVideoEditStore.subscribe(() => notifications++);
const job = runVideoEdit(source, options);
await new Promise(setImmediate);
assert.equal(useVideoEditStore.getState().tasks[key].busy, true);
assert.equal(saved.length, 1);
assert.equal(saved[0][1].cards[0].status, 'loading');
const placeholderId = saved[0][1].id;
unsubscribe();
const before = notifications;
await runVideoEdit(source, options);
assert.equal(submits, 1);
finish({ id: 'result', video_url: '/result.mp4' });
await job;
assert.equal(notifications, before);
assert.equal(saved.length, 1);
assert.equal(saved[0][1].id, placeholderId);
assert.equal(saved[0][1].video_url, '/result.mp4');
assert.equal(storage.size, 0);
assert.equal(useVideoEditStore.getState().tasks[key].result.video_url, '/result.mp4');
assert.equal(useVideoEditStore.getState().tasks[key].busy, false);
const second = runVideoEdit(source, options);
await new Promise(setImmediate);
fail(new Error('读取失败'));
await second;
assert.equal(useVideoEditStore.getState().tasks[key].error, '读取失败');
assert.equal(saved.length, 2);
assert.equal(saved[1][1].cards[0].status, 'error');
const retry = runVideoEdit(source, options);
await new Promise(setImmediate);
assert.equal(submits, 2);
assert.equal(reads, 3);
assert.equal(saved.length, 2);
assert.equal(saved[1][1].cards[0].status, 'loading');
finish({ id: 'result2', video_url: '/result2.mp4' });
await retry;
assert.equal(useVideoEditStore.getState().tasks[key].result.id, 'result2');
assert.equal(useVideoEditStore.getState().tasks[key].error, '');
const subtitle = runVideoEdit(source, { mode: 'subtitle_remove', duration: 4 });
await new Promise(setImmediate);
assert.equal(saved[2][1].cards[0].status, 'loading');
finish({ id: 'subtitle-result', video_url: '/subtitle.mp4' });
await subtitle;
assert.equal(saved.length, 3);
assert.equal(saved[2][1].video_url, '/subtitle.mp4');
let closed = 0;
const trimOptions = { mode: 'trim', start_time: 0, end_time: 3, duration: 4 };
await runVideoEdit({}, trimOptions, () => closed++);
await runVideoEdit(source, { ...trimOptions, duration: 0 }, () => closed++);
assert.equal(closed, 0);
assert.equal(saved.length, 3);
const trim = runVideoEdit(source, trimOptions, () => closed++);
assert.equal(closed, 1);
assert.equal(saved[3][1].cards[0].status, 'loading');
assert.equal(toasts.at(-1)[0], '正在保存剪辑片段');
await new Promise(setImmediate);
await runVideoEdit(source, trimOptions, () => closed++);
assert.equal(closed, 1);
finish({ id: 'trim-result', video_url: '/trim.mp4' });
await trim;
assert.equal(saved.length, 4);
assert.equal(saved[3][1].video_url, '/trim.mp4');
assert.equal(toasts.at(-1)[0], '剪辑片段已保存');
const trimFailure = runVideoEdit(source, trimOptions, () => closed++);
await new Promise(setImmediate);
assert.equal(saved.length, 5);
fail(Object.assign(new Error('剪辑任务失败'), { terminal: true }));
await trimFailure;
assert.equal(saved.length, 4);
assert.equal(saved[3][1].video_url, '/trim.mp4');
assert.equal(useVideoEditStore.getState().notices[0].message, '剪辑任务失败');
assert.equal(toasts.at(-1)[0], '正在保存剪辑片段');
assert.equal(useVideoEditStore.getState().tasks[videoEditKey(source, 'trim')].busy, false);
useVideoEditStore.getState().dismissNotice();
assert.equal(useVideoEditStore.getState().notices.length, 0);
console.log('后台视频任务测试通过：校验、卸载后写回、去重、恢复、剪辑即时关闭、失败移除与确认通知');

for (const mode of ['upscale', 'subtitle_remove', 'trim', 'frame_extract']) {
  const canvasSource = { ...source, canvasEditScope: 'canvas:node' };
  assert.notEqual(videoEditKey(canvasSource, mode), videoEditKey(source, mode));
  const beforeSaved = saved.length;
  const job = runVideoEdit(canvasSource, { ...options, mode, persistToCreation: false, suppressSuccessToast: true });
  await new Promise(setImmediate);
  assert.equal(saved.length, beforeSaved, '画布不创建创作页占位');
  finish({ id: `canvas-${mode}`, video_url: '/canvas.mp4', original_url: '/frame.png' });
  const result = await job;
  assert.equal(result.id, `canvas-${mode}`);
  assert.equal(saved.length, beforeSaved, '画布完成不写回创作页');
}
console.log('画布四类任务隔离和结果返回通过');
