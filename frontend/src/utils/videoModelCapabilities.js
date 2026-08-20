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

const REFERENCE_MODE_LABELS = Object.freeze({
  [VIDEO_REFERENCE_MODES.ALL]: '全能参考',
  [VIDEO_REFERENCE_MODES.MULTI_SHOT]: '智能多帧',
  [VIDEO_REFERENCE_MODES.FRAME]: '首尾帧',
});

const LOCAL_GENERATION_REFERENCE_MODE_FALLBACKS = Object.freeze([
  {
    keys: ['happyhorse'],
    map: {
      text_to_video: 'full',
      first_frame: 'first_frame',
      reference_subjects: 'full',
      video_edit: 'video_ref',
    },
  },
  {
    keys: ['klingv3omni'],
    map: {
      text_to_video: 'full',
      first_frame: 'first_frame',
      start_end: 'start_end',
      video_ref: 'video_ref',
      multi_shot: 'full',
    },
  },
  {
    keys: ['klingv3'],
    map: {
      text_to_video: 'first_frame',
      first_frame: 'first_frame',
      reference_subjects: 'first_frame',
      multi_shot: 'first_frame',
    },
  },
  {
    keys: ['seedance'],
    map: {
      full: 'full',
      first_frame: 'first_frame',
      start_end: 'last_frame',
    },
  },
  {
    keys: ['viduq3pro'],
    map: {
      text_to_video: 'first_frame',
      first_frame: 'first_frame',
      start_end: 'first_frame',
    },
  },
  {
    keys: ['viduq2turbo'],
    map: {
      first_frame: 'first_frame',
      start_end: 'first_frame',
    },
  },
  {
    keys: ['viduq2'],
    map: {
      first_frame: 'first_frame',
      start_end: 'first_frame',
    },
  },
  {
    keys: ['veo31fast'],
    map: {
      text_to_video: 'full',
      reference_subjects: 'full',
      first_frame: 'first_frame',
      start_end: 'first_frame',
    },
  },
  {
    keys: ['veo31'],
    map: {
      text_to_video: 'full',
      reference_subjects: 'full',
      first_frame: 'first_frame',
      start_end: 'first_frame',
    },
  },
]);

function normalizeModelKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[\s•、_\-:.]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getLocalGenerationReferenceModeMap({ modelId = '', modelName = '' } = {}) {
  const modelKey = normalizeModelKey(`${modelId} ${modelName}`);
  const fallback = LOCAL_GENERATION_REFERENCE_MODE_FALLBACKS.find(({ keys }) =>
    keys.some((key) => modelKey.includes(key))
  );
  return fallback ? fallback.map : null;
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

export function resolveGenerationReferenceModeMap({
  modelId = '',
  modelName = '',
  capabilities = {},
} = {}) {
  return normalizeGenerationReferenceModeMap(capabilities)
    || getLocalGenerationReferenceModeMap({ modelId, modelName });
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
  modelId = '',
  modelName = '',
  capabilities = {},
} = {}) {
  const mapping = resolveGenerationReferenceModeMap({ modelId, modelName, capabilities });
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
  modelId = '',
  modelName = '',
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
  const mapping = resolveGenerationReferenceModeMap({ modelId, modelName, capabilities });
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
