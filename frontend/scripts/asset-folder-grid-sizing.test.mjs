import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssetFolderGridSizing } from '../src/components/assets/AssetFolderGridSizing.js';

test('同列数内随容器连续伸缩，且不超过宽度上限', () => {
  assert.deepEqual(getAssetFolderGridSizing(920, 16), { columns: 4, cardWidth: 218 });
  assert.deepEqual(getAssetFolderGridSizing(1000, 16), { columns: 4, cardWidth: 238 });
  assert.deepEqual(getAssetFolderGridSizing(900, 24), { columns: 3, cardWidth: 270 });
});

test('按最小宽度增加列，窄容器不溢出', () => {
  assert.deepEqual(getAssetFolderGridSizing(911, 16), { columns: 3, cardWidth: 270 });
  assert.deepEqual(getAssetFolderGridSizing(912, 16), { columns: 4, cardWidth: 216 });
  assert.deepEqual(getAssetFolderGridSizing(200, 16), { columns: 1, cardWidth: 200 });
  assert.deepEqual(getAssetFolderGridSizing(0, 16), { columns: 1, cardWidth: 0 });
});

test('创作资产尺寸使用 240px 最小列宽且不限制卡片最大宽度', () => {
  assert.deepEqual(getAssetFolderGridSizing(920, 16, 240, Number.POSITIVE_INFINITY), { columns: 3, cardWidth: 296 });
  assert.deepEqual(getAssetFolderGridSizing(1008, 16, 240, Number.POSITIVE_INFINITY), { columns: 4, cardWidth: 240 });
});
