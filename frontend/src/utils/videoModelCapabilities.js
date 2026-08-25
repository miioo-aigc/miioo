/**
 * 视频生成能力解析：素材路由由前端决定，生成模式与参考模式绑定由后端映射决定。
 *
 * 2026-08-25  删除模型名称硬编码兜底，完整依赖后端 generation_reference_mode_map；保留 Seedance 全能参考固定走 full。
 */
const ALL_REFERENCE_GENERATION_MODES = new Set([
  'full',
  'text_to_video',
  'reference_subjects',
  'video_ref',
  'video_edit',
]);

const FRAME_GENERATION_MODES = new Set(['first_frame', 'last_frame', 'start_end']);

export const VIDEO_REFERENCE_MODES = Object.freeze({
  ALL: 'all',
  MULTI_SHOT: 'multi_shot',
  FRAME: 'frame',
});

export const VIDEO_SPECIAL_REFERENCE_MODES = Object.freeze({
  MOTION_CONTROL: 'kling_motion_control',
  LIP_SYNC: 'kling_lip_sync',
  AVATAR: 'kling_avatar',
});

const REFERENCE_MODE_LABELS = Object.freeze({
  [VIDEO_REFERENCE_MODES.ALL]: '全能参考',
  [VIDEO_REFERENCE_MODES.MULTI_SHOT]: '智能多帧',
  [VIDEO_REFERENCE_MODES.FRAME]: '首尾帧',
});

export function normalizeSupportedGenerationModes(capabilities = {}) {
  const modes = capabilities?.supported_generation_modes;
  if (!Array.isArray(modes)) return [];
  return [...new Set(modes.map((mode) => String(mode || '').trim()).filter(Boolean))];
}

export function normalizeGenerationReferenceModeMap(capabilities = {}) {
  const rawMap = capabilities?.generation_reference_mode_map
    ?? capabilities?.generationReferenceModeMap;
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return null;

  const normalizedMap = {};
  for (const [rawGenerationMode, rawReferenceMode] of Object.entries(rawMap)) {
    const generationMode = String(rawGenerationMode).trim();
    if (!generationMode) return null;
    if (rawReferenceMode !== null && typeof rawReferenceMode !== 'string') return null;
    const referenceMode = rawReferenceMode === null ? null : rawReferenceMode.trim();
    if (referenceMode === '') return null;
    normalizedMap[generationMode] = referenceMode;
  }
  return normalizedMap;
}

export function resolveGenerationReferenceModeMap({ capabilities = {} } = {}) {
  return normalizeGenerationReferenceModeMap(capabilities);
}

export function isSeedanceVideoModel({ modelId = '', modelName = '' } = {}) {
  return /seedance/i.test(`${modelId} ${modelName}`.replace(/[\s•、_-]+/g, ''));
}

export function getAvailableVideoReferenceModes(capabilities = {}) {
  const generationModes = normalizeSupportedGenerationModes(capabilities);
  const supported = new Set(generationModes);
  const modes = [];

  if (generationModes.some((mode) => ALL_REFERENCE_GENERATION_MODES.has(mode))) {
    modes.push({ value: VIDEO_REFERENCE_MODES.ALL, label: REFERENCE_MODE_LABELS.all });
  }
  if (supported.has('multi_shot')) {
    modes.push({ value: VIDEO_REFERENCE_MODES.MULTI_SHOT, label: REFERENCE_MODE_LABELS.multi_shot });
  }
  if (generationModes.some((mode) => FRAME_GENERATION_MODES.has(mode))) {
    modes.push({ value: VIDEO_REFERENCE_MODES.FRAME, label: REFERENCE_MODE_LABELS.frame });
  }

  return modes;
}

export function resolveVideoReferenceModeFallback(currentMode, availableModes = []) {
  const values = availableModes.map((mode) => typeof mode === 'string' ? mode : mode.value);
  if (values.includes(currentMode)) return currentMode;
  return [VIDEO_REFERENCE_MODES.ALL, VIDEO_REFERENCE_MODES.FRAME, VIDEO_REFERENCE_MODES.MULTI_SHOT]
    .find((mode) => values.includes(mode)) || '';
}

export function resolveVideoReferenceMode({
  generationMode,
  capabilities = {},
} = {}) {
  const mapping = resolveGenerationReferenceModeMap({ capabilities });
  if (!mapping || !Object.prototype.hasOwnProperty.call(mapping, generationMode)) {
    return fail(
      'REFERENCE_MODE_MAPPING_REQUIRED',
      '当前模型尚未提供生成模式与参考模式映射，请刷新模型数据或联系后端补充能力配置',
    );
  }

  return { ok: true, referenceMode: mapping[generationMode] };
}

export function getVideoReferenceModeLabel(mode) {
  return REFERENCE_MODE_LABELS[mode] || mode;
}

function fail(code, message) {
  return { ok: false, code, message };
}

function success(generationMode) {
  return { ok: true, generationMode };
}

export function resolveVideoGenerationMode({
  modelId = '',
  modelName = '',
  capabilities = {},
  referenceMode,
  hasPrompt = false,
  imageCount = 0,
  videoCount = 0,
  audioCount = 0,
  liveMaterialCount = 0,
  hasFirstFrame = false,
  hasLastFrame = false,
} = {}) {
  const supportedModes = new Set(normalizeSupportedGenerationModes(capabilities));
  const isSeedance = isSeedanceVideoModel({ modelId, modelName, capabilities });
  const ensureSupported = (generationMode) => supportedModes.has(generationMode)
    ? success(generationMode)
    : fail('UNSUPPORTED_GENERATION_MODE', `当前模型不支持${generationMode}能力，请调整素材或更换模型`);

  if (referenceMode === VIDEO_SPECIAL_REFERENCE_MODES.MOTION_CONTROL) {
    if (videoCount !== 1) return fail('MOTION_CONTROL_VIDEO_REQUIRED', '动作控制需要上传一段参考视频');
    return success('video_edit');
  }
  if (referenceMode === VIDEO_SPECIAL_REFERENCE_MODES.LIP_SYNC) {
    if (videoCount + imageCount !== 1) return fail('LIP_SYNC_MEDIA_REQUIRED', '对口型需要上传一段视频或一张图片');
    if (audioCount !== 1) return fail('LIP_SYNC_AUDIO_REQUIRED', '对口型需要上传一段音频');
    return success('video_edit');
  }
  if (referenceMode === VIDEO_SPECIAL_REFERENCE_MODES.AVATAR) {
    if (imageCount !== 1) return fail('AVATAR_IMAGE_REQUIRED', '数字人需要上传一张人物图片');
    if (audioCount !== 1) return fail('AVATAR_AUDIO_REQUIRED', '数字人需要上传一段音频');
    return success('first_frame');
  }

  if (referenceMode === VIDEO_REFERENCE_MODES.MULTI_SHOT) {
    if (imageCount < 1) return fail('MULTI_SHOT_IMAGE_REQUIRED', '智能多帧模式请至少添加一张图片');
    if (videoCount > 0 || audioCount > 0 || liveMaterialCount > 0) {
      return fail('MULTI_SHOT_IMAGE_ONLY', '智能多帧模式当前仅支持图片素材');
    }
    return ensureSupported('multi_shot');
  }

  if (referenceMode === VIDEO_REFERENCE_MODES.FRAME) {
    if (!hasFirstFrame && !hasLastFrame) return fail('FRAME_REQUIRED', '请至少上传首帧或尾帧');
    const generationMode = hasFirstFrame && hasLastFrame
      ? 'start_end'
      : hasFirstFrame ? 'first_frame' : 'last_frame';
    return ensureSupported(generationMode);
  }

  if (referenceMode !== VIDEO_REFERENCE_MODES.ALL) {
    return fail('REFERENCE_MODE_REQUIRED', '请选择当前模型支持的参考模式');
  }

  if (audioCount > 0 && !isSeedance) {
    return fail('AUDIO_NOT_SUPPORTED', '当前仅 Seedance 系列支持音频参考，请移除音频或切换模型');
  }

  if (isSeedance) return ensureSupported('full');

  const mediaTypeCount = [imageCount > 0, videoCount > 0, audioCount > 0, liveMaterialCount > 0]
    .filter(Boolean).length;
  if (videoCount > 0 && supportedModes.has('video_edit')) return success('video_edit');
  if (mediaTypeCount > 1) return ensureSupported('full');
  if (videoCount > 0) {
    if (supportedModes.has('video_ref')) return success('video_ref');
    if (supportedModes.has('full')) return success('full');
    return fail('VIDEO_NOT_SUPPORTED', '当前模型不支持视频参考，请调整素材或更换模型');
  }
  if (imageCount > 0 || liveMaterialCount > 0) {
    if (supportedModes.has('reference_subjects')) return success('reference_subjects');
    if (supportedModes.has('full')) return success('full');
    return fail('IMAGE_NOT_SUPPORTED', '当前模型不支持全能参考中的图片素材，请选择智能多帧、首尾帧或更换模型');
  }
  if (hasPrompt) return ensureSupported('text_to_video');
  return fail('VIDEO_INPUT_REQUIRED', '请输入文字或添加当前模式支持的参考素材');
}

export function assertVideoRequestCapabilities({
  generationMode,
  referenceMode,
  capabilities = {},
  supportedGenerationModes = [],
  isSeedance = false,
  hasAudio = false,
} = {}) {
  if (!supportedGenerationModes.includes(generationMode)) {
    throw new Error('当前生成能力不在模型 supported_generation_modes 中，请刷新模型数据后重试');
  }
  const mapping = resolveGenerationReferenceModeMap({ capabilities });
  if (!mapping || !Object.prototype.hasOwnProperty.call(mapping, generationMode)) {
    throw new Error('当前模型尚未提供生成模式与参考模式映射，请刷新模型数据或联系后端补充能力配置');
  }
  if (mapping[generationMode] !== referenceMode) {
    throw new Error('当前生成模式与参考模式不匹配，请刷新模型数据后重试');
  }
  if (hasAudio && !isSeedance) {
    throw new Error('当前仅 Seedance 系列支持音频参考，请移除音频或切换模型');
  }
}
