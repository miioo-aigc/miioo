import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { assertVideoReferencePixels } from '../src/utils/VideoReferencePixels.js';
import { waitForCreationVideoImages } from '../src/api/CreationVideoReferences.js';

function imageClass(width, height, failures = 0) {
  return class {
    static calls = 0;
    naturalWidth = width;
    naturalHeight = height;
    set src(url) {
      if (!url) return;
      this.constructor.calls++;
      queueMicrotask(() => {
        if (failures-- > 0) this.onerror?.();
        else this.onload?.();
      });
    }
  };
}

test('3600万恰好允许，超过一像素也拦截', async () => {
  await assertVideoReferencePixels('/exact.png', '首帧', { ImageClass: imageClass(6000, 6000) });
  await assert.rejects(assertVideoReferencePixels('/over.png', '尾帧', { ImageClass: imageClass(36000001, 1) }), /尾帧.*超过 3600 万/);
});

test('缓存成功结果、合并并发，同地址变化以外的新图重新读取', async () => {
  const ImageClass = imageClass(100, 100);
  await Promise.all([1, 2, 3].map(() => assertVideoReferencePixels('/cache.png', '', { ImageClass })));
  await assertVideoReferencePixels('/cache.png', '', { ImageClass });
  assert.equal(ImageClass.calls, 1);
  await assertVideoReferencePixels('/changed.png', '', { ImageClass });
  assert.equal(ImageClass.calls, 2);
});

test('临时失败自动重试，持续失败不缓存，下一次可恢复', async () => {
  const ImageClass = imageClass(100, 100, 1);
  await assertVideoReferencePixels('/retry.png', '', { ImageClass });
  assert.equal(ImageClass.calls, 2);
  const RecoveringImage = imageClass(100, 100, 2);
  await assert.rejects(assertVideoReferencePixels('/recover.png', '', { ImageClass: RecoveringImage }), /无法读取/);
  await assertVideoReferencePixels('/recover.png', '', { ImageClass: RecoveringImage });
  assert.equal(RecoveringImage.calls, 3);
});

test('本地文件尺寸可复用，不同文件对象不能套用旧结果', async () => {
  const ImageClass = imageClass(100, 100);
  const file = new Blob(['image']);
  await assertVideoReferencePixels(file, '', { ImageClass });
  await assertVideoReferencePixels(file, '', { ImageClass });
  await assertVideoReferencePixels(new Blob(['image']), '', { ImageClass });
  assert.equal(ImageClass.calls, 2);
});

const validationSource = readFileSync(new URL('../src/api/VideoReferenceValidation.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/export /g, '').replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
function validator(fetcher, ImageClass) {
  return runInNewContext(validationSource + '\n({validateVideoRequestImages,collectVideoRequestImages})', {
    authFetch: fetcher, normalizeImageUrl: (url) => url,
    AbortController, DOMException, URL, setTimeout, clearTimeout,
    assertVideoReferencePixels: (source, label, options) => assertVideoReferencePixels(source, label, { ...options, ImageClass }),
    waitForCreationVideoImages: (refs, opts) => waitForCreationVideoImages(refs, { ...opts, ImageClass }),
  });
}

test('同地址原图内容版本变化重新读取尺寸', async () => {
  const ImageClass = imageClass(100, 100);
  await assertVideoReferencePixels('/version.png', '', { ImageClass, version: 'one' });
  await assertVideoReferencePixels('/version.png', '', { ImageClass, version: 'two' });
  assert.equal(ImageClass.calls, 2);
});

test('主体图、多帧图、不同资产编号均完整收集', () => {
  const refs = validator().collectVideoRequestImages({ reference_images: [{ asset_id: 'a' }, { asset_id: 'b' }],
    subjects: [{ images: ['/subject'] }], multiframe_segments: [{ key_image: '/key' }] });
  assert.equal(refs.length, 4);
});

test('详情临时失败重试一次，权限失败不重试，取消立即结束', async () => {
  let calls = 0;
  const api = validator(async () => ++calls === 1 ? Response.json({}, { status: 503 }) : Response.json({ file_url: '/ok' }), imageClass(1, 1));
  await api.validateVideoRequestImages({ first_frame_asset_id: 'a' });
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(validator(async () => { calls++; return Response.json({}, { status: 403 }); }, imageClass(1, 1))
    .validateVideoRequestImages({ first_frame_asset_id: 'a' }), /停止生成/);
  assert.equal(calls, 1);
  const controller = new AbortController();
  const pending = validator(() => new Promise(() => {}), imageClass(1, 1))
    .validateVideoRequestImages({ first_frame_asset_id: 'a' }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('详情超时重试后拦截，不无限等待', async () => {
  let calls = 0;
  await assert.rejects(validator(() => { calls++; return new Promise(() => {}); }, imageClass(1, 1))
    .validateVideoRequestImages({ first_frame_asset_id: 'a' }, { timeoutMs: 2 }), /超时.*停止生成/);
  assert.equal(calls, 2);
});

test('认证引用查原图，不用小尺寸预览，也不改生成身份', async () => {
  const data = { attachments: [{ asset_type: 'image', url: 'asset://a' }] };
  const original = JSON.stringify(data);
  const api = validator(async (url) => Response.json(url.endsWith('/groups') ? [{ id: 'g' }]
    : [{ id: 'a', asset_ref_url: 'asset://a', asset_type: 'image', source_url: '/original', preview_url: '/small' }]), imageClass(8000, 5000));
  await assert.rejects(api.validateVideoRequestImages(data), /超过 3600 万/);
  assert.equal(JSON.stringify(data), original);
});

test('真人素材兼容上游编号，音视频跳过，原图缺失不使用预览兜底', async () => {
  const data = { provider_params: { live_material: { group_id: 'g', asset_ids: ['up', 'v'] } } };
  const items = [{ id: 'a', upstream_asset_id: 'up', asset_type: 'image', source_url: '/original' }, { id: 'v', asset_type: 'video' }];
  await validator(async () => Response.json(items), imageClass(1, 1)).validateVideoRequestImages(data);
  items[0].source_url = '';
  items[0].preview_url = '/small';
  await assert.rejects(validator(async (url) => Response.json(url.endsWith('/assets/a') ? items[0] : items), imageClass(1, 1))
    .validateVideoRequestImages(data), /停止生成/);
});

test('本站受控下载读取原始文件，外域下载地址禁止携带认证', async () => {
  const calls = [];
  const api = validator(async (url) => { calls.push(url); return new Response(new Blob(['image'])); }, imageClass(1, 1));
  await api.validateVideoRequestImages({ first_frame_url: '/api/media/downloads/a' });
  assert.deepEqual(calls, ['/api/media/downloads/a']);
  await assert.rejects(api.validateVideoRequestImages({ first_frame_url: 'https://external.invalid/api/media/downloads/a' }), /不受信任/);
  assert.equal(calls.length, 1);
});

test('完整收集普通图、资产编号、首尾帧，音视频不作图片校验', () => {
  const { collectVideoRequestImages } = validator();
  const refs = collectVideoRequestImages({
    attachments: [{ asset_type: 'image', url: '/a', asset_id: 'a' }, { asset_type: 'video', url: '/v' }, { asset_type: 'audio', url: '/s' }],
    reference_images: ['/a', '/b'], reference_image_asset_ids: ['a', 'c'], first_frame_url: '/first', last_frame_asset_id: 'last',
  });
  assert.equal(refs.length, 5);
});

test('资产编号优先读取真实原图，不信任小尺寸预览；详情失败不得放行', async () => {
  const calls = [];
  const { validateVideoRequestImages } = validator(async (url) => {
    calls.push(url);
    return Response.json({ file_url: '/original.png', thumbnail_url: '/small.png' });
  }, imageClass(8000, 5000));
  await assert.rejects(validateVideoRequestImages({ attachments: [{ asset_type: 'image', asset_id: 'a', url: '/small.png' }] }), /超过 3600 万/);
  assert.deepEqual(calls, ['/api/assets/a']);
  const failed = validator(async () => Response.json({}, { status: 404 }), imageClass(1, 1));
  await assert.rejects(failed.validateVideoRequestImages({ first_frame_asset_id: 'gone' }), /停止生成/);
});

test('创作、镜头和分镜的底层接口：校验失败均不会发送生成请求', async () => {
  for (const [file, names] of [['creation.js', ['apiGenerateCreationVideo', 'apiGenerateShotVideo']], ['storyboard.js', ['apiGenerateStoryboardVideo']]]) {
    const source = readFileSync(new URL('../src/api/' + file, import.meta.url), 'utf8')
      .replace(/^import .*;$/mg, '').replace(/export /g, '').replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
    let calls = 0;
    const api = runInNewContext(source + '\n({' + names.join(',') + '})', {
      validateVideoRequestImages: async () => { throw new Error('超过 3600 万'); }, authFetch: async () => { calls++; },
    });
    for (const name of names) await assert.rejects(api[name]({}, {}, {}), /超过 3600 万/);
    assert.equal(calls, 0);
  }
});

test('合格原图在全部视频提交接口正常提交并保留绑定', async () => {
  for (const [file, names] of [['creation.js', ['apiGenerateCreationVideo', 'apiGenerateShotVideo']], ['storyboard.js', ['apiGenerateStoryboardVideo']]]) {
    const source = readFileSync(new URL('../src/api/' + file, import.meta.url), 'utf8')
      .replace(/^import .*;$/mg, '').replace(/export /g, '').replaceAll('import.meta.env.VITE_API_BASE_URL', JSON.stringify(''));
    const submissions = [];
    const validation = validator(async () => Response.json({ file_url: '/valid-original.png' }), imageClass(6000, 6000));
    const api = runInNewContext(source + String.fromCharCode(10) + '({' + names.join(',') + '})', {
      validateVideoRequestImages: validation.validateVideoRequestImages,
      authFetch: async (url, options) => {
        submissions.push({ url, body: JSON.parse(options.body), method: options.method });
        return Response.json({ task_id: 'accepted' });
      },
    });
    for (const name of names) {
      const data = { first_frame_asset_id: 'asset-original', first_frame_url: '/preview.png' };
      const result = name === 'apiGenerateCreationVideo' ? await api[name](data)
        : name === 'apiGenerateShotVideo' ? await api[name]('shot', data)
          : await api[name]('project', 'storyboard', data);
      assert.equal(result.task_id, 'accepted');
      assert.deepEqual(submissions.at(-1).body, data);
      assert.equal(submissions.at(-1).method, 'POST');
    }
    assert.equal(submissions.length, names.length);
  }
});
