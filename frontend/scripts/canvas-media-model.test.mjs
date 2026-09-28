import test from 'node:test';
import assert from 'node:assert/strict';

test('媒体模型优先保留手选，其次用户默认，聚合子模型映射到入口', async () => {
  const { selectCanvasMediaModel } = await import('../src/components/canvas/CanvasMediaModels.js');
  const options = [{ value: 'first' }, { value: 'group', sourceModelIds: ['child'] }];
  const models = [{ model_id: 'child', is_default: true, is_enabled: true }];
  assert.equal(selectCanvasMediaModel(options, models, ''), 'group');
  assert.equal(selectCanvasMediaModel(options, models, 'first'), 'first');
  assert.equal(selectCanvasMediaModel(options, models, 'child'), 'group');
  assert.equal(selectCanvasMediaModel(options, models, 'removed'), 'group');
  assert.equal(selectCanvasMediaModel(options, [], ''), 'first');
  assert.equal(selectCanvasMediaModel([], models, ''), '');
  assert.equal(selectCanvasMediaModel(options, [{ ...models[0], is_enabled: false }], ''), 'first');
});
