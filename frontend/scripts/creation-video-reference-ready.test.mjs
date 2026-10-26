import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { waitForCreationVideoImages } from '../src/api/CreationVideoReferences.js';

class DeferredImage {
  static instances = [];
  naturalWidth = 100;
  constructor() { DeferredImage.instances.push(this); }
}

test('原图加载完成之前必须等待', async () => {
  let ready = false;
  const pending = waitForCreationVideoImages([{ url: '/uploads/image.png' }], { ImageClass: DeferredImage })
    .then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  DeferredImage.instances.at(-1).onload();
  await pending;
  assert.equal(ready, true);
});

test('加载失败、超时和取消均阻止继续', async () => {
  let pending = waitForCreationVideoImages([{ url: '/image.png' }], { ImageClass: DeferredImage });
  DeferredImage.instances.at(-1).onerror();
  await assert.rejects(pending, /加载失败/);
  await assert.rejects(waitForCreationVideoImages([{ url: '/image.png' }], { ImageClass: DeferredImage, timeoutMs: 1 }), /超时/);
  const controller = new AbortController();
  pending = waitForCreationVideoImages([{ url: '/image.png' }], { ImageClass: DeferredImage, signal: controller.signal });
  const image = DeferredImage.instances.at(-1);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(image.onload, null);
});

test('临时地址、派生预览和下载入口不能作为原图', async () => {
  for (const url of ['', 'blob:expired', 'data:image/png;base64,abc', '/a.avif?x=1', '/uploads/derived/assets/a.png', '/api/media/downloads/a']) {
    await assert.rejects(waitForCreationVideoImages([{ url }]), /可用原图/);
  }
  await waitForCreationVideoImages([{ assetId: 'asset-1' }, { url: 'asset://provider' }]);
});

const source = readFileSync(new URL('../src/utils/creationDetailAdapter.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/export /g, '');
const adapter = runInNewContext(source + '\n({normalizeCreationVideoDetailMedia,buildCreationVideoReeditPrefill})', { normalizeImageUrl: (url) => url });

test('重新编辑保留原图、预览和资产编号，清空旧首尾帧', () => {
  const media = adapter.normalizeCreationVideoDetailMedia({ asset_bindings: [
    { asset_type: 'image', asset_id: 'asset-1', url: '/original.png', preview_url: '/preview.avif' },
  ] });
  const prefill = adapter.buildCreationVideoReeditPrefill({ refMode: 'all' }, media);
  assert.equal(prefill.files[0].url, '/original.png');
  assert.equal(prefill.files[0].previewUrl, '/preview.avif');
  assert.equal(prefill.files[0].assetId, 'asset-1');
  assert.equal(prefill.firstFrameFile, null);
  assert.equal(prefill.lastFrameFile, null);
});

test('只有预览的历史素材不把预览当原图', () => {
  const media = adapter.normalizeCreationVideoDetailMedia({ asset_bindings: [
    { asset_type: 'image', preview_url: '/preview.png' },
  ] }, { preferOriginalImageUrl: true });
  const file = adapter.buildCreationVideoReeditPrefill({}, media).files[0];
  assert.equal(file.url, '');
  assert.equal(file.previewUrl, '/preview.png');
});

const apiSource = readFileSync(new URL('../src/api/creation.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/export /g, '')
  .replaceAll('import.meta.env.VITE_API_BASE_URL', JSON.stringify('https://test.invalid'));
function loadApi(fetcher, wait = async () => {}) {
  return runInNewContext(apiSource + '\n({apiGenerateCreation})', {
    authFetch: fetcher, File, FormData, URLSearchParams, URL,
    setTimeout, clearTimeout, console: { log() {}, warn() {} },
    waitForCreationVideoImages: wait, assertVideoRequestCapabilities() {},
    toAbsoluteUrl: (url) => url,
    throwResponseError: async () => { throw new Error('请求失败'); },
  });
}

test('普通参考和首尾帧上传失败或返回空地址，都不能调用生成接口', async () => {
  for (const key of ['files', 'firstFrameFile', 'lastFrameFile']) {
    for (const failure of ['http', 'empty']) {
      const calls = [];
      const api = loadApi(async (url) => {
        calls.push(url);
        return Response.json({}, { status: failure === 'http' ? 500 : 200 });
      });
      const file = new File(['png'], 'image.png', { type: 'image/png' });
      await assert.rejects(api.apiGenerateCreation({ genType: 'video', [key]: key === 'files' ? [file] : file }), /上传失败|未完整上传/);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].includes('/upload'));
    }
  }
});

test('生成请求等待原图检查，提交保留资产编号且HTTP错误直接返回失败', async () => {
  let finish;
  const calls = [];
  const api = loadApi(async (url, options) => {
    calls.push({ url, options });
    return Response.json({}, { status: 422 });
  }, () => new Promise((resolve) => { finish = resolve; }));
  const pending = api.apiGenerateCreation({ genType: 'video', files: [{ url: '/original.png', assetId: 'asset-1' }] });
  assert.equal(calls.length, 0);
  finish();
  await assert.rejects(pending, /请求失败/);
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.attachments[0].asset_id, 'asset-1');
  assert.deepEqual(body.reference_image_asset_ids, ['asset-1']);
});
