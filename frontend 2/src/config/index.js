import { IMAGE_MODEL_CAPABILITIES } from './imageModelCapabilities';
import { VIDEO_MODEL_CAPABILITIES } from './videoModelCapabilities';

/**
 * 获取图片模型能力配置
 * @param {string} modelId - 模型 ID
 * @returns {object} 模型能力配置
 */
export function getImageModelCapabilities(modelId) {
  return IMAGE_MODEL_CAPABILITIES[modelId] || null;
}

/**
 * 获取视频模型能力配置
 * @param {string} modelId - 模型 ID
 * @returns {object} 模型能力配置
 */
export function getVideoModelCapabilities(modelId) {
  return VIDEO_MODEL_CAPABILITIES[modelId] || null;
}

/**
 * 获取图片模型的参数配置（用于参数面板渲染）
 * @param {string} modelId - 模型 ID
 * @returns {object} { ratios, resolutions, counts, defaults }
 */
export function getImageModelParams(modelId) {
  const capabilities = getImageModelCapabilities(modelId);
  if (!capabilities) return null;

  const resolutions = Object.keys(capabilities.resolutions)
    .filter(key => capabilities.resolutions[key] !== null);

  const firstResolution = resolutions[0];
  const ratios = capabilities.resolutions[firstResolution]?.map(item => ({
    value: item.ratio,
    label: item.ratio,
    w: parseInt(item.ratio.split(':')[0]),
    h: parseInt(item.ratio.split(':')[1]),
  })) || [];

  // 按分辨率映射可用比例：{ '2K': ['1:1', '16:9', ...], '3K': [...] }
  const resolutionRatios = {};
  for (const res of resolutions) {
    const items = capabilities.resolutions[res];
    if (Array.isArray(items)) {
      resolutionRatios[res] = items.map(item => item.ratio);
    }
  }

  const maxCount = Math.min(capabilities.features?.maxImagesTotal || 4, 4);
  const counts = Array.from({ length: maxCount }, (_, i) => `${i + 1}张`);

  return {
    ratios,
    resolutionRatios,
    resolutions,
    counts,
    defaults: capabilities.defaults || {
      ratio: '16:9',
      resolution: resolutions[0],
      count: '1张',
    },
  };
}

/**
 * 获取视频模型的参数配置（用于参数面板渲染）
 * @param {string} modelId - 模型 ID
 * @returns {object} { ratios, resolutions, durations, refModes, supportsAudio, defaults }
 */
export function getVideoModelParams(modelId) {
  const capabilities = getVideoModelCapabilities(modelId);
  if (!capabilities) return null;

  const resolutions = Object.keys(capabilities.resolutions)
    .filter(key => capabilities.resolutions[key] !== null);

  const firstResolution = resolutions[0];
  const ratios = capabilities.resolutions[firstResolution]?.map(item => ({
    value: item.ratio,
    label: item.ratio,
    w: parseInt(item.ratio.split(':')[0]),
    h: parseInt(item.ratio.split(':')[1]),
  })) || [];

  const [minDuration, maxDuration] = capabilities.outputVideo.durationRange;
  const durations = Array.from(
    { length: maxDuration - minDuration + 1 },
    (_, i) => `${minDuration + i}s`
  );

  const refModes = [];
  if (capabilities.category.includes('multi-modal-ref')) {
    refModes.push({ value: 'all', label: '全能参考' });
  }
  if (capabilities.category.includes('first-last-frame')) {
    refModes.push({ value: 'frame', label: '首尾帧' });
  }
  if (capabilities.features?.multiImageInput) {
    refModes.push({ value: 'multi', label: '智能多帧' });
  }

  // 检查模型是否支持音频输入
  const supportsAudio = capabilities.inputAudio &&
    capabilities.inputAudio.formats &&
    capabilities.inputAudio.formats.length > 0;

  return {
    ratios,
    resolutions,
    durations,
    refModes,
    supportsAudio,
    defaults: capabilities.defaults || {
      ratio: '16:9',
      resolution: '1080p',
      duration: durations[0],
      refMode: refModes[0]?.value,
    },
  };
}

/**
 * 获取所有图片模型列表
 * @returns {Array<{value: string, label: string}>}
 */
export function getImageModelList() {
  return Object.values(IMAGE_MODEL_CAPABILITIES).map(model => ({
    value: model.id,
    label: model.displayName,
  }));
}

/**
 * 获取所有视频模型列表
 * @returns {Array<{value: string, label: string}>}
 */
export function getVideoModelList() {
  return Object.values(VIDEO_MODEL_CAPABILITIES).map(model => ({
    value: model.id,
    label: model.displayName,
  }));
}

export { IMAGE_MODEL_CAPABILITIES, VIDEO_MODEL_CAPABILITIES };
