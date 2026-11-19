import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  acceptCanvasAudioSubmission,
  beginCanvasAudioGeneration,
  finishCanvasAudioGeneration,
  planCanvasAudioGeneration,
} from '../src/components/canvas/CanvasAudioGeneration.js';
import {
  acceptCanvasVideoSubmission,
  applyCanvasVideoResult,
  beginCanvasVideoGeneration,
  getCanvasGeneratedVideoAsset,
  planCanvasVideoGeneration,
  recoverCanvasVideoGenerationFailure,
} from '../src/components/canvas/CanvasVideoGeneration.js';
import { createCanvasTextRequests } from '../src/components/canvas/CanvasTextRequests.js';

const VIDEO_HOOK_SOURCE = readFileSync(
  new URL('../src/components/canvas/UseCanvasVideoGeneration.js', import.meta.url),
  'utf8',
);
const AUDIO_HOOK_SOURCE = readFileSync(
  new URL('../src/components/canvas/UseCanvasAudioGeneration.js', import.meta.url),
  'utf8',
);
const VIDEO_ASSET_ID = '11111111-1111-4111-8111-111111111111';
const AUDIO_ASSET_ID = '22222222-2222-4222-8222-222222222222';
const OLD_VIDEO_ASSET_ID = '33333333-3333-4333-8333-333333333333';
const OLD_AUDIO_ASSET_ID = '44444444-4444-4444-8444-444444444444';

function loadHook(source, exportName, generation, overrides = {}) {
  const calls = { api: 0, accepted: 0, assets: [], toasts: [] };
  let latestNodes = [];
  let activeRequests = 0;
  const requestFactory = () => {
    const requests = createCanvasTextRequests();
    const start = requests.start;
    const finish = requests.finish;
    requests.start = (...args) => { activeRequests += 1; return start(...args); };
    requests.finish = (...args) => { activeRequests -= 1; return finish(...args); };
    return requests;
  };
  const setNodes = (update, options) => {
    const current = latestNodes;
    latestNodes = update(current);
    if (options?.origin !== 'system') throw new Error('媒体生成写入必须标记为 system');
    return latestNodes !== current;
  };
  const dependencies = {
    useCallback: (fn) => fn,
    useEffect: () => {},
    useState: (initial) => [initial()],
    createCanvasTextRequests: requestFactory,
    createCanvasProgressHandler: () => () => {},
    dispatchCanvasAssetsChanged: (canvasId) => calls.assets.push(canvasId),
    showGlobalToast: (...args) => calls.toasts.push(args),
    ...generation,
    ...overrides,
  };
  const body = source
    .slice(source.indexOf(`export function ${exportName}`))
    .replace('export function', 'function');
  const hook = new Function(...Object.keys(dependencies), `${body}; return ${exportName};`)(...Object.values(dependencies));
  return {
    calls,
    hook,
    setNodes,
    setLatest(nodes) { latestNodes = nodes; },
    getLatest() { return latestNodes; },
    getActiveRequests() { return activeRequests; },
  };
}

function videoNode() {
  return {
    id: 'video-node',
    type: 'video',
    position: { x: 0, y: 0 },
    data: {
      asset: {
        asset_id: OLD_VIDEO_ASSET_ID,
        asset_type: 'video',
        url: '/old.mp4',
      },
      pendingCanvasUpload: null,
      videoCapabilities: {
        supported_generation_modes: ['text_to_video'],
        generation_reference_mode_map: { text_to_video: 'text_to_video' },
      },
      generationMode: 'text_to_video',
    },
  };
}

function audioNode() {
  return {
    id: 'audio-node',
    type: 'audio',
    position: { x: 0, y: 0 },
    data: {
      asset: {
        asset_id: OLD_AUDIO_ASSET_ID,
        asset_type: 'audio',
        url: '/old.mp3',
      },
    },
  };
}

function createVideoHarness(apiGenerateCreation) {
  const generation = {
    acceptCanvasVideoSubmission,
    applyCanvasVideoResult,
    beginCanvasVideoGeneration,
    getCanvasGeneratedVideoAsset,
    planCanvasVideoGeneration,
    recoverCanvasVideoGenerationFailure,
  };
  return loadHook(VIDEO_HOOK_SOURCE, 'useCanvasVideoGeneration', generation, { apiGenerateCreation });
}

function createAudioHarness(apiGenerateCreation) {
  const generation = {
    acceptCanvasAudioSubmission,
    beginCanvasAudioGeneration,
    finishCanvasAudioGeneration,
    planCanvasAudioGeneration,
  };
  return loadHook(AUDIO_HOOK_SOURCE, 'useCanvasAudioGeneration', generation, { apiGenerateCreation });
}

test('视频 Hook 在缺会话时零请求零锁，稳定结果写回后只刷新一次', async () => {
  let handler;
  const harness = createVideoHarness(async (params, options) => handler(params, options));
  handler = async (params, options) => {
    harness.calls.api += 1;
    assert.equal(params.session_id, 'creation-session');
    assert.equal(params.project_id, 'canvas-project-1');
    options.onTaskCreated({ taskIds: ['video-task'] });
    return { videos: ['/result.mp4'], videoAssetIds: [VIDEO_ASSET_ID] };
  };
  const initial = [videoNode()];
  harness.setLatest(initial);
  const generate = harness.hook(initial, harness.setNodes, () => {}, '', 'canvas-1');
  await generate({ nodeId: 'video-node', prompt: '生成视频', model: 'video-model' });
  assert.equal(harness.calls.api, 0);
  assert.equal(harness.getLatest(), initial);
  assert.equal(harness.getActiveRequests(), 0);
  assert.deepEqual(harness.calls.toasts, [['创作会话尚未加载，请稍后重试', 'error']]);

  const generateWithSession = harness.hook(initial, harness.setNodes, () => {}, 'creation-session', 'canvas-1', 'canvas-project-1');
  await generateWithSession({ nodeId: 'video-node', prompt: '生成视频', model: 'video-model' });
  assert.equal(harness.calls.api, 1);
  assert.equal(harness.getLatest()[0].data.asset.asset_id, VIDEO_ASSET_ID);
  assert.equal(harness.getLatest()[0].data.generating, false);
  assert.deepEqual(harness.calls.assets, ['canvas-1']);
  assert.equal(harness.getActiveRequests(), 0);
});

test('视频迟到结果在节点删除后不复活、不刷新，失败恢复运行锁', async () => {
  let dropNode = false;
  const harness = createVideoHarness(async () => {
    harness.calls.api += 1;
    if (dropNode) harness.setLatest([]);
    return { videos: ['/late.mp4'], videoAssetIds: [VIDEO_ASSET_ID] };
  });
  const initial = [videoNode()];
  harness.setLatest(initial);
  const generate = harness.hook(initial, harness.setNodes, () => {}, 'creation-session', 'canvas-1');
  dropNode = true;
  await generate({ nodeId: 'video-node', prompt: '迟到视频', model: 'video-model' });
  assert.deepEqual(harness.getLatest(), []);
  assert.deepEqual(harness.calls.assets, []);

  const failing = [videoNode()];
  const failureHarness = createVideoHarness(async () => {
    failureHarness.calls.api += 1;
    throw new Error('上游失败');
  });
  failureHarness.setLatest(failing);
  const failGenerate = failureHarness.hook(failing, failureHarness.setNodes, () => {}, 'creation-session', 'canvas-1');
  await failGenerate({ nodeId: 'video-node', prompt: '失败视频', model: 'video-model' });
  const recovered = failureHarness.getLatest()[0];
  assert.equal(failureHarness.calls.api, 1);
  assert.equal(recovered.data.asset.asset_id, OLD_VIDEO_ASSET_ID);
  assert.equal(recovered.data.generating, false);
  assert.equal(recovered.data.submissionLocked, false);
  assert.deepEqual(failureHarness.calls.assets, []);
  assert.equal(failureHarness.getActiveRequests(), 0);
  assert.match(failureHarness.calls.toasts.at(-1)[0], /视频创作失败：上游失败/);
});

test('视频计划和启动异常被 Hook 消化，不产生二次异常或占用请求锁', async () => {
  const harness = createVideoHarness(async () => {
    harness.calls.api += 1;
    return { videos: ['/unexpected.mp4'], videoAssetIds: [VIDEO_ASSET_ID] };
  });
  const invalid = [{ id: 'missing-target', type: 'image', data: {} }];
  harness.setLatest(invalid);
  const generate = harness.hook(invalid, harness.setNodes, () => {}, 'creation-session', 'canvas-1');
  await assert.doesNotReject(generate({ nodeId: 'video-node', prompt: '生成视频', model: 'video-model' }));
  assert.equal(harness.calls.api, 0);
  assert.equal(harness.getLatest(), invalid);
  assert.equal(harness.getActiveRequests(), 0);
  assert.match(harness.calls.toasts.at(-1)[0], /视频节点已不存在/);
});

test('音频 Hook 把所属项目与创作会话带入请求，结果稳定写入后只刷新一次', async () => {
  const harness = createAudioHarness(async (params, options) => {
    harness.calls.api += 1;
    assert.equal(params.session_id, 'creation-session');
    assert.equal(params.project_id, 'canvas-project-1');
    options.onTaskCreated({ taskIds: ['audio-task'] });
    return { audios: ['/result.mp3'], audioAssetIds: [AUDIO_ASSET_ID] };
  });
  const initial = [audioNode()];
  harness.setLatest(initial);
  const generate = harness.hook(initial, harness.setNodes, () => {}, 'creation-session', 'canvas-1', 'canvas-project-1');
  await generate({ nodeId: 'audio-node', prompt: '生成音频', model: 'audio-model' });
  assert.equal(harness.calls.api, 1);
  assert.equal(harness.getLatest()[0].data.asset.asset_id, AUDIO_ASSET_ID);
  assert.deepEqual(harness.calls.assets, ['canvas-1']);
  assert.equal(harness.getActiveRequests(), 0);
});

test('音频 Hook 缺会话零请求零锁，迟到结果不刷新，失败恢复原结果', async () => {
  let dropNode = false;
  let shouldFail = false;
  const harness = createAudioHarness(async () => {
    harness.calls.api += 1;
    if (shouldFail) throw new Error('音频上游失败');
    if (dropNode) harness.setLatest([]);
    return { audios: ['/late.mp3'], audioAssetIds: [AUDIO_ASSET_ID] };
  });
  const initial = [audioNode()];
  harness.setLatest(initial);
  const generate = harness.hook(initial, harness.setNodes, () => {}, '', 'canvas-1');
  await generate({ nodeId: 'audio-node', prompt: '生成音频', model: 'audio-model' });
  assert.equal(harness.calls.api, 0);
  assert.equal(harness.getActiveRequests(), 0);
  assert.equal(harness.getLatest(), initial);

  const withSession = harness.hook(initial, harness.setNodes, () => {}, 'creation-session', 'canvas-1');
  dropNode = true;
  await withSession({ nodeId: 'audio-node', prompt: '迟到音频', model: 'audio-model' });
  assert.deepEqual(harness.getLatest(), []);
  assert.deepEqual(harness.calls.assets, []);

  const failing = [audioNode()];
  harness.setLatest(failing);
  const failureHook = harness.hook(failing, harness.setNodes, () => {}, 'creation-session', 'canvas-1');
  shouldFail = true;
  await failureHook({ nodeId: 'audio-node', prompt: '失败音频', model: 'audio-model' });
  const recovered = harness.getLatest()[0];
  assert.equal(recovered.data.asset.asset_id, OLD_AUDIO_ASSET_ID);
  assert.equal(recovered.data.generating, false);
  assert.equal(recovered.data.submissionLocked, false);
  assert.deepEqual(harness.calls.assets, []);
  assert.equal(harness.getActiveRequests(), 0);
  assert.match(harness.calls.toasts.at(-1)[0], /音频创作失败：音频上游失败/);
});

test('音频计划和请求异常不会向调用方二次抛出，零锁返回', async () => {
  const harness = createAudioHarness(async () => {
    harness.calls.api += 1;
    throw new Error('不应调用');
  });
  const invalid = [{ id: 'audio-node', type: 'audio', data: { generating: true } }];
  harness.setLatest(invalid);
  const generate = harness.hook(invalid, harness.setNodes, () => {}, 'creation-session', 'canvas-1');
  await assert.doesNotReject(generate({ nodeId: 'audio-node', prompt: '生成音频', model: 'audio-model' }));
  assert.equal(harness.calls.api, 0);
  assert.equal(harness.getLatest(), invalid);
  assert.equal(harness.getActiveRequests(), 0);
  assert.match(harness.calls.toasts.at(-1)[0], /正在执行|任务保护/);
});
