import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeProjectSubjectImages } from '../src/components/assets/ProjectSubjectImages.js';
import { getAssetSubjectType } from '../src/utils/assetsBatchAdapter.js';

const assetId = 'd6d95f1d-7158-4673-866d-491e0911ae2c';
const url = '/uploads/creation/global/image-edits/6f144d008c8a40ddae83f8cb899dcb76.png';
const local = { id: 'pending-edit:subject:result', creationAssetId: assetId, remoteUrl: url, localEdit: true };

test('本次响应中的资产、候选与本地记录按真实资产编号合并', () => {
  for (const id of [assetId, '98e1f73c-3ebe-4837-9a42-ff2f0b82279b']) {
    const server = { id, asset_id: assetId, fileUrl: url, is_primary: true, downloadUrl: '/download' };
    const images = [server];
    const edits = [local];
    assert.deepEqual(mergeProjectSubjectImages(images, edits), [server]);
    assert.equal(mergeProjectSubjectImages(images, edits)[0], server);
    assert.deepEqual(images, [server]);
    assert.deepEqual(edits, [local]);
  }
});

test('后端返回前本地补位，返回后只保留后端版本', () => {
  assert.deepEqual(mergeProjectSubjectImages([], [local]), [local]);
  const server = { id: assetId, asset_id: assetId, fileUrl: url };
  assert.deepEqual(mergeProjectSubjectImages([server], [local, { ...local, id: 'old-local' }]), [server]);
});

test('不同真实资产不合并，共用缩略图或源资产也不合并', () => {
  const first = { id: 'first', asset_id: 'a', fileUrl: url, url: '/thumb', source_asset_id: 'source' };
  const second = { ...first, id: 'second', asset_id: 'b' };
  const third = { id: 'third', url: '/thumb', source_asset_id: 'source' };
  assert.deepEqual(mergeProjectSubjectImages([first], [second, third]), [first, second, third]);
});

test('无资产编号时只用原图地址兜底，待处理任务不会吞并', () => {
  const server = { id: 'server', fileUrl: url };
  const pending = { ...local, id: 'pending', pending: true };
  assert.deepEqual(mergeProjectSubjectImages([server], [local, pending]), [server, pending]);
});

test('角色场景道具接入合并且不输出外层编辑卡，创作资产保持原逻辑', async () => {
  const source = await readFile(new URL('../src/components/assets/AssetsCards.jsx', import.meta.url), 'utf8');
  assert.match(source, /const isSubject = Boolean\(getAssetSubjectType\(category\)\)/);
  assert.match(source, /mergeProjectSubjectImages\(asset.images, edits.images\)/);
  assert.match(source, /!isStoryboard && !isSubject && edits.images.map/);
  assert.match(source, /visibleCreationEdits\(edits.images, listedImages\)/);
});

test('使用页面真实分类值执行主体分支，而不是接口分类值', async () => {
  const panel = await readFile(new URL('../src/components/assets/AssetsProjectPanel.jsx', import.meta.url), 'utf8');
  const grid = await readFile(new URL('../src/components/assets/AssetsProjectGrid.jsx', import.meta.url), 'utf8');
  assert.match(grid, /category=\{activeCategory\}/);
  for (const [category, label] of [['chars', '角色'], ['scenes', '场景'], ['props', '道具']]) {
    assert.ok(panel.includes(`{ key: '${category}', label: '${label}' }`));
    const isSubject = Boolean(getAssetSubjectType(category));
    assert.equal(isSubject, true, `${label}必须进入主体合并分支`);
    const server = { id: assetId, asset_id: assetId, fileUrl: url };
    const images = isSubject ? mergeProjectSubjectImages([server], [local]) : [server, local];
    assert.deepEqual(images, [server]);
    assert.equal(!isSubject, false, `${label}不得输出外层编辑结果卡`);
  }
  for (const category of ['storyboard', 'audio', 'final']) {
    assert.equal(Boolean(getAssetSubjectType(category)), false);
  }
});
