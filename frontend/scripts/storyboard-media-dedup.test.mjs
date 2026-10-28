import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStoryboardMediaItems as merge, storyboardMediaType } from '../src/utils/storyboardMediaDedup.js';
import { mergeStoryboardMediaItems as display } from '../src/components/storyboard/StoryboardMediaItems.js';

test('选帧图片与源视频编号交叉匹配也必须保留两条候选', () => {
  const video = { id: 'video-candidate', asset_id: 'video-asset', media_type: 'video', type: 'video/mp4', url: '/video.mp4', is_finalized: true };
  const frame = { id: 'frame-candidate', asset_id: 'video-candidate', media_type: 'image', url: '/frame.png', is_finalized: false };
  const result = merge([video], [frame]);
  assert.deepEqual(result, [video, frame]);
  assert.equal(result[1].type, undefined);
  assert.deepEqual(display(result), display([video, frame]));
  assert.equal(result[0].is_finalized, true);
});

test('不同资产不会因相同预览或下载地址合并', () => {
  const original = { id: 'one', asset_id: 'one-asset', media_type: 'video', preview_video_url: '/shared.mp4' };
  const edited = { id: 'two', asset_id: 'two-asset', media_type: 'video', preview_video_url: '/shared.mp4' };
  assert.equal(merge([original], [edited]).length, 2);
});

test('相同资产的临时候选仍由服务器记录更新', () => {
  const pending = { id: 'temp-image', asset_id: 'asset', type: 'image/png', url: '/frame.png' };
  const saved = { id: 'candidate', asset_id: 'asset', media_type: 'image', url: '/frame.png' };
  assert.equal(merge([pending], [saved]).length, 1);
  assert.equal(merge([pending], [saved])[0].id, 'candidate');
  assert.equal(display([saved], [pending]).length, 1);
});

test('明确图片类型优先于残留视频类型，详情与列表一致', () => {
  assert.equal(storyboardMediaType({ media_type: 'image', type: 'video/mp4' }), 'image');
  assert.equal(storyboardMediaType({ mediaType: 'image', type: 'video/mp4' }), 'image');
  assert.equal(storyboardMediaType({ type: 'video/mp4' }), 'video');
});
