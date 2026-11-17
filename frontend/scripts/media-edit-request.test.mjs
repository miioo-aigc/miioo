import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImageEditRequest, buildVideoEditRequest, validateSourceAsset } from '../src/utils/MediaEditRequest.js';

test('图片编辑意图统一携带真实源资产和扩图字段', () => {
  const request = buildImageEditRequest({ asset_id: 'asset-1' }, { mode: 'outpaint', prompt: '向外扩展', model_requirement: 'Kling v3', expandOptions: { up_expansion_ratio: 0, down_expansion_ratio: 0, left_expansion_ratio: 2, right_expansion_ratio: 0 } });
  assert.equal(request.edit_type, 'image_edit');
  assert.equal(request.source_asset_id, 'asset-1');
  assert.equal(request.left_expansion_ratio, 2);
  assert.equal(request.prompt, '向外扩展');
});

test('隐藏提示词模式不会进入请求', () => {
  assert.equal(buildImageEditRequest({ asset_id: 'asset-1' }, { mode: 'erase', mask: 'mask', prompt: '内部预设' }).prompt, undefined);
  assert.equal(buildVideoEditRequest({ asset_id: 'video-1' }, { mode: 'trim', start_time_seconds: 1, end_time_seconds: 2 }).edit_type, 'video_edit');
});

test('拒绝本地伪资产编号', () => assert.throws(() => validateSourceAsset({ asset_id: 'local-1' })));

test('多机位只使用确认模型并将提示词标记为内部字段', () => {
  const request = buildImageEditRequest({ asset_id: 'asset-1' }, { mode: 'multi_angle', internal_prompt: '内部角度描述', multi_angle_options: { horizontal: 90, vertical: 0 } });
  assert.equal(request.model, 'gpt-image-2');
  assert.equal(request.internal_prompt, '内部角度描述');
  assert.deepEqual(request.multi_angle_options, { horizontal: 90, vertical: 0 });
  assert.equal(request.prompt, undefined);
});

test('视频编辑遵守已确认模型与输出类型边界', () => {
  const asset = { asset_id: 'video-1', business_context: { storyboard_id: 'shot-1' } };
  const upscale = buildVideoEditRequest(asset, { mode: 'upscale', target_resolution: '1080P' });
  assert.equal(upscale.model, null);
  assert.equal(upscale.model_requirement, 'HappyHorse 1.0');
  assert.deepEqual(upscale.business_context, { storyboard_id: 'shot-1' });
  const subtitle = buildVideoEditRequest(asset, { mode: 'subtitle_remove', prompt: '不能发送' });
  assert.equal(subtitle.model, 'happyhorse-1.0-video-edit');
  assert.equal(subtitle.processing_scope, 'full_video');
  assert.equal(subtitle.prompt, undefined);
  const frame = buildVideoEditRequest(asset, { mode: 'frame_extract', frame_time_seconds: 1.25, file: 'png' });
  assert.equal(frame.output_type, 'image');
  assert.equal(frame.frame_time_seconds, 1.25);
  assert.equal(frame.file, 'png');
});

test('视频剪辑必须提交合法连续时间区间', () => {
  assert.throws(() => buildVideoEditRequest({ asset_id: 'video-1' }, { mode: 'trim', start_time_seconds: 2, end_time_seconds: 2 }));
  assert.equal(buildVideoEditRequest({ asset_id: 'video-1' }, { mode: 'trim', start_time_seconds: 0, end_time_seconds: 0.1 }).output_type, 'video');
});

test('画布图片编辑各模式保留 canvas_id，独立创作入口严格省略', () => {
  const asset = { asset_id: 'asset-1', original_url: '/source.png' };
  const options = {
    multi_angle: { internal_prompt: '旋转视角', multi_angle_options: { horizontal: 90, vertical: 0 } },
    inpaint: { prompt: '重绘', mask: 'data:image/png;base64,mask' },
    erase: { mask: 'data:image/png;base64,mask' },
    upscale: { target_resolution: '4K' },
    outpaint: { prompt: '扩图', up_expansion_ratio: 0.5, down_expansion_ratio: 0, left_expansion_ratio: 0, right_expansion_ratio: 0 },
    crop: {},
    flip: {},
  };
  for (const [mode, fields] of Object.entries(options)) {
    const withCanvas = buildImageEditRequest(asset, { mode, canvas_id: 'canvas-1', ...fields });
    const independent = buildImageEditRequest(asset, { mode, ...fields });
    assert.equal(withCanvas.canvas_id, 'canvas-1', `${mode} 应携带画布身份`);
    assert.equal(Object.hasOwn(independent, 'canvas_id'), false, `${mode} 独立入口不应带空画布字段`);
  }
});

test('画布视频编辑四类模式在请求构造和重试快照中保留 canvas_id', () => {
  const asset = { asset_id: 'video-1', original_url: '/source.mp4' };
  const options = {
    upscale: { target_resolution: '1080P' },
    subtitle_remove: {},
    trim: { start_time_seconds: 0, end_time_seconds: 1 },
    frame_extract: { frame_time_seconds: 1, file: 'png' },
  };
  for (const [mode, fields] of Object.entries(options)) {
    const withCanvas = buildVideoEditRequest(asset, { mode, canvas_id: 'canvas-1', ...fields });
    const independent = buildVideoEditRequest(asset, { mode, ...fields });
    assert.equal(withCanvas.canvas_id, 'canvas-1', `${mode} 应携带画布身份`);
    assert.equal(Object.hasOwn(independent, 'canvas_id'), false, `${mode} 独立入口不应带空画布字段`);
  }
});
