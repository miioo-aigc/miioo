import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createTestViteServer as createServer } from './lib/create-test-vite-server.mjs';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { buildCompositionBody, normalizeComposition, apiGetCompositions, apiCreateComposition } = await server.ssrLoadModule('/src/api/compositions.js');
const { serializeTimeline, formatTime, durationClampOf, useCompositionEditorStore: store } = await server.ssrLoadModule('/src/stores/compositionEditorStore.js');
const { prepareCompositionAsset } = await server.ssrLoadModule('/src/api/CompositionAssetImport.js');
const { buildInitialStoryboardTimeline } = await server.ssrLoadModule('/src/utils/InitialStoryboardTimeline.js');
const { exportProgress } = await server.ssrLoadModule('/src/stores/CompositionExportStore.js');
const { prepareOnlineEditing } = await server.ssrLoadModule('/src/api/CompositionDraftCreation.js');
const { apiCompositionPreview } = await server.ssrLoadModule('/src/api/CompositionPreview.js');

test('预览请求校验资产身份和显示比例，重建任务使用独立接口', async () => {
  const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = { getItem: () => 'test-only-token' };
  let data = { asset_id: 'video', asset_type: 'video', source_version: '1', source: { display_aspect_ratio: { num: 864, den: 496 } }, preview: { status: 'ready', url: 'https://example.test/preview.mp4', display_aspect_ratio: { num: 108, den: 62 } } };
  let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return Response.json(data); };
  try {
    await apiCompositionPreview('video');
    assert.ok(String(request.url).endsWith('/api/assets/video/composition-preview'));
    assert.equal(request.options.method, 'GET');
    await apiCompositionPreview('video', { create: true });
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.body, '{}');
    data = { ...data, asset_id: 'wrong' };
    await assert.rejects(apiCompositionPreview('video'), /元数据无效/);
    data = { ...data, asset_id: 'video', preview: { ...data.preview, display_aspect_ratio: { num: 16, den: 9 } } };
    await assert.rejects(apiCompositionPreview('video'), /比例不一致/);
  } finally { Object.assign(globalThis, previous); }
});

test('构图拖拽一次撤销、比例确认重置与旧片段兼容', () => {
  const manual = { version: 1, mode: 'manual', center_x: 0.2, center_y: 0.6, width: 1.3, height: 0.9 };
  store.setState({ ...store.getInitialState(), loaded: true, segments: [
    { id: 'old', assetId: 'old', type: 'image', duration: 3 },
    { id: 'new', assetId: 'new', type: 'video', duration: 3, visualTransform: { version: 1, mode: 'cover' } },
  ] });
  const before = store.getState();
  store.getState().previewTransform('new', manual);
  assert.equal(store.getState().past.length, 0);
  store.getState().commitTransform(before);
  assert.equal(store.getState().past.length, 1);
  assert.deepEqual(serializeTimeline(store.getState().segments)[1].visual_transform, manual);
  assert.equal('visual_transform' in serializeTimeline(store.getState().segments)[0], false);
  store.getState().requestAspectRatio('9:16');
  assert.equal(store.getState().aspectRatio, '16:9');
  store.getState().cancelAspectRatio();
  assert.equal(store.getState().segments[1].visualTransform.mode, 'manual');
  store.getState().requestAspectRatio('9:16');
  store.getState().confirmAspectRatio();
  assert.equal(store.getState().segments[1].visualTransform.mode, 'legacy_contain');
  assert.equal(store.getState().segments[0].visualTransform, undefined);
  store.getState().undo();
  assert.equal(store.getState().aspectRatio, '16:9');
  assert.deepEqual(store.getState().segments[1].visualTransform, manual);
  store.getState().undo();
  assert.equal(store.getState().segments[1].visualTransform.mode, 'cover');
  store.setState({ ...store.getInitialState() });
});

test('在线剪辑有草稿仅查询，无草稿创建一次；查询或创建失败不进入工作台', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = { getItem: (key) => key === 'token' ? 'test-only-token' : null };
  const calls = [];
  let mode = 'existing';
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (mode === 'query-error') return Response.json({ detail: '查询失败' }, { status: 500 });
    if (options.method === 'POST') {
      if (mode === 'create-error') return Response.json({ detail: '创建失败' }, { status: 500 });
      if (mode === 'missing-id') return Response.json({});
      return Response.json({ id: 'new-draft', ...JSON.parse(options.body) });
    }
    if (String(url).includes('/compositions?')) return Response.json(mode === 'existing' ? [{ id: 'existing', episode_id: 'episode' }, { id: 'other', episode_id: 'other' }] : [{ id: 'other', episode_id: 'other' }, { id: 'legacy' }]);
    return Response.json([]);
  };
  try {
    assert.deepEqual(await prepareOnlineEditing('project', 'episode'), { draft: null, skipped: 0 });
    assert.equal(calls.length, 1);
    mode = 'empty';
    const result = await prepareOnlineEditing('project', 'episode');
    assert.equal(result.draft.id, 'new-draft');
    const posts = calls.filter(({ options }) => options.method === 'POST');
    assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].options.body), { episode_id: 'episode', name: '草稿01', resolution: '1080p', aspect_ratio: '16:9' });
    mode = 'query-error';
    const count = calls.length;
    await assert.rejects(prepareOnlineEditing('project', 'episode'));
    assert.equal(calls.length, count + 1);
    for (mode of ['create-error', 'missing-id']) await assert.rejects(prepareOnlineEditing('project', 'episode'));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
  }
});

test('草稿按分集查询和过滤，创建必须持久化归属，复制沿用归属', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = { getItem: () => 'test-only-token' };
  let wrongResponse = false;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.episode_id, 'ep/2');
      return Response.json({ id: 'copy', ...body, ...(wrongResponse ? { episode_id: null } : {}) });
    }
    assert.equal(new URL(String(url), 'https://example.test').searchParams.get('episode_id'), 'ep/2');
    return Response.json([{ id: 'a', episode_id: 'ep/1' }, { id: 'b', episode_id: 'ep/2' }, { id: 'old' }]);
  };
  try {
    const drafts = await apiGetCompositions('project', 'ep/2');
    assert.deepEqual(drafts.map((item) => item.id), ['b']);
    assert.equal((await apiCreateComposition('project', { ...drafts[0], name: '副本' })).episodeId, 'ep/2');
    wrongResponse = true;
    await assert.rejects(apiCreateComposition('project', { episodeId: 'ep/2' }), /分集归属/);
    await assert.rejects(apiCreateComposition('project', {}), /分集 ID/);
    await assert.rejects(prepareOnlineEditing('project'), /选择分集/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
  }
});

test('音视频小数时长显示与源窗口上限保持精确', () => {
  assert.equal(formatTime(7.4, 1), '00:07.4');
  assert.equal(formatTime(59.96, 1), '01:00.0');
  assert.equal(formatTime(7.437, 2), '00:07.44');
  assert.equal(formatTime(59.996, 2), '01:00.00');
  assert.equal(formatTime(7.4), '00:07');
  for (const type of ['video', 'audio']) {
    store.setState({ ...store.getInitialState(), segments: [{ id: 'decimal', type, duration: 7, sourceDuration: 7.437, track: type === 'audio' ? 'A1' : 'V1' }] });
    const max = durationClampOf(store.getState().segments[0]).max;
    assert.equal(max, 7.437);
    store.getState().updateSegment('decimal', { duration: 7.43 });
    assert.equal(store.getState().segments[0].duration, 7.43);
    store.getState().updateSegment('decimal', { duration: max });
    assert.equal(store.getState().segments[0].duration, max);
    assert.equal(serializeTimeline(store.getState().segments)[0].duration, max);
  }
  store.setState({ ...store.getInitialState() });
});

test('关闭导出弹窗只隐藏 UI，真实百分比缺失不伪造', () => {
  store.setState({ ...store.getInitialState(), exportModalOpen: true, exportState: { status: 'exporting', taskId: 'task', progress: 25 } });
  store.getState().closeExport();
  assert.equal(store.getState().exportModalOpen, false);
  assert.equal(store.getState().exportState.status, 'exporting');
  assert.equal(store.getState().exportState.taskId, 'task');
  assert.equal(exportProgress({}), null);
  assert.equal(exportProgress({ progress: 0 }), 0);
  assert.equal(exportProgress({ progress_percent: 65 }), 65);
  assert.equal(exportProgress({ progress: 'bad' }), null);
  assert.equal(exportProgress({ progress: 150 }), 100);
  store.setState({ ...store.getInitialState() });
});

test('新建草稿按输入分镜顺序连续排列 V1，重复资产保留，异常素材跳过', () => {
  const video = { id: 'v', asset_type: 'video', file_url: '/v.mp4', duration: 4.5 };
  const timeline = buildInitialStoryboardTimeline([video, { ...video, id: 'b', duration: 3 },
    { ...video, asset_type: 'image' }, { ...video, duration: null }, { ...video, id: null }, video]);
  assert.deepEqual(timeline.map((item) => item.clip_id), ['v', 'b', 'v']);
  assert.deepEqual(timeline.map((item) => item.start), [0, 4.5, 7.5]);
  assert.ok(timeline.every((item) => item.track === 'V1' && item.offset === 0 && item.speed === 1));
  assert.deepEqual(buildInitialStoryboardTimeline([]), []);
});

test('创作音频仅建立草稿引用，不创建或修改项目资产', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = { getItem: (key) => key === 'token' ? 'test-only-token' : null };
  const source = { id: 'voice', project_id: null, name: '配音', asset_type: 'audio', category: 'voiceover', file_url: 'https://media.example/voice.mp3', metadata_json: { duration: 7 } };
  const writes = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method && options.method !== 'GET') writes.push({ url, options });
    return Response.json(source);
  };
  try {
    for (const project of [null, 'another-project', 'p']) {
      source.project_id = project;
      const asset = await prepareCompositionAsset({ id: source.id }, 'p', 'audio');
      assert.equal(asset.id, source.id);
      assert.equal(asset.project_id, project);
      assert.equal(asset.file_url, source.file_url);
      store.setState({ ...store.getInitialState() });
      store.getState().addAsset({ ...asset, fileUrl: asset.file_url, duration: 7 });
      assert.equal(store.getState().segments[0].sourceUrl, source.file_url);
      assert.equal(serializeTimeline(store.getState().segments)[0].clip_id, source.id);
    }
    assert.equal(writes.length, 0);
    source.is_deleted = true;
    await assert.rejects(prepareCompositionAsset({ id: source.id }, 'p', 'audio'), /不可用/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
    store.setState({ ...store.getInitialState() });
  }
});

test('移除转场后，新旧图片片段保存均显式关闭转场', () => {
  for (const transition of [undefined, 'fade', 'none']) {
    const [item] = serializeTimeline([{ id: 'image', type: 'image', assetId: 'asset', start: 0, duration: 3, transition }]);
    assert.equal(item.transition, 'none');
    assert.equal(item.duration, 3);
  }
});

test('工程字段保持 PATCH 三态并映射 snake_case', () => {
  assert.deepEqual(buildCompositionBody({}), {});
  assert.deepEqual(buildCompositionBody({ libraryAssetIds: null, trackSettings: null }), { library_asset_ids: null, track_settings: null });
  assert.deepEqual(buildCompositionBody({ libraryAssetIds: [], trackSettings: {} }), { library_asset_ids: [], track_settings: {} });
  const raw = { id: 'draft', library_asset_ids: ['b', 'a'], track_settings: { A2: { volume: 0 } } };
  const normalized = normalizeComposition(raw);
  assert.deepEqual(normalized.libraryAssetIds, ['b', 'a']);
  assert.deepEqual(normalized.trackSettings, raw.track_settings);
});

test('声音字段分类型输出，同素材多个引用保留', () => {
  const items = serializeTimeline([
    { id: 'v', type: 'video', assetId: 'a', duration: 2, hasAudio: false },
    { id: 'a', type: 'audio', assetId: 'a', duration: 2, volume: 1.555 },
    { id: 's', type: 'subtitle', duration: 2, text: '字幕' },
  ]);
  assert.equal(items[0].has_audio, false);
  assert.equal(items[1].volume, 1.56);
  assert.equal(items[1].clip_id, items[0].clip_id);
  assert.equal('clip_id' in items[2], false);
  assert.equal('volume' in items[0], false);
});

test('初始化恢复音量、原声开关、素材引用和轨道设置', async () => {
  store.setState({ ...store.getInitialState(), album: [{ id: 'asset', type: 'video', duration: 10 }] });
  await store.getState().init({ projectId: 'p', compId: 'c', compositions: [{
    id: 'c', libraryAssetIds: ['asset', 'unavailable'], trackSettings: { V2: { hidden: true, volume: 0, isMain: true }, A2: { isMain: true }, S3: { isMain: true } },
    timeline: [
      { type: 'video', clip_id: 'asset', track: 'V2', duration: 2, has_audio: false },
      { type: 'audio', clip_id: 'asset', track: 'A2', duration: 2, volume: 2 },
    ],
  }] });
  assert.equal(store.getState().segments[0].hasAudio, false);
  assert.equal(store.getState().hasDetachedAudio(store.getState().segments[0].id), true);
  assert.equal(store.getState().segments[1].volume, 2);
  assert.equal(store.getState().trackSettings.V2.hidden, true);
  assert.deepEqual(store.getState().mainTracks, { V: 'V2', A: 'A2', S: 'S3' });
  assert.deepEqual(store.getState().libraryAssetIds, ['asset', 'unavailable']);
  store.setState({ projectId: null });
});

test('素材新增与移除、轨道静音、片段音量均标记待保存', () => {
  store.setState({ ...store.getInitialState(), loaded: true });
  store.getState().addLibraryAssets([{ id: 'b' }, { id: 'a' }]);
  assert.deepEqual(store.getState().libraryAssetIds, ['b', 'a']);
  assert.equal(store.getState().dirty, true);
  store.getState().removeAsset('a');
  assert.deepEqual(store.getState().libraryAssetIds, ['b']);
  store.setState({ dirty: false });
  store.getState().setTrackSetting('A1', { volume: 0 });
  assert.equal(store.getState().dirty, true);
  store.setState({ dirty: false, segments: [{ id: 'a', type: 'audio', duration: 2 }] });
  const before = store.getState();
  store.getState().previewAudioVolume('a', 1.5);
  store.getState().commitAudioVolume(before);
  assert.equal(store.getState().dirty, true);
});

test('保存实际请求携带新字段，400 保留未保存状态与原时间线', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.localStorage = { getItem: (key) => key === 'token' ? 'test-only-token' : null };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body), method: options.method });
    return new Response(JSON.stringify({ id: 'c', name: '草稿' }), { status: 200 });
  };
  try {
    store.setState({ ...store.getInitialState(), projectId: 'p', compositionId: 'c', loaded: false,
      dirty: true, libraryAssetIds: ['asset'], trackSettings: { A1: { volume: 0 } },
      segments: [{ id: 'v', assetId: 'asset', type: 'video', duration: 2, hasAudio: false }] });
    await store.getState().save();
    assert.equal(requests[0].method, 'PATCH');
    assert.deepEqual(requests[0].body.library_asset_ids, ['asset']);
    assert.equal(requests[0].body.track_settings.A1.volume, 0);
    assert.equal(requests[0].body.timeline[0].has_audio, false);
    assert.equal(store.getState().dirty, false);
    assert.equal(store.getState().saveError, null);
    assert.equal(store.getState().saveSequence, 1);
    store.getState().setMainTrack('V1');
    assert.equal(store.getState().dirty, true);
    await store.getState().save();
    assert.equal(requests.at(-1).body.track_settings.V1.isMain, true);
    const saved = requests.at(-1).body;
    await store.getState().init({ projectId: 'p', compId: 'c', compositions: [{ id: 'c', ...saved }] });
    assert.equal(store.getState().mainTracks.V, 'V1');
    store.getState().setMainTrack('V1');
    await store.getState().save();
    assert.equal(requests.at(-1).body.track_settings.V1.isMain, false);
    await store.getState().init({ projectId: 'p', compId: 'c', compositions: [{ id: 'c', ...requests.at(-1).body }] });
    assert.deepEqual(store.getState().mainTracks, { V: null, A: null, S: null });
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: '至少需要一个图片或视频片段才能导出成片' }), { status: 400 });
    store.setState({ segments: [], dirty: true });
    await assert.rejects(store.getState().save(), /至少需要一个/);
    assert.equal(store.getState().dirty, true);
    assert.deepEqual(store.getState().segments, []);
    assert.match(store.getState().saveError, /至少需要一个/);
    assert.equal(store.getState().saving, false);
    const sequenceBeforeRetry = store.getState().saveSequence;
    globalThis.fetch = async () => Response.json({ id: 'c', name: '草稿' });
    const retry = store.getState().save();
    assert.equal(store.getState().saving, true);
    assert.equal(store.getState().saveError, null);
    await retry;
    assert.equal(store.getState().saveSequence, sequenceBeforeRetry + 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
    store.setState({ projectId: null });
  }
});


test('并发保存按顺序提交，后一次保存包含最新构图', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.localStorage = { getItem: () => 'test-only-token' };
  globalThis.window = { dispatchEvent: () => {} };
  const writes = [];
  let release;
  globalThis.fetch = async (_url, options) => {
    writes.push(JSON.parse(options.body));
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    return Response.json({ id: 'c', name: '草稿' });
  };
  try {
    store.setState({ ...store.getInitialState(), projectId: 'p', compositionId: 'c', loaded: true, dirty: true,
      segments: [{ id: 'v', assetId: 'asset', type: 'video', duration: 3, track: 'V1', visualTransform: { version: 1, mode: 'cover' } }] });
    const first = store.getState().save();
    await new Promise(resolve => setTimeout(resolve, 0));
    store.getState().updateSegment('v', { visualTransform: { version: 1, mode: 'manual', center_x: 0.5, center_y: 0.5, width: 2, height: 1 } });
    const second = store.getState().save();
    assert.equal(writes.length, 1);
    release();
    await Promise.all([first, second]);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].timeline[0].visual_transform.mode, 'cover');
    assert.equal(writes[1].timeline[0].visual_transform.mode, 'manual');
    assert.equal(store.getState().dirty, false);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
    globalThis.window = originalWindow;
    store.setState({ projectId: null, dirty: false });
  }
});

test('导出窗口可收起重开，当前工程任务完成自动弹出，其他工程不受影响', async () => {
  const { useCompositionExportStore: exports } = await server.ssrLoadModule('/src/stores/CompositionExportStore.js');
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  const previousExports = exports.getState();
  let update;
  globalThis.localStorage = { getItem: () => 'test-only-token' };
  globalThis.window = { dispatchEvent() {} };
  globalThis.fetch = async () => Response.json({ task_id: 'export-test' });
  exports.setState({ tasks: [], watch: (_record, callback) => { update = callback; } });
  store.setState({ ...store.getInitialState(), projectId: 'p', compositionId: 'c', dirty: false,
    segments: [{ id: 'v', type: 'video', duration: 3 }], save: async () => {} });
  try {
    await store.getState().startExport();
    update({ projectId: 'p', compositionId: 'c', taskId: 'export-test', status: 'exporting' });
    store.getState().closeExport();
    update({ projectId: 'p', compositionId: 'c', taskId: 'export-test', status: 'exporting', progress: 50 });
    assert.equal(store.getState().exportModalOpen, false);
    store.getState().openExport();
    assert.equal(store.getState().exportModalOpen, true);
    store.getState().closeExport();
    update({ projectId: 'p', compositionId: 'c', taskId: 'export-test', status: 'completed', assetId: 'result' });
    assert.equal(store.getState().exportModalOpen, true);
    assert.equal(store.getState().exportState.assetId, 'result');
    store.getState().closeExport();
    update({ projectId: 'p', compositionId: 'c', taskId: 'export-test', status: 'completed', assetId: 'result' });
    assert.equal(store.getState().exportModalOpen, false);
    store.setState({ compositionId: 'other' });
    update({ projectId: 'p', compositionId: 'c', taskId: 'export-test', status: 'completed' });
    assert.equal(store.getState().exportModalOpen, false);
  } finally {
    Object.assign(globalThis, original);
    exports.setState(previousExports, true);
    store.setState({ ...store.getInitialState() });
  }
});

test('旧草稿原声已关闭且独立音频已删除时恢复后仍不能分离', async () => {
  store.setState({ ...store.getInitialState(), album: [{ id: 'asset', type: 'video', duration: 10 }] });
  await store.getState().init({ projectId: 'p', compId: 'c', compositions: [{
    id: 'c', timeline: [{ type: 'video', clip_id: 'asset', duration: 2, has_audio: false }],
  }] });
  const video = store.getState().segments[0];
  assert.equal(store.getState().hasDetachedAudio(video.id), true);
  const before = store.getState().segments;
  store.getState().detachAudio(video.id);
  assert.equal(store.getState().segments, before);
  assert.equal(store.getState().buildTimeline()[0].has_audio, false);
  store.setState({ projectId: null });
});
