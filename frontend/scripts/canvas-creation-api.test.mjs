import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const apiSource = readFileSync(new URL('../src/api/creation.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/export /g, '')
  .replaceAll('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://test.invalid'));
const assetA = '10000000-0000-0000-0000-000000000001';
const assetB = '20000000-0000-0000-0000-000000000001';
const plain = (value) => JSON.parse(JSON.stringify(value));
const success = (id, assetId) => ({ status: 'completed', images: [{
  id, asset_id: assetId, preview_url: `/${id}.webp`,
  original_url: `/${id}.png`, download_url: `/${id}/download`,
}] });
const failed = { status: 'failed', error_msg: '任务生成失败' };
const quotaFailed = {
  status: 'failed',
  error_msg: 'OneLinkAI API Key 无效或已失效',
  error: {
    code: 'UPSTREAM_AUTH_INVALID',
    message: '预扣费额度失败, 用户剩余额度: ¥0.009536, 需要预扣费额度: ¥0.100000',
  },
};

function loadApi({ taskIds = ['first', 'second'], polls = {}, imageDetails = {}, onTimer } = {}) {
  const calls = [], timers = new Map();
  let timerId = 0;
  const api = runInNewContext(apiSource + ';({apiGenerateCreation})', {
    File, FormData, URLSearchParams, URL,
    console: { log() {}, warn() {} },
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, callback);
      queueMicrotask(() => {
        onTimer?.();
        const run = timers.get(id);
        timers.delete(id);
        run?.();
      });
      assert.equal(delay, 3000);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    authFetch: async (url, options = {}) => {
      calls.push({ url, options });
      const path = new URL(url).pathname;
      if (path === '/api/creation/images/generate') return Response.json({ task_ids: taskIds });
      if (path === '/api/creation/videos/generate') return Response.json({ task_id: taskIds[0] });
      if (path.startsWith('/api/creation/images/')) {
        const imageId = decodeURIComponent(path.split('/').at(-1));
        assert.ok(Object.hasOwn(imageDetails, imageId), `未预期的图片详情请求：${path}`);
        const response = typeof imageDetails[imageId] === 'function'
          ? await imageDetails[imageId](options)
          : imageDetails[imageId];
        return response instanceof Response ? response : Response.json(response);
      }
      const taskId = path.split('/').at(-1);
      assert.ok(Object.hasOwn(polls, taskId), `未预期的请求：${path}`);
      const response = typeof polls[taskId] === 'function' ? await polls[taskId](options) : polls[taskId];
      return response instanceof Response ? response : Response.json(response);
    },
    buildImageReferences: async () => ({ reference_images: [], attachments: [] }),
    assertImageReferenceUrls() {}, validateVideoRequestImages: async () => {},
    assertVideoReferencePixels: async () => {}, assertVideoRequestCapabilities() {},
    toAbsoluteUrl: (url) => url, getSeedance20AudioReferenceErrorMessage: () => '',
    throwResponseError: async (response) => {
      throw Object.assign(new Error(`请求失败（${response.status}）`), { status: response.status });
    },
  });
  return { ...api, calls, timers };
}

test('画布部分成功按任务顺序保留全部结果列的空位及永久资产编号', async () => {
  const api = loadApi({ taskIds: ['first', 'second', 'third'], polls: {
    first: success('card-a', assetA), second: failed, third: success('card-b', assetB),
  } });
  const result = await api.apiGenerateCreation({ genType: 'image', count: 3, canvasPartialResults: true });
  assert.deepEqual(plain(result.images), ['/card-a.webp', null, '/card-b.webp']);
  assert.deepEqual(plain(result.imageOriginalUrls), ['/card-a.png', null, '/card-b.png']);
  assert.deepEqual(plain(result.imageDownloadUrls), ['/card-a/download', null, '/card-b/download']);
  assert.deepEqual(plain(result.cardIds), ['card-a', null, 'card-b']);
  assert.deepEqual(plain(result.imageAssetIds), [assetA, null, assetB]);
  const body = JSON.parse(api.calls[0].options.body);
  assert.equal(body.image_count, 3);
  assert.equal(Object.hasOwn(body, 'canvasPartialResults'), false);
  assert.equal(api.calls.length, 4);
  assert.equal(api.timers.size, 0);
});

test('图片任务终态缺少永久资产编号时按记录 ID 补查详情', async () => {
  const api = loadApi({
    taskIds: ['first'],
    polls: {
      first: {
        status: 'completed',
        images: [{ id: 'card-without-asset', original_url: '/generated.png' }],
      },
    },
    imageDetails: {
      'card-without-asset': {
        id: 'card-without-asset',
        asset_id: assetB,
        original_url: '/generated.png',
      },
    },
  });
  const result = await api.apiGenerateCreation({ genType: 'image', count: 1 });
  assert.deepEqual(plain(result.imageAssetIds), [assetB]);
  assert.deepEqual(plain(result.cardIds), ['card-without-asset']);
  assert.equal(api.calls.filter(({ url }) => url.endsWith('/api/creation/images/card-without-asset')).length, 1);
});

test('图片详情补查失败只将当前结果留空，其他成功结果仍可保存', async () => {
  const api = loadApi({
    polls: {
      first: {
        status: 'completed',
        images: [{ id: 'detail-failed', original_url: '/failed-detail.png' }],
      },
      second: success('card-ok', assetA),
    },
    imageDetails: {
      'detail-failed': Response.json({ detail: '详情暂不可用' }, { status: 503 }),
    },
  });
  const result = await api.apiGenerateCreation({
    genType: 'image',
    count: 2,
    canvasPartialResults: true,
  });
  assert.deepEqual(plain(result.images), ['/failed-detail.png', '/card-ok.webp']);
  assert.deepEqual(plain(result.imageAssetIds), [null, assetA]);
  assert.deepEqual(plain(result.cardIds), ['detail-failed', 'card-ok']);
});

test('已有合法永久资产编号时不再请求图片详情', async () => {
  const api = loadApi({ taskIds: ['first'], polls: { first: success('card-with-asset', assetA) } });
  const result = await api.apiGenerateCreation({ genType: 'image', count: 1 });
  assert.deepEqual(plain(result.imageAssetIds), [assetA]);
  assert.equal(api.calls.filter(({ url }) => url.endsWith('/api/creation/images/card-with-asset')).length, 0);
});

test('图片详情补查遇到鉴权失败时向上报错，不伪装成缺失结果', async () => {
  const api = loadApi({
    taskIds: ['first'],
    polls: {
      first: {
        status: 'completed',
        images: [{ id: 'detail-forbidden', original_url: '/generated.png' }],
      },
    },
    imageDetails: {
      'detail-forbidden': Response.json({ detail: '无权读取图片详情' }, { status: 403 }),
    },
  });
  await assert.rejects(
    api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true }),
    (error) => error.status === 403 && error.message === '请求失败（403）',
  );
});

test('画布全部任务失败时透传第一个任务错误', async () => {
  const api = loadApi({ polls: { first: failed, second: failed } });
  await assert.rejects(
    api.apiGenerateCreation({ genType: 'image', count: 2, canvasPartialResults: true }),
    (error) => error.message === '任务生成失败'
      && error.rawMessage === '任务生成失败'
      && error.taskFailed === true,
  );
});

test('任务完成但没有图片并伴随任务失败时仍透传真实任务错误', async () => {
  const api = loadApi({ polls: {
    first: { status: 'completed', images: [] },
    second: failed,
  } });
  await assert.rejects(
    api.apiGenerateCreation({ genType: 'image', count: 2, canvasPartialResults: true }),
    (error) => error.message === '任务生成失败' && error.taskFailed === true,
  );
});

test('临时图片结果不能掩盖另一任务的余额不足错误', async () => {
  const api = loadApi({
    polls: {
      first: { status: 'completed', images: [{
        id: 'temporary-image', original_url: '/temporary.png',
      }] },
      second: quotaFailed,
    },
    imageDetails: {
      'temporary-image': { id: 'temporary-image', original_url: '/temporary.png' },
    },
  });
  await assert.rejects(
    api.apiGenerateCreation({ genType: 'image', count: 2, canvasPartialResults: true }),
    (error) => error.taskFailed === true
      && error.code === 'UPSTREAM_AUTH_INVALID'
      && error.message === 'OneLinkAI 账户余额不足（当前余额 ¥0.009536，本次至少需要 ¥0.100000），请充值或调整可用额度后重试'
      && error.rawMessage.includes('预扣费额度失败'),
  );
});

test('嵌套任务错误也能提取为可执行提示', async () => {
  const api = loadApi({ taskIds: ['first'], polls: {
    first: {
      status: 'failed',
      error: {
        code: 'UPSTREAM_AUTH_INVALID',
        detail: { message: 'OneLinkAI API Key 无效或已失效' },
      },
    },
  } });
  await assert.rejects(
    api.apiGenerateCreation({ genType: 'image', count: 1, canvasPartialResults: true }),
    (error) => error.taskFailed === true
      && error.code === 'UPSTREAM_AUTH_INVALID'
      && error.message === 'OneLinkAI API Key 无效或已失效，请在 API 配置中更新后重试',
  );
});

test('完成任务只有原图地址时仍按部分成功返回', async () => {
  const api = loadApi({ polls: {
    first: { status: 'completed', images: [{
      id: 'original-only', asset_id: assetA, original_url: '/original-only.png',
    }] },
    second: failed,
  } });
  const result = await api.apiGenerateCreation({ genType: 'image', count: 2, canvasPartialResults: true });
  assert.deepEqual(plain(result.images), ['/original-only.png', null]);
  assert.deepEqual(plain(result.imageDownloadUrls), ['/original-only.png', null]);
  assert.deepEqual(plain(result.imageOriginalUrls), ['/original-only.png', null]);
  assert.deepEqual(plain(result.imageAssetIds), [assetA, null]);
});

test('默认入口和显式关闭部分结果时，单任务失败仍使整个调用失败', async () => {
  for (const options of [{}, { canvasPartialResults: false }]) {
    const api = loadApi({ polls: { first: success('card-a', assetA), second: failed } });
    await assert.rejects(api.apiGenerateCreation({ genType: 'image', count: 2, ...options }), /任务生成失败/);
  }
});

test('启用部分结果也不得吞掉请求抛出的取消错误', async () => {
  const error = Object.assign(new Error('请求取消'), { name: 'AbortError', taskFailed: true });
  const api = loadApi({ polls: { first: success('card-a', assetA), second: () => { throw error; } } });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true }),
    (actual) => actual === error);
});

test('部分结果模式不得把鉴权和不可重试的请求错误降为空位', async () => {
  for (const status of [401, 403, 404]) {
    const api = loadApi({ polls: {
      first: success('card-a', assetA),
      second: Response.json({ detail: '请求被拒绝' }, { status }),
    } });
    await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true }),
      (error) => error.status === status && error.message === '请求被拒绝' && !error.taskFailed);
    assert.equal(api.timers.size, 0);
  }
});

test('部分结果模式继续抛出未标记为任务失败的普通请求异常', async () => {
  const error = new Error('请求处理异常');
  const api = loadApi({ taskIds: ['first'], polls: { first: () => { throw error; } } });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true }),
    (actual) => actual === error);
});

test('部分结果模式不得吞掉进度回调异常，保留原错误对象', async () => {
  const error = new Error('进度回调异常');
  const api = loadApi({ taskIds: ['first'], polls: { first: success('card-a', assetA) } });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true },
    { onProgress: () => { throw error; } }), (actual) => actual === error);
});

test('部分结果模式不得把结果提取异常误判为任务失败', async () => {
  const api = loadApi({ taskIds: ['first'], polls: {
    first: { status: 'completed', images: {} },
  } });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true }),
    (error) => error.name === 'TypeError' && !error.taskFailed);
});

test('信号取消轮询等待会整体拒绝并清理模拟计时器', async () => {
  const controller = new AbortController();
  const api = loadApi({ onTimer: () => controller.abort() });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true },
    { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(api.calls.length, 1);
  assert.equal(api.timers.size, 0);
});

test('已取消的信号不提交请求，信号取消后的普通错误也不能变成空位', async () => {
  const controller = new AbortController();
  controller.abort();
  const before = loadApi();
  await assert.rejects(before.apiGenerateCreation({ genType: 'image', canvasPartialResults: true },
    { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(before.calls.length, 0);
  const during = new AbortController();
  const api = loadApi({ taskIds: ['first'], polls: { first: () => {
    during.abort();
    throw new Error('取消后读取失败');
  } } });
  await assert.rejects(api.apiGenerateCreation({ genType: 'image', canvasPartialResults: true },
    { signal: during.signal }), /取消后读取失败/);
});

test('视频资产编号独立于卡片编号，兼容两种字段且缺失时不伪造', async () => {
  for (const fields of [{ asset_id: assetA }, { assetId: assetB }, {}, { asset_id: assetA, assetId: assetB }]) {
    const api = loadApi({ taskIds: ['video-task'], polls: {
      'video-task': { status: 'completed', result: { id: 'creation-card', video_url: '/movie.mp4', ...fields } },
    } });
    const result = await api.apiGenerateCreation({ genType: 'video' });
    assert.deepEqual(plain(result.videos), ['/movie.mp4']);
    assert.deepEqual(plain(result.cardIds), ['creation-card']);
    assert.deepEqual(plain(result.videoAssetIds), [fields.asset_id || fields.assetId || null]);
    assert.equal(api.calls.length, 2);
  }
});

test('视频缺少结果或视频地址时三列结果均为空数组', async () => {
  for (const fields of [{}, { result: null }, { result: {} },
    { result: { id: 'creation-card', asset_id: assetA } },
    { result: { id: 'creation-card', asset_id: assetA, video_url: '' } }]) {
    const api = loadApi({ taskIds: ['video-task'], polls: {
      'video-task': { status: 'completed', ...fields },
    } });
    const result = await api.apiGenerateCreation({ genType: 'video' });
    for (const key of ['videos', 'cardIds', 'videoAssetIds']) {
      assert.deepEqual(plain(result[key]), [], key);
    }
    assert.equal(api.calls.length, 2);
    assert.equal(api.timers.size, 0);
  }
});
