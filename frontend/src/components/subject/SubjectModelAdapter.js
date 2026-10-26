/**
 * @file SubjectModelAdapter.js
 * @structure-index
 *
 * ─── 纯数据转换 ─────────────────────────────────────────────────────
 *   normalizeSubjectImageModels  将图片模型接口响应转换为主体编辑面板模型结构
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收接口数据并返回新数组；不引用 React、页面、API、Store 或 Toast。

 * 2026-10-23：模型目录仅采用服务器可用项，失败/空目录暂停提交并保留草稿。
 * 当前定义定位：normalizeSubjectImageModels L15。
 */

export function normalizeSubjectImageModels(data) {
  const list = Array.isArray(data) ? data : (data?.items || data?.models || []);
  return list.filter(model => model.is_enabled !== false).map((model) => {
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
