import test from 'node:test';
import assert from 'node:assert/strict';
import { matchImageParams, imageRatios } from '../src/utils/ImageGenerationParams.js';

const model = { value: 'default', is_default: true, resolutions: ['2K', '4K'], ratios: ['16:9', '1:1'], resolutionSizeMap: {} };
test('原模型优先，原比例不变，1K 回退到 2K', () => {
  assert.deepEqual(matchImageParams([model], { model: 'removed', ratio: '16:9', resolution: '1K' }), { model: 'default', ratio: '16:9', resolution: '2K' });
  const original = { ...model, value: 'original', is_default: false };
  assert.equal(matchImageParams([model, original], { model: 'original', ratio: '16:9', resolution: '4K' }).model, 'original');
});
test('不支持比例、缺少参数或默认模型时需要用户选择', () => {
  assert.equal(matchImageParams([model], { ratio: '9:16', resolution: '2K' }), null);
  assert.equal(matchImageParams([model], { ratio: '16:9' }), null);
  assert.equal(matchImageParams([{ ...model, is_default: false }], { ratio: '16:9', resolution: '2K' }), null);
});
test('按比例分辨率组合校验，空映射沿用全局比例', () => {
  const mapped = { ...model, resolutionSizeMap: { '2K': { '1:1': '2048x2048' }, '4K': {} } };
  assert.deepEqual(imageRatios(mapped, '4K'), model.ratios);
  assert.equal(matchImageParams([mapped], { ratio: '16:9', resolution: '2K' }).resolution, '4K');
});
