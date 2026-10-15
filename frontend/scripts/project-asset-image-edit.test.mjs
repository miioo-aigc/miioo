import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as policy from '../src/utils/MediaEditPolicy.js';
import { buildImageEditRequest, validateSourceAsset } from '../src/utils/MediaEditRequest.js';

const context = vm.createContext({});
const unexpectedRequest = () => { throw new Error('测试不应发起网络请求'); };
const imports = {
  './request.js': { authFetch: unexpectedRequest },
  './error.js': { throwResponseError: unexpectedRequest },
  './request': { authFetch: unexpectedRequest },
  '../utils/imageUrl.js': { normalizeImageUrl: (url) => url },
  '../utils/MediaEditPolicy.js': policy,
  '../utils/MediaEditPolicy': policy,
  './storyboard.js': { apiGetStoryboards: unexpectedRequest, apiListStoryboardMediaCandidates: unexpectedRequest },
  '../utils/cache.js': { cached: unexpectedRequest, invalidate: unexpectedRequest },
  '../utils/cacheKeys.js': { K: {}, TTL: {}, MEDIUM: {} },
  '../utils/responseBlobProgress': { readResponseBlobWithProgress: unexpectedRequest },
  './ImageEditTasks': { waitForImageEditTask: unexpectedRequest },
};
async function loadModule(path) {
  const module = new vm.SourceTextModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    context, initializeImportMeta: (meta) => { meta.env = { VITE_API_BASE_URL: '' }; },
  });
  await module.link((name) => {
    assert.ok(imports[name], `缺少依赖：${name}`);
    return new vm.SyntheticModule(Object.keys(imports[name]), function () {
      for (const [key, value] of Object.entries(imports[name])) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}
const { groupByCategory } = await loadModule('../src/api/assets.js');
const { apiPrepareEditSource } = await loadModule('../src/api/ImageEdit.js');

test('主体列表实际详情映射保留候选图资产编号及本地云端编辑身份', async () => {
  const source = await readFile(new URL('../src/components/subject/SubjectImageList.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const images = generatedImages.filter');
  const end = source.indexOf('\n\n  return (', start);
  assert.ok(start >= 0 && end > start);
  const generatedImages = [
    { id: 'candidate-record', assetId: 'candidate-asset', url: '/preview.png', rawUrl: '/original.png' },
    { id: 'local-edit-record', creationAssetId: 'edited-asset', backendId: 'edited-asset', localEdit: true, url: '/edited.png' },
    { id: 'candidate-without-asset', url: '/missing.png' },
  ];
  const images = vm.runInNewContext(`${source.slice(start, end)}; images;`, {
    generatedImages, promptText: '', selectedModel: '', selectedRatio: '', selectedResolution: '',
  });
  for (const [index, expected] of [[0, 'candidate-asset'], [1, 'edited-asset']]) {
    const card = { ...images[index], imageUrl: images[index].fileUrl ?? images[index].url };
    assert.equal(buildImageEditRequest(card, { mode: 'crop' }).source_asset_id, expected);
    assert.equal((await apiPrepareEditSource(card)).id, expected);
  }
  assert.equal(images[0].id, 'candidate-record');
  assert.equal(images[1].localEdit, true);
  assert.throws(() => validateSourceAsset(images[2]), /真实源资产编号/);
});

for (const [category, tab] of [['character', 'chars'], ['scene', 'scenes'], ['prop', 'props']]) {
  test(`${category} 图片经分组和详情透传后可构造裁剪请求`, async () => {
    const grouped = groupByCategory([{
      id: 'asset-original', category, asset_type: 'image', subject_id: 'subject-one',
      file_url: '/uploads/original.png', name: '主体',
    }]);
    const image = grouped[tab][0].images[0];
    const card = { ...image, imageUrl: image.fileUrl ?? image.url };
    assert.equal(card.id, 'asset-original');
    assert.equal(card.asset_id, 'asset-original');
    assert.equal(buildImageEditRequest(card, { mode: 'crop' }).source_asset_id, 'asset-original');
    assert.equal((await apiPrepareEditSource(card)).id, 'asset-original');
  });
}

test('切换主体候选图片时使用各自的资产编号，不使用主体或定稿图编号', () => {
  const images = groupByCategory([
    { id: 'second-image', category: 'character', subject_id: 'subject-one', file_url: '/uploads/second.png' },
    { id: 'primary-image', category: 'character', subject_id: 'subject-one', file_url: '/uploads/primary.png', is_primary: true },
  ]).chars[0].images;
  assert.equal(buildImageEditRequest(images[0], { mode: 'crop' }).source_asset_id, 'primary-image');
  assert.equal(buildImageEditRequest(images[1], { mode: 'crop' }).source_asset_id, 'second-image');
});

test('保留显式资产编号，二次编辑使用当前资产而非祖先资产', async () => {
  const image = groupByCategory([{
    id: 'record-id', asset_id: 'current-asset', category: 'character', asset_type: 'image',
    subject_id: 'subject-one', file_url: '/uploads/edited.png',
    metadata_json: { source_asset_id: 'ancestor-asset', edit_mode: 'crop', edit_type: 'image_edit' },
  }]).chars[0].images[0];
  const card = { ...image, imageUrl: image.fileUrl };
  assert.equal(card.source_asset_id, 'ancestor-asset');
  assert.equal(buildImageEditRequest(card, { mode: 'crop' }).source_asset_id, 'current-asset');
  assert.equal((await apiPrepareEditSource(card)).id, 'current-asset');
});

test('公共校验仍拒绝只有记录编号、缺失编号和本地编号的对象', async () => {
  for (const card of [{ id: 'candidate-id' }, {}, { asset_id: 'local-test' }, { asset_id: 'blob:test' }]) {
    assert.throws(() => validateSourceAsset(card), /真实源资产编号/);
    await assert.rejects(apiPrepareEditSource({ ...card, imageUrl: '/uploads/image.png' }), /真实源资产编号/);
  }
});
