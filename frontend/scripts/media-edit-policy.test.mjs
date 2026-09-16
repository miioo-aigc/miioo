import assert from 'node:assert/strict';
import test from 'node:test';
import { mayShowEditPrompt, readEditMetadata, validateExpansion } from '../src/utils/MediaEditPolicy.js';

const ratios = (up, down, left, right) => ({ up_expansion_ratio: up, down_expansion_ratio: down, left_expansion_ratio: left, right_expansion_ratio: right });
test('扩图接受3倍面积边界及非对称扩展', () => {
  assert.deepEqual(validateExpansion(ratios(0, 0, 2, 0)), ratios(0, 0, 2, 0));
  assert.doesNotThrow(() => validateExpansion(ratios(0.25, 0.25, 0.5, 0.5)));
});
test('扩图拒绝越界、非有限数、旧字段和零扩展', () => {
  for (const value of [-1, 2.01, NaN, Infinity, '1', null]) assert.throws(() => validateExpansion(ratios(value, 0, 0, 0)));
  assert.throws(() => validateExpansion(ratios(1, 1, 1, 1)));
  assert.throws(() => validateExpansion(ratios(0, 0, 0, 0)));
  assert.throws(() => validateExpansion({ top_expansion_ratio: 1, bottom_expansion_ratio: 0 }));
});
test('只有重绘与扩图显示编辑提示词，未知模式默认隐藏', () => {
  for (const mode of ['multi_angle', 'erase', 'upscale', 'crop', 'flip', 'subtitle_remove', 'frame_extract', 'trim', 'future']) {
    assert.equal(mayShowEditPrompt({ metadata_json: { edit_mode: mode } }), false);
  }
  for (const mode of ['inpaint', 'outpaint']) assert.equal(mayShowEditPrompt({ edit_mode: mode }), true);
  assert.equal(mayShowEditPrompt({ edit_type: 'video_edit' }), false);
  assert.equal(mayShowEditPrompt({ edit_mode: 'multi_angle', show_prompt: true, prompt: '内部提示词' }), false);
  assert.equal(mayShowEditPrompt({ edit_mode: 'outpaint', show_prompt: false, prompt: '用户提示词' }), false);
  assert.equal(mayShowEditPrompt({ prompt: '旧资产' }), true);
});
test('编辑元数据支持序列化格式与选帧的视频编辑类型', () => {
  assert.deepEqual(readEditMetadata({ metadata_json: JSON.stringify({ edit_type: 'video_edit', edit_mode: 'frame_extract', source_asset_id: 'video-id' }) }), {
    edit_type: 'video_edit', edit_mode: 'frame_extract', source_asset_id: 'video-id',
  });
  assert.doesNotThrow(() => readEditMetadata({ metadata_json: '无效数据' }));
});
