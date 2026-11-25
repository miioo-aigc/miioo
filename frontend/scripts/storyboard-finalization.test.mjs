import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStoryboardFinalization as apply, findFinalizedCandidate as find } from '../src/utils/StoryboardFinalization.js';
import { mergeStoryboardMediaItems as merge } from '../src/components/storyboard/StoryboardMediaItems.js';

test('当前定稿与旧分镜补位合并后，只勾选当前候选', () => {
  const current = { id: 'new', url: '/new.png', is_finalized: true };
  const old = { id: 'old', url: '/old.png', is_finalized: true, isFinalized: true };
  const result = apply(merge([current], [old]), current);
  assert.deepEqual(result.filter(x => x.is_finalized).map(x => x.id), ['new']);
  assert.equal(result.find(x => x.id === 'old').isFinalized, false);
  assert.equal(old.is_finalized, true);
});
test('图片和视频共享一个定稿，切换后旧定稿取消', () => {
  const items = [{ id: 'image', media_type: 'image', is_finalized: true }, { id: 'video', media_type: 'video' }];
  assert.deepEqual(apply(items, items[1]).map(x => x.is_finalized), [false, true]);
});
test('取消定稿后旧字段和补位素材不能恢复勾选', () => {
  const items = [{ id: 'old', is_finalized: false, isFinalized: true }];
  assert.equal(find(items), null);
  assert.deepEqual(apply(items, null).map(x => [x.is_finalized, x.isFinalized]), [[false, false]]);
});
test('多个候选共享媒体地址时优先候选编号，最多选中一个', () => {
  const items = [{ id: 'a', url: '/same.png' }, { id: 'b', url: '/same.png' }];
  assert.deepEqual(apply(items, items[1]).map(x => x.is_finalized), [false, true]);
  assert.equal(apply(items, { url: '/same.png' }).filter(x => x.is_finalized).length, 1);
});
test('旧数据多定稿收敛为一个，生成中占位不能成为定稿', () => {
  const items = [{ id: 'pending', pending: true, is_finalized: true }, { id: 'a', isFinalized: true }, { id: 'b', is_finalized: true }];
  assert.deepEqual(apply(items, find(items)).map(x => x.is_finalized), [false, true, false]);
});
