import test from 'node:test';
import assert from 'node:assert/strict';

test('文本模型过滤禁用及媒体模型，优先用户默认值并保留有效选择', async () => {
  const { getCanvasTextModels, getCanvasTextModelValue } = await import('../src/components/canvas/CanvasTextModels.js');
  const models = getCanvasTextModels([
    { model_id: 'first', name: '文本一', category: 'chat' },
    { model_id: 'default', name: '默认文本', category: 'chat', is_default: true },
    { model_id: 'disabled', category: 'chat', is_enabled: false, is_default: true },
    { model_id: 'image', category: 'image' },
  ]);
  assert.deepEqual(models.map(m => m.value), ['first', 'default']);
  assert.equal(getCanvasTextModelValue(models, ''), 'default');
  assert.equal(getCanvasTextModelValue(models, 'first'), 'first');
  assert.equal(getCanvasTextModelValue(models, 'removed'), 'default');
  assert.equal(getCanvasTextModelValue([], ''), '');
  assert.equal(getCanvasTextModelValue(models.slice(0, 1), ''), 'first');
});
