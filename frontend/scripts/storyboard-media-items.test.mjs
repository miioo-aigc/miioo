import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeStoryboardMediaItems as merge } from '../src/components/storyboard/StoryboardMediaItems.js';

const candidate = { id: 'candidate-1', asset_id: 'asset-1', url: '/result.png', is_finalized: true };
const edit = { id: 'local-edit-1', creationAssetId: 'asset-1', remoteUrl: '/result.png', localEdit: true };

test('候选编号与本地编号不同，但真实资产相同时以后端为准', () => {
  assert.deepEqual(merge([candidate], [edit]), [candidate]);
  assert.equal(merge([candidate], [edit])[0], candidate);
});

test('本地补位在后端返回前可见，返回后只保留一张，且不修改输入', () => {
  const local = [edit];
  assert.deepEqual(merge([], local), [edit]);
  assert.deepEqual(merge([candidate], local), [candidate]);
  assert.deepEqual(local, [edit]);
});

test('支持真实资产字段别名及数字编号', () => {
  for (const field of ['asset_id', 'assetId', 'creationAssetId', 'backendId']) {
    assert.equal(merge([{ id: 'server', asset_id: 123 }], [{ id: 'local', [field]: '123' }]).length, 1);
  }
});

test('缺少资产编号时用完全相同的原图地址补充匹配', () => {
  assert.deepEqual(merge([{ id: 'candidate', url: '/result.png' }], [edit]), [{ id: 'candidate', url: '/result.png' }]);
});

test('不同真实资产不能因相同源资产、时间、缩略图或地址被隐藏', () => {
  const other = { ...edit, creationAssetId: 'asset-2', source_asset_id: 'original', created_at: 'same', thumbnail_url: '/thumb.png' };
  assert.equal(merge([{ ...candidate, source_asset_id: 'original', created_at: 'same', thumbnail_url: '/thumb.png' }], [other]).length, 2);
  assert.equal(merge([{ id: 'a', thumbnail_url: '/thumb.png' }], [{ id: 'b', thumbnail_url: '/thumb.png' }]).length, 2);
});

test('保留未完成任务，不合并图片与视频，重复记录编号仍去重', () => {
  assert.equal(merge([candidate], [{ ...edit, pending: true }]).length, 2);
  assert.equal(merge([{ ...candidate, media_type: 'video' }], [edit]).length, 2);
  assert.equal(merge([candidate, candidate], []).length, 1);
});

test('详情弹窗实际使用合并函数', async () => {
  const source = await readFile(new URL('../src/components/storyboard/StoryboardMediaDetailModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /return mergeStoryboardMediaItems\(candidates.length \? candidates : media \? \[media\] : \[\], edits.images\)/);
});

test('定稿置前，其余图片和视频统一按时间升序排列', () => {
  const items = [
    { id: 'oct-image', media_type: 'image', created_at: '2026-10-12T09:00:00Z' },
    { id: 'aug-video', media_type: 'video', createdAt: '2026-08-03T09:00:00Z' },
    { id: 'final', is_finalized: true, created_at: '2026-10-13T09:00:00Z' },
    { id: 'oct-earlier', created_at: '2026-10-12T08:00:00Z' },
  ];
  const original = [...items];
  assert.deepEqual(merge(items).map((item) => item.id), ['final', 'aug-video', 'oct-earlier', 'oct-image']);
  assert.deepEqual(items, original);
});

test('本地新结果参与时间排序，去重后保留后端定稿状态', () => {
  const saved = { ...candidate, is_finalized: undefined, isFinalized: true, createdAt: '2026-10-13T09:00:00Z' };
  const newer = { id: 'new', created_at: '2026-10-13T08:00:00Z' };
  const older = { id: 'old', created_at: '2026-08-03T08:00:00Z' };
  assert.deepEqual(merge([newer, saved], [edit, older]), [saved, older, newer]);
});

test('无效时间置前，同时间和无效时间分别保持原顺序', () => {
  const items = [
    { id: 'same-a', created_at: '2026-10-12T09:00:00Z' },
    { id: 'missing' },
    { id: 'same-b', created_at: '2026-10-12T17:00:00+08:00' },
    { id: 'invalid', created_at: 'invalid' },
  ];
  assert.deepEqual(merge(items).map((item) => item.id), ['missing', 'invalid', 'same-a', 'same-b']);
});
