import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { File } from 'node:buffer';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/subject/SubjectImageActions.js', import.meta.url), 'utf8');
const factory = source.slice(source.indexOf('export function createSubjectImageActionHandlers')).replace('export ', '');
function setup(overrides = {}) {
  let current = true, images = [{ id: 'existing' }], deferred = false;
  const requests = [], toasts = [], updates = [];
  const request = (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
  const deps = {
    apiAddSubjectImageFromAsset: request, apiUploadSubjectCandidateImage: request,
    mapSubjectImageResponse: response => response, normalizeImageUrl: url => url,
    crypto: { randomUUID }, File, console: { error() {} },
  };
  const create = new Function(...Object.keys(deps), `${factory}; return createSubjectImageActionHandlers;`)(...Object.values(deps));
  const options = {
    projectId: 'project', subjectId: 'subject', uploadingAssetIdsRef: { current: new Set() },
    isCurrent: () => current, showToast: (...args) => toasts.push(args),
    setGeneratedImages: fn => { if (deferred) updates.push(fn); else images = fn(images); }, ...overrides,
  };
  return {
    upload: value => create({ ...options, generatedImages: images }).handleUpload(value), requests, toasts,
    images: () => images, locks: options.uploadingAssetIdsRef.current,
    invalidate: () => { current = false; }, defer: () => { deferred = true; },
    flush: () => updates.forEach(fn => { images = fn(images); }),
  };
}
const inputs = {
  asset: () => ({ assetId: 'asset', url: '/asset' }),
  local: () => new File(['image'], 'image.png', { type: 'image/png' }),
};

for (const [kind, input] of Object.entries(inputs)) {
  for (const outcome of ['success', 'failure', 'invalid-response', 'stale-success', 'stale-failure']) {
    test(`${kind} 上传：${outcome}`, async () => {
      const ctx = setup();
      const pending = ctx.upload(input());
      assert.equal(ctx.images().filter(image => image.uploading).length, 1);
      assert.deepEqual(ctx.requests[0].args.slice(0, 2), ['project', 'subject']);
      const before = ctx.images();
      if (outcome.startsWith('stale')) ctx.invalidate();
      if (outcome.endsWith('failure')) ctx.requests[0].reject(Error('模拟上传失败'));
      else ctx.requests[0].resolve(outcome === 'invalid-response' ? null : { id: 'saved', url: '/saved' });
      await pending;
      assert.equal(ctx.locks.size, 0);
      if (outcome.startsWith('stale')) {
        assert.equal(ctx.images(), before);
        assert.equal(ctx.toasts.length, 0);
      } else if (outcome === 'success') {
        assert.equal(ctx.images()[0].id, 'saved');
        assert.equal(ctx.images()[0].uploading, false);
      } else {
        assert.deepEqual(ctx.images(), [{ id: 'existing' }]);
        assert.equal(ctx.toasts.length, 1);
        const retry = ctx.upload(input());
        ctx.requests[1].resolve({ id: 'retry' });
        await retry;
        assert.equal(ctx.images()[0].id, 'retry');
      }
    });
  }
  test(`${kind} 会话失效后不发请求，排队的状态更新也不执行`, async () => {
    const ctx = setup();
    ctx.defer();
    const pending = ctx.upload(input());
    ctx.requests[0].resolve({ id: 'saved' });
    await pending;
    ctx.invalidate();
    ctx.flush();
    await ctx.upload(input());
    assert.deepEqual(ctx.images(), [{ id: 'existing' }]);
    assert.equal(ctx.requests.length, 1);
  });
  for (const missing of ['projectId', 'subjectId']) {
    test(`${kind} 缺少 ${missing} 不留占位`, async () => {
      const ctx = setup({ [missing]: null });
      await ctx.upload(input());
      assert.equal(ctx.requests.length, 0);
      assert.deepEqual(ctx.images(), [{ id: 'existing' }]);
      assert.equal(ctx.toasts.length, 1);
    });
  }
}

test('资产登记跨工厂去重，完成后仍拦截已添加图片', async () => {
  const ctx = setup();
  const pending = ctx.upload(inputs.asset());
  await ctx.upload(inputs.asset());
  assert.equal(ctx.requests.length, 1);
  ctx.requests[0].resolve({ id: 'saved' });
  await pending;
  await ctx.upload(inputs.asset());
  assert.equal(ctx.requests.length, 1);
});

test('并发本地上传编号独立，乱序成功和失败只影响各自占位', async () => {
  const ctx = setup();
  const first = ctx.upload(inputs.local());
  const second = ctx.upload(inputs.local());
  assert.notEqual(ctx.images()[0].id, ctx.images()[1].id);
  ctx.requests[1].resolve({ id: 'second' });
  await second;
  ctx.requests[0].reject(Error('模拟失败'));
  await first;
  assert.deepEqual(ctx.images().map(image => image.id), ['second', 'existing']);
});
