/**
 * 视频模型展示聚合与实际请求路由。
 *
 * 后端按厂商能力拆分的入口在菜单中聚合展示；请求时仍使用对应入口的真实 model_id。
 */
import {
  getAvailableVideoReferenceModes,
  isSeedanceVideoModel,
  normalizeSupportedGenerationModes,
} from './videoModelCapabilities';

export const VIDEO_SPECIAL_REFERENCE_MODES = Object.freeze({
  MOTION_CONTROL: 'kling_motion_control',
  LIP_SYNC: 'kling_lip_sync',
  AVATAR: 'kling_avatar',
});

const SPECIAL_MODE_CONFIG = Object.freeze({
  [VIDEO_SPECIAL_REFERENCE_MODES.MOTION_CONTROL]: {
    label: '动作控制',
    modelId: 'video-kling-v3-motion',
    generationMode: 'video_edit',
    referenceMode: 'video_ref',
    capabilities: {
      supported_generation_modes: ['video_edit'],
      generation_reference_mode_map: { video_edit: 'video_ref' },
      max_reference_videos: 1,
      max_reference_images: 0,
      max_reference_audios: 0,
    },
  },
  [VIDEO_SPECIAL_REFERENCE_MODES.LIP_SYNC]: {
    label: '对口型',
    modelId: 'video-kling-v3-lipsync',
    generationMode: 'video_edit',
    referenceMode: 'video_ref',
    capabilities: {
      supported_generation_modes: ['video_edit'],
      generation_reference_mode_map: { video_edit: 'video_ref' },
      max_reference_videos: 1,
      max_reference_images: 1,
      max_reference_audios: 1,
    },
  },
  [VIDEO_SPECIAL_REFERENCE_MODES.AVATAR]: {
    label: '数字人',
    modelId: 'video-kling-v3-avatar',
    generationMode: 'first_frame',
    referenceMode: 'first_frame',
    capabilities: {
      supported_generation_modes: ['first_frame'],
      generation_reference_mode_map: { first_frame: 'first_frame' },
      max_reference_videos: 0,
      max_reference_images: 1,
      max_reference_audios: 1,
    },
  },
});

const VIDEO_MODEL_SORT_PRIORITY = Object.freeze([
  'seedance',
  'kling',
  'vidu',
  'happyhorse',
  'veo',
]);

function isVideoModel(item) {
  return String(item?.category || '').toLowerCase().includes('video');
}

function enabled(item) {
  return item?.is_enabled !== false;
}

function capabilitiesOf(item) {
  return item?.capabilities && typeof item.capabilities === 'object' ? item.capabilities : {};
}

function mergeCapabilities(items) {
  const first = capabilitiesOf(items[0]);
  const merged = { ...first };
  const arrayFields = [
    'supported_aspect_ratios', 'supported_resolutions', 'supported_sizes',
    'supported_durations', 'supported_generation_modes', 'reference_modes',
  ];
  for (const field of arrayFields) {
    const values = items.flatMap((item) => Array.isArray(capabilitiesOf(item)[field]) ? capabilitiesOf(item)[field] : []);
    if (values.length > 0) merged[field] = [...new Set(values)];
  }
  const maps = items
    .map((item) => capabilitiesOf(item).generation_reference_mode_map)
    .filter((map) => map && typeof map === 'object' && !Array.isArray(map));
  if (maps.length > 0) {
    merged.generation_reference_mode_map = Object.assign({}, ...maps);
  }
  for (const field of [
    'max_reference_images', 'max_reference_videos', 'max_reference_audios',
    'max_total_attachments', 'max_subjects', 'max_subject_images_per_subject',
    'max_multiframe_segments',
  ]) {
    const values = items
      .map((item) => capabilitiesOf(item)[field])
      .filter((value) => typeof value === 'number');
    if (values.length > 0) merged[field] = Math.max(...values);
  }
  for (const field of [
    'supports_reference_video', 'supports_reference_audio', 'supports_reference_subjects',
    'supports_multishot', 'supports_multiframe', 'supports_video_edit',
    'supports_video_extension', 'supports_live_material', 'supports_text_only',
  ]) {
    if (items.some((item) => capabilitiesOf(item)[field] === true)) merged[field] = true;
  }
  return merged;
}

function createOption({ modelId, label, records, routeModels = {}, specialReferenceModes = [] }) {
  const capabilities = mergeCapabilities(records);
  return {
    value: modelId,
    label,
    capabilities,
    sourceModelIds: records.map((item) => item.model_id || item.id).filter(Boolean),
    routeModels,
    specialReferenceModes,
    supportedGenerationModes: normalizeSupportedGenerationModes(capabilities),
    availableReferenceModes: [
      ...getAvailableVideoReferenceModes(capabilities),
      ...specialReferenceModes.map((value) => ({ value, label: SPECIAL_MODE_CONFIG[value].label })),
    ],
    isSeedance: isSeedanceVideoModel({ modelId, modelName: label, capabilities }),
    supportsLiveMaterial: Boolean(capabilities.supports_live_material || /seedance/i.test(modelId)),
  };
}

function createGroupedOption(group, records) {
  const routeModels = {};
  records.forEach((record) => {
    const id = record.model_id || record.id;
    const modes = normalizeSupportedGenerationModes(capabilitiesOf(record));
    modes.forEach((mode) => {
      if (!routeModels[mode]) routeModels[mode] = { modelId: id, capabilities: capabilitiesOf(record) };
    });
  });
  return createOption({
    modelId: group.modelId,
    label: group.label,
    records,
    routeModels,
    specialReferenceModes: group.specialReferenceModes || [],
  });
}

function unwrapModelList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  for (const key of ['items', 'models', 'data', 'd', 'results']) {
    if (Array.isArray(data[key])) return data[key];
  }

  return [];
}

function getVideoModelSortPriority(option) {
  const searchableText = [
    option?.value,
    option?.label,
    ...(Array.isArray(option?.sourceModelIds) ? option.sourceModelIds : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const matchedPriority = VIDEO_MODEL_SORT_PRIORITY.findIndex((keyword) => (
    searchableText.includes(keyword)
  ));

  return matchedPriority === -1 ? VIDEO_MODEL_SORT_PRIORITY.length : matchedPriority;
}

export function sortVideoModelOptions(options = []) {
  return options
    .map((option, originalIndex) => ({
      option,
      originalIndex,
      priority: getVideoModelSortPriority(option),
    }))
    .sort((first, second) => first.priority - second.priority || first.originalIndex - second.originalIndex)
    .map(({ option }) => option);
}

export function normalizeVideoModelList(backendModels) {
  const list = unwrapModelList(backendModels).filter((item) => enabled(item) && isVideoModel(item));
  const consumed = new Set();
  const options = [];

  const groups = [
    { modelId: 'happyhorse-1.0', label: 'HappyHorse 1.0', match: (item) => /happyhorse-1\.0-(t2v|i2v|r2v|video-edit)$/i.test(item.model_id || '') },
    { modelId: 'happyhorse-1.1', label: 'HappyHorse 1.1', match: (item) => /happyhorse-1\.1-(t2v|i2v|r2v|video-edit)$/i.test(item.model_id || '') },
  ];

  for (const group of groups) {
    const records = list.filter(group.match);
    if (records.length > 0) {
      records.forEach((record) => consumed.add(record.model_id || record.id));
      options.push(createGroupedOption(group, records));
    }
  }

  const klingSpecialIds = new Set(Object.values(SPECIAL_MODE_CONFIG).map((item) => item.modelId));
  const klingBase = list.find((item) => item.model_id === 'video-kling-v3');
  if (klingBase) {
    const records = [klingBase];
    const availableSpecialModes = [];
    for (const [mode, config] of Object.entries(SPECIAL_MODE_CONFIG)) {
      const record = list.find((item) => item.model_id === config.modelId);
      if (record) {
        records.push(record);
        consumed.add(config.modelId);
        availableSpecialModes.push({ mode, record });
      }
    }
    const specialReferenceModes = availableSpecialModes.map(({ mode }) => mode);
    consumed.add(klingBase.model_id);
    const option = createGroupedOption(
      { modelId: 'video-kling-v3', label: 'Kling V3', specialReferenceModes },
      records,
    );
    option.capabilities = capabilitiesOf(klingBase);
    option.supportedGenerationModes = normalizeSupportedGenerationModes(option.capabilities);
    option.availableReferenceModes = [
      ...getAvailableVideoReferenceModes(option.capabilities),
      ...specialReferenceModes.map((value) => ({ value, label: SPECIAL_MODE_CONFIG[value].label })),
    ];
    option.specialRouteModels = Object.fromEntries(
      availableSpecialModes.map(({ mode, record }) => [mode, {
        modelId: record.model_id,
        capabilities: capabilitiesOf(record),
        generationMode: SPECIAL_MODE_CONFIG[mode].generationMode,
        referenceMode: SPECIAL_MODE_CONFIG[mode].referenceMode,
      }]),
    );
    options.push(option);
  }

  for (const item of list) {
    const id = item.model_id || item.id;
    if (consumed.has(id) || klingSpecialIds.has(id)) continue;
    options.push(createOption({
      modelId: id,
      label: item.name || id,
      records: [item],
      routeModels: Object.fromEntries(
        normalizeSupportedGenerationModes(capabilitiesOf(item)).map((mode) => [mode, {
          modelId: id,
          capabilities: capabilitiesOf(item),
        }]),
      ),
    }));
  }

  return options;
}

export function resolveVideoModelRoute({ modelOption, generationMode, referenceMode } = {}) {
  if (!modelOption) return null;
  const specialRoute = modelOption.specialRouteModels?.[referenceMode];
  if (specialRoute) return specialRoute;
  return modelOption.routeModels?.[generationMode] || null;
}

export function getVideoSpecialReferenceModeConfig(mode) {
  return SPECIAL_MODE_CONFIG[mode] || null;
}
