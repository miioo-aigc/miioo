import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMediaSize, getCanvasAssetNodeSize, prepareCanvasMediaAsset } from '../src/components/canvas/CanvasMediaSize.js';
import { planCanvasAssetImport } from '../src/components/canvas/CanvasAssets.js';
import { getCanvasImportBounds } from '../src/components/canvas/CanvasImportLayout.js';

test('图片和视频扣除边框后精确保留比例和面积', () => {
  for (const asset_type of ['image', 'video']) {
    for (const [width, height] of [[1, 1], [16, 9], [9, 16], [4, 3], [3, 4], [1379, 977]]) {
      const size = getCanvasMediaSize({ asset_type, width, height });
      const contentWidth = size.width - 2;
      const contentHeight = size.height - 2;
      assert.ok(Math.abs(contentWidth * contentHeight / 57600 - 1) < 1e-12);
      assert.ok(Math.abs(contentWidth / contentHeight / (width / height) - 1) < 1e-12);
      assert.deepEqual(getCanvasAssetNodeSize({ asset_type, width, height }), { width: size.width, height: size.height + 24 });
    }
  }
});
test('极端比例最长边480，音频及无效尺寸保持默认', async () => {
  assert.deepEqual(getCanvasMediaSize({ asset_type: 'image', width: 1, height: 10 }), { width: 50, height: 482 });
  assert.deepEqual(getCanvasMediaSize({ asset_type: 'video', width: 10, height: 1 }), { width: 482, height: 50 });
  for (const asset of [null, { asset_type: 'audio', width: 1, height: 2 }, { asset_type: 'image', width: Infinity, height: 1 }]) {
    assert.equal(getCanvasMediaSize(asset), null);
    assert.deepEqual(getCanvasAssetNodeSize(asset), { width: 240, height: 264 });
  }
  const asset = { asset_type: 'image', width: 1920, height: 1080 };
  assert.equal(await prepareCanvasMediaAsset(asset), asset);
});
test('混合比例网格无重叠，聚焦覆盖所有实际卡片', () => {
  const assets = [[16, 9], [9, 16], [1, 1], [10, 1], [1, 10], [4, 3]].map(([width, height], i) => ({ asset_type: 'image', width, height, url: `/test-${i}.png` }));
  const imports = planCanvasAssetImport(assets, { x: 0, y: 0 });
  const rects = imports.map((item) => ({ ...item.position, ...getCanvasAssetNodeSize(item.asset) }));
  const bounds = getCanvasImportBounds(rects);
  for (const [i, a] of rects.entries()) {
    assert.ok(a.x >= bounds.x && a.y >= bounds.y && a.x + a.width <= bounds.x + bounds.width && a.y + a.height <= bounds.y + bounds.height);
    for (const b of rects.slice(i + 1)) assert.ok(a.x + a.width + 32 <= b.x || b.x + b.width + 32 <= a.x || a.y + a.height + 32 <= b.y || b.y + b.height + 32 <= a.y);
  }
});
