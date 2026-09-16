import { validateExpansion } from './MediaEditPolicy.js';

const INVALID_ID = /^(local[-_:]|blob:)/;

export function validateSourceAsset(asset) {
  const id = asset?.source_asset_id || asset?.creationAssetId || asset?.asset_id || asset?.assetId || asset?.backendId;
  if (typeof id !== 'string' || !id.trim() || INVALID_ID.test(id)) throw new Error('当前素材缺少真实源资产编号');
  return id;
}

export function createIdempotencyKey() {
  return `media-edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildImageEditRequest(asset, options = {}) {
  const input = { ...options, ...options.expandOptions };
  const source_asset_id = validateSourceAsset(asset);
  const edit_mode = input.edit_mode || input.mode;
  if (!['multi_angle', 'inpaint', 'erase', 'upscale', 'outpaint', 'crop', 'flip'].includes(edit_mode)) throw new Error('不支持的图片编辑模式');
  const request = { edit_type: 'image_edit', edit_mode, source_asset_id,
    business_context: input.business_context || asset.business_context || asset.metadata_json?.business_context || undefined,
    idempotency_key: input.idempotency_key || createIdempotencyKey(), model: input.model ?? null,
    model_requirement: input.model_requirement, model_status: input.model_status || 'awaiting-backend-contract' };
  const fields = ['prompt', 'mask', 'image', 'file', 'target_resolution', 'left_expansion_ratio', 'right_expansion_ratio', 'up_expansion_ratio', 'down_expansion_ratio'];
  fields.forEach((key) => { if (input[key] !== undefined && (edit_mode === 'inpaint' || edit_mode === 'outpaint' || key !== 'prompt')) request[key] = input[key]; });
  if (edit_mode === 'outpaint') validateExpansion(request);
  if (!['inpaint', 'outpaint'].includes(edit_mode)) delete request.prompt;
  request.image = asset.originalUrl || asset.original_url || asset.download_url || asset.downloadUrl || asset.imageUrl;
  if (edit_mode === 'multi_angle') {
    request.model = 'sp-gpt-image-2';
    request.internal_prompt = input.internal_prompt;
  }
  if (edit_mode === 'inpaint' && !request.prompt?.trim()) throw new Error('请输入重绘提示词');
  if (['inpaint', 'erase'].includes(edit_mode) && !request.mask) throw new Error('缺少编辑蒙版');
  return request;
}

export function buildVideoEditRequest(asset, options = {}) {
  const request = { edit_type: 'video_edit', edit_mode: options.edit_mode || options.mode, source_asset_id: validateSourceAsset(asset),
    idempotency_key: options.idempotency_key || createIdempotencyKey(), model: options.model ?? null, model_requirement: options.model_requirement,
    model_status: options.model_status || 'awaiting-backend-contract',
    business_context: options.business_context || asset.business_context || asset.metadata_json?.business_context || undefined };
  ['start_time_seconds', 'end_time_seconds', 'frame_time_seconds', 'target_resolution', 'metadata', 'file'].forEach((key) => { if (options[key] !== undefined) request[key] = options[key]; });
  if (!['upscale', 'subtitle_remove', 'frame_extract', 'trim'].includes(request.edit_mode)) throw new Error('不支持的视频编辑模式');
  if (request.edit_mode === 'trim' && (!Number.isFinite(request.start_time_seconds) || !Number.isFinite(request.end_time_seconds) || request.start_time_seconds < 0 || request.end_time_seconds <= request.start_time_seconds)) throw new Error('剪辑结束时间必须晚于开始时间');
  if (request.edit_mode === 'upscale') {
    if (!['1080P', '4K'].includes(request.target_resolution)) throw new Error('视频超清仅支持1080P和4K');
    request.model_requirement = request.target_resolution === '1080P' ? 'HappyHorse 1.1' : 'Seedance 2.0';
  }
  if (request.edit_mode === 'subtitle_remove') { request.model = 'happyhorse-1.0-video-edit'; request.processing_scope = 'full_video'; }
  request.video = asset.originalUrl || asset.original_url || asset.videoUrl || asset.video_url;
  request.output_type = request.edit_mode === 'frame_extract' ? 'image' : 'video';
  return request;
}
