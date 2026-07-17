/**
 * @file SubjectModelAdapter.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   normalizeSubjectImageModels  将图片模型接口响应转换为主体编辑面板模型结构
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收接口数据并返回新数组；不引用 React、页面、API、Store 或 Toast。
 */

export function normalizeSubjectImageModels(data) {
  const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
  return list.map((model) => {
    const modelId = model.model_id || model.id;
    const capabilities = model.capabilities || {};
    return {
      value: modelId,
      label: model.name || modelId,
      resolutions: (capabilities.supported_resolutions?.length
        ? capabilities.supported_resolutions
        : capabilities.supported_sizes) || [],
      resolutionSizeMap: capabilities.resolution_size_map || {},
      ratios: capabilities.supported_aspect_ratios || [],
      is_default: model.is_default,
      maxRefImages: capabilities.max_reference_images || 3,
    };
  });
}

export function getFallbackSubjectImageModels() {
  return [
    { value: 'doubao-seedream-5.0-lite', label: 'Doubao-Seed-5.0-Lite', resolutions: ['2K', '3K', '4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], maxRefImages: 3 },
    { value: 'doubao-seedream-4.5', label: 'Doubao-Seed-4.5', resolutions: ['2K', '4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], maxRefImages: 3 },
    { value: 'doubao-seedream-4.0', label: 'Doubao-Seed-4.0', resolutions: ['1K', '2K', '4K'], resolutionSizeMap: {}, ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'], maxRefImages: 3 },
  ];
}
