import test from 'node:test';
import assert from 'node:assert/strict';
import { renderImageCropResult, renderImageCropBlob } from '../src/utils/imageCrop.js';
import { prepareCanvasMediaAsset } from '../src/components/canvas/CanvasMediaSize.js';

test('裁剪输出尺寸与旋转后的 PNG 一致，已知尺寸无需加载远程图片', async () => {
  const blob = new Blob(['png']);
  const canvases = [];
  const previous = globalThis.document;
  const previousImage = globalThis.Image;
  globalThis.Image = class { constructor() { throw new Error('不应重新加载图片'); } };
  globalThis.document = { createElement() {
    const canvas = { getContext: () => ({ translate() {}, rotate() {}, scale() {}, drawImage() {} }),
      toBlob(callback, type) { assert.equal(type, 'image/png'); callback(blob); } };
    canvases.push(canvas);
    return canvas;
  } };
  try {
    for (const [rotation, width, height] of [[0, 690, 244], [90, 489, 345], [270, 489, 345]]) {
      const options = { image: {}, imageWidth: 1379, imageHeight: 977, rotation, crop: { x: 0, y: 0, width: 0.5, height: 0.25 }, panX: 0, panY: 0 };
      const result = await renderImageCropResult(options);
      assert.deepEqual(result, { blob, width, height });
      assert.equal(canvases.at(-1).width, width);
      assert.equal(canvases.at(-1).height, height);
      assert.equal(await renderImageCropBlob(options), blob);
      const asset = { asset_type: 'image', url: 'https://example.com/result.png', width, height };
      assert.equal(await prepareCanvasMediaAsset(asset), asset);
    }
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  }
});
