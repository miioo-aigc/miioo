/**
 * 视频生成能力解析：素材路由由前端决定，生成模式与参考模式绑定由后端映射决定。
 *
 * 2026-08-25  删除模型名称硬编码兜底，完整依赖后端 generation_reference_mode_map；保留 Seedance 全能参考固定走 full。
 * 2026-08-31  Seedance 2.0 仅音频参考增加发送前拦截，Seedance 2.5 保持支持。
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
  FRAME: 'frame',
});

export const VIDEO_SPECIAL_REFERENCE_MODES = Object.freeze({
  MOTION_CONTROL: 'kling_motion_control',
  LIP_SYNC: 'kling_lip_sync',
  AVATAR: 'kling_avatar',
});

const REFERENCE_MODE_LABELS = Object.freeze({
  [VIDEO_REFERENCE_MODES.ALL]: '全能参考',
  [VIDEO_REFERENCE_MODES.FRAME]: '首尾帧',
});

export const SEEDANCE_20_AUDIO_REFERENCE_ERROR_MESSAGE = 'Seedance 2.0 模型不能单独使用音频作为参考素材，请同时上传图片或视频作为参考素材，或者切换seedance 2.5模型创作。';

export function isSeedance20AudioReferenceError(message = '') {
  return String(message).includes('reference_audio cannot be the only reference input.');
}

export function getSeedance20AudioReferenceErrorMessage(message = '') {
  return isSeedance20AudioReferenceError(message)
    ? SEEDANCE_20_AUDIO_REFERENCE_ERROR_MESSAGE
    : '';
}

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

export function isSeedance20VideoModel({ modelId = '', modelName = '' } = {}) {
  const normalized = `${modelId} ${modelName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return normalized.includes('seedance20');
}

export function getAvailableVideoReferenceModes(capabilities = {}) {
  const generationModes = normalizeSupportedGenerationModes(capabilities);
  const modes = [];

  if (generationModes.some((mode) => ALL_REFERENCE_GENERATION_MODES.has(mode))) {
    modes.push({ value: VIDEO_REFERENCE_MODES.ALL, label: REFERENCE_MODE_LABELS.all });
  }
  if (generationModes.some((mode) => FRAME_GENERATION_MODES.has(mode))) {
    modes.push({ value: VIDEO_REFERENCE_MODES.FRAME, label: REFERENCE_MODE_LABELS.frame });
  }

  return modes;
}

export function resolveVideoReferenceModeFallback(currentMode, availableModes = []) {
  const values = availableModes.map((mode) => typeof mode === 'string' ? mode : mode.value);
  if (values.includes(currentMode)) return currentMode;
  return [VIDEO_REFERENCE_MODES.ALL, VIDEO_REFERENCE_MODES.FRAME]
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

/**
 * 当前全能参考仅能文生、但模型提供首尾帧能力时，图片应在进入输入区前请求用户确认切换。
 * 以能力字段判断，不绑定特定厂商或模型名称。
 */
export function shouldConfirmFrameModeForImageReference({
  capabilities = {},
  referenceMode,
} = {}) {
  if (referenceMode !== VIDEO_REFERENCE_MODES.ALL) return false;

  const supportedModes = new Set(normalizeSupportedGenerationModes(capabilities));
  const mapping = resolveGenerationReferenceModeMap({ capabilities });
  const knownModes = new Set([
    ...supportedModes,
    ...Object.keys(mapping || {}),
  ]);
  const supportsImageInAllMode = knownModes.has('reference_subjects')
    || knownModes.has('full');
  const supportsFrameMode = [...FRAME_GENERATION_MODES]
    .some((mode) => knownModes.has(mode));

  return !supportsImageInAllMode && supportsFrameMode;
}

/**
 * 当前全能参考没有图片、视频或音频素材能力、但模型提供首尾帧能力时，
 * 应在保留该模型前请求用户确认切换首尾帧。
 */
export function shouldConfirmFrameModeForAllReferenceMedia({
  capabilities = {},
  referenceMode,
} = {}) {
  if (referenceMode !== VIDEO_REFERENCE_MODES.ALL) return false;

  const supportedModes = new Set(normalizeSupportedGenerationModes(capabilities));
  const mapping = resolveGenerationReferenceModeMap({ capabilities });
  const knownModes = new Set([
    ...supportedModes,
    ...Object.keys(mapping || {}),
  ]);
  const supportsMediaInAllMode = [...ALL_REFERENCE_GENERATION_MODES]
    .some((mode) => mode !== 'text_to_video' && knownModes.has(mode));
  const supportsFrameMode = [...FRAME_GENERATION_MODES]
    .some((mode) => knownModes.has(mode));

  return !supportsMediaInAllMode && supportsFrameMode;
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
  const isSeedance20 = isSeedance20VideoModel({ modelId, modelName });
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

  if (isSeedance20
    && audioCount > 0
    && imageCount === 0
    && videoCount === 0
    && liveMaterialCount === 0
    && !hasFirstFrame
    && !hasLastFrame) {
    return fail('SEEDANCE_20_AUDIO_REFERENCE_REQUIRED', SEEDANCE_20_AUDIO_REFERENCE_ERROR_MESSAGE);
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
    return fail('IMAGE_NOT_SUPPORTED', '当前模型不支持全能参考中的图片素材，请选择首尾帧或更换模型');
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
