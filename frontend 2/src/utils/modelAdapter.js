/**
 * 模型适配器
 *
 * 将后端 GET /api/models 返回的 ModelConfigResponse[] 转换为 CreationPage 需要的格式：
 *   - modelOptions: [{ value, label }] 供下拉框使用
 *   - capabilitiesMap: { [model_id]: capabilities } 供参数推导使用
 *
 * 策略：后端优先；单个模型 capabilities 为 null 时回退到本地配置文件。
 */

import {
  getImageModelParams,
  getVideoModelParams,
  getImageModelList,
  getVideoModelList,
} from '../config';

/**
 * 将后端模型列表转换为 CreationPage 需要的格式。
 */
export function adaptModels(backendModels, genType) {
  if (!Array.isArray(backendModels) || backendModels.length === 0) {
    return fallbackToLocal(genType);
  }

  const options = [];
  const caps = {};

  for (const m of backendModels) {
    if (!m.is_enabled) continue;
    const cat = (m.category || '').toLowerCase();
    if (genType === 'image' && !cat.includes('image')) continue;
   if (genType === 'video' && !cat.includes('video')) continue;

    if (genType === 'dubbing') {
      if (!cat.includes('dubbing') && !cat.includes('audio') && !cat.includes('tts') && !cat.includes('speech') && !cat.includes('voice')) continue;
      options.push({ value: m.model_id, label: m.name });
      if (m.capabilities && typeof m.capabilities === 'object' && Object.keys(m.capabilities).length > 0) {
        caps[m.model_id] = m.capabilities;
      }
      continue;
    }

  if (genType === 'dubbing') return { modelOptions: options, capabilitiesMap: caps };

    const refModes = m.capabilities?.reference_modes || [];
    const frameKeys = ['first_frame', 'last_frame', 'start_end', 'multiframe'];
    const hasFrame = refModes.some(r => frameKeys.includes(r));
    const hasFull = refModes.some(r => r === 'full') || refModes.length === 0;
    // 「全能参考」对应的实际后端值：第一个非首尾帧的 reference_mode，或 'full'
    const actualAllRefMode = refModes.find(r => !frameKeys.includes(r)) || 'full';
    // 「首尾帧」对应的实际后端值（含 multiframe）
    const actualFrameRefMode = refModes.find(r => frameKeys.includes(r)) || 'first_frame';
    options.push({
      value: m.model_id, label: m.name,
      refModes, hasFrame, hasFull,
      actualAllRefMode, actualFrameRefMode,
    });

    if (m.capabilities && typeof m.capabilities === 'object' && Object.keys(m.capabilities).length > 0) {
      caps[m.model_id] = m.capabilities;
    }
  }

  return { modelOptions: options, capabilitiesMap: caps };
}

/**
 * 根据 genType + modelId 推导模型参数。
 */
export function getModelParams(genType, modelId, capabilitiesMap) {
  const backendCap = capabilitiesMap?.[modelId];
  if (backendCap) {
    return genType === 'image'
     ? getImageModelParamsFromCap(backendCap)
      : genType === 'dubbing'
      ? getDubbingModelParamsFromCap(backendCap)
     : getVideoModelParamsFromCap(backendCap);
  }
  return genType === 'image'
   ? getImageModelParams(modelId)
    : genType === 'dubbing'
    ? getDubbingModelParamsFromCap(null)
   : getVideoModelParams(modelId);
}

// ── Dubbing model params ──────────────────────────────────────────────────────
const DEFAULT_DUBBING_EMOTIONS = ['中性', '愤怒', '开心', '悲伤', '恐惧', '冷漠', '惊讶', '温柔'];
const DEFAULT_DUBBING_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function getDubbingModelParamsFromCap(capabilities) {
  const emotions = Array.isArray(capabilities?.supported_emotions) && capabilities.supported_emotions.length > 0
    ? capabilities.supported_emotions
    : DEFAULT_DUBBING_EMOTIONS;
  const speeds = Array.isArray(capabilities?.supported_speeds) && capabilities.supported_speeds.length > 0
    ? capabilities.supported_speeds
    : DEFAULT_DUBBING_SPEEDS;
  const defaultSpeed = capabilities?.defaults?.speed ?? 1.0;
  const defaultEmotion = capabilities?.defaults?.emotion ?? (emotions[0] || '');
  return { emotions, speeds, defaults: { speed: defaultSpeed, emotion: defaultEmotion } };
}

function getImageModelParamsFromCap(capabilities) {
  // Support both backend format and local config format
  const hasBackendFormat = capabilities.resolution_size_map !== undefined
    || capabilities.supported_resolutions !== undefined
    || capabilities.supported_sizes !== undefined;

  let resolutions, ratios, resolutionRatios, maxCount;

  if (hasBackendFormat) {
    // Backend format: resolution_size_map + supported_resolutions + supported_aspect_ratios
    const sizeMap = capabilities.resolution_size_map || {};
    const supportedResolutions = (capabilities.supported_resolutions?.length ? capabilities.supported_resolutions : capabilities.supported_sizes) || [];
    resolutions = supportedResolutions
      .filter(r => sizeMap[r] && Object.keys(sizeMap[r]).length > 0);

    // Fallback: if resolution_size_map filtering yields empty results,
    // use supported_resolutions directly (each model has its own resolution set)
    if (resolutions.length === 0 && supportedResolutions.length > 0) {
      resolutions = supportedResolutions;
      const aspectRatiosAll = (capabilities.supported_aspect_ratios || [])
        .filter(r => /^\d+:\d+$/.test(r));
      resolutionRatios = Object.fromEntries(
        supportedResolutions.map(r => [r, aspectRatiosAll])
      );
    }

    // Filter out non-standard ratios like 'adaptive'
    const aspectRatios = (capabilities.supported_aspect_ratios || [])
      .filter(r => /^\d+:\d+$/.test(r));
    ratios = aspectRatios.map(ratio => ({
      value: ratio,
      label: ratio,
      w: parseInt(ratio.split(':')[0]),
      h: parseInt(ratio.split(':')[1]),
    }));

    // Build resolutionRatios from sizeMap: which ratios are available per resolution
    if (!resolutionRatios) {
      resolutionRatios = {};
    }
    for (const res of resolutions) {
      const map = sizeMap[res] || {};
      resolutionRatios[res] = Object.keys(map).filter(r => /^\d+:\d+$/.test(r));
    }

    maxCount = Math.min(capabilities.max_output_images || 4, 4);
  } else {
    // Local config format: resolutions = { "2K": [{ratio, width, height}, ...] }

    if (!capabilities.resolutions || typeof capabilities.resolutions !== 'object') {
      return {
        ratios: [], resolutionRatios: {}, resolutions: [], counts: [],
        defaults: { ratio: '', resolution: '', count: '' },
      };
    }

    resolutions = Object.keys(capabilities.resolutions || {})
      .filter(k => capabilities.resolutions[k] !== null);

    const firstResolution = resolutions[0];
    ratios = capabilities.resolutions?.[firstResolution]?.map(item => ({
      value: item.ratio,
      label: item.ratio,
      w: parseInt(item.ratio.split(':')[0]),
      h: parseInt(item.ratio.split(':')[1]),
    })) || [];

    resolutionRatios = {};
    for (const res of resolutions) {
      const items = capabilities.resolutions?.[res];
      if (Array.isArray(items)) {
        resolutionRatios[res] = items.map(item => item.ratio);
      }
    }

    maxCount = Math.min(capabilities.features?.maxImagesTotal || 4, 4);
  }

  const counts = Array.from({ length: maxCount }, (_, i) => `${i + 1}张`);

  return {
    ratios,
    resolutionRatios,
    resolutions,
    counts,
    defaults: capabilities.defaults || {
      ratio: ratios[0]?.value || '16:9',
      resolution: resolutions[0] || '2K',
      count: '1张',
    },
  };
}

function getVideoModelParamsFromCap(capabilities) {
  // Support both backend format and local config format
  const hasBackendFormat = capabilities.supported_durations !== undefined
    || capabilities.supported_resolutions !== undefined
    || capabilities.supported_sizes !== undefined;

  let ratios, resolutions, durations, refModes, supportsAudio;

  if (hasBackendFormat) {
    // Backend format: flat arrays
    // Filter out non-standard ratios like 'adaptive'
    const aspectRatios = (capabilities.supported_aspect_ratios || [])
      .filter(r => /^\d+:\d+$/.test(r));
    ratios = aspectRatios.map(ratio => ({
      value: ratio,
      label: ratio,
      w: parseInt(ratio.split(':')[0]),
      h: parseInt(ratio.split(':')[1]),
    }));

    resolutions = (capabilities.supported_resolutions?.length ? capabilities.supported_resolutions : capabilities.supported_sizes) || [];

    // Durations come as string array ["4", "5", ..., "12"]
    const durationNums = (capabilities.supported_durations || [])
      .map(d => parseInt(d))
      .filter(n => !isNaN(n));
    durations = durationNums.map(d => `${d}s`);

    // Reference modes mapping: only two categories — 全能参考 / 首尾帧
    const backendRefModes = capabilities.reference_modes || [];
    refModes = [];
    // 首尾帧: first_frame / last_frame / start_end / multiframe
    const frameKeys = ['first_frame', 'last_frame', 'start_end', 'multiframe'];
    const hasFrame = backendRefModes.some(r => frameKeys.includes(r));
    // 全能参考: 只要存在非首尾帧的项（如 full / video_ref），或为空则默认全能
    const nonFrame = backendRefModes.filter(r => !frameKeys.includes(r));
    const hasAll = nonFrame.length > 0 || backendRefModes.length === 0;
    if (hasAll) refModes.push({ value: 'all', label: '全能参考' });
    if (hasFrame) refModes.push({ value: 'frame', label: '首尾帧' });

    // Audio support
    supportsAudio = capabilities.supports_reference_audio || false;
  } else {
    // Local config format: resolutions = { "1080p": [{ratio, width, height}] }
    const resKeys = Object.keys(capabilities.resolutions || {})
      .filter(k => capabilities.resolutions[k] !== null);

    const firstResolution = resKeys[0];
    ratios = capabilities.resolutions?.[firstResolution]?.map(item => ({
      value: item.ratio,
      label: item.ratio,
      w: parseInt(item.ratio.split(':')[0]),
      h: parseInt(item.ratio.split(':')[1]),
    })) || [];

    resolutions = resKeys;

    const [minDuration, maxDuration] = capabilities.outputVideo?.durationRange || [4, 15];
    durations = Array.from(
      { length: maxDuration - minDuration + 1 },
      (_, i) => `${minDuration + i}s`,
    );

    refModes = [];
    const cat = capabilities.category || [];
    // 首尾帧: first-last-frame 或 multiframe
    if (cat.includes('first-last-frame') || cat.includes('multiframe')) {
      refModes.push({ value: 'frame', label: '首尾帧' });
    }
    // 全能参考: multi-modal-ref 或 cat 为空
    const hasAllLocal = cat.includes('multi-modal-ref') || cat.length === 0;
    if (hasAllLocal) refModes.push({ value: 'all', label: '全能参考' });

    supportsAudio = Array.isArray(capabilities.inputAudio?.formats)
      && capabilities.inputAudio.formats.length > 0;
  }

  return {
    ratios,
    resolutions,
    durations,
    refModes,
    supportsAudio,
    defaults: capabilities.defaults || {
      ratio: ratios[0]?.value || '16:9',
      resolution: resolutions[0] || '1080P',
      duration: durations[0] || '5s',
      refMode: refModes[0]?.value,
    },
  };
}

function fallbackToLocal(genType) {
  if (genType === 'image') {
    const list = getImageModelList();
    return { modelOptions: list, capabilitiesMap: {} };
  }
  if (genType === 'dubbing') {
    return { modelOptions: [], capabilitiesMap: {} };
  }
  const list = getVideoModelList();
  return { modelOptions: list, capabilitiesMap: {} };
}
