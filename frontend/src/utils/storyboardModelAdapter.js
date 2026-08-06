/**
 * 将 Storyboard 生成相关模型接口响应转换为统一的选择器模型。
 * 只负责字段转换和能力读取，不调用 API、Store 或 React 状态。
 */
import { getVideoModelCapabilities } from '../config';

export function normalizeStoryboardDurationOptions(values = []) {
  return values
    .map((duration) => String(duration).endsWith('s') ? String(duration) : `${duration}s`)
    .filter((duration, index, list) => list.indexOf(duration) === index);
}

export function normalizeStoryboardModelList(data, category) {
  const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
  return list.map((item) => {
    const modelId = item.model_id || item.id;
    const capabilities = item.capabilities || {};
    const resolutions = (capabilities.supported_resolutions?.length
      ? capabilities.supported_resolutions
      : capabilities.supported_sizes) || [];
    let durationRange = null;
    if (category === 'video') {
      const durations = capabilities.supported_durations || [];
      durationRange = durations.length > 0
        ? normalizeStoryboardDurationOptions(durations)
        : capabilities.supported_duration_range || null;
      if (!durationRange) durationRange = getVideoModelCapabilities(modelId)?.outputVideo?.durationRange || null;
    }
    return {
      value: modelId,
      label: item.name || modelId,
      capabilities,
      resolutions,
      resolutionSizeMap: capabilities.resolution_size_map || {},
      durationRange,
      is_default: item.is_default,
    };
  });
}
