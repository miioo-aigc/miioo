import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const calls = [];
let responses = [];
let task = {};
const context = vm.createContext({ console });
const dependency = new vm.SyntheticModule(['authFetch', 'getDisplayErrorMessage', 'waitForImageEditTask', 'validateSourceAsset'], function () {
  this.setExport('authFetch', async (url, options) => {
    calls.push({ url, body: options?.body && JSON.parse(options.body) });
    assert.ok(responses.length, `未预期请求 ${url}`);
    const response = responses.shift();
    return { ok: response.status < 400, status: response.status, json: async () => response.data };
  });
  this.setExport('getDisplayErrorMessage', (data) => data.detail);
  this.setExport('waitForImageEditTask', async () => task);
  this.setExport('validateSourceAsset', (source) => { if (!source.asset_id) throw new Error('缺少源资产'); return source.asset_id; });
}, { context });
const module = new vm.SourceTextModule(await readFile(new URL('../src/api/VideoEdit.js', import.meta.url), 'utf8'), {
  context, initializeImportMeta(meta) { meta.env = { VITE_API_BASE_URL: '' }; },
});
await module.link(() => dependency);
await module.evaluate();
const { videoEditPayload, submitVideoEdit, resolveVideoEdit } = module.namespace;
for (const [resolution, minimum, model] of [['1080P', 3, 'happyhorse-1.0-video-edit'], ['4K', 2, 'doubao-seedance-2.0']]) {
  assert.throws(() => videoEditPayload({ mode: 'upscale', resolution, duration: minimum - 0.001 }), /至少/);
  assert.throws(() => videoEditPayload({ mode: 'upscale', resolution, duration: NaN }), /时长/);
  assert.equal(videoEditPayload({ mode: 'upscale', resolution, duration: minimum }).body.model, model);
}
assert.throws(() => videoEditPayload({ mode: 'subtitle_remove' }), /暂未接入/);
assert.throws(() => videoEditPayload({ mode: 'upscale', resolution: '2K', duration: 5 }), /1080P/);
assert.throws(() => videoEditPayload({ mode: 'trim', start_time: 0, end_time: 0.09, duration: 4 }), /0.1/);
assert.throws(() => videoEditPayload({ mode: 'trim', start_time: 0, end_time: 5, duration: 4 }), /超出/);
assert.throws(() => videoEditPayload({ mode: 'trim', start_time: 0, end_time: 601, duration: 700 }), /600/);
assert.equal(videoEditPayload({ mode: 'trim', start_time: 0.2, end_time: 0.3, duration: 4 }).body.end_time, 0.3);
const source = { asset_id: 'source' };
await assert.rejects(submitVideoEdit(source, { mode: 'upscale', resolution: '1080P', duration: 2 }), /至少/);
assert.equal(calls.length, 0);
responses = [{ status: 201, data: { id: 'frame', original_url: '/frame.png' } }];
const frame = await submitVideoEdit(source, { mode: 'frame_extract', timestamp: 1.234 });
assert.equal(calls[0].url, '/api/creation/videos/source/extract-frame');
assert.equal(JSON.stringify(calls[0].body), JSON.stringify({ timestamp: 1.234, format: 'png' }));
assert.equal((await resolveVideoEdit(frame, 'frame_extract')).asset_id, 'frame');
task = { status: 'completed', resource_ids: ['video'] };
responses = [{ status: 200, data: { id: 'video', video_url: '/video.mp4' } }];
assert.equal((await resolveVideoEdit({ task_id: 'task' }, 'upscale')).asset_id, 'video');
assert.equal(calls.at(-1).url, '/api/creation/videos/video');
await assert.rejects(resolveVideoEdit({ id: 'missing-url' }, 'trim'), /缺少/);
responses = [{ status: 503, data: { detail: '任务编排未开启' } }];
await assert.rejects(submitVideoEdit(source, { mode: 'upscale', resolution: '4K', duration: 4 }), /任务编排/);
const frameSource = await readFile(new URL('../src/components/video-edit/VideoFrameModal.jsx', import.meta.url), 'utf8');
assert.match(frameSource, /onClick=\{download\}/);
assert.match(frameSource, /mode: 'frame_extract', timestamp: times\[index\]/);
assert.doesNotMatch(frameSource, /new File|onPrepare|exportFrame/);
console.log('视频编辑测试通过：时长门槛、模型、剪辑边界、抽帧参数、异步回读、失败响应、下载与保存分离');
